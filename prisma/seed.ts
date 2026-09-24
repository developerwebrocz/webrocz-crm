import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { scryptSync, randomBytes } from "node:crypto";

// Shared demo password for every seeded account (shown on the login screen).
const DEMO_PASSWORD = "webrocz123";
function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

// deterministic pseudo-random so re-seeds are stable
let _s = 20260825;
const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;

async function main() {
  console.log("Clearing…");
  await prisma.workUpdate.deleteMany();
  await prisma.seoAnalytics.deleteMany();
  await prisma.creativeTask.deleteMany();
  await prisma.googleAdsCampaign.deleteMany();
  await prisma.campaignEntry.deleteMany();
  await prisma.adsPerformance.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.deliverable.deleteMany();
  await prisma.clientService.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  // ---- Team ----
  const team = [
    { name: "Rajesh Karne", role: "SUPER_ADMIN" },
    { name: "Kalyan Manideep", role: "AM_HEAD" },
    { name: "Laxmi Raj", role: "ACCOUNT_MANAGER" },
    { name: "Sowji", role: "ACCOUNT_MANAGER" },
    { name: "Veni", role: "ACCOUNT_MANAGER" },
    { name: "Kishore", role: "ACCOUNT_MANAGER" },
    { name: "Jagadeesh", role: "ACCOUNT_MANAGER" },
    { name: "Sandhya", role: "ACCOUNT_MANAGER" },
    { name: "Arun", role: "SEO_HEAD" },
    { name: "Bhavani", role: "SEO" },
    { name: "Hemanth", role: "SEO" },
    { name: "Sai Kumar", role: "SEO" },
    { name: "Praveen", role: "SEO" },
    { name: "Dassan", role: "DESIGNER" },
    { name: "Charan", role: "DESIGNER" },
    { name: "Srujan", role: "EDITOR" },
    { name: "Poona", role: "EDITOR" },
    { name: "Madhu", role: "EDITOR" },
    { name: "Ravi Teja", role: "DEV_HEAD" },
    { name: "Kiran Kumar", role: "WEB_DEV" },
    { name: "Anil Reddy", role: "WEB_DEV" },
  ];
  const users = await Promise.all(
    team.map((t, i) =>
      prisma.user.create({
        data: {
          name: t.name,
          role: t.role,
          email: `${t.name.toLowerCase().replace(/\s+/g, ".")}@webrocz.com`,
          phone: `+91 98${String(76540000 + i)}`,
          passwordHash: hashPassword(DEMO_PASSWORD),
        },
      })
    )
  );
  const byRole = (r: string) => users.filter((u) => u.role === r);
  const ams = byRole("ACCOUNT_MANAGER");
  const seos = byRole("SEO");
  const designers = byRole("DESIGNER");
  const editors = byRole("EDITOR");
  console.log(`Team: ${users.length}`);

  // ---- Clients ----
  const companies = [
    ["Urban Nest Realty", "Real Estate"], ["MediCare Plus Hospitals", "Healthcare"],
    ["EduSpark Academy", "Education"], ["TrendCart Fashion", "E-commerce"],
    ["Grand Orchid Hotels", "Hospitality"], ["AutoDrive Motors", "Automobile"],
    ["FinEdge Capital", "Finance"], ["TechNova IT Solutions", "IT"],
    ["StyleHive Apparels", "Fashion"], ["BuildWell Constructions", "Manufacturing"],
    ["Bloom Wellness Clinic", "Healthcare"], ["Bright Future School", "Education"],
    ["ShopEase Online", "E-commerce"], ["Royal Suites Inn", "Hospitality"],
    ["Speedster Automobiles", "Automobile"], ["Vogue Aura Boutique", "Fashion"],
    ["WealthWise Advisors", "Finance"], ["CodeCraft Labs", "IT"],
    ["Luxe Living Interiors", "Real Estate"], ["Sunrise Diagnostics", "Healthcare"],
    ["Knowledge Hub", "Education"], ["GlamKart Ecom", "E-commerce"],
    ["Coastal Retreat Resort", "Hospitality"], ["Torque Motors", "Automobile"],
    ["Elegance Fashion House", "Fashion"], ["SecureFund Finance", "Finance"],
    ["ByteWorks Systems", "IT"], ["SteelForge Industries", "Manufacturing"],
    ["Ignite IAS Academy", "Education"], ["Kiyara Wellness Spa", "Healthcare"],
  ];
  const pocFirst = ["Aarav", "Vikram", "Ishita", "Rohan", "Karan", "Ananya", "Sneha", "Neha", "Siddharth", "Riya", "Pooja"];
  const pocLast = ["Sharma", "Singh", "Reddy", "Mehta", "Desai", "Gupta", "Patel", "Verma", "Joshi", "Kapoor", "Nair"];
  const statuses = ["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ON_HOLD", "UPCOMING"];
  const allServices = ["SEO", "SMO", "VIDEO", "META_ADS", "GOOGLE_ADS", "CRM", "WEBSITE_DEV", "BRANDING"];

  const metricDefaults: Record<string, { metric: string; min: number; max: number }[]> = {
    SEO: [{ metric: "blogs", min: 2, max: 6 }, { metric: "keywords", min: 10, max: 30 }],
    SMO: [{ metric: "static", min: 8, max: 16 }, { metric: "carousel", min: 1, max: 4 }, { metric: "reels", min: 4, max: 12 }],
    VIDEO: [{ metric: "aiVideos", min: 4, max: 10 }, { metric: "reelsEdit", min: 4, max: 12 }],
  };
  const workTypeByMetric: Record<string, string> = {
    blogs: "blog", keywords: "keyword", static: "static", carousel: "carousel",
    reels: "reel", aiVideos: "aiVideo", reelsEdit: "reelEdit",
  };

  const now = new Date("2026-08-25T10:00:00");
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let idx = 0;
  let gadsSeq = 0; // deterministic ready/pending rotation for Google Ads clients
  for (const [name, industry] of companies) {
    const am = ams[idx % ams.length];
    let status = pick(statuses);
    const nServices = int(2, 5);
    const services = [...allServices].sort(() => rnd() - 0.5).slice(0, nServices);
    if (rnd() > 0.7) services.push("OTHER");
    // Give the demo AM persona (Sowji) a fuller Google Ads book (active clients running daily ads).
    if (am.name === "Sowji") {
      if (!services.includes("GOOGLE_ADS")) services.push("GOOGLE_ADS");
      status = "ACTIVE";
    }
    const hasGads = services.includes("GOOGLE_ADS");

    const client = await prisma.client.create({
      data: {
        code: `CLI-${1000 + idx}`,
        name,
        website: `www.${name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
        industry,
        monthlyRetainer: int(2, 25) * 5000,
        googleBudget: 0, // set below only for active Google Ads clients (after campaigns are seeded)
        pocName: `${pick(pocFirst)} ${pick(pocLast)}`,
        pocMobile: `+91 98${String(76500000 + idx)}`,
        pocEmail: `poc@${name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
        onboardDate: new Date(2025, int(0, 11), int(1, 28)),
        status,
        accountManagerId: am.id,
      },
    });

    // services
    for (const s of services) {
      await prisma.clientService.create({
        data: {
          clientId: client.id,
          service: s,
          detail: s === "OTHER" ? "Influencer outreach" : s === "WEBSITE_DEV" ? "Corporate site" : null,
        },
      });
    }

    // deliverables + assignments + updates for measurable services
    const seo = pick(seos);
    const designer = pick(designers);
    const editor = pick(editors);
    await prisma.assignment.createMany({
      data: [
        { clientId: client.id, userId: am.id, department: "ACCOUNT" },
        ...(services.includes("SEO") ? [{ clientId: client.id, userId: seo.id, department: "SEO" }] : []),
        ...(services.includes("SMO") ? [{ clientId: client.id, userId: designer.id, department: "DESIGN" }] : []),
        ...(services.includes("VIDEO") ? [{ clientId: client.id, userId: editor.id, department: "VIDEO" }] : []),
      ],
    });

    for (const s of ["SEO", "SMO", "VIDEO"]) {
      if (!services.includes(s)) continue;
      for (const m of metricDefaults[s]) {
        const agreed = int(m.min, m.max);
        await prisma.deliverable.create({
          data: { clientId: client.id, service: s, metric: m.metric, agreed },
        });
        if (m.metric === "keywords") continue; // keywords are a target, tracked via ranking updates
        // generate completed work this month at 30–95% of agreed
        const doneRatio = status === "UPCOMING" ? 0.1 : 0.3 + rnd() * 0.65;
        const done = Math.min(agreed, Math.round(agreed * doneRatio));
        const worker = s === "SEO" ? seo : s === "SMO" ? designer : editor;
        for (let k = 0; k < done; k++) {
          const day = int(1, Math.max(1, now.getDate()));
          await prisma.workUpdate.create({
            data: {
              clientId: client.id,
              userId: worker.id,
              date: new Date(monthStart.getFullYear(), monthStart.getMonth(), day),
              workType: workTypeByMetric[m.metric],
              quantity: 1,
              status: rnd() > 0.15 ? "COMPLETED" : "PENDING_APPROVAL",
              title: `${workTypeByMetric[m.metric]} #${k + 1}`,
            },
          });
        }
      }
    }

    // SEO detail data across 3 months (so the Month filter is real): blogs, keyword
    // rankings, backlinks, local SEO, audit + Google Search Console / Analytics per month.
    if (services.includes("SEO")) {
      const domains = ["medium.com", "quora.com", "reddit.com", "linkedin.com", "blogspot.com", "wordpress.com", "tumblr.com", "behance.net"];
      const localTasks = ["Google Business Profile post", "NAP citation update", "GBP Q&A reply", "Local directory listing", "GBP photos upload", "Review response"];
      const kwBase = ["best " + industry.toLowerCase() + " near me", industry.toLowerCase() + " services", "top " + name.split(" ")[0].toLowerCase(), industry.toLowerCase() + " price", "affordable " + industry.toLowerCase()];
      const seoMonths = [
        { key: "2026-08", y: 2026, mo: 7, maxDay: now.getDate(), addBlogs: false }, // Aug blogs already from deliverables
        { key: "2026-07", y: 2026, mo: 6, maxDay: 31, addBlogs: true },
        { key: "2026-06", y: 2026, mo: 5, maxDay: 30, addBlogs: true },
      ];
      for (const M of seoMonths) {
        const dt = () => new Date(M.y, M.mo, int(1, Math.max(1, M.maxDay)));
        if (M.addBlogs) for (let k = 0; k < int(2, 5); k++) {
          await prisma.workUpdate.create({ data: { clientId: client.id, userId: seo.id, date: dt(), workType: "blog", quantity: 1, status: rnd() > 0.15 ? "COMPLETED" : "PENDING_APPROVAL", title: `blog #${k + 1}` } });
        }
        for (const kw of kwBase.slice(0, int(3, 5))) {
          const prev = int(8, 40);
          await prisma.workUpdate.create({ data: { clientId: client.id, userId: seo.id, date: dt(), workType: "ranking", quantity: 1, status: "COMPLETED", keyword: kw, prevPosition: prev, currPosition: Math.max(1, prev - int(1, 8)), title: `Ranking: ${kw}` } });
        }
        for (let k = 0; k < int(4, 9); k++) {
          await prisma.workUpdate.create({ data: { clientId: client.id, userId: seo.id, date: dt(), workType: "backlink", quantity: 1, status: rnd() > 0.2 ? "COMPLETED" : "PENDING_APPROVAL", title: `Backlink from ${pick(domains)}`, proofLink: `https://${pick(domains)}/webrocz-${idx}-${M.key}-${k}` } });
        }
        for (let k = 0; k < int(2, 5); k++) {
          await prisma.workUpdate.create({ data: { clientId: client.id, userId: seo.id, date: dt(), workType: "localseo", quantity: 1, status: rnd() > 0.25 ? "COMPLETED" : "PENDING_APPROVAL", title: pick(localTasks) } });
        }
        await prisma.workUpdate.create({ data: { clientId: client.id, userId: seo.id, date: dt(), workType: "audit", quantity: 1, status: rnd() > 0.4 ? "COMPLETED" : "PENDING_APPROVAL", title: "Monthly technical SEO audit" } });
        // Google Search Console + Analytics
        const clicks = int(200, 3000); const impr = clicks * int(15, 40);
        await prisma.seoAnalytics.create({ data: { clientId: client.id, month: M.key, gscClicks: clicks, gscImpressions: impr, gscCtr: +((clicks / impr) * 100).toFixed(1), gscPosition: +(3 + rnd() * 20).toFixed(1), gaUsers: int(500, 8000), gaSessions: int(800, 12000), gaBounce: +(30 + rnd() * 35).toFixed(1), gaConversions: int(10, 300) } });
      }
    }

    // Ads performance for ad clients
    for (const plat of ["META_ADS", "GOOGLE_ADS"]) {
      if (!services.includes(plat)) continue;
      const spend = int(10, 80) * 1000;
      const leads = int(20, 200);
      await prisma.adsPerformance.create({
        data: {
          clientId: client.id, month: "2026-08",
          platform: plat === "META_ADS" ? "META" : "GOOGLE",
          spend, leads, clicks: leads * int(5, 15), impressions: leads * int(200, 800),
          conversions: Math.round(leads * (0.1 + rnd() * 0.3)),
          ctr: +(1 + rnd() * 4).toFixed(2), cpl: +(spend / leads).toFixed(0),
        },
      });
    }

    // ---- Meta Ads daily campaign entries (per type, per day) for the AM /ads board + dashboard ----
    // Seed for every active client so no Account Manager ever lands on an empty board.
    if (status === "ACTIVE") {
      const metaTypes = ["LEAD", "CALLS", "WHATSAPP", "AWARENESS", "SALE"];
      const running = [...metaTypes].sort(() => rnd() - 0.5).slice(0, int(2, 3));
      const metaRows: { clientId: string; date: string; type: string; results: number; spent: number; conversions: number; saleValue: number; ordersConverted: number }[] = [];
      // last ~18 days of August so "yesterday/today/this month" all have data
      for (let day = 13; day <= 30; day++) {
        const date = `2026-08-${String(day).padStart(2, "0")}`;
        for (const type of running) {
          const spent = int(3, 20) * 100;
          const results = Math.max(1, Math.round(spent / int(80, 220)));
          const conversions = Math.round(results * (0.1 + rnd() * 0.3));
          metaRows.push({
            clientId: client.id, date, type, results, spent, conversions,
            saleValue: type === "SALE" ? conversions * int(800, 4000) : 0,
            ordersConverted: type === "SALE" ? conversions : 0,
          });
        }
      }
      await prisma.campaignEntry.createMany({ data: metaRows });
    }

    // ---- Google Ads daily campaigns (per-campaign, per-day, full month) ----
    if (hasGads && status !== "UPCOMING") {
      const templates: [string, string][] = [
        ["Search - Brand", "SEARCH"],
        ["Search - Core Services", "SEARCH"],
        ["Search - Offers", "SEARCH"],
        ["Display - Remarketing", "DISPLAY"],
        ["PMax - Leads", "PMAX"],
        ["Smart - Near Me", "SMART"],
      ];
      const nCamp = int(3, 5);
      const camps = [...templates].sort(() => rnd() - 0.5).slice(0, nCamp);
      // demo calendar is anchored to Aug 2026; "yesterday" = 08-30, "today" = 08-31
      const days = Array.from({ length: 31 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`);
      const readyYesterday = gadsSeq++ % 3 !== 2; // ~2 of every 3 clients have entered yesterday
      const updater = pick(["Raj", "Sowji", "Team"]);
      const gadsRows: { clientId: string; date: string; name: string; type: string; spent: number; leads: number; conversions: number; status: string; updatedBy: string }[] = [];
      let monthSpent = 0;
      for (const day of days) {
        if (day === "2026-08-30" && !readyYesterday) continue; // pending update for the "yesterday" cycle
        for (const [cname, ctype] of camps) {
          const cpl = int(120, 260);
          const spent = int(4, 16) * 100;
          const leads = Math.max(1, Math.round(spent / cpl));
          const conversions = Math.round(leads * (0.1 + rnd() * 0.3));
          monthSpent += spent;
          gadsRows.push({
            clientId: client.id, date: day, name: cname, type: ctype,
            spent, leads, conversions, status: rnd() > 0.9 ? "PAUSED" : "ACTIVE", updatedBy: updater,
          });
        }
      }
      await prisma.googleAdsCampaign.createMany({ data: gadsRows });
      // Size the monthly budget from actual spend so the budget banner reads realistically
      // (~55–105% used → a mix of on-track, needs-attention and over-budget clients).
      const usedTarget = 0.55 + rnd() * 0.5;
      const budget = Math.max(5000, Math.round(monthSpent / usedTarget / 5000) * 5000);
      await prisma.client.update({ where: { id: client.id }, data: { googleBudget: budget } });
    }

    idx++;
  }

  // ---- Creative task boards: designs for designers, videos for editors ----
  const activeClients = await prisma.client.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } });
  const DESIGN_TYPES = ["Logo", "Social Creative", "Banner", "Poster", "Brochure", "Ad Creative", "Thumbnail"];
  const VIDEO_TYPES = ["Testimonial", "Reel", "YouTube", "Intro", "Ad Video"];
  const designTitles = ["Logo Design - Primary Mark", "Social Creative - New Launch Teaser", "Festival Offer Poster", "Instagram Carousel - Tips", "Brochure - Services", "Google Display Banner", "Brand Kit Refresh", "Product Ad Creative", "Story Template Set", "YouTube Thumbnail Pack", "Menu Card Redesign", "Hoarding - Grand Opening", "LinkedIn Banner", "Diwali Greeting Post", "Testimonial Graphic", "Pricing Table Creative", "Event Standee", "Packaging Label", "Web Banner - Hero", "Founder Quote Post"];
  const videoTitles = ["Doctor Interview 60 sec", "Transformation Testimonial", "Project Showcase Reel", "Student Testimonial - JEE", "YouTube Explainer 2 min", "Intro Video 30 sec", "New Launch Reel 15 sec", "Product Testimonial 45 sec", "Treatment Process Reel", "Clinic Intro 30 sec", "Ad Video 30 sec - Luxury", "Ad Video 20 sec - Offer", "Reel - Before After", "YouTube Review 5 min", "Ad Video 15 sec - Instagram", "YouTube - Course Overview", "Intro Video Showroom", "Highlights Reel 30 sec"];
  const dims = ["1080×1080 px", "1920×1080 px", "Vector - AI, EPS, PNG", "1080×1920 px (Story)", "A4 Print 300dpi", "1200×628 px"];
  const durs = ["15 sec", "20 sec", "30 sec", "45 sec", "60 sec", "2 min"];
  const statusCycle = ["COMPLETED", "COMPLETED", "IN_PROGRESS", "REVIEW", "PENDING", "PENDING"]; // ~ matches the mock mix
  const dueDates = ["2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25", "2026-08-27", "2026-08-28", "2026-08-30", "2026-09-01", "2026-09-03", "2026-09-05"]; // some past (overdue), some future

  async function seedCreative(worker: { id: string }, kind: "DESIGN" | "VIDEO", count: number) {
    const rows = [];
    const prefix = kind === "DESIGN" ? "DSG" : "VID";
    const types = kind === "DESIGN" ? DESIGN_TYPES : VIDEO_TYPES;
    const titles = kind === "DESIGN" ? designTitles : videoTitles;
    for (let i = 0; i < count; i++) {
      const cl = pick(activeClients);
      let status = statusCycle[i % statusCycle.length];
      const due = dueDates[i % dueDates.length];
      // a pending/in-progress task with a past due date reads as "overdue"; leave some that way
      if (status === "COMPLETED" && i % 5 === 0) status = "PENDING"; // add a few overdue
      rows.push({
        kind, code: `${prefix}-${String(i + 1).padStart(3, "0")}`,
        title: titles[i % titles.length], clientId: cl.id, assignedToId: worker.id,
        type: pick(types), priority: pick(["HIGH", "MEDIUM", "MEDIUM", "LOW"]),
        status, source: i % 4 === 0 ? "ADDITIONAL" : "ONBOARDING",
        assignedDate: pick(["2026-08-20", "2026-08-22", "2026-08-24", "2026-08-25"]),
        dueDate: due,
        dimensions: kind === "DESIGN" ? pick(dims) : pick(durs),
        brief: kind === "DESIGN"
          ? `${pick(["Minimalist", "Bold", "Clean", "Modern"])} ${pick(types).toLowerCase()} for ${cl.name}. Keep brand colours, high contrast.`
          : `Edit ${pick(durs)} ${pick(types).toLowerCase()} for ${cl.name}. Add captions, brand intro/outro, upbeat music.`,
        notes: status === "COMPLETED" ? "Client approved, all formats exported." : "",
        refLink: kind === "DESIGN" ? "https://behance.net/gallery/reference" : "https://youtube.com/watch?v=ref",
        rawLink: "https://drive.google.com/drive/folders/raw-assets",
        finalLink: status === "COMPLETED" ? "https://drive.google.com/drive/folders/final-export" : "",
      });
    }
    await prisma.creativeTask.createMany({ data: rows });
  }

  for (const d of designers) await seedCreative(d, "DESIGN", 20);
  for (const e of editors) await seedCreative(e, "VIDEO", 18);

  // ---- Developer team: website / landing-page projects ----
  const devs = byRole("WEB_DEV");
  const devHead = byRole("DEV_HEAD")[0];
  const allDevs = [...devs, ...(devHead ? [devHead] : [])];
  if (allDevs.length) {
    const platforms = ["WORDPRESS", "SHOPIFY", "REACT", "NEXTJS", "NODEJS", "HTML"];
    const projStatus = ["PLANNING", "IN_PROGRESS", "IN_PROGRESS", "REVIEW", "LIVE", "ON_HOLD"];
    const projTypes = ["WEBSITE", "LANDING"];
    const devClients = activeClients;
    for (let i = 0; i < 14; i++) {
      const cl = pick(devClients);
      const dev = pick(allDevs);
      const status = pick(projStatus);
      const progress = status === "LIVE" ? 100 : status === "PLANNING" ? int(5, 20) : status === "REVIEW" ? int(80, 95) : int(30, 75);
      await prisma.devProject.create({
        data: {
          name: `${cl.name.split(" ")[0]} ${pick(["Website", "Landing Page", "Redesign", "Store", "Portal"])}`,
          clientId: cl.id, assignedToId: dev.id,
          projectType: pick(projTypes), platform: pick(platforms), status,
          priority: pick(["HIGH", "MEDIUM", "MEDIUM", "LOW"]), progress,
          dueDate: `2026-09-${String(int(1, 28)).padStart(2, "0")}`,
          liveUrl: status === "LIVE" ? `https://${cl.name.toLowerCase().replace(/[^a-z]/g, "")}.com` : "",
          repoUrl: `https://github.com/webrocz/${cl.name.toLowerCase().replace(/[^a-z]/g, "")}`,
          notes: "",
        },
      });
    }
  }

  const [c, u, w, ct] = await Promise.all([prisma.client.count(), prisma.user.count(), prisma.workUpdate.count(), prisma.creativeTask.count()]);
  console.log(`Seeded → clients: ${c}, users: ${u}, work updates: ${w}, creative tasks: ${ct}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
