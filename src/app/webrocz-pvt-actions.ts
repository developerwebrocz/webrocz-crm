"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { WEB_ROCZ_CLIENT_SERVICES, detailFromCounts } from "@/lib/webrocz-services";
import { websiteServiceNames } from "@/lib/webrocz-queries";
import { stateFromGstin } from "@/lib/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Web Rocz Pvt Ltd (digital marketing, GST) has its own actions file so that changes here
// never touch the Web Rocz or Web Solutions save code.

function s(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}
function n(fd: FormData, k: string) {
  const v = parseInt(s(fd, k), 10);
  return Number.isFinite(v) ? v : 0;
}

export type WebRoczPvtInvoiceDefaults = Record<string, { gstin: string; services: { service: string; detail: string | null }[] }>;

// Read-only: each client's saved GSTIN + digital-marketing services (lower-cased name), so
// the Web Rocz Pvt Ltd invoice form can fill them in as soon as a company is picked.
export async function getWebRoczPvtInvoiceDefaults(): Promise<WebRoczPvtInvoiceDefaults> {
  const u = await getCurrentUser();
  if (!u || !["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"].includes(u.role)) return {};
  const clients = await prisma.client.findMany({ select: { name: true, gstin: true, websiteServices: true, services: { select: { service: true, detail: true } } } });
  const out: WebRoczPvtInvoiceDefaults = {};
  for (const c of clients) {
    const reserved = new Set(websiteServiceNames(c.websiteServices));
    out[c.name.trim().toLowerCase()] = { gstin: c.gstin || "", services: c.services.filter((x) => !reserved.has(x.service)) };
  }
  return out;
}

// Accountant edits a Web Rocz Pvt Ltd client: contact details, domain name, GSTIN and the
// digital-marketing services with their monthly counts. Website fields (domain / hosting
// amounts, register + renewal dates) are deliberately left untouched.
export async function updateWebRoczPvtClient(fd: FormData) {
  const u = await getCurrentUser();
  if (!u || !["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"].includes(u.role)) redirect("/");
  const id = s(fd, "id");
  if (!id) redirect("/pipeline/web-rocz-pvt");
  const back = `/accounts/${id}?company=WEB_ROCZ_PVT`;
  const name = s(fd, "name");
  if (!name) redirect(`${back}&err=name`);
  const client = await prisma.client.findUnique({ where: { id }, select: { websiteServices: true, services: { select: { service: true } } } });
  if (!client) redirect("/pipeline/web-rocz-pvt");

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
  const gstin = s(fd, "gstin").toUpperCase();
  const seoOn = picked.includes("SEO");
  const seoBlogs = Math.max(0, n(fd, "seoBlogs"));
  const seoKeywords = Math.max(0, n(fd, "seoKeywords"));
  await prisma.client.update({
    where: { id },
    data: {
      name,
      // The domain name is no longer edited here, so the saved one is left as it is.
      ...(amSent && amOk ? { accountManagerId: amId || null } : {}),
      pocName: s(fd, "pocName") || null,
      pocMobile: s(fd, "pocMobile") || null,
      pocEmail: s(fd, "pocEmail") || null,
      status: STATUS_OK.includes(s(fd, "status")) ? s(fd, "status") : "ACTIVE",
      notes: s(fd, "notes") || null,
      // Pvt Ltd bills with GST: the GSTIN typed here is used on the client's next tax invoices.
      gstin,
      gstApplicable: true,
      ...(seoOn && seoBlogs > 0 ? { blogTarget: seoBlogs } : {}),
      ...(seoOn && seoKeywords > 0 ? { keywordTarget: seoKeywords } : {}),
    },
  });
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${id}`);
  revalidatePath("/pipeline/web-rocz-pvt");
  redirect(`${back}&saved=1`);
}

// ---- Import a "Sale Report" (previous invoices) into Web Rocz Pvt Ltd ---------------------
// One invoice per CSV row, keeping the report's own invoice number, date, party, GSTIN,
// total, received amount and payment type. Columns (case-insensitive, extras ignored):
//   Date, Invoice No, Party Name, GSTIN, Phone, Total, Received, Payment Type
// The report's TOTAL already includes GST, so the taxable value is worked back at 18%.
// Safe to upload twice: a row whose invoice number already exists is skipped.
export type PvtImportResult = { ok: boolean; message: string; details?: string[] } | null;

function parseCsv(text: string): Record<string, string>[] {
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
// "01/10/2026" (day first, as in the report) or "2026-10-01" → "2026-10-01"; "" if not a date.
function isoDate(v: string): string {
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = v.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

export async function importWebRoczPvtSaleReport(_prev: PvtImportResult, fd: FormData): Promise<PvtImportResult> {
  const me = await getCurrentUser();
  if (!me || !["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"].includes(me.role)) return { ok: false, message: "You do not have access to import invoices." };
  const file = fd.get("file");
  if (!file || typeof file === "string" || !(file as File).size) return { ok: false, message: "Choose the sale report CSV file first." };
  const rows = parseCsv(await (file as File).text());
  if (!rows.length) return { ok: false, message: "That file has no invoice rows. Use the CSV made from the sale report." };
  const get = (row: Record<string, string>, ...keys: string[]) => { for (const k of keys) if (row[k]) return row[k]; return ""; };
  const amt = (v: string) => Math.round(Number((v || "").replace(/[^\d.]/g, "")) || 0);
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
  // Historical invoices are already issued, so an admin's import marks them approved; an
  // accountant's import leaves them for the usual Super Admin approval.
  const autoApprove = me.role === "SUPER_ADMIN" || me.role === "SUB_ADMIN";
  const GST_PCT = 18;

  const [clients, existing] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true, code: true } }),
    prisma.salesInvoice.findMany({ select: { number: true } }),
  ]);
  const nameToId = new Map(clients.map((c) => [norm(c.name), c.id]));
  const taken = new Set(existing.map((i) => i.number));
  let nextCode = clients.reduce((m, c) => (c.code.startsWith("CLI-") ? Math.max(m, parseInt(c.code.slice(4), 10) || 0) : m), 999) + 1;
  // Oldest first, so the newest invoices are the last ones added.
  const ordered = rows.map((row) => ({ row, date: isoDate(get(row, "date", "invoice date")) })).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let created = 0, already = 0, newClients = 0, totalAdded = 0;
  const bad: string[] = [];
  for (const { row, date } of ordered) {
    const number = get(row, "invoice no", "invoice no.", "invoice number", "invoice");
    const name = get(row, "party name", "party", "client name", "client", "name");
    const total = amt(get(row, "total", "amount"));
    if (!number || !name || total <= 0 || !date) { bad.push(`${number || "(no number)"} · ${name || "(no name)"}`); continue; }
    if (taken.has(number)) { already++; continue; }
    const gstin = get(row, "gstin", "gst no", "gst number").toUpperCase();
    const phone = get(row, "phone", "party phone no.", "party phone no", "mobile");
    const received = Math.min(total, Math.max(0, amt(get(row, "received", "received / paid", "paid"))));
    const subtotal = Math.round((total * 100) / (100 + GST_PCT));
    const taxAmount = total - subtotal;

    let clientId = nameToId.get(norm(name));
    if (!clientId) {
      const c = await prisma.client.create({ data: { code: `CLI-${nextCode++}`, name, status: "ACTIVE", gstApplicable: true, gstRate: GST_PCT, gstin, pocMobile: phone || null, onboardDate: new Date(date + "T00:00:00Z") } });
      clientId = c.id; nameToId.set(norm(name), c.id); newClients++;
    }
    const due = new Date(date + "T00:00:00Z"); due.setUTCDate(due.getUTCDate() + 15);
    const state = stateFromGstin(gstin);
    const inv = await prisma.salesInvoice.create({
      data: {
        number, clientId, pipeline: "WEBROCZ", company: "WEB_ROCZ_PVT",
        billTo: name, phone, clientGstin: gstin, ...(state ? { clientState: state, placeOfSupply: state } : {}),
        items: JSON.stringify([{ name: "Digital Marketing", qty: 1, rate: subtotal, amount: subtotal }]),
        subtotal, taxPct: GST_PCT, taxAmount, total, received,
        paymentStatus: received >= total ? "Fully Received" : received > 0 ? "Partially Received" : "Pending",
        issueDate: date, dueDate: due.toISOString().slice(0, 10),
        notes: "Imported from the sale report.",
        ...(autoApprove ? { approved: true, approvedBy: `${me.name} (sale report import)`, approvedAt: new Date() } : {}),
        // Keeps the invoice lists in true date order instead of "all imported today".
        createdAt: new Date(new Date(date + "T06:30:00Z").getTime() + created),
      },
    });
    if (received > 0) {
      const type = get(row, "payment type", "payment").toLowerCase();
      await prisma.payment.create({ data: { invoiceId: inv.id, amount: received, date, mode: type.includes("cash") ? "CASH" : type.includes("bank") ? "BANK" : "OTHER", note: "Imported from the sale report", by: me.name } });
    }
    taken.add(number); created++; totalAdded += total;
  }
  revalidatePath("/invoices"); revalidatePath("/accounts"); revalidatePath("/pipeline/web-rocz-pvt");
  const inr = (v: number) => "₹" + v.toLocaleString("en-IN");
  const details = [
    `${created} invoice${created === 1 ? "" : "s"} added (${inr(totalAdded)})`,
    `${newClients} new client${newClients === 1 ? "" : "s"} created`,
    ...(already ? [`${already} skipped — invoice number already in the CRM`] : []),
    ...(bad.length ? [`${bad.length} row${bad.length === 1 ? "" : "s"} not imported (missing date / number / name / total): ${bad.slice(0, 5).join("; ")}${bad.length > 5 ? " …" : ""}`] : []),
  ];
  return { ok: true, message: created ? "Sale report imported into Web Rocz Pvt Ltd." : "Nothing new to import.", details };
}
