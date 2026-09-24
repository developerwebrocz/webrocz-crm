import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 config: connection for CLI (migrate / db push) lives here.
// The runtime driver adapter is set on PrismaClient in src/lib/prisma.ts.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: { path: path.join("prisma", "migrations") },
  datasource: { url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" },
});
