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

// PATCH /location/:id
router.patch("/:id", async (req: Request, res: Response) => {
    // Update location rating and/or notes
});

// DELETE /location/:id
router.delete("/:id", async (req: Request, res: Response) => {
    // Remove saved location
});

export default router;