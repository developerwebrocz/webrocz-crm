"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { financialYear, stateFromGstin, companyFor } from "@/lib/domain";

// local form helpers
function s(fd: FormData, k: string) { return (fd.get(k) as string | null)?.toString().trim() ?? ""; }
function n(fd: FormData, k: string) { const v = parseInt(s(fd, k).replace(/[^\d-]/g, ""), 10); return Number.isFinite(v) ? v : 0; }
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
// Two independent financial-year serial series: GST bills vs non-GST bills.
//   GST  → "GST/2026-27/001"     Non-GST → "NG/2026-27/001"
async function invoiceNumber(gst: boolean) {
  const fy = financialYear();
  const prefix = `${gst ? "GST" : "NG"}/${fy}/`;
  const last = await prisma.salesInvoice.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { createdAt: "desc" }, select: { number: true } });
  const seq = last ? parseInt(last.number.split("/").pop() || "0", 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}
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
  const issueDate = new Date().toISOString().slice(0, 10);
  const isDM = /digital|market|dm|smo|seo|social/i.test(lead.services || "");
  const company = companyFor(gst, isDM ? "DM" : "WEBSITE");
  return prisma.salesInvoice.create({
    data: {
      number: await invoiceNumber(gst), leadId: lead.id, clientId: opts.clientId ?? lead.clientId ?? null,
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
  await prisma.lead.update({ where: { id: g.lead.id }, data: { stage: "LOST", lostReason: s(fd, "lostReason"), lostNotes: s(fd, "lostNotes"), lostDate: s(fd, "lostDate") || new Date().toISOString().slice(0, 10) } });
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
  const base = n(fd, "total"); // taxable base
  const taxPct = n(fd, "taxPct");
  const taxAmount = Math.round((base * taxPct) / 100);
  const svcLine = s(fd, "itemName") || inv.billTo;
  await prisma.salesInvoice.update({
    where: { id: invId },
    data: {
      billTo: s(fd, "billTo") || inv.billTo, contact: s(fd, "contact"), phone: s(fd, "phone"), email: s(fd, "email"),
      clientGstin: s(fd, "clientGstin"), clientState: s(fd, "clientState") || inv.clientState, clientAddress: s(fd, "clientAddress"),
      placeOfSupply: s(fd, "placeOfSupply") || inv.placeOfSupply,
      items: JSON.stringify([{ name: svcLine, qty: 1, rate: base, amount: base }]),
      subtotal: base, taxPct, taxAmount, total: base + taxAmount, received: n(fd, "received"),
      paymentStatus: s(fd, "paymentStatus") || inv.paymentStatus, notes: s(fd, "notes"), issueDate: s(fd, "issueDate") || inv.issueDate,
      dueDate: s(fd, "dueDate") || inv.dueDate || addDaysISO(s(fd, "issueDate") || inv.issueDate, 15),
    },
  });
  revalidatePath(invoiceReturn(leadId, invId));
  redirect(invoiceReturn(leadId, invId));
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
  const date = s(fd, "date") || new Date().toISOString().slice(0, 10);
  await prisma.payment.create({
    data: { invoiceId: invId, amount, date, mode, ref: s(fd, "ref"), note: s(fd, "note"), by: me.name },
  });
  // Recompute received from the ledger + any pre-ledger opening balance, capped at total.
  const agg = await prisma.payment.aggregate({ where: { invoiceId: invId }, _sum: { amount: true } });
  const ledger = agg._sum.amount ?? 0;
  // Pre-ledger `received` (e.g. "fully paid" set at onboarding) that has no Payment rows:
  const opening = Math.max(0, inv.received - (ledger - amount));
  const received = Math.min(inv.total, opening + ledger);
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
  const issueDate = s(fd, "issueDate") || new Date().toISOString().slice(0, 10);
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
      number: await invoiceNumber(gst), clientId, pipeline: "WEBROCZ", company,
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
  const desc = s(fd, "desc") || serviceLabel;
  const gst = s(fd, "gst") === "1";

  // Match an existing client by name, else create a fresh one (CLI-#### like the finance flow).
  const all = await prisma.client.findMany({ select: { id: true, name: true, gstin: true, gstRate: true, pocName: true, pocMobile: true, pocEmail: true } });
  let client = all.find((c) => c.name.trim().toLowerCase() === clientName.toLowerCase()) || null;
  if (!client) {
    const created = await prisma.client.create({ data: { code: await nextClientCode(), name: clientName, status: "ACTIVE", gstApplicable: gst, gstRate: gst ? 18 : 0 } });
    client = { id: created.id, name: created.name, gstin: created.gstin, gstRate: created.gstRate, pocName: created.pocName, pocMobile: created.pocMobile, pocEmail: created.pocEmail };
  }

  const taxPct = gst ? (client.gstRate > 0 ? client.gstRate : 18) : 0;
  const taxAmount = Math.round((base * taxPct) / 100);
  const total = base + taxAmount;
  const issueDate = s(fd, "issueDate") || new Date().toISOString().slice(0, 10);
  const dueDate = s(fd, "dueDate") || addDaysISO(issueDate, 15);
  const received = Math.min(Math.max(0, n(fd, "received")), total);
  const gstin = client.gstin || "";
  const clientState = stateFromGstin(gstin);
  const company = companyFor(gst, category);

  const inv = await prisma.salesInvoice.create({
    data: {
      number: await invoiceNumber(gst), clientId: client.id, pipeline: "WEBROCZ", company,
      billTo: client.name, contact: client.pocName ?? "", phone: client.pocMobile ?? "", email: client.pocEmail ?? "", clientGstin: gstin,
      clientState, placeOfSupply: clientState,
      items: JSON.stringify([{ name: desc, qty: 1, rate: base, amount: base }]),
      subtotal: base, taxPct, taxAmount, total, received,
      paymentStatus: received >= total ? "Fully Received" : received > 0 ? "Partially Received" : "Pending",
      issueDate, dueDate,
    },
  });
  if (received > 0) {
    await prisma.payment.create({ data: { invoiceId: inv.id, amount: received, date: issueDate, mode: "OTHER", note: "Invoice opening", by: me.name } });
  }
  revalidatePath("/invoices");
  revalidatePath(`/accounts/${client.id}`);
  // Land on the invoice page so it can be sent to the client (WhatsApp / email) right away.
  redirect(`/invoices/${inv.id}`);
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
  log.unshift({ date: new Date().toISOString().slice(0, 16).replace("T", " "), by: me.name, note });
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
  const issueDate = new Date().toISOString().slice(0, 10);
  const desc = sla.title || (category === "DM" ? "Digital Marketing" : "Website Development");
  const billTo = client.name || sla.clientName;
  const inv = await prisma.salesInvoice.create({
    data: {
      number: await invoiceNumber(gst), clientId: client.id, pipeline: "WEBROCZ", company,
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
  if (!me || !INVOICE_MANAGE.includes(me.role)) redirect("/");
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
