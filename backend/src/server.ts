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
        const count = await prisma.locations.count({
            where: { google_place_id: googlePlaceId }
        });
        res.json({ exists: count > 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'query failed' });
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