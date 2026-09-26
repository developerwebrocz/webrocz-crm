"use server";

import { prisma } from "@/lib/prisma";
import { SERVICES, SERVICE_KEYS, type ServiceKey, financialYear, companyFor, stateFromGstin } from "@/lib/domain";
import { hashPassword, verifyPassword, getCurrentUser, getRealUser } from "@/lib/auth";
import { sendEmail, inviteEmailHtml } from "@/lib/email";
import { SESSION_COOKIE, IMPERSONATE_COOKIE, signSession, signImpersonation } from "@/lib/session";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function s(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}
function n(fd: FormData, k: string) {
  const v = parseInt(s(fd, k), 10);
  return Number.isFinite(v) ? v : 0;
}
// Next CLI-#### client code. Scans only CLI- codes and takes the NUMERIC max, so it is not
// thrown off by other-prefix codes in the same table (e.g. SEO-###) — a lexicographic
// "order by code desc" would pick "SEO-…" over "CLI-…" and mint a colliding code.
async function nextClientCode() {
  const rows = await prisma.client.findMany({ where: { code: { startsWith: "CLI-" } }, select: { code: true } });
  const max = rows.reduce((m, c) => Math.max(m, parseInt(c.code.slice(4), 10) || 0), 999);
  return `CLI-${max + 1}`;
}
// Full-access admin: Super Admin or Sub Admin. Used for edit/delete of core records.
async function isAdmin() {
  const u = await getCurrentUser();
  return u?.role === "SUPER_ADMIN" || u?.role === "SUB_ADMIN";
}

// ---- Google Ads daily entry: replace one client+date's campaigns from the form ----
export async function saveGoogleAdsDay(fd: FormData) {
  const u = await getCurrentUser();
  if (!u) redirect("/login");

  const clientId = s(fd, "clientId");
  const date = s(fd, "date");
  const period = s(fd, "period") || "YESTERDAY";
  if (!clientId || !date) redirect(`/google-ads?period=${period}`);

  // Only the client's account manager (or a head/admin) may enter data.
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  const isHead = u.role === "AM_HEAD" || u.role === "SUPER_ADMIN" || u.role === "SUB_ADMIN";
  if (!client || (!isHead && client.accountManagerId !== u.id)) redirect(`/google-ads?period=${period}`);

  const rowCount = n(fd, "rows") || 8;
  const GADS_TYPES_OK = ["SEARCH", "DISPLAY", "PMAX", "SMART"];
  const data: { clientId: string; date: string; name: string; type: string; spent: number; leads: number; conversions: number; status: string; updatedBy: string }[] = [];
  for (let i = 0; i < rowCount; i++) {
    const name = s(fd, `name_${i}`);
    if (!name) continue;
    const type = GADS_TYPES_OK.includes(s(fd, `type_${i}`)) ? s(fd, `type_${i}`) : "SEARCH";
    const status = s(fd, `status_${i}`) === "PAUSED" ? "PAUSED" : "ACTIVE";
    data.push({
      clientId, date, name, type,
      spent: n(fd, `spent_${i}`), leads: n(fd, `leads_${i}`), conversions: n(fd, `conv_${i}`),
      status, updatedBy: u.name.split(" ")[0],
    });
  }

  // Replace the whole day so removed rows disappear too.
  await prisma.googleAdsCampaign.deleteMany({ where: { clientId, date } });
  if (data.length) await prisma.googleAdsCampaign.createMany({ data });

  revalidatePath("/google-ads");
  redirect(`/google-ads?period=${period}`);
}

// ---- SEO work items (blogs / backlinks / keywords / local SEO / audit) — add, edit, import ----
const SEO_TYPES = ["blog", "backlink", "ranking", "localseo", "audit"];
async function canEditSeo(clientId: string) {
  const u = await getCurrentUser();
  if (!u) return null;
  if (u.role === "SUPER_ADMIN" || u.role === "SUB_ADMIN" || u.role === "SEO_HEAD") return u;
  const a = await prisma.assignment.findFirst({ where: { clientId, userId: u.id, department: "SEO" } });
  return a ? u : null;
}
function seoBack(clientId: string) { return `/seo?client=${clientId}`; }

export async function addSeoItem(fd: FormData) {
  const clientId = s(fd, "clientId");
  const u = await canEditSeo(clientId);
  if (!u) redirect("/seo");
  const category = SEO_TYPES.includes(s(fd, "category")) ? s(fd, "category") : "blog";
  const dateStr = s(fd, "date");
  const date = dateStr ? new Date(dateStr + "T10:00:00") : new Date();
  const status = s(fd, "status") === "PENDING" ? "PENDING_APPROVAL" : "COMPLETED";
  const data: Record<string, unknown> = { clientId, userId: u.id, date, workType: category, quantity: 1, status, title: s(fd, "title") || null };
  if (category === "ranking") { data.keyword = s(fd, "keyword") || null; data.prevPosition = n(fd, "prev") || null; data.currPosition = n(fd, "curr") || null; data.title = `Ranking: ${s(fd, "keyword")}`; }
  if (category === "backlink") data.proofLink = s(fd, "proofLink") || null;
  await prisma.workUpdate.create({ data: data as never });
  revalidatePath("/seo");
  redirect(seoBack(clientId));
}

export async function setSeoItemStatus(fd: FormData) {
  const id = s(fd, "id"); const clientId = s(fd, "clientId");
  const u = await canEditSeo(clientId);
  if (!u) redirect("/seo");
  const next = s(fd, "status") === "PENDING" ? "PENDING_APPROVAL" : "COMPLETED";
  await prisma.workUpdate.update({ where: { id }, data: { status: next } });
  revalidatePath("/seo");
  redirect(seoBack(clientId));
}

export async function deleteSeoItem(fd: FormData) {
  const id = s(fd, "id"); const clientId = s(fd, "clientId");
  const u = await canEditSeo(clientId);
  if (!u) redirect("/seo");
  await prisma.workUpdate.delete({ where: { id } });
  revalidatePath("/seo");
  redirect(seoBack(clientId));
}

// Bulk import from Excel — the user copies cells from Excel and pastes them (tab- or
// comma-separated), one item per line. Column meaning depends on the category.
export async function importSeoItems(fd: FormData) {
  const clientId = s(fd, "clientId");
  const u = await canEditSeo(clientId);
  if (!u) redirect("/seo");
  const category = SEO_TYPES.includes(s(fd, "category")) ? s(fd, "category") : "blog";
  const raw = s(fd, "rows");
  const monthDate = s(fd, "date") ? new Date(s(fd, "date") + "T10:00:00") : new Date();
  const rows: { clientId: string; userId: string; date: Date; workType: string; quantity: number; status: string; title: string | null; keyword?: string | null; prevPosition?: number | null; currPosition?: number | null; proofLink?: string | null }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const cells = line.split(/\t|,/).map((c) => c.trim());
    if (!cells[0]) continue;
    const base = { clientId, userId: u.id, date: monthDate, workType: category, quantity: 1, status: "COMPLETED" };
    if (category === "ranking") {
      const prev = parseInt(cells[1], 10); const curr = parseInt(cells[2], 10);
      rows.push({ ...base, title: `Ranking: ${cells[0]}`, keyword: cells[0], prevPosition: Number.isFinite(prev) ? prev : null, currPosition: Number.isFinite(curr) ? curr : null });
    } else if (category === "backlink") {
      rows.push({ ...base, title: cells[0].startsWith("http") ? `Backlink from ${cells[0].replace(/^https?:\/\//, "").split("/")[0]}` : `Backlink from ${cells[0]}`, proofLink: cells[1] || (cells[0].startsWith("http") ? cells[0] : "") });
    } else {
      rows.push({ ...base, title: cells[0] });
    }
  }
  if (rows.length) await prisma.workUpdate.createMany({ data: rows as never });
  revalidatePath("/seo");
  redirect(seoBack(clientId));
}

// ---- Blog slot tracker (8 slots × 3 stages: Blog · Image · Website) ----
const BLOG_CYCLE: Record<string, [string, string]> = { blog: ["PENDING", "PUBLISHED"], image: ["PENDING", "DONE"], web: ["PENDING", "LIVE"] };
export async function toggleBlogStage(fd: FormData) {
  const clientId = s(fd, "clientId");
  const u = await canEditSeo(clientId);
  if (!u) redirect("/seo");
  const id = s(fd, "id");
  const field = s(fd, "field");
  if (!["blog", "image", "web"].includes(field)) redirect(seoBack(clientId));
  const slot = await prisma.seoBlogSlot.findUnique({ where: { id } });
  if (!slot || slot.clientId !== clientId) redirect(seoBack(clientId));
  const [off, on] = BLOG_CYCLE[field];
  const cur = (slot as unknown as Record<string, string>)[field];
  await prisma.seoBlogSlot.update({ where: { id }, data: { [field]: cur === on ? off : on } });
  revalidatePath("/seo");
  redirect(seoBack(clientId) + "&tab=blog");
}

export async function saveBlogSlot(fd: FormData) {
  const clientId = s(fd, "clientId");
  const u = await canEditSeo(clientId);
  if (!u) redirect("/seo");
  const id = s(fd, "id");
  const data = {
    writer: s(fd, "writer"), title: s(fd, "title"), link: s(fd, "link"),
    blog: s(fd, "blog") === "PUBLISHED" ? "PUBLISHED" : "PENDING",
    image: s(fd, "image") === "DONE" ? "DONE" : "PENDING",
    web: s(fd, "web") === "LIVE" ? "LIVE" : "PENDING",
  };
  if (id) {
    await prisma.seoBlogSlot.update({ where: { id }, data });
  } else {
    const month = s(fd, "month");
    const last = await prisma.seoBlogSlot.findFirst({ where: { clientId, month }, orderBy: { slot: "desc" } });
    await prisma.seoBlogSlot.create({ data: { clientId, month, slot: (last?.slot ?? 0) + 1, ...data } });
  }
  revalidatePath("/seo");
  redirect(seoBack(clientId) + "&tab=blog");
}

export async function addBlogSlot(fd: FormData) {
  const clientId = s(fd, "clientId");
  const u = await canEditSeo(clientId);
  if (!u) redirect("/seo");
  const month = s(fd, "month");
  const writer = s(fd, "writer");
  const last = await prisma.seoBlogSlot.findFirst({ where: { clientId, month }, orderBy: { slot: "desc" } });
  await prisma.seoBlogSlot.create({ data: { clientId, month, slot: (last?.slot ?? 0) + 1, writer } });
  revalidatePath("/seo");
  redirect(seoBack(clientId) + "&tab=blog");
}

export async function deleteBlogSlot(fd: FormData) {
  const clientId = s(fd, "clientId");
  const u = await canEditSeo(clientId);
  if (!u) redirect("/seo");
  await prisma.seoBlogSlot.delete({ where: { id: s(fd, "id") } });
  revalidatePath("/seo");
  redirect(seoBack(clientId) + "&tab=blog");
}

// ---- Per-client SEO master fields (targets / priority / schedule / GSC-GA) — head/admin ----
export async function saveClientSeoMeta(fd: FormData) {
  const clientId = s(fd, "clientId");
  const u = await getCurrentUser();
  if (!u || (u.role !== "SUPER_ADMIN" && u.role !== "SUB_ADMIN" && u.role !== "SEO_HEAD")) redirect(seoBack(clientId));
  await prisma.client.update({
    where: { id: clientId },
    data: {
      seoPriority: s(fd, "priority"), seoScheduleDays: s(fd, "schedule"),
      blogTarget: n(fd, "blogTarget"), backlinkTarget: n(fd, "backlinkTarget"), keywordTarget: n(fd, "keywordTarget"),
      gscLink: s(fd, "gscLink"), gaLink: s(fd, "gaLink"),
    },
  });
  revalidatePath("/seo");
  redirect(seoBack(clientId));
}

// ---- Local SEO / GMB rows ----
async function canEditGmb() {
  const u = await getCurrentUser();
  if (!u) return null;
  return ["SUPER_ADMIN", "SUB_ADMIN", "SEO_HEAD", "SEO"].includes(u.role) ? u : null;
}
export async function saveGmb(fd: FormData) {
  const u = await canEditGmb();
  if (!u) redirect("/seo?view=gmb");
  const id = s(fd, "id");
  const data = {
    name: s(fd, "name"), assigned: s(fd, "assigned"), gmbLink: s(fd, "gmbLink"),
    monthlyPosts: n(fd, "monthlyPosts"), postsDone: n(fd, "postsDone"), lastPostDate: s(fd, "lastPostDate"),
    citations: n(fd, "citations"), reviews: n(fd, "reviews"), reviewsNote: s(fd, "reviewsNote"),
    localo: s(fd, "localo") === "on" || s(fd, "localo") === "true",
  };
  if (id) await prisma.gmbClient.update({ where: { id }, data });
  else await prisma.gmbClient.create({ data });
  revalidatePath("/seo");
  redirect("/seo?view=gmb");
}
export async function deleteGmb(fd: FormData) {
  const u = await canEditGmb();
  if (!u) redirect("/seo?view=gmb");
  await prisma.gmbClient.delete({ where: { id: s(fd, "id") } });
  revalidatePath("/seo");
  redirect("/seo?view=gmb");
}

// ---- Monthly report delivery ----
export async function saveSeoReport(fd: FormData) {
  const clientId = s(fd, "clientId");
  const u = await canEditSeo(clientId);
  if (!u) redirect("/seo?view=reports");
  const month = s(fd, "month");
  const data = {
    reportDate: s(fd, "reportDate"), status: s(fd, "status") === "SENT" ? "SENT" : "PENDING",
    gscDone: s(fd, "gscDone") === "on" || s(fd, "gscDone") === "true",
    gaDone: s(fd, "gaDone") === "on" || s(fd, "gaDone") === "true",
    assigned: s(fd, "assigned"), keywordStatus: s(fd, "keywordStatus"), note: s(fd, "note"),
  };
  await prisma.seoReport.upsert({
    where: { clientId_month: { clientId, month } },
    update: data,
    create: { clientId, month, ...data },
  });
  revalidatePath("/seo");
  redirect(s(fd, "back") || "/seo?view=reports");
}

// ---- SEO employee adds a new client to their board ----
export async function createSeoClient(fd: FormData) {
  const u = await getCurrentUser();
  if (!u || !["SEO", "SEO_HEAD", "SUPER_ADMIN", "SUB_ADMIN"].includes(u.role)) redirect("/seo");
  const name = s(fd, "name");
  if (!name) redirect("/seo");
  // next SEO-xxx code
  const existing = await prisma.client.findMany({ where: { code: { startsWith: "SEO-" } }, select: { code: true } });
  const maxN = existing.reduce((m, c) => Math.max(m, parseInt(c.code.replace("SEO-", "")) || 0), 0);
  const code = `SEO-${String(maxN + 1).padStart(3, "0")}`;
  const amId = s(fd, "accountManagerId");
  const client = await prisma.client.create({
    data: {
      code, name, website: s(fd, "website"), industry: s(fd, "industry") || "SEO",
      status: "ACTIVE", monthlyRetainer: n(fd, "budget"),
      seoPriority: s(fd, "priority"), seoScheduleDays: s(fd, "schedule"),
      blogTarget: n(fd, "blogTarget") || 8, backlinkTarget: n(fd, "backlinkTarget"), keywordTarget: n(fd, "keywordTarget") || 10,
      pocName: s(fd, "poc") || null,
      ...(amId ? { accountManager: { connect: { id: amId } } } : {}),
    },
  });
  await prisma.clientService.create({ data: { clientId: client.id, service: "SEO" } });
  // assign to the current SEO user so it shows on their board (heads see all anyway)
  if (u.role === "SEO" || u.role === "SEO_HEAD") await prisma.assignment.create({ data: { clientId: client.id, userId: u.id, department: "SEO" } });
  revalidatePath("/seo");
  redirect(`/seo?client=${client.id}`);
}

// ---- SEO employee edits / deletes a client on their board ----
export async function updateSeoClient(fd: FormData) {
  const clientId = s(fd, "clientId");
  const u = await canEditSeo(clientId);
  if (!u) redirect("/seo");
  const name = s(fd, "name");
  const amId = s(fd, "accountManagerId");
  await prisma.client.update({
    where: { id: clientId },
    data: {
      ...(name ? { name } : {}),
      website: s(fd, "website"), industry: s(fd, "industry") || "SEO",
      monthlyRetainer: n(fd, "budget"), seoPriority: s(fd, "priority"), seoScheduleDays: s(fd, "schedule"),
      blogTarget: n(fd, "blogTarget") || 8, backlinkTarget: n(fd, "backlinkTarget"), keywordTarget: n(fd, "keywordTarget") || 10,
      pocName: s(fd, "poc") || null,
      ...(amId ? { accountManager: { connect: { id: amId } } } : { accountManager: { disconnect: true } }),
    },
  });
  revalidatePath("/seo");
  redirect(`/seo?client=${clientId}`);
}

export async function deleteSeoClient(fd: FormData) {
  const clientId = s(fd, "clientId");
  const u = await canEditSeo(clientId);
  if (!u) redirect(`/seo?client=${clientId}`);
  await prisma.client.delete({ where: { id: clientId } });
  revalidatePath("/seo");
  redirect("/seo");
}

// ---- Full SEO client board (one card = blogs + keywords + backlinks + GSC + GA), matches the uploaded design ----
const BLOG_STATUS_MAP: Record<string, { blog: string; image: string; web: string }> = {
  "Published": { blog: "PUBLISHED", image: "DONE", web: "LIVE" },
  "Pending Review": { blog: "REVIEW", image: "DONE", web: "PENDING" },
  "Draft": { blog: "PENDING", image: "PENDING", web: "PENDING" },
};
function f(fd: FormData, k: string) { const v = parseFloat(s(fd, k)); return Number.isFinite(v) ? v : 0; }

export async function saveSeoClientBoard(fd: FormData) {
  const clientId = s(fd, "clientId");
  const u = await canEditSeo(clientId);
  if (!u) redirect("/");
  const month = s(fd, "month");

  // --- Blogs ---
  const blogCount = Math.min(30, n(fd, "blogCount"));
  const blogRows = [];
  for (let i = 0; i < blogCount; i++) {
    const statusLabel = s(fd, `blog_${i}_status`) || "Draft";
    const st = BLOG_STATUS_MAP[statusLabel] ?? BLOG_STATUS_MAP["Draft"];
    blogRows.push({ clientId, month, slot: i + 1, title: s(fd, `blog_${i}_title`), link: s(fd, `blog_${i}_link`), blogDate: s(fd, `blog_${i}_date`), blog: st.blog, image: st.image, web: st.web });
  }
  await prisma.seoBlogSlot.deleteMany({ where: { clientId, month } });
  if (blogRows.length) await prisma.seoBlogSlot.createMany({ data: blogRows });

  // --- Keywords ---
  const kwCount = Math.min(50, n(fd, "kwCount"));
  const kwRows = [];
  for (let i = 0; i < kwCount; i++) kwRows.push({ clientId, month, slot: i + 1, keyword: s(fd, `kw_${i}_keyword`), lastPos: n(fd, `kw_${i}_last`), currPos: n(fd, `kw_${i}_curr`) });
  await prisma.seoKeyword.deleteMany({ where: { clientId, month } });
  if (kwRows.length) await prisma.seoKeyword.createMany({ data: kwRows });

  // --- Backlinks ---
  const blCount = Math.min(50, n(fd, "blCount"));
  const blRows = [];
  for (let i = 0; i < blCount; i++) blRows.push({ clientId, month, slot: i + 1, type: s(fd, `bl_${i}_type`) || "Guest Post", status: s(fd, `bl_${i}_status`) || "Live", link: s(fd, `bl_${i}_link`), da: n(fd, `bl_${i}_da`), date: s(fd, `bl_${i}_date`) });
  await prisma.seoBacklink.deleteMany({ where: { clientId, month } });
  if (blRows.length) await prisma.seoBacklink.createMany({ data: blRows });

  // --- GSC + GA analytics ---
  const impressions = n(fd, "gsc_impressions"), clicks = n(fd, "gsc_clicks");
  const ctr = impressions ? +((clicks / impressions) * 100).toFixed(2) : 0;
  const ana = {
    gscImpressions: impressions, gscClicks: clicks, gscCtr: ctr, gscPosition: f(fd, "gsc_position"),
    gaUsers: n(fd, "ga_active"), gaNewUsers: n(fd, "ga_new"), gaOrganic: n(fd, "ga_organic"), gaOrganicSocial: n(fd, "ga_organicsocial"),
    gaSessions: n(fd, "ga_sessions"), gaBounce: f(fd, "ga_bounce"), gaEngagement: s(fd, "ga_engagement"),
  };
  await prisma.seoAnalytics.upsert({ where: { clientId_month: { clientId, month } }, update: ana, create: { clientId, month, ...ana } });
  // DA + notes are per-client values
  await prisma.client.update({ where: { id: clientId }, data: { domainAuthority: n(fd, "da"), notes: s(fd, "notes") } });

  revalidatePath("/seo");
  redirect(`/seo?client=${clientId}`);
}

// ---- Creative task board (Designer / Video Editor) ----
async function creativeGuard(taskId: string) {
  const u = await getCurrentUser();
  if (!u) return null;
  const t = await prisma.creativeTask.findUnique({ where: { id: taskId } });
  if (!t) return null;
  const ok = u.role === "SUPER_ADMIN" || u.role === "SUB_ADMIN" || t.assignedToId === u.id;
  return ok ? t : null;
}
function creativePath(kind: string) {
  return kind === "VIDEO" ? "/videos" : "/designs";
}

export async function saveCreativeTask(fd: FormData) {
  const id = s(fd, "id");
  const t = await creativeGuard(id);
  if (!t) redirect("/");
  const CS = ["PENDING", "IN_PROGRESS", "REVIEW", "COMPLETED"];
  const PR = ["HIGH", "MEDIUM", "LOW"];
  await prisma.creativeTask.update({
    where: { id },
    data: {
      status: CS.includes(s(fd, "status")) ? s(fd, "status") : t.status,
      priority: PR.includes(s(fd, "priority")) ? s(fd, "priority") : t.priority,
      dueDate: s(fd, "dueDate") || t.dueDate,
      dimensions: s(fd, "dimensions"),
      brief: s(fd, "brief"),
      notes: s(fd, "notes"),
      refLink: s(fd, "refLink"),
      rawLink: s(fd, "rawLink"),
      finalLink: s(fd, "finalLink"),
    },
  });
  revalidatePath(creativePath(t.kind));
  redirect(creativePath(t.kind));
}

export async function setCreativeStatus(fd: FormData) {
  const id = s(fd, "id");
  const t = await creativeGuard(id);
  if (!t) redirect("/");
  const next = s(fd, "status");
  const CS = ["PENDING", "IN_PROGRESS", "REVIEW", "COMPLETED"];
  if (CS.includes(next)) await prisma.creativeTask.update({ where: { id }, data: { status: next } });
  revalidatePath(creativePath(t.kind));
  redirect(creativePath(t.kind));
}

export async function addCreativeTask(fd: FormData) {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  const kind = s(fd, "kind") === "VIDEO" ? "VIDEO" : "DESIGN";
  const prefix = kind === "VIDEO" ? "VID" : "DSG";
  const count = await prisma.creativeTask.count({ where: { assignedToId: u.id, kind } });
  const title = s(fd, "title") || (kind === "VIDEO" ? "Additional Video" : "Additional Design");
  const clientId = s(fd, "clientId") || null;
  await prisma.creativeTask.create({
    data: {
      kind, code: `${prefix}-${String(count + 1).padStart(3, "0")}`, title,
      clientId, assignedToId: u.id,
      type: s(fd, "type") || (kind === "VIDEO" ? "Reel" : "Social Creative"),
      priority: ["HIGH", "MEDIUM", "LOW"].includes(s(fd, "priority")) ? s(fd, "priority") : "MEDIUM",
      status: "PENDING", source: "ADDITIONAL",
      assignedDate: s(fd, "assignedDate"), dueDate: s(fd, "dueDate"),
      dimensions: s(fd, "dimensions"), brief: s(fd, "brief"), refLink: s(fd, "refLink"), rawLink: s(fd, "rawLink"),
    },
  });
  revalidatePath(creativePath(kind));
  redirect(creativePath(kind));
}

export async function deleteCreativeTask(fd: FormData) {
  const id = s(fd, "id");
  const t = await creativeGuard(id); // owner or Super Admin only
  if (!t) redirect("/");
  await prisma.creativeTask.delete({ where: { id } });
  revalidatePath(creativePath(t.kind));
  revalidatePath("/");
  revalidatePath("/reports/creative");
  // If called from the report, stay there; otherwise the board.
  const from = s(fd, "from");
  redirect(from === "report" ? "/reports/creative" : creativePath(t.kind));
}

// ---- In-app notifications ----
// Roles that can prepare content and hand a creative task to a designer / editor.
const CREATIVE_ASSIGNER = ["SUPER_ADMIN", "SUB_ADMIN", "AM_HEAD", "ACCOUNT_MANAGER", "DM_EXEC"];

async function notify(userId: string, title: string, body: string, link: string, tone = "violet") {
  if (!userId) return;
  try { await prisma.notification.create({ data: { userId, title, body, link, tone } }); } catch { /* notifications are best-effort */ }
}

export async function markNotificationsRead() {
  const me = await getCurrentUser();
  if (!me) return;
  await prisma.notification.updateMany({ where: { userId: me.id, read: false }, data: { read: true } });
  revalidatePath("/");
}

// Account Manager (or a head / admin) prepares content and assigns a design/video task to a
// specific team member. It lands on THAT person's Studio board and pings them a notification.
export async function assignCreativeTask(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !CREATIVE_ASSIGNER.includes(me.role)) redirect("/");
  const assignedToId = s(fd, "assignedToId");
  const title = s(fd, "title");
  if (!assignedToId || !title) redirect("/");
  const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
  if (!assignee || (assignee.role !== "DESIGNER" && assignee.role !== "EDITOR")) redirect("/");
  const kind = assignee.role === "EDITOR" ? "VIDEO" : "DESIGN";
  const prefix = kind === "VIDEO" ? "VID" : "DSG";
  const count = await prisma.creativeTask.count({ where: { assignedToId, kind } });
  const clientId = s(fd, "clientId") || null;
  const client = clientId ? await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } }) : null;
  const path = kind === "VIDEO" ? "/videos" : "/designs";
  await prisma.creativeTask.create({
    data: {
      kind, code: `${prefix}-${String(count + 1).padStart(3, "0")}`, title,
      clientId, assignedToId,
      type: s(fd, "type") || (kind === "VIDEO" ? "Reel" : "Social Creative"),
      priority: ["HIGH", "MEDIUM", "LOW"].includes(s(fd, "priority")) ? s(fd, "priority") : "MEDIUM",
      status: "PENDING", source: "ADDITIONAL",
      assignedDate: s(fd, "assignedDate") || new Date().toISOString().slice(0, 10),
      dueDate: s(fd, "dueDate"),
      dimensions: s(fd, "dimensions"), brief: s(fd, "brief"), refLink: s(fd, "refLink"), rawLink: s(fd, "rawLink"),
    },
  });
  await notify(assignedToId,
    `New ${kind === "VIDEO" ? "video" : "design"} assigned: ${title}`,
    `From ${me.name}${client ? ` · ${client.name}` : ""}`, path, "violet");
  revalidatePath(path);
  revalidatePath("/");
  redirect(s(fd, "from") || "/");
}

// Parse the services / deliverables / assignments block shared by create + edit.
function parseServiceBlock(fd: FormData, clientId: string) {
  const services = SERVICE_KEYS.filter((k) => fd.get(`svc_${k}`) === "on");

  const deliverables: { clientId: string; service: string; metric: string; agreed: number }[] = [];
  for (const svc of services) {
    for (const m of SERVICES[svc as ServiceKey].metrics) {
      const val = n(fd, `del_${svc}_${m.key}`);
      if (val > 0) deliverables.push({ clientId, service: svc, metric: m.key, agreed: val });
    }
  }

  const raw: { clientId: string; userId: string; department: string }[] = [];
  const push = (uid: string, dept: string) => { if (uid) raw.push({ clientId, userId: uid, department: dept }); };
  push(s(fd, "accountManagerId"), "ACCOUNT");
  push(s(fd, "amHeadId"), "ACCOUNT");
  push(s(fd, "seoHeadId"), "SEO");
  push(s(fd, "seoMemberId"), "SEO");
  push(s(fd, "designerId"), "DESIGN");
  push(s(fd, "editorId"), "VIDEO");
  push(s(fd, "devId"), "DEV");
  const seen = new Set<string>();
  const assignments = raw.filter((a) => {
    const key = `${a.userId}:${a.department}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { services, deliverables, assignments };
}

// Text descriptors captured per service (website type, branding scope, "other" specify).
function serviceDetail(fd: FormData, svc: string) {
  if (svc === "WEBSITE_DEV") return s(fd, "del_WEBSITE_DEV_websiteType") || null;
  if (svc === "BRANDING") return s(fd, "del_BRANDING_brandingScope") || null;
  if (svc === "OTHER") return s(fd, "detail_OTHER") || null;
  return null;
}

function clientScalars(fd: FormData) {
  return {
    name: s(fd, "name"),
    website: s(fd, "website") || null,
    industry: s(fd, "industry") || null,
    monthlyRetainer: n(fd, "monthlyRetainer"),
    pocName: s(fd, "pocName") || null,
    pocMobile: s(fd, "pocMobile") || null,
    pocEmail: s(fd, "pocEmail") || null,
    status: s(fd, "status") || "ACTIVE",
    onboardDate: s(fd, "onboardDate") ? new Date(s(fd, "onboardDate")) : new Date(),
    accountManagerId: s(fd, "accountManagerId") || null,
    notes: s(fd, "notes") || null,
  };
}

export async function createClient(fd: FormData) {
  const scalars = clientScalars(fd);
  if (!scalars.name) throw new Error("Client name is required");

  const code = await nextClientCode();

  const client = await prisma.client.create({ data: { code, ...scalars } });
  const { services, deliverables, assignments } = parseServiceBlock(fd, client.id);

  await prisma.clientService.createMany({ data: services.map((svc) => ({ clientId: client.id, service: svc, detail: serviceDetail(fd, svc) })) });
  if (deliverables.length) await prisma.deliverable.createMany({ data: deliverables });
  if (assignments.length) {
    await prisma.assignment.createMany({ data: assignments });
    // Ping every tagged team member that they're on a new client.
    const deptLabel: Record<string, string> = { ACCOUNT: "Account Manager", SEO: "SEO", DESIGN: "Design", VIDEO: "Video", DEV: "Developer" };
    const byUser = new Map<string, string[]>();
    for (const a of assignments) byUser.set(a.userId, [...(byUser.get(a.userId) ?? []), deptLabel[a.department] ?? a.department]);
    await Promise.all([...byUser].map(([uid, depts]) =>
      notify(uid, `New client: ${client.name}`, `You've been assigned — ${depts.join(" · ")}`, `/clients/${client.id}`, "emerald")));
  }

  revalidatePath("/");
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

// Accountant (or admin) adds a client directly from the finance dashboard.
// Lightweight: captures billing-relevant fields only, then returns to the dashboard.
export async function addClientFromFinance(fd: FormData) {
  const u = await getCurrentUser();
  if (!u || !["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"].includes(u.role)) redirect("/");
  const scalars = clientScalars(fd);
  if (!scalars.name) redirect("/?client=missingname");

  const code = await nextClientCode();

  const gst = Math.max(0, n(fd, "gst")); // 0 = no GST, else rate %
  const gstin = s(fd, "gstin");
  const client = await prisma.client.create({ data: { code, ...scalars, gstApplicable: gst > 0, gstRate: gst > 0 ? gst : 18, gstin } });

  // A client who takes both services gets a SEPARATE invoice per service, so the
  // Website-vs-DM split stays exact (no lumped "Both" invoice). Amounts are entered
  // per service (before GST); "amount paid" is distributed across them, Website first.
  const webAmt = Math.max(0, n(fd, "webAmount"));
  const dmAmt = Math.max(0, n(fd, "dmAmount"));
  const specs = [
    ...(webAmt > 0 ? [{ label: "Website Development", amount: webAmt }] : []),
    ...(dmAmt > 0 ? [{ label: "Digital Marketing", amount: dmAmt }] : []),
  ];

  if (specs.length) {
    // Tag the client's services (drives Website vs DM elsewhere).
    await prisma.clientService.createMany({ data: specs.map((sp) => ({ clientId: client.id, service: sp.label })) });

    let paidLeft = Math.max(0, n(fd, "paid"));
    const issueDate = new Date().toISOString().slice(0, 10);
    const dd = new Date(issueDate + "T00:00:00Z"); dd.setUTCDate(dd.getUTCDate() + 15);
    const dueDate = dd.toISOString().slice(0, 10);
    const fy = financialYear();
    // Serial series follows the client's GST flag (GST vs non-GST); all specs share it here.
    const hasGst = gst > 0;
    const prefix = `${hasGst ? "GST" : "NG"}/${fy}/`;
    const clientState = stateFromGstin(gstin);
    const lastInv = await prisma.salesInvoice.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { createdAt: "desc" }, select: { number: true } });
    let seq = lastInv ? parseInt(lastInv.number.split("/").pop() || "0", 10) + 1 : 1;
    for (const sp of specs) {
      const taxAmount = Math.round((sp.amount * gst) / 100);
      const total = sp.amount + taxAmount;
      const received = Math.min(paidLeft, total); paidLeft -= received;
      const company = companyFor(hasGst, sp.label === "Digital Marketing" ? "DM" : "WEBSITE");
      const inv = await prisma.salesInvoice.create({
        data: {
          number: `${prefix}${String(seq++).padStart(3, "0")}`, clientId: client.id, pipeline: "WEBROCZ", company,
          billTo: client.name, contact: scalars.pocName ?? "", phone: scalars.pocMobile ?? "", email: scalars.pocEmail ?? "", clientGstin: gstin,
          clientState, placeOfSupply: clientState,
          items: JSON.stringify([{ name: sp.label, qty: 1, rate: sp.amount, amount: sp.amount }]),
          subtotal: sp.amount, taxPct: gst, taxAmount, total,
          received,
          paymentStatus: received >= total ? "Fully Received" : received > 0 ? "Partially Received" : "Pending",
          issueDate, dueDate,
        },
      });
      if (received > 0) await prisma.payment.create({ data: { invoiceId: inv.id, amount: received, date: issueDate, mode: "OTHER", note: "Opening balance", by: u.name } });
    }
  }

  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/accounts");
  const ret = s(fd, "return");
  redirect(ret ? `${ret}${ret.includes("?") ? "&" : "?"}client=added` : "/?client=added");
}

// Accountant edits a client's core info from the finance area (only the billing-relevant
// fields — leaves onboardDate / team assignments / services untouched).
export async function updateClientFinance(fd: FormData) {
  const u = await getCurrentUser();
  if (!u || !["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"].includes(u.role)) redirect("/");
  const id = s(fd, "id");
  if (!id) redirect("/accounts");
  const name = s(fd, "name");
  if (!name) redirect(`/accounts/${id}?err=name`);
  const STATUS_OK = ["ACTIVE", "ON_HOLD", "UPCOMING"];
  // Services list (Domain / Hosting + SSL / Website Designing / custom). Domain & Hosting drive
  // their amounts + the renewal; the full list is stored so it shows in Website Renewals.
  const svc = fd.getAll("svc").map((v) => String(v).trim()).filter(Boolean);
  const domainTaken = svc.includes("Domain");
  const hostingTaken = svc.includes("Hosting + SSL");
  const domainAmount = domainTaken ? Math.max(0, n(fd, "domainAmount")) : 0;
  const hostingAmount = hostingTaken ? Math.max(0, n(fd, "hostingAmount")) : 0;
  const takenDate = s(fd, "websiteTakenDate");
  // Expiry = register date + 1 year (computed, not entered).
  const expiryDate = (() => { if (!takenDate) return ""; const d = new Date(takenDate + "T00:00:00Z"); if (isNaN(d.getTime())) return ""; d.setUTCFullYear(d.getUTCFullYear() + 1); return d.toISOString().slice(0, 10); })();
  await prisma.client.update({
    where: { id },
    data: {
      name,
      pocName: s(fd, "pocName") || null,
      pocMobile: s(fd, "pocMobile") || null,
      pocEmail: s(fd, "pocEmail") || null,
      status: STATUS_OK.includes(s(fd, "status")) ? s(fd, "status") : "ACTIVE",
      // Industry, monthly retainer, account manager, GST/GSTIN, website URL and the general
      // renewal date are not edited here — left untouched so they keep what was set elsewhere.
      websiteDomain: s(fd, "websiteDomain"),
      websiteServices: JSON.stringify(svc),
      domainTaken, domainAmount,
      hostingTaken, hostingAmount,
      websiteTakenDate: takenDate,
      websiteExpiryDate: expiryDate,
      websiteRenewAmount: domainAmount + hostingAmount, // auto: domain + hosting
      notes: s(fd, "notes") || null,
    },
  });
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${id}`);
  redirect(`/accounts/${id}?saved=1`);
}

// Accountant logs a follow-up on a CLIENT (with their name + optional next date).
// Appended to the client's followupLog JSON. Also usable to just set the next date.
export async function logClientFollowup(fd: FormData) {
  const u = await getCurrentUser();
  if (!u || !["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"].includes(u.role)) redirect("/");
  const id = s(fd, "id");
  const back = s(fd, "return") || (id ? `/accounts/${id}` : "/accounts");
  if (!id) redirect(back);
  const note = s(fd, "note");
  const next = s(fd, "next");
  if (!note && !next) redirect(back);
  const client = await prisma.client.findUnique({ where: { id }, select: { followupLog: true } });
  let log: { date: string; by: string; note: string; next?: string }[] = [];
  try { const arr = JSON.parse(client?.followupLog || "[]"); if (Array.isArray(arr)) log = arr; } catch { /* ignore */ }
  const date = new Date().toISOString().slice(0, 10);
  if (note) log.push({ date, by: u.name, note, next });
  await prisma.client.update({ where: { id }, data: { followupLog: JSON.stringify(log), nextFollowup: next || undefined } });
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${id}`);
  redirect(back);
}

// Accountant updates just a client's website / hosting / renewal info (from the
// Website renewals page or the client profile). Kept separate so it can be inline.
export async function updateClientWebsite(fd: FormData) {
  const u = await getCurrentUser();
  if (!u || !["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"].includes(u.role)) redirect("/");
  const id = s(fd, "id");
  const back = s(fd, "return") || "/renewals";
  if (!id) redirect(back);
  await prisma.client.update({
    where: { id },
    data: {
      websiteName: s(fd, "websiteName"),
      websiteDomain: s(fd, "websiteDomain"),
      hostingTaken: s(fd, "hostingTaken") === "yes",
      websiteTakenDate: s(fd, "websiteTakenDate"),
      websiteExpiryDate: s(fd, "websiteExpiryDate"),
      websiteRenewAmount: n(fd, "websiteRenewAmount"),
    },
  });
  revalidatePath("/renewals");
  revalidatePath(`/accounts/${id}`);
  redirect(back);
}

// Add a website by typing the client name: match an existing client (case-insensitive)
// or create a new one, then save the website/hosting/renewal details onto it.
export async function addClientWebsite(fd: FormData) {
  const u = await getCurrentUser();
  if (!u || !["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"].includes(u.role)) redirect("/");
  const clientName = s(fd, "clientName");
  const back = s(fd, "return") || "/renewals";
  if (!clientName) redirect(`${back}?err=client`);
  const key = clientName.trim().toLowerCase();
  const match = (await prisma.client.findMany({ select: { id: true, name: true } })).find((c) => c.name.trim().toLowerCase() === key);
  let clientId: string;
  if (match) {
    clientId = match.id;
  } else {
    const created = await prisma.client.create({ data: { code: await nextClientCode(), name: clientName, status: "ACTIVE" } });
    clientId = created.id;
  }
  // Services list (Domain / Hosting + SSL / Website Designing / custom); Domain & Hosting drive
  // their amounts + the auto renewal, expiry = register date + 1 year.
  const svc = fd.getAll("svc").map((v) => String(v).trim()).filter(Boolean);
  const domainTaken = svc.includes("Domain");
  const hostingTaken = svc.includes("Hosting + SSL");
  const domainAmount = domainTaken ? Math.max(0, n(fd, "domainAmount")) : 0;
  const hostingAmount = hostingTaken ? Math.max(0, n(fd, "hostingAmount")) : 0;
  const takenDate = s(fd, "websiteTakenDate");
  const expiryDate = (() => { if (!takenDate) return ""; const d = new Date(takenDate + "T00:00:00Z"); if (isNaN(d.getTime())) return ""; d.setUTCFullYear(d.getUTCFullYear() + 1); return d.toISOString().slice(0, 10); })();
  await prisma.client.update({
    where: { id: clientId },
    data: {
      websiteDomain: s(fd, "websiteDomain"),
      websiteServices: JSON.stringify(svc),
      domainTaken, domainAmount,
      hostingTaken, hostingAmount,
      websiteTakenDate: takenDate,
      websiteExpiryDate: expiryDate,
      websiteRenewAmount: domainAmount + hostingAmount,
    },
  });
  revalidatePath("/renewals");
  revalidatePath(`/accounts/${clientId}`);
  redirect(back);
}

// Accountant deletes a client from the finance area. Cascades to invoices/payments —
// destructive, so the UI confirms first.
export async function deleteClientFinance(fd: FormData) {
  const u = await getCurrentUser();
  if (!u || !["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"].includes(u.role)) redirect("/");
  const id = s(fd, "id");
  if (id) { try { await prisma.client.delete({ where: { id } }); } catch { /* already gone */ } }
  revalidatePath("/accounts");
  revalidatePath("/");
  redirect("/accounts?deleted=1");
}

export async function updateClient(fd: FormData) {
  if (!(await isAdmin())) redirect("/");
  const id = s(fd, "id");
  if (!id) throw new Error("Missing client id");
  const scalars = clientScalars(fd);
  if (!scalars.name) throw new Error("Client name is required");

  await prisma.client.update({ where: { id }, data: scalars });

  // replace services / deliverables / assignments
  const { services, deliverables, assignments } = parseServiceBlock(fd, id);
  await prisma.$transaction([
    prisma.clientService.deleteMany({ where: { clientId: id } }),
    prisma.deliverable.deleteMany({ where: { clientId: id } }),
    prisma.assignment.deleteMany({ where: { clientId: id } }),
  ]);
  await prisma.clientService.createMany({ data: services.map((svc) => ({ clientId: id, service: svc, detail: serviceDetail(fd, svc) })) });
  if (deliverables.length) await prisma.deliverable.createMany({ data: deliverables });
  if (assignments.length) await prisma.assignment.createMany({ data: assignments });

  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function setClientStatus(fd: FormData) {
  const id = s(fd, "id");
  const status = s(fd, "status");
  if (id && status) await prisma.client.update({ where: { id }, data: { status } });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/");
}

export async function deleteClient(fd: FormData) {
  if (!(await isAdmin())) redirect("/");
  const id = s(fd, "id");
  if (id) await prisma.client.delete({ where: { id } });
  revalidatePath("/clients");
  revalidatePath("/");
  redirect("/clients");
}

export async function createUpdate(fd: FormData) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const clientId = s(fd, "clientId");
  // Only the Super Admin may log work on someone else's behalf; everyone else logs as themselves.
  const userId = (me.role === "SUPER_ADMIN" || me.role === "SUB_ADMIN") ? (s(fd, "userId") || me.id) : me.id;
  if (!clientId || !userId) throw new Error("Client and team member are required");

  await prisma.workUpdate.create({
    data: {
      clientId, userId,
      date: s(fd, "date") ? new Date(s(fd, "date")) : new Date(),
      workType: s(fd, "workType") || "task",
      quantity: Math.max(1, n(fd, "quantity")),
      status: s(fd, "status") || "COMPLETED",
      title: s(fd, "title") || null,
      detail: s(fd, "detail") || null,
      proofLink: s(fd, "proofLink") || null,
      notes: [s(fd, "notes"), s(fd, "effect") ? `Outcome: ${s(fd, "effect")}` : ""].filter(Boolean).join(" · ") || null,
      keyword: s(fd, "keyword") || null,
      prevPosition: fd.get("prevPosition") ? n(fd, "prevPosition") : null,
      currPosition: fd.get("currPosition") ? n(fd, "currPosition") : null,
      followUpDate: s(fd, "followUpDate") ? new Date(s(fd, "followUpDate")) : null,
    },
  });

  revalidatePath("/");
  revalidatePath("/updates");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

// ---- Authentication ----
// Which roles may sign in through each portal.
// Management portal = Super Admin only. Everyone else uses the Team portal.
const MANAGEMENT_ROLES = ["SUPER_ADMIN", "SUB_ADMIN"];
// Sub Admin is included in staff too, so the emailed set-password invite (/staff) works for them.
const STAFF_ROLES = ["SUB_ADMIN", "SALES_HEAD", "SALES_EXEC", "AM_HEAD", "ACCOUNT_MANAGER", "DM_HEAD", "DM_EXEC", "SEO_HEAD", "SEO", "DESIGNER", "EDITOR", "DEV_HEAD", "WEB_DEV", "ACCOUNTANT"];

export async function login(fd: FormData) {
  const email = s(fd, "email").toLowerCase();
  const password = s(fd, "password");
  const next = s(fd, "next") || "/";
  const portal = s(fd, "portal") === "staff" ? "staff" : "management";
  const base = portal === "staff" ? "/staff" : "/login";
  const nextQ = next !== "/" ? `&next=${encodeURIComponent(next)}` : "";
  if (!email || !password) throw new Error("Email and password are required");

  const user = await prisma.user.findFirst({ where: { email: { equals: email } } });
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    redirect(`${base}?error=1${nextQ}`);
  }

  // credentials are valid — but they must match this portal
  const allowed = portal === "staff" ? STAFF_ROLES : MANAGEMENT_ROLES;
  if (!allowed.includes(user.role)) {
    redirect(`${base}?error=2${nextQ}`);
  }

  const token = await signSession({ uid: user.id, name: user.name, role: user.role });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 24 * 7,
  });
  redirect(next.startsWith("/") ? next : "/");
}

// First-time users set their OWN password. Works only for an account the admin has
// created but that has no password yet (passwordHash null). After setting, auto sign-in.
export async function activateAccount(fd: FormData) {
  const email = s(fd, "email").toLowerCase();
  const password = s(fd, "password");
  const confirm = s(fd, "confirm");
  const portal = s(fd, "portal") === "staff" ? "staff" : "management";
  const base = portal === "staff" ? "/staff" : "/login";
  const err = (reason: string) => redirect(`${base}?acterr=${reason}`);
  if (!email || !password) err("missing");
  if (password.length < 6) err("short");
  if (password !== confirm) err("match");
  const user = await prisma.user.findFirst({ where: { email: { equals: email } } });
  if (!user) err("nouser");
  if (user!.passwordHash) err("exists");
  const allowed = portal === "staff" ? STAFF_ROLES : MANAGEMENT_ROLES;
  if (!allowed.includes(user!.role)) err("portal");
  await prisma.user.update({ where: { id: user!.id }, data: { passwordHash: hashPassword(password), active: true } });
  const token = await signSession({ uid: user!.id, name: user!.name, role: user!.role });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });
  redirect("/");
}

// Super Admin resets a user's password → clears it so the user sets a new one on next login.
export async function resetUserPassword(fd: FormData) {
  if (!(await isAdmin())) return;
  const id = s(fd, "id");
  if (id) await prisma.user.update({ where: { id }, data: { passwordHash: null } });
  revalidatePath("/team");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(IMPERSONATE_COOKIE);
  redirect("/login");
}

// ---- Super Admin "View as employee" (impersonation) — stays signed in as admin underneath ----
export async function impersonate(fd: FormData) {
  const real = await getRealUser();
  if (!real || !(real.role === "SUPER_ADMIN" || real.role === "SUB_ADMIN")) redirect("/");
  const userId = s(fd, "userId");
  if (userId && userId !== real.id) {
    const store = await cookies();
    store.set(IMPERSONATE_COOKIE, await signImpersonation(userId), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  }
  redirect("/");
}
export async function stopImpersonate() {
  const store = await cookies();
  store.delete(IMPERSONATE_COOKIE);
  redirect("/team");
}

// ---- Team management ----
export async function createUser(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !(me.role === "SUPER_ADMIN" || me.role === "SUB_ADMIN")) return;
  const name = s(fd, "name");
  const role = s(fd, "role");
  if (!name || !role) throw new Error("Name and role are required");
  if (role === "SUPER_ADMIN" && me.role !== "SUPER_ADMIN") return; // only the owner can create a Super Admin
  const password = s(fd, "password");
  const email = s(fd, "email").toLowerCase() || null;
  await prisma.user.create({
    data: { name, role, email, phone: s(fd, "phone") || null, passwordHash: password ? hashPassword(password) : null },
  });
  // Email the new member an invite to set their own password (only if email configured).
  if (email && !password) {
    try { await sendEmail(email, "You've been given access to WebRocz CRM", inviteEmailHtml(name, email)); } catch {}
  }
  revalidatePath("/team");
}

// Super Admin re-sends the "set your password" invite email to a pending member.
export async function resendInvite(fd: FormData) {
  if (!(await isAdmin())) return;
  const u = await prisma.user.findUnique({ where: { id: s(fd, "id") } });
  if (u?.email && !u.passwordHash) {
    try { await sendEmail(u.email, "Set your password — WebRocz CRM", inviteEmailHtml(u.name, u.email)); } catch {}
  }
  revalidatePath("/team");
}

export async function toggleUserActive(fd: FormData) {
  const id = s(fd, "id");
  const u = await prisma.user.findUnique({ where: { id } });
  if (u) await prisma.user.update({ where: { id }, data: { active: !u.active } });
  revalidatePath("/team");
}

// Super Admin edits a team member's details.
export async function updateUser(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !(me.role === "SUPER_ADMIN" || me.role === "SUB_ADMIN")) return;
  const id = s(fd, "id");
  const name = s(fd, "name");
  const role = s(fd, "role");
  if (!id || !name || !role) return;
  if (me.role !== "SUPER_ADMIN") {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (target?.role === "SUPER_ADMIN" || role === "SUPER_ADMIN") return; // a Sub Admin can't edit or create the owner
  }
  await prisma.user.update({
    where: { id },
    data: { name, role, email: s(fd, "email").toLowerCase() || null, phone: s(fd, "phone") || null },
  });
  revalidatePath("/team");
}

// Super Admin permanently deletes a team member (can't delete yourself).
export async function deleteUser(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !(me.role === "SUPER_ADMIN" || me.role === "SUB_ADMIN")) return;
  const id = s(fd, "id");
  if (!id || id === me.id) return; // no self-delete
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (target?.role === "SUPER_ADMIN" && me.role !== "SUPER_ADMIN") return; // only the owner can remove a Super Admin
  // clear the one blocking relation (WorkUpdate has no cascade); optional relations SetNull, others Cascade.
  await prisma.workUpdate.deleteMany({ where: { userId: id } });
  await prisma.client.updateMany({ where: { accountManagerId: id }, data: { accountManagerId: null } });
  await prisma.user.delete({ where: { id } });
  revalidatePath("/team");
}

// ---- Billing (Super Admin) ----
export async function generateInvoices(fd: FormData) {
  const month = s(fd, "month");
  if (!month) throw new Error("Month is required");

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE", monthlyRetainer: { gt: 0 } },
    include: { invoices: { where: { month } } },
    orderBy: { code: "asc" },
  });

  // sequence for invoice numbers within the month
  const existing = await prisma.invoice.count({ where: { month } });
  let seq = existing;

  const toCreate = clients
    .filter((c) => c.invoices.length === 0)
    .map((c) => {
      seq++;
      return {
        clientId: c.id,
        number: `INV-${month}-${String(seq).padStart(4, "0")}`,
        month,
        amount: c.monthlyRetainer,
        status: "PENDING",
      };
    });

  if (toCreate.length) await prisma.invoice.createMany({ data: toCreate });
  revalidatePath("/billing", "layout");
}

// Backfill an invoice for every month from each active client's onboarding up to now.
export async function generateAllInvoices() {
  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE", monthlyRetainer: { gt: 0 } },
    include: { invoices: true },
    orderBy: { code: "asc" },
  });
  const now = new Date();
  const seqByMonth = new Map<string, number>();
  const existingAll = await prisma.invoice.findMany({ select: { month: true } });
  for (const e of existingAll) seqByMonth.set(e.month, (seqByMonth.get(e.month) ?? 0) + 1);

  const toCreate: { clientId: string; number: string; month: string; amount: number; status: string }[] = [];
  for (const c of clients) {
    const have = new Set(c.invoices.map((x) => x.month));
    const cur = new Date(c.onboardDate.getFullYear(), c.onboardDate.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cur <= end) {
      const month = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      if (!have.has(month)) {
        const seq = (seqByMonth.get(month) ?? 0) + 1;
        seqByMonth.set(month, seq);
        toCreate.push({ clientId: c.id, number: `INV-${month}-${String(seq).padStart(4, "0")}`, month, amount: c.monthlyRetainer, status: "PENDING" });
      }
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  if (toCreate.length) await prisma.invoice.createMany({ data: toCreate });
  revalidatePath("/billing", "layout");
}

// Open a month's invoice — create it (unpaid) if it doesn't exist yet — then go to it.
export async function viewMonthInvoice(fd: FormData) {
  const clientId = s(fd, "clientId");
  const month = s(fd, "month");
  if (!clientId || !month) return;
  let inv = await prisma.invoice.findUnique({ where: { clientId_month: { clientId, month } } });
  if (!inv) {
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { monthlyRetainer: true } });
    const seq = (await prisma.invoice.count({ where: { month } })) + 1;
    inv = await prisma.invoice.create({
      data: { clientId, month, number: `INV-${month}-${String(seq).padStart(4, "0")}`, amount: client?.monthlyRetainer ?? 0, status: "PENDING" },
    });
  }
  redirect(`/billing/invoice/${inv.id}`);
}

// One-click: mark a client's month paid/unpaid. Creates the invoice if needed.
export async function toggleMonthPayment(fd: FormData) {
  const clientId = s(fd, "clientId");
  const month = s(fd, "month");
  if (!clientId || !month) return;

  const existing = await prisma.invoice.findUnique({ where: { clientId_month: { clientId, month } } });
  if (existing) {
    const paid = existing.status !== "PAID";
    await prisma.invoice.update({ where: { id: existing.id }, data: { status: paid ? "PAID" : "PENDING", paidAt: paid ? new Date() : null } });
  } else {
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { monthlyRetainer: true } });
    if (!client) return;
    const seq = (await prisma.invoice.count({ where: { month } })) + 1;
    await prisma.invoice.create({
      data: { clientId, month, number: `INV-${month}-${String(seq).padStart(4, "0")}`, amount: client.monthlyRetainer, status: "PAID", paidAt: new Date() },
    });
  }
  revalidatePath("/billing", "layout");
}

export async function setInvoicePaid(fd: FormData) {
  const id = s(fd, "id");
  const paid = s(fd, "paid") === "true";
  if (id) await prisma.invoice.update({ where: { id }, data: { status: paid ? "PAID" : "PENDING", paidAt: paid ? new Date() : null } });
  revalidatePath("/billing", "layout");
}

// ---- Meta Ads daily campaign entry (AM) ----
export async function saveClientCampaigns(fd: FormData) {
  const clientId = s(fd, "clientId");
  const date = s(fd, "date");
  if (!clientId || !date) throw new Error("Client and date are required");

  const active = (s(fd, "active") || "").split(",").filter(Boolean); // selected campaign types
  const TYPES = ["LEAD", "CALLS", "WHATSAPP", "AWARENESS", "SALE"];

  for (const type of TYPES) {
    if (active.includes(type)) {
      const data = {
        results: n(fd, `${type}_results`),
        spent: n(fd, `${type}_spent`),
        conversions: n(fd, `${type}_conversions`),
        saleValue: n(fd, `${type}_saleValue`),
        ordersConverted: n(fd, `${type}_ordersConverted`),
      };
      await prisma.campaignEntry.upsert({
        where: { clientId_date_type: { clientId, date, type } },
        update: data,
        create: { clientId, date, type, ...data },
      });
    } else {
      // campaign deselected → remove any existing entry for this date
      await prisma.campaignEntry.deleteMany({ where: { clientId, date, type } });
    }
  }
  revalidatePath("/ads");
}

function prevDay(date: string) {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function copyAdsYesterday(fd: FormData) {
  const date = s(fd, "date"); const amId = s(fd, "amId");
  if (!date) return;
  const yKey = prevDay(date);
  const clients = await prisma.client.findMany({ where: { status: { not: "UPCOMING" }, ...(amId ? { accountManagerId: amId } : {}) }, select: { id: true } });
  const ids = clients.map((c) => c.id);
  const yEntries = await prisma.campaignEntry.findMany({ where: { clientId: { in: ids }, date: yKey } });
  for (const e of yEntries) {
    const exists = await prisma.campaignEntry.findUnique({ where: { clientId_date_type: { clientId: e.clientId, date, type: e.type } } });
    if (!exists) await prisma.campaignEntry.create({ data: { clientId: e.clientId, date, type: e.type, results: 0, spent: 0, conversions: 0, saleValue: 0, ordersConverted: 0 } });
  }
  revalidatePath("/ads");
}

export async function copySmoYesterday(fd: FormData) {
  const date = s(fd, "date"); const amId = s(fd, "amId");
  if (!date) return;
  const yKey = prevDay(date);
  const clients = await prisma.client.findMany({ where: { status: { not: "UPCOMING" }, ...(amId ? { accountManagerId: amId } : {}) }, select: { id: true } });
  const ids = clients.map((c) => c.id);
  const yPosts = await prisma.socialPost.findMany({ where: { clientId: { in: ids }, date: yKey } });
  for (const p of yPosts) {
    const already = await prisma.socialPost.count({ where: { clientId: p.clientId, date } });
    if (already > 0) continue; // don't duplicate if today already has posts for this client
    await prisma.socialPost.create({ data: { clientId: p.clientId, date, platform: p.platform, postType: p.postType, link: "", status: "SCHEDULED", slot: p.slot } });
  }
  revalidatePath("/smo");
}

export async function saveClientPosts(fd: FormData) {
  const clientId = s(fd, "clientId");
  const date = s(fd, "date");
  if (!clientId || !date) throw new Error("Client and date are required");

  type P = { platform: string; postType: string; link: string; status: string };
  let posts: P[] = [];
  try { posts = JSON.parse(s(fd, "payload") || "[]"); } catch { posts = []; }

  // replace all of this client's posts for the day
  await prisma.socialPost.deleteMany({ where: { clientId, date } });
  if (posts.length) {
    await prisma.socialPost.createMany({
      data: posts.map((p, i) => ({
        clientId, date,
        platform: p.platform,
        postType: p.postType || "Post",
        link: p.link || "",
        status: p.status === "POSTED" ? "POSTED" : "SCHEDULED",
        slot: i,
      })),
    });
  }
  revalidatePath("/smo");
}

function localDayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function clockIn() {
  const u = await getCurrentUser();
  if (!u) return;
  const open = await prisma.timeSession.findFirst({ where: { userId: u.id, endedAt: null } });
  if (open) return; // already clocked in
  await prisma.timeSession.create({ data: { userId: u.id, date: localDayKey() } });
  revalidatePath("/", "layout");
}

export async function clockOut() {
  const u = await getCurrentUser();
  if (!u) return;
  const open = await prisma.timeSession.findFirst({ where: { userId: u.id, endedAt: null }, orderBy: { startedAt: "desc" } });
  if (!open) return;
  const now = new Date();
  const seconds = Math.max(0, Math.round((now.getTime() - open.startedAt.getTime()) / 1000));
  await prisma.timeSession.update({ where: { id: open.id }, data: { endedAt: now, seconds } });
  revalidatePath("/", "layout");
}

export async function addClientContact(fd: FormData) {
  const clientId = s(fd, "clientId");
  const name = s(fd, "name");
  if (!clientId || !name) return;
  await prisma.clientContact.create({
    data: { clientId, name, role: s(fd, "role"), phone: s(fd, "phone"), email: s(fd, "email") },
  });
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteClientContact(fd: FormData) {
  if (!(await isAdmin())) return;
  const id = s(fd, "id");
  const clientId = s(fd, "clientId");
  if (id) await prisma.clientContact.delete({ where: { id } });
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

export async function setRenewalDate(fd: FormData) {
  const clientId = s(fd, "clientId");
  if (!clientId) return;
  await prisma.client.update({ where: { id: clientId }, data: { renewalDate: s(fd, "renewalDate") } });
  revalidatePath(`/clients/${clientId}`);
}

// ---- Task assignment (head → team member) ----
const ASSIGNER = ["SUPER_ADMIN", "SUB_ADMIN", "AM_HEAD", "SEO_HEAD", "DEV_HEAD"];

export async function createTask(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !ASSIGNER.includes(me.role)) redirect("/");
  const title = s(fd, "title");
  const assignedToId = s(fd, "assignedToId");
  if (!title || !assignedToId) return;
  await prisma.task.create({
    data: {
      title, detail: s(fd, "detail"),
      assignedById: me!.id, assignedToId,
      clientId: s(fd, "clientId") || null,
      priority: s(fd, "priority") || "MEDIUM",
      dueDate: s(fd, "dueDate"),
    },
  });
  revalidatePath("/tasks");
  if (s(fd, "redirectTo") === "1") redirect("/tasks");
}

// Any team member can add a task for THEMSELVES (a personal to-do), no assigner role needed.
export async function createMyTask(fd: FormData) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const title = s(fd, "title");
  if (!title) redirect("/tasks");
  await prisma.task.create({
    data: {
      title, detail: s(fd, "detail"),
      assignedById: me.id, assignedToId: me.id,
      clientId: s(fd, "clientId") || null,
      priority: s(fd, "priority") || "MEDIUM",
      dueDate: s(fd, "dueDate"),
      seen: true, // self-created, so it's not "new"
    },
  });
  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function setTaskStatus(fd: FormData) {
  const me = await getCurrentUser();
  if (!me) return;
  const id = s(fd, "id");
  const status = s(fd, "status");
  if (!id || !status) return;
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t) return;
  // only the assignee or an assigner can change status
  if (t.assignedToId !== me.id && !ASSIGNER.includes(me.role)) return;
  await prisma.task.update({ where: { id }, data: { status, seen: true } });
  revalidatePath("/tasks");
}

export async function markTaskSeen(fd: FormData) {
  const id = s(fd, "id");
  if (id) await prisma.task.update({ where: { id }, data: { seen: true } }).catch(() => {});
  revalidatePath("/tasks");
}

export async function deleteTask(fd: FormData) {
  const me = await getCurrentUser();
  if (!me || !ASSIGNER.includes(me.role)) return;
  const id = s(fd, "id");
  if (id) await prisma.task.delete({ where: { id } });
  revalidatePath("/tasks");
}

export async function approveUpdate(fd: FormData) {
  const id = s(fd, "id");
  if (id) await prisma.workUpdate.update({ where: { id }, data: { status: "APPROVED" } });
  revalidatePath("/approvals");
  revalidatePath("/updates");
}

export async function rejectUpdate(fd: FormData) {
  const id = s(fd, "id");
  if (id) await prisma.workUpdate.update({ where: { id }, data: { status: "IN_PROGRESS" } });
  revalidatePath("/approvals");
  revalidatePath("/updates");
}

export async function createDevProject(fd: FormData) {
  const name = s(fd, "name");
  if (!name) throw new Error("Project name is required");
  await prisma.devProject.create({
    data: {
      name,
      clientId: s(fd, "clientId") || null,
      assignedToId: s(fd, "assignedToId") || null,
      projectType: s(fd, "projectType") || "WEBSITE",
      platform: s(fd, "platform") || "WORDPRESS",
      status: s(fd, "status") || "PLANNING",
      priority: s(fd, "priority") || "MEDIUM",
      progress: Math.max(0, Math.min(100, n(fd, "progress"))),
      dueDate: s(fd, "dueDate"),
      liveUrl: s(fd, "liveUrl"),
      repoUrl: s(fd, "repoUrl"),
      notes: s(fd, "notes"),
    },
  });
  revalidatePath("/projects");
  if (s(fd, "redirectTo") === "1") redirect("/projects");
}

async function actorName() {
  const u = await getCurrentUser();
  return u?.name ?? "Someone";
}
const STATUS_LABEL: Record<string, string> = { PLANNING: "Planning", IN_PROGRESS: "In Progress", REVIEW: "Review", LIVE: "Live", ON_HOLD: "On Hold" };

export async function updateDevProject(fd: FormData) {
  const id = s(fd, "id");
  if (!id) throw new Error("Project id is required");
  const before = await prisma.devProject.findUnique({ where: { id }, include: { client: true } });
  const status = s(fd, "status") || "PLANNING";
  const progress = Math.max(0, Math.min(100, n(fd, "progress")));
  // assignment: a form may carry assignedToId (Website Head / Super Admin assigning a developer)
  const hasAssignee = fd.has("assignedToId");
  const newAssignee = s(fd, "assignedToId") || null;
  const assigningNow = hasAssignee && newAssignee && newAssignee !== before?.assignedToId;
  await prisma.devProject.update({
    where: { id },
    data: {
      status: assigningNow && (status === "UNASSIGNED" || before?.status === "UNASSIGNED") ? "ASSIGNED" : status,
      priority: s(fd, "priority") || "MEDIUM", progress, liveUrl: s(fd, "liveUrl"), repoUrl: s(fd, "repoUrl"), notes: s(fd, "notes"),
      ...(hasAssignee ? { assignedToId: newAssignee } : {}),
    },
  });
  const actor = await actorName();
  if (assigningNow) {
    const dev = await prisma.user.findUnique({ where: { id: newAssignee! }, select: { name: true } });
    await prisma.devActivity.create({ data: { projectId: id, actor, message: `assigned to ${dev?.name ?? "developer"}` } });
    // notify the developer, the Website Head and Super Admin
    await notify(newAssignee!, `New website project assigned: ${before?.name ?? "Project"}`, `${before?.client?.name ?? ""} · assigned by ${actor}`.trim(), "/projects", "violet");
    const heads = await prisma.user.findMany({ where: { role: { in: ["DEV_HEAD", "SUPER_ADMIN"] }, active: true }, select: { id: true } });
    await Promise.all(heads.map((h) => notify(h.id, `Website project assigned: ${before?.name ?? "Project"}`, `Assigned to ${dev?.name ?? "developer"}`, "/projects", "emerald")));
  } else if (before && before.status !== status) {
    await prisma.devActivity.create({ data: { projectId: id, actor, message: `moved to ${STATUS_LABEL[status] ?? status}` } });
  } else if (before && before.progress !== progress) {
    await prisma.devActivity.create({ data: { projectId: id, actor, message: `updated progress to ${progress}%` } });
  }
  revalidatePath("/projects");
}

export async function deleteDevProject(fd: FormData) {
  if (!(await isAdmin())) return;
  const id = s(fd, "id");
  if (id) await prisma.devProject.delete({ where: { id } });
  revalidatePath("/projects");
}

// ---- sub-tasks / checklist ----
async function syncProgressFromTasks(projectId: string) {
  const tasks = await prisma.devTask.findMany({ where: { projectId } });
  if (tasks.length === 0) return;
  const pct = Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
  await prisma.devProject.update({ where: { id: projectId }, data: { progress: pct } });
}

export async function addDevTask(fd: FormData) {
  const projectId = s(fd, "projectId");
  const title = s(fd, "title");
  if (!projectId || !title) return;
  const count = await prisma.devTask.count({ where: { projectId } });
  await prisma.devTask.create({ data: { projectId, title, slot: count } });
  await syncProgressFromTasks(projectId);
  revalidatePath("/projects");
}

export async function toggleDevTask(fd: FormData) {
  const id = s(fd, "id");
  if (!id) return;
  const t = await prisma.devTask.findUnique({ where: { id } });
  if (!t) return;
  await prisma.devTask.update({ where: { id }, data: { done: !t.done } });
  await syncProgressFromTasks(t.projectId);
  if (!t.done) await prisma.devActivity.create({ data: { projectId: t.projectId, actor: await actorName(), message: `completed “${t.title}”` } });
  revalidatePath("/projects");
}

export async function deleteDevTask(fd: FormData) {
  const id = s(fd, "id");
  if (!id) return;
  const t = await prisma.devTask.findUnique({ where: { id } });
  if (!t) return;
  await prisma.devTask.delete({ where: { id } });
  await syncProgressFromTasks(t.projectId);
  revalidatePath("/projects");
}

// ---- client share link ----
export async function toggleDevShare(fd: FormData) {
  const id = s(fd, "id");
  if (!id) return;
  const p = await prisma.devProject.findUnique({ where: { id } });
  if (!p) return;
  const shareId = p.shareId ? "" : `s_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  await prisma.devProject.update({ where: { id }, data: { shareId } });
  revalidatePath("/projects");
}

// ---- Ads performance entry ----
export async function upsertAds(fd: FormData) {
  const clientId = s(fd, "clientId");
  const platform = s(fd, "platform");
  const month = s(fd, "month") || "2026-08";
  if (!clientId || !platform) throw new Error("Client and platform are required");

  const spend = n(fd, "spend");
  const leads = n(fd, "leads");
  const clicks = n(fd, "clicks");
  const impressions = n(fd, "impressions");
  const conversions = n(fd, "conversions");
  const ctr = impressions ? +((clicks / impressions) * 100).toFixed(2) : 0;
  const cpl = leads ? +(spend / leads).toFixed(0) : 0;

  await prisma.adsPerformance.upsert({
    where: { clientId_month_platform: { clientId, month, platform } },
    update: { spend, leads, clicks, impressions, conversions, ctr, cpl },
    create: { clientId, month, platform, spend, leads, clicks, impressions, conversions, ctr, cpl },
  });

  revalidatePath("/ads");
  revalidatePath(`/clients/${clientId}`);
}
