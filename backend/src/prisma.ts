import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

// Loaded here (not just in server.ts) so DATABASE_URL is populated no matter
// which file imports this module first — ES module imports run before the
// importing file's own top-level code, so relying on server.ts's dotenv.config()
// call would leave process.env.DATABASE_URL undefined by the time this runs.
dotenv.config();

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});

export const prisma = new PrismaClient({ adapter });

// Prisma returns BigInt for the `id` columns (id BigInt @id @default(autoincrement())),
// and JSON.stringify throws on BigInt by default. This makes res.json() work everywhere.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
    return this.toString();
};