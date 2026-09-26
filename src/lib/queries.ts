import { prisma } from "./prisma";
import { COMPLETING_STATUSES, healthBand, serviceKind, SALES_STAGE_KEYS } from "./domain";
import { resolvePeriod, now, type PeriodKey } from "./period";

// workType -> service + whether it counts toward agreed deliverables
const WORKTYPE_SERVICE: Record<string, "SEO" | "SMO" | "VIDEO"> = {
  blog: "SEO",
  static: "SMO",
  carousel: "SMO",
  reel: "SMO",
  aiVideo: "VIDEO",
  reelEdit: "VIDEO",
};
// deliverable metrics that count as "agreed units" (keywords excluded — it's a target)
const COUNTABLE_METRICS = new Set(["blogs", "static", "carousel", "reels", "aiVideos", "reelsEdit"]);
const METRIC_SERVICE: Record<string, "SEO" | "SMO" | "VIDEO"> = {
  blogs: "SEO", static: "SMO", carousel: "SMO", reels: "SMO", aiVideos: "VIDEO", reelsEdit: "VIDEO",
};

const isComplete = (s: string) => (COMPLETING_STATUSES as string[]).includes(s);

export type Range = { start: Date; end: Date };

function agreedForClient(deliverables: { metric: string; agreed: number }[]) {
  const byService = { SEO: 0, SMO: 0, VIDEO: 0 };
  let total = 0;
  for (const d of deliverables) {
    if (!COUNTABLE_METRICS.has(d.metric)) continue;
    byService[METRIC_SERVICE[d.metric]] += d.agreed;
    total += d.agreed;
  }
  return { total, byService };
}

function completedForClient(updates: { workType: string; status: string; quantity: number }[]) {
  const byService = { SEO: 0, SMO: 0, VIDEO: 0 };
  let total = 0;
  let pending = 0;
  for (const u of updates) {
    const svc = WORKTYPE_SERVICE[u.workType];
    if (!svc) continue;
    if (isComplete(u.status)) {
      byService[svc] += u.quantity;
      total += u.quantity;
    } else if (u.status === "PENDING_APPROVAL" || u.status === "IN_PROGRESS") {
      pending += u.quantity;
    }
  }
  return { total, byService, pending };
}

/** Everything the agency dashboard needs, computed for a period. */
export async function getDashboard(periodKey: PeriodKey = "month", from?: string, to?: string) {
  const { start, end, factor } = resolvePeriod(periodKey, from, to);
  const nowD0 = now();
  const monthPrefix = `${nowD0.getFullYear()}-${String(nowD0.getMonth() + 1).padStart(2, "0")}`;
  const lm = new Date(nowD0.getFullYear(), nowD0.getMonth() - 1, 1);
  const lastMonthPrefix = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, "0")}`;
  const clients = await prisma.client.findMany({
    include: {
      accountManager: true,
      services: true,
      deliverables: true,
      assignments: { include: { user: true } },
      updates: { where: { date: { gte: start, lte: end } } },
      campaigns: { where: { date: { startsWith: monthPrefix } } },
    },
    orderBy: { code: "asc" },
  });

  const totals = { clients: clients.length, active: 0, onHold: 0, upcoming: 0 };
  const smo = { agreed: 0, done: 0, static: [0, 0], carousel: [0, 0], reels: [0, 0] };
  const video = { aiAgreed: 0, aiDone: 0, reelsAgreed: 0, reelsDone: 0 };
  const dept = {
    SEO: { done: 0, agreed: 0, overdue: 0 }, DESIGN: { done: 0, agreed: 0, overdue: 0 },
    VIDEO: { done: 0, agreed: 0, overdue: 0 }, ACCOUNT: { done: 0, agreed: 0, overdue: 0 },
  };
  const health = { on_track: 0, attention: 0, critical: 0 };
  const healthNames: Record<string, string[]> = { on_track: [], attention: [], critical: [] };
  let budget = 0;
  let pendingApproval = 0;
  const urgent: { name: string; pending: number; am: string }[] = [];
  const trendMap = new Map<string, number>(); // dateKey -> completed count
  const clientDeptAgreed = new Map<string, { SEO: number; DESIGN: number; VIDEO: number }>();
  const WT_DEPT: Record<string, "SEO" | "DESIGN" | "VIDEO"> = { blog: "SEO", ranking: "SEO", static: "DESIGN", carousel: "DESIGN", reel: "DESIGN", aiVideo: "VIDEO", reelEdit: "VIDEO" };

  const clientCards = clients.map((c) => {
    if (c.status === "ACTIVE") totals.active++;
    else if (c.status === "ON_HOLD") totals.onHold++;
    else totals.upcoming++;
    budget += c.monthlyRetainer;

    const ag = agreedForClient(c.deliverables);
    const cp = completedForClient(c.updates);
    const scaledAgreed = ag.total; // full monthly target; "done" is period-filtered
    const pct = scaledAgreed > 0 ? Math.min(100, Math.round((cp.total / scaledAgreed) * 100)) : 0;
    clientDeptAgreed.set(c.id, {
      SEO: ag.byService.SEO,
      DESIGN: ag.byService.SMO,
      VIDEO: ag.byService.VIDEO,
    });

    // per-service metric breakdown for SMO/video overviews
    for (const d of c.deliverables) {
      if (d.metric === "static") smo.static[1] += d.agreed;
      if (d.metric === "carousel") smo.carousel[1] += d.agreed;
      if (d.metric === "reels") smo.reels[1] += d.agreed;
      if (d.metric === "aiVideos") video.aiAgreed += d.agreed;
      if (d.metric === "reelsEdit") video.reelsAgreed += d.agreed;
    }
    for (const u of c.updates) {
      if (u.status === "PENDING_APPROVAL") {
        pendingApproval += u.quantity;
        const dp = WT_DEPT[u.workType];
        if (dp) dept[dp].overdue += u.quantity;
      }
      if (!isComplete(u.status)) continue;
      if (u.workType === "static") smo.static[0] += u.quantity;
      if (u.workType === "carousel") smo.carousel[0] += u.quantity;
      if (u.workType === "reel") smo.reels[0] += u.quantity;
      if (u.workType === "aiVideo") video.aiDone += u.quantity;
      if (u.workType === "reelEdit") video.reelsDone += u.quantity;
      const key = u.date.toISOString().slice(0, 10);
      trendMap.set(key, (trendMap.get(key) ?? 0) + u.quantity);
    }

    dept.SEO.agreed += ag.byService.SEO;
    dept.SEO.done += cp.byService.SEO;
    dept.DESIGN.agreed += ag.byService.SMO;
    dept.DESIGN.done += cp.byService.SMO;
    dept.VIDEO.agreed += ag.byService.VIDEO;
    dept.VIDEO.done += cp.byService.VIDEO;
    dept.ACCOUNT.agreed += scaledAgreed;
    dept.ACCOUNT.done += cp.total;

    const band = healthBand(pct);
    if (c.status !== "UPCOMING") {
      health[band.key as keyof typeof health]++;
      healthNames[band.key].push(c.name);
    }

    if (cp.pending >= 6 && c.status === "ACTIVE") {
      urgent.push({ name: c.name, pending: cp.pending, am: c.accountManager?.name ?? "—" });
    }

    // this-month Meta Ads for this client
    let adSpend = 0, adLeads = 0;
    for (const e of c.campaigns) { adSpend += e.spent; if (e.type === "LEAD" || e.type === "CALLS" || e.type === "WHATSAPP") adLeads += e.results; }

    return {
      id: c.id, code: c.code, name: c.name, status: c.status,
      industry: c.industry, website: c.website,
      pocName: c.pocName, pocMobile: c.pocMobile,
      am: c.accountManager?.name ?? null,
      retainer: c.monthlyRetainer,
      services: c.services.map((s) => s.service),
      team: c.assignments.filter((a) => a.department !== "ACCOUNT").map((a) => a.user.name),
      agreed: scaledAgreed, completed: cp.total, pending: cp.pending, pct,
      postsDone: cp.byService.SMO, postsAgreed: ag.byService.SMO,
      videosDone: cp.byService.VIDEO, videosAgreed: ag.byService.VIDEO,
      adSpend, adLeads,
      band,
    };
  });

  // per-AM client counts (for the Total Clients card chips + filter pills)
  const amCounts = new Map<string, number>();
  for (const c of clientCards) if (c.am) amCounts.set(c.am, (amCounts.get(c.am) ?? 0) + 1);
  const amList = [...amCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  smo.agreed = smo.static[1] + smo.carousel[1] + smo.reels[1];
  smo.done = smo.static[0] + smo.carousel[0] + smo.reels[0];

  urgent.sort((a, b) => b.pending - a.pending);

  // upcoming deadlines — active clients with pending work, due end of month
  const nowD = now();
  const monthEnd = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 0);
  const daysLeft = Math.max(0, Math.ceil((monthEnd.getTime() - nowD.getTime()) / 86400000));
  const behind = clientCards
    .map((c) => ({ ...c, remaining: Math.max(0, c.agreed - c.completed) }))
    .filter((c) => c.status === "ACTIVE" && c.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);
  const deadlines = behind.slice(0, 6).map((c) => ({
    id: c.id, name: c.name, pending: c.remaining, delivered: c.completed, total: c.agreed, daysLeft, due: monthEnd,
  }));
  const urgentWork = { total: behind.reduce((s, c) => s + c.remaining, 0), clients: behind.length, top: behind.slice(0, 3).map((c) => ({ id: c.id, name: c.name, pending: c.remaining })) };

  // daily output trend across the period (completed units per day)
  const trend: { key: string; label: string; value: number }[] = [];
  const cursor = new Date(start);
  const last = end < now() ? end : now();
  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10);
    trend.push({ key, label: `${cursor.getDate()}`, value: trendMap.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  // team workload (per user, this period)
  const users = await prisma.user.findMany({
    include: {
      _count: { select: { managedClients: true } },
      updates: { where: { date: { gte: start, lte: end }, status: { in: COMPLETING_STATUSES as string[] } } },
      assignments: true,
    },
  });
  const ROLE_DEPT: Record<string, "SEO" | "DESIGN" | "VIDEO" | null> = { SEO: "SEO", SEO_HEAD: "SEO", DESIGNER: "DESIGN", EDITOR: "VIDEO" };
  const team = users
    .filter((u) => !["SUPER_ADMIN", "SUB_ADMIN", "AM_HEAD", "ACCOUNT_MANAGER", "DM_EXEC"].includes(u.role))
    .map((u) => {
      const dept = ROLE_DEPT[u.role];
      const clientIds = new Set(u.assignments.map((a) => a.clientId));
      let target = 0;
      if (dept) for (const cid of clientIds) target += clientDeptAgreed.get(cid)?.[dept] ?? 0;
      return { id: u.id, name: u.name, role: u.role, dept, done: u.updates.length, clients: clientIds.size, target };
    })
    .sort((a, b) => b.target - a.target);

  // recent activity
  const recent = await prisma.workUpdate.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: "desc" }, take: 8,
    include: { client: true, user: true },
  });

  // agency-wide Meta Ads (this month) + daily spend trend + MoM delta
  let adsSpend = 0, adsLeads = 0, adsConv = 0;
  const spendByDay = new Map<string, number>();
  for (const c of clients) for (const e of c.campaigns) {
    adsSpend += e.spent; adsConv += e.conversions;
    if (e.type === "LEAD" || e.type === "CALLS" || e.type === "WHATSAPP") adsLeads += e.results;
    spendByDay.set(e.date, (spendByDay.get(e.date) ?? 0) + e.spent);
  }
  const adsTrend = [...spendByDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, v]) => ({ label: d.slice(8), value: v }));
  const lmAgg = await prisma.campaignEntry.aggregate({ _sum: { spent: true }, where: { date: { startsWith: lastMonthPrefix } } });
  const lastMonthSpend = lmAgg._sum.spent ?? 0;
  const ads = {
    spend: adsSpend, leads: adsLeads, conversions: adsConv,
    cpl: adsLeads ? Math.round(adsSpend / adsLeads) : 0,
    trend: adsTrend, lastMonthSpend,
    spendDelta: lastMonthSpend ? Math.round(((adsSpend - lastMonthSpend) / lastMonthSpend) * 100) : 0,
  };

  return {
    period: periodKey, range: { start, end }, factor,
    totals, smo, video, dept, health, healthNames, budget, ads,
    urgent: urgent.slice(0, 5),
    clients: clientCards, team,
    recent: recent.map((r) => ({
      id: r.id, client: r.client.name, user: r.user.name,
      workType: r.workType, status: r.status, date: r.date,
    })),
    avgRetainer: clients.length ? Math.round(budget / clients.length) : 0,
    highest: clientCards.reduce((a, b) => (b.retainer > (a?.retainer ?? -1) ? b : a), clientCards[0]),
    lowest: clientCards.reduce((a, b) => (b.retainer < (a?.retainer ?? Infinity) ? b : a), clientCards[0]),
    trend, deadlines, amList, pendingApproval, urgentWork,
  };
}

export async function getClientsList() {
  const d = await getDashboard("month");
  return d.clients;
}

// --- Time tracking ---
function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getMyClock(userId: string) {
  const today = dayKey();
  const [open, sessions] = await Promise.all([
    prisma.timeSession.findFirst({ where: { userId, endedAt: null } }),
    prisma.timeSession.findMany({ where: { userId, date: today } }),
  ]);
  const nowMs = Date.now();
  const todaySeconds = sessions.reduce((s, t) => s + (t.endedAt ? t.seconds : Math.round((nowMs - t.startedAt.getTime()) / 1000)), 0);
  return { open: open ? { startedAt: open.startedAt.toISOString() } : null, todaySeconds };
}

// Per-employee hours + output for a day — the daily report for admin & heads.
export async function getWorkTracking(date?: string, teamDept?: string) {
  const day = date ?? dayKey();
  const dayStart = new Date(day + "T00:00:00");
  const dayEnd = new Date(day + "T23:59:59");
  const DEPT_ROLES: Record<string, string[]> = {
    SEO: ["SEO", "SEO_HEAD"], DESIGN: ["DESIGNER"], VIDEO: ["EDITOR"],
    DEV: ["WEB_DEV", "DEV_HEAD"], ACCOUNT: ["ACCOUNT_MANAGER", "AM_HEAD", "DM_EXEC"],
  };
  const roleFilter = teamDept && DEPT_ROLES[teamDept] ? { role: { in: DEPT_ROLES[teamDept] } } : { role: { not: "SUPER_ADMIN" } };

  const [users, sessions, updates] = await Promise.all([
    prisma.user.findMany({ where: { active: true, ...roleFilter }, orderBy: [{ role: "asc" }, { name: "asc" }] }),
    prisma.timeSession.findMany({ where: { date: day } }),
    prisma.workUpdate.findMany({ where: { date: { gte: dayStart, lte: dayEnd } }, include: { client: true } }),
  ]);

  const nowMs = Date.now();
  const rows = users.map((u) => {
    const mine = sessions.filter((s) => s.userId === u.id);
    const seconds = mine.reduce((s, t) => s + (t.endedAt ? t.seconds : Math.round((nowMs - t.startedAt.getTime()) / 1000)), 0);
    const myUpdates = updates.filter((x) => x.userId === u.id);
    const done = myUpdates.filter((x) => x.status === "COMPLETED" || x.status === "APPROVED").reduce((s, x) => s + x.quantity, 0);
    return {
      id: u.id, name: u.name, role: u.role,
      seconds, active: mine.some((s) => !s.endedAt), sessions: mine.length,
      updates: myUpdates.length, done,
      items: myUpdates.slice(0, 8).map((x) => ({ workType: x.workType, quantity: x.quantity, client: x.client.name, status: x.status })),
    };
  });

  const totalSeconds = rows.reduce((s, r) => s + r.seconds, 0);
  const activeNow = rows.filter((r) => r.active).length;
  return { day, rows, totalSeconds, activeNow, totalUpdates: updates.length };
}

// SEO console — per-client monthly deliverables for the SEO team.
const SEO_BOARD_MONTHS = ["2026-08", "2026-07", "2026-06"];
const mLabelOf = (k: string) => new Date(k + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" });
// Real SEO clients from the team's master sheet carry codes SEO-xxx.
const seoClientWhere = (userId: string, isHead: boolean) => ({
  code: { startsWith: "SEO-" },
  ...(isHead ? {} : { assignments: { some: { userId, department: "SEO" } } }),
});

// ---- SEO employee's own dashboard (their personal home) — scoped to their work only ----
export async function getSeoEmployeeDashboard(userId: string, role: string, monthIn?: string) {
  const selMonth = monthIn && SEO_BOARD_MONTHS.includes(monthIn) ? monthIn : SEO_BOARD_MONTHS[0];
  const isHead = role === "SEO_HEAD";
  const me = await prisma.user.findUnique({ where: { id: userId } });
  const myName = me?.name ?? "";
  const clients = await prisma.client.findMany({
    where: seoClientWhere(userId, isHead),
    include: {
      accountManager: true,
      assignments: { where: { department: "SEO" }, include: { user: true } },
      seoBlogSlots: { where: { month: selMonth } },
      seoReports: { where: { month: selMonth } },
    },
    orderBy: { code: "asc" },
  });

  const DOTS = ["#8b5cf6", "#14b8a6", "#ef4444", "#f97316", "#3b82f6", "#84cc16", "#a855f7", "#06b6d4"];
  // pipeline stage per slot (mirrors the sheet's Blog → Image → Website flow)
  const slotStage = (b: { blog: string; image: string; web: string }) =>
    b.web === "LIVE" ? "live" : b.image === "DONE" ? "image" : b.blog === "PUBLISHED" ? "written" : "pending";
  let blogsWritten = 0, blogsTarget = 0, imagesDone = 0, webLive = 0;
  let toWrite = 0, toImage = 0, toPublish = 0;
  const rows = clients.map((c, i) => {
    const slots = [...c.seoBlogSlots].sort((a, b) => a.slot - b.slot);
    const written = slots.filter((b) => b.blog === "PUBLISHED").length;
    const images = slots.filter((b) => b.image === "DONE").length;
    const live = slots.filter((b) => b.web === "LIVE").length;
    const target = c.blogTarget || slots.length;
    // actionable pipeline counts
    const cWrite = slots.filter((b) => b.blog !== "PUBLISHED").length;
    const cImage = slots.filter((b) => b.blog === "PUBLISHED" && b.image !== "DONE").length;
    const cPublish = slots.filter((b) => b.blog === "PUBLISHED" && b.web !== "LIVE").length;
    blogsWritten += written; blogsTarget += target; imagesDone += images; webLive += live;
    toWrite += cWrite; toImage += cImage; toPublish += cPublish;
    const pct = target ? Math.round((written / target) * 100) : 0;
    const dots = slots.map(slotStage);
    return {
      id: c.id, name: c.name, dot: DOTS[i % DOTS.length], priority: c.seoPriority || "",
      schedule: c.seoScheduleDays, am: c.accountManager?.name ?? "—",
      writer: slots.find((s) => s.writer)?.writer ?? "",
      target, written, images, live, dots, pending: Math.max(0, target - written),
      toWrite: cWrite, toImage: cImage, toPublish: cPublish,
      backlinkTarget: c.backlinkTarget, keywordTarget: c.keywordTarget, pct,
      done: pct >= 100 && target > 0,
    };
  });
  rows.sort((a, b) => (a.done === b.done ? a.pct - b.pct : a.done ? 1 : -1)); // unfinished first

  // reports the employee owes this month (their clients, not yet SENT)
  const reportsDue = clients
    .flatMap((c) => c.seoReports.map((r) => ({ clientId: c.id, client: c.name, reportDate: r.reportDate, status: r.status, gscDone: r.gscDone, gaDone: r.gaDone })))
    .filter((r) => r.status !== "SENT");
  const reportsSent = clients.flatMap((c) => c.seoReports).filter((r) => r.status === "SENT").length;

  // GMB locations owned by this employee (by name)
  const gmbRows = await prisma.gmbClient.findMany({ where: { active: true, assigned: myName }, orderBy: { name: "asc" } });
  const gmbPosts = gmbRows.reduce((s, r) => s + r.monthlyPosts, 0);
  const gmbDone = gmbRows.reduce((s, r) => s + r.postsDone, 0);

  const clientsDone = rows.filter((r) => r.done).length;
  const overallPct = blogsTarget ? Math.round((blogsWritten / blogsTarget) * 100) : 0;
  const imagesPct = blogsTarget ? Math.round((imagesDone / blogsTarget) * 100) : 0;
  const webPct = blogsTarget ? Math.round((webLive / blogsTarget) * 100) : 0;

  return {
    name: myName, isHead, month: selMonth,
    months: SEO_BOARD_MONTHS.map((k) => ({ key: k, label: mLabelOf(k) })),
    monthLabel: mLabelOf(selMonth),
    kpis: {
      clients: rows.length, clientsDone,
      blogsWritten, blogsTarget, blogsPending: Math.max(0, blogsTarget - blogsWritten),
      imagesDone, webLive, overallPct, imagesPct, webPct,
      toWrite, toImage, toPublish,
      reportsDue: reportsDue.length, reportsSent,
      totalActions: toWrite + toImage + toPublish + reportsDue.length,
    },
    rows,
    reportsDue,
    gmb: { rows: gmbRows.map((r) => ({ id: r.id, name: r.name, monthlyPosts: r.monthlyPosts, postsDone: r.postsDone, lastPostDate: r.lastPostDate })), posts: gmbPosts, done: gmbDone, count: gmbRows.length },
  };
}

// ---- Full SEO employee board (matches the uploaded WebRocz SEO Dashboard design) ----
function timeAgo(d: Date) {
  const ms = now().getTime() - d.getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}
const CHART_MONTHS = ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];
const blogStatusLabel = (b: string) => (b === "PUBLISHED" ? "Published" : b === "REVIEW" ? "Pending Review" : "Draft");
export async function getSeoEmployeeBoard(userId: string, role: string, monthIn?: string) {
  const selMonth = monthIn && SEO_BOARD_MONTHS.includes(monthIn) ? monthIn : SEO_BOARD_MONTHS[0];
  const isHead = role === "SEO_HEAD" || role === "SUPER_ADMIN" || role === "SUB_ADMIN";
  const me = await prisma.user.findUnique({ where: { id: userId } });
  const [clients, amUsers] = await Promise.all([
    prisma.client.findMany({
      where: seoClientWhere(userId, isHead),
      include: {
        accountManager: true,
        assignments: { where: { department: "SEO" }, include: { user: true } },
        seoBlogSlots: { where: { month: selMonth }, orderBy: { slot: "asc" } },
        seoKeywords: { where: { month: selMonth }, orderBy: { slot: "asc" } },
        seoBacklinks: { where: { month: selMonth }, orderBy: { slot: "asc" } },
        seoAnalytics: true,
      },
      orderBy: { code: "asc" },
    }),
    prisma.user.findMany({ where: { active: true, role: { in: ["ACCOUNT_MANAGER", "AM_HEAD", "DM_EXEC"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const prevMonthOf = (m: string) => { const [y, mm] = m.split("-").map(Number); const d = new Date(y, mm - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const prevMonth = prevMonthOf(selMonth);
  const monthShort = (k: string) => new Date(k + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short" });

  let totalWritten = 0, totalTarget = 0;
  const rows = clients.map((c) => {
    const slots = c.seoBlogSlots;
    const written = slots.filter((b) => b.blog === "PUBLISHED").length;
    const target = c.blogTarget || slots.length || 8;
    totalWritten += written; totalTarget += target;
    const pct = target ? Math.round((written / target) * 100) : 0;
    const cur = c.seoAnalytics.find((a) => a.month === selMonth) ?? null;
    const prev = c.seoAnalytics.find((a) => a.month === prevMonth) ?? null;
    const chart = CHART_MONTHS.map((m) => { const a = c.seoAnalytics.find((x) => x.month === m); return { label: monthShort(m), impressions: a?.gscImpressions ?? 0, clicks: a?.gscClicks ?? 0, active: a?.gaUsers ?? 0, organic: a?.gaOrganic ?? 0 }; });
    const lastUpdated = [...slots, ...c.seoKeywords, ...c.seoBacklinks].reduce<Date | null>((mx, r) => (!mx || r.updatedAt > mx ? r.updatedAt : mx), null);
    return {
      id: c.id, name: c.name, industry: c.industry ?? "SEO",
      budget: c.monthlyRetainer, keywordsTarget: c.keywordTarget || 10, poc: c.pocName ?? "",
      am: c.accountManager?.name ?? "—", amId: c.accountManagerId ?? "", seo: c.assignments.map((a) => a.user.name).join(", ") || "—",
      website: c.website ?? "", schedule: c.seoScheduleDays ?? "",
      priority: c.seoPriority || "", pct, written, target,
      backlinkTarget: c.backlinkTarget, backlinksDone: c.seoBacklinks.filter((b) => b.status === "Live").length,
      notes: c.notes ?? "",
      status: pct >= 100 ? "Completed" : pct >= 75 ? "In Review" : pct > 0 ? "In Progress" : "Pending",
      taskType: ["Blogs", "Keywords", "Backlinks", "GSC", "GA4"],
      lastUpdated: lastUpdated ? timeAgo(lastUpdated) : "—",
      blogs: slots.map((b) => ({ id: b.id, slot: b.slot, title: b.title, link: b.link, status: blogStatusLabel(b.blog), date: b.blogDate })),
      keywords: c.seoKeywords.map((k) => ({ id: k.id, keyword: k.keyword, lastPos: k.lastPos, currPos: k.currPos })),
      backlinks: c.seoBacklinks.map((b) => ({ id: b.id, type: b.type, status: b.status, link: b.link, da: b.da, date: b.date })),
      da: c.domainAuthority,
      gsc: cur ? { impressions: cur.gscImpressions, clicks: cur.gscClicks, ctr: cur.gscCtr, position: cur.gscPosition } : { impressions: 0, clicks: 0, ctr: 0, position: 0 },
      gscPrev: prev ? { impressions: prev.gscImpressions, clicks: prev.gscClicks } : null,
      ga: cur ? { active: cur.gaUsers, newUsers: cur.gaNewUsers, organic: cur.gaOrganic, organicSocial: cur.gaOrganicSocial, sessions: cur.gaSessions, bounce: cur.gaBounce, engagement: cur.gaEngagement } : { active: 0, newUsers: 0, organic: 0, organicSocial: 0, sessions: 0, bounce: 0, engagement: "" },
      gaPrev: prev ? { active: prev.gaUsers, organic: prev.gaOrganic } : null,
      monthly: [...c.seoAnalytics].sort((a, b) => a.month.localeCompare(b.month)).map((a) => ({
        month: a.month, label: new Date(a.month + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long" }),
        clicks: a.gscClicks, impressions: a.gscImpressions, ctr: a.gscCtr, position: a.gscPosition,
        active: a.gaUsers, newUsers: a.gaNewUsers, organicSocial: a.gaOrganicSocial, organicSearch: a.gaOrganic,
      })),
      chart,
    };
  });

  const [y, mm] = selMonth.split("-").map(Number);
  const dueDate = new Date(y, mm, 0);
  return {
    name: me?.name ?? "", isHead,
    month: selMonth, months: SEO_BOARD_MONTHS.map((k) => ({ key: k, label: mLabelOf(k) })),
    monthLabel: mLabelOf(selMonth),
    dueLabel: dueDate.toLocaleDateString("en-IN", { month: "short", day: "2-digit" }),
    dueFull: dueDate.toLocaleDateString("en-IN", { month: "short", day: "2-digit", year: "numeric" }),
    activeClients: rows.length,
    overallPct: totalTarget ? Math.round((totalWritten / totalTarget) * 100) : 0,
    amUsers,
    rows,
  };
}

// SEO team leaderboard (Super Admin / SEO Head) — output per SEO exec this month.
export async function getSeoLeaderboard(monthIn?: string) {
  const selMonth = monthIn && SEO_BOARD_MONTHS.includes(monthIn) ? monthIn : SEO_BOARD_MONTHS[0];
  const [execs, clients] = await Promise.all([
    prisma.user.findMany({ where: { active: true, role: { in: ["SEO", "SEO_HEAD"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
    prisma.client.findMany({
      where: { code: { startsWith: "SEO-" } },
      include: {
        assignments: { where: { department: "SEO" } },
        seoBlogSlots: { where: { month: selMonth } },
        seoKeywords: { where: { month: selMonth } },
        seoBacklinks: { where: { month: selMonth } },
      },
    }),
  ]);
  const rows = execs.map((u) => {
    const mine = clients.filter((c) => c.assignments.some((a) => a.userId === u.id));
    let written = 0, target = 0, kwImproved = 0, blLive = 0, onTrack = 0;
    for (const c of mine) {
      const w = c.seoBlogSlots.filter((b) => b.blog === "PUBLISHED").length;
      const t = c.blogTarget || c.seoBlogSlots.length || 8;
      written += w; target += t;
      if (t && w / t >= 1) onTrack++;
      kwImproved += c.seoKeywords.filter((k) => k.lastPos - k.currPos > 0).length;
      blLive += c.seoBacklinks.filter((b) => b.status === "Live").length;
    }
    return { id: u.id, name: u.name, role: u.role, clients: mine.length, written, target, pct: target ? Math.round((written / target) * 100) : 0, onTrack, kwImproved, blLive };
  }).filter((r) => r.clients > 0).sort((a, b) => b.pct - a.pct || b.written - a.written);
  return { month: selMonth, months: SEO_BOARD_MONTHS.map((k) => ({ key: k, label: mLabelOf(k) })), rows };
}

// Account Manager dashboard — Meta + Google Ads overview across the AM's clients (this month).
export async function getAmDashboard(userId: string, role: string) {
  const monthPrefix = "2026-08"; // demo month anchor (matches the ads seed)
  const yesterday = "2026-08-30";
  const isHead = role === "AM_HEAD";
  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE", ...(isHead ? {} : { accountManagerId: userId }) },
    select: {
      id: true, name: true, code: true, industry: true, googleBudget: true,
      accountManager: { select: { name: true } },
      googleCampaigns: { where: { date: { startsWith: monthPrefix } } },
      campaigns: { where: { date: { startsWith: monthPrefix } } },
    },
    orderBy: { code: "asc" },
  });
  let metaSpend = 0, metaLeads = 0, metaSale = 0, gSpend = 0, gLeads = 0, gConv = 0;
  const rows = clients.map((c) => {
    const m = c.campaigns.reduce((a, e) => ({ spend: a.spend + e.spent, leads: a.leads + e.results, sale: a.sale + e.saleValue }), { spend: 0, leads: 0, sale: 0 });
    const g = c.googleCampaigns.reduce((a, e) => ({ spend: a.spend + e.spent, leads: a.leads + e.leads, conv: a.conv + e.conversions }), { spend: 0, leads: 0, conv: 0 });
    metaSpend += m.spend; metaLeads += m.leads; metaSale += m.sale;
    gSpend += g.spend; gLeads += g.leads; gConv += g.conv;
    const hasGoogle = c.googleBudget > 0;
    const hasMeta = c.campaigns.length > 0;
    const gPending = hasGoogle && !c.googleCampaigns.some((e) => e.date === yesterday);
    const gBudgetPct = c.googleBudget ? Math.round((g.spend / c.googleBudget) * 100) : 0;
    return {
      id: c.id, name: c.name, code: c.code, industry: c.industry ?? "—", am: c.accountManager?.name ?? "—",
      metaSpend: m.spend, metaLeads: m.leads, gSpend: g.spend, gLeads: g.leads,
      hasGoogle, hasMeta, gPending, gBudgetPct, budget: c.googleBudget,
    };
  });
  const pending = rows.filter((r) => r.gPending);
  const budgetAlerts = rows.filter((r) => r.hasGoogle && r.gBudgetPct >= 90);
  const totalSpend = metaSpend + gSpend, totalLeads = metaLeads + gLeads;
  return {
    isHead, monthLabel: "August 2026",
    clients: rows.length,
    meta: { spend: metaSpend, leads: metaLeads, roas: metaSpend ? +(metaSale / metaSpend).toFixed(1) : 0 },
    google: { spend: gSpend, leads: gLeads, conv: gConv },
    totalSpend, totalLeads, avgCpl: totalLeads ? Math.round(totalSpend / totalLeads) : 0,
    pending, budgetAlerts,
    rows: [...rows].sort((a, b) => (b.metaSpend + b.gSpend) - (a.metaSpend + a.gSpend)),
  };
}

export async function getSeoBoard(userId: string, role: string, monthIn?: string) {
  const selMonth = monthIn && SEO_BOARD_MONTHS.includes(monthIn) ? monthIn : SEO_BOARD_MONTHS[0];
  const isHead = role === "SEO_HEAD" || role === "SUPER_ADMIN" || role === "SUB_ADMIN";
  const clients = await prisma.client.findMany({
    where: seoClientWhere(userId, isHead),
    include: {
      accountManager: true,
      assignments: { where: { department: "SEO" }, include: { user: true } },
      seoBlogSlots: { where: { month: selMonth } },
    },
    orderBy: { code: "asc" },
  });

  const DOTS = ["#8b5cf6", "#14b8a6", "#ef4444", "#f97316", "#3b82f6", "#84cc16", "#a855f7", "#06b6d4"];
  let blogsWritten = 0, imagesDone = 0, blogsTotal = 0;
  const rows = clients.map((c, i) => {
    const slots = c.seoBlogSlots;
    const written = slots.filter((b) => b.blog === "PUBLISHED").length;
    const images = slots.filter((b) => b.image === "DONE").length;
    const live = slots.filter((b) => b.web === "LIVE").length;
    const target = c.blogTarget || slots.length;
    blogsWritten += written; imagesDone += images; blogsTotal += target;
    const pct = target ? Math.round((written / target) * 100) : 0;
    const status = pct >= 100 ? "APPROVED" : pct >= 75 ? "REVIEW" : pct > 0 ? "IN_PROGRESS" : "PLANNED";
    const am = c.accountManager?.name ?? "—";
    const seo = c.assignments.map((a) => a.user.name).join(", ") || "Unassigned";
    return {
      id: c.id, name: c.name, dot: DOTS[i % DOTS.length],
      priority: c.seoPriority || "—", schedule: c.seoScheduleDays,
      blogs: target, written, images, live, pending: Math.max(0, target - written),
      keywords: c.keywordTarget, backlinks: c.backlinkTarget,
      pct, status, am, seo,
    };
  });

  const overall = blogsTotal ? Math.round((blogsWritten / blogsTotal) * 100) : 0;
  return {
    rows, overall,
    month: selMonth, months: SEO_BOARD_MONTHS.map((k) => ({ key: k, label: mLabelOf(k) })),
    monthLabel: mLabelOf(selMonth),
    kpis: { activeClients: rows.length, blogsPublished: blogsWritten, imagesDone, pctPublished: overall, blogsTotal },
  };
}

// Local SEO / Google Business Profile board — mirrors the GMB tab.
export async function getGmbBoard(userId: string, role: string) {
  const isHead = role === "SEO_HEAD" || role === "SUPER_ADMIN" || role === "SUB_ADMIN";
  const me = isHead ? null : (await prisma.user.findUnique({ where: { id: userId } }))?.name ?? "";
  const rows = await prisma.gmbClient.findMany({
    where: { active: true, ...(isHead ? {} : { assigned: me! }) },
    orderBy: [{ assigned: "asc" }, { name: "asc" }],
  });
  const owners = [...new Set(rows.map((r) => r.assigned).filter(Boolean))].sort();
  const totalPosts = rows.reduce((s, r) => s + r.monthlyPosts, 0);
  const postsDone = rows.reduce((s, r) => s + r.postsDone, 0);
  return {
    rows: rows.map((r) => ({
      id: r.id, name: r.name, assigned: r.assigned, gmbLink: r.gmbLink,
      monthlyPosts: r.monthlyPosts, postsDone: r.postsDone, lastPostDate: r.lastPostDate,
      citations: r.citations, reviews: r.reviews, reviewsNote: r.reviewsNote, localo: r.localo,
    })),
    owners,
    kpis: { locations: rows.length, totalPosts, postsDone, pct: totalPosts ? Math.round((postsDone / totalPosts) * 100) : 0 },
  };
}

// Monthly report-delivery board — mirrors the SEO Reports Data tab.
export async function getSeoReportsBoard(userId: string, role: string, monthIn?: string) {
  const selMonth = monthIn && SEO_BOARD_MONTHS.includes(monthIn) ? monthIn : SEO_BOARD_MONTHS[0];
  const isHead = role === "SEO_HEAD" || role === "SUPER_ADMIN" || role === "SUB_ADMIN";
  const reports = await prisma.seoReport.findMany({
    where: { month: selMonth, client: seoClientWhere(userId, isHead) },
    include: { client: { include: { accountManager: true } } },
    orderBy: { reportDate: "asc" },
  });
  const rows = reports.map((r) => ({
    id: r.id, clientId: r.clientId, client: r.client.name, am: r.client.accountManager?.name ?? "—",
    reportDate: r.reportDate, status: r.status, gscDone: r.gscDone, gaDone: r.gaDone,
    assigned: r.assigned, keywordStatus: r.keywordStatus, note: r.note,
  }));
  return {
    rows,
    month: selMonth, months: SEO_BOARD_MONTHS.map((k) => ({ key: k, label: mLabelOf(k) })),
    kpis: { total: rows.length, sent: rows.filter((r) => r.status === "SENT").length, pending: rows.filter((r) => r.status !== "SENT").length },
  };
}

// Per-client SEO detail — AM + SEO team + tabbed work (blogs/backlinks/keywords) + Search Console + Analytics, month-scoped.
export async function getSeoClient(clientId: string, userId: string, role: string, monthIn?: string) {
  const isHead = role === "SEO_HEAD" || role === "SUPER_ADMIN" || role === "SUB_ADMIN";
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      accountManager: true,
      deliverables: true,
      assignments: { include: { user: true } },
      updates: { where: { workType: { in: ["blog", "ranking", "backlink", "localseo", "audit"] } }, include: { user: true }, orderBy: { date: "desc" } },
      seoAnalytics: { orderBy: { month: "desc" } },
      seoBlogSlots: { orderBy: { slot: "asc" } },
      seoReports: { orderBy: { month: "desc" } },
    },
  });
  if (!client) return null;
  if (!isHead && !client.assignments.some((a) => a.userId === userId)) return null;

  const monthOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const monthsSet = new Set<string>([...client.updates.map((u) => monthOf(u.date)), ...client.seoAnalytics.map((a) => a.month), ...client.seoBlogSlots.map((b) => b.month), ...SEO_BOARD_MONTHS]);
  const availableMonths = [...monthsSet].sort((a, b) => b.localeCompare(a));
  const month = monthIn && availableMonths.includes(monthIn) ? monthIn : (availableMonths[0] ?? monthOf(now()));
  const monthLabel = (k: string) => new Date(k + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" });

  // Blog slot grid (the 8-slot × 3-stage tracker) for the selected month.
  const slots = client.seoBlogSlots.filter((b) => b.month === month);
  const blogSlots = slots.map((b) => ({ id: b.id, slot: b.slot, writer: b.writer, blog: b.blog, image: b.image, web: b.web, title: b.title, link: b.link }));
  const bWritten = slots.filter((b) => b.blog === "PUBLISHED").length;
  const bImages = slots.filter((b) => b.image === "DONE").length;
  const bLive = slots.filter((b) => b.web === "LIVE").length;
  const blogTargetN = client.blogTarget || slots.length;
  const blogStats = {
    target: blogTargetN, written: bWritten, images: bImages, live: bLive,
    pending: Math.max(0, blogTargetN - bWritten),
    pct: blogTargetN ? Math.round((bWritten / blogTargetN) * 100) : 0,
  };
  const report = client.seoReports.find((r) => r.month === month) ?? null;

  const monthUpdates = client.updates.filter((u) => monthOf(u.date) === month);
  const items = monthUpdates.map((u) => ({
    id: u.id, category: u.workType, title: u.title ?? "—",
    status: u.status, date: u.date.toISOString(), by: u.user.name,
    keyword: u.keyword ?? null, prev: u.prevPosition ?? null, curr: u.currPosition ?? null, proofLink: u.proofLink ?? null,
  }));
  const inCat = (c: string) => items.filter((i) => i.category === c);
  const doneN = (c: string) => inCat(c).filter((i) => isComplete(i.status)).length;
  const pendN = (c: string) => inCat(c).filter((i) => !isComplete(i.status)).length;
  const gains = monthUpdates.filter((u) => u.workType === "ranking" && u.prevPosition != null && u.currPosition != null).map((u) => u.prevPosition! - u.currPosition!);

  const ROLE_BY_DEPT: Record<string, string> = { ACCOUNT: "Account Manager", SEO: "SEO Specialist", DESIGN: "Designer", VIDEO: "Video Editor", ADS: "Ads Manager" };
  const teamMap = new Map<string, { name: string; role: string }>();
  if (client.accountManager) teamMap.set(client.accountManager.name, { name: client.accountManager.name, role: "Account Manager" });
  for (const a of client.assignments) if (!teamMap.has(a.user.name)) teamMap.set(a.user.name, { name: a.user.name, role: ROLE_BY_DEPT[a.department] ?? a.department });
  const team = [...teamMap.values()];
  const seoStaff = client.assignments.filter((a) => a.department === "SEO").map((a) => a.user.name);

  const a = client.seoAnalytics.find((x) => x.month === month) ?? null;
  const analytics = a ? {
    gsc: { clicks: a.gscClicks, impressions: a.gscImpressions, ctr: a.gscCtr, position: a.gscPosition },
    ga: { users: a.gaUsers, sessions: a.gaSessions, bounce: a.gaBounce, conversions: a.gaConversions },
  } : null;

  const canEdit = isHead || client.assignments.some((a) => a.userId === userId && a.department === "SEO");

  return {
    client: { id: client.id, name: client.name, code: client.code, status: client.status, industry: client.industry, website: client.website },
    am: client.accountManager?.name ?? null,
    seoStaff, team, canEdit,
    month, months: availableMonths.map((k) => ({ key: k, label: monthLabel(k) })),
    targets: {
      priority: client.seoPriority, schedule: client.seoScheduleDays,
      blogTarget: client.blogTarget, backlinkTarget: client.backlinkTarget, keywordTarget: client.keywordTarget,
      gscLink: client.gscLink, gaLink: client.gaLink,
    },
    blogSlots, blogStats,
    da: client.domainAuthority,
    monthly: [...client.seoAnalytics].sort((a, b) => a.month.localeCompare(b.month)).map((a) => ({
      month: a.month, label: new Date(a.month + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long" }),
      clicks: a.gscClicks, impressions: a.gscImpressions, ctr: a.gscCtr, position: a.gscPosition,
      active: a.gaUsers, newUsers: a.gaNewUsers, organicSocial: a.gaOrganicSocial, organicSearch: a.gaOrganic,
    })),
    report: report && { reportDate: report.reportDate, status: report.status, gscDone: report.gscDone, gaDone: report.gaDone, assigned: report.assigned, keywordStatus: report.keywordStatus, note: report.note },
    summary: {
      blog: { done: blogStats.written, pending: blogStats.pending, total: blogStats.target, target: blogStats.target },
      backlink: { done: doneN("backlink"), pending: pendN("backlink"), total: inCat("backlink").length },
      ranking: { total: inCat("ranking").length, improved: gains.filter((g) => g > 0).length, avgGain: gains.length ? +(gains.reduce((x, y) => x + y, 0) / gains.length).toFixed(1) : 0 },
      localseo: { done: doneN("localseo"), pending: pendN("localseo"), total: inCat("localseo").length },
      audit: { done: doneN("audit"), pending: pendN("audit"), total: inCat("audit").length },
    },
    analytics,
    items,
  };
}

// ---- Creative boards (Designer / Video Editor task dashboards) ----
function creativeToday() {
  const n = now();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
export async function getCreativeBoard(userId: string, role: string, kind: "DESIGN" | "VIDEO") {
  const isAdmin = role === "SUPER_ADMIN" || role === "SUB_ADMIN";
  const tasks = await prisma.creativeTask.findMany({
    where: { kind, ...(isAdmin ? {} : { assignedToId: userId }) },
    include: { client: true },
    orderBy: [{ dueDate: "asc" }, { code: "asc" }],
  });
  const today = creativeToday();
  const dayMs = 86400000;
  const rows = tasks.map((t) => {
    const overdue = !!t.dueDate && t.dueDate < today && t.status !== "COMPLETED";
    const dueToday = t.dueDate === today && t.status !== "COMPLETED";
    let rel = "";
    if (t.dueDate) {
      const diff = Math.round((new Date(t.dueDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / dayMs);
      rel = diff === 0 ? "Today" : diff < 0 ? `Overdue ${-diff}d` : diff <= 7 ? `${diff}d left` : "";
    }
    const dueLabel = t.dueDate ? new Date(t.dueDate + "T00:00:00").toLocaleDateString("en-IN", { month: "short", day: "2-digit" }) : "";
    return {
      id: t.id, code: t.code, title: t.title, client: t.client?.name ?? "—",
      type: t.type, priority: t.priority, status: t.status, source: t.source,
      assignedDate: t.assignedDate, dueDate: t.dueDate, dimensions: t.dimensions,
      brief: t.brief, notes: t.notes, refLink: t.refLink, rawLink: t.rawLink, finalLink: t.finalLink,
      overdue, dueToday, dueLabel, rel,
    };
  });

  const counts = {
    total: rows.length,
    dueToday: rows.filter((r) => r.dueToday).length,
    inProgress: rows.filter((r) => r.status === "IN_PROGRESS").length,
    review: rows.filter((r) => r.status === "REVIEW").length,
    completed: rows.filter((r) => r.status === "COMPLETED").length,
    overdue: rows.filter((r) => r.overdue).length,
  };
  const clients = [...new Set(rows.map((r) => r.client))].filter((c) => c !== "—").sort();
  const types = [...new Set(rows.map((r) => r.type))].sort();
  const progress = counts.total ? Math.round((counts.completed / counts.total) * 100) : 0;
  // All clients (id + name) for the "Add Additional" modal's client picker.
  const clientOptions = await prisma.client.findMany({ where: { status: { not: "UPCOMING" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return { rows, counts, clients, types, progress, today, clientOptions };
}

// ---- Super Admin: Designer + Video Editor daily work report ----
// One filterable dataset across BOTH creative kinds so the Super Admin can review
// exactly what every designer / editor worked on, by member / client / day / status.
export async function getCreativeReport() {
  const [members, tasks] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["DESIGNER", "EDITOR"] } }, orderBy: [{ role: "asc" }, { name: "asc" }] }),
    prisma.creativeTask.findMany({ include: { client: true, assignedTo: true }, orderBy: [{ assignedDate: "desc" }, { code: "asc" }] }),
  ]);
  const today = creativeToday();
  const rows = tasks.map((t) => {
    const overdue = !!t.dueDate && t.dueDate < today && t.status !== "COMPLETED";
    return {
      id: t.id, kind: t.kind, code: t.code, title: t.title,
      member: t.assignedTo?.name ?? "—", memberId: t.assignedToId, role: t.assignedTo?.role ?? "",
      client: t.client?.name ?? "—", type: t.type, priority: t.priority, status: t.status, source: t.source,
      assignedDate: t.assignedDate, dueDate: t.dueDate, finalLink: t.finalLink,
      updatedAt: t.updatedAt.toISOString().slice(0, 10), overdue,
    };
  });
  const clients = [...new Set(rows.map((r) => r.client))].filter((c) => c !== "—").sort();
  const types = [...new Set(rows.map((r) => r.type))].sort();
  const days = [...new Set(rows.map((r) => r.assignedDate).filter(Boolean))].sort().reverse();
  const memberOpts = members.map((m) => ({ id: m.id, name: m.name, role: m.role }));
  const clientOptions = await prisma.client.findMany({ where: { status: { not: "UPCOMING" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return { rows, clients, types, days, members: memberOpts, clientOptions, today };
}

// ---- Google Ads (Account Manager daily-entry console) ----
// The demo calendar is anchored to Aug 2026 so the console always has data to show.
const GADS_TODAY = "2026-08-31";
const GADS_YESTERDAY = "2026-08-30";
const GADS_WEEK_START = "2026-08-25";
const GADS_MONTH_PREFIX = "2026-08";
const GADS_PERIOD_KEYS = ["YESTERDAY", "TODAY", "WEEK", "MONTH"] as const;

type GadsDateWhere = { in: string[] } | { startsWith: string } | { gte: string; lte: string };
function gadsDateWhere(period: string): { where: GadsDateWhere; label: string; single: string | null } {
  if (period === "TODAY") return { where: { in: [GADS_TODAY] }, label: "31 Aug 2026", single: GADS_TODAY };
  if (period === "WEEK") return { where: { gte: GADS_WEEK_START, lte: GADS_TODAY }, label: "25–31 Aug", single: null };
  if (period === "MONTH") return { where: { startsWith: GADS_MONTH_PREFIX }, label: "Aug 2026", single: null };
  return { where: { in: [GADS_YESTERDAY] }, label: "30 Aug 2026", single: GADS_YESTERDAY }; // YESTERDAY
}

export async function getGoogleAdsBoard(userId: string, role: string, periodIn = "YESTERDAY") {
  const period = (GADS_PERIOD_KEYS as readonly string[]).includes(periodIn) ? periodIn : "YESTERDAY";
  const isHead = role === "AM_HEAD" || role === "SUPER_ADMIN" || role === "SUB_ADMIN";
  const { where: dateWhere, label: periodDate, single } = gadsDateWhere(period);

  const clients = await prisma.client.findMany({
    where: { googleBudget: { gt: 0 }, ...(isHead ? {} : { accountManagerId: userId }) },
    include: { googleCampaigns: { where: { date: dateWhere }, orderBy: { name: "asc" } } },
    orderBy: { code: "asc" },
  });

  // This-month spend per client (for the budget banner — always the full month, not the period).
  const ids = clients.map((c) => c.id);
  const monthAgg = ids.length
    ? await prisma.googleAdsCampaign.groupBy({ by: ["clientId"], where: { clientId: { in: ids }, date: { startsWith: GADS_MONTH_PREFIX } }, _sum: { spent: true } })
    : [];
  const monthSpend = new Map(monthAgg.map((m) => [m.clientId, m._sum.spent ?? 0]));

  const rows = clients.map((c) => {
    // For multi-day periods, roll each campaign up by name; single-day already has one row per name.
    const byName = new Map<string, { name: string; type: string; spent: number; leads: number; conv: number; active: boolean }>();
    let lastUpdated: Date | null = null;
    let updatedBy = "";
    for (const g of c.googleCampaigns) {
      const cur = byName.get(g.name) ?? { name: g.name, type: g.type, spent: 0, leads: 0, conv: 0, active: false };
      cur.spent += g.spent; cur.leads += g.leads; cur.conv += g.conversions;
      if (g.status === "ACTIVE") cur.active = true;
      byName.set(g.name, cur);
      if (!lastUpdated || g.updatedAt > lastUpdated) { lastUpdated = g.updatedAt; updatedBy = g.updatedBy; }
    }
    const campaigns = [...byName.values()].map((x) => ({
      name: x.name, type: x.type, spent: x.spent, leads: x.leads, conv: x.conv,
      status: x.active ? "ACTIVE" : "PAUSED",
      cpl: x.leads ? Math.round(x.spent / x.leads) : 0,
      convPct: x.leads ? +((x.conv / x.leads) * 100).toFixed(1) : 0,
    }));
    const spent = campaigns.reduce((s, x) => s + x.spent, 0);
    const leads = campaigns.reduce((s, x) => s + x.leads, 0);
    const conv = campaigns.reduce((s, x) => s + x.conv, 0);
    const ms = monthSpend.get(c.id) ?? 0;
    const usedPct = c.googleBudget ? Math.round((ms / c.googleBudget) * 100) : 0;
    return {
      id: c.id, name: c.name, budget: c.googleBudget,
      onHold: c.status === "ON_HOLD",
      spent, leads, conv,
      cpl: leads ? Math.round(spent / leads) : 0,
      convPct: leads ? +((conv / leads) * 100).toFixed(1) : 0,
      campaigns, ready: campaigns.length > 0,
      updatedBy, updatedAt: lastUpdated ? lastUpdated.toISOString() : null,
      monthSpend: ms, usedPct,
    };
  });

  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
  const totalConv = rows.reduce((s, r) => s + r.conv, 0);
  const totalCampaigns = rows.reduce((s, r) => s + r.campaigns.length, 0);
  const smartCampaigns = rows.reduce((s, r) => s + r.campaigns.filter((x) => x.type === "SMART").length, 0);
  const pending = rows.filter((r) => !r.ready).length;
  // Budget banner: the client closest to (or over) their monthly budget.
  const budgetClient = rows.length ? [...rows].sort((a, b) => b.usedPct - a.usedPct)[0] : null;

  return {
    period, periodDate, singleDay: single,
    rows,
    kpis: {
      totalSpent, totalLeads, totalConv,
      costPerLead: totalLeads ? Math.round(totalSpent / totalLeads) : 0,
      convPct: totalLeads ? +((totalConv / totalLeads) * 100).toFixed(1) : 0,
    },
    counts: { clients: rows.length, campaigns: totalCampaigns, smart: smartCampaigns, pending },
    budgetClient: budgetClient && { name: budgetClient.name, budget: budgetClient.budget, spend: budgetClient.monthSpend, usedPct: budgetClient.usedPct },
  };
}

// Google Ads daily-entry form data (client picker + existing rows for a client+date).
export async function getGoogleAdsEntry(userId: string, role: string, clientId: string | null, period = "YESTERDAY") {
  const isHead = role === "AM_HEAD" || role === "SUPER_ADMIN" || role === "SUB_ADMIN";
  const date = period === "TODAY" ? GADS_TODAY : GADS_YESTERDAY; // entry is per single day
  const clients = await prisma.client.findMany({
    where: { googleBudget: { gt: 0 }, ...(isHead ? {} : { accountManagerId: userId }) },
    orderBy: { code: "asc" },
    select: { id: true, name: true, googleBudget: true },
  });
  const selected = clientId && clients.some((c) => c.id === clientId) ? clientId : clients[0]?.id ?? null;
  const existing = selected
    ? await prisma.googleAdsCampaign.findMany({ where: { clientId: selected, date }, orderBy: { name: "asc" } })
    : [];
  return {
    date, period, clients, selected,
    dateLabel: period === "TODAY" ? "Today (31 Aug 2026)" : "Yesterday (30 Aug 2026)",
    rows: existing.map((g) => ({ name: g.name, type: g.type, spent: g.spent, leads: g.leads, conv: g.conversions, status: g.status })),
  };
}

// Assigned tasks — the member's inbox + (for heads) the assign form & what they delegated.
const TASK_ASSIGNER = ["SUPER_ADMIN", "SUB_ADMIN", "AM_HEAD", "SEO_HEAD", "DEV_HEAD"];
export async function getTasksView(userId: string, role: string) {
  const isAssigner = TASK_ASSIGNER.includes(role);
  const [mine, byMe, users, clients] = await Promise.all([
    prisma.task.findMany({ where: { assignedToId: userId }, include: { assignedBy: true, client: true }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    isAssigner ? prisma.task.findMany({ where: { assignedById: userId }, include: { assignedTo: true, client: true }, orderBy: { createdAt: "desc" }, take: 40 }) : Promise.resolve([]),
    isAssigner ? prisma.user.findMany({ where: { active: true, role: { not: "SUPER_ADMIN" } }, orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, name: true, role: true } }) : Promise.resolve([]),
    // client options are offered to everyone so a self-task can be linked to a client
    prisma.client.findMany({ where: { status: { not: "UPCOMING" } }, orderBy: { code: "asc" }, select: { id: true, name: true } }),
  ]);
  const m = (t: (typeof mine)[number]) => ({
    id: t.id, title: t.title, detail: t.detail, priority: t.priority, status: t.status, dueDate: t.dueDate, seen: t.seen,
    client: t.client?.name ?? null, from: t.assignedBy.name, createdAt: t.createdAt,
  });
  const b = (t: (typeof byMe)[number]) => ({
    id: t.id, title: t.title, priority: t.priority, status: t.status, dueDate: t.dueDate,
    client: t.client?.name ?? null, to: t.assignedTo.name, toRole: t.assignedTo.role,
  });
  return { isAssigner, myTasks: mine.map(m), assignedByMe: byMe.map(b), users, clients };
}

export async function getMyOpenTaskCount(userId: string) {
  return prisma.task.count({ where: { assignedToId: userId, status: { not: "DONE" } } });
}

// Work updates awaiting a head's sign-off.
export async function getApprovals(dept?: string) {
  const wt = dept && DEPT_WORKTYPES[dept] ? { workType: { in: DEPT_WORKTYPES[dept] } } : {};
  const updates = await prisma.workUpdate.findMany({
    where: { status: "PENDING_APPROVAL", ...wt },
    orderBy: { date: "desc" },
    include: { client: true, user: true },
    take: 100,
  });
  return updates.map((u) => ({
    id: u.id, date: u.date, client: u.client.name, clientId: u.clientId,
    user: u.user.name, workType: u.workType, quantity: u.quantity,
    title: u.title, detail: u.detail, keyword: u.keyword,
    prevPosition: u.prevPosition, currPosition: u.currPosition,
  }));
}

export async function getApprovalsCount(dept?: string) {
  const wt = dept && DEPT_WORKTYPES[dept] ? { workType: { in: DEPT_WORKTYPES[dept] } } : {};
  return prisma.workUpdate.count({ where: { status: "PENDING_APPROVAL", ...wt } });
}

// Content calendar — SM posts (and their status) laid out by day for a month.
export async function getCalendar(monthPrefix: string, amId?: string) {
  const posts = await prisma.socialPost.findMany({
    where: { date: { startsWith: monthPrefix }, ...(amId ? { client: { accountManagerId: amId } } : {}) },
    include: { client: true },
    orderBy: [{ date: "asc" }, { slot: "asc" }],
  });
  const byDay: Record<string, { client: string; platform: string; postType: string; status: string }[]> = {};
  for (const p of posts) {
    (byDay[p.date] ??= []).push({ client: p.client.name, platform: p.platform, postType: p.postType, status: p.status });
  }
  return {
    byDay,
    total: posts.length,
    posted: posts.filter((p) => p.status === "POSTED").length,
    scheduled: posts.filter((p) => p.status !== "POSTED").length,
  };
}

// Lightweight index for the global (⌘K) search — clients, dev projects, team.
export async function getSearchIndex() {
  const [clients, projects, team] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true, code: true, pocName: true, industry: true }, orderBy: { code: "asc" } }),
    prisma.devProject.findMany({ select: { id: true, name: true, platform: true }, orderBy: { updatedAt: "desc" } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true } }),
  ]);
  return {
    clients: clients.map((c) => ({ id: c.id, label: c.name, sub: [c.pocName, c.industry, c.code].filter(Boolean).join(" · "), href: `/clients/${c.id}` })),
    projects: projects.map((p) => ({ id: p.id, label: p.name, sub: p.platform, href: `/projects` })),
    team: team.map((u) => ({ id: u.id, label: u.name, sub: u.role, href: `/team` })),
  };
}

// Alert feed for the notifications bell — overdue builds, due-soon, pending approvals, behind clients.
export async function getAlerts(userId?: string, role?: string) {
  const nowMs = Date.now();
  const today = salesToday();
  // The accountant doesn't run delivery — hide dev-project & approval alerts from their bell,
  // and point client alerts at the accountant's own client page (/accounts/[id]).
  const isAccountant = role === "ACCOUNTANT";
  const seesDelivery = !isAccountant;
  const [projects, pendingApprovals, renewClients, myNewTasks, myNotifs, myFollowups, myReminders] = await Promise.all([
    prisma.devProject.findMany({ where: { status: { not: "LIVE" } }, include: { assignedTo: true } }),
    prisma.workUpdate.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.client.findMany({ where: { renewalDate: { not: "" } }, select: { id: true, name: true, renewalDate: true } }),
    userId ? prisma.task.findMany({ where: { assignedToId: userId, status: "TODO", seen: false }, include: { assignedBy: true, client: true }, orderBy: { createdAt: "desc" }, take: 6 }) : Promise.resolve([]),
    userId ? prisma.notification.findMany({ where: { userId, read: false }, orderBy: { createdAt: "desc" }, take: 12 }) : Promise.resolve([]),
    // Sales reminders/follow-ups due today or overdue, for this user's leads.
    userId ? prisma.followup.findMany({ where: { status: "PENDING", lead: { assignedToId: userId } }, include: { lead: { select: { id: true, name: true } } } }) : Promise.resolve([]),
    userId ? prisma.reminder.findMany({ where: { status: "PENDING", lead: { assignedToId: userId } }, include: { lead: { select: { id: true, name: true } } } }) : Promise.resolve([]),
  ]);

  const items: { tone: string; title: string; sub: string; href: string }[] = [];
  // Stored notifications first (client onboarding, creative assignments, …).
  for (const nt of myNotifs) {
    items.push({ tone: nt.tone, title: nt.title, sub: nt.body, href: nt.link });
  }
  // Sales reminders due today / overdue — keep reminding until acted on.
  const dueRem = [...myFollowups, ...myReminders].filter((r) => r.date && r.date >= "2000-01-01" && r.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const r of dueRem.slice(0, 8)) {
    const overdue = r.date < today;
    items.push({ tone: overdue ? "rose" : "amber", title: `⏰ Reminder: ${r.lead?.name ?? "lead"}`, sub: `${r.type || "Call"} · ${r.date}${overdue ? " · overdue" : " · today"}${r.notes ? ` — ${r.notes}` : ""}`, href: `/sales/${r.leadId}` });
  }
  for (const t of myNewTasks) {
    items.push({ tone: "violet", title: `New task: ${t.title}`, sub: `From ${t.assignedBy.name}${t.client ? ` · ${t.client.name}` : ""}`, href: "/tasks" });
  }
  const overdue = projects.filter((p) => p.dueDate && new Date(p.dueDate + "T23:59:59").getTime() < nowMs);
  const dueSoon = projects.filter((p) => {
    if (!p.dueDate) return false;
    const d = Math.ceil((new Date(p.dueDate + "T23:59:59").getTime() - nowMs) / 86400000);
    return d >= 0 && d <= 3;
  });
  if (seesDelivery) {
    for (const p of overdue.slice(0, 6)) {
      const days = Math.abs(Math.ceil((new Date(p.dueDate + "T23:59:59").getTime() - nowMs) / 86400000));
      items.push({ tone: "rose", title: `${p.name} is ${days}d overdue`, sub: `${p.assignedTo?.name ?? "Unassigned"} · ${p.progress}% done`, href: "/projects" });
    }
    for (const p of dueSoon.slice(0, 4)) {
      const days = Math.ceil((new Date(p.dueDate + "T23:59:59").getTime() - nowMs) / 86400000);
      items.push({ tone: "amber", title: `${p.name} due in ${days}d`, sub: `${p.assignedTo?.name ?? "Unassigned"} · ${p.progress}% done`, href: "/projects" });
    }
    if (pendingApprovals > 0) {
      items.push({ tone: "violet", title: `${pendingApprovals} update${pendingApprovals !== 1 ? "s" : ""} awaiting approval`, sub: "Review in Approvals", href: "/approvals" });
    }
  }
  // contract renewals within 30 days
  const renewals = renewClients
    .map((c) => ({ ...c, days: Math.ceil((new Date(c.renewalDate + "T23:59:59").getTime() - nowMs) / 86400000) }))
    .filter((c) => !Number.isNaN(c.days) && c.days >= -7 && c.days <= 30)
    .sort((a, b) => a.days - b.days);
  for (const r of renewals.slice(0, 4)) {
    items.push({ tone: "emerald", title: r.days < 0 ? `${r.name} renewal overdue` : `${r.name} renews in ${r.days}d`, sub: `Contract · ${r.renewalDate}`, href: isAccountant ? `/accounts/${r.id}` : `/clients/${r.id}` });
  }

  const deliveryCount = seesDelivery ? overdue.length + dueSoon.length + (pendingApprovals > 0 ? 1 : 0) : 0;
  return { count: myNotifs.length + Math.min(dueRem.length, 8) + myNewTasks.length + deliveryCount + renewals.length, items };
}

// The Clients "book" view — services + agreed monthly deliverables + team + status.
export async function getClientBook() {
  const clients = await prisma.client.findMany({
    include: {
      accountManager: true,
      services: true,
      deliverables: true,
      assignments: { include: { user: true } },
    },
    orderBy: { code: "asc" },
  });

  const METRIC_ORDER = ["blogs", "keywords", "static", "carousel", "reels", "aiVideos", "reelsEdit"];
  const rows = clients.map((c) => {
    const dels = c.deliverables
      .filter((d) => d.agreed > 0)
      .sort((a, b) => METRIC_ORDER.indexOf(a.metric) - METRIC_ORDER.indexOf(b.metric))
      .map((d) => ({ metric: d.metric, agreed: d.agreed }));
    const team = c.assignments.filter((a) => a.department !== "ACCOUNT").map((a) => a.user.name);
    return {
      id: c.id, code: c.code, name: c.name, status: c.status,
      industry: c.industry, website: c.website, pocName: c.pocName,
      services: c.services.map((s) => s.service),
      deliverables: dels,
      am: c.accountManager?.name ?? null,
      teamCount: team.length,
    };
  });

  const counts = {
    all: rows.length,
    active: rows.filter((r) => r.status === "ACTIVE").length,
    onHold: rows.filter((r) => r.status === "ON_HOLD").length,
    upcoming: rows.filter((r) => r.status === "UPCOMING").length,
  };
  return { rows, counts };
}

export async function getClientDetail(id: string, periodKey: PeriodKey = "month") {
  const { start, end, factor } = resolvePeriod(periodKey);
  const c = await prisma.client.findUnique({
    where: { id },
    include: {
      accountManager: true,
      services: true,
      deliverables: true,
      assignments: { include: { user: true } },
      updates: { orderBy: { date: "desc" }, include: { user: true } },
      contacts: { orderBy: { primary: "desc" } },
    },
  });
  if (!c) return null;
  const inRange = c.updates.filter((u) => u.date >= start && u.date <= end);
  const ag = agreedForClient(c.deliverables);
  const cp = completedForClient(inRange);
  const scaledAgreed = Math.round(ag.total * factor);
  const pct = scaledAgreed ? Math.min(100, Math.round((cp.total / scaledAgreed) * 100)) : 0;

  // per-metric track
  const track = c.deliverables
    .filter((d) => COUNTABLE_METRICS.has(d.metric))
    .map((d) => {
      const wt = { blogs: "blog", static: "static", carousel: "carousel", reels: "reel", aiVideos: "aiVideo", reelsEdit: "reelEdit" }[d.metric];
      const done = inRange.filter((u) => u.workType === wt && isComplete(u.status)).reduce((s, u) => s + u.quantity, 0);
      return { metric: d.metric, service: d.service, agreed: d.agreed, done, pending: Math.max(0, d.agreed - done) };
    });

  return { client: c, ag, cp, pct, agreed: scaledAgreed, band: healthBand(pct), track, updates: c.updates };
}

export async function getUsers() {
  return prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });
}

// Reconstruct form values for editing a client.
export async function getClientForEdit(id: string) {
  const c = await prisma.client.findUnique({
    where: { id },
    include: { services: true, deliverables: true, assignments: { include: { user: true } } },
  });
  if (!c) return null;

  const roleOf = (predicate: (r: string) => boolean) =>
    c.assignments.find((a) => predicate(a.user.role))?.userId ?? "";

  const deliverables: Record<string, number> = {};
  for (const d of c.deliverables) deliverables[`${d.service}_${d.metric}`] = d.agreed;

  return {
    id: c.id,
    name: c.name,
    website: c.website ?? "",
    industry: c.industry ?? "",
    monthlyRetainer: c.monthlyRetainer,
    pocName: c.pocName ?? "",
    pocMobile: c.pocMobile ?? "",
    pocEmail: c.pocEmail ?? "",
    status: c.status,
    onboardDate: c.onboardDate.toISOString().slice(0, 10),
    notes: c.notes ?? "",
    accountManagerId: c.accountManagerId ?? "",
    amHeadId: roleOf((r) => r === "AM_HEAD"),
    seoHeadId: roleOf((r) => r === "SEO_HEAD"),
    seoMemberId: roleOf((r) => r === "SEO"),
    designerId: roleOf((r) => r === "DESIGNER"),
    editorId: roleOf((r) => r === "EDITOR"),
    services: c.services.map((s) => s.service),
    detailOther: c.services.find((s) => s.service === "OTHER")?.detail ?? "",
    deliverables,
  };
}

// Months between onboarding and now (inclusive), min 1.
function monthsActive(onboard: Date) {
  const n = now();
  const m = (n.getFullYear() - onboard.getFullYear()) * 12 + (n.getMonth() - onboard.getMonth()) + 1;
  return Math.max(1, m);
}

export function currentMonthKey() {
  const n = now();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

// Super Admin billing — per-client monthly amount, months active, totals, invoices.
export async function getBilling(month = currentMonthKey()) {
  const clients = await prisma.client.findMany({
    include: { accountManager: true, services: true, invoices: true },
    orderBy: { code: "asc" },
  });

  const rows = clients.map((c, i) => {
    const months = monthsActive(c.onboardDate);
    const monthly = c.monthlyRetainer;
    const paid = c.invoices.filter((x) => x.status === "PAID").reduce((s, x) => s + x.amount, 0);
    const billed = c.invoices.reduce((s, x) => s + x.amount, 0);
    const pending = billed - paid;
    const thisInvoice = c.invoices.find((x) => x.month === month) ?? null;
    return {
      sno: i + 1, id: c.id, code: c.code, name: c.name, status: c.status,
      onboardDate: c.onboardDate,
      services: c.services.map((s) => s.service),
      am: c.accountManager?.name ?? null,
      monthly, months,
      lifetimeValue: monthly * months,
      billed, paid, pending,
      thisMonth: thisInvoice ? { id: thisInvoice.id, number: thisInvoice.number, status: thisInvoice.status, amount: thisInvoice.amount } : null,
    };
  });

  const totals = {
    monthlyTotal: rows.filter((r) => r.status === "ACTIVE").reduce((s, r) => s + r.monthly, 0),
    billed: rows.reduce((s, r) => s + r.billed, 0),
    collected: rows.reduce((s, r) => s + r.paid, 0),
    pending: rows.reduce((s, r) => s + r.pending, 0),
    clients: rows.length,
  };

  // totals for the SELECTED month only
  const monthInvoices = clients.flatMap((c) => c.invoices).filter((x) => x.month === month);
  const monthTotals = {
    billed: monthInvoices.reduce((s, x) => s + x.amount, 0),
    collected: monthInvoices.filter((x) => x.status === "PAID").reduce((s, x) => s + x.amount, 0),
    pending: monthInvoices.filter((x) => x.status !== "PAID").reduce((s, x) => s + x.amount, 0),
    count: monthInvoices.length,
  };

  // list of selectable months: from the earliest onboarding month up to the current month
  const earliest = clients.reduce<Date | null>((a, c) => (!a || c.onboardDate < a ? c.onboardDate : a), null) ?? now();
  const months: { key: string; label: string }[] = [];
  const cur = now();
  const mCursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const mEnd = new Date(cur.getFullYear(), cur.getMonth(), 1);
  while (mCursor <= mEnd) {
    const key = `${mCursor.getFullYear()}-${String(mCursor.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: mCursor.toLocaleDateString("en-IN", { month: "short", year: "numeric" }) });
    mCursor.setMonth(mCursor.getMonth() + 1);
  }
  months.reverse(); // newest first

  return { rows, totals, month, monthTotals, months };
}

// Month-by-month payment matrix (Jan..Dec) for a given year.
export async function getBillingMatrix(year: number) {
  const clients = await prisma.client.findMany({
    include: { accountManager: true, services: true, invoices: { where: { month: { startsWith: `${year}-` } } } },
    orderBy: { code: "asc" },
  });
  const nowD = now();
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const rows = clients.map((c, idx) => {
    const onboardStart = new Date(c.onboardDate.getFullYear(), c.onboardDate.getMonth(), 1);
    const cells = MONTHS.map((_, m) => {
      const monthKey = `${year}-${String(m + 1).padStart(2, "0")}`;
      const monthDate = new Date(year, m, 1);
      if (monthDate < onboardStart) return { state: "na" as const, month: monthKey };
      if (monthDate > new Date(nowD.getFullYear(), nowD.getMonth(), 1)) return { state: "future" as const, month: monthKey };
      const inv = c.invoices.find((x) => x.month === monthKey);
      const isPaid = inv?.status === "PAID";
      // simple two states: paid or unpaid (an ungenerated month is just "unpaid")
      return { state: isPaid ? ("paid" as const) : ("unpaid" as const), id: inv?.id, month: monthKey, amount: c.monthlyRetainer };
    });
    const paid = cells.filter((x) => x.state === "paid").reduce((s, x) => s + (x.amount ?? 0), 0);
    const pending = cells.filter((x) => x.state === "unpaid").reduce((s, x) => s + (x.amount ?? 0), 0);
    return {
      sno: idx + 1, id: c.id, code: c.code, name: c.name, status: c.status,
      onboardDate: c.onboardDate, services: c.services.map((s) => s.service),
      am: c.accountManager?.name ?? null,
      monthly: c.monthlyRetainer, cells, paid, pending,
    };
  });

  // column totals per month
  const colTotals = MONTHS.map((_, m) => {
    let paid = 0, pending = 0;
    for (const r of rows) {
      const cell = r.cells[m];
      if (cell.state === "paid") paid += cell.amount ?? 0;
      else if (cell.state === "unpaid") pending += cell.amount ?? 0;
    }
    return { paid, pending };
  });

  const years: number[] = [];
  const earliest = clients.reduce<Date | null>((a, c) => (!a || c.onboardDate < a ? c.onboardDate : a), null) ?? nowD;
  for (let y = earliest.getFullYear(); y <= nowD.getFullYear(); y++) years.push(y);

  // selectable month list (earliest onboarding → now), newest first
  const allMonths: { key: string; label: string }[] = [];
  const mc = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const me = new Date(nowD.getFullYear(), nowD.getMonth(), 1);
  while (mc <= me) {
    allMonths.push({ key: `${mc.getFullYear()}-${String(mc.getMonth() + 1).padStart(2, "0")}`, label: mc.toLocaleDateString("en-IN", { month: "short", year: "numeric" }) });
    mc.setMonth(mc.getMonth() + 1);
  }
  allMonths.reverse();

  // all-time totals across every invoice (not just this year)
  const allInv = await prisma.invoice.findMany({ select: { amount: true, status: true } });
  const allTime = {
    billed: allInv.reduce((s, x) => s + x.amount, 0),
    collected: allInv.filter((x) => x.status === "PAID").reduce((s, x) => s + x.amount, 0),
    pending: allInv.filter((x) => x.status !== "PAID").reduce((s, x) => s + x.amount, 0),
    count: allInv.length,
  };

  return {
    year, months: MONTHS, rows, colTotals, years: years.reverse(), allTime, allMonths,
    totals: {
      paid: rows.reduce((s, r) => s + r.paid, 0),
      pending: rows.reduce((s, r) => s + r.pending, 0),
    },
  };
}

// Full account statement for one client — EVERY month since onboarding, with its invoice.
export async function getClientStatement(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { accountManager: true, services: true, invoices: true },
  });
  if (!client) return null;

  const nowD = now();
  const invByMonth = new Map(client.invoices.map((x) => [x.month, x]));
  const rows: { month: string; label: string; amount: number; status: "PAID" | "UNPAID"; invoiceId: string | null; number: string | null }[] = [];
  const cur = new Date(client.onboardDate.getFullYear(), client.onboardDate.getMonth(), 1);
  const end = new Date(nowD.getFullYear(), nowD.getMonth(), 1);
  while (cur <= end) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    const inv = invByMonth.get(key);
    rows.push({
      month: key,
      label: cur.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      amount: inv?.amount ?? client.monthlyRetainer,
      status: inv?.status === "PAID" ? "PAID" : "UNPAID",
      invoiceId: inv?.id ?? null,
      number: inv?.number ?? null,
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  rows.reverse(); // newest month first

  const totals = {
    billed: rows.reduce((s, r) => s + r.amount, 0),
    collected: rows.filter((r) => r.status === "PAID").reduce((s, r) => s + r.amount, 0),
    pending: rows.filter((r) => r.status !== "PAID").reduce((s, r) => s + r.amount, 0),
    months: rows.length,
  };
  return { client, rows, totals };
}

export async function getInvoice(id: string) {
  return prisma.invoice.findUnique({ where: { id }, include: { client: { include: { services: true, accountManager: true } } } });
}

export async function getTeam() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { managedClients: true, assignments: true } },
      updates: { where: { status: { in: COMPLETING_STATUSES as string[] } }, select: { id: true } },
    },
  });
  return users.map((u) => ({
    id: u.id, name: u.name, role: u.role, email: u.email, phone: u.phone, active: u.active,
    clients: u._count.assignments, managed: u._count.managedClients, done: u.updates.length,
  }));
}

// Super-Admin "all users in one table" view — per-member metrics for the current month.
export async function getTeamOverview() {
  const { start, end } = resolvePeriod("month");
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { managedClients: true, assignments: true, devProjects: true, tasksReceived: true } },
      updates: { where: { date: { gte: start, lte: end } }, select: { status: true, date: true } },
      tasksReceived: { select: { status: true } },
    },
  });

  const members = users.map((u) => {
    const done = u.updates.filter((x) => isComplete(x.status)).length;
    const pending = u.updates.filter((x) => x.status === "PENDING_APPROVAL").length;
    const total = u.updates.length;
    const openTasks = u.tasksReceived.filter((t) => t.status !== "DONE").length;
    const lastActive = u.updates.reduce<Date | null>((mx, x) => (!mx || x.date > mx ? x.date : mx), null);
    const isAm = u.role === "ACCOUNT_MANAGER" || u.role === "AM_HEAD" || u.role === "DM_EXEC";
    const isDev = u.role === "WEB_DEV" || u.role === "DEV_HEAD";
    return {
      id: u.id, name: u.name, role: u.role, email: u.email, phone: u.phone, active: u.active,
      hasPassword: !!u.passwordHash,
      clients: isAm ? u._count.managedClients : u._count.assignments,
      projects: isDev ? u._count.devProjects : 0,
      done, pending, total, openTasks,
      completion: total ? Math.round((done / total) * 100) : 0,
      lastActive: lastActive ? lastActive.toISOString() : null,
    };
  });

  const totals = {
    members: members.length,
    active: members.filter((m) => m.active).length,
    output: members.reduce((s, m) => s + m.done, 0),
    pending: members.reduce((s, m) => s + m.pending, 0),
  };
  return { members, totals, monthLabel: start.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) };
}

export async function getClientOptions() {
  return prisma.client.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } });
}

// Active designers + video editors — for the "assign creative work" picker.
export async function getCreativeTeam() {
  return prisma.user.findMany({
    where: { active: true, role: { in: ["DESIGNER", "EDITOR"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true },
  });
}

export async function getAmPanel(amId?: string) {
  const ams = await prisma.user.findMany({ where: { role: { in: ["ACCOUNT_MANAGER", "AM_HEAD", "DM_EXEC"] } }, orderBy: { name: "asc" } });
  const active = amId ?? ams[0]?.id;
  const d = await getDashboard("month");
  const clients = d.clients.filter((c) => c.am === ams.find((a) => a.id === active)?.name);
  return { ams, active, clients };
}

// Per-client Meta Ads daily entry for a date, optionally filtered to one AM's clients.
export async function getAdsEntry(date: string, amId?: string) {
  const ams = await prisma.user.findMany({ where: { role: { in: ["ACCOUNT_MANAGER", "AM_HEAD", "DM_EXEC"] } }, orderBy: { name: "asc" } });
  const activeAm = amId ?? ams[0]?.id;

  const clients = await prisma.client.findMany({
    where: { status: { not: "UPCOMING" }, ...(activeAm ? { accountManagerId: activeAm } : {}) },
    include: { accountManager: true, campaigns: { where: { date } } },
    orderBy: { code: "asc" },
  });

  const rows = clients.map((c) => ({
    id: c.id, code: c.code, name: c.name, industry: c.industry,
    retainer: c.monthlyRetainer, pocName: c.pocName,
    am: c.accountManager?.name ?? null,
    entries: c.campaigns.map((e) => ({
      type: e.type, results: e.results, spent: e.spent, conversions: e.conversions,
      saleValue: e.saleValue, ordersConverted: e.ordersConverted,
    })),
  }));

  // campaign-type counts across the visible clients (for the filter pills)
  const counts: Record<string, number> = {};
  for (const r of rows) for (const e of r.entries) counts[e.type] = (counts[e.type] ?? 0) + 1;

  // day rollup for the summary cards
  let spend = 0, leads = 0, conversions = 0, saleValue = 0, reach = 0;
  let bestClient: { name: string; cpl: number } | null = null;
  for (const r of rows) {
    let cSpend = 0, cLeads = 0;
    for (const e of r.entries) {
      spend += e.spent; conversions += e.conversions; saleValue += e.saleValue;
      if (e.type === "LEAD" || e.type === "CALLS" || e.type === "WHATSAPP") { leads += e.results; cLeads += e.results; cSpend += e.spent; }
      if (e.type === "AWARENESS") reach += e.results;
    }
    if (cLeads > 0) { const cpl = Math.round(cSpend / cLeads); if (!bestClient || cpl < bestClient.cpl) bestClient = { name: r.name, cpl }; }
  }
  const totals = {
    spend, leads, conversions, saleValue, reach,
    cpl: leads ? Math.round(spend / leads) : 0,
    roas: spend ? +(saleValue / spend).toFixed(2) : 0,
    bestClient,
  };

  return { ams, activeAm, date, rows, counts, totalEntries: rows.reduce((s, r) => s + r.entries.length, 0), totals };
}

// SM Posts board — per-client social posts grouped by platform (scoped to one AM).
export async function getSmoEntry(date: string, amId?: string) {
  const ams = await prisma.user.findMany({ where: { role: { in: ["ACCOUNT_MANAGER", "AM_HEAD", "DM_EXEC"] } }, orderBy: { name: "asc" } });
  const activeAm = amId ?? ams[0]?.id;

  const clients = await prisma.client.findMany({
    where: { status: { not: "UPCOMING" }, ...(activeAm ? { accountManagerId: activeAm } : {}) },
    include: { accountManager: true, socialPosts: { where: { date }, orderBy: { slot: "asc" } } },
    orderBy: { code: "asc" },
  });

  const rows = clients.map((c) => {
    const byPlatform = new Map<string, { postType: string; link: string; status: string }[]>();
    for (const p of c.socialPosts) {
      if (!byPlatform.has(p.platform)) byPlatform.set(p.platform, []);
      byPlatform.get(p.platform)!.push({ postType: p.postType, link: p.link, status: p.status });
    }
    return {
      id: c.id, code: c.code, name: c.name, industry: c.industry,
      retainer: c.monthlyRetainer, pocName: c.pocName,
      am: c.accountManager?.name ?? null,
      platforms: [...byPlatform.entries()].map(([platform, posts]) => ({ platform, posts })),
    };
  });

  const counts: Record<string, number> = {};
  for (const r of rows) for (const pf of r.platforms) counts[pf.platform] = (counts[pf.platform] ?? 0) + 1;
  const totalPosts = rows.reduce((s, r) => s + r.platforms.reduce((a, pf) => a + pf.posts.length, 0), 0);

  // day rollup for the summary cards
  let posted = 0, scheduled = 0;
  for (const r of rows) for (const pf of r.platforms) for (const p of pf.posts) (p.status === "POSTED" ? posted++ : scheduled++);
  const activeClients = rows.filter((r) => r.platforms.length > 0).length;
  const totals = { posts: totalPosts, posted, scheduled, activeClients, platforms: Object.keys(counts).length };

  return { ams, activeAm, date, rows, counts, totalPosts, totals };
}

// One client's Meta Ads performance for the current month — used on the client detail page.
export async function getClientAds(clientId: string) {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const entries = await prisma.campaignEntry.findMany({
    where: { clientId, date: { startsWith: monthPrefix } },
    orderBy: { date: "desc" },
  });
  if (entries.length === 0) return { hasData: false as const, monthLabel: now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) };

  let spend = 0, leads = 0, conversions = 0, saleValue = 0, reach = 0, ordersConverted = 0;
  const byType: Record<string, { spend: number; results: number; conversions: number }> = {};
  const days = new Set<string>();
  for (const e of entries) {
    spend += e.spent; conversions += e.conversions; saleValue += e.saleValue; ordersConverted += e.ordersConverted;
    if (e.type === "LEAD" || e.type === "CALLS" || e.type === "WHATSAPP") leads += e.results;
    if (e.type === "AWARENESS") reach += e.results;
    days.add(e.date);
    const b = (byType[e.type] ??= { spend: 0, results: 0, conversions: 0 });
    b.spend += e.spent; b.results += e.results; b.conversions += e.conversions;
  }
  // per-day rollup (most recent first) for a mini trend
  const perDay = new Map<string, { spend: number; leads: number }>();
  for (const e of entries) {
    let d = perDay.get(e.date);
    if (!d) { d = { spend: 0, leads: 0 }; perDay.set(e.date, d); }
    d.spend += e.spent;
    if (e.type === "LEAD" || e.type === "CALLS" || e.type === "WHATSAPP") d.leads += e.results;
  }
  const recent = [...perDay.entries()].map(([date, v]) => ({ date, spend: v.spend, leads: v.leads })).slice(0, 8);

  return {
    hasData: true as const,
    monthLabel: now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    totals: {
      spend, leads, conversions, saleValue, reach, ordersConverted, days: days.size,
      cpl: leads ? Math.round(spend / leads) : 0,
      roas: spend ? +(saleValue / spend).toFixed(2) : 0,
    },
    byType, recent,
  };
}

// Development team project tracker (scoped to a developer, or all for the head/admin).
export async function getDevBoard(devId?: string) {
  const [devs, clients, projects] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["WEB_DEV", "DEV_HEAD"] }, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.client.findMany({ where: { status: { not: "UPCOMING" } }, select: { id: true, name: true, code: true }, orderBy: { code: "asc" } }),
    prisma.devProject.findMany({
      where: devId ? { assignedToId: devId } : {},
      include: { client: true, assignedTo: true, tasks: true },
      orderBy: [{ updatedAt: "desc" }],
    }),
  ]);

  const nowMs = Date.now();
  const dayMs = 86400000;
  const rows = projects.map((p) => {
    const done = p.status === "LIVE";
    let daysLeft: number | null = null;
    if (p.dueDate) {
      const due = new Date(p.dueDate + "T23:59:59").getTime();
      if (!Number.isNaN(due)) daysLeft = Math.ceil((due - nowMs) / dayMs);
    }
    const overdue = !done && daysLeft !== null && daysLeft < 0;
    return {
      id: p.id, name: p.name,
      client: p.client?.name ?? null, clientCode: p.client?.code ?? null,
      assignee: p.assignedTo?.name ?? null, assigneeId: p.assignedToId,
      projectType: p.projectType, platform: p.platform, status: p.status, priority: p.priority,
      progress: p.progress, dueDate: p.dueDate, liveUrl: p.liveUrl, repoUrl: p.repoUrl, notes: p.notes,
      shareId: p.shareId,
      tasks: p.tasks.sort((a, b) => a.slot - b.slot).map((t) => ({ id: t.id, title: t.title, done: t.done })),
      taskDone: p.tasks.filter((t) => t.done).length, taskTotal: p.tasks.length,
      daysLeft, overdue,
    };
  });

  const stats = {
    total: rows.length,
    planning: rows.filter((r) => r.status === "PLANNING").length,
    inProgress: rows.filter((r) => r.status === "IN_PROGRESS").length,
    review: rows.filter((r) => r.status === "REVIEW").length,
    live: rows.filter((r) => r.status === "LIVE").length,
    onHold: rows.filter((r) => r.status === "ON_HOLD").length,
    overdue: rows.filter((r) => r.overdue).length,
  };

  // per-developer workload — who is doing what, and how far along
  const workload = devs.map((d) => {
    const dp = rows.filter((r) => r.assigneeId === d.id);
    const avg = dp.length ? Math.round(dp.reduce((s, r) => s + r.progress, 0) / dp.length) : 0;
    return {
      id: d.id, name: d.name, total: dp.length,
      live: dp.filter((r) => r.status === "LIVE").length,
      inProgress: dp.filter((r) => r.status === "IN_PROGRESS").length,
      review: dp.filter((r) => r.status === "REVIEW").length,
      avg,
    };
  }).sort((a, b) => b.total - a.total);
  const unassigned = rows.filter((r) => !r.assigneeId).length;

  // recent activity across the visible projects
  const projIds = rows.map((r) => r.id);
  const acts = projIds.length
    ? await prisma.devActivity.findMany({ where: { projectId: { in: projIds } }, orderBy: { createdAt: "desc" }, take: 15, include: { project: { select: { name: true } } } })
    : [];
  const activity = acts.map((a) => ({ id: a.id, actor: a.actor, message: a.message, project: a.project.name, date: a.createdAt }));

  return { devs, clients, rows, stats, workload, unassigned, activity };
}

// Public read-only project status (for a client share link).
export async function getProjectShare(shareId: string) {
  if (!shareId) return null;
  const p = await prisma.devProject.findFirst({
    where: { shareId },
    include: { client: true, assignedTo: true, tasks: { orderBy: { slot: "asc" } }, activities: { orderBy: { createdAt: "desc" }, take: 8 } },
  });
  if (!p) return null;
  return {
    name: p.name, client: p.client?.name ?? null, platform: p.platform, projectType: p.projectType,
    status: p.status, progress: p.progress, dueDate: p.dueDate, liveUrl: p.liveUrl,
    tasks: p.tasks.map((t) => ({ title: t.title, done: t.done })),
    activity: p.activities.map((a) => ({ actor: a.actor, message: a.message, date: a.createdAt })),
  };
}

export async function getAds(month = "2026-08") {
  const rows = await prisma.adsPerformance.findMany({
    where: { month }, include: { client: true }, orderBy: { spend: "desc" },
  });
  const totals = rows.reduce(
    (a, r) => ({ spend: a.spend + r.spend, leads: a.leads + r.leads, conversions: a.conversions + r.conversions }),
    { spend: 0, leads: 0, conversions: 0 }
  );
  return { rows, totals, month };
}

// The department + countable metrics/workTypes a role is responsible for.
function roleScope(role: string): { dept: string; metrics: string[]; workTypes: string[]; monitor: boolean } {
  switch (role) {
    case "SEO": case "SEO_HEAD":
      return { dept: "SEO", metrics: ["blogs"], workTypes: ["blog"], monitor: false };
    case "DESIGNER":
      return { dept: "DESIGN", metrics: ["static", "carousel", "reels"], workTypes: ["static", "carousel", "reel"], monitor: false };
    case "EDITOR":
      return { dept: "VIDEO", metrics: ["aiVideos", "reelsEdit"], workTypes: ["aiVideo", "reelEdit"], monitor: false };
    default: // AM, AM_HEAD, SUPER_ADMIN → monitor overall client health
      return { dept: "ACCOUNT", metrics: [], workTypes: [], monitor: true };
  }
}

// Access model: SUPER_ADMIN sees everything; a *_HEAD sees their whole team (department);
// every other employee sees ONLY their own data. Used to scope reports / updates / approvals.
export function deptForRole(role: string): string | null {
  if (role === "SEO_HEAD") return "SEO";
  if (role === "DEV_HEAD") return "DEV";
  if (role === "AM_HEAD") return "ACCOUNT";
  return null;
}
export function workScopeFor(role: string, userId: string): { userId?: string; dept?: string } {
  if (role === "SUPER_ADMIN" || role === "SUB_ADMIN") return {}; // all
  const dept = deptForRole(role);
  if (dept) return { dept }; // team lead / head → their department
  return { userId }; // individual employee → own only
}

export async function getMyDashboard(userId: string, role: string) {
  const { start, end } = resolvePeriod("month");
  const scope = roleScope(role);

  const [managed, assignedRows, myUpdates] = await Promise.all([
    prisma.client.findMany({ where: { accountManagerId: userId }, include: { deliverables: true, services: true, updates: { where: { date: { gte: start, lte: end } } } } }),
    prisma.assignment.findMany({ where: { userId }, include: { client: { include: { deliverables: true, services: true, updates: { where: { date: { gte: start, lte: end } } } } } } }),
    prisma.workUpdate.findMany({ where: { userId, date: { gte: start, lte: end } }, orderBy: { date: "desc" }, include: { client: true }, take: 40 }),
  ]);

  const clientMap = new Map<string, (typeof managed)[number]>();
  for (const c of managed) clientMap.set(c.id, c);
  for (const a of assignedRows) if (!clientMap.has(a.client.id)) clientMap.set(a.client.id, a.client);
  const clients = [...clientMap.values()];

  const rows = clients.map((c) => {
    let target = 0;
    if (scope.monitor) {
      target = c.deliverables.filter((d) => COUNTABLE_METRICS.has(d.metric)).reduce((s, d) => s + d.agreed, 0);
    } else {
      target = c.deliverables.filter((d) => scope.metrics.includes(d.metric)).reduce((s, d) => s + d.agreed, 0);
    }
    // completed: for monitor → whole client; else → this user's dept updates
    const relevant = c.updates.filter((u) =>
      scope.monitor ? isComplete(u.status) : (u.userId === userId && scope.workTypes.includes(u.workType) && isComplete(u.status))
    );
    const completed = relevant.reduce((s, u) => s + u.quantity, 0);
    const pct = target ? Math.min(100, Math.round((completed / target) * 100)) : 0;
    const last = c.updates
      .filter((u) => scope.monitor || u.userId === userId)
      .sort((a, b) => +b.date - +a.date)[0];
    return {
      id: c.id, name: c.name, code: c.code, status: c.status,
      services: c.services.map((s) => s.service),
      target, completed, pending: Math.max(0, target - completed), pct,
      band: healthBand(pct),
      last: last ? last.date : null,
    };
  });

  const completedCount = myUpdates.filter((u) => isComplete(u.status)).reduce((s, u) => s + u.quantity, 0);
  const pendingCount = myUpdates.filter((u) => !isComplete(u.status)).length;
  const avgPct = rows.length ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length) : 0;

  return {
    scope, rows,
    stats: { clients: clients.length, completed: completedCount, pending: pendingCount, avg: avgPct },
    updates: myUpdates.map((u) => ({ id: u.id, date: u.date, client: u.client.name, workType: u.workType, quantity: u.quantity, status: u.status, title: u.title, keyword: u.keyword, prevPosition: u.prevPosition, currPosition: u.currPosition })),
  };
}

// department -> the workTypes that belong to it (for report filtering)
const DEPT_WORKTYPES: Record<string, string[]> = {
  SEO: ["blog", "ranking", "backlink", "audit"],
  DESIGN: ["static", "carousel", "reel", "story"],
  VIDEO: ["aiVideo", "reelEdit", "longVideo"],
  ACCOUNT: ["meeting", "report", "task"],
};

export async function getReport(
  periodKey: PeriodKey = "month",
  opts: { userId?: string; dept?: string; clientId?: string; from?: string; to?: string } = {}
) {
  const { start, end } = resolvePeriod(periodKey, opts.from, opts.to);
  const where: Record<string, unknown> = { date: { gte: start, lte: end } };
  if (opts.userId) where.userId = opts.userId;
  if (opts.clientId) where.clientId = opts.clientId;
  if (opts.dept && DEPT_WORKTYPES[opts.dept]) where.workType = { in: DEPT_WORKTYPES[opts.dept] };

  const rows = await prisma.workUpdate.findMany({
    where,
    orderBy: { date: "desc" },
    include: { client: true, user: true },
  });
  const kpis = {
    total: rows.length,
    completed: rows.filter((r) => isComplete(r.status)).length,
    pending: rows.filter((r) => !isComplete(r.status)).length,
    contributors: new Set(rows.map((r) => r.userId)).size,
  };
  return { rows, kpis, range: { start, end }, period: periodKey };
}

// ============================================================
//  SALES CRM queries — all numbers DB-driven, real dates
// ============================================================
function salesToday() { return new Date().toISOString().slice(0, 10); }
// Add N days to a "YYYY-MM-DD" string, returning the same format ("" stays "").
function addDays(iso: string, days: number): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
// Whole days from `from` to `to` (both "YYYY-MM-DD"); positive when `to` is later.
function daysBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T00:00:00Z").getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}
function parseServices(s: string): string[] { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }
const SALES_ADMIN = ["SUPER_ADMIN", "SUB_ADMIN", "SALES_HEAD"];

// Every sales member sees ALL leads (team-wide visibility) — ownership still
// tracked via assignedTo, but the board/list is shared across the whole team.
function leadScope(_userId: string, _role: string) {
  return {};
}

// Count of reminders/follow-ups due today or overdue (sales pipeline) — for the sidebar badge.
export async function getDueReminderCount() {
  const today = salesToday();
  const [fu, rem] = await Promise.all([
    prisma.followup.findMany({ where: { status: "PENDING", lead: { pipeline: "WEBROCZ" } }, select: { date: true } }),
    prisma.reminder.findMany({ where: { status: "PENDING", lead: { pipeline: "WEBROCZ" } }, select: { date: true } }),
  ]);
  return [...fu, ...rem].filter((r) => r.date && r.date >= "2000-01-01" && r.date <= today).length;
}

export async function getSalesBoard(userId: string, role: string) {
  // Load BOTH pipelines in one go so the WebRocz ↔ Digital Hat switch is instant (client-side).
  const where = leadScope(userId, role);
  const [leads, execs] = await Promise.all([
    prisma.lead.findMany({ where, include: { assignedTo: { select: { name: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.user.findMany({ where: { role: { in: ["SALES_EXEC", "SALES_HEAD"] }, active: true }, select: { id: true, name: true } }),
  ]);
  const today = salesToday();
  const rows = leads.map((l) => ({
    id: l.id, code: l.code, name: l.name, company: l.company, contact: l.contactPerson,
    phone: l.phone, email: l.email, source: l.source, services: parseServices(l.services),
    value: l.value, stage: l.stage, owner: l.assignedTo?.name ?? "—", ownerId: l.assignedToId,
    pipeline: l.pipeline, notes: l.notes, createdAt: l.createdAt.toISOString().slice(0, 10), updatedAt: l.updatedAt.toISOString().slice(0, 10),
  }));

  // Pending follow-ups AND reminders (both sources) — full list so we can show WHO to call.
  const leadSel = { select: { id: true, name: true, company: true, pipeline: true } };
  const [fu, rem] = await Promise.all([
    prisma.followup.findMany({ where: { status: "PENDING", lead: where }, include: { lead: leadSel } }),
    prisma.reminder.findMany({ where: { status: "PENDING", lead: where }, include: { lead: leadSel } }),
  ]);
  type R = { id: string; leadId: string; date: string; time: string; type: string; notes: string; lead: { name: string; company: string; pipeline: string } | null };
  const mapR = (f: R) => ({ id: f.id, leadId: f.leadId, leadName: f.lead?.name ?? "", company: f.lead?.company ?? "", pipeline: f.lead?.pipeline ?? "WEBROCZ", date: f.date, time: f.time, type: f.type, notes: f.notes, overdue: !!f.date && f.date < today });
  const all = [...fu, ...rem].map(mapR).filter((r) => !!r.date).sort((a, b) => (a.date < b.date ? -1 : 1));
  const dueReminders = all.filter((r) => r.date <= today);
  const upcomingReminders = all.filter((r) => r.date > today).slice(0, 20);
  return { rows, dueReminders, upcomingReminders, execs };
}

export async function getLead(id: string, userId: string, role: string) {
  const l = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      followups: { orderBy: { createdAt: "desc" } },
      quotations: { orderBy: { createdAt: "desc" } },
      proposals: { orderBy: { createdAt: "desc" } },
      reminders: { orderBy: { createdAt: "desc" } },
      meetings: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 60 },
    },
  });
  if (!l) return null;
  // Team-wide visibility: any sales member can open any lead.
  const [execs, developers, dmPeople] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["SALES_EXEC", "SALES_HEAD"] }, active: true }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: { in: ["WEB_DEV", "DEV_HEAD"] }, active: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: { in: ["DM_EXEC", "DM_HEAD", "ACCOUNT_MANAGER", "AM_HEAD"] }, active: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
  ]);
  return { lead: { ...l, servicesArr: parseServices(l.services) }, execs, developers, dmPeople };
}

// Invoice for a lead (printable / emailable) — plus the lead's headline fields.
function hydrateInvoice(invoice: Record<string, unknown> | null) {
  if (!invoice) return null;
  let items: { name: string; qty: number; rate: number; amount: number }[] = [];
  let notesLog: { date: string; by: string; note: string }[] = [];
  try { const a = JSON.parse((invoice.items as string) || "[]"); if (Array.isArray(a)) items = a; } catch { /* ignore */ }
  try { const a = JSON.parse((invoice.notesLog as string) || "[]"); if (Array.isArray(a)) notesLog = a; } catch { /* ignore */ }
  return { ...invoice, itemsArr: items, notesArr: notesLog };
}
export async function getLeadInvoice(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, code: true, name: true, company: true, contactPerson: true, phone: true, email: true, stage: true, value: true, finalAmount: true, paymentStatus: true, pipeline: true, startDate: true, services: true } });
  if (!lead) return null;
  const invoice = await prisma.salesInvoice.findFirst({ where: { leadId }, orderBy: { createdAt: "desc" } });
  return { lead, invoice: hydrateInvoice(invoice as unknown as Record<string, unknown> | null) };
}

// One invoice by its own id (accountant dashboard route).
export async function getInvoiceById(id: string) {
  const invoice = await prisma.salesInvoice.findUnique({ where: { id } });
  if (!invoice) return null;
  const [lead, payments] = await Promise.all([
    invoice.leadId ? prisma.lead.findUnique({ where: { id: invoice.leadId }, select: { id: true, code: true, startDate: true } }) : Promise.resolve(null),
    prisma.payment.findMany({ where: { invoiceId: id }, orderBy: { date: "desc" } }),
  ]);
  return { invoice: hydrateInvoice(invoice as unknown as Record<string, unknown>), lead, payments };
}

// Public (no-auth) invoice fetch for the /share/invoice/[id] link sent to clients.
// Returns only the printable invoice fields — no lead / payment / internal data.
export async function getPublicInvoice(id: string) {
  const invoice = await prisma.salesInvoice.findUnique({ where: { id } });
  if (!invoice) return null;
  return hydrateInvoice(invoice as unknown as Record<string, unknown>);
}

// Recruitment / hiring pipeline — all candidates with stage counts.
export async function getCandidates() {
  const rows = await prisma.candidate.findMany({ orderBy: { updatedAt: "desc" } });
  const list = rows.map((c) => {
    let notesArr: { date: string; by: string; note: string }[] = [];
    try { const a = JSON.parse(c.notesLog || "[]"); if (Array.isArray(a)) notesArr = a; } catch { /* ignore */ }
    return {
      id: c.id, code: c.code, name: c.name, phone: c.phone, email: c.email, position: c.position,
      department: c.department, source: c.source, experience: c.experience, expectedCtc: c.expectedCtc,
      resumeUrl: c.resumeUrl, notes: c.notes, notesArr, stage: c.stage, rejectReason: c.rejectReason,
      createdAt: c.createdAt.toISOString().slice(0, 10), updatedAt: c.updatedAt.toISOString().slice(0, 10),
    };
  });
  const stageCount: Record<string, number> = {};
  for (const r of list) stageCount[r.stage] = (stageCount[r.stage] ?? 0) + 1;
  return { rows: list, stageCount };
}

// The accountant's home dashboard — client finance (invoice / received / pending / date),
// split by Website Development vs Digital Marketing, with a monthly breakdown.
export async function getAccountantDashboard() {
  const today = salesToday();
  const thisMonth = today.slice(0, 7);
  const [ty, tmo] = thisMonth.split("-").map(Number);
  const lastMonth = new Date(Date.UTC(ty, tmo - 2, 1)).toISOString().slice(0, 7); // previous calendar month
  const [invoices, clients, employees, leads, monthPay, lastMonthPay] = await Promise.all([
    prisma.salesInvoice.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.client.findMany({ select: { id: true, code: true, name: true, monthlyRetainer: true } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true, email: true, phone: true }, orderBy: [{ role: "asc" }, { name: "asc" }] }),
    prisma.lead.findMany({ select: { id: true, services: true } }),
    prisma.payment.aggregate({ where: { date: { startsWith: thisMonth } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { date: { startsWith: lastMonth } }, _sum: { amount: true } }),
  ]);
  const leadSvc = new Map(leads.map((l) => [l.id, parseServices(l.services)]));
  const clientCode = new Map(clients.map((c) => [c.id, c.code]));
  // effective due date: explicit dueDate, else Net-15 from issue date (keeps old rows sane)
  const dueOf = (i: { dueDate: string; issueDate: string }) => i.dueDate || addDays(i.issueDate, 15);
  const invoiceRows = invoices.map((i) => {
    const balance = i.total - i.received;
    const due = dueOf(i);
    return {
      id: i.id, clientId: i.clientId, code: (i.clientId && clientCode.get(i.clientId)) || "", number: i.number, billTo: i.billTo, contact: i.contact, phone: i.phone, email: i.email,
      total: i.total, received: i.received, balance, approved: i.approved,
      paymentStatus: i.paymentStatus, issueDate: i.issueDate, dueDate: due, nextFollowup: i.nextFollowup,
      month: (i.issueDate || "").slice(0, 7),
      category: catOfInvoice(i, leadSvc), overdue: balance > 0 && !!due && due < today,
    };
  });

  const totals = {
    invoices: invoices.length,
    billed: invoices.reduce((s, i) => s + i.total, 0),
    received: invoices.reduce((s, i) => s + i.received, 0),
    pending: invoices.reduce((s, i) => s + (i.total - i.received), 0),
    overdue: invoiceRows.filter((r) => r.overdue).length,
    overdueAmount: invoiceRows.filter((r) => r.overdue).reduce((s, r) => s + r.balance, 0),
    monthReceived: monthPay._sum.amount ?? 0, // payments actually dated this month (from the ledger)
    lastMonthReceived: lastMonthPay._sum.amount ?? 0, // payments dated last month — for the vs-last-month comparison
    monthBilled: invoiceRows.filter((r) => r.month === thisMonth).reduce((s, r) => s + r.total, 0),
    // Website Development (project) payments — billed vs received across Website/Both invoices.
    webBilled: invoiceRows.filter((r) => r.category === "Website" || r.category === "Both").reduce((s, r) => s + r.total, 0),
    webReceived: invoiceRows.filter((r) => r.category === "Website" || r.category === "Both").reduce((s, r) => s + r.received, 0),
    pendingApproval: invoices.filter((i) => !i.approved).length,
    clients: clients.length,
    employees: employees.length,
    monthlyDm: clients.reduce((s, c) => s + (c.monthlyRetainer || 0), 0), // recurring DM retainers / month
  };

  // Receivables aging — bucket each outstanding balance by days past its due date.
  const aging = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };
  for (const r of invoiceRows) {
    if (r.balance <= 0) continue;
    const over = daysBetween(r.dueDate, today); // >0 means overdue by that many days
    if (over <= 0) aging.current += r.balance;
    else if (over <= 30) aging.d30 += r.balance;
    else if (over <= 60) aging.d60 += r.balance;
    else if (over <= 90) aging.d90 += r.balance;
    else aging.d90plus += r.balance;
  }

  // monthly breakdown (by invoice date) — billed / received / pending + Website vs DM split
  const byMonth: Record<string, { month: string; billed: number; received: number; pending: number; web: number; dm: number }> = {};
  for (const r of invoiceRows) {
    if (!r.month) continue;
    const m = (byMonth[r.month] ??= { month: r.month, billed: 0, received: 0, pending: 0, web: 0, dm: 0 });
    m.billed += r.total; m.received += r.received; m.pending += r.balance;
    if (r.category === "Website" || r.category === "Both") m.web += r.total;
    if (r.category === "Digital Marketing" || r.category === "Both") m.dm += r.total;
  }
  const monthlyRows = Object.values(byMonth).sort((a, b) => (a.month < b.month ? 1 : -1));

  const amUsers = employees.filter((e) => ["ACCOUNT_MANAGER", "AM_HEAD", "DM_EXEC"].includes(e.role)).map((e) => ({ id: e.id, name: e.name }));
  return { totals, invoiceRows, monthlyRows, employees, aging, amUsers };
}

// Category of a set of services → Website / Digital Marketing / Both / Other.
// Tolerant of the plain category labels ("Website Development" / "Digital Marketing")
// used on accountant-raised single-service invoices, in addition to the specific
// SERVICE_GROUPS members recognised by serviceKind().
function catOfServices(svc: string[]): string {
  const k = serviceKind(svc);
  const norm = svc.map((s) => (s || "").trim().toLowerCase());
  const web = k.web || norm.some((s) => s.includes("website"));
  const dm = k.dm || norm.some((s) => s.includes("digital marketing") || s.includes("retainer") || s === "dm");
  return web && dm ? "Both" : web ? "Website" : dm ? "Digital Marketing" : "Other";
}
// Invoice category from its lead services or line items.
function catOfInvoice(inv: { leadId: string | null; items: string }, leadSvc: Map<string, string[]>): string {
  let svc = inv.leadId ? (leadSvc.get(inv.leadId) ?? []) : [];
  if (svc.length === 0) { try { const items = JSON.parse(inv.items || "[]"); svc = Array.isArray(items) ? items.map((it: { name?: string }) => it.name || "") : []; } catch { /* ignore */ } }
  return catOfServices(svc);
}

// Finance → Clients section: every client with their invoices (per-invoice detail),
// so the list can filter by category / date and recompute totals dynamically.
export async function getFinanceClients() {
  const today = salesToday();
  const [clients, invoices, leads, amUsers] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true, pocName: true, pocMobile: true, pocEmail: true, monthlyRetainer: true, status: true, followupLog: true, nextFollowup: true, accountManager: { select: { name: true } } } }),
    prisma.salesInvoice.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, number: true, clientId: true, billTo: true, total: true, received: true, issueDate: true, dueDate: true, leadId: true, items: true, notesLog: true, company: true, taxPct: true } }),
    prisma.lead.findMany({ select: { id: true, services: true } }),
    prisma.user.findMany({ where: { active: true, role: { in: ["ACCOUNT_MANAGER", "AM_HEAD", "DM_EXEC"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const leadSvc = new Map(leads.map((l) => [l.id, parseServices(l.services)]));
  const nameToId = new Map(clients.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const dueOf = (i: { dueDate: string; issueDate: string }) => i.dueDate || addDays(i.issueDate, 15);

  type MiniInv = { category: string; total: number; received: number; balance: number; overdue: boolean; issueDate: string; company: string };
  type Note = { invId: string; invNumber: string; date: string; by: string; note: string };
  const byClient = new Map<string, MiniInv[]>();
  const notesByClient = new Map<string, Note[]>();
  const recentByClient = new Map<string, { id: string; number: string }>();      // most recent invoice
  const outstandingByClient = new Map<string, { id: string; number: string }>();  // most recent outstanding invoice
  const lastDateByClient = new Map<string, string>();                             // latest invoice issue date
  const companiesByClient = new Map<string, Set<string>>();                       // billing entities used
  for (const inv of invoices) { // ordered createdAt desc → first seen is most recent
    const cid = inv.clientId || nameToId.get((inv.billTo || "").trim().toLowerCase());
    if (!cid) continue;
    const bal = inv.total - inv.received;
    const due = dueOf(inv);
    const cat = catOfInvoice(inv, leadSvc);
    // Company tag; legacy invoices (no tag) are inferred from GST + service.
    const company = inv.company || (inv.taxPct > 0 ? "WEB_ROCZ_PVT" : (cat === "Digital Marketing" ? "WEB_ROCZ" : "WEB_SOLUTIONS"));
    const list = byClient.get(cid) ?? [];
    list.push({ category: cat, total: inv.total, received: inv.received, balance: bal, overdue: bal > 0 && !!due && due < today, issueDate: inv.issueDate, company });
    byClient.set(cid, list);
    { const set = companiesByClient.get(cid) ?? new Set<string>(); set.add(company); companiesByClient.set(cid, set); }
    if (inv.issueDate && (lastDateByClient.get(cid) ?? "") < inv.issueDate) lastDateByClient.set(cid, inv.issueDate);
    // collect this invoice's follow-up notes under the client
    try { const arr = JSON.parse(inv.notesLog || "[]"); if (Array.isArray(arr)) { const ns = notesByClient.get(cid) ?? []; for (const n of arr) ns.push({ invId: inv.id, invNumber: inv.number, date: n.date ?? "", by: n.by ?? "", note: n.note ?? "" }); notesByClient.set(cid, ns); } } catch { /* ignore */ }
    if (!recentByClient.has(cid)) recentByClient.set(cid, { id: inv.id, number: inv.number });
    if (bal > 0 && !outstandingByClient.has(cid)) outstandingByClient.set(cid, { id: inv.id, number: inv.number });
  }

  const rows = clients.map((c) => {
    const invs = byClient.get(c.id) ?? [];
    const web = invs.some((i) => i.category === "Website" || i.category === "Both");
    const dm = invs.some((i) => i.category === "Digital Marketing" || i.category === "Both");
    const category = web && dm ? "Both" : web ? "Website" : dm ? "Digital Marketing" : "—";
    const notes = (notesByClient.get(c.id) ?? []).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
    const billed = invs.reduce((s, i) => s + i.total, 0);
    const received = invs.reduce((s, i) => s + i.received, 0);
    const pending = invs.reduce((s, i) => s + i.balance, 0);
    // Client-level follow-up log (accountant's own notes on the client, with their name).
    let clientFollowups: { date: string; by: string; note: string; next?: string }[] = [];
    try { const arr = JSON.parse(c.followupLog || "[]"); if (Array.isArray(arr)) clientFollowups = arr; } catch { /* ignore */ }
    return {
      id: c.id, code: c.code, name: c.name, contact: c.pocName ?? "", phone: c.pocMobile ?? "", email: c.pocEmail ?? "",
      accountManager: c.accountManager?.name ?? "",
      status: c.status, retainer: c.monthlyRetainer || 0, category, invs,
      lastInvoiceDate: lastDateByClient.get(c.id) ?? "", billed, received, pending,
      companies: [...(companiesByClient.get(c.id) ?? [])],
      clientFollowups: clientFollowups.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30),
      nextFollowup: c.nextFollowup ?? "",
      notes, noteTarget: outstandingByClient.get(c.id) ?? recentByClient.get(c.id) ?? null,
    };
  });
  return { rows, amUsers };
}

// Finance → Payments ledger: every recorded payment across all clients, with the
// client + invoice it belongs to, so you can drill into a single client's info.
export async function getFinancePayments() {
  const [payments, invoices, clients, leads] = await Promise.all([
    prisma.payment.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    prisma.salesInvoice.findMany({ select: { id: true, number: true, clientId: true, billTo: true, items: true, leadId: true } }),
    prisma.client.findMany({ select: { id: true, name: true } }),
    prisma.lead.findMany({ select: { id: true, services: true } }),
  ]);
  const invMap = new Map(invoices.map((i) => [i.id, i]));
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const leadSvc = new Map(leads.map((l) => [l.id, parseServices(l.services)]));
  const rows = payments.map((p) => {
    const inv = invMap.get(p.invoiceId);
    const clientId = inv?.clientId ?? null;
    const name = (clientId && clientName.get(clientId)) || inv?.billTo || "—";
    const category = inv ? catOfInvoice(inv, leadSvc) : "—";
    return {
      id: p.id, date: p.date, amount: p.amount, mode: p.mode, ref: p.ref, note: p.note, by: p.by,
      invoiceNumber: inv?.number ?? "", clientId, clientName: name, category,
    };
  });
  return { rows };
}

// Finance → GST summary: month-wise GST collected, split CGST/SGST (intra-state) vs
// IGST (inter-state) based on the invoice's place of supply vs the agency's home state.
const GST_SUPPLIER_STATE_CODE = "36"; // Telangana
export async function getGstSummary() {
  const invoices = await prisma.salesInvoice.findMany({ select: { subtotal: true, taxPct: true, taxAmount: true, total: true, placeOfSupply: true, clientState: true, issueDate: true } });
  const stateCode = (s: string) => { const m = (s || "").trim().match(/^(\d+)/); return m ? m[1] : ""; };
  type M = { month: string; count: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number; total: number };
  const byMonth = new Map<string, M>();
  for (const i of invoices) {
    // Only GST invoices belong in a GST summary — non-GST (exempt) supplies are not
    // taxable value and would otherwise inflate the totals.
    if (i.taxPct <= 0) continue;
    const month = (i.issueDate || "").slice(0, 7);
    if (!month) continue;
    const code = stateCode(i.placeOfSupply || i.clientState || "");
    // Default (no place of supply set) is treated as intra-state (Telangana).
    const intra = !code || code === GST_SUPPLIER_STATE_CODE;
    const m = byMonth.get(month) ?? { month, count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, total: 0 };
    m.count += 1; m.taxable += i.subtotal; m.tax += i.taxAmount; m.total += i.total;
    if (intra) { const half = Math.floor(i.taxAmount / 2); m.cgst += half; m.sgst += i.taxAmount - half; }
    else m.igst += i.taxAmount;
    byMonth.set(month, m);
  }
  const rows = [...byMonth.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
  return { rows, supplierState: "Telangana (36)" };
}

// Finance → Reports: monthly financials, top clients by revenue, and collections by mode.
// Optional date range (issueDate for invoices, payment date for collections) scopes everything.
export async function getFinanceReports(opts: { from?: string; to?: string } = {}) {
  const from = opts.from || "", to = opts.to || "";
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
  const [invoicesAll, paymentsAll, clients, leads] = await Promise.all([
    prisma.salesInvoice.findMany({ select: { total: true, received: true, issueDate: true, clientId: true, billTo: true, company: true, taxPct: true, items: true, leadId: true } }),
    prisma.payment.findMany({ select: { amount: true, date: true, mode: true } }),
    prisma.client.findMany({ select: { id: true, name: true } }),
    prisma.lead.findMany({ select: { id: true, services: true } }),
  ]);
  const invoices = invoicesAll.filter((i) => inRange(i.issueDate || ""));
  const payments = paymentsAll.filter((p) => inRange(p.date || ""));
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const nameToId = new Map(clients.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const reportLeadSvc = new Map(leads.map((l) => [l.id, parseServices(l.services)]));
  // Company for an invoice: its tag, or inferred from GST + service (legacy invoices).
  const companyOf = (i: { company: string; taxPct: number; items: string; leadId: string | null }) =>
    i.company || (i.taxPct > 0 ? "WEB_ROCZ_PVT" : (catOfInvoice(i, reportLeadSvc) === "Digital Marketing" ? "WEB_ROCZ" : "WEB_SOLUTIONS"));

  // monthly: billed / received / pending by invoice issue month
  type M = { month: string; invoices: number; billed: number; received: number; pending: number; collected: number };
  const byMonth = new Map<string, M>();
  const blank = (month: string): M => ({ month, invoices: 0, billed: 0, received: 0, pending: 0, collected: 0 });
  for (const i of invoices) {
    const m = (i.issueDate || "").slice(0, 7);
    if (!m) continue;
    const row = byMonth.get(m) ?? blank(m);
    row.invoices += 1; row.billed += i.total; row.received += i.received; row.pending += i.total - i.received;
    byMonth.set(m, row);
  }
  // collected: payments by their own month
  const byMode = new Map<string, number>();
  for (const p of payments) {
    const m = (p.date || "").slice(0, 7);
    if (m) { const row = byMonth.get(m) ?? blank(m); row.collected += p.amount; byMonth.set(m, row); }
    byMode.set(p.mode, (byMode.get(p.mode) ?? 0) + p.amount);
  }
  const monthly = [...byMonth.values()].sort((a, b) => (a.month < b.month ? 1 : -1));

  // top clients by billed
  const byClient = new Map<string, { name: string; billed: number; received: number; pending: number; invoices: number }>();
  for (const i of invoices) {
    const cid = i.clientId || nameToId.get((i.billTo || "").trim().toLowerCase()) || i.billTo || "—";
    const name = (i.clientId && clientName.get(i.clientId)) || i.billTo || "—";
    const row = byClient.get(cid) ?? { name, billed: 0, received: 0, pending: 0, invoices: 0 };
    row.billed += i.total; row.received += i.received; row.pending += i.total - i.received; row.invoices += 1;
    byClient.set(cid, row);
  }
  const topClients = [...byClient.values()].sort((a, b) => b.billed - a.billed).slice(0, 10);
  const modes = [...byMode.entries()].map(([mode, amount]) => ({ mode, amount })).sort((a, b) => b.amount - a.amount);

  // Per-company breakdown (Web Solutions / Web Rocz / Web Rocz Pvt Ltd), always all three.
  const compKeys = ["WEB_ROCZ_PVT", "WEB_SOLUTIONS", "WEB_ROCZ"];
  const compAgg = new Map<string, { company: string; billed: number; received: number; pending: number; invoices: number }>();
  for (const k of compKeys) compAgg.set(k, { company: k, billed: 0, received: 0, pending: 0, invoices: 0 });
  for (const i of invoices) {
    const key = companyOf(i);
    const row = compAgg.get(key) ?? { company: key, billed: 0, received: 0, pending: 0, invoices: 0 };
    row.billed += i.total; row.received += i.received; row.pending += i.total - i.received; row.invoices += 1;
    compAgg.set(key, row);
  }
  const companies = compKeys.map((k) => compAgg.get(k)!);

  const totals = {
    billed: invoices.reduce((s, i) => s + i.total, 0),
    received: invoices.reduce((s, i) => s + i.received, 0),
    pending: invoices.reduce((s, i) => s + (i.total - i.received), 0),
    collected: payments.reduce((s, p) => s + p.amount, 0),
  };
  return { monthly, topClients, modes, totals, companies };
}

// Finance → Website renewals: each client's website + hosting + expiry, with an
// "expiring soon" flag (≤ 30 days or already past). One website per client.
export async function getWebsiteRenewals() {
  const today = salesToday();
  const [clients, invoices, leads] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, pocMobile: true, pocEmail: true, status: true, website: true, websiteName: true, websiteDomain: true, hostingTaken: true, websiteTakenDate: true, websiteExpiryDate: true, websiteRenewAmount: true, gstApplicable: true },
    }),
    prisma.salesInvoice.findMany({ select: { clientId: true, billTo: true, items: true, leadId: true, company: true, taxPct: true } }),
    prisma.lead.findMany({ select: { id: true, services: true } }),
  ]);
  const leadSvc = new Map(leads.map((l) => [l.id, parseServices(l.services)]));
  const nameToId = new Map(clients.map((c) => [c.name.trim().toLowerCase(), c.id]));
  // Clients who took a website → they need renewal tracking. Matches the Web Solutions
  // pipeline: a Website/Both invoice, OR any invoice billed under the Web Solutions entity.
  // Also track whether each client's website work is GST (Web Rocz Pvt Ltd) or non-GST (Web Solutions).
  const websiteClientIds = new Set<string>();
  const websiteGstIds = new Set<string>();    // has a GST website invoice
  const websiteNoGstIds = new Set<string>();  // has a non-GST website invoice
  for (const inv of invoices) {
    const cid = inv.clientId || nameToId.get((inv.billTo || "").trim().toLowerCase());
    if (!cid) continue;
    const cat = catOfInvoice(inv, leadSvc);
    const company = inv.company || (inv.taxPct > 0 ? "WEB_ROCZ_PVT" : (cat === "Digital Marketing" ? "WEB_ROCZ" : "WEB_SOLUTIONS"));
    const isWebsite = cat === "Website" || cat === "Both" || company === "WEB_SOLUTIONS";
    if (!isWebsite) continue;
    websiteClientIds.add(cid);
    if (company === "WEB_ROCZ_PVT") websiteGstIds.add(cid); else websiteNoGstIds.add(cid);
  }
  const rows = clients.map((c) => {
    const domain = c.websiteDomain || c.website || "";
    const expiry = c.websiteExpiryDate || "";
    const daysToExpiry = expiry ? daysBetween(today, expiry) : null; // + future, - past
    const expired = daysToExpiry !== null && daysToExpiry < 0;
    const expiring = daysToExpiry !== null && daysToExpiry <= 30; // within a month (incl. past)
    const detailsFilled = !!(c.websiteName || c.websiteDomain || expiry);
    const isWebsiteClient = websiteClientIds.has(c.id); // took a website (Web Solutions / website work)
    const hasWebsite = isWebsiteClient || detailsFilled;  // belongs in the renewals list
    // GST classification for the With/Without GST filter (fall back to the client's GST setting).
    const websiteGst = websiteGstIds.has(c.id) || (!isWebsiteClient && detailsFilled && c.gstApplicable);
    const websiteNoGst = websiteNoGstIds.has(c.id) || (!isWebsiteClient && detailsFilled && !c.gstApplicable);
    return {
      id: c.id, code: c.code, name: c.name, phone: c.pocMobile ?? "", email: c.pocEmail ?? "",
      status: c.status, websiteName: c.websiteName || "", domain,
      hostingTaken: c.hostingTaken, takenDate: c.websiteTakenDate || "", expiryDate: expiry,
      renewAmount: c.websiteRenewAmount || 0,
      daysToExpiry, expiring, expired, hasWebsite, detailsFilled, isWebsiteClient, websiteGst, websiteNoGst,
    };
  });
  const withWeb = rows.filter((r) => r.hasWebsite);
  const soon = withWeb.filter((r) => r.expiring); // expiring soon or already past
  const counts = {
    all: rows.length,
    tracked: withWeb.length,
    hosting: withWeb.filter((r) => r.hostingTaken).length,
    expiring: withWeb.filter((r) => r.expiring && !r.expired).length,
    expired: withWeb.filter((r) => r.expired).length,
  };
  const totals = {
    renewDue: soon.reduce((s, r) => s + r.renewAmount, 0),   // amount to renew for expiring/expired sites
    renewAll: withWeb.reduce((s, r) => s + r.renewAmount, 0), // amount across all tracked sites
  };
  return { rows, counts, totals };
}

// Finance → single client detail: profile, invoices, and the payment ledger.
export async function getFinanceClientDetail(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, code: true, name: true, website: true, industry: true, pocName: true, pocMobile: true, pocEmail: true, monthlyRetainer: true, status: true, renewalDate: true, gstApplicable: true, gstRate: true, gstin: true, onboardDate: true, notes: true, websiteName: true, websiteDomain: true, hostingTaken: true, websiteTakenDate: true, websiteExpiryDate: true, websiteRenewAmount: true, followupLog: true, nextFollowup: true, accountManagerId: true },
  });
  if (!client) return null;
  const [invoicesRaw, leads, amUsers, slasRaw] = await Promise.all([
    // Match by clientId, or by billTo name ONLY for unlinked invoices (no clientId) —
    // so a same-named client's invoices aren't over-counted here.
    prisma.salesInvoice.findMany({ where: { OR: [{ clientId }, { AND: [{ clientId: null }, { billTo: client.name }] }] }, orderBy: { createdAt: "desc" } }),
    prisma.lead.findMany({ select: { id: true, services: true } }),
    // AM-eligible team members the accountant can assign as the account manager.
    prisma.user.findMany({ where: { active: true, role: { in: ["ACCOUNT_MANAGER", "AM_HEAD", "DM_EXEC"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.sla.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
  ]);
  const slas = slasRaw.map((x) => ({ id: x.id, title: x.title, service: x.service, amount: x.amount, gst: x.gst, fileUrl: x.fileUrl, notes: x.notes, status: x.status, uploadedBy: x.uploadedBy, createdAt: x.createdAt.toISOString().slice(0, 10) }));
  const leadSvc = new Map(leads.map((l) => [l.id, parseServices(l.services)]));
  const today = salesToday();
  const dueOf = (i: { dueDate: string; issueDate: string }) => i.dueDate || addDays(i.issueDate, 15);
  const invoices = invoicesRaw.map((i) => {
    const balance = i.total - i.received;
    const due = dueOf(i);
    let followups: { date: string; by: string; note: string }[] = [];
    try { const arr = JSON.parse(i.notesLog || "[]"); if (Array.isArray(arr)) followups = arr; } catch { /* ignore */ }
    const cat = catOfInvoice(i, leadSvc);
    // Legacy invoices with no company tag: infer from GST + service (same rule as the lists).
    const company = i.company || (i.taxPct > 0 ? "WEB_ROCZ_PVT" : (cat === "Digital Marketing" ? "WEB_ROCZ" : "WEB_SOLUTIONS"));
    return {
      id: i.id, number: i.number, total: i.total, received: i.received, balance, approved: i.approved,
      paymentStatus: i.paymentStatus, issueDate: i.issueDate, dueDate: due, leadId: i.leadId,
      category: cat, overdue: balance > 0 && !!due && due < today,
      company, followups,
    };
  });
  const invIds = invoices.map((i) => i.id);
  const paymentsRaw = invIds.length ? await prisma.payment.findMany({ where: { invoiceId: { in: invIds } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }) : [];
  const numById = new Map(invoices.map((i) => [i.id, i.number]));
  const payments = paymentsRaw.map((p) => ({ id: p.id, invoiceId: p.invoiceId, invoiceNumber: numById.get(p.invoiceId) ?? "", amount: p.amount, date: p.date, mode: p.mode, ref: p.ref, note: p.note, by: p.by }));

  const totals = {
    billed: invoices.reduce((s, i) => s + i.total, 0),
    received: invoices.reduce((s, i) => s + i.received, 0),
    pending: invoices.reduce((s, i) => s + i.balance, 0),
    overdue: invoices.filter((i) => i.overdue).reduce((s, i) => s + i.balance, 0),
    invoices: invoices.length,
  };
  let clientFollowups: { date: string; by: string; note: string; next?: string }[] = [];
  try { const arr = JSON.parse(client.followupLog || "[]"); if (Array.isArray(arr)) clientFollowups = arr.sort((a, b) => (a.date < b.date ? 1 : -1)); } catch { /* ignore */ }
  return { client: { ...client, onboardDate: client.onboardDate.toISOString().slice(0, 10) }, invoices, payments, totals, clientFollowups, amUsers, slas };
}

// Super Admin overview — sales pipeline + finance in one easy-to-read summary.
export async function getAdminSalesFinance() {
  const today = salesToday();
  const ym = today.slice(0, 7);
  const [leads, invoices, fups, rems] = await Promise.all([
    prisma.lead.findMany({ where: { pipeline: "WEBROCZ" }, select: { id: true, stage: true, services: true, value: true, startDate: true } }),
    prisma.salesInvoice.findMany({ select: { total: true, received: true, approved: true, issueDate: true, leadId: true, items: true } }),
    prisma.followup.findMany({ where: { status: "PENDING" }, select: { date: true, nextDate: true } }),
    prisma.reminder.findMany({ where: { status: "PENDING" }, select: { date: true } }),
  ]);

  // ---- Sales: per-stage counts + pipeline value + category split ----
  const stageCounts: Record<string, number> = {};
  for (const k of SALES_STAGE_KEYS) stageCounts[k] = 0;
  let activeValue = 0, wonValue = 0;
  let webCount = 0, dmCount = 0, webValue = 0, dmValue = 0;
  let onboardedThisMonth = 0;
  for (const l of leads) {
    stageCounts[l.stage] = (stageCounts[l.stage] ?? 0) + 1;
    if (l.stage === "ONBOARDED") { wonValue += l.value || 0; if ((l.startDate || "").slice(0, 7) === ym) onboardedThisMonth++; }
    if (l.stage !== "LOST" && l.stage !== "ONBOARDED") activeValue += l.value || 0;
    if (l.stage === "LOST") continue;
    const k = serviceKind(parseServices(l.services));
    if (k.web) { webCount++; webValue += l.value || 0; }
    if (k.dm) { dmCount++; dmValue += l.value || 0; }
  }
  const dueDates = [...fups.map((f) => f.nextDate || f.date), ...rems.map((r) => r.date)].filter(Boolean) as string[];
  const remindersDue = dueDates.filter((d) => d <= today).length;

  // ---- Finance: totals + monthly Website vs DM split (same rules as accountant) ----
  const leadSvc = new Map(leads.map((l) => [l.id, parseServices(l.services)]));
  const catOf = (inv: { leadId: string | null; items: string }): "Website" | "Digital Marketing" | "Both" | "Other" => {
    let svc = inv.leadId ? (leadSvc.get(inv.leadId) ?? []) : [];
    if (svc.length === 0) { try { const items = JSON.parse(inv.items || "[]"); svc = Array.isArray(items) ? items.map((it: { name?: string }) => it.name || "") : []; } catch { /* ignore */ } }
    const k = serviceKind(svc);
    return k.web && k.dm ? "Both" : k.web ? "Website" : k.dm ? "Digital Marketing" : "Other";
  };
  const finance = {
    invoices: invoices.length,
    billed: invoices.reduce((s, i) => s + i.total, 0),
    received: invoices.reduce((s, i) => s + i.received, 0),
    pending: invoices.reduce((s, i) => s + (i.total - i.received), 0),
    overdue: invoices.filter((i) => i.total - i.received > 0 && !!i.issueDate && i.issueDate < today).length,
    pendingApproval: invoices.filter((i) => !i.approved).length,
  };
  const byMonth: Record<string, { month: string; billed: number; received: number; web: number; dm: number }> = {};
  for (const i of invoices) {
    const m = (i.issueDate || "").slice(0, 7); if (!m) continue;
    const row = (byMonth[m] ??= { month: m, billed: 0, received: 0, web: 0, dm: 0 });
    row.billed += i.total; row.received += i.received;
    const c = catOf(i);
    if (c === "Website" || c === "Both") row.web += i.total;
    if (c === "Digital Marketing" || c === "Both") row.dm += i.total;
  }
  const monthly = Object.values(byMonth).sort((a, b) => (a.month < b.month ? 1 : -1)).slice(0, 4);

  return {
    stageCounts, activeValue, wonValue, onboardedThisMonth, remindersDue,
    totalLeads: leads.length,
    category: { web: { count: webCount, value: webValue }, dm: { count: dmCount, value: dmValue } },
    finance, monthly,
  };
}

// All invoices for the accountant / finance dashboard.
export async function getInvoices(opts: { q?: string; status?: string; company?: string } = {}) {
  const today = salesToday();
  const [rows, invLeads, clients] = await Promise.all([
    prisma.salesInvoice.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.lead.findMany({ select: { id: true, services: true } }),
    prisma.client.findMany({ select: { id: true, name: true } }),
  ]);
  const invLeadSvc = new Map(invLeads.map((l) => [l.id, parseServices(l.services)]));
  // Resolve invoices with no clientId to a client by exact (case-insensitive) name, so the
  // client name in the list can still deep-link to the detail page where possible.
  const nameToId = new Map(clients.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const list = rows.map((r) => {
    const balance = r.total - r.received;
    const dueDate = r.dueDate || addDays(r.issueDate, 15);
    // Legacy invoices without a company tag: infer from GST + service so filters/reports stay complete.
    const company = r.company || (r.taxPct > 0 ? "WEB_ROCZ_PVT" : (catOfInvoice(r, invLeadSvc) === "Digital Marketing" ? "WEB_ROCZ" : "WEB_SOLUTIONS"));
    let followups: { date: string; by: string; note: string }[] = [];
    try { const arr = JSON.parse(r.notesLog || "[]"); if (Array.isArray(arr)) followups = arr; } catch { /* ignore */ }
    const clientId = r.clientId || nameToId.get((r.billTo || "").trim().toLowerCase()) || null;
    return {
      id: r.id, number: r.number, billTo: r.billTo, clientId, contact: r.contact, phone: r.phone, email: r.email,
      total: r.total, received: r.received, balance, paymentStatus: r.paymentStatus,
      approved: r.approved, issueDate: r.issueDate, dueDate, overdue: balance > 0 && !!dueDate && dueDate < today,
      pipeline: r.pipeline, company, gst: r.taxPct > 0, leadId: r.leadId, nextFollowup: r.nextFollowup, followups,
    };
  });
  const q = (opts.q || "").toLowerCase().trim();
  const matchStatus = (r: (typeof list)[number]) => {
    if (opts.status === "approved" && !r.approved) return false;
    if (opts.status === "pending_approval" && r.approved) return false;
    if (opts.status === "unpaid" && r.balance <= 0) return false;
    if (opts.status === "paid" && r.balance > 0) return false;
    if (opts.status === "overdue" && !r.overdue) return false;
    return true;
  };
  // Rows matching search + status but NOT the company tab — used for per-tab counts.
  const scoped = list.filter((r) => (!q || `${r.number} ${r.billTo} ${r.contact ?? ""} ${r.phone ?? ""}`.toLowerCase().includes(q)) && matchStatus(r));
  const companyCounts: Record<string, { count: number; billed: number }> = {
    ALL: { count: scoped.length, billed: scoped.reduce((s, r) => s + r.total, 0) },
  };
  for (const key of ["WEB_ROCZ_PVT", "WEB_SOLUTIONS", "WEB_ROCZ"]) {
    const g = scoped.filter((r) => r.company === key);
    companyCounts[key] = { count: g.length, billed: g.reduce((s, r) => s + r.total, 0) };
  }
  const filtered = scoped.filter((r) => !opts.company || opts.company === "ALL" || r.company === opts.company);
  const totals = {
    count: filtered.length,
    billed: filtered.reduce((s, r) => s + r.total, 0),
    received: filtered.reduce((s, r) => s + r.received, 0),
    balance: filtered.reduce((s, r) => s + r.balance, 0),
    pendingApproval: list.filter((r) => !r.approved).length,
  };
  const clientNames = clients.map((c) => c.name).sort((a, b) => a.localeCompare(b));
  return { rows: filtered, totals, companyCounts, clientNames };
}

// SLA board: every uploaded SLA (with client + generated-invoice number) plus the
// client list for the sales upload picker. Shared by sales (upload) and accountant (generate).
export async function getSlaBoard() {
  const [slas, invoices] = await Promise.all([
    prisma.sla.findMany({ orderBy: { createdAt: "desc" }, include: { client: { select: { name: true, code: true } } } }),
    prisma.salesInvoice.findMany({ select: { id: true, number: true } }),
  ]);
  const invNum = new Map(invoices.map((i) => [i.id, i.number]));
  const rows = slas.map((x) => ({
    id: x.id, clientId: x.clientId ?? "", clientName: x.clientName || x.client?.name || "—", clientCode: x.client?.code ?? "", matched: !!x.clientId,
    title: x.title, service: x.service, amount: x.amount, gst: x.gst, fileUrl: x.fileUrl, notes: x.notes,
    pocMobile: x.pocMobile, pocEmail: x.pocEmail, gstin: x.gstin,
    status: x.status, invoiceNumber: x.invoiceId ? (invNum.get(x.invoiceId) ?? "") : "",
    uploadedBy: x.uploadedBy, createdAt: x.createdAt.toISOString().slice(0, 10),
  }));
  const counts = { all: rows.length, pending: rows.filter((r) => r.status === "UPLOADED").length, invoiced: rows.filter((r) => r.status === "INVOICED").length };
  const totals = { pendingAmount: rows.filter((r) => r.status === "UPLOADED").reduce((s, r) => s + r.amount, 0) };
  return { rows, counts, totals };
}

export async function getFollowupsBoard(userId: string, role: string, pipeline = "WEBROCZ") {
  // Team-wide visibility: everyone sees all follow-ups for the pipeline.
  const where = { lead: { pipeline } };
  const fus = await prisma.followup.findMany({ where, include: { lead: { select: { id: true, code: true, name: true, company: true, assignedTo: { select: { name: true } } } } }, orderBy: [{ date: "asc" }] });
  const today = salesToday();
  const rows = fus.map((f) => ({
    id: f.id, leadId: f.leadId, leadCode: f.lead.code, leadName: f.lead.name, company: f.lead.company,
    owner: f.lead.assignedTo?.name ?? "—", date: f.date, time: f.time, type: f.type, notes: f.notes, status: f.status,
    overdue: f.status === "PENDING" && !!f.date && f.date < today,
    dueToday: f.status === "PENDING" && f.date === today,
  }));
  const buckets = {
    today: rows.filter((r) => r.dueToday),
    overdue: rows.filter((r) => r.overdue),
    upcoming: rows.filter((r) => r.status === "PENDING" && !!r.date && r.date > today),
    completed: rows.filter((r) => r.status === "COMPLETED"),
    rescheduled: rows.filter((r) => r.status === "RESCHEDULED"),
    noResponse: rows.filter((r) => r.status === "NO_RESPONSE"),
  };
  return { buckets, counts: { today: buckets.today.length, overdue: buckets.overdue.length, upcoming: buckets.upcoming.length, completed: buckets.completed.length, rescheduled: buckets.rescheduled.length, noResponse: buckets.noResponse.length } };
}

// Website projects awaiting assignment + assigned — for Website Head / Super Admin oversight.
export async function getSalesClientOptions() {
  return prisma.user.findMany({ where: { active: true, role: { in: ["SALES_EXEC", "SALES_HEAD"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

// ---- Sales reports: service-wise + executive performance (DB-driven) ----
const SALES_REACHED_INTERESTED = ["INTERESTED", "QUOTATION", "PROPOSAL", "REMINDER", "MEETING", "ONBOARDED"];
export async function getSalesReports(pipeline = "WEBROCZ", from?: string, to?: string, execId?: string) {
  const dateWhere = (from || to) ? { createdAt: { ...(from ? { gte: new Date(from + "T00:00:00") } : {}), ...(to ? { lte: new Date(to + "T23:59:59") } : {}) } } : {};
  const leads = await prisma.lead.findMany({
    where: { pipeline, ...dateWhere, ...(execId ? { assignedToId: execId } : {}) },
    include: {
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { quotations: true, proposals: true, meetings: true } },
      followups: { where: { status: "COMPLETED" }, select: { id: true } },
    },
  });
  const parse = (s: string): string[] => { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };

  // service-wise
  const svc: Record<string, { leads: number; interested: number; quotations: number; onboarded: number; lost: number; revenue: number }> = {};
  for (const l of leads) {
    for (const service of parse(l.services)) {
      const row = (svc[service] ??= { leads: 0, interested: 0, quotations: 0, onboarded: 0, lost: 0, revenue: 0 });
      row.leads++;
      if (SALES_REACHED_INTERESTED.includes(l.stage)) row.interested++;
      if (l._count.quotations > 0) row.quotations++;
      if (l.stage === "ONBOARDED") { row.onboarded++; row.revenue += l.finalAmount || l.value; }
      if (l.stage === "LOST") row.lost++;
    }
  }
  const serviceRows = Object.entries(svc).map(([service, v]) => ({ service, ...v })).sort((a, b) => b.leads - a.leads);

  // executive performance
  const ex: Record<string, { id: string; name: string; leads: number; positive: number; followups: number; meetings: number; quotations: number; proposals: number; onboarded: number; lost: number; revenue: number }> = {};
  for (const l of leads) {
    const id = l.assignedToId ?? "unassigned";
    const row = (ex[id] ??= { id, name: l.assignedTo?.name ?? "Unassigned", leads: 0, positive: 0, followups: 0, meetings: 0, quotations: 0, proposals: 0, onboarded: 0, lost: 0, revenue: 0 });
    row.leads++;
    if (l.stage !== "LOST") row.positive++;
    row.followups += l.followups.length;
    row.meetings += l._count.meetings;
    row.quotations += l._count.quotations;
    row.proposals += l._count.proposals;
    if (l.stage === "ONBOARDED") { row.onboarded++; row.revenue += l.finalAmount || l.value; }
    if (l.stage === "LOST") row.lost++;
  }
  const execRows = Object.values(ex).sort((a, b) => b.onboarded - a.onboarded || b.leads - a.leads);

  // day-wise & month-wise (by lead created date) — for daily / monthly reports
  const byDay: Record<string, { date: string; leads: number; onboarded: number; lost: number; revenue: number }> = {};
  const byMonth: Record<string, { month: string; leads: number; onboarded: number; lost: number; revenue: number }> = {};
  for (const l of leads) {
    const d = l.createdAt.toISOString().slice(0, 10);
    const mth = d.slice(0, 7);
    const dr = (byDay[d] ??= { date: d, leads: 0, onboarded: 0, lost: 0, revenue: 0 });
    const mr = (byMonth[mth] ??= { month: mth, leads: 0, onboarded: 0, lost: 0, revenue: 0 });
    dr.leads++; mr.leads++;
    if (l.stage === "ONBOARDED") { const rev = l.finalAmount || l.value; dr.onboarded++; mr.onboarded++; dr.revenue += rev; mr.revenue += rev; }
    if (l.stage === "LOST") { dr.lost++; mr.lost++; }
  }
  const dailyRows = Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date));
  const monthlyRows = Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month));

  // category-wise (Website Development vs Digital Marketing) — a lead counts in each category it has
  const catAgg: Record<string, { category: string; leads: number; quotations: number; onboarded: number; lost: number; revenue: number }> = {
    WEBSITE: { category: "Website Development", leads: 0, quotations: 0, onboarded: 0, lost: 0, revenue: 0 },
    DM: { category: "Digital Marketing", leads: 0, quotations: 0, onboarded: 0, lost: 0, revenue: 0 },
  };
  for (const l of leads) {
    const k = serviceKind(parse(l.services));
    const targets = [k.web ? catAgg.WEBSITE : null, k.dm ? catAgg.DM : null].filter(Boolean) as (typeof catAgg.WEBSITE)[];
    for (const t of targets) {
      t.leads++;
      if (l._count.quotations > 0) t.quotations++;
      if (l.stage === "ONBOARDED") { t.onboarded++; t.revenue += l.finalAmount || l.value; }
      if (l.stage === "LOST") t.lost++;
    }
  }
  const categoryRows = Object.values(catAgg);

  const totals = {
    leads: leads.length,
    onboarded: leads.filter((l) => l.stage === "ONBOARDED").length,
    lost: leads.filter((l) => l.stage === "LOST").length,
    revenue: leads.filter((l) => l.stage === "ONBOARDED").reduce((s, l) => s + (l.finalAmount || l.value), 0),
  };
  return { serviceRows, execRows, categoryRows, dailyRows, monthlyRows, totals };
}

// ---- Digital Marketing assignment: onboarded marketing clients + assign a DM Executive ----
export async function getDmClients(userId: string, role: string) {
  const isHeadOrAdmin = ["SUPER_ADMIN", "SUB_ADMIN", "DM_HEAD"].includes(role);
  // clients created from sales onboarding with a DM/SEO service; scoped for a DM exec to their own.
  const clients = await prisma.client.findMany({
    where: {
      services: { some: { service: { in: ["SEO", "SMO", "META_ADS", "GOOGLE_ADS"] } } },
      ...(isHeadOrAdmin ? {} : { accountManagerId: userId }),
    },
    include: { accountManager: { select: { id: true, name: true } }, services: { select: { service: true } } },
    orderBy: { createdAt: "desc" },
  });
  const rows = clients.map((c) => ({
    id: c.id, code: c.code, name: c.name, poc: c.pocName, phone: c.pocMobile,
    retainer: c.monthlyRetainer, assigned: c.accountManager?.name ?? null, assignedId: c.accountManagerId,
    services: c.services.map((s) => s.service),
    createdAt: c.createdAt.toISOString().slice(0, 10),
  }));
  const execs = await prisma.user.findMany({ where: { active: true, role: { in: ["DM_EXEC", "ACCOUNT_MANAGER"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return {
    rows, execs,
    counts: { total: rows.length, unassigned: rows.filter((r) => !r.assignedId).length, assigned: rows.filter((r) => r.assignedId).length },
  };
}
