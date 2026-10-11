import { Router, type Request, type Response } from "express";
import { prisma } from "../prisma.js";
import { toTagChipData } from "../tagChip.js";
import type { Prisma } from "../generated/prisma/client.js";

const router = Router();

// matches the max result count of a Google Places text search, so the map
// never shows more than 20 markers
const MAX_SEARCH_RESULTS = 20
// item names returned per result to show why a location matched
const MAX_MATCHED_ITEMS = 3

// Parses an optional numeric query param. Returns undefined when absent,
// null when present but not a finite number.
function parseNumberParam(value: unknown): number | undefined | null {
    if (value === undefined || value === '') return undefined
    if (typeof value !== 'string') return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
}

// GET /location/search — search saved locations. Every param is optional:
//   q                          text matched against location name, location tags, item names and item tags
//   tags                       comma-separated tag ids; a location must carry every one (on itself or an item)
//   min_price, max_price       at least one logged item priced in range
//   north, south, east, west   map bounds; all four or none
//   limit                      max results, capped at MAX_SEARCH_RESULTS
router.get("/search", async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''

    let tagIds: bigint[] = []
    if (typeof req.query.tags === 'string' && req.query.tags.length > 0) {
        try {
            tagIds = req.query.tags.split(',').map((id) => BigInt(id))
        } catch {
            return res.status(400).json({ error: 'tags must be comma-separated integers' })
        }
    }

    const minPrice = parseNumberParam(req.query.min_price)
    const maxPrice = parseNumberParam(req.query.max_price)
    if (minPrice === null || maxPrice === null) {
        return res.status(400).json({ error: 'min_price and max_price must be numbers' })
    }

    const north = parseNumberParam(req.query.north)
    const south = parseNumberParam(req.query.south)
    const east = parseNumberParam(req.query.east)
    const west = parseNumberParam(req.query.west)
    const bounds = [north, south, east, west]
    if (bounds.includes(null)) {
        return res.status(400).json({ error: 'north, south, east and west must be numbers' })
    }
    if (bounds.some((b) => b !== undefined) && bounds.some((b) => b === undefined)) {
        return res.status(400).json({ error: 'north, south, east and west must be sent together' })
    }

    const limitParam = parseNumberParam(req.query.limit)
    if (limitParam === null || (limitParam !== undefined && limitParam < 1)) {
        return res.status(400).json({ error: 'limit must be a positive number' })
    }
    const limit = Math.min(Math.floor(limitParam ?? MAX_SEARCH_RESULTS), MAX_SEARCH_RESULTS)

    const conditions: Prisma.locationsWhereInput[] = []

    if (q) {
        const contains = { contains: q, mode: 'insensitive' as const }
        conditions.push({
            OR: [
                { name: contains },
                { location_tags: { some: { tags: { name: contains } } } },
                { items: { some: { name: contains } } },
                { items: { some: { item_tags: { some: { tags: { name: contains } } } } } },
            ],
        })
    }

    for (const tagId of tagIds) {
        conditions.push({
            OR: [
                { location_tags: { some: { tag_id: tagId } } },
                { items: { some: { item_tags: { some: { tag_id: tagId } } } } },
            ],
        })
    }

    const hasPrice = minPrice !== undefined || maxPrice !== undefined
    const priceFilter = {
        ...(minPrice !== undefined && { gte: minPrice }),
        ...(maxPrice !== undefined && { lte: maxPrice }),
    }
    if (hasPrice) {
        conditions.push({ items: { some: { price: priceFilter } } })
    }

    if (north != null && south != null && east != null && west != null) {
        conditions.push({ latitude: { gte: south, lte: north } })
        // bounds that cross the antimeridian have west > east
        conditions.push(
            west <= east
                ? { longitude: { gte: west, lte: east } }
                : { OR: [{ longitude: { gte: west } }, { longitude: { lte: east } }] }
        )
    }

    const where: Prisma.locationsWhereInput = { AND: conditions }

    try {
        const [total, locations] = await prisma.$transaction([
            prisma.locations.count({ where }),
            prisma.locations.findMany({
                where,
                take: limit,
                orderBy: [{ rating: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
                include: {
                    location_tags: { include: { tags: true } },
                    items: { select: { id: true, name: true, price: true } },
                },
            }),
        ])

        const qLower = q.toLowerCase()
        const results = locations.map(({ location_tags, items, ...locationFields }) => {
            const prices = items.filter((i) => i.price != null).map((i) => Number(i.price))
            const matchedItems = items
                .filter((i) => {
                    const nameMatch = qLower.length > 0 && i.name.toLowerCase().includes(qLower)
                    const price = i.price != null ? Number(i.price) : null
                    const priceMatch =
                        hasPrice &&
                        price != null &&
                        (minPrice === undefined || price >= minPrice) &&
                        (maxPrice === undefined || price <= maxPrice)
                    return nameMatch || priceMatch
                })
                .slice(0, MAX_MATCHED_ITEMS)
                .map((i) => i.name)

            return {
                ...locationFields,
                tags: location_tags.map((lt) => toTagChipData(lt.tags)),
                item_count: items.length,
                price_min: prices.length > 0 ? Math.min(...prices) : null,
                price_max: prices.length > 0 ? Math.max(...prices) : null,
                matched_items: matchedItems,
            }
        })

        res.json({ total, results })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'search failed' })
    }
});

// GET /location?google_place_id=... — check whether a location has been added to a list
router.get("/", async (req: Request, res: Response) => {
    const googlePlaceId = req.query.google_place_id

    if (typeof googlePlaceId !== 'string' || googlePlaceId.length === 0) {
        return res.status(400).json({ error: 'google_place_id query param is required' })
    }

    try {
        const location = await prisma.locations.findUnique({
            where: { google_place_id: googlePlaceId },
            include: {
                location_tags: { include: { tags: true } },
            },
        });

        if (!location) {
            return res.json({ exists: false });
        }

        const { location_tags, ...locationFields } = location
        res.json({
            exists: true,
            location: {
                ...locationFields,
                tags: location_tags.map((lt) => toTagChipData(lt.tags)),
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'query failed' });
    }
});

// POST /location — add a place to the locations table
router.post("/", async (req: Request, res: Response) => {
    const { google_place_id, name, address, latitude, longitude, rating } = req.body

    if (typeof google_place_id !== 'string' || google_place_id.length === 0) {
        return res.status(400).json({ error: 'google_place_id is required' })
    }
    if (typeof name !== 'string' || name.length === 0) {
        return res.status(400).json({ error: 'name is required' })
    }
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ error: 'latitude and longitude are required numbers' })
    }

    try {
        const location = await prisma.locations.create({
            data: {
                google_place_id,
                name,
                address: address ?? null,
                latitude,
                longitude,
                rating: rating ?? null,
            },
        })
        // a brand-new location can't have any tags applied yet — keep the
        // response shape consistent with GET /location's { ...location, tags }
        res.status(201).json({ ...location, tags: [] })
    } catch (err: any) {
        // unique constraint on google_place_id -> someone already added this place
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'location already exists' })
        }
        console.error(err)
        res.status(500).json({ error: 'failed to create location' })
    }
});

// PATCH /location/:id — update location rating and/or notes.
// Only fields present in the body are changed; send null to clear one.
router.patch("/:id", async (req: Request, res: Response) => {
    const { rating, description } = req.body

    let idBigInt: bigint
    try {
        idBigInt = BigInt(req.params.id as string)
    } catch {
        return res.status(400).json({ error: 'id must be a valid integer' })
    }

    if (rating !== undefined && rating !== null && typeof rating !== 'number') {
        return res.status(400).json({ error: 'rating must be a number' })
    }
    if (description !== undefined && description !== null && typeof description !== 'string') {
        return res.status(400).json({ error: 'description must be a string' })
    }
    if (rating === undefined && description === undefined) {
        return res.status(400).json({ error: 'nothing to update' })
    }

    try {
        const location = await prisma.locations.update({
            where: { id: idBigInt },
            data: {
                ...(rating !== undefined && { rating }),
                ...(description !== undefined && { description }),
                updated_at: new Date(),
            },
            include: {
                location_tags: { include: { tags: true } },
            },
        })

        // same { ...location, tags } shape as GET /location
        const { location_tags, ...locationFields } = location
        res.json({
            ...locationFields,
            tags: location_tags.map((lt) => toTagChipData(lt.tags)),
        })
    } catch (err: any) {
        // record to update not found
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'location not found' })
        }
        // value too long for its column (e.g. description > 1000 chars)
        if (err.code === 'P2000') {
            return res.status(400).json({ error: 'a value is too long' })
        }
        console.error(err)
        res.status(500).json({ error: 'failed to update location' })
    }
});

// POST /location/:id/tags — apply an existing tag to a location.
// Responds with the applied tag in the same chip shape as GET /location's tags.
router.post("/:id/tags", async (req: Request, res: Response) => {
    const { tag_id } = req.body

    // JSON has no bigint type, so tag_id arrives as a string or number.
    if (tag_id === undefined || tag_id === null || (typeof tag_id !== 'string' && typeof tag_id !== 'number')) {
        return res.status(400).json({ error: 'tag_id is required' })
    }

    let idBigInt: bigint
    let tagIdBigInt: bigint
    try {
        idBigInt = BigInt(req.params.id as string)
        tagIdBigInt = BigInt(tag_id)
    } catch {
        return res.status(400).json({ error: 'id and tag_id must be valid integers' })
    }

    try {
        const locationTag = await prisma.location_tags.create({
            data: { location_id: idBigInt, tag_id: tagIdBigInt },
            include: { tags: true },
        })
        res.status(201).json(toTagChipData(locationTag.tags))
    } catch (err: any) {
        // FK violation -> location or tag doesn't exist
        if (err.code === 'P2003') {
            return res.status(400).json({ error: 'location or tag does not exist' })
        }
        // composite PK (location_id, tag_id) -> already applied
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'tag already applied to this location' })
        }
        console.error(err)
        res.status(500).json({ error: 'failed to apply tag to location' })
    }
});

// DELETE /location/:id/tags/:tagId — remove a tag from a location (the shared `tags` row is kept)
router.delete("/:id/tags/:tagId", async (req: Request, res: Response) => {
    let idBigInt: bigint
    let tagIdBigInt: bigint
    try {
        idBigInt = BigInt(req.params.id as string)
        tagIdBigInt = BigInt(req.params.tagId as string)
    } catch {
        return res.status(400).json({ error: 'id and tagId must be valid integers' })
    }

    try {
        await prisma.location_tags.delete({
            where: { location_id_tag_id: { location_id: idBigInt, tag_id: tagIdBigInt } },
        })
        res.status(204).end()
    } catch (err: any) {
        // record to delete not found
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'tag not applied to this location' })
        }
        console.error(err)
        res.status(500).json({ error: 'failed to remove tag from location' })
    }
});

// DELETE /location/:id — remove a location from the list.
// This is a hard delete: the location's items, their item_tags and its
// location_tags go with it (the shared `tags` rows are kept). Every FK is
// NoAction, so children are deleted first, all in one transaction.
router.delete("/:id", async (req: Request, res: Response) => {
    let idBigInt: bigint
    try {
        idBigInt = BigInt(req.params.id as string)
    } catch {
        return res.status(400).json({ error: 'id must be a valid integer' })
    }

    try {
        const [, deletedItems] = await prisma.$transaction([
            prisma.item_tags.deleteMany({ where: { items: { location_id: idBigInt } } }),
            prisma.items.deleteMany({ where: { location_id: idBigInt } }),
            prisma.location_tags.deleteMany({ where: { location_id: idBigInt } }),
            prisma.locations.delete({ where: { id: idBigInt } }),
        ])
        res.json({ deleted_items: deletedItems.count })
    } catch (err: any) {
        // record to delete not found
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'location not found' })
        }
        console.error(err)
        res.status(500).json({ error: 'failed to delete location' })
    }
});

export default router;