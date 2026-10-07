"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Web Rocz Pvt Ltd: client details from a sheet (CSV) — company, account manager, contact,
// phone, GSTIN, services, monthly amount (before GST) and the invoice day (1, 5, 10 …).
// No invoices are created. Kept in its own file so the Web Rocz client import and the
// Web Solutions code are never touched by changes here.

export type WebRoczPvtClientImportResult = { ok: boolean; message: string; details?: string[] } | null;

function parseCsvRows(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  const src = text.replace(/^﻿/, "").replace(/\r/g, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  const filled = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (filled.length < 2) return [];
  const head = filled[0].map((h) => h.trim().toLowerCase());
  return filled.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

// Free-text services ("Meta adds seo gmb social media") → the standard digital marketing services.
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

export async function importWebRoczPvtClients(_prev: WebRoczPvtClientImportResult, fd: FormData): Promise<WebRoczPvtClientImportResult> {
  const me = await getCurrentUser();
  if (!me || !["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"].includes(me.role)) return { ok: false, message: "You do not have access to import clients." };
  const file = fd.get("file");
  if (!file || typeof file === "string" || !(file as File).size) return { ok: false, message: "Choose the clients CSV file first." };
  const rows = parseCsvRows(await (file as File).text());
  if (!rows.length) return { ok: false, message: "That file has no client rows." };
  const get = (row: Record<string, string>, ...keys: string[]) => { for (const k of keys) if (row[k]) return row[k]; return ""; };
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

  const [clients, managers] = await Promise.all([
    prisma.client.findMany({ select: { id: true, code: true, name: true, notes: true, services: { select: { service: true } } } }),
    prisma.user.findMany({ where: { active: true, role: { in: ["ACCOUNT_MANAGER", "AM_HEAD", "DM_EXEC"] } }, select: { id: true, name: true } }),
  ]);
  const byName = new Map(clients.map((c) => [norm(c.name), c]));
  let nextCode = clients.reduce((m, c) => (c.code.startsWith("CLI-") ? Math.max(m, parseInt(c.code.slice(4), 10) || 0) : m), 999) + 1;
  // Account manager by name: exact match, else the one team member whose name contains the
  // sheet's name or is contained in it. No guess when it is unclear.
  const findManager = (name: string) => {
    const n = norm(name); if (!n) return null;
    const exact = managers.filter((m) => norm(m.name) === n);
    if (exact.length === 1) return exact[0];
    const loose = managers.filter((m) => { const k = norm(m.name); return k.length >= 3 && (n.includes(k) || k.includes(n)); });
    return loose.length === 1 ? loose[0] : null;
  };

  let created = 0, updated = 0;
  const bad: string[] = [];
  const noManager = new Map<string, number>();
  for (const row of rows) {
    const name = get(row, "company name", "company", "client name", "client", "name");
    if (!name) { bad.push("(row without a company name)"); continue; }
    const amName = get(row, "account manager", "am");
    const am = findManager(amName);
    if (amName && !am) noManager.set(amName, (noManager.get(amName) ?? 0) + 1);
    const servicesText = get(row, "services", "digital marketing services");
    // The sheet's amount is the monthly amount before GST (GST 18% is added on the invoice).
    const retainer = Math.round(Number(get(row, "monthly amount", "amount", "digital marketing (₹) gst").replace(/[^\d.]/g, "")) || 0);
    const day = Math.min(31, Math.max(0, parseInt(get(row, "invoice day", "invoice date", "billing day"), 10) || 0));
    // Only a real 15-character GSTIN is kept ("no" / "-" in the sheet mean there is none).
    const gstinRaw = get(row, "gstin", "client gstin").toUpperCase().replace(/\s+/g, "");
    const gstin = /^[0-9]{2}[A-Z0-9]{13}$/.test(gstinRaw) ? gstinRaw : "";
    // What the sheet said, kept word for word in the client's notes.
    const sheetNote = [servicesText ? `Services (sheet): ${servicesText}` : "", amName && !am ? `Account manager (sheet): ${amName}` : ""].filter(Boolean).join(" · ");
    const data = {
      billingCompany: "WEB_ROCZ_PVT",
      gstApplicable: true,
      gstRate: 18,
      pocName: get(row, "contact person", "contact") || null,
      pocMobile: get(row, "phone", "mobile") || null,
      pocEmail: get(row, "email") || null,
      ...(gstin ? { gstin } : {}),
      ...(retainer > 0 ? { monthlyRetainer: retainer } : {}),
      ...(day > 0 ? { billingDay: day } : {}),
      ...(am ? { accountManagerId: am.id } : {}),
    };
    const existing = byName.get(norm(name));
    let clientId: string, have: string[];
    if (existing) {
      // keep any note already typed on the client; replace only the part this import wrote
      const kept = (existing.notes ?? "").split("\n").filter((l) => !/^(Services|Account manager) \(sheet\):/.test(l.trim())).join("\n").trim();
      await prisma.client.update({ where: { id: existing.id }, data: { ...data, notes: [kept, sheetNote].filter(Boolean).join("\n") || null } });
      clientId = existing.id; have = existing.services.map((x) => x.service); updated++;
    } else {
      const c = await prisma.client.create({ data: { code: `CLI-${nextCode++}`, name, status: "ACTIVE", ...data, notes: sheetNote || null } });
      clientId = c.id; have = []; created++;
      byName.set(norm(name), { id: c.id, code: c.code, name, notes: sheetNote, services: [] });
    }
    for (const sv of servicesFromText(servicesText)) if (!have.includes(sv)) await prisma.clientService.create({ data: { clientId, service: sv } });
  }
  revalidatePath("/pipeline/web-rocz-pvt"); revalidatePath("/accounts");
  const details = [
    `${created} new client${created === 1 ? "" : "s"} added`,
    `${updated} existing client${updated === 1 ? "" : "s"} updated`,
    ...(noManager.size ? [`Account manager not found in Team for: ${[...noManager].map(([n, c]) => `${n} (${c})`).join(", ")} — those clients were added without a manager`] : []),
    ...(bad.length ? [`${bad.length} row${bad.length === 1 ? "" : "s"} skipped: ${bad.slice(0, 3).join("; ")}`] : []),
  ];
  return { ok: true, message: "Client details imported into Web Rocz Pvt Ltd. No invoices were created.", details };
}
