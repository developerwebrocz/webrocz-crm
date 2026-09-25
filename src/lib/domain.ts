// Domain constants + helpers for WebRocz Agency OS.
// SQLite can't hold Prisma enums, so these are the source of truth for allowed values.

export const ROLES = {
  SUPER_ADMIN: "Super Admin",
  SUB_ADMIN: "Sub Admin",
  SALES_HEAD: "Sales Head",
  SALES_EXEC: "Sales Executive",
  AM_HEAD: "AM Head",
  ACCOUNT_MANAGER: "Account Manager",
  DM_HEAD: "Digital Marketing Head",
  DM_EXEC: "Digital Marketing Executive",
  SEO_HEAD: "SEO Head",
  SEO: "SEO Executive",
  DESIGNER: "Designer",
  EDITOR: "Video Editor",
  DEV_HEAD: "Dev Head",
  WEB_DEV: "Web Developer",
  ACCOUNTANT: "Accountant",
} as const;

// ---- Invoice: fixed seller (WebRocz) details for the GST tax-invoice format ----
export const SELLER = {
  name: "Web Rocz Digital Agency Pvt Ltd",
  address: "61/3rt, Above Apollo Pharmacy, 5th Floor, SR Nagar, Hyderabad-500 038.",
  phone: "7660864222",
  email: "accounts@webrocz.com",
  gstin: "36AAECW1841L1Z3",
  state: "36-Telangana",
  bankName: "HDFC BANK, PAVANI PLAZA COMMERCIAL COMPLEX",
  bankAccount: "50200114861505",
  bankIfsc: "HDFC0001228",
  bankHolder: "WEB ROCZ DIGITAL AGENCY PVT LTD",
  terms: "Thanks for doing business with us!",
} as const;

// ---- GST state codes (first 2 digits of a GSTIN) → canonical "code-Name" label ----
// Stored on invoices as clientState/placeOfSupply; both the printable invoice and the
// GST summary read this same "36-Telangana" shape to split CGST/SGST (intra) vs IGST.
export const GST_STATE_BY_CODE: Record<string, string> = {
  "01": "01-Jammu & Kashmir", "02": "02-Himachal Pradesh", "03": "03-Punjab",
  "04": "04-Chandigarh", "05": "05-Uttarakhand", "06": "06-Haryana", "07": "07-Delhi",
  "08": "08-Rajasthan", "09": "09-Uttar Pradesh", "10": "10-Bihar", "11": "11-Sikkim",
  "12": "12-Arunachal Pradesh", "13": "13-Nagaland", "14": "14-Manipur", "15": "15-Mizoram",
  "16": "16-Tripura", "17": "17-Meghalaya", "18": "18-Assam", "19": "19-West Bengal",
  "20": "20-Jharkhand", "21": "21-Odisha", "22": "22-Chhattisgarh", "23": "23-Madhya Pradesh",
  "24": "24-Gujarat", "25": "25-Daman & Diu", "26": "26-Dadra & Nagar Haveli", "27": "27-Maharashtra",
  "28": "28-Andhra Pradesh (Old)", "29": "29-Karnataka", "30": "30-Goa", "31": "31-Lakshadweep",
  "32": "32-Kerala", "33": "33-Tamil Nadu", "34": "34-Puducherry", "35": "35-Andaman & Nicobar",
  "36": "36-Telangana", "37": "37-Andhra Pradesh", "38": "38-Ladakh",
};

// Derive the canonical "code-Name" state label from a GSTIN's leading 2 digits.
// Returns "" when the GSTIN is blank or its state code is unknown — callers then
// leave clientState unset, which both consumers treat as the seller's home state.
export function stateFromGstin(gstin: string | null | undefined): string {
  const code = (gstin || "").trim().slice(0, 2);
  return GST_STATE_BY_CODE[code] ?? "";
}

// ---- The three billing entities (companies) the accountant bills under ----
// Web Rocz Pvt Ltd = GST invoices (Website + DM). The other two are non-GST.
export type Seller = { name: string; address: string; phone: string; email: string; gstin: string; state: string; bankName: string; bankAccount: string; bankIfsc: string; bankHolder: string; terms: string };
export type Company = { key: string; label: string; gst: boolean; seller: Seller };
export const COMPANY_KEYS = ["WEB_ROCZ_PVT", "WEB_SOLUTIONS", "WEB_ROCZ"] as const;
export const COMPANIES: Record<string, Company> = {
  // GST entity — full seller details incl. GSTIN (reuses the registered company).
  WEB_ROCZ_PVT: { key: "WEB_ROCZ_PVT", label: "Web Rocz Pvt Ltd", gst: true, seller: SELLER },
  // Non-GST entity for website work. Address/bank default to head office — update names as needed.
  WEB_SOLUTIONS: { key: "WEB_SOLUTIONS", label: "Web Solutions", gst: false, seller: { ...SELLER, name: "Web Solutions", gstin: "", state: "36-Telangana" } },
  // Non-GST entity for digital-marketing work.
  WEB_ROCZ: { key: "WEB_ROCZ", label: "Web Rocz", gst: false, seller: { ...SELLER, name: "Web Rocz", gstin: "", state: "36-Telangana" } },
};

// Which billing entity an invoice belongs to, from its GST flag + service category.
export function companyFor(gst: boolean, category: string): string {
  if (gst) return "WEB_ROCZ_PVT";
  return category === "DM" ? "WEB_ROCZ" : "WEB_SOLUTIONS";
}
export function companyLabel(key: string): string {
  return COMPANIES[key]?.label ?? key ?? "";
}
export function companySeller(key: string): Seller {
  return COMPANIES[key]?.seller ?? SELLER;
}

// Indian financial-year label for a date (Apr–Mar), e.g. 2026-09 → "2026-27".
export function financialYear(d = new Date()): string {
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // month index 3 = April
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

// Amount → Indian words (rupees only), e.g. 17700 → "Seventeen Thousand Seven Hundred Rupees only".
export function amountInWords(num: number): string {
  const n = Math.round(num || 0);
  if (n === 0) return "Zero Rupees only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number): string => x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? " " + ones[x % 10] : ""}`;
  const three = (x: number): string => {
    const h = Math.floor(x / 100), r = x % 100;
    return `${h ? ones[h] + " Hundred" + (r ? " " : "") : ""}${r ? two(r) : ""}`;
  };
  let words = "";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) words += three(crore) + " Crore ";
  if (lakh) words += three(lakh) + " Lakh ";
  if (thousand) words += three(thousand) + " Thousand ";
  if (rest) words += three(rest);
  return words.trim().replace(/\s+/g, " ") + " Rupees only";
}

// ---- Sales CRM constants ----
// Simplified pipeline: Leads → Follow-up → Quotation → Meeting → Onboarded / Lost.
// (Positive & Interested merged into "Leads"; Proposal folded into Quotation's shared flag; Reminder is now a note feature.)
export const SALES_STAGES = {
  POSITIVE_LEAD: "Leads",
  FOLLOW_UP: "Follow-up",
  QUOTATION: "Quotation",
  REMINDER: "Reminder",
  MEETING: "Meeting / Visit",
  ONBOARDED: "Client Onboarding",
  LOST: "Lost",
} as const;
export type SalesStage = keyof typeof SALES_STAGES;
export const SALES_STAGE_KEYS = Object.keys(SALES_STAGES) as SalesStage[];
// funnel stages (Lost excluded — it's a terminal side branch)
export const FUNNEL_KEYS: SalesStage[] = ["POSITIVE_LEAD", "FOLLOW_UP", "QUOTATION", "REMINDER", "MEETING", "ONBOARDED"];

// Tones cover legacy keys too (INTERESTED/PROPOSAL/REMINDER) so old rows never render blank.
export const SALES_STAGE_TONE: Record<string, string> = {
  POSITIVE_LEAD: "var(--sky)", FOLLOW_UP: "var(--amber)", INTERESTED: "var(--sky)",
  QUOTATION: "var(--indigo)", PROPOSAL: "var(--indigo)", REMINDER: "var(--amber)",
  MEETING: "var(--emerald)", ONBOARDED: "var(--emerald)", LOST: "var(--rose)",
};

export const LEAD_SOURCES = ["Website", "Referral", "Google", "Meta Ad", "LinkedIn", "WhatsApp", "Cold Call", "Walk-in", "Event", "Other"] as const;

// ---- Recruitment / hiring pipeline ----
export const RECRUIT_STAGES = {
  APPLIED: "Applied",
  INTERVIEW: "Interview",
  SHORTLISTED: "Shortlisted",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
} as const;
export type RecruitStage = keyof typeof RECRUIT_STAGES;
export const RECRUIT_STAGE_KEYS = Object.keys(RECRUIT_STAGES) as RecruitStage[];
export const RECRUIT_STAGE_TONE: Record<string, string> = {
  APPLIED: "var(--sky)", INTERVIEW: "var(--amber)", SHORTLISTED: "var(--violet)",
  OFFER: "var(--indigo)", HIRED: "var(--emerald)", REJECTED: "var(--rose)",
};
export const RECRUIT_SOURCES = ["LinkedIn", "Naukri", "Indeed", "Referral", "Website", "Walk-in", "College", "Other"] as const;
export const HIRING_DEPARTMENTS = ["Sales", "Digital Marketing", "Website Development", "SEO", "Design", "Video", "Accounts", "HR", "Management"] as const;

export const SERVICE_GROUPS = {
  "Website Development": ["Corporate Website", "Custom Website", "WordPress Development", "Shopify Development", "E-commerce Website", "Landing Page", "Website Maintenance", "Website Redesign", "Custom Web Application"],
  "Digital Marketing": ["Meta Ads", "Google Ads", "LinkedIn Ads", "YouTube Ads", "SEO", "Social Media Marketing", "Email Marketing", "WhatsApp Marketing", "Influencer Marketing", "Content Marketing", "Lead Generation", "Remarketing / Retargeting", "Conversion Rate Optimization", "Marketing Analytics"],
} as const;
const WEBSITE_SERVICES = new Set<string>(SERVICE_GROUPS["Website Development"]);
const DM_SERVICES = new Set<string>(SERVICE_GROUPS["Digital Marketing"]);
export function serviceKind(services: string[]): { web: boolean; dm: boolean } {
  return { web: services.some((s) => WEBSITE_SERVICES.has(s)), dm: services.some((s) => DM_SERVICES.has(s)) };
}

// Separate sales pipelines (same CRM, switchable).
export const SALES_PIPELINES = { WEBROCZ: "WebRocz Sales", DIGITALHAT: "Digital Hat Sales" } as const;
export type PipelineKey = keyof typeof SALES_PIPELINES;
export const PIPELINE_KEYS = Object.keys(SALES_PIPELINES) as PipelineKey[];

// Digital Hat Academy — course / program services (used when the pipeline is DIGITALHAT).
export const DH_SERVICE_GROUPS = {
  "Courses": ["Digital Marketing Course", "Advanced Digital Marketing", "SEO Course", "Meta Ads Course", "Google Ads Course", "Social Media Marketing Course", "Performance Marketing Course", "Web Development Course", "Graphic Design Course", "Video Editing Course", "Content Writing Course", "AI Marketing Course"],
  "Programs": ["1-on-1 Mentorship", "Corporate Training", "Internship Program", "Placement Program", "Workshop / Bootcamp"],
} as const;

export function serviceGroupsFor(pipeline: string): Record<string, readonly string[]> {
  return pipeline === "DIGITALHAT" ? DH_SERVICE_GROUPS : SERVICE_GROUPS;
}

export const FOLLOWUP_TYPES = ["Call", "WhatsApp", "Email", "Meeting"] as const;
export const FOLLOWUP_STATUS = { PENDING: "Pending", COMPLETED: "Completed", RESCHEDULED: "Rescheduled", NO_RESPONSE: "No Response" } as const;
export const QUOTE_STATUS = { NOT_SHARED: "Not Shared", SHARED: "Shared", ACCEPTED: "Accepted", REJECTED: "Rejected" } as const;
export const PROPOSAL_STATUS = { DRAFT: "Draft", SHARED: "Shared", ACCEPTED: "Accepted", REJECTED: "Rejected" } as const;
export const MEETING_TYPES = { OFFICE_VISIT: "Office Visit", CLIENT_LOCATION: "Client Location Meeting", ONLINE: "Online Meeting" } as const;
export const LOST_REASONS = ["Budget", "Competitor", "Not Interested", "No Response", "Delayed Decision", "Requirement Cancelled", "Other"] as const;
export const WEBSITE_PROJECT_STATUS = { UNASSIGNED: "Unassigned", ASSIGNED: "Assigned", REQUIREMENTS: "Requirement Collection", DESIGN: "Design", DEVELOPMENT: "Development", TESTING: "Testing", CLIENT_REVIEW: "Client Review", REVISION: "Revision", COMPLETED: "Completed", ON_HOLD: "On Hold" } as const;
export type Role = keyof typeof ROLES;

export const CLIENT_STATUS = {
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  UPCOMING: "Upcoming",
} as const;
export type ClientStatus = keyof typeof CLIENT_STATUS;

export const STATUS_TONE: Record<ClientStatus, string> = {
  ACTIVE: "emerald",
  ON_HOLD: "amber",
  UPCOMING: "violet",
};

// Services a client can take, with the deliverable metrics each one drives.
export const SERVICES = {
  SEO: {
    label: "SEO",
    sub: "Blogs · Keywords",
    mark: "🔍",
    metrics: [
      { key: "blogs", label: "Blogs / month" },
      { key: "keywords", label: "Keywords agreed" },
    ],
  },
  SMO: {
    label: "SMO",
    sub: "Posts · Reels",
    mark: "🎨",
    metrics: [
      { key: "static", label: "Static posts / month" },
      { key: "carousel", label: "Carousels / month" },
      { key: "reels", label: "Reels / month" },
    ],
  },
  VIDEO: {
    label: "Video Editing",
    sub: "AI · Reels",
    mark: "🎬",
    metrics: [
      { key: "aiVideos", label: "AI videos / month" },
      { key: "reelsEdit", label: "Reels / month" },
    ],
  },
  META_ADS: { label: "Meta Ads", sub: "Perf · Leads", mark: "📈", metrics: [] },
  GOOGLE_ADS: { label: "Google Ads", sub: "Perf · Leads", mark: "🔎", metrics: [] },
  CRM: { label: "CRM", sub: "Pipelines", mark: "📇", metrics: [] },
  WEBSITE_DEV: {
    label: "Website Dev",
    sub: "Project type",
    mark: "💻",
    metrics: [{ key: "websiteType", label: "Website type" }],
  },
  BRANDING: {
    label: "Branding",
    sub: "Deliverables",
    mark: "✨",
    metrics: [{ key: "brandingScope", label: "Deliverables / requirements" }],
  },
  OTHER: { label: "Other", sub: "Specify", mark: "➕", metrics: [] },
} as const;
export type ServiceKey = keyof typeof SERVICES;
export const SERVICE_KEYS = Object.keys(SERVICES) as ServiceKey[];

// short label + tone for the compact service tags shown in tables
export const SERVICE_TAG: Record<string, { short: string; tone: string }> = {
  SEO: { short: "SEO", tone: "emerald" },
  SMO: { short: "SMO", tone: "violet" },
  VIDEO: { short: "Video Editing", tone: "rose" },
  META_ADS: { short: "Meta Ads", tone: "sky" },
  GOOGLE_ADS: { short: "Google Ads", tone: "indigo" },
  CRM: { short: "CRM", tone: "amber" },
  WEBSITE_DEV: { short: "Website Development", tone: "slate" },
  BRANDING: { short: "Branding", tone: "magenta" },
  OTHER: { short: "Other", tone: "slate" },
};
export const serviceTag = (key: string) => SERVICE_TAG[key] ?? { short: key, tone: "slate" };

export const WORK_STATUS = {
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  PENDING_APPROVAL: "Pending Approval",
  COMPLETED: "Completed",
  APPROVED: "Approved",
} as const;
export type WorkStatus = keyof typeof WORK_STATUS;
// Statuses that count toward the monthly agreed target.
export const COMPLETING_STATUSES: WorkStatus[] = ["COMPLETED", "APPROVED"];

// Meta Ads campaign types for the AM daily-entry tool + their fields & headline metric.
export const CAMPAIGN_TYPES = {
  LEAD: { label: "Lead", icon: "🎯", result: "Leads", metric: "CPL", tone: "violet" },
  CALLS: { label: "Calls", icon: "📞", result: "Calls", metric: "Cost/Call", tone: "sky" },
  WHATSAPP: { label: "WhatsApp", icon: "💬", result: "WhatsApp", metric: "Cost/Conv", tone: "emerald" },
  AWARENESS: { label: "Awareness", icon: "👁️", result: "Reach", metric: "CPM", tone: "amber" },
  SALE: { label: "Sale", icon: "🛒", result: "Orders", metric: "ROAS", tone: "rose" },
} as const;
export type CampaignType = keyof typeof CAMPAIGN_TYPES;
export const CAMPAIGN_KEYS = Object.keys(CAMPAIGN_TYPES) as CampaignType[];

// Creative task board (Designer + Video Editor dashboards).
export const CREATIVE_STATUS = {
  PENDING: { label: "Pending", tone: "slate" },
  IN_PROGRESS: { label: "In Progress", tone: "sky" },
  REVIEW: { label: "Review Pending", tone: "violet" },
  COMPLETED: { label: "Completed", tone: "emerald" },
} as const;
export type CreativeStatus = keyof typeof CREATIVE_STATUS;
export const CREATIVE_STATUS_KEYS = Object.keys(CREATIVE_STATUS) as CreativeStatus[];

export const DESIGN_TYPES = ["Logo", "Social Creative", "Banner", "Poster", "Brochure", "Ad Creative", "Thumbnail", "Flyer"] as const;
export const VIDEO_TYPES = ["Testimonial", "Reel", "YouTube", "Intro", "Ad Video", "Other"] as const;

// Google Ads — campaign types shown in the AM's Google Ads console.
export const GADS_TYPES = {
  SEARCH: { label: "Search", tone: "slate" },
  DISPLAY: { label: "Display", tone: "amber" },
  PMAX: { label: "PMax", tone: "violet" },
  SMART: { label: "Smart Campaign", tone: "sky" },
} as const;
export type GAdsType = keyof typeof GADS_TYPES;
export const GADS_TYPE_KEYS = Object.keys(GADS_TYPES) as GAdsType[];

export const GADS_PERIODS = {
  YESTERDAY: { label: "Yesterday", suffix: "Yesterday" },
  TODAY: { label: "Today", suffix: "Today" },
  WEEK: { label: "This Week", suffix: "This Week" },
  MONTH: { label: "This Month", suffix: "This Month" },
} as const;
export type GAdsPeriod = keyof typeof GADS_PERIODS;

// SM Posts (social media) daily-entry tool — platforms, post types & status.
export const PLATFORMS = {
  INSTAGRAM: { label: "Instagram", icon: "📸", tone: "magenta" },
  FACEBOOK: { label: "Facebook", icon: "👍", tone: "sky" },
  LINKEDIN: { label: "LinkedIn", icon: "💼", tone: "indigo" },
  YOUTUBE: { label: "YouTube", icon: "▶️", tone: "rose" },
} as const;
export type Platform = keyof typeof PLATFORMS;
export const PLATFORM_KEYS = Object.keys(PLATFORMS) as Platform[];

export const POST_TYPES = ["Post", "Reel", "Story", "Carousel"] as const;
export const POST_STATUS = { POSTED: "Posted", SCHEDULED: "Scheduled" } as const;
export type PostStatus = keyof typeof POST_STATUS;

// Development team — website / landing-page project tracker.
export const DEV_PLATFORMS = {
  WORDPRESS: { label: "WordPress", tone: "sky" },
  SHOPIFY: { label: "Shopify", tone: "emerald" },
  REACT: { label: "React", tone: "sky" },
  NEXTJS: { label: "Next.js", tone: "indigo" },
  NODEJS: { label: "Node.js", tone: "emerald" },
  HTML: { label: "HTML / CSS", tone: "amber" },
} as const;
export type DevPlatform = keyof typeof DEV_PLATFORMS;
export const DEV_PLATFORM_KEYS = Object.keys(DEV_PLATFORMS) as DevPlatform[];

export const PROJECT_TYPES = { WEBSITE: "Website", LANDING: "Landing Page" } as const;
export type ProjectType = keyof typeof PROJECT_TYPES;

export const PROJECT_STATUS = {
  UNASSIGNED: { label: "Unassigned", tone: "slate" },
  ASSIGNED: { label: "Assigned", tone: "sky" },
  REQUIREMENTS: { label: "Requirement Collection", tone: "violet" },
  DESIGN: { label: "Design", tone: "violet" },
  DEVELOPMENT: { label: "Development", tone: "amber" },
  TESTING: { label: "Testing", tone: "amber" },
  CLIENT_REVIEW: { label: "Client Review", tone: "sky" },
  REVISION: { label: "Revision", tone: "rose" },
  COMPLETED: { label: "Completed", tone: "emerald" },
  ON_HOLD: { label: "On Hold", tone: "rose" },
  // legacy statuses kept so pre-existing dev projects still render
  PLANNING: { label: "Planning", tone: "slate" },
  IN_PROGRESS: { label: "In Progress", tone: "violet" },
  REVIEW: { label: "Review", tone: "amber" },
  LIVE: { label: "Live", tone: "emerald" },
} as const;
export type ProjectStatus = keyof typeof PROJECT_STATUS;
export const PROJECT_STATUS_KEYS = Object.keys(PROJECT_STATUS) as ProjectStatus[];

export const PRIORITIES = {
  HIGH: { label: "High", tone: "rose" },
  MEDIUM: { label: "Medium", tone: "amber" },
  LOW: { label: "Low", tone: "slate" },
} as const;
export type Priority = keyof typeof PRIORITIES;
export const PRIORITY_KEYS = Object.keys(PRIORITIES) as Priority[];

// Assigned tasks (head → team member)
export const TASK_STATUS = {
  TODO: { label: "To do", tone: "slate" },
  IN_PROGRESS: { label: "In progress", tone: "violet" },
  DONE: { label: "Done", tone: "emerald" },
} as const;
export type TaskStatus = keyof typeof TASK_STATUS;
export const TASK_STATUS_KEYS = Object.keys(TASK_STATUS) as TaskStatus[];
// Roles that can assign tasks to others.
// Full-access admin roles — Sub Admin mirrors Super Admin's reach across the app.
export const ADMIN_ROLES = ["SUPER_ADMIN", "SUB_ADMIN"];
export const ASSIGNER_ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "AM_HEAD", "SEO_HEAD", "DEV_HEAD"];

export const DEPARTMENTS = {
  SEO: "SEO",
  DESIGN: "Design / SMO",
  VIDEO: "Video",
  ACCOUNT: "Account Mgmt",
  ADS: "Ads",
} as const;
export type Department = keyof typeof DEPARTMENTS;

// Matches the onboarding design's category list.
export const INDUSTRIES = [
  "Interior Design", "Healthcare", "Real Estate", "Education", "E-commerce",
  "Manufacturing", "Hospitality", "Automobile", "Legal", "Fitness",
  "Finance", "IT", "Fashion", "Other",
];

// Work-type catalog for the Update Work form, grouped by department.
export const WORK_TYPES = [
  { v: "blog", l: "Blog (SEO)", dept: "SEO" },
  { v: "ranking", l: "Keyword ranking (SEO)", dept: "SEO" },
  { v: "backlink", l: "Backlink (SEO)", dept: "SEO" },
  { v: "localseo", l: "Local SEO (GBP / citation)", dept: "SEO" },
  { v: "audit", l: "SEO audit", dept: "SEO" },
  { v: "static", l: "Static post (SMO)", dept: "DESIGN" },
  { v: "carousel", l: "Carousel (SMO)", dept: "DESIGN" },
  { v: "reel", l: "Reel (SMO)", dept: "DESIGN" },
  { v: "story", l: "Story (SMO)", dept: "DESIGN" },
  { v: "aiVideo", l: "AI video", dept: "VIDEO" },
  { v: "reelEdit", l: "Reel edit (Video)", dept: "VIDEO" },
  { v: "longVideo", l: "Long-form edit (Video)", dept: "VIDEO" },
  { v: "meeting", l: "Meeting / call", dept: "ACCOUNT" },
  { v: "report", l: "Client report", dept: "ACCOUNT" },
  { v: "task", l: "Other task", dept: "ACCOUNT" },
] as const;

// SEO work categories (for the per-client SEO detail filters).
export const SEO_CATEGORIES = [
  { key: "blog", label: "Blogs", tone: "violet" },
  { key: "backlink", label: "Backlinks", tone: "sky" },
  { key: "ranking", label: "Keywords", tone: "emerald" },
  { key: "localseo", label: "Local SEO", tone: "amber" },
  { key: "audit", label: "Audits", tone: "rose" },
] as const;
export type SeoCategory = (typeof SEO_CATEGORIES)[number]["key"];

// Health bands from completion %
export function healthBand(pct: number): { key: string; label: string; tone: string } {
  if (pct >= 80) return { key: "on_track", label: "On Track", tone: "emerald" };
  if (pct >= 50) return { key: "attention", label: "Attention", tone: "amber" };
  return { key: "critical", label: "Critical", tone: "rose" };
}

// Time-factor model: expected fraction of the monthly target that should be done by "now".
export const FACTORS = { today: 0.05, yesterday: 0.05, week: 0.25, lastWeek: 0.25, month: 1, lastMonth: 0.9, custom: 1 } as const;

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const inrShort = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
