import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { scryptSync, randomBytes } from "node:crypto";
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });
function hash(pw: string) { const s = randomBytes(16).toString("hex"); return `${s}:${scryptSync(pw, s, 64).toString("hex")}`; }
async function up(name: string, email: string, role: string) {
  const ex = await prisma.user.findFirst({ where: { email } });
  const ph = hash("webrocz123");
  if (ex) await prisma.user.update({ where: { id: ex.id }, data: { name, role, passwordHash: ph, active: true } });
  else await prisma.user.create({ data: { name, email, role, passwordHash: ph, active: true } });
  console.log(role.padEnd(12), "->", email);
}
async function main() {
  await up("Sales Executive", "sales@webrocz.com", "SALES_EXEC");
  await up("Sales Head", "saleshead@webrocz.com", "SALES_HEAD");
  await up("Accountant", "accountant@webrocz.com", "ACCOUNTANT");
  await up("Website Head", "webhead@webrocz.com", "DEV_HEAD");
  await up("Keerthana Dev", "dev@webrocz.com", "WEB_DEV");
  await up("Marketing Head", "dmhead@webrocz.com", "DM_HEAD");
  await up("DM Executive", "dm@webrocz.com", "DM_EXEC");
  console.log("all dummy logins ready · password: webrocz123 · portal: /staff");
}
main().finally(() => process.exit(0));
