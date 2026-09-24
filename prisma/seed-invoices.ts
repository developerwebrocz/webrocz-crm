// One-off: seed a handful of SalesInvoices so the accountant dashboard has data
// to exercise overdue / aging / payments. Run: npx tsx prisma/seed-invoices.ts
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/index.js";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const gst = (base: number) => Math.round(base * 0.18);

async function main() {
  const clients = await prisma.client.findMany({ take: 8, select: { id: true, name: true } });
  if (clients.length === 0) { console.log("No clients — run seed.ts first."); return; }

  await prisma.salesInvoice.deleteMany({ where: { number: { startsWith: "DEMO-" } } });

  // [base amount, service (drives category), issue days ago, due days ago(+future=neg), received]
  const specs: [number, string, number, number, number][] = [
    [100000, "Corporate Website", 40, 25, 0],       // overdue 25d (1–30), Website
    [50000, "SEO", 10, -5, 59000],                   // paid in full, DM, not due
    [200000, "Custom Website", 30, 5, 100000],       // partly paid, overdue 5d, Website
    [40000, "Google Ads", 8, -7, 0],                 // not due yet, DM
    [90000, "Social Media Marketing", 80, 70, 0],    // overdue 70d (61–90), DM
    [30000, "WordPress Development", 130, 118, 0],    // overdue 118d (90+), Website
    [75000, "Meta Ads", 50, 40, 30000],             // overdue 40d (31–60), partly paid, DM
  ];

  let seq = 1;
  for (let i = 0; i < specs.length; i++) {
    const [base, service, issAgo, dueAgo, received] = specs[i];
    const c = clients[i % clients.length];
    const tax = gst(base);
    const total = base + tax;
    await prisma.salesInvoice.create({
      data: {
        number: `DEMO-${String(seq++).padStart(4, "0")}`,
        clientId: c.id, billTo: c.name, contact: "Accounts", phone: "9000000000", email: "billing@example.com",
        pipeline: "WEBROCZ",
        items: JSON.stringify([{ name: service, qty: 1, rate: base, amount: base }]),
        subtotal: base, taxPct: 18, taxAmount: tax, total,
        received: Math.min(received, total),
        paymentStatus: received >= total ? "Fully Received" : received > 0 ? "Partially Received" : "Pending",
        issueDate: daysAgo(issAgo), dueDate: daysAgo(dueAgo),
        approved: i % 3 !== 0, // leave some unapproved
      },
    });
  }
  console.log(`Seeded ${specs.length} demo invoices.`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
