import { Router, type Request, type Response } from "express";
import { prisma } from "../prisma.js";
import { toTagChipData } from "../tagChip.js";

const router = Router();

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

// DELETE /item/:id
router.delete("/:id", async (req: Request, res: Response) => {
    // Remove item from restaurant list
});

export default router;