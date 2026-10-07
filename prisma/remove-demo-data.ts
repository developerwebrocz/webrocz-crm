// Removes the DEMO data that prisma/demo-seed.ts created — and nothing else.
// Every record is matched on the seed's own identifiers (exact name + its seeded phone / email,
// exact invoice number, exact task / shoot title), so real clients, invoices and leads stay.
// Team logins (User rows) are never touched.
//
//   Preview (changes nothing):   npx tsx prisma/remove-demo-data.ts
//   Delete (backs up first):     npx tsx prisma/remove-demo-data.ts --yes
//
// The delete first writes a full copy of the database next to it (…backup-before-demo-removal…).
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { readFileSync } from "node:fs";

(function loadEnv() {
  for (const p of [".env", "prisma/../.env"]) {
    try {
      for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (!m) continue;
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
        if (process.env[m[1]] === undefined) process.env[m[1]] = val;
      }
      break;
    } catch { /* try next path */ }
  }
})();
const DB_URL = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: DB_URL }) });
const YES = process.argv.includes("--yes");

// ---- what the demo seed created (copied from prisma/demo-seed.ts) ----
const DEMO_CLIENTS: { name: string; phone: string; email: string }[] = [
  { name: "TechnoSoft Solutions", phone: "9701778899", email: "praveen@technosoft.in" },
  { name: "Aster Hospitals", phone: "9700998877", email: "web@asterhospitals.in" },
  { name: "Skyline Builders", phone: "9700334455", email: "ramesh@skyline.in" },
  { name: "Nova Fashion", phone: "9885334455", email: "divya@novafashion.in" },
  { name: "Glow Skin Clinic", phone: "9700667788", email: "info@glowskin.in" },
  { name: "FitZone Gym", phone: "9885112233", email: "arjun@fitzone.in" },
];
const DEMO_INVOICE_NUMBERS = ["WR-INV-2026-0001", "WR-INV-2026-0002", "WR-INV-2026-0003", "WR-INV-2026-0004", "WR-INV-2026-0005", "WR-INV-2026-0006"];
const DEMO_LEADS: { name: string; phone: string; email: string }[] = [
  { name: "Pixel Web Studio", phone: "9701122334", email: "rohit@pixelweb.in" },
  { name: "GreenLeaf Realty", phone: "9700223344", email: "anita@greenleaf.in" },
  { name: "Aster Hospitals", phone: "9700998877", email: "web@asterhospitals.in" },
  { name: "UrbanNest Interiors", phone: "9701556677", email: "sneha@urbannest.in" },
  { name: "Skyline Builders", phone: "9700334455", email: "ramesh@skyline.in" },
  { name: "TechnoSoft Solutions", phone: "9701778899", email: "praveen@technosoft.in" },
  { name: "BudgetMart Online", phone: "9700445566", email: "imran@budgetmart.in" },
  { name: "AdBoost Media", phone: "9885567788", email: "sana@adboost.in" },
  { name: "FreshLeaf Cafe", phone: "9701445566", email: "vikram@freshleaf.in" },
  { name: "FitZone Gym", phone: "9885112233", email: "arjun@fitzone.in" },
  { name: "Glow Skin Clinic", phone: "9700667788", email: "info@glowskin.in" },
  { name: "Royal Caterers", phone: "9701889900", email: "suresh@royalcaterers.in" },
  { name: "Nova Fashion", phone: "9885334455", email: "divya@novafashion.in" },
  { name: "QuickBite Foods", phone: "9700990011", email: "naveen@quickbite.in" },
];
const DEMO_SLAS: { clientName: string; title: string }[] = [
  { clientName: "Sunrise Realty", title: "Corporate website — annual" },
  { clientName: "FreshLeaf Cafe", title: "Social media — 3 months" },
  { clientName: "Orbit Technologies", title: "Website + SEO retainer" },
  { clientName: "Nova Fashion", title: "Digital marketing retainer" },
  { clientName: "Glow Skin Clinic", title: "Google Ads + SEO — 6 months" },
  { clientName: "TechnoSoft Solutions", title: "Custom website build" },
  { clientName: "Aster Hospitals", title: "Corporate website + AMC" },
  { clientName: "Skyline Builders", title: "Custom web application — build" },
];
const DEMO_TASK_TITLES = [
  "Festival Offer Poster", "Instagram Carousel — 5 Tips", "Google Display Banner Set", "Brand Logo Refresh", "Product Launch Teaser", "Services Brochure",
  "Diwali Greeting Post", "Grand Opening Hoarding", "LinkedIn Company Banner", "Pricing Table Creative", "Testimonial Graphic", "Web Hero Banner",
  "New Launch Reel 15 sec", "Client Testimonial 45 sec", "Offer Ad Video 20 sec", "YouTube Explainer 2 min", "Instagram Reel — Before/After", "Brand Intro Video 30 sec",
  "Process Walkthrough Reel", "Product Testimonial 60 sec", "Festive Ad Video 15 sec", "YouTube Review 5 min", "Showroom Intro 30 sec", "Highlights Reel 30 sec",
];
const DEMO_SHOOT_TITLES = [
  "Product shoot — new launch", "Clinic testimonial shoot", "Reel shoot — festive offer", "Corporate profile shoot",
  "Studio rental — podcast recording", "Showroom walkthrough shoot", "Studio rental — fashion lookbook",
];
const DEMO_NOTIFICATIONS: { title: string; body: string }[] = [
  { title: "New SLA uploaded", body: "Sunrise Realty · Corporate website — annual (₹60,000) — ready to move to a company" },
  { title: "New SLA uploaded", body: "Orbit Technologies · Website + SEO retainer (₹1,20,000) · GST" },
  { title: "Payment received", body: "Nova Fashion paid ₹30,000 against Meta Ads invoice" },
  { title: "Invoice pending approval", body: "Glow Skin Clinic · WR-INV-2026-0004 (₹64,900) awaiting approval" },
  { title: "Payment overdue", body: "Glow Skin Clinic · ₹64,900 overdue — follow up" },
];

const same = (a: string | null | undefined, b: string) => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();
const inr = (v: number) => "Rs " + (v || 0).toLocaleString("en-IN");

async function main() {
  console.log(YES ? "=== REMOVING demo data ===" : "=== PREVIEW — nothing is changed (add --yes to delete) ===");

  // -- demo clients: exact name AND the seeded phone or email --
  const allClients = await prisma.client.findMany({ select: { id: true, code: true, name: true, pocMobile: true, pocEmail: true, salesInvoices: { select: { number: true, total: true, company: true } } } });
  const demoClients = allClients.filter((c) => DEMO_CLIENTS.some((d) => same(c.name, d.name) && (same(c.pocEmail, d.email) || same(c.pocMobile, d.phone))));
  const lookalikes = allClients.filter((c) => !demoClients.includes(c) && DEMO_CLIENTS.some((d) => same(c.name, d.name)));
  console.log(`\nDemo clients to remove: ${demoClients.length}`);
  for (const c of demoClients) console.log(`  ${c.code}  ${c.name}  — with ${c.salesInvoices.length} invoice(s): ${c.salesInvoices.map((i) => `${i.number} ${inr(i.total)}`).join(", ") || "none"}`);
  if (lookalikes.length) console.log("  NOT removed (same name as a demo client but different phone / email — looks real):", lookalikes.map((c) => `${c.code} ${c.name}`).join(", "));
  const demoClientIds = demoClients.map((c) => c.id);

  // -- demo invoices by their fixed numbers (in case the client record was changed) --
  const demoInvoices = (await prisma.salesInvoice.findMany({ where: { number: { in: DEMO_INVOICE_NUMBERS } }, select: { id: true, number: true, billTo: true, total: true, clientId: true } })).filter((i) => !i.clientId || !demoClientIds.includes(i.clientId));
  console.log(`\nDemo invoices not under those clients: ${demoInvoices.length}`);
  for (const i of demoInvoices) console.log(`  ${i.number}  ${i.billTo}  ${inr(i.total)}`);

  // -- demo leads: exact name AND the seeded phone or email --
  const allLeads = await prisma.lead.findMany({ select: { id: true, code: true, name: true, phone: true, email: true } });
  const demoLeads = allLeads.filter((l) => DEMO_LEADS.some((d) => same(l.name, d.name) && (same(l.email, d.email) || same(l.phone, d.phone))));
  console.log(`\nDemo sales leads to remove: ${demoLeads.length}`);
  if (demoLeads.length) console.log("  " + demoLeads.map((l) => `${l.code} ${l.name}`).join(", "));

  // -- demo SLAs (exact client name + title), plus any SLA of a demo client --
  const allSlas = await prisma.sla.findMany({ select: { id: true, clientName: true, title: true, clientId: true } });
  const demoSlas = allSlas.filter((x) => (x.clientId && demoClientIds.includes(x.clientId)) || DEMO_SLAS.some((d) => same(x.clientName, d.clientName) && same(x.title, d.title)));
  console.log(`\nDemo SLAs to remove: ${demoSlas.length}`);
  if (demoSlas.length) console.log("  " + demoSlas.map((x) => `${x.clientName} · ${x.title}`).join("; "));

  // -- demo design / video tasks (seeded titles on the seeded DSG-/VID- codes) --
  const demoTasks = (await prisma.creativeTask.findMany({ where: { title: { in: DEMO_TASK_TITLES } }, select: { id: true, code: true, title: true } })).filter((t) => /^(DSG|VID)-\d{3}$/.test(t.code));
  console.log(`\nDemo design / video tasks to remove: ${demoTasks.length}`);

  // -- demo shoots (seeded titles) --
  const demoShoots = await prisma.shoot.findMany({ where: { title: { in: DEMO_SHOOT_TITLES } }, select: { id: true, code: true, title: true } });
  console.log(`Demo shoots to remove: ${demoShoots.length}`);

  // -- demo bell notifications --
  const demoNotes = await prisma.notification.findMany({ where: { OR: [...DEMO_NOTIFICATIONS.map((n) => ({ title: n.title, body: n.body })), ...DEMO_TASK_TITLES.flatMap((t) => [{ title: `New design assigned: ${t}` }, { title: `New video assigned: ${t}` }])] }, select: { id: true } });
  console.log(`Demo notifications to remove: ${demoNotes.length}`);

  if (YES) {
    // Full, consistent copy of the database before anything is deleted.
    const file = DB_URL.replace(/^file:/, "");
    const backup = `${file}.backup-before-demo-removal-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    await prisma.$executeRawUnsafe(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
    console.log(`\nBackup written: ${backup}`);

    await prisma.notification.deleteMany({ where: { id: { in: demoNotes.map((n) => n.id) } } });
    await prisma.shoot.deleteMany({ where: { id: { in: demoShoots.map((s) => s.id) } } });
    await prisma.creativeTask.deleteMany({ where: { id: { in: demoTasks.map((t) => t.id) } } });
    await prisma.sla.deleteMany({ where: { id: { in: demoSlas.map((s) => s.id) } } });
    await prisma.lead.deleteMany({ where: { id: { in: demoLeads.map((l) => l.id) } } });            // follow-ups, quotations, reminders, meetings go with the lead
    await prisma.salesInvoice.deleteMany({ where: { id: { in: demoInvoices.map((i) => i.id) } } }); // payments go with the invoice
    await prisma.client.deleteMany({ where: { id: { in: demoClientIds } } });                        // their invoices, services and SLAs go with the client
    console.log("Demo data removed.");
  }

  // -- what is left, so anything else that looks like test data can be spotted --
  const left = await prisma.client.findMany({ orderBy: { code: "asc" }, select: { code: true, name: true, salesInvoices: { select: { total: true, company: true } } } });
  const shown = YES ? left : left.filter((c) => !demoClients.some((d) => d.code === c.code));
  console.log(`\nClients ${YES ? "now in the CRM" : "that will REMAIN"}: ${shown.length}`);
  for (const c of shown) {
    const by = new Map<string, number>();
    for (const i of c.salesInvoices) by.set(i.company || "-", (by.get(i.company || "-") ?? 0) + i.total);
    console.log(`  ${c.code}  ${c.name}  ${[...by].map(([k, v]) => `${k} ${inr(v)}`).join(" | ") || "(no invoices)"}`);
  }
  console.log(YES ? "\nDEMO_REMOVED" : "\nPREVIEW_DONE — nothing was changed.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
