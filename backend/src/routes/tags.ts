import { Router, type Request, type Response } from "express";
import { prisma } from "../prisma.js";

const router = Router();

// GET /tags — every tag with its categories, for the frontend tag picker
router.get("/", async (_req: Request, res: Response) => {
    try {
        const tags = await prisma.tags.findMany({
            select: { id: true, name: true, categories: true },
            orderBy: { name: 'asc' },
        })
        res.json({ tags })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'query failed' })
    }
});

export default router;
