import { env } from "#config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/index.js";

const databaseUrl = env.DATABASE_URL;
const parsedDatabaseUrl = new URL(databaseUrl);
const shouldUseRelaxedSsl = parsedDatabaseUrl.hostname.includes("supabase.com");

if (shouldUseRelaxedSsl) {
  parsedDatabaseUrl.searchParams.delete("sslmode");
}

const adapter = new PrismaPg(new pg.Pool({
  connectionString: parsedDatabaseUrl.toString(),
  ...(shouldUseRelaxedSsl
    ? {
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {}),
}));

export const prisma = new PrismaClient({ adapter });
