import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `prisma generate` runs on install and does not need a database, so a missing URL must not fail it.
    url: process.env.DATABASE_URL ?? "",
  },
});
