import express from "express";
import type { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { request } from "http";

dotenv.config();

const corsOptions = {
    origin: ["http://localhost:5173"]
}

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

// Prisma returns BigInt for the `id` columns (id BigInt @id @default(autoincrement())),
// and JSON.stringify throws on BigInt by default. This makes res.json() work everywhere.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
    return this.toString();
};

const app: Express = express();
app.use(cors(corsOptions))
app.use(express.json());

// Shapes a joined `tags` row into the { id, label, category } chip shape the
// frontend's Tag component expects. item_tags carries its own optional
// `category` override (e.g. the same tag can read differently per item);
// location_tags has no such override, so it always falls back to the tag's
// own first category.
function toTagChipData(
    tag: { id: bigint; name: string; categories: string[] },
    categoryOverride?: string | null
) {
    return {
        id: tag.id,
        label: tag.name,
        category: categoryOverride ?? tag.categories[0] ?? null,
    }
}

// get request to check whether a location has been added to a list
app.get("/location", async (req: Request, res: Response) => {
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
})

// post request to add a place to the locations table
app.post("/location", async (req: Request, res: Response) => {
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
})

app.post("/item", async (req: Request, res: Response) => {
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
})

app.post("/apply-location-tag", async (req: Request, res: Response) => {
    const { location_id, tag_id } = req.body

    // JSON has no bigint type, so these arrive as a string or number.
    if (
        location_id === undefined ||
        location_id === null ||
        (typeof location_id !== 'string' && typeof location_id !== 'number')
    ) {
        return res.status(400).json({ error: 'location_id is required' })
    }
    if (
        tag_id === undefined ||
        tag_id === null ||
        (typeof tag_id !== 'string' && typeof tag_id !== 'number')
    ) {
        return res.status(400).json({ error: 'tag_id is required' })
    }

    let locationIdBigInt: bigint
    let tagIdBigInt: bigint
    try {
        locationIdBigInt = BigInt(location_id)
        tagIdBigInt = BigInt(tag_id)
    } catch {
        return res.status(400).json({ error: 'location_id and tag_id must be valid integers' })
    }

    try {
        const location_tag = await prisma.location_tags.create({
            data: {
                location_id: locationIdBigInt,
                tag_id: tagIdBigInt,
            },
        })
        res.status(201).json(location_tag)
    } catch (err: any) {
        // FK violation -> location_id or tag_id doesn't reference an existing row
        if (err.code === 'P2003') {
            return res.status(400).json({ error: 'location_id or tag_id does not reference an existing row' })
        }
        // unique constraint on the composite PK (location_id, tag_id) -> already applied
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'tag already applied to this location' })
        }
        console.error(err)
        res.status(500).json({ error: 'failed to apply tag to location' })
    }
})

app.post("/apply-item-tag", async (req: Request, res: Response) => {
    const { item_id, tag_id, category } = req.body

    // JSON has no bigint type, so these arrive as a string or number.
    if (
        item_id === undefined ||
        item_id === null ||
        (typeof item_id !== 'string' && typeof item_id !== 'number')
    ) {
        return res.status(400).json({ error: 'item_id is required' })
    }
    if (
        tag_id === undefined ||
        tag_id === null ||
        (typeof tag_id !== 'string' && typeof tag_id !== 'number')
    ) {
        return res.status(400).json({ error: 'tag_id is required' })
    }
    if (category !== undefined && category !== null && typeof category !== 'string') {
        return res.status(400).json({ error: 'category must be a string' })
    }

    let itemIdBigInt: bigint
    let tagIdBigInt: bigint
    try {
        itemIdBigInt = BigInt(item_id)
        tagIdBigInt = BigInt(tag_id)
    } catch {
        return res.status(400).json({ error: 'item_id and tag_id must be valid integers' })
    }

    try {
        const item_tag = await prisma.item_tags.create({
            data: {
                item_id: itemIdBigInt,
                tag_id: tagIdBigInt,
                category: category ?? null,
            },
        })
        res.status(201).json(item_tag)
    } catch (err: any) {
        // FK violation -> item_id or tag_id doesn't reference an existing row
        if (err.code === 'P2003') {
            return res.status(400).json({ error: 'item_id or tag_id does not reference an existing row' })
        }
        // unique constraint on the composite PK (item_id, tag_id) -> already applied
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'tag already applied to this item' })
        }
        console.error(err)
        res.status(500).json({ error: 'failed to apply tag to item' })
    }
})

// get request to fetch all items logged for a given location
app.get("/items", async (req: Request, res: Response) => {
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
})

app.get("/", (req: Request, res: Response) => {
    res.json({
        testVar: "hello!"
    })
}) 

app.get("/hi", (req: Request, res: Response) => {
    res.send("hiii!")
}) 

app.listen(8080, () => {
    console.log("Server listening on port 8080")
})