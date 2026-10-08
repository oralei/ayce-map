import { Router, type Request, type Response } from "express";
import { prisma } from "../prisma.js";

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

// PATCH /item/:id
router.patch("/:id", async (req: Request, res: Response) => {
    // Update item name, rating, price and/or notes
});

// DELETE /item/:id
router.delete("/:id", async (req: Request, res: Response) => {
    // Remove item from restaurant list
});

export default router;