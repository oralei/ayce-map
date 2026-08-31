import express from "express";
import type { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

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

// get request to check whether a location has been added to a list
app.get("/location", async (req: Request, res: Response) => {
    const googlePlaceId = req.query.google_place_id

    if (typeof googlePlaceId !== 'string' || googlePlaceId.length === 0) {
        return res.status(400).json({ error: 'google_place_id query param is required' })
    }

    try {
        const location = await prisma.locations.findUnique({
            where: { google_place_id: googlePlaceId }
        });
        res.json(location ? { exists: true, location } : { exists: false });
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
        res.status(201).json(location)
    } catch (err: any) {
        // unique constraint on google_place_id -> someone already added this place
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'location already exists' })
        }
        console.error(err)
        res.status(500).json({ error: 'failed to create location' })
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