// Adds ONE client to Web Rocz (digital marketing, non-GST) straight in the database — the
// same thing "Import clients" does for a one-row sheet. No invoice is created. If a client
// with that name already exists it is updated instead of added twice; nothing is deleted.
// The client's details are given on the command line (they are not stored in this file):
//
//   npx tsx prisma/add-webrocz-client.ts 'name=Acme' 'phone=9000000000' 'contact=Ravi' 'am=Naveen'
//
// Optional: 'email=…' 'services=Meta ads, SEO' 'amount=25000' 'day=5'
//
// Uses the same Prisma + SQLite adapter as the app and the other scripts here.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { readFileSync } from "node:fs";

(function loadEnv() {
  for (const p of [".env", "prisma/../.env"]) {
    try {
      for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (!m) continue;
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
        if (process.env[m[1]] === undefined) process.env[m[1]] = val;
      }
      break;
    } catch { /* try next path */ }
  }
})();
const LIVE = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${LIVE}` }) });

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const i = a.indexOf("="); return i < 0 ? [a, ""] : [a.slice(0, i).trim().toLowerCase(), a.slice(i + 1).trim()]; }));
const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

// Free-text services ("Meta & Google ads posting") → the standard Web Rocz services.
function servicesFromText(text: string): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  if (/meta|facebook|insta/.test(t)) out.push("Meta Ads");
  if (/google/.test(t)) out.push("Google Ads");
  if (/\bseo\b/.test(t)) out.push("SEO");
  if (/social|posting|\bposts?\b|smo|ai re[ae]ls?/.test(t)) out.push("SMO");
  if (/shoot|shots?\b|shout|video/.test(t)) out.push("Videoshoot");
  if (/gmb/.test(t)) out.push("GMB");
  if (/\bcrm\b/.test(t)) out.push("CRM");
  return out;
}

async function main() {
  const name = (args.name ?? "").replace(/\s+/g, " ").trim();
  if (!name) { console.log("Give the client name:  'name=Company name'"); return; }
  const phone = (args.phone ?? "").replace(/\D/g, "");
  const servicesText = args.services ?? "";
  const amount = Math.round(Number((args.amount ?? "").replace(/[^\d.]/g, "")) || 0);
  const day = Math.min(31, Math.max(0, parseInt(args.day ?? "", 10) || 0));

  // Account manager by name: exact match, else the one team member whose name contains the
  // given name or is contained in it. No guess when it is unclear.
  const amName = args.am ?? "";
  const managers = await prisma.user.findMany({ where: { active: true, role: { in: ["ACCOUNT_MANAGER", "AM_HEAD", "DM_EXEC"] } }, select: { id: true, name: true } });
  const exact = managers.filter((m) => norm(m.name) === norm(amName));
  const loose = managers.filter((m) => { const k = norm(m.name), n = norm(amName); return !!n && k.length >= 3 && (n.includes(k) || k.includes(n)); });
  const am = !amName ? null : exact.length === 1 ? exact[0] : loose.length === 1 ? loose[0] : null;

  const sheetNote = [servicesText ? `Services (sheet): ${servicesText}` : "", amName && !am ? `Account manager (sheet): ${amName}` : ""].filter(Boolean).join(" · ");
  const data = {
    billingCompany: "WEB_ROCZ",
    ...(args.contact ? { pocName: args.contact } : {}),
    ...(phone ? { pocMobile: phone } : {}),
    ...(args.email ? { pocEmail: args.email } : {}),
    ...(amount > 0 ? { monthlyRetainer: amount } : {}),
    ...(day > 0 ? { billingDay: day } : {}),
    ...(am ? { accountManagerId: am.id } : {}),
  };

  const all = await prisma.client.findMany({ select: { id: true, code: true, name: true, notes: true, services: { select: { service: true } } } });
  const existing = all.find((c) => norm(c.name) === norm(name));
  let clientId: string, code: string, have: string[];
  if (existing) {
    const kept = (existing.notes ?? "").split("\n").filter((l) => !/^(Services|Account manager) \(sheet\):/.test(l.trim())).join("\n").trim();
    await prisma.client.update({ where: { id: existing.id }, data: { ...data, notes: [kept, sheetNote].filter(Boolean).join("\n") || null } });
    clientId = existing.id; code = existing.code; have = existing.services.map((x) => x.service);
    console.log(`Already a client — details updated: ${code} ${existing.name}`);
  } else {
    const next = all.reduce((m, c) => (c.code.startsWith("CLI-") ? Math.max(m, parseInt(c.code.slice(4), 10) || 0) : m), 999) + 1;
    const c = await prisma.client.create({ data: { code: `CLI-${next}`, name, status: "ACTIVE", gstApplicable: false, gstRate: 0, ...data, notes: sheetNote || null } });
    clientId = c.id; code = c.code; have = [];
    console.log(`Added to Web Rocz: ${code} ${name}`);
  }
  const added: string[] = [];
  for (const sv of servicesFromText(servicesText)) if (!have.includes(sv)) { await prisma.clientService.create({ data: { clientId, service: sv } }); added.push(sv); }

  console.log(`  Contact: ${args.contact || "-"} | Phone: ${phone || "-"} | Invoice date: ${day || "-"} | Monthly amount: ${amount || "-"}`);
  console.log(`  Account manager: ${am ? am.name : amName ? `"${amName}" NOT FOUND in Team (Account Manager logins: ${managers.map((m) => m.name).join(", ") || "none"}) — added without a manager` : "-"}`);
  if (added.length) console.log(`  Services: ${added.join(", ")}`);
  console.log("CLIENT_DONE");
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
