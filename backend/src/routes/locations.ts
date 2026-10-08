import { Router, type Request, type Response } from "express";
import { prisma } from "../prisma.js";
import { toTagChipData } from "../tagChip.js";

const router = Router();

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

// DELETE /location/:id
router.delete("/:id", async (req: Request, res: Response) => {
    // Remove saved location
});

export default router;