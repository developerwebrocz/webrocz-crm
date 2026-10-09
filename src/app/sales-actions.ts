"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { stateFromGstin, companyFor } from "@/lib/domain";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { todayIST } from "@/lib/india-date";

// local form helpers
function s(fd: FormData, k: string) { return (fd.get(k) as string | null)?.toString().trim() ?? ""; }
// Whole rupees: commas / "₹" are ignored and a decimal amount is rounded ("12,500.60" → 12501).
function n(fd: FormData, k: string) { const v = Math.round(parseFloat(s(fd, k).replace(/[^\d.-]/g, ""))); return Number.isFinite(v) ? v : 0; }
// Next CLI-#### client code — numeric max over CLI- codes only (see actions.ts for why).
async function nextClientCode() {
  const rows = await prisma.client.findMany({ where: { code: { startsWith: "CLI-" } }, select: { code: true } });
  const max = rows.reduce((m, c) => Math.max(m, parseInt(c.code.slice(4), 10) || 0), 999);
  return `CLI-${max + 1}`;
}
// Add N days to a "YYYY-MM-DD" string ("" stays "").
function addDaysISO(iso: string, days: number): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const SALES_MANAGE = ["SUPER_ADMIN", "SUB_ADMIN", "SALES_HEAD", "SALES_EXEC"];
const SALES_ADMIN_ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "SALES_HEAD"];

const WEB_SET = new Set(["Corporate Website", "Custom Website", "WordPress Development", "Shopify Development", "E-commerce Website", "Landing Page", "Website Maintenance", "Website Redesign", "Custom Web Application"]);
const DM_SET = new Set(["Meta Ads", "Google Ads", "LinkedIn Ads", "YouTube Ads", "SEO", "Social Media Marketing", "Email Marketing", "WhatsApp Marketing", "Influencer Marketing", "Content Marketing", "Lead Generation", "Remarketing / Retargeting", "Conversion Rate Optimization", "Marketing Analytics"]);

function jservices(fd: FormData) { return JSON.stringify(fd.getAll("services").map((v) => String(v)).filter(Boolean)); }
// Save an uploaded file to public/uploads/<subdir> and return its served URL ("" if none).
async function saveUpload(file: unknown, subdir: string): Promise<string> {
  if (!file || typeof file === "string") return "";
  const f = file as File;
  if (!f.size || !f.arrayBuffer) return "";
  const { writeFile, mkdir } = await import("node:fs/promises");
  const path = await import("node:path");
  const buf = Buffer.from(await f.arrayBuffer());
  const safe = (f.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const fname = `${Date.now()}-${safe}`;
  const dir = path.join(process.cwd(), "public", "uploads", subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fname), buf);
  return `/uploads/${subdir}/${fname}`;
}
function parseSvc(v: string): string[] { try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }
function leadPath(id: string) { return `/sales/${id}`; }

async function notify(userId: string, title: string, body: string, link: string, tone = "violet") {
  if (!userId) return;
  try { await prisma.notification.create({ data: { userId, title, body, link, tone } }); } catch { /* best-effort */ }
}
async function notifyRole(role: string, title: string, body: string, link: string, tone = "violet") {
  const users = await prisma.user.findMany({ where: { role, active: true }, select: { id: true } });
  await Promise.all(users.map((u) => notify(u.id, title, body, link, tone)));
}
// Notify specific team members by name match (e.g. Shravan, Kalyan for DM onboarding).
async function notifyByName(names: string[], title: string, body: string, link: string, tone = "violet") {
  const users = await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true } });
  const targets = users.filter((u) => names.some((n) => u.name.toLowerCase().includes(n.toLowerCase())));
  await Promise.all(targets.map((u) => notify(u.id, title, body, link, tone)));
}
async function logLead(leadId: string, actor: string, action: string, detail = "") {
  try { await prisma.leadActivity.create({ data: { leadId, actor, action, detail } }); } catch { /* best-effort */ }
}

// ---- Invoice generation (auto on onboarding, GST tax-invoice, printable + emailable) ----
// Two financial-year serial series (see lib/invoice-number): GST bills (Web Rocz Pvt Ltd,
// "2026-27/164") and non-GST bills ("NG/2026-27/025"). The year comes from the invoice date.
const invoiceNumber = (gst: boolean, issueDate?: string) => nextInvoiceNumber(gst, issueDate);
type InvoiceLead = { id: string; services: string; clientId?: string | null };
async function createInvoiceForLead(lead: InvoiceLead, opts: { billTo: string; contact: string; phone: string; email: string; total: number; paymentStatus: string; pipeline: string; clientId?: string | null; notes?: string; gst?: boolean }) {
  const existing = await prisma.salesInvoice.findFirst({ where: { leadId: lead.id } });
  if (existing) return existing;
  const brand = opts.pipeline === "DIGITALHAT" ? "Digital Hat" : "WebRocz";
  const services = parseSvc(lead.services);
  const desc = services.length ? services.join(", ") : `${brand} Services`;
  // opts.total is the agreed amount (taxable base). GST is chosen at onboarding (default With GST).
  const gst = opts.gst ?? true;
  const taxPct = gst ? 18 : 0;
  const base = opts.total;
  const taxAmount = Math.round((base * taxPct) / 100);
  const items = [{ name: desc, qty: 1, rate: base, amount: base }];
  const received = (opts.paymentStatus || "").toLowerCase().includes("fully") ? base + taxAmount : 0;
  const issueDate = todayIST();
  const isDM = /digital|market|dm|smo|seo|social/i.test(lead.services || "");
  const company = companyFor(gst, isDM ? "DM" : "WEBSITE");
  return prisma.salesInvoice.create({
    data: {
      number: await invoiceNumber(gst, issueDate), leadId: lead.id, clientId: opts.clientId ?? lead.clientId ?? null,
      pipeline: opts.pipeline, company, billTo: opts.billTo, contact: opts.contact, phone: opts.phone, email: opts.email,
      items: JSON.stringify(items), subtotal: base, taxPct, taxAmount, total: base + taxAmount, received,
      paymentStatus: opts.paymentStatus || "Pending", notes: opts.notes ?? "", issueDate,
      dueDate: addDaysISO(issueDate, 15), // Net-15 payment term by default
    },
  });
}
async function salesGuard(leadId: string) {
  const me = await getCurrentUser();
  if (!me || !SALES_MANAGE.includes(me.role)) return null;
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  // Sales team is flat — every sales member can manage any lead (no head/exec split).
  return { me, lead };
}

export async function createLead(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !SALES_MANAGE.includes(me.role)) redirect("/");
  const name = s(fd, "name");
  if (!name) redirect("/sales");
  const last = await prisma.lead.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
  const num = last ? parseInt(last.code.replace(/\D/g, ""), 10) + 1 : 1;
  const assignedToId = s(fd, "assignedToId") || me!.id;
  const lead = await prisma.lead.create({
    data: {
      code: `LEAD-${String(num).padStart(4, "0")}`, name,
      pipeline: s(fd, "pipeline") === "DIGITALHAT" ? "DIGITALHAT" : "WEBROCZ",
      company: s(fd, "company"), contactPerson: s(fd, "contactPerson"),
      phone: s(fd, "phone"), whatsapp: s(fd, "whatsapp"), email: s(fd, "email"),
      source: s(fd, "source"), services: jservices(fd), value: n(fd, "value"),
      assignedToId, notes: s(fd, "notes"), stage: "POSITIVE_LEAD",
    },
  });
  await logLead(lead.id, me!.name, "Lead created", `${lead.code} · ${name}`);
  if (assignedToId !== me!.id) await notify(assignedToId, `New lead assigned: ${name}`, `From ${me!.name}`, leadPath(lead.id), "sky");
  revalidatePath("/sales");
  redirect(leadPath(lead.id));
}

export async function updateLead(fd: FormData) {
  const g = await salesGuard(s(fd, "id"));
  if (!g) redirect("/sales");
  await prisma.lead.update({
    where: { id: g.lead.id },
    data: {
      name: s(fd, "name") || g.lead.name, company: s(fd, "company"), contactPerson: s(fd, "contactPerson"),
      phone: s(fd, "phone"), whatsapp: s(fd, "whatsapp"), email: s(fd, "email"), source: s(fd, "source"),
      value: n(fd, "value"), notes: s(fd, "notes"),
      ...(fd.getAll("services").length ? { services: jservices(fd) } : {}),
      requirements: s(fd, "requirements"), budget: n(fd, "budget"), expectedStart: s(fd, "expectedStart"),
      decisionMaker: s(fd, "decisionMaker"), timeline: s(fd, "timeline"), nextAction: s(fd, "nextAction"),
    },
  });
  await logLead(g.lead.id, g.me.name, "Lead updated");
  revalidatePath(leadPath(g.lead.id));
  redirect(leadPath(g.lead.id));
}

export async function setLeadStage(fd: FormData) {
  const g = await salesGuard(s(fd, "id"));
  if (!g) redirect("/sales");
  const stage = s(fd, "stage");
  const VALID = ["POSITIVE_LEAD", "FOLLOW_UP", "INTERESTED", "QUOTATION", "PROPOSAL", "REMINDER", "MEETING", "ONBOARDED", "LOST"];
  if (!VALID.includes(stage)) redirect(leadPath(g.lead.id));
  await prisma.lead.update({ where: { id: g.lead.id }, data: { stage } });
  await logLead(g.lead.id, g.me.name, `Stage → ${stage.replace(/_/g, " ").toLowerCase()}`);
  revalidatePath("/sales"); revalidatePath(leadPath(g.lead.id));
  redirect(s(fd, "from") === "board" ? "/sales" : leadPath(g.lead.id));
}

export async function saveFollowup(fd: FormData) {
  const g = await salesGuard(s(fd, "leadId"));
  if (!g) redirect("/sales");
  await prisma.followup.create({
    data: { leadId: g.lead.id, date: s(fd, "date"), time: s(fd, "time"), type: s(fd, "type") || "Call", notes: s(fd, "notes"), nextDate: s(fd, "nextDate"), nextTime: s(fd, "nextTime"), status: s(fd, "status") || "PENDING" },
  });
  if (g.lead.stage === "POSITIVE_LEAD") await prisma.lead.update({ where: { id: g.lead.id }, data: { stage: "FOLLOW_UP" } });
  await logLead(g.lead.id, g.me.name, "Follow-up added", `${s(fd, "type")} · ${s(fd, "date")}`);
  revalidatePath(leadPath(g.lead.id)); revalidatePath("/sales/followups");
  redirect(s(fd, "from") === "board" ? "/sales/followups" : leadPath(g.lead.id));
}

// Add a free note to a lead — every note is kept (history), shown newest-first.
export async function addLeadNote(fd: FormData) {
  const g = await salesGuard(s(fd, "leadId"));
  if (!g) redirect("/sales");
  const note = s(fd, "note");
  const remindDate = s(fd, "remindDate");
  if (note) await prisma.leadActivity.create({ data: { leadId: g.lead.id, actor: g.me.name, action: "Note", detail: note } });
  // Optional reminder: "call on <date>" → creates a pending follow-up shown in Reminders due.
  if (remindDate) {
    await prisma.followup.create({ data: { leadId: g.lead.id, date: remindDate, time: s(fd, "remindTime"), type: s(fd, "remindType") || "Call", notes: note || "Follow-up reminder", status: "PENDING" } });
    await logLead(g.lead.id, g.me.name, "Reminder set", `${s(fd, "remindType") || "Call"} · ${remindDate}`);
  }
  revalidatePath(leadPath(g.lead.id)); revalidatePath("/sales"); revalidatePath("/sales/followups");
  redirect(s(fd, "from") === "list" ? "/sales" : leadPath(g.lead.id));
}

export async function setFollowupStatus(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !SALES_MANAGE.includes(me.role)) return;
  const id = s(fd, "id"); const status = s(fd, "status");
  if (id && status) await prisma.followup.update({ where: { id }, data: { status } });
  revalidatePath("/sales/followups");
  const back = s(fd, "leadId"); if (back) revalidatePath(leadPath(back));
}

export async function saveQuotation(fd: FormData) {
  const g = await salesGuard(s(fd, "leadId"));
  if (!g) redirect("/sales");
  const amount = n(fd, "amount"); const tax = n(fd, "tax");
  const uploaded = await saveUpload(fd.get("file"), "quotations");
  await prisma.quotation.create({
    data: { leadId: g.lead.id, number: s(fd, "number") || `Q-${Date.now().toString().slice(-6)}`, services: s(fd, "services"), amount, tax, finalAmount: n(fd, "finalAmount") || amount + tax, date: s(fd, "date"), validUntil: s(fd, "validUntil"), fileUrl: uploaded || s(fd, "fileUrl"), status: s(fd, "status") || "NOT_SHARED" },
  });
  if (["POSITIVE_LEAD", "FOLLOW_UP", "INTERESTED"].includes(g.lead.stage)) await prisma.lead.update({ where: { id: g.lead.id }, data: { stage: "QUOTATION" } });
  await logLead(g.lead.id, g.me.name, "Quotation created", `INR ${amount + tax}`);
  revalidatePath(leadPath(g.lead.id));
  redirect(leadPath(g.lead.id));
}

// Edit an existing quotation (amount, status, dates, re-upload file).
export async function updateQuotation(fd: FormData) {
  const g = await salesGuard(s(fd, "leadId"));
  if (!g) redirect("/sales");
  const qid = s(fd, "quotationId");
  const q = await prisma.quotation.findUnique({ where: { id: qid } });
  if (!q || q.leadId !== g.lead.id) redirect(leadPath(g.lead.id));
  const amount = n(fd, "amount"); const tax = n(fd, "tax");
  const uploaded = await saveUpload(fd.get("file"), "quotations");
  await prisma.quotation.update({
    where: { id: qid },
    data: {
      number: s(fd, "number") || q.number, services: s(fd, "services"), amount, tax,
      finalAmount: n(fd, "finalAmount") || amount + tax, date: s(fd, "date"), validUntil: s(fd, "validUntil"),
      fileUrl: uploaded || s(fd, "fileUrl") || q.fileUrl, status: s(fd, "status") || q.status,
    },
  });
  await logLead(g.lead.id, g.me.name, "Quotation updated", q.number);
  revalidatePath(leadPath(g.lead.id));
  redirect(leadPath(g.lead.id));
}

export async function saveProposal(fd: FormData) {
  const g = await salesGuard(s(fd, "leadId"));
  if (!g) redirect("/sales");
  const uploadedP = await saveUpload(fd.get("file"), "proposals");
  await prisma.proposal.create({
    data: { leadId: g.lead.id, number: s(fd, "number") || `P-${Date.now().toString().slice(-6)}`, fileUrl: uploadedP || s(fd, "fileUrl"), sharedDate: s(fd, "sharedDate"), amount: n(fd, "amount"), expectedDate: s(fd, "expectedDate"), notes: s(fd, "notes"), status: s(fd, "status") || "SHARED" },
  });
  if (["POSITIVE_LEAD", "FOLLOW_UP", "INTERESTED", "QUOTATION"].includes(g.lead.stage)) await prisma.lead.update({ where: { id: g.lead.id }, data: { stage: "PROPOSAL" } });
  await logLead(g.lead.id, g.me.name, "Proposal shared");
  revalidatePath(leadPath(g.lead.id));
  redirect(leadPath(g.lead.id));
}

export async function saveReminder(fd: FormData) {
  const g = await salesGuard(s(fd, "leadId"));
  if (!g) redirect("/sales");
  await prisma.reminder.create({
    data: { leadId: g.lead.id, date: s(fd, "date"), time: s(fd, "time"), type: s(fd, "type") || "Call", notes: s(fd, "notes"), nextAction: s(fd, "nextAction"), status: s(fd, "status") || "PENDING" },
  });
  if (["POSITIVE_LEAD", "FOLLOW_UP", "QUOTATION"].includes(g.lead.stage)) await prisma.lead.update({ where: { id: g.lead.id }, data: { stage: "REMINDER" } });
  await logLead(g.lead.id, g.me.name, "Reminder set", s(fd, "date"));
  revalidatePath(leadPath(g.lead.id));
  redirect(leadPath(g.lead.id));
}

export async function saveMeeting(fd: FormData) {
  const g = await salesGuard(s(fd, "leadId"));
  if (!g) redirect("/sales");
  await prisma.meeting.create({
    data: { leadId: g.lead.id, type: s(fd, "type") || "ONLINE", date: s(fd, "date"), time: s(fd, "time"), person: s(fd, "person"), link: s(fd, "link"), location: s(fd, "location"), notes: s(fd, "notes"), outcome: s(fd, "outcome"), nextAction: s(fd, "nextAction") },
  });
  if (!["ONBOARDED", "LOST"].includes(g.lead.stage)) await prisma.lead.update({ where: { id: g.lead.id }, data: { stage: "MEETING" } });
  await logLead(g.lead.id, g.me.name, "Meeting scheduled", `${s(fd, "type")} · ${s(fd, "date")}`);
  revalidatePath(leadPath(g.lead.id));
  redirect(leadPath(g.lead.id));
}

export async function markLost(fd: FormData) {
  const g = await salesGuard(s(fd, "id"));
  if (!g) redirect("/sales");
  await prisma.lead.update({ where: { id: g.lead.id }, data: { stage: "LOST", lostReason: s(fd, "lostReason"), lostNotes: s(fd, "lostNotes"), lostDate: s(fd, "lostDate") || todayIST() } });
  await logLead(g.lead.id, g.me.name, "Marked Lost", s(fd, "lostReason"));
  revalidatePath("/sales"); revalidatePath(leadPath(g.lead.id));
  redirect(leadPath(g.lead.id));
}

// Onboarding → ONE Client + internal assignment(s) + notifications to Heads + Super Admin.
export async function onboardLead(fd: FormData) {
  const g = await salesGuard(s(fd, "id"));
  if (!g) redirect("/sales");
  const lead = g.lead;
  // GST chosen at onboarding: "0" = Without GST, anything else = With GST (default).
  const gst = s(fd, "gst") !== "0";

  // Digital Hat = course enrolment → no website/DM agency project, just mark onboarded.
  if (lead.pipeline === "DIGITALHAT") {
    await prisma.lead.update({ where: { id: lead.id }, data: { stage: "ONBOARDED", paymentStatus: s(fd, "paymentStatus"), startDate: s(fd, "startDate"), finalAmount: n(fd, "finalAmount"), requirements: s(fd, "requirements") || lead.requirements } });
    await logLead(lead.id, g.me.name, "Enrolled — Digital Hat", `INR ${n(fd, "finalAmount")}`);
    await createInvoiceForLead(lead, { billTo: s(fd, "company") || lead.company || lead.name, contact: s(fd, "contactPerson") || lead.contactPerson || "", phone: s(fd, "phone") || lead.phone || "", email: s(fd, "email") || lead.email || "", total: n(fd, "finalAmount"), paymentStatus: s(fd, "paymentStatus"), pipeline: "DIGITALHAT", gst });
    await logLead(lead.id, "System", "Invoice generated");
    await notifyRole("SALES_HEAD", `New Digital Hat enrolment: ${s(fd, "company") || lead.name}`, "Course enrolled", leadPath(lead.id), "emerald");
    revalidatePath("/sales"); revalidatePath(leadPath(lead.id));
    redirect(leadPath(lead.id));
  }

  const services = parseSvc(lead.services);
  const hasWeb = services.some((x) => WEB_SET.has(x));
  const hasDm = services.some((x) => DM_SET.has(x));
  const finalAmount = n(fd, "finalAmount");
  const company = s(fd, "company") || lead.company || lead.name;

  let clientId = lead.clientId;
  if (!clientId) {
    const client = await prisma.client.create({
      data: {
        code: await nextClientCode(), name: company, monthlyRetainer: hasDm ? finalAmount : 0,
        pocName: s(fd, "contactPerson") || lead.contactPerson || null, pocMobile: s(fd, "phone") || lead.phone || null, pocEmail: s(fd, "email") || lead.email || null,
        status: "ACTIVE", notes: `Onboarded from ${lead.code}. ${s(fd, "notes")}`.trim(),
        gstApplicable: gst, gstRate: 18, // GST preference set at onboarding
      },
    });
    clientId = client.id;
    const svcRows = [...(hasWeb ? [{ clientId, service: "WEBSITE_DEV" }] : []), ...(hasDm ? [{ clientId, service: "SEO" }] : [])];
    if (svcRows.length) await prisma.clientService.createMany({ data: svcRows });
  }

  await prisma.lead.update({ where: { id: lead.id }, data: { stage: "ONBOARDED", clientId, paymentStatus: s(fd, "paymentStatus"), startDate: s(fd, "startDate"), finalAmount, requirements: s(fd, "requirements") || lead.requirements } });
  await logLead(lead.id, g.me.name, "Client onboarded", `INR ${finalAmount}`);
  await createInvoiceForLead(lead, { billTo: company, contact: s(fd, "contactPerson") || lead.contactPerson || "", phone: s(fd, "phone") || lead.phone || "", email: s(fd, "email") || lead.email || "", total: finalAmount, paymentStatus: s(fd, "paymentStatus"), pipeline: "WEBROCZ", clientId, gst });
  await logLead(lead.id, "System", "Invoice generated");

  if (hasWeb) {
    const webSvc = services.find((x) => WEB_SET.has(x)) ?? "Website";
    const dev = s(fd, "assignDev"); // sales picks the developer at onboarding (optional)
    await prisma.devProject.create({
      data: { name: `${company} — ${webSvc}`, clientId, assignedToId: dev || null, projectType: "WEBSITE", status: dev ? "ASSIGNED" : "UNASSIGNED", priority: "HIGH", notes: `From sales ${lead.code}. Services: ${services.filter((x) => WEB_SET.has(x)).join(", ")}` },
    });
    if (dev) await notify(dev, `New website project: ${company}`, "Assigned to you by Sales — start the project", "/projects", "violet");
    await notifyRole("DEV_HEAD", `New website project: ${company}`, dev ? "Assigned by sales" : "Unassigned — assign a developer", "/projects", "amber");
    await notifyRole("SUPER_ADMIN", `New website project (sales): ${company}`, dev ? "Assigned" : "Unassigned", "/projects", "sky");
    await logLead(lead.id, "System", dev ? "Website project assigned to developer" : "Website project created (Unassigned)");
  }
  if (hasDm) {
    const dm = s(fd, "assignDm"); // sales picks the marketing person at onboarding (optional)
    if (dm && clientId) await prisma.client.update({ where: { id: clientId }, data: { accountManagerId: dm } });
    if (dm) await notify(dm, `New marketing client: ${company}`, "Assigned to you by Sales — set it up", `/clients/${clientId}`, "violet");
    await notifyRole("DM_HEAD", `New marketing client: ${company}`, dm ? "Assigned by sales" : "Unassigned — assign a DM Executive", "/dm", "amber");
    await notifyRole("SUPER_ADMIN", `New marketing client (sales): ${company}`, dm ? "Assigned" : "Unassigned", `/clients/${clientId}`, "sky");
    await logLead(lead.id, "System", "Digital Marketing project created (Unassigned)");
  }

  revalidatePath("/sales"); revalidatePath(leadPath(lead.id)); revalidatePath("/clients"); revalidatePath("/projects");
  redirect(leadPath(lead.id));
}

export async function deleteLead(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !SALES_MANAGE.includes(me.role)) return;
  const id = s(fd, "id");
  if (id) { try { await prisma.lead.delete({ where: { id } }); } catch { /* already gone */ } }
  revalidatePath("/sales");
  redirect("/sales");
}

// Any sales member can reassign a lead to another executive (flat team).
export async function reassignLead(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !SALES_MANAGE.includes(me.role)) redirect("/sales");
  const id = s(fd, "id"); const to = s(fd, "assignedToId");
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead || !to) redirect("/sales");
  await prisma.lead.update({ where: { id }, data: { assignedToId: to } });
  const u = await prisma.user.findUnique({ where: { id: to }, select: { name: true } });
  await logLead(id, me.name, `Reassigned to ${u?.name ?? "executive"}`);
  await notify(to, `Lead assigned to you: ${lead.name}`, `By ${me.name}`, leadPath(id), "sky");
  revalidatePath("/sales"); revalidatePath(leadPath(id));
  redirect(leadPath(id));
}

// Digital Marketing Head / admin assigns an onboarded marketing client to a DM Executive.
export async function assignDmExec(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !["SUPER_ADMIN", "SUB_ADMIN", "DM_HEAD"].includes(me.role)) redirect("/");
  const clientId = s(fd, "clientId"); const execId = s(fd, "execId");
  if (!clientId || !execId) redirect("/dm");
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
  await prisma.client.update({ where: { id: clientId }, data: { accountManagerId: execId } });
  const ex = await prisma.user.findUnique({ where: { id: execId }, select: { name: true } });
  await notify(execId, `New marketing client assigned: ${client?.name ?? ""}`, `Assigned by ${me.name}`, `/clients/${clientId}`, "violet");
  await notifyRole("DM_HEAD", `Marketing client assigned: ${client?.name ?? ""}`, `To ${ex?.name ?? "executive"}`, "/dm", "emerald");
  await notifyRole("SUPER_ADMIN", `Marketing client assigned: ${client?.name ?? ""}`, `To ${ex?.name ?? "executive"}`, "/dm", "sky");
  revalidatePath("/dm"); revalidatePath(`/clients/${clientId}`);
  redirect("/dm");
}

// (Re)generate an invoice for a lead on demand — used if onboarding happened before invoices existed.
export async function generateInvoice(fd: FormData) {
  const g = await salesGuard(s(fd, "id"));
  if (!g) redirect("/sales");
  const lead = g.lead;
  // Honour the onboarded client's GST setting (falls back to With GST when unknown).
  let gst = true;
  if (lead.clientId) {
    const c = await prisma.client.findUnique({ where: { id: lead.clientId }, select: { gstApplicable: true } });
    if (c) gst = c.gstApplicable;
  }
  await createInvoiceForLead(lead, {
    billTo: lead.company || lead.name, contact: lead.contactPerson || "", phone: lead.phone || "", email: lead.email || "",
    total: lead.finalAmount || lead.value || 0, paymentStatus: lead.paymentStatus || "Pending", pipeline: lead.pipeline, clientId: lead.clientId, gst,
  });
  await logLead(lead.id, g.me.name, "Invoice generated (manual)");
  revalidatePath(`/sales/${lead.id}/invoice`); revalidatePath(leadPath(lead.id));
  redirect(`/sales/${lead.id}/invoice`);
}

const INVOICE_MANAGE = ["SUPER_ADMIN", "SUB_ADMIN", "SALES_HEAD", "SALES_EXEC", "ACCOUNTANT"];
function invoiceReturn(leadId: string, invId: string) { return leadId ? `/sales/${leadId}/invoice` : `/invoices/${invId}`; }

// Edit invoice fields (bill-to, GST, amount, received, client tax details).
export async function saveInvoice(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !INVOICE_MANAGE.includes(me.role)) redirect("/sales");
  const invId = s(fd, "invoiceId"); const leadId = s(fd, "leadId");
  const inv = await prisma.salesInvoice.findUnique({ where: { id: invId } });
  if (!inv) redirect(invoiceReturn(leadId, invId));
  const taxPct = Math.max(0, n(fd, "taxPct"));
  // The edit form sends the invoice TOTAL exactly as it must read on the invoice ("grandTotal",
  // GST included). The taxable amount and the GST are worked back from it, so the saved total is
  // exactly what was typed — never a rupee more or less from rounding, and GST is never added on
  // top a second time. (Other callers still send the taxable amount as "total".)
  const typedTotal = fd.has("grandTotal") ? Math.max(0, n(fd, "grandTotal")) : null;
  const base = typedTotal !== null ? Math.round((typedTotal * 100) / (100 + taxPct)) : n(fd, "total"); // taxable base
  const taxAmount = typedTotal !== null ? typedTotal - base : Math.round((base * taxPct) / 100);
  // Received can never be more than the invoice total; the status follows from the two amounts.
  const newReceived = Math.min(Math.max(0, n(fd, "received")), base + taxAmount);
  const autoStatus = base + taxAmount > 0 && newReceived >= base + taxAmount ? "Fully Received" : newReceived > 0 ? "Partially Received" : "Pending";
  // Invoice date changed → the due date moves by the same number of days (it used to stay
  // behind, so a re-dated invoice showed overdue before it was even issued).
  const newIssue = s(fd, "issueDate") || inv.issueDate;
  const shiftedDue = (() => {
    if (!inv.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(inv.issueDate) || !/^\d{4}-\d{2}-\d{2}$/.test(newIssue)) return inv.dueDate || addDaysISO(newIssue, 15);
    const gap = Math.round((Date.parse(inv.dueDate + "T00:00:00Z") - Date.parse(inv.issueDate + "T00:00:00Z")) / 86400000);
    return addDaysISO(newIssue, Number.isFinite(gap) && gap >= 0 ? gap : 15);
  })();
  // GSTIN changed → state and place of supply follow it (CGST+SGST inside Telangana, IGST outside).
  const newGstin = s(fd, "clientGstin").toUpperCase();
  const gstinState = newGstin && newGstin !== (inv.clientGstin || "").toUpperCase() ? stateFromGstin(newGstin) : "";
  const svcLine = s(fd, "itemName") || inv.billTo;
  // An itemized invoice (several service lines) keeps its lines when the description was not
  // edited — so fixing e.g. the phone or "received" does not collapse Domain + Hosting +
  // Designing into a single line. If only the amount changed, the new amount is spread over
  // the priced lines in the same proportion ("Included" lines stay as they are).
  let prevItems: { name?: string; qty?: number; rate?: number; amount?: number }[] = [];
  try { const a = JSON.parse(inv.items || "[]"); if (Array.isArray(a)) prevItems = a; } catch { /* ignore */ }
  const sameDesc = prevItems.length > 1 && svcLine === String(prevItems[0]?.name ?? "");
  let itemsJson = JSON.stringify([{ name: svcLine, qty: 1, rate: base, amount: base }]);
  if (sameDesc && base === inv.subtotal) itemsJson = inv.items;
  else if (sameDesc && inv.subtotal > 0) {
    const lastPriced = prevItems.map((it) => (it.amount ?? 0) > 0).lastIndexOf(true);
    let left = base;
    itemsJson = JSON.stringify(prevItems.map((it, i) => {
      if (!((it.amount ?? 0) > 0)) return it;
      const amt = i === lastPriced ? left : Math.round(((it.amount ?? 0) * base) / inv.subtotal);
      left -= amt;
      return { ...it, qty: 1, rate: amt, amount: amt };
    }));
  }
  // Web Rocz Pvt Ltd edit form only (other forms do not send these): a corrected invoice
  // number — refused if another invoice already has it — plus project date and payment type.
  const newNumber = s(fd, "number");
  const numberClash = !!newNumber && newNumber !== inv.number && !!(await prisma.salesInvoice.findUnique({ where: { number: newNumber }, select: { id: true } }));
  const pvtExtra = {
    ...(newNumber && newNumber !== inv.number && !numberClash ? { number: newNumber } : {}),
    ...(fd.has("projectDate") ? { projectDate: /^\d{4}-\d{2}-\d{2}$/.test(s(fd, "projectDate")) ? s(fd, "projectDate") : "" } : {}),
    ...(fd.has("paymentTerm") ? { paymentTerm: ["PREPAID", "POSTPAID"].includes(s(fd, "paymentTerm")) ? s(fd, "paymentTerm") : "" } : {}),
  };
  await prisma.salesInvoice.update({
    where: { id: invId },
    data: {
      ...pvtExtra,
      billTo: s(fd, "billTo") || inv.billTo, contact: s(fd, "contact"), phone: s(fd, "phone"), email: s(fd, "email"),
      clientGstin: newGstin, clientState: gstinState || s(fd, "clientState") || inv.clientState, clientAddress: s(fd, "clientAddress"),
      placeOfSupply: gstinState || s(fd, "placeOfSupply") || inv.placeOfSupply,
      items: itemsJson,
      subtotal: base, taxPct, taxAmount, total: base + taxAmount, received: newReceived,
      paymentStatus: typedTotal !== null ? autoStatus : (s(fd, "paymentStatus") || inv.paymentStatus), notes: s(fd, "notes"), issueDate: s(fd, "issueDate") || inv.issueDate,
      dueDate: s(fd, "dueDate") || shiftedDue,
    },
  });
  // "Received" changed on the edit form → the difference is also entered in the payment ledger
  // (today, by whoever edited): a raise as a payment, a reduction as a minus correction. So the
  // received amount on the invoice and its payment entries always agree.
  const receivedDiff = newReceived - inv.received;
  if (receivedDiff !== 0) {
    await prisma.payment.create({ data: { invoiceId: invId, amount: receivedDiff, date: todayIST(), mode: "OTHER", note: receivedDiff > 0 ? "Received amount updated on the invoice" : "Received amount corrected (reduced) on the invoice", by: me.name } });
  }
  revalidatePath(invoiceReturn(leadId, invId));
  redirect(numberClash ? `${invoiceReturn(leadId, invId)}?sent=dupno` : invoiceReturn(leadId, invId));
}

const PAY_MODES = ["UPI", "BANK", "CHEQUE", "CASH", "CARD", "OTHER"];
// Record a payment against an invoice — appends to the Payment ledger and keeps
// the invoice's `received` running total + paymentStatus in sync. Used by the
// accountant dashboard (modal) and the invoice detail page.
export async function recordPayment(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !INVOICE_MANAGE.includes(me.role)) redirect("/");
  const invId = s(fd, "invoiceId");
  const back = s(fd, "return") || "/";
  const inv = await prisma.salesInvoice.findUnique({ where: { id: invId } });
  if (!inv) redirect(back);
  // Never let the ledger exceed the invoice total — cap at the outstanding balance.
  const amount = Math.min(n(fd, "amount"), inv.total - inv.received);
  if (amount <= 0) redirect(back);
  const mode = PAY_MODES.includes(s(fd, "mode")) ? s(fd, "mode") : "BANK";
  const date = s(fd, "date") || todayIST();
  await prisma.payment.create({
    data: { invoiceId: invId, amount, date, mode, ref: s(fd, "ref"), note: s(fd, "note"), by: me.name },
  });
  // The invoice's received amount goes up by exactly this payment (capped at the total).
  // (It used to be rebuilt from the payment entries, which made it jump if "Received" had been
  // corrected on the invoice in between.)
  const received = Math.min(inv.total, inv.received + amount);
  const paymentStatus = received >= inv.total ? "Fully Received" : received > 0 ? "Partially Received" : "Pending";
  await prisma.salesInvoice.update({ where: { id: invId }, data: { received, paymentStatus } });
  await notifyRole("SUPER_ADMIN", `Payment recorded: ${inv.number}`, `${me.name} · ₹${amount.toLocaleString("en-IN")} (${mode})`, invoiceReturn(inv.leadId ?? "", invId), "emerald");
  revalidatePath("/");
  revalidatePath(invoiceReturn(inv.leadId ?? "", invId));
  redirect(back);
}

// Raise a new single-service invoice for a client (Website OR Digital Marketing) —
// so a client who takes both gets separate, cleanly-categorised invoices.
export async function createClientInvoice(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !INVOICE_MANAGE.includes(me.role)) redirect("/");
  const clientId = s(fd, "clientId");
  const back = `/accounts/${clientId}`;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  const base = n(fd, "amount");
  if (!client || base <= 0) redirect(back);

  const category = s(fd, "category") === "DM" ? "DM" : "WEBSITE";
  const serviceLabel = category === "DM" ? "Digital Marketing" : "Website Development";
  const desc = s(fd, "desc") || serviceLabel;
  const taxPct = Math.max(0, n(fd, "taxPct"));
  const taxAmount = Math.round((base * taxPct) / 100);
  const total = base + taxAmount;
  const issueDate = s(fd, "issueDate") || todayIST();
  const dueDate = s(fd, "dueDate") || addDaysISO(issueDate, 15);
  const received = Math.min(Math.max(0, n(fd, "received")), total);
  const gstin = s(fd, "gstin") || client.gstin;
  // remember an updated GSTIN on the client for next time
  if (gstin && gstin !== client.gstin) { try { await prisma.client.update({ where: { id: clientId }, data: { gstin } }); } catch { /* ignore */ } }
  // Place of supply from the GSTIN's state code, so the tax splits CGST/SGST vs IGST correctly.
  const clientState = stateFromGstin(gstin);
  // Billing entity + serial series follow the GST flag & service.
  const gst = taxPct > 0;
  const company = companyFor(gst, category);

  const inv = await prisma.salesInvoice.create({
    data: {
      number: await invoiceNumber(gst, issueDate), clientId, pipeline: "WEBROCZ", company,
      billTo: client.name, contact: client.pocName ?? "", phone: client.pocMobile ?? "", email: client.pocEmail ?? "", clientGstin: gstin,
      clientState, placeOfSupply: clientState,
      items: JSON.stringify([{ name: desc, qty: 1, rate: base, amount: base }]),
      subtotal: base, taxPct, taxAmount, total, received,
      paymentStatus: received >= total ? "Fully Received" : received > 0 ? "Partially Received" : "Pending",
      issueDate, dueDate,
    },
  });
  if (received > 0) {
    await prisma.payment.create({ data: { invoiceId: inv.id, amount: received, date: issueDate, mode: PAY_MODES.includes(s(fd, "mode")) ? s(fd, "mode") : "OTHER", note: "Invoice opening", by: me.name } });
  }
  revalidatePath("/");
  revalidatePath(back);
  redirect(back);
}

// Add a brand-new invoice straight from the Invoices page. The client is typed by name:
// an existing client (case-insensitive match) is reused, otherwise a new one is created.
// GST flag + service category drive the billing entity and serial series (companyFor).
export async function addInvoice(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !INVOICE_MANAGE.includes(me.role)) redirect("/");
  const back = s(fd, "return") || "/invoices";
  const clientName = s(fd, "clientName");
  const base = n(fd, "amount");
  if (!clientName || base <= 0) redirect(back);

  const category = s(fd, "category") === "DM" ? "DM" : "WEBSITE";
  const serviceLabel = category === "DM" ? "Digital Marketing" : "Website Development";
  // Web Solutions invoices tick services (Domain / Hosting+SSL / Website Designing / custom) —
  // they become the invoice line; the Description is kept as a note.
  const services = fd.getAll("services").map((v) => String(v).trim()).filter(Boolean);
  const description = s(fd, "desc");
  const desc = services.length ? services.join(", ") : (description || serviceLabel);
  const gst = s(fd, "gst") === "1";
  // Web Solutions submits per-service line items (name + amount as JSON); else a single line.
  let invoiceItems: { name: string; qty: number; rate: number; amount: number }[] = [];
  try {
    const parsed = JSON.parse(s(fd, "items") || "[]");
    if (Array.isArray(parsed)) invoiceItems = parsed.filter((it) => it && it.name).map((it) => ({ name: String(it.name), qty: Number(it.qty) || 1, rate: Number(it.rate) || 0, amount: Number(it.amount) || 0 }));
  } catch { /* ignore */ }
  // Uploaded payment screenshot (proof), if any.
  const proofUrl = await saveUpload(fd.get("paymentProof"), "payments");
  // Uploaded signed/printed invoice document, if any.
  const invoiceDocUrl = await saveUpload(fd.get("invoiceDoc"), "invoices");

  // Match an existing client by name, else create a fresh one (CLI-#### like the finance flow).
  const all = await prisma.client.findMany({ select: { id: true, name: true, gstin: true, gstRate: true, pocName: true, pocMobile: true, pocEmail: true } });
  let client = all.find((c) => c.name.trim().toLowerCase() === clientName.toLowerCase()) || null;
  const formGstin = gst ? s(fd, "gstin") : "";
  if (!client) {
    const created = await prisma.client.create({ data: { code: await nextClientCode(), name: clientName, status: "ACTIVE", gstApplicable: gst, gstRate: gst ? 18 : 0, gstin: formGstin } });
    client = { id: created.id, name: created.name, gstin: created.gstin, gstRate: created.gstRate, pocName: created.pocName, pocMobile: created.pocMobile, pocEmail: created.pocEmail };
  } else if (formGstin && !client.gstin) {
    // Backfill the client's GSTIN from this invoice if it wasn't on record yet.
    await prisma.client.update({ where: { id: client.id }, data: { gstin: formGstin, gstApplicable: true } });
    client.gstin = formGstin;
  }

  // Website details captured on the invoice (Web Solutions) → saved onto the client so they
  // feed the Website Renewals tracking (domain + renewal amount).
  const domain = s(fd, "domain");
  const renewalAmount = Math.max(0, n(fd, "renewalAmount"));
  const renewalDate = s(fd, "renewalDate");
  if (domain || renewalAmount > 0 || renewalDate) {
    await prisma.client.update({ where: { id: client.id }, data: { ...(domain ? { websiteDomain: domain } : {}), ...(renewalAmount > 0 ? { websiteRenewAmount: renewalAmount } : {}), ...(renewalDate ? { websiteExpiryDate: renewalDate } : {}) } });
  }

  const taxPct = gst ? (client.gstRate > 0 ? client.gstRate : 18) : 0;
  const taxAmount = Math.round((base * taxPct) / 100);
  const total = base + taxAmount;
  const issueDate = s(fd, "issueDate") || todayIST();
  const dueDate = s(fd, "dueDate") || addDaysISO(issueDate, 15);
  const received = Math.min(Math.max(0, n(fd, "received")), total);
  const gstin = formGstin || client.gstin || "";
  const clientState = stateFromGstin(gstin);
  const company = companyFor(gst, category);

  const inv = await prisma.salesInvoice.create({
    data: {
      number: await invoiceNumber(gst, issueDate), clientId: client.id, pipeline: "WEBROCZ", company,
      billTo: client.name, contact: client.pocName ?? "", phone: client.pocMobile ?? "", email: client.pocEmail ?? "", clientGstin: gstin,
      clientState, placeOfSupply: clientState,
      items: JSON.stringify(invoiceItems.length ? invoiceItems : [{ name: desc, qty: 1, rate: base, amount: base }]),
      subtotal: base, taxPct, taxAmount, total, received, paymentProof: proofUrl, invoiceDoc: invoiceDocUrl,
      paymentStatus: received >= total ? "Fully Received" : received > 0 ? "Partially Received" : "Pending",
      issueDate, dueDate,
      ...(services.length && description ? { notes: description } : {}),
    },
  });
  if (received > 0) {
    await prisma.payment.create({ data: { invoiceId: inv.id, amount: received, date: issueDate, mode: "OTHER", note: proofUrl ? "Invoice opening · payment screenshot attached" : "Invoice opening", ref: proofUrl, by: me.name } });
  }
  revalidatePath("/invoices");
  revalidatePath(`/accounts/${client.id}`);
  // Land on the invoice page so it can be sent to the client (WhatsApp / email) right away.
  redirect(`/invoices/${inv.id}`);
}

// ---- Bulk import from a CSV (exported from Google Sheets) --------------------------------
// One invoice per row. Company + GST are fixed by the hub it's run from (Web Solutions / Web
// Rocz = non-GST, Web Rocz Pvt Ltd = GST). Columns (case-insensitive, extras ignored):
//   Client Name, Description, Amount, Received, Invoice Date, GSTIN, Phone, Email
function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const splitLine = (line: string): string[] => {
    const out: string[] = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur); return out.map((v) => v.trim());
  };
  const header = splitLine(lines[0]).map((h) => h.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const cells = splitLine(line); const row: Record<string, string> = {};
    header.forEach((h, i) => { row[h] = cells[i] ?? ""; }); return row;
  });
}
function normDate(d: string): string {
  const t = (d || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const valid = (y: string, mo: string, d: string) => { const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`; const dt = new Date(iso + "T00:00:00Z"); return !isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === iso ? iso : ""; };
  const m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/); // DD-MM-YYYY, DD/MM/YYYY, DD-MM-YY
  if (m) { const iso = valid(m[3].length === 2 ? `20${m[3]}` : m[3], m[2], m[1]); if (iso) return iso; }
  const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const w = t.match(/^(\d{1,2})[-\s/]([A-Za-z]{3})[A-Za-z]*[-\s/,]+(\d{4}|\d{2})$/); // 15 Jan 2025, 15-Jan-25
  if (w && MON.includes(w[2].toLowerCase())) { const iso = valid(w[3].length === 2 ? `20${w[3]}` : w[3], String(MON.indexOf(w[2].toLowerCase()) + 1), w[1]); if (iso) return iso; }
  return todayIST();
}

export async function importFinanceCsv(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !INVOICE_MANAGE.includes(me.role)) redirect("/");
  const back = s(fd, "return") || "/accounts";
  const VALID = ["WEB_SOLUTIONS", "WEB_ROCZ", "WEB_ROCZ_PVT"];
  const comp = VALID.includes(s(fd, "company")) ? s(fd, "company") : "WEB_SOLUTIONS";
  const file = fd.get("file");
  if (!file || typeof file === "string" || !(file as File).size) redirect(`${back}?import=nofile`);
  const rows = parseCsvRows(await (file as File).text());
  const gst = comp === "WEB_ROCZ_PVT";
  const category = comp === "WEB_ROCZ" ? "DM" : "WEBSITE";
  const num = (v: string) => Math.round(Number((v || "").replace(/[^\d.]/g, "")) || 0);
  const get = (row: Record<string, string>, ...keys: string[]) => { for (const k of keys) if (row[k]) return row[k]; return ""; };
  const clients = await prisma.client.findMany({ select: { id: true, name: true } });
  const nameToId = new Map(clients.map((c) => [c.name.trim().toLowerCase(), c.id]));
  let created = 0;
  for (const row of rows) {
    const name = get(row, "client name", "client", "company name", "company", "name");
    const amount = num(get(row, "amount", "amount (before gst)", "value", "total"));
    if (!name || amount <= 0) continue;
    const received = num(get(row, "received", "amount received", "paid"));
    const desc = get(row, "description", "service", "details") || (category === "DM" ? "Digital Marketing" : "Website Development");
    const gstin = get(row, "gstin", "gst no", "gst number");
    const issueDate = normDate(get(row, "invoice date", "date", "issue date"));
    let clientId = nameToId.get(name.trim().toLowerCase());
    if (!clientId) {
      const c = await prisma.client.create({ data: { code: await nextClientCode(), name, status: "ACTIVE", gstApplicable: gst, gstRate: gst ? 18 : 0, gstin, pocMobile: get(row, "phone", "mobile") || null, pocEmail: get(row, "email") || null } });
      clientId = c.id; nameToId.set(name.trim().toLowerCase(), c.id);
    }
    const taxPct = gst ? 18 : 0;
    const taxAmount = Math.round((amount * taxPct) / 100);
    const total = amount + taxAmount;
    const rec = Math.min(Math.max(0, received), total);
    const clientState = stateFromGstin(gstin);
    const inv = await prisma.salesInvoice.create({
      data: {
        number: await invoiceNumber(gst, issueDate), clientId, pipeline: "WEBROCZ", company: comp,
        billTo: name, clientGstin: gstin, clientState, placeOfSupply: clientState,
        items: JSON.stringify([{ name: desc, qty: 1, rate: amount, amount }]),
        subtotal: amount, taxPct, taxAmount, total, received: rec,
        paymentStatus: rec >= total ? "Fully Received" : rec > 0 ? "Partially Received" : "Pending",
        issueDate, dueDate: addDaysISO(issueDate, 15),
      },
    });
    if (rec > 0) await prisma.payment.create({ data: { invoiceId: inv.id, amount: rec, date: issueDate, mode: "OTHER", note: "Imported from CSV", by: me.name } });
    created++;
  }
  revalidatePath("/invoices"); revalidatePath("/accounts"); revalidatePath(back);
  redirect(`${back}?imported=${created}`);
}

// Super Admin approves an invoice → unlocks download / send for sales + accountant.
export async function approveInvoice(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !["SUPER_ADMIN", "SUB_ADMIN"].includes(me.role)) redirect("/sales");
  const invId = s(fd, "invoiceId"); const leadId = s(fd, "leadId");
  const on = s(fd, "approve") !== "0";
  const inv = await prisma.salesInvoice.findUnique({ where: { id: invId } });
  if (!inv) redirect(invoiceReturn(leadId, invId));
  await prisma.salesInvoice.update({ where: { id: invId }, data: { approved: on, approvedBy: on ? me.name : null, approvedAt: on ? new Date() : null } });
  if (inv.leadId) await logLead(inv.leadId, me.name, on ? "Invoice approved" : "Invoice approval revoked", inv.number);
  revalidatePath(invoiceReturn(leadId, invId));
  redirect(invoiceReturn(leadId, invId));
}

// Accountant / admin adds a payment follow-up note (visible to Super Admin).
export async function addInvoiceNote(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !INVOICE_MANAGE.includes(me.role)) redirect("/sales");
  const invId = s(fd, "invoiceId"); const leadId = s(fd, "leadId");
  const note = s(fd, "note");
  const inv = await prisma.salesInvoice.findUnique({ where: { id: invId } });
  if (!inv || !note) redirect(invoiceReturn(leadId, invId));
  let log: { date: string; by: string; note: string }[] = [];
  try { const a = JSON.parse(inv.notesLog || "[]"); if (Array.isArray(a)) log = a; } catch { /* ignore */ }
  // date + time in India ("2026-10-09 15:42"); toISOString() is UTC, 5h30 behind
  const nowIST = new Date();
  log.unshift({ date: `${todayIST(nowIST)} ${nowIST.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false })}`, by: me.name, note });
  await prisma.salesInvoice.update({ where: { id: invId }, data: { notesLog: JSON.stringify(log.slice(0, 100)), nextFollowup: s(fd, "nextFollowup") || inv.nextFollowup } });
  await notifyRole("SUPER_ADMIN", `Invoice note: ${inv.number}`, `${me.name}: ${note.slice(0, 80)}`, invoiceReturn(leadId, invId), "amber");
  revalidatePath(invoiceReturn(leadId, invId));
  redirect(invoiceReturn(leadId, invId));
}

// Email the invoice to the client (link to the printable page + summary).
export async function emailInvoice(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !INVOICE_MANAGE.includes(me.role)) redirect("/sales");
  const invId = s(fd, "invoiceId"); const leadId = s(fd, "leadId");
  const to = s(fd, "to");
  const inv = await prisma.salesInvoice.findUnique({ where: { id: invId } });
  if (!inv || !to) redirect(invoiceReturn(leadId, invId));
  // Approval gate — cannot send to client until a Super Admin has approved.
  // The accountant CRM has no approval gate, so accountants can send without it.
  if (!inv.approved && me.role !== "ACCOUNTANT") redirect(`${invoiceReturn(leadId, invId)}?sent=locked`);
  const { sendEmail, APP_URL } = await import("@/lib/email");
  const brand = inv.pipeline === "DIGITALHAT" ? "Digital Hat" : "WebRocz";
  const link = `${APP_URL}${invoiceReturn(leadId, invId)}`;
  const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;background:#f5f5fb;padding:32px 0;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #ece9ff;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#840a92,#6d28d9,#590ebc);padding:22px 28px;">
        <div style="color:#fff;font-size:18px;font-weight:800;">${brand} — Invoice ${inv.number}</div>
      </div>
      <div style="padding:28px;">
        <p style="font-size:15px;color:#111827;margin:0 0 10px;">Dear ${inv.contact || inv.billTo},</p>
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 18px;">Thank you for choosing ${brand}. Please find your invoice below.</p>
        <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;margin:0 0 18px;">
          <tr><td style="padding:6px 0;">Invoice No.</td><td style="padding:6px 0;text-align:right;font-weight:700;">${inv.number}</td></tr>
          <tr><td style="padding:6px 0;">Date</td><td style="padding:6px 0;text-align:right;">${inv.issueDate}</td></tr>
          <tr><td style="padding:6px 0;border-top:1px solid #eee;">Total Amount</td><td style="padding:6px 0;text-align:right;font-weight:800;border-top:1px solid #eee;">${inr(inv.total)}</td></tr>
          <tr><td style="padding:6px 0;">Payment Status</td><td style="padding:6px 0;text-align:right;">${inv.paymentStatus}</td></tr>
        </table>
        <a href="${link}" style="display:inline-block;background:#6d28d9;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;">View / Download invoice →</a>
        <p style="font-size:11.5px;color:#9ca3af;margin:22px 0 0;border-top:1px solid #f3f0ff;padding-top:14px;">WebRocz Digital Marketing Agency · Hyderabad · This is a system-generated invoice.</p>
      </div>
    </div>
  </div>`;
  const ok = await sendEmail(to, `${brand} Invoice ${inv.number}`, html);
  if (ok) {
    await prisma.salesInvoice.update({ where: { id: inv.id }, data: { emailedAt: new Date(), email: to } });
    if (inv.leadId) await logLead(inv.leadId, me.name, "Invoice emailed to client", to);
  }
  revalidatePath(invoiceReturn(leadId, invId));
  redirect(`${invoiceReturn(leadId, invId)}?sent=${ok ? "1" : "0"}`);
}

// ---- SLA (service agreement) flow: sales uploads → accountant generates the invoice ----

// Sales uploads an SLA for a client, marking it With/Without GST + service + amount.
export async function uploadSla(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !SALES_MANAGE.includes(me.role)) redirect("/");
  const clientName = s(fd, "clientName");
  if (!clientName) redirect("/sla?err=client");
  // Link to an existing client if the typed name matches one (case-insensitive).
  const key = clientName.trim().toLowerCase();
  const match = (await prisma.client.findMany({ select: { id: true, name: true } })).find((c) => c.name.trim().toLowerCase() === key);
  const fileUrl = await saveUpload(fd.get("file"), "slas");
  const sla = await prisma.sla.create({
    data: {
      clientName,
      clientId: match?.id ?? null,
      title: s(fd, "title"),
      service: s(fd, "service") === "DM" ? "DM" : "WEBSITE",
      amount: Math.max(0, n(fd, "amount")),
      gst: s(fd, "gst") === "1", // "1" = With GST, "0" = Without GST
      // Client details so the accountant's data/filters are complete on generation.
      pocName: s(fd, "pocName"),
      pocMobile: s(fd, "pocMobile"),
      pocEmail: s(fd, "pocEmail"),
      gstin: s(fd, "gstin"),
      fileUrl,
      notes: s(fd, "notes"),
      uploadedBy: me.name,
    },
  });
  await notifyRole("ACCOUNTANT", `New SLA: ${clientName}`, `${me.name} uploaded an SLA · ${sla.gst ? "With GST" : "Without GST"} · ₹${sla.amount.toLocaleString("en-IN")}`, "/sla", "violet");
  revalidatePath("/sla");
  redirect("/sla?uploaded=1");
}

// Accountant generates the invoice from an uploaded SLA (per its service + amount + GST).
export async function generateInvoiceFromSla(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !INVOICE_MANAGE.includes(me.role)) redirect("/");
  const slaId = s(fd, "slaId");
  const back = s(fd, "return") || "/sla";
  const sla = await prisma.sla.findUnique({ where: { id: slaId }, include: { client: true } });
  if (!sla || sla.status === "INVOICED" || sla.amount <= 0) redirect(back);
  // "Move to" — the accountant may explicitly route the SLA to a billing entity.
  // Otherwise the company is derived from the SLA's GST + service (legacy behaviour).
  const VALID_CO = ["WEB_SOLUTIONS", "WEB_ROCZ", "WEB_ROCZ_PVT"];
  const overrideCompany = s(fd, "company");
  const company = VALID_CO.includes(overrideCompany) ? overrideCompany : companyFor(sla.gst, sla.service === "DM" ? "DM" : "WEBSITE");
  // Web Rocz Pvt Ltd carries GST; Web Solutions & Web Rocz are non-GST. Category follows
  // the single-service entities, and keeps the SLA's own service for the Pvt Ltd (does both).
  const gst = company === "WEB_ROCZ_PVT";
  const category = company === "WEB_ROCZ" ? "DM" : company === "WEB_SOLUTIONS" ? "WEBSITE" : (sla.service === "DM" ? "DM" : "WEBSITE");

  // Resolve the client. If the typed name never matched an existing client, create one now
  // from the SLA's captured details so the accountant's client list & filters (account
  // manager, phone, email, GST) are complete — not just an orphan invoice with a billTo.
  let client = sla.client;
  if (!client) {
    // The client may have been added after the SLA was uploaded: link to it instead of
    // creating a second client with the same name.
    const wanted = sla.clientName.trim().toLowerCase();
    const sameName = wanted ? (await prisma.client.findMany()).find((c) => c.name.trim().toLowerCase() === wanted) : undefined;
    if (sameName) { client = sameName; await prisma.sla.update({ where: { id: sla.id }, data: { clientId: sameName.id } }); }
  }
  if (!client) {
    client = await prisma.client.create({
      data: {
        code: await nextClientCode(), name: sla.clientName, status: "ACTIVE",
        pocName: sla.pocName || null, pocMobile: sla.pocMobile || null, pocEmail: sla.pocEmail || null,
        gstin: sla.gstin || "", gstApplicable: gst, gstRate: gst ? 18 : 0,
      },
    });
    const svc = category === "DM" ? "Digital Marketing" : "Website Development";
    await prisma.clientService.create({ data: { clientId: client.id, service: svc } });
    await prisma.sla.update({ where: { id: sla.id }, data: { clientId: client.id } });
  }

  const base = sla.amount;
  const taxPct = gst ? (client.gstRate || 18) : 0;
  const taxAmount = Math.round((base * taxPct) / 100);
  // Prefer the SLA's captured GSTIN, falling back to the client's on record.
  const gstin = sla.gstin || client.gstin || "";
  const clientState = stateFromGstin(gstin);
  const issueDate = todayIST();
  const desc = sla.title || (category === "DM" ? "Digital Marketing" : "Website Development");
  const billTo = client.name || sla.clientName;
  const inv = await prisma.salesInvoice.create({
    data: {
      number: await invoiceNumber(gst, issueDate), clientId: client.id, pipeline: "WEBROCZ", company,
      billTo, contact: client.pocName || sla.pocName || "", phone: client.pocMobile || sla.pocMobile || "", email: client.pocEmail || sla.pocEmail || "", clientGstin: gstin,
      clientState, placeOfSupply: clientState,
      items: JSON.stringify([{ name: desc, qty: 1, rate: base, amount: base }]),
      subtotal: base, taxPct, taxAmount, total: base + taxAmount, received: 0,
      paymentStatus: "Pending", issueDate, dueDate: addDaysISO(issueDate, 15),
      notes: sla.title ? `From SLA: ${sla.title}` : "From SLA",
    },
  });
  await prisma.sla.update({ where: { id: slaId }, data: { status: "INVOICED", invoiceId: inv.id } });
  revalidatePath("/sla");
  revalidatePath("/invoices");
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${client.id}`);
  redirect(back);
}

// Delete a sales invoice (accountant/admin). Payments cascade with it.
export async function deleteSalesInvoice(fd: FormData) {
  const me = await getCurrentUser();
  // Delete is Super Admin only — accountants manage invoices but cannot delete them.
  if (!me || !["SUPER_ADMIN", "SUB_ADMIN"].includes(me.role)) redirect("/");
  const id = s(fd, "invoiceId");
  const back = s(fd, "return") || "/invoices";
  if (id) {
    // If this invoice was generated from an SLA, flip that SLA back to "to invoice".
    try { await prisma.sla.updateMany({ where: { invoiceId: id }, data: { status: "UPLOADED", invoiceId: null } }); } catch { /* ignore */ }
    try { await prisma.salesInvoice.delete({ where: { id } }); } catch { /* already gone */ }
  }
  revalidatePath("/invoices");
  revalidatePath("/sla");
  redirect(back);
}

// Remove an SLA (sales or accountant/admin).
export async function deleteSla(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || (!SALES_MANAGE.includes(me.role) && !INVOICE_MANAGE.includes(me.role))) redirect("/");
  const id = s(fd, "slaId");
  const back = s(fd, "return") || "/sla";
  if (id) { try { await prisma.sla.delete({ where: { id } }); } catch { /* already gone */ } }
  revalidatePath("/sla");
  redirect(back);
}
