"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { WEB_ROCZ_CLIENT_SERVICES, detailFromCounts } from "@/lib/webrocz-services";
import { websiteServiceNames, getClientInvoiceDefaults } from "@/lib/webrocz-queries";
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

export type WebRoczInvoiceDefaults = Record<string, { domain: string; services: { service: string; detail: string | null }[] }>;

// Read-only: each client's saved domain + digital-marketing services, so the Web Rocz
// invoice form can fill them in as soon as a company is picked.
export async function getWebRoczInvoiceDefaults(): Promise<WebRoczInvoiceDefaults> {
  const u = await getCurrentUser();
  if (!u || !["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"].includes(u.role)) return {};
  return getClientInvoiceDefaults();
}

// Read-only: the team members who can be a client's account manager (same roles the finance
// screens already use), for the Account manager dropdown in the Web Rocz client forms.
export async function getWebRoczAccountManagers(): Promise<{ id: string; name: string }[]> {
  const u = await getCurrentUser();
  if (!u || !["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"].includes(u.role)) return [];
  return prisma.user.findMany({ where: { active: true, role: { in: ["ACCOUNT_MANAGER", "AM_HEAD", "DM_EXEC"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

// Accountant edits a Web Rocz (digital marketing) client: contact details, account manager and
// the DM services with their monthly counts. Website fields (domain / hosting amounts,
// register + renewal dates) belong to Web Solutions and are deliberately left untouched.
export async function updateWebRoczClient(fd: FormData) {
  const u = await getCurrentUser();
  if (!u || !["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"].includes(u.role)) redirect("/");
  const id = s(fd, "id");
  if (!id) redirect("/pipeline/web-rocz");
  const back = `/accounts/${id}?company=WEB_ROCZ`;
  const name = s(fd, "name");
  if (!name) redirect(`${back}&err=name`);
  const client = await prisma.client.findUnique({ where: { id }, select: { websiteServices: true, services: { select: { service: true } } } });
  if (!client) redirect("/pipeline/web-rocz");

  const reserved = new Set(websiteServiceNames(client.websiteServices));
  const picked = [...new Set(fd.getAll("dmServices").map((v) => String(v).trim()).filter(Boolean))].filter((sv) => !reserved.has(sv));
  const existing = client.services.map((x) => x.service);
  // Un-ticked services are removed; website services are never part of this form.
  const removed = existing.filter((sv) => !reserved.has(sv) && !picked.includes(sv));
  if (removed.length) await prisma.clientService.deleteMany({ where: { clientId: id, service: { in: removed } } });
  for (const sv of picked) {
    const counts = WEB_ROCZ_CLIENT_SERVICES.find((x) => x.name === sv)?.counts;
    if (counts) {
      const detail = detailFromCounts(counts, (f) => Math.max(0, n(fd, f))) || null;
      await prisma.clientService.upsert({ where: { clientId_service: { clientId: id, service: sv } }, create: { clientId: id, service: sv, detail }, update: { detail } });
    } else if (!existing.includes(sv)) {
      await prisma.clientService.create({ data: { clientId: id, service: sv } });
    }
  }

  const STATUS_OK = ["ACTIVE", "ON_HOLD", "UPCOMING"];
  // Account manager from the dropdown ("" = not assigned). Only applied when the form sent
  // the field and the id is a real, active team member.
  const amSent = fd.has("accountManagerId");
  const amId = s(fd, "accountManagerId");
  const amOk = !amId || !!(await prisma.user.findFirst({ where: { id: amId, active: true }, select: { id: true } }));
  const seoOn = picked.includes("SEO");
  const seoBlogs = Math.max(0, n(fd, "seoBlogs"));
  const seoKeywords = Math.max(0, n(fd, "seoKeywords"));
  await prisma.client.update({
    where: { id },
    data: {
      name,
      // The domain name is no longer edited here, so the saved one is left as it is.
      ...(amSent && amOk ? { accountManagerId: amId || null } : {}),
      ...(fd.has("billingDay") ? { billingDay: Math.min(31, Math.max(0, n(fd, "billingDay"))) } : {}),
      ...(fd.has("paymentTerm") ? { paymentTerm: ["PREPAID", "POSTPAID"].includes(s(fd, "paymentTerm")) ? s(fd, "paymentTerm") : "" } : {}),
      pocName: s(fd, "pocName") || null,
      pocMobile: s(fd, "pocMobile") || null,
      pocEmail: s(fd, "pocEmail") || null,
      status: STATUS_OK.includes(s(fd, "status")) ? s(fd, "status") : "ACTIVE",
      notes: s(fd, "notes") || null,
      ...(seoOn && seoBlogs > 0 ? { blogTarget: seoBlogs } : {}),
      ...(seoOn && seoKeywords > 0 ? { keywordTarget: seoKeywords } : {}),
    },
  });
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${id}`);
  revalidatePath("/pipeline/web-rocz");
  redirect(`${back}&saved=1`);
}

// ---- Import client details (no invoices) into Web Rocz -----------------------------------
// One client per CSV row. Columns (case-insensitive, extras ignored):
//   Company name, Account manager, Contact person, Phone, Email, GSTIN, Services,
//   Monthly amount, Invoice day
// A company that is already a client is UPDATED with the row's details instead of being
// added twice, so the same file can be uploaded again after fixing something.
export type WebRoczClientImportResult = { ok: boolean; message: string; details?: string[] } | null;

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

// Free-text services ("Meta adds seo gmb social media") → the standard Web Rocz services.
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

export async function importWebRoczClients(_prev: WebRoczClientImportResult, fd: FormData): Promise<WebRoczClientImportResult> {
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
  // sheet's name or is contained in it ("Veeraveni" ↔ "Veni"). No guess when it is unclear.
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
    const retainer = Math.round(Number(get(row, "monthly amount", "amount", "digital marketing (₹) gst").replace(/[^\d.]/g, "")) || 0);
    const day = Math.min(31, Math.max(0, parseInt(get(row, "invoice day", "invoice date", "billing day"), 10) || 0));
    const gstin = get(row, "gstin", "client gstin").toUpperCase();
    // What the sheet said, kept word for word in the client's notes.
    const sheetNote = [servicesText ? `Services (sheet): ${servicesText}` : "", amName && !am ? `Account manager (sheet): ${amName}` : ""].filter(Boolean).join(" · ");
    const data = {
      billingCompany: "WEB_ROCZ",
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
      const c = await prisma.client.create({ data: { code: `CLI-${nextCode++}`, name, status: "ACTIVE", gstApplicable: false, gstRate: 0, ...data, notes: sheetNote || null } });
      clientId = c.id; have = []; created++;
      byName.set(norm(name), { id: c.id, code: c.code, name, notes: sheetNote, services: [] });
    }
    for (const sv of servicesFromText(servicesText)) if (!have.includes(sv)) await prisma.clientService.create({ data: { clientId, service: sv } });
  }
  revalidatePath("/pipeline/web-rocz"); revalidatePath("/accounts");
  const details = [
    `${created} new client${created === 1 ? "" : "s"} added`,
    `${updated} existing client${updated === 1 ? "" : "s"} updated`,
    ...(noManager.size ? [`Account manager not found in Team for: ${[...noManager].map(([n, c]) => `${n} (${c})`).join(", ")} — those clients were added without a manager`] : []),
    ...(bad.length ? [`${bad.length} row${bad.length === 1 ? "" : "s"} skipped: ${bad.slice(0, 3).join("; ")}`] : []),
  ];
  return { ok: true, message: "Client details imported into Web Rocz. No invoices were created.", details };
}
