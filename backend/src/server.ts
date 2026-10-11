import express from "express";
import type { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from 'dotenv';
import locationRoutes from "./routes/locations.js";
import itemRoutes from "./routes/items.js";
import tagRoutes from "./routes/tags.js";

dotenv.config();

const corsOptions = {
    origin: ["http://localhost:5173"]
}

const app: Express = express();
app.use(cors(corsOptions))
app.use(express.json());

app.use("/location", locationRoutes);
app.use("/item", itemRoutes);
app.use("/tags", tagRoutes);

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
