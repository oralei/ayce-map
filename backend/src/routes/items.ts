import { Router, type Request, type Response } from "express";
import { prisma } from "../prisma.js";
import { toTagChipData } from "../tagChip.js";

const router = Router();

// GET /item?location_id=... — fetch all items logged for a given location
router.get("/", async (req: Request, res: Response) => {
    const locationId = req.query.location_id

    if (typeof locationId !== 'string' || locationId.length === 0) {
        return res.status(400).json({ error: 'location_id query param is required' })
    }

    let locationIdBigInt: bigint
    try {
        locationIdBigInt = BigInt(locationId)
    } catch {
        return res.status(400).json({ error: 'location_id must be a valid integer' })
    }

    try {
        const items = await prisma.items.findMany({
            where: { location_id: locationIdBigInt },
            orderBy: { created_at: 'desc' },
            include: {
                item_tags: { include: { tags: true } },
            },
        })

        const itemsWithTags = items.map(({ item_tags, ...item }) => ({
            ...item,
            tags: item_tags.map((it) => toTagChipData(it.tags, it.category)),
        }))

        res.json({ items: itemsWithTags })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'query failed' })
    }
});

// GET /item/price-range — lowest and highest logged item price, for the
// price filter inputs. Both are null when no item has a price yet.
router.get("/price-range", async (_req: Request, res: Response) => {
    try {
        const { _min, _max } = await prisma.items.aggregate({
            _min: { price: true },
            _max: { price: true },
        })
        res.json({
            min: _min.price != null ? Number(_min.price) : null,
            max: _max.price != null ? Number(_max.price) : null,
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'query failed' })
    }
});

// POST /item — add an item to a location
router.post("/", async (req: Request, res: Response) => {
    const { location_id, name, price, rating, description } = req.body

    // JSON has no bigint type, so req.body.location_id arrives as a string or number.
    if (
        location_id === undefined ||
        location_id === null ||
        (typeof location_id !== 'string' && typeof location_id !== 'number')
    ) {
        return res.status(400).json({ error: 'location_id is required' })
    }

    let locationIdBigInt: bigint
    try {
        locationIdBigInt = BigInt(location_id)
    } catch {
        return res.status(400).json({ error: 'location_id must be a valid integer' })
    }

    if (typeof name !== 'string' || name.length === 0) {
        return res.status(400).json({ error: 'name is required' })
    }
    if (price !== undefined && price !== null && typeof price !== 'number') {
        return res.status(400).json({ error: 'price must be a number' })
    }
    if (rating !== undefined && rating !== null && typeof rating !== 'number') {
        return res.status(400).json({ error: 'rating must be a number' })
    }

    try {
        const item = await prisma.items.create({
            data: {
                location_id: locationIdBigInt,
                name,
                rating: rating ?? null,
                price: price ?? null,
                description: description ?? null,
            },
        })
        res.status(201).json(item)
    } catch (err: any) {
        // foreign key violation -> location_id doesn't reference an existing row in `locations`
        if (err.code === 'P2003') {
            return res.status(400).json({ error: 'location_id does not reference an existing location' })
        }
        console.error(err)
        res.status(500).json({ error: 'failed to add item' })
    }
});

// PATCH /item/:id — update item name, rating, price and/or notes.
// Only fields present in the body are changed; send null to clear an optional one.
router.patch("/:id", async (req: Request, res: Response) => {
    const { name, price, rating, description } = req.body

    let idBigInt: bigint
    try {
        idBigInt = BigInt(req.params.id as string)
    } catch {
        return res.status(400).json({ error: 'id must be a valid integer' })
    }

    if (name !== undefined && (typeof name !== 'string' || name.length === 0)) {
        return res.status(400).json({ error: 'name must be a non-empty string' })
    }
    if (price !== undefined && price !== null && typeof price !== 'number') {
        return res.status(400).json({ error: 'price must be a number' })
    }
    if (rating !== undefined && rating !== null && typeof rating !== 'number') {
        return res.status(400).json({ error: 'rating must be a number' })
    }
    if (description !== undefined && description !== null && typeof description !== 'string') {
        return res.status(400).json({ error: 'description must be a string' })
    }
    if ([name, price, rating, description].every((v) => v === undefined)) {
        return res.status(400).json({ error: 'nothing to update' })
    }

    try {
        const item = await prisma.items.update({
            where: { id: idBigInt },
            data: {
                ...(name !== undefined && { name }),
                ...(price !== undefined && { price }),
                ...(rating !== undefined && { rating }),
                ...(description !== undefined && { description }),
                updated_at: new Date(),
            },
            include: {
                item_tags: { include: { tags: true } },
            },
        })

        // same { ...item, tags } shape as GET /items
        const { item_tags, ...itemFields } = item
        res.json({
            ...itemFields,
            tags: item_tags.map((it) => toTagChipData(it.tags, it.category)),
        })
    } catch (err: any) {
        // record to update not found
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'item not found' })
        }
        // value too long for its column (e.g. name > 255 or description > 1000 chars)
        if (err.code === 'P2000') {
            return res.status(400).json({ error: 'a value is too long' })
        }
        console.error(err)
        res.status(500).json({ error: 'failed to update item' })
    }
});

// POST /item/:id/tags — apply an existing tag to an item. `category` is the
// optional per-item category override stored on item_tags (the tag picker
// sends whichever category the tag was picked from).
// Responds with the applied tag in the same chip shape as GET /item's tags.
router.post("/:id/tags", async (req: Request, res: Response) => {
    const { tag_id, category } = req.body

    // JSON has no bigint type, so tag_id arrives as a string or number.
    if (tag_id === undefined || tag_id === null || (typeof tag_id !== 'string' && typeof tag_id !== 'number')) {
        return res.status(400).json({ error: 'tag_id is required' })
    }
    if (category !== undefined && category !== null && typeof category !== 'string') {
        return res.status(400).json({ error: 'category must be a string' })
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
        const itemTag = await prisma.item_tags.create({
            data: { item_id: idBigInt, tag_id: tagIdBigInt, category: category ?? null },
            include: { tags: true },
        })
        res.status(201).json(toTagChipData(itemTag.tags, itemTag.category))
    } catch (err: any) {
        // FK violation -> item or tag doesn't exist
        if (err.code === 'P2003') {
            return res.status(400).json({ error: 'item or tag does not exist' })
        }
        // composite PK (item_id, tag_id) -> already applied
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'tag already applied to this item' })
        }
        // category longer than its column
        if (err.code === 'P2000') {
            return res.status(400).json({ error: 'category is too long' })
        }
        console.error(err)
        res.status(500).json({ error: 'failed to apply tag to item' })
    }
});

// DELETE /item/:id/tags/:tagId — remove a tag from an item (the shared `tags` row is kept)
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
        await prisma.item_tags.delete({
            where: { item_id_tag_id: { item_id: idBigInt, tag_id: tagIdBigInt } },
        })
        res.status(204).end()
    } catch (err: any) {
        // record to delete not found
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'tag not applied to this item' })
        }
        console.error(err)
        res.status(500).json({ error: 'failed to remove tag from item' })
    }
});

// DELETE /item/:id — remove an item (and its item_tags) from a location
router.delete("/:id", async (req: Request, res: Response) => {
    let idBigInt: bigint
    try {
        idBigInt = BigInt(req.params.id as string)
    } catch {
        return res.status(400).json({ error: 'id must be a valid integer' })
    }

    try {
        // item_tags FK is NoAction, so clear those first
        await prisma.$transaction([
            prisma.item_tags.deleteMany({ where: { item_id: idBigInt } }),
            prisma.items.delete({ where: { id: idBigInt } }),
        ])
        res.status(204).end()
    } catch (err: any) {
        // record to delete not found
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'item not found' })
        }
        console.error(err)
        res.status(500).json({ error: 'failed to delete item' })
    }
});

export default router;