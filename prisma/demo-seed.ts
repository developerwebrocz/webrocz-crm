// Demo data for client walkthrough — fills the Sales pipeline (all 7 stages, both
// Website Development + Digital Marketing categories) and the Accountant dashboard
// (invoices across months with paid / partial / pending / overdue + approval mix).
// Idempotent: safe to run multiple times (matches by lead name / invoice number).
// Run:  npx tsx prisma/demo-seed.ts     ·  Undo: npx tsx prisma/clear-demo.ts
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });

const TODAY = "2026-09-25";
const DUE = "2026-09-24"; // reminders due (shows in the "due" counter / bell)

async function nextLeadCode(): Promise<string> {
  const last = await prisma.lead.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
  const num = last ? parseInt(last.code.replace(/\D/g, ""), 10) + 1 : 1;
  return "LEAD-" + String(num).padStart(4, "0");
}
async function ownerId(): Promise<string | null> {
  const u = await prisma.user.findFirst({ where: { role: { in: ["SALES_EXEC", "SALES_HEAD"] }, active: true }, select: { id: true } });
  return u ? u.id : null;
}

// Billing entity: WEB_ROCZ_PVT (GST) · WEB_SOLUTIONS (non-GST website) · WEB_ROCZ (non-GST DM)
const companyFor = (gst: boolean, category: string) => gst ? "WEB_ROCZ_PVT" : (category === "DM" ? "WEB_ROCZ" : "WEB_SOLUTIONS");

async function nextClientCode(): Promise<string> {
  const clients = await prisma.client.findMany({ select: { code: true } });
  let max = 1000;
  for (const c of clients) { const n = parseInt((c.code || "").replace(/\D/g, ""), 10); if (!Number.isNaN(n) && n > max) max = n; }
  return "CLI-" + (max + 1);
}
// A Client record so finance/company-hub views (which are client-centric) show the invoice.
async function ensureClient(name: string, opts: { pocName: string; pocMobile: string; pocEmail: string; retainer?: number; industry?: string }): Promise<string> {
  const found = await prisma.client.findFirst({ where: { name } });
  if (found) return found.id;
  const c = await prisma.client.create({ data: {
    code: await nextClientCode(), name, pocName: opts.pocName, pocMobile: opts.pocMobile, pocEmail: opts.pocEmail,
    monthlyRetainer: opts.retainer ?? 0, status: "ACTIVE", industry: opts.industry ?? "",
  } as never });
  console.log("client", c.code, name);
  return c.id;
}

type Extras = {
  followup?: { date: string; type: string; notes: string; nextDate: string };
  quotation?: { number: string; services: string; amount: number; status: string };
  reminder?: { date: string; type: string; notes: string; nextAction: string };
  meeting?: { type: string; date: string; time: string; person: string; location?: string; link?: string; notes: string };
};

async function ensureLead(name: string, data: Record<string, unknown>, extras: Extras = {}) {
  let lead = await prisma.lead.findFirst({ where: { name } });
  let created = false;
  if (!lead) {
    lead = await prisma.lead.create({ data: { code: await nextLeadCode(), name, pipeline: "WEBROCZ", assignedToId: await ownerId(), ...data } as never });
    created = true;
    console.log("created lead", lead.code, name);
  } else {
    await prisma.lead.update({ where: { id: lead.id }, data: data as never });
    console.log("updated lead", lead.code, name);
  }
  // Sub-records only on first create (keeps it idempotent — no duplicate followups etc.)
  if (created) {
    if (extras.followup) await prisma.followup.create({ data: { leadId: lead.id, ...extras.followup, status: "PENDING" } });
    if (extras.quotation) await prisma.quotation.create({ data: { leadId: lead.id, date: TODAY, ...extras.quotation } });
    if (extras.reminder) await prisma.reminder.create({ data: { leadId: lead.id, status: "PENDING", ...extras.reminder } });
    if (extras.meeting) await prisma.meeting.create({ data: { leadId: lead.id, ...extras.meeting } });
    await prisma.leadActivity.create({ data: { leadId: lead.id, actor: "System", action: "Demo data", detail: "Seeded for client walkthrough" } });
  }
}

async function ensureInvoice(number: string, billTo: string, serviceName: string, subtotal: number, received: number, opts: { contact: string; phone: string; email: string; issueDate: string; approved: boolean; category: "Website" | "DM"; gst: boolean; retainer?: number; gstin?: string }) {
  // Client record — REQUIRED so the client-centric finance / company-hub views show this invoice.
  const clientId = await ensureClient(billTo, { pocName: opts.contact, pocMobile: opts.phone, pocEmail: opts.email, retainer: opts.retainer ?? 0, industry: opts.category === "DM" ? "Digital Marketing" : "Website" });
  const taxPct = opts.gst ? 18 : 0;
  const taxAmount = Math.round(subtotal * taxPct / 100);
  const total = subtotal + taxAmount;
  const balance = total - received;
  const paymentStatus = balance <= 0 ? "Paid" : received > 0 ? "Partial" : "Pending";
  const company = companyFor(opts.gst, opts.category);
  const items = JSON.stringify([{ name: serviceName, qty: 1, rate: subtotal, amount: subtotal }]);
  const data = {
    number, billTo, clientId, company, contact: opts.contact, phone: opts.phone, email: opts.email, pipeline: "WEBROCZ",
    items, subtotal, taxPct, taxAmount, total, received, paymentStatus, issueDate: opts.issueDate,
    clientGstin: opts.gst ? (opts.gstin ?? null) : null, clientState: "36-Telangana", placeOfSupply: "36-Telangana",
    clientAddress: "Hyderabad, Telangana", approved: opts.approved,
    approvedBy: opts.approved ? "Super Admin" : null, approvedAt: opts.approved ? new Date() : null,
  };
  await prisma.salesInvoice.upsert({ where: { number }, create: data as never, update: data as never });
  console.log("invoice", number, billTo, `₹${total}`, paymentStatus, company, opts.approved ? "approved" : "pending-approval");
}

// A sample SLA uploaded by sales, awaiting the accountant to generate the invoice.
// Carries the client details (contact / phone / email / GSTIN) so the accountant's
// invoice + filters are complete even for a brand-new client. Idempotent by name+title.
async function ensureSla(clientName: string, opts: { title: string; service: string; amount: number; gst: boolean; pocName?: string; pocMobile?: string; pocEmail?: string; gstin?: string; uploadedBy?: string }) {
  const existing = await prisma.sla.findFirst({ where: { clientName, title: opts.title } });
  if (existing) { console.log("sla exists", clientName, "·", opts.title); return; }
  const client = (await prisma.client.findMany({ select: { id: true, name: true } }))
    .find((c) => c.name.trim().toLowerCase() === clientName.trim().toLowerCase());
  await prisma.sla.create({ data: {
    clientName, clientId: client?.id ?? null, title: opts.title,
    service: opts.service === "DM" ? "DM" : "WEBSITE", amount: opts.amount, gst: opts.gst,
    pocName: opts.pocName ?? "", pocMobile: opts.pocMobile ?? "", pocEmail: opts.pocEmail ?? "",
    gstin: opts.gstin ?? "", status: "UPLOADED", uploadedBy: opts.uploadedBy ?? "Sales Exec",
  } as never });
  console.log("sla", clientName, "·", opts.title, opts.gst ? "· GST" : "· non-GST");
}

async function main() {
  console.log("--- Sales pipeline demo (Website Development) ---");
  await ensureLead("Pixel Web Studio", { stage: "POSITIVE_LEAD", company: "Pixel Web Studio", contactPerson: "Rohit Verma", phone: "9701122334", email: "rohit@pixelweb.in", source: "Referral", services: JSON.stringify(["Custom Website", "WordPress Development"]), value: 60000, requirements: "5-page business website, blog, contact form" });
  await ensureLead("GreenLeaf Realty", { stage: "FOLLOW_UP", company: "GreenLeaf Realty", contactPerson: "Anita Rao", phone: "9700223344", email: "anita@greenleaf.in", source: "Google", services: JSON.stringify(["Corporate Website"]), value: 90000, nextAction: "Send portfolio + call back" },
    { followup: { date: TODAY, type: "Call", notes: "Interested, wants to see past real-estate sites", nextDate: DUE } });
  await ensureLead("Aster Hospitals", { stage: "QUOTATION", company: "Aster Hospitals", contactPerson: "Dr. Kiran", phone: "9700998877", email: "web@asterhospitals.in", source: "Google", services: JSON.stringify(["Corporate Website", "Website Maintenance"]), value: 150000 },
    { quotation: { number: "WR-QT-2026-0007", services: "Corporate Website + AMC", amount: 150000, status: "SHARED" } });
  await ensureLead("UrbanNest Interiors", { stage: "REMINDER", company: "UrbanNest Interiors", contactPerson: "Sneha Kapoor", phone: "9701556677", email: "sneha@urbannest.in", source: "Instagram", services: JSON.stringify(["E-commerce Website"]), value: 120000 },
    { reminder: { date: DUE, type: "Call", notes: "Follow up on advance payment", nextAction: "Confirm Shopify vs WooCommerce" } });
  await ensureLead("Skyline Builders", { stage: "MEETING", company: "Skyline Builders", contactPerson: "Ramesh Gupta", phone: "9700334455", email: "ramesh@skyline.in", source: "Referral", services: JSON.stringify(["Custom Web Application"]), value: 250000 },
    { meeting: { type: "OFFICE_VISIT", date: TODAY, time: "11:30", person: "Ramesh Gupta", location: "Skyline Office, Banjara Hills", notes: "Requirement discussion for property-listing portal" } });
  await ensureLead("TechnoSoft Solutions", { stage: "ONBOARDED", company: "TechnoSoft Solutions", contactPerson: "Praveen Kumar", phone: "9701778899", email: "praveen@technosoft.in", source: "Website", services: JSON.stringify(["Custom Website"]), value: 100000, paymentStatus: "Advance Received", startDate: "2026-07-08", finalAmount: 100000 });
  await ensureLead("BudgetMart Online", { stage: "LOST", company: "BudgetMart Online", contactPerson: "Imran Ali", phone: "9700445566", email: "imran@budgetmart.in", source: "Cold Call", services: JSON.stringify(["E-commerce Website"]), value: 80000, lostReason: "Budget too high", lostNotes: "Chose a freelancer", lostDate: "2026-09-10" });

  console.log("--- Sales pipeline demo (Digital Marketing) ---");
  await ensureLead("AdBoost Media", { stage: "POSITIVE_LEAD", company: "AdBoost Media", contactPerson: "Sana Sheikh", phone: "9885567788", email: "sana@adboost.in", source: "Meta Ad", services: JSON.stringify(["Meta Ads", "Google Ads"]), value: 45000, requirements: "Lead-gen campaign for real estate" });
  await ensureLead("FreshLeaf Cafe", { stage: "FOLLOW_UP", company: "FreshLeaf Cafe", contactPerson: "Vikram N", phone: "9701445566", email: "vikram@freshleaf.in", source: "WhatsApp", services: JSON.stringify(["Social Media Marketing", "Content Marketing"]), value: 35000, nextAction: "Share SMM package" },
    { followup: { date: TODAY, type: "WhatsApp", notes: "Wants Instagram + reels package", nextDate: DUE } });
  await ensureLead("FitZone Gym", { stage: "QUOTATION", company: "FitZone Gym", contactPerson: "Arjun Reddy", phone: "9885112233", email: "arjun@fitzone.in", source: "Referral", services: JSON.stringify(["SEO", "Meta Ads"]), value: 40000 },
    { quotation: { number: "WR-QT-2026-0008", services: "SEO + Meta Ads (3 months)", amount: 40000, status: "SHARED" } });
  await ensureLead("Glow Skin Clinic", { stage: "REMINDER", company: "Glow Skin Clinic", contactPerson: "Dr. Meghana", phone: "9700667788", email: "info@glowskin.in", source: "Google", services: JSON.stringify(["Google Ads", "SEO"]), value: 55000 },
    { reminder: { date: DUE, type: "Call", notes: "Reminder to close this month", nextAction: "Send final quote" } });
  await ensureLead("Royal Caterers", { stage: "MEETING", company: "Royal Caterers", contactPerson: "Suresh Babu", phone: "9701889900", email: "suresh@royalcaterers.in", source: "Meta Ad", services: JSON.stringify(["Social Media Marketing", "WhatsApp Marketing"]), value: 30000 },
    { meeting: { type: "ONLINE", date: TODAY, time: "16:00", person: "Suresh Babu", link: "https://meet.google.com/demo-webrocz", notes: "Google Meet — package walkthrough" } });
  await ensureLead("Nova Fashion", { stage: "ONBOARDED", company: "Nova Fashion", contactPerson: "Divya Sharma", phone: "9885334455", email: "divya@novafashion.in", source: "Instagram", services: JSON.stringify(["Meta Ads", "SEO", "Social Media Marketing"]), value: 50000, paymentStatus: "Advance Received", startDate: "2026-08-05", finalAmount: 50000 });
  await ensureLead("QuickBite Foods", { stage: "LOST", company: "QuickBite Foods", contactPerson: "Naveen Teja", phone: "9700990011", email: "naveen@quickbite.in", source: "Cold Call", services: JSON.stringify(["Google Ads"]), value: 25000, lostReason: "Went with competitor", lostNotes: "Price mismatch", lostDate: "2026-09-12" });

  console.log("--- Accountant dashboard demo (invoices, client-linked, all 3 companies) ---");
  // Web Rocz Pvt Ltd (WITH GST) — website, GST invoices
  await ensureInvoice("WR-INV-2026-0001", "TechnoSoft Solutions", "Custom Website", 100000, 118000, { contact: "Praveen Kumar", phone: "9701778899", email: "praveen@technosoft.in", issueDate: "2026-07-10", approved: true, category: "Website", gst: true, gstin: "36ABCDT1234E1Z5" });
  await ensureInvoice("WR-INV-2026-0005", "Aster Hospitals", "Corporate Website", 150000, 177000, { contact: "Dr. Kiran", phone: "9700998877", email: "web@asterhospitals.in", issueDate: "2026-09-18", approved: true, category: "Website", gst: true, gstin: "36AASTH5678K1Z2" });
  // Web Solutions (non-GST) — website
  await ensureInvoice("WR-INV-2026-0003", "Skyline Builders", "Custom Web Application", 250000, 100000, { contact: "Ramesh Gupta", phone: "9700334455", email: "ramesh@skyline.in", issueDate: "2026-08-20", approved: true, category: "Website", gst: false });
  // Web Rocz (non-GST) — digital marketing (monthly retainer clients)
  await ensureInvoice("WR-INV-2026-0002", "Nova Fashion", "Meta Ads", 50000, 30000, { contact: "Divya Sharma", phone: "9885334455", email: "divya@novafashion.in", issueDate: "2026-08-12", approved: true, category: "DM", gst: false, retainer: 15000 });
  await ensureInvoice("WR-INV-2026-0004", "Glow Skin Clinic", "Google Ads", 55000, 0, { contact: "Dr. Meghana", phone: "9700667788", email: "info@glowskin.in", issueDate: "2026-09-05", approved: false, category: "DM", gst: false, retainer: 18000 });
  await ensureInvoice("WR-INV-2026-0006", "FitZone Gym", "SEO", 40000, 20000, { contact: "Arjun Reddy", phone: "9885112233", email: "arjun@fitzone.in", issueDate: "2026-09-22", approved: false, category: "DM", gst: false, retainer: 12000 });

  console.log("--- SLA demo (sales upload → accountant generates the invoice) ---");
  // One per billing entity: Web Solutions (website, non-GST), Web Rocz (DM, non-GST),
  // Web Rocz Pvt Ltd (website, With GST). Brand-new names → accountant creates the client.
  await ensureSla("Sunrise Realty", { title: "Corporate website — annual", service: "WEBSITE", amount: 60000, gst: false, pocName: "Kavya Rao", pocMobile: "9701223344", pocEmail: "kavya@sunriserealty.in" });
  await ensureSla("FreshLeaf Cafe", { title: "Social media — 3 months", service: "DM", amount: 30000, gst: false, pocName: "Vikram N", pocMobile: "9701445566", pocEmail: "vikram@freshleaf.in" });
  await ensureSla("Orbit Technologies", { title: "Website + SEO retainer", service: "WEBSITE", amount: 120000, gst: true, pocName: "Anil Mehta", pocMobile: "9885778811", pocEmail: "anil@orbittech.in", gstin: "36AABCO1234F1Z9" });

  const leads = await prisma.lead.count();
  const invs = await prisma.salesInvoice.count();
  const slas = await prisma.sla.count();
  console.log(`\n✅ Demo ready — ${leads} leads in pipeline, ${invs} invoices, ${slas} SLAs. Login /staff (sales@ / accountant@, pw webrocz123).`);
}
main().finally(() => process.exit(0));
