import "server-only";
import { prisma } from "./prisma";
import { todayIST } from "./india-date";

// Account manager's home page: their clients with this month's real numbers (Meta + Google
// Ads, social posts, design / video work), and what still has to be entered today. An account
// manager sees the clients they manage; the AM Head sees every client.

const META = ["META_ADS", "Meta Ads"];
const GOOGLE = ["GOOGLE_ADS", "Google Ads"];
const SMO = ["SMO"];
const LEAD_TYPES = ["LEAD", "CALLS", "WHATSAPP"]; // an awareness campaign's result is reach, not leads
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const label = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", ...o });
// names shown as chips: the accounts side saves "Meta Ads", the client form saves META_ADS
const NICE: Record<string, string> = { META_ADS: "Meta Ads", GOOGLE_ADS: "Google Ads", VIDEO: "Video", WEBSITE_DEV: "Website", BRANDING: "Branding", OTHER: "Other" };

export async function getAmHome(userId: string, role: string) {
  const isHead = role === "AM_HEAD";
  const today = todayIST();
  const yesterday = iso(new Date(`${today}T00:00:00Z`).getTime() - 86400000);
  const month = today.slice(0, 7);

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE", ...(isHead ? {} : { accountManagerId: userId }) },
    select: {
      id: true, name: true, code: true, pocName: true, pocMobile: true, googleBudget: true,
      accountManager: { select: { name: true } },
      services: { select: { service: true } },
      campaigns: { where: { date: { startsWith: month } }, select: { date: true, type: true, spent: true, results: true } },
      googleCampaigns: { where: { date: { startsWith: month } }, select: { date: true, spent: true, leads: true } },
      socialPosts: { where: { date: { startsWith: month } }, select: { date: true, status: true } },
      creativeTasks: { select: { status: true, dueDate: true, updatedAt: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = clients.map((c) => {
    const svc = c.services.map((s) => s.service);
    const has = (list: string[]) => svc.some((s) => list.includes(s));
    const metaSpend = c.campaigns.reduce((s, e) => s + e.spent, 0), metaLeads = c.campaigns.reduce((s, e) => s + (LEAD_TYPES.includes(e.type) ? e.results : 0), 0);
    const gSpend = c.googleCampaigns.reduce((s, e) => s + e.spent, 0), gLeads = c.googleCampaigns.reduce((s, e) => s + e.leads, 0);
    const open = c.creativeTasks.filter((t) => t.status !== "COMPLETED");
    const lastDates = [...c.campaigns.map((e) => e.date), ...c.googleCampaigns.map((e) => e.date), ...c.socialPosts.map((e) => e.date)].sort();
    const hasMeta = has(META) || c.campaigns.length > 0, hasGoogle = has(GOOGLE) || c.googleBudget > 0 || c.googleCampaigns.length > 0, hasSmo = has(SMO) || c.socialPosts.length > 0;
    return {
      id: c.id, name: c.name, code: c.code, poc: c.pocName ?? "", phone: c.pocMobile ?? "", am: c.accountManager?.name ?? "",
      services: [...new Set(svc.map((s) => NICE[s] ?? s))],
      hasMeta, hasGoogle, hasSmo,
      metaSpend, metaLeads, gSpend, gLeads,
      posts: c.socialPosts.length, postsToday: c.socialPosts.filter((p) => p.date === today).length,
      creativeOpen: open.length, creativeOverdue: open.filter((t) => t.dueDate && t.dueDate < today).length,
      creativeDone: c.creativeTasks.filter((t) => t.status === "COMPLETED" && t.updatedAt.toISOString().slice(0, 7) === month).length,
      metaYesterday: c.campaigns.some((e) => e.date === yesterday), googleYesterday: c.googleCampaigns.some((e) => e.date === yesterday),
      lastUpdate: lastDates.length ? lastDates[lastDates.length - 1] : "",
    };
  });

  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const spend = sum((r) => r.metaSpend + r.gSpend), leads = sum((r) => r.metaLeads + r.gLeads);
  const metaClients = rows.filter((r) => r.hasMeta), googleClients = rows.filter((r) => r.hasGoogle), smoClients = rows.filter((r) => r.hasSmo);
  const [myTasks, myTasksOverdue] = await Promise.all([
    prisma.task.count({ where: { assignedToId: userId, status: { not: "DONE" } } }),
    prisma.task.count({ where: { assignedToId: userId, status: { not: "DONE" }, dueDate: { lt: today, not: "" } } }),
  ]);

  return {
    isHead, today, yesterday, month,
    monthLabel: label(today, { month: "long", year: "numeric" }),
    todayLabel: label(today, { weekday: "long", day: "numeric", month: "long" }),
    yesterdayLabel: label(yesterday, { day: "2-digit", month: "short" }),
    rows,
    totals: {
      clients: rows.length, spend, leads, cpl: leads ? Math.round(spend / leads) : 0,
      metaSpend: sum((r) => r.metaSpend), metaLeads: sum((r) => r.metaLeads), gSpend: sum((r) => r.gSpend), gLeads: sum((r) => r.gLeads),
      posts: sum((r) => r.posts), creativeOpen: sum((r) => r.creativeOpen), creativeOverdue: sum((r) => r.creativeOverdue), creativeDone: sum((r) => r.creativeDone),
    },
    // what still has to be entered: yesterday's ad results, today's posts
    todo: {
      meta: { total: metaClients.length, done: metaClients.filter((r) => r.metaYesterday).length, pending: metaClients.filter((r) => !r.metaYesterday).map((r) => r.name) },
      google: { total: googleClients.length, done: googleClients.filter((r) => r.googleYesterday).length, pending: googleClients.filter((r) => !r.googleYesterday).map((r) => r.name) },
      smo: { total: smoClients.length, done: smoClients.filter((r) => r.postsToday > 0).length, pending: smoClients.filter((r) => r.postsToday === 0).map((r) => r.name), postsToday: sum((r) => r.postsToday) },
      tasks: { open: myTasks, overdue: myTasksOverdue },
    },
  };
}
export type AmHomeData = Awaited<ReturnType<typeof getAmHome>>;
