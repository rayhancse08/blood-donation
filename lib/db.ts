import { PrismaClient } from "@/generated/prisma/client";
import { createDbAdapter } from "./db-adapter";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  return new PrismaClient({ adapter: createDbAdapter(process.env.DATABASE_URL!) });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
