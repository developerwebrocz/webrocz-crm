import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });

async function nextCode() {
  const last = await prisma.lead.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
  const num = last ? parseInt(last.code.replace(/\D/g, ""), 10) + 1 : 1;
  return "LEAD-" + String(num).padStart(4, "0");
}
async function ownerId() {
  const u = await prisma.user.findFirst({ where: { role: { in: ["SALES_EXEC", "SALES_HEAD"] }, active: true }, select: { id: true } });
  return u ? u.id : null;
}
async function ensureLead(name: string, data: Record<string, unknown>) {
  let lead = await prisma.lead.findFirst({ where: { name } });
  if (!lead) {
    lead = await prisma.lead.create({ data: { code: await nextCode(), name, pipeline: "WEBROCZ", assignedToId: await ownerId(), ...data } as never });
    console.log("created", lead.code, name);
  } else {
    await prisma.lead.update({ where: { id: lead.id }, data: data as never });
    console.log("updated", lead.code, name);
  }
}

async function main() {
  // Pure WEBSITE DEVELOPMENT leads
  await ensureLead("Pixel Web Studio", { stage: "POSITIVE_LEAD", company: "Pixel Web Studio", contactPerson: "Rohit Verma", phone: "9701122334", email: "rohit@pixelweb.in", source: "Referral", services: JSON.stringify(["Custom Website", "WordPress Development"]), value: 60000 });
  await ensureLead("Aster Hospitals", { stage: "QUOTATION", company: "Aster Hospitals", contactPerson: "Dr. Kiran", phone: "9700998877", email: "web@asterhospitals.in", source: "Google", services: JSON.stringify(["Corporate Website", "Website Maintenance"]), value: 150000 });

  // Pure DIGITAL MARKETING leads
  await ensureLead("AdBoost Media", { stage: "FOLLOW_UP", company: "AdBoost Media", contactPerson: "Sana Sheikh", phone: "9885567788", email: "sana@adboost.in", source: "Meta Ad", services: JSON.stringify(["Meta Ads", "Google Ads", "SEO"]), value: 45000 });
  await ensureLead("FreshLeaf Cafe", { stage: "MEETING", company: "FreshLeaf Cafe", contactPerson: "Vikram N", phone: "9701445566", email: "vikram@freshleaf.in", source: "WhatsApp", services: JSON.stringify(["Social Media Marketing", "Content Marketing"]), value: 35000 });

  console.log("done: Website + Digital Marketing category demo leads ready");
}
main().finally(() => process.exit(0));
