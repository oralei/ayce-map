import express from "express";
import type { Express, Request, Response } from "express";
import cors from "cors";

const app: Express = express();

const corsOptions = {
    origin: ["http://localhost:5173"]
}

app.use(cors(corsOptions))

app.get("/", (req: Request, res: Response) => {
    res.json({
        testVar: "hello"
    })
}) 

app.listen(8080, () => {
    console.log("Server listening on port 8080")
})