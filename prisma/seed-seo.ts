// SEO team seed — populates the SEO clients + their SEO data (blog slots, GMB
// locations, monthly reports) from the SEO team's Google Sheet.
//
// SAFETY: This seed is IDEMPOTENT and LOGIN-SAFE. It NEVER creates or deletes
// User rows (deleting users would invalidate existing login cookies). It only
// upserts SEO Clients + their SEO-specific data, and looks up existing users by
// name to wire up account managers / SEO execs. Safe to run repeatedly on the
// live server without duplicating rows or breaking sessions.

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

const MONTH = "2026-08";

// ---------------------------------------------------------------------------
// SEO CLIENTS — code SEO-001..SEO-030
// name | industry | seoExec | am | priority | blogTarget | backlinkTarget |
// keywordTarget | schedule | website | gsc | ga
// am "" means "no account manager on file" (skip AM assignment / leave blank).
// ---------------------------------------------------------------------------
type ClientRow = {
  n: number;
  name: string;
  industry: string;
  seoExec: string;
  am: string;
  priority: string;
  blogTarget: number;
  backlinkTarget: number;
  keywordTarget: number;
  schedule: string;
  website: string;
  gsc: string;
  ga: string;
};

const CLIENTS: ClientRow[] = [
  { n: 1, name: "Anupama Hospital", industry: "Healthcare", seoExec: "Bhavani", am: "Sandhya", priority: "A", blogTarget: 8, backlinkTarget: 200, keywordTarget: 0, schedule: "Daily 8 X 25 Days", website: "https://www.anupamahospitals.com/", gsc: "", ga: "" },
  { n: 2, name: "Prachin Global Hospital", industry: "Healthcare", seoExec: "Bhavani", am: "Laxmi Raj", priority: "A", blogTarget: 8, backlinkTarget: 150, keywordTarget: 0, schedule: "", website: "https://prachinglobalhospitals.com/", gsc: "", ga: "" },
  { n: 3, name: "Blueberry Service Apartment", industry: "Hospitality", seoExec: "Bhavani", am: "", priority: "", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "Tue, Thu, Sat", website: "https://blueberryserviceapartments.com/", gsc: "", ga: "" },
  { n: 4, name: "Dr Narayana Hotel Management", industry: "Education", seoExec: "Bhavani", am: "Sandhya", priority: "A", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "", website: "https://www.drnchm.com/", gsc: "", ga: "" },
  { n: 5, name: "Hyderabad Flower Gifts", industry: "E-commerce", seoExec: "Bhavani", am: "", priority: "", blogTarget: 0, backlinkTarget: 100, keywordTarget: 0, schedule: "Mon, Wed, Fri", website: "https://hyderabadflowergifts.com/", gsc: "", ga: "" },
  { n: 6, name: "Terrarich Cake Studio", industry: "E-commerce", seoExec: "Bhavani", am: "Kishore", priority: "B", blogTarget: 8, backlinkTarget: 80, keywordTarget: 0, schedule: "Tue, Thu, Sat", website: "https://terrarichcakestudio.in/", gsc: "", ga: "" },
  { n: 7, name: "Wineyard", industry: "Manufacturing", seoExec: "Bhavani", am: "Veni", priority: "B", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "Tue, Thu, Sat", website: "https://www.wineyard.in/", gsc: "https://search.google.com/search-console/performance/insights?resource_id=https%3A%2F%2Fwww.wineyard.in%2F", ga: "https://analytics.google.com/analytics/web/#/a223073522p307194441/reports/intelligenthome" },
  { n: 8, name: "Infyc Solutions", industry: "IT", seoExec: "Bhavani", am: "", priority: "A", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "Mon, Wed, Fri", website: "https://infyc.com/", gsc: "https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Finfyc.com%2F", ga: "https://analytics.google.com/analytics/web/#/a375815775p513988792/reports/intelligenthome" },
  { n: 9, name: "Heat Savers", industry: "Manufacturing", seoExec: "Hemanth", am: "", priority: "A", blogTarget: 8, backlinkTarget: 300, keywordTarget: 0, schedule: "Everyday First Half", website: "https://heatsavers.ca/", gsc: "", ga: "" },
  { n: 10, name: "Smart Dost", industry: "IT", seoExec: "Hemanth", am: "", priority: "A", blogTarget: 0, backlinkTarget: 200, keywordTarget: 10, schedule: "Daily 8 X 25 Days", website: "https://smartdost.in/", gsc: "", ga: "" },
  { n: 11, name: "The Solutions IMHS", industry: "Healthcare", seoExec: "Hemanth", am: "", priority: "A", blogTarget: 8, backlinkTarget: 150, keywordTarget: 0, schedule: "Mon, Wed, Fri", website: "https://thesolutionsimhs.com/", gsc: "https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fthesolutionsimhs.com%2F", ga: "https://analytics.google.com/analytics/web/#/a220395204p313293460/reports/intelligenthome" },
  { n: 12, name: "Make It Flow LLC", industry: "IT", seoExec: "Hemanth", am: "", priority: "", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "Tue, Thu, Sat", website: "https://makeitflowllc.com/", gsc: "", ga: "" },
  { n: 13, name: "Empass Overseas", industry: "Education", seoExec: "Hemanth", am: "Kalyan Manideep", priority: "", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "Daily 2 Hrs", website: "https://www.empassoverseas.com/", gsc: "", ga: "" },
  { n: 14, name: "RV Adventures Australia", industry: "Hospitality", seoExec: "Sai Kumar", am: "", priority: "A", blogTarget: 8, backlinkTarget: 100, keywordTarget: 20, schedule: "Daily 1 hr", website: "https://www.rvadventureaustralia.com.au/", gsc: "", ga: "" },
  { n: 15, name: "Essar Power", industry: "Manufacturing", seoExec: "Sai Kumar", am: "", priority: "C", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "Tue, Thu, Sat", website: "http://www.essareps.in/", gsc: "", ga: "" },
  { n: 16, name: "Thaswika Hair Extension", industry: "Fashion", seoExec: "Sai Kumar", am: "Sandhya", priority: "A", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "Tue, Thu, Sat", website: "https://thaswikahair.com/", gsc: "", ga: "" },
  { n: 17, name: "Global Six Sigma", industry: "Education", seoExec: "Sai Kumar", am: "Sandhya", priority: "A", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "Tue, Thu, Sat", website: "https://www.sixsigmaedu.com/", gsc: "https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fwww.sixsigmaedu.com%2F", ga: "https://analytics.google.com/analytics/web/#/a90989020p366522072/reports/intelligenthome" },
  { n: 18, name: "ISM Focal Point", industry: "Manufacturing", seoExec: "Sai Kumar", am: "", priority: "A", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "Mon, Wed, Fri", website: "https://ismfocalpoint.in", gsc: "", ga: "" },
  { n: 19, name: "PSR Caters", industry: "Hospitality", seoExec: "Sai Kumar", am: "", priority: "", blogTarget: 8, backlinkTarget: 150, keywordTarget: 0, schedule: "Mon, Wed, Fri", website: "https://psrcaterers.in/", gsc: "", ga: "" },
  { n: 20, name: "Amma Selection", industry: "E-commerce", seoExec: "Sai Kumar", am: "Sowji", priority: "B", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "Mon, Wed, Fri", website: "https://ammaselection.com/", gsc: "", ga: "" },
  { n: 21, name: "Web Rocz", industry: "IT", seoExec: "Praveen", am: "", priority: "A", blogTarget: 8, backlinkTarget: 150, keywordTarget: 40, schedule: "Everyday", website: "https://www.webrocz.com/", gsc: "", ga: "" },
  { n: 22, name: "Digital Hat Academy", industry: "Education", seoExec: "Praveen", am: "", priority: "A", blogTarget: 8, backlinkTarget: 150, keywordTarget: 20, schedule: "Everyday", website: "https://www.digitalhatacademy.com/", gsc: "https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fdigitalhat.in%2F", ga: "https://analytics.google.com/analytics/web/#/a338921668p470072878/reports/intelligenthome" },
  { n: 23, name: "Studio X Rent", industry: "Real Estate", seoExec: "Praveen", am: "", priority: "A", blogTarget: 8, backlinkTarget: 150, keywordTarget: 10, schedule: "Everyday", website: "https://studioxrent.com/", gsc: "", ga: "" },
  { n: 24, name: "MIPSAN Tradetech Solutions", industry: "Manufacturing", seoExec: "Bhavani", am: "Laxmi Raj", priority: "A", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "Tue, Thu, Sat", website: "https://mipsantradetech.com/", gsc: "https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fmipsantradetech.com%2F", ga: "https://analytics.google.com/analytics/web/#/a384993829p525231245/reports/intelligenthome" },
  { n: 25, name: "Sri Vasista", industry: "Education", seoExec: "Sai Kumar", am: "Veni", priority: "B", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "Tue, Thu, Sat", website: "https://www.srivasishtaedu.com/", gsc: "", ga: "" },
  { n: 26, name: "Neo Fatbury", industry: "Healthcare", seoExec: "Bhavani", am: "Sowji", priority: "B", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "Mon, Wed, Fri", website: "https://neofatbury.in/", gsc: "", ga: "" },
  { n: 27, name: "Apollo Medical Academy", industry: "Education", seoExec: "Sai Kumar", am: "", priority: "B", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "Mon, Wed, Fri", website: "https://apolomedicalacademy.com/", gsc: "https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fapolomedicalacademy.com%2F", ga: "https://analytics.google.com/analytics/web/#/a376341852p514717540/reports/intelligenthome" },
  { n: 28, name: "Wishealth", industry: "Healthcare", seoExec: "Sai Kumar", am: "Sandhya", priority: "B", blogTarget: 8, backlinkTarget: 100, keywordTarget: 0, schedule: "Mon, Wed, Fri", website: "http://www.wishealth.com/", gsc: "", ga: "" },
  { n: 29, name: "Medi Infotech", industry: "IT", seoExec: "Bhavani", am: "Veni", priority: "", blogTarget: 8, backlinkTarget: 150, keywordTarget: 0, schedule: "Mon, Wed, Fri", website: "https://mediinfotech.com/", gsc: "", ga: "" },
  { n: 30, name: "Techno Access", industry: "Education", seoExec: "Bhavani", am: "", priority: "", blogTarget: 8, backlinkTarget: 200, keywordTarget: 0, schedule: "Daily 2 Hrs", website: "https://technoaccess.ca/", gsc: "", ga: "" },
];

// ---------------------------------------------------------------------------
// BLOG SLOTS — writer per client + completion pattern per client.
// ---------------------------------------------------------------------------
const BLOG_WRITER: Record<string, string> = {
  "Smart Dost": "Shruthi",
  "RV Adventures Australia": "Shruthi",
  "Thaswika Hair Extension": "Shruthi",
  "Dr Narayana Hotel Management": "Shruthi",
  "Wishealth": "Shruthi",
  "Global Six Sigma": "Shruthi",
  "Prachin Global Hospital": "Shruthi",
  "Anupama Hospital": "Bhavani",
  "Techno Access": "Bhavani",
  "Medi Infotech": "Bhavani",
  "Web Rocz": "Bhavani",
  "Digital Hat Academy": "Bhavani",
  "ISM Focal Point": "Bhavani",
  "Apollo Medical Academy": "Bhavani",
  "Infyc Solutions": "Bhavani",
  "Wineyard": "Bhavani",
  "Neo Fatbury": "Sneha",
  "Essar Power": "Sneha",
  "Amma Selection": "Sneha",
  "The Solutions IMHS": "Sneha",
  "MIPSAN Tradetech Solutions": "Sneha",
  "Sri Vasista": "Sneha",
  "Terrarich Cake Studio": "Sneha",
  // blank writer:
  "Heat Savers": "",
  "Empass Overseas": "",
  "Blueberry Service Apartment": "",
  "PSR Caters": "",
  "Hyderabad Flower Gifts": "",
};

// Completion buckets (from the sheet's % Complete column).
const FULL_CLIENTS = new Set<string>([
  "RV Adventures Australia", "Thaswika Hair Extension", "Dr Narayana Hotel Management",
  "Wishealth", "Global Six Sigma", "Anupama Hospital", "Techno Access", "Medi Infotech",
  "Web Rocz", "Digital Hat Academy", "Apollo Medical Academy", "Infyc Solutions",
  "Wineyard", "Neo Fatbury", "Essar Power", "Amma Selection", "The Solutions IMHS",
  "MIPSAN Tradetech Solutions", "Sri Vasista", "Terrarich Cake Studio", "Prachin Global Hospital",
]);
const ZERO_CLIENTS = new Set<string>([
  "Heat Savers", "Blueberry Service Apartment", "Empass Overseas", "PSR Caters",
]);

// Returns the {blog,image,web} stage for a given slot (1-based) of a client.
function slotStage(name: string, slot: number): { blog: string; image: string; web: string } {
  const done = { blog: "PUBLISHED", image: "DONE", web: "LIVE" };
  const pending = { blog: "PENDING", image: "PENDING", web: "PENDING" };
  if (name === "ISM Focal Point") return slot <= 6 ? done : pending; // 6/8 done (75%)
  if (FULL_CLIENTS.has(name)) return done;
  // ZERO_CLIENTS and any client not otherwise specified default to all-pending.
  return pending;
}

// ---------------------------------------------------------------------------
// GMB — Local SEO / Google Business Profile locations.
// assigned | name | monthlyPosts | lastPostDate | reviewsNote | localo
// postsDone = monthlyPosts when a real lastPostDate is present, else 0.
// ---------------------------------------------------------------------------
type GmbRow = { assigned: string; name: string; monthlyPosts: number; lastPostDate: string; reviewsNote: string; localo: boolean };
const GMB: GmbRow[] = [
  { assigned: "Kishore", name: "The Solution IMHS", monthlyPosts: 16, lastPostDate: "June 30", reviewsNote: "", localo: true },
  { assigned: "Kishore", name: "Essar Power Solution", monthlyPosts: 8, lastPostDate: "20 Aug", reviewsNote: "", localo: false },
  { assigned: "Kishore", name: "Essar Power Solution (Vizag)", monthlyPosts: 8, lastPostDate: "20 Aug", reviewsNote: "", localo: false },
  { assigned: "Kishore", name: "The Daffodils Company", monthlyPosts: 12, lastPostDate: "June 2", reviewsNote: "", localo: false },
  { assigned: "Kishore", name: "Neo Skin", monthlyPosts: 12, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Kishore", name: "Heat Savers", monthlyPosts: 12, lastPostDate: "August 12", reviewsNote: "", localo: false },
  { assigned: "Kishore", name: "Webrocz", monthlyPosts: 15, lastPostDate: "August 22", reviewsNote: "", localo: false },
  { assigned: "Kishore", name: "Digital Hat", monthlyPosts: 15, lastPostDate: "August 20", reviewsNote: "", localo: false },
  { assigned: "Kishore", name: "Digital Hat (KPHB)", monthlyPosts: 15, lastPostDate: "August 20", reviewsNote: "", localo: false },
  { assigned: "Kishore", name: "Digital Hat (Dilsukhnagar)", monthlyPosts: 15, lastPostDate: "August 20", reviewsNote: "", localo: false },
  { assigned: "Kishore", name: "Thaswika Hair", monthlyPosts: 25, lastPostDate: "No Posts yet", reviewsNote: "", localo: false },
  { assigned: "Kishore", name: "Thaswika Hair (Manikonda)", monthlyPosts: 25, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Veni", name: "Happy Hearts", monthlyPosts: 12, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Veni", name: "Mercedes", monthlyPosts: 30, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Veni", name: "R Gold", monthlyPosts: 30, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Veni", name: "Spine Reset", monthlyPosts: 20, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Veni", name: "ISM", monthlyPosts: 24, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Veni", name: "Archana Cleaning & Painting", monthlyPosts: 20, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Veni", name: "Mediinfotech", monthlyPosts: 0, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Sowji", name: "JMJ", monthlyPosts: 30, lastPostDate: "", reviewsNote: "No commitment", localo: false },
  { assigned: "Sandhya", name: "Six Sigma", monthlyPosts: 20, lastPostDate: "", reviewsNote: "No specific number", localo: true },
  { assigned: "Sandhya", name: "Wishealth", monthlyPosts: 12, lastPostDate: "", reviewsNote: "No commitment", localo: true },
  { assigned: "Sandhya", name: "Elvo Suites", monthlyPosts: 12, lastPostDate: "", reviewsNote: "No commitment", localo: true },
  { assigned: "Laxmi Raj", name: "Prachin Global Hospitals", monthlyPosts: 15, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Laxmi Raj", name: "Mipsan Trade Tech Solutions", monthlyPosts: 15, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Jagadeesh", name: "Local Ganesha", monthlyPosts: 22, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Jagadeesh", name: "Apolo Medical Academy", monthlyPosts: 22, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Jagadeesh", name: "SRK Gold Buyers", monthlyPosts: 22, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Jagadeesh", name: "PSR Caterers", monthlyPosts: 22, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Jagadeesh", name: "Jismath Ameerpet", monthlyPosts: 22, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Jagadeesh", name: "Jismath Dilsukhnagar", monthlyPosts: 22, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Jagadeesh", name: "Jismath Vijayawada", monthlyPosts: 22, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Jagadeesh", name: "Jismath Bangalore", monthlyPosts: 22, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Jagadeesh", name: "Jismath Guntur", monthlyPosts: 22, lastPostDate: "", reviewsNote: "", localo: false },
  { assigned: "Sai Kumar", name: "Blueberry Serviced Apartment", monthlyPosts: 8, lastPostDate: "", reviewsNote: "10", localo: false },
  { assigned: "Sai Kumar", name: "Hyderabad Flowers", monthlyPosts: 8, lastPostDate: "", reviewsNote: "10", localo: false },
  { assigned: "Sai Kumar", name: "Make it Flow", monthlyPosts: 8, lastPostDate: "", reviewsNote: "10", localo: false },
];

// A lastPostDate counts as "present" only if it's an actual date (not blank and
// not a placeholder like "No Posts yet").
function hasRealPostDate(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t !== "" && t !== "no posts yet";
}

// ---------------------------------------------------------------------------
// SEO REPORTS — matched to a client by name; unknown clients are skipped.
// client | reportDate | status | assigned | gscDone | gaDone | keywordStatus
// ---------------------------------------------------------------------------
type ReportRow = { client: string; reportDate: string; status: string; assigned: string; gscDone: boolean; gaDone: boolean; keywordStatus: string };
const REPORTS: ReportRow[] = [
  { client: "Infyc Solutions", reportDate: "10th", status: "SENT", assigned: "Bhanu", gscDone: true, gaDone: true, keywordStatus: "Done" },
  { client: "ISM Focal Point", reportDate: "1st", status: "PENDING", assigned: "Bhanu", gscDone: true, gaDone: true, keywordStatus: "Pending" },
  { client: "Essar Power", reportDate: "10th", status: "SENT", assigned: "Arun", gscDone: true, gaDone: true, keywordStatus: "Done" },
  { client: "Apollo Medical Academy", reportDate: "1st", status: "PENDING", assigned: "Laxmi Raj", gscDone: true, gaDone: true, keywordStatus: "Pending" },
  { client: "Wishealth", reportDate: "10th", status: "SENT", assigned: "Sairam", gscDone: true, gaDone: true, keywordStatus: "Done" },
  { client: "The Solutions IMHS", reportDate: "1st", status: "SENT", assigned: "Sairam", gscDone: true, gaDone: true, keywordStatus: "Done" },
  { client: "MIPSAN Tradetech Solutions", reportDate: "5th", status: "PENDING", assigned: "", gscDone: false, gaDone: false, keywordStatus: "Pending" },
  { client: "Web Rocz", reportDate: "5th", status: "PENDING", assigned: "", gscDone: false, gaDone: false, keywordStatus: "Pending" },
  { client: "Global Six Sigma", reportDate: "8th", status: "SENT", assigned: "Pravalika", gscDone: true, gaDone: true, keywordStatus: "Done" },
  { client: "Neo Fatbury", reportDate: "8th", status: "SENT", assigned: "Pravalika", gscDone: true, gaDone: true, keywordStatus: "Done" },
  { client: "Digital Hat Academy", reportDate: "10th", status: "SENT", assigned: "", gscDone: true, gaDone: true, keywordStatus: "Done" },
];

// ---------------------------------------------------------------------------
// AM name normalization: map sheet spellings to real user names; some names are
// not AMs at all and should leave accountManagerId undefined.
// ---------------------------------------------------------------------------
function normalizeAmName(raw: string): string {
  const t = raw.trim();
  if (t === "") return "";
  const lower = t.toLowerCase();
  if (lower === "sandya") return "Sandhya";
  if (lower === "kalyan") return "Kalyan Manideep";
  if (lower === "arun" || lower === "shravan") return ""; // not account managers
  return t;
}

// ---------------------------------------------------------------------------
// EXTRA SEED DATA — Client POC/retainer, keywords, backlinks, analytics.
// All generated deterministically (seeded per client) so re-runs are stable
// and idempotent. Only ever scoped to a clientId + month, never to users.
// ---------------------------------------------------------------------------

// Small deterministic PRNG (mulberry32) so each client's numbers stay the same
// across re-runs without hard-coding 30 rows by hand.
function rngFor(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Realistic Indian POC names — varied per client (title + first name).
const POC_NAMES = [
  "Dr. Rajesh", "Ms. Priya", "Mr. Anil", "Dr. Kavya", "Mr. Suresh",
  "Ms. Deepa", "Dr. Ramesh", "Mr. Venkat", "Ms. Sneha", "Mr. Naveen",
  "Dr. Lakshmi", "Ms. Anjali", "Mr. Kiran", "Dr. Srinivas", "Ms. Meena",
  "Mr. Prasad", "Dr. Harish", "Ms. Swathi", "Mr. Rahul", "Dr. Padma",
  "Ms. Divya", "Mr. Vijay", "Dr. Mohan", "Ms. Rekha", "Mr. Arjun",
  "Dr. Sunita", "Ms. Pooja", "Mr. Gopal", "Dr. Ananya", "Ms. Nisha",
];

// Analytics months for the 6-month trend chart (oldest → newest).
const ANALYTICS_MONTHS = ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];

// Backlink types to rotate through.
const BACKLINK_TYPES = [
  "Guest Post", "Directory Submission", "Social Bookmarking", "Business Listing",
  "Web 2.0", "Profile Link", "Citation", "Press Release",
];

// Industry-specific keyword pools (realistic search phrases per vertical).
const GENERIC_KEYWORDS = [
  "best services hyderabad", "top rated company near me", "affordable services india",
  "professional services hyderabad", "trusted company reviews", "services cost hyderabad",
  "book online hyderabad", "expert services near me", "quality services provider",
  "leading company hyderabad", "get a quote online", "customer support hyderabad",
];
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  Healthcare: [
    "best hospital hyderabad", "multispeciality hospital near me", "emergency care hospital",
    "affordable surgery cost", "best doctors hyderabad", "24/7 hospital hyderabad",
    "health checkup packages", "cardiology hospital hyderabad", "orthopedic treatment cost",
    "maternity hospital hyderabad", "icu facility hospital", "diagnostic center near me",
  ],
  Hospitality: [
    "service apartments hyderabad", "budget hotels near me", "best serviced apartments",
    "corporate stay hyderabad", "furnished apartments for rent", "luxury service apartment",
    "monthly stay apartments", "hotel booking hyderabad", "business travel stay",
    "short term rental apartments", "family rooms hyderabad", "weekend getaway hyderabad",
  ],
  Education: [
    "best training institute hyderabad", "online certification courses", "professional courses near me",
    "career training programs", "six sigma certification", "study abroad consultants",
    "hotel management course", "digital marketing course hyderabad", "affordable coaching institute",
    "placement training institute", "skill development courses", "weekend classes hyderabad",
  ],
  "E-commerce": [
    "buy cakes online hyderabad", "online flower delivery", "best online cake shop",
    "same day gift delivery", "custom cakes hyderabad", "online gifts hyderabad",
    "birthday cake delivery", "fresh flowers online", "handmade products online",
    "buy gifts online india", "midnight cake delivery", "online shopping hyderabad",
  ],
  Manufacturing: [
    "industrial equipment suppliers", "best manufacturing company", "custom fabrication services",
    "power solutions company", "industrial products manufacturer", "bulk manufacturing services",
    "export quality products", "oem manufacturer india", "precision engineering company",
    "industrial machinery suppliers", "wholesale manufacturer hyderabad", "certified manufacturing company",
  ],
  IT: [
    "software development company", "best it services company", "web development hyderabad",
    "custom software solutions", "mobile app development", "it consulting services",
    "erp software company", "cloud solutions provider", "digital transformation services",
    "software company hyderabad", "enterprise software solutions", "it outsourcing company",
  ],
  Fashion: [
    "hair extensions hyderabad", "natural hair extensions", "best hair salon hyderabad",
    "human hair extensions price", "hair wigs online", "premium hair extensions",
    "clip in hair extensions", "hair extension cost", "buy hair extensions online",
    "salon quality hair extensions", "hair care products", "hair styling hyderabad",
  ],
  "Real Estate": [
    "studio for rent hyderabad", "photography studio rental", "event space for rent",
    "commercial space rental", "studio space near me", "rent studio hyderabad",
    "shooting studio rental", "co working studio space", "affordable studio rent",
    "premium studio hyderabad", "podcast studio rental", "content creation studio",
  ],
};

// Blog publish date spread across Aug 2026 for slot N (~every 3–4 days).
function blogDateForSlot(slot: number): string {
  const day = Math.min(3 + Math.round((slot - 1) * 3.5), 28);
  return `2026-08-${String(day).padStart(2, "0")}`;
}

export async function seedSeo() {
  // Load ALL users once and match by lowercased name (never create/delete users).
  const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });
  const userByName = new Map<string, { id: string; name: string }>();
  for (const u of allUsers) userByName.set(u.name.trim().toLowerCase(), u);
  const findUser = (name: string) => {
    const t = name.trim().toLowerCase();
    return t ? userByName.get(t) : undefined;
  };

  const missingUsers = new Set<string>();

  let clientCount = 0;
  let blogSlotCount = 0;
  let keywordCount = 0;
  let backlinkCount = 0;
  let analyticsCount = 0;
  const clientIdByName = new Map<string, string>();

  // ---- Clients + ClientService(SEO) + Assignments + Blog slots ----
  for (const c of CLIENTS) {
    const code = `SEO-${String(c.n).padStart(3, "0")}`;
    const amName = normalizeAmName(c.am);
    const amUser = amName ? findUser(amName) : undefined;
    if (amName && !amUser) missingUsers.add(amName);
    const execUser = findUser(c.seoExec);
    if (c.seoExec && !execUser) missingUsers.add(c.seoExec);

    // Per-client deterministic generator (stable across re-runs).
    const rand = rngFor(1000 + c.n);
    const pocName = POC_NAMES[(c.n - 1) % POC_NAMES.length];
    // Realistic SEO retainer 25000–45000 (rounded to nearest 500).
    const monthlyRetainer = 25000 + Math.round((rand() * 20000) / 500) * 500;
    // Ensure a keyword target of at least 10 (leave higher targets as-is).
    const keywordTarget = Math.max(c.keywordTarget, 10);
    // Realistic small-website Domain Authority 5–40, deterministic per client.
    // Dedicated seeded PRNG so the other generated numbers stay unchanged.
    const daRand = rngFor(3000 + c.n);
    const domainAuthority = 5 + Math.floor(daRand() * 36); // 5..40

    const fields = {
      name: c.name,
      website: c.website,
      industry: c.industry,
      status: "ACTIVE",
      monthlyRetainer,
      pocName,
      seoPriority: c.priority,
      seoScheduleDays: c.schedule,
      blogTarget: c.blogTarget,
      backlinkTarget: c.backlinkTarget,
      keywordTarget,
      domainAuthority,
      gscLink: c.gsc,
      gaLink: c.ga,
    };
    // Prisma 7 generated client requires the relation form (connect/disconnect),
    // not the scalar accountManagerId, on create/update inputs.
    const amRelation = amUser
      ? { accountManager: { connect: { id: amUser.id } } }
      : { accountManager: { disconnect: true } };

    const client = await prisma.client.upsert({
      where: { code },
      update: { ...fields, ...amRelation },
      create: { code, ...fields, ...(amUser ? { accountManager: { connect: { id: amUser.id } } } : {}) },
    });
    clientIdByName.set(c.name, client.id);
    clientCount++;

    // ClientService SEO (idempotent via compound unique upsert)
    await prisma.clientService.upsert({
      where: { clientId_service: { clientId: client.id, service: "SEO" } },
      update: {},
      create: { clientId: client.id, service: "SEO" },
    });

    // Assignment — SEO exec (dept SEO)
    if (execUser) {
      await prisma.assignment.upsert({
        where: { clientId_userId_department: { clientId: client.id, userId: execUser.id, department: "SEO" } },
        update: {},
        create: { clientId: client.id, userId: execUser.id, department: "SEO" },
      });
    }
    // Assignment — Account Manager (dept ACCOUNT)
    if (amUser) {
      await prisma.assignment.upsert({
        where: { clientId_userId_department: { clientId: client.id, userId: amUser.id, department: "ACCOUNT" } },
        update: {},
        create: { clientId: client.id, userId: amUser.id, department: "ACCOUNT" },
      });
    }

    // Blog slots — clean regen for this month (safe: not user rows).
    await prisma.seoBlogSlot.deleteMany({ where: { clientId: client.id, month: MONTH } });
    const writer = BLOG_WRITER[c.name] ?? "";
    if (c.blogTarget > 0) {
      const slots = [];
      for (let s = 1; s <= c.blogTarget; s++) {
        const st = slotStage(c.name, s);
        slots.push({
          clientId: client.id,
          month: MONTH,
          slot: s,
          writer,
          blog: st.blog,
          image: st.image,
          web: st.web,
          title: "",
          link: "",
          // Publish date spread across Aug 2026, increasing per slot.
          blogDate: blogDateForSlot(s),
        });
      }
      await prisma.seoBlogSlot.createMany({ data: slots });
      blogSlotCount += slots.length;
    }

    // ---- Keywords (month 2026-08) — clean regen scoped to client+month ----
    await prisma.seoKeyword.deleteMany({ where: { clientId: client.id, month: MONTH } });
    const kwPool = INDUSTRY_KEYWORDS[c.industry] ?? GENERIC_KEYWORDS;
    const kwStart = c.n % kwPool.length;
    const kwRows = [];
    for (let s = 1; s <= 10; s++) {
      const keyword = kwPool[(kwStart + s - 1) % kwPool.length];
      const lastPos = 5 + Math.floor(rand() * 36); // 5..40
      // Usually improve; slots 3, 7 and sometimes 9 stay worse/equal (realistic).
      const worse = s === 3 || s === 7 || (s === 9 && rand() > 0.5);
      const currPos = worse
        ? lastPos + Math.floor(rand() * 3) // equal..+2 (worse)
        : Math.max(1, lastPos - (1 + Math.floor(rand() * 5))); // 1..5 better
      kwRows.push({ clientId: client.id, month: MONTH, slot: s, keyword, lastPos, currPos });
    }
    await prisma.seoKeyword.createMany({ data: kwRows });
    keywordCount += kwRows.length;

    // ---- Backlinks (month 2026-08) — clean regen scoped to client+month ----
    await prisma.seoBacklink.deleteMany({ where: { clientId: client.id, month: MONTH } });
    const blRows = [];
    for (let s = 1; s <= 5; s++) {
      const type = BACKLINK_TYPES[(c.n + s) % BACKLINK_TYPES.length];
      const status = s === 4 ? "Pending" : "Live"; // mostly Live, one Pending
      const da = 20 + Math.floor(rand() * 51); // 20..70
      blRows.push({
        clientId: client.id,
        month: MONTH,
        slot: s,
        type,
        status,
        link: `https://example-domain-${c.n}.com/${type.toLowerCase().replace(/\s+/g, "-")}-${s}`,
        da,
        date: `2026-08-${10 + s}`, // 2026-08-11 .. 2026-08-15
      });
    }
    await prisma.seoBacklink.createMany({ data: blRows });
    backlinkCount += blRows.length;

    // ---- Analytics — 6 months of upward-trending GSC + GA numbers ----
    const impVary = 0.85 + rand() * 0.35;
    const clkVary = 0.85 + rand() * 0.35;
    const usrVary = 0.85 + rand() * 0.35;
    const posVary = 0.9 + rand() * 0.2;
    const bounceVary = 0.95 + rand() * 0.1;
    const convVary = 0.85 + rand() * 0.35;
    const engBase = 105 + Math.floor(rand() * 15); // ~1m45s baseline
    for (let i = 0; i < ANALYTICS_MONTHS.length; i++) {
      const m = ANALYTICS_MONTHS[i];
      const gscImpressions = Math.round((30000 + i * 3600) * impVary); // ~30k → ~48k
      const gscClicks = Math.round((900 + i * 120) * clkVary); // ~900 → ~1500
      const gscCtr = Math.round((gscClicks / gscImpressions) * 10000) / 100;
      const gscPosition = Math.round((18 - i * 1.8) * posVary * 10) / 10; // ~18 → ~9
      const gaUsers = Math.round((5000 + i * 700) * usrVary); // ~5000 → ~8500
      const gaNewUsers = Math.round(gaUsers * 0.6);
      const gaOrganic = Math.round(gaUsers * 0.45);
      const gaSessions = Math.round(gaUsers * 1.3);
      const gaBounce = Math.round((55 - i * 2.6) * bounceVary * 10) / 10; // ~55 → ~42
      const engSecs = engBase + i * 12 + Math.floor(rand() * 8);
      const gaEngagement = `${Math.floor(engSecs / 60)}m ${engSecs % 60}s`;
      const gaConversions = Math.round((40 + i * 10) * convVary); // ~40 → ~90
      // Organic Social visitors — small and slowly growing (~1 → ~8), varies
      // per client via a deterministic factor (no rand() so other values stay put).
      const gaOrganicSocial = Math.max(1, Math.round((1 + i * 1.3) * (0.8 + (c.n % 5) * 0.15))); // ~1 → ~8
      await prisma.seoAnalytics.upsert({
        where: { clientId_month: { clientId: client.id, month: m } },
        update: { gscImpressions, gscClicks, gscCtr, gscPosition, gaUsers, gaNewUsers, gaOrganic, gaOrganicSocial, gaSessions, gaBounce, gaEngagement, gaConversions },
        create: { clientId: client.id, month: m, gscImpressions, gscClicks, gscCtr, gscPosition, gaUsers, gaNewUsers, gaOrganic, gaOrganicSocial, gaSessions, gaBounce, gaEngagement, gaConversions },
      });
      analyticsCount++;
    }
  }

  // ---- GMB — clean regen of the whole section (no natural unique key) ----
  await prisma.gmbClient.deleteMany({});
  const gmbRows = GMB.map((g) => ({
    name: g.name,
    assigned: g.assigned,
    gmbLink: "",
    monthlyPosts: g.monthlyPosts,
    postsDone: hasRealPostDate(g.lastPostDate) ? g.monthlyPosts : 0,
    lastPostDate: g.lastPostDate,
    citations: 0,
    reviews: 0,
    reviewsNote: g.reviewsNote,
    localo: g.localo,
    active: true,
  }));
  await prisma.gmbClient.createMany({ data: gmbRows });

  // ---- SEO Reports — upsert by [clientId, month]; skip unknown clients ----
  let reportCount = 0;
  const skippedReports: string[] = [];
  for (const r of REPORTS) {
    const clientId = clientIdByName.get(r.client);
    if (!clientId) {
      skippedReports.push(r.client);
      continue;
    }
    await prisma.seoReport.upsert({
      where: { clientId_month: { clientId, month: MONTH } },
      update: {
        reportDate: r.reportDate,
        status: r.status,
        gscDone: r.gscDone,
        gaDone: r.gaDone,
        assigned: r.assigned,
        keywordStatus: r.keywordStatus,
        note: "",
      },
      create: {
        clientId,
        month: MONTH,
        reportDate: r.reportDate,
        status: r.status,
        gscDone: r.gscDone,
        gaDone: r.gaDone,
        assigned: r.assigned,
        keywordStatus: r.keywordStatus,
        note: "",
      },
    });
    reportCount++;
  }

  if (missingUsers.size) {
    console.log(`Note: users not found (assignment/AM skipped): ${[...missingUsers].join(", ")}`);
  }
  if (skippedReports.length) {
    console.log(`Note: reports skipped (client not found): ${skippedReports.join(", ")}`);
  }
  console.log(
    `SEO seed done → SEO clients: ${clientCount}, blog slots: ${blogSlotCount}, keywords: ${keywordCount}, backlinks: ${backlinkCount}, analytics: ${analyticsCount}, GMB: ${gmbRows.length}, reports: ${reportCount}`
  );

  return { clientCount, blogSlotCount, keywordCount, backlinkCount, analyticsCount, gmb: gmbRows.length, reportCount };
}

async function main() {
  await seedSeo();
}

// Run only when executed directly (so seed.ts can `import { seedSeo }` without
// triggering a second run). Mirrors seed.ts's bottom-of-file run pattern.
const invokedPath = process.argv[1] ? process.argv[1].replace(/\\/g, "/") : "";
const isDirectRun = invokedPath.endsWith("seed-seo.ts") || invokedPath.endsWith("seed-seo.js");
if (isDirectRun) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
