import express from "express";
import type { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

const corsOptions = {
    origin: ["http://localhost:5173"]
}

const con = new Client ({
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    port: Number(process.env.POSTGRES_PORT) || 5432,
    password: String(process.env.POSTGRES_PW),
    database: process.env.POSTGRES_DB
})

con.connect().then(() => console.log("connected"))

const app: Express = express();
app.use(cors(corsOptions))
app.use(express.json());

app.post('/postData', (req, res) => {
    const {name, id} = req.body 
    const insert_query = 'INSERT INTO demotable (name,id) VALUES ($1,$2)'
    con.query(insert_query, [name,id], (err, result) => {
        if (err){
            res.send(err)
        }
        else{
            console.log(result)
            res.send("POSTED DATA")
        }
    })
})

app.get("/fetchData", (req, res) => {
    const fetch_query = "SELECT * FROM demotable"
    con.query(fetch_query, (err, result) => {
        if (err){
            res.send(err)
        }
        else{
            console.log(result.rows)
            res.send(result.rows)
        }
    })
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

