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
// Whole rupees: commas are ignored and a decimal amount is rounded.
function n(fd: FormData, k: string) {
  const v = Math.round(parseFloat(s(fd, k).replace(/[^\d.-]/g, "")));
  return Number.isFinite(v) ? v : 0;
}

export type WebRoczPvtInvoiceDefaults = Record<string, { gstin: string; projectDate: string; paymentTerm: string; services: { service: string; detail: string | null }[] }>;

const PVT_ROLES = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];
const GST_PCT = 18;
// Financial year of a date, as the Pvt Ltd invoice series writes it: April 2026 → "2026-27".
function fyOf(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T00:00:00Z") : new Date();
  const y = d.getUTCFullYear(), start = d.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
// Next number in the Pvt Ltd series for that year: the highest "2026-27/N" so far, plus one.
async function nextPvtNumber(iso: string): Promise<string> {
  const prefix = `${fyOf(iso)}/`;
  const used = await prisma.salesInvoice.findMany({ where: { number: { startsWith: prefix } }, select: { number: true } });
  const max = used.reduce((m, i) => { const v = i.number.slice(prefix.length); return /^\d+$/.test(v) ? Math.max(m, parseInt(v, 10)) : m; }, 0);
  return `${prefix}${max + 1}`;
}

// Read-only: each client's saved GSTIN + digital-marketing services (lower-cased name), and
// the project date / payment type from its latest Pvt Ltd invoice, so the invoice form can
// fill them in as soon as a company is picked.
export async function getWebRoczPvtInvoiceDefaults(): Promise<WebRoczPvtInvoiceDefaults> {
  const u = await getCurrentUser();
  if (!u || !PVT_ROLES.includes(u.role)) return {};
  const clients = await prisma.client.findMany({ select: { name: true, gstin: true, paymentTerm: true, websiteServices: true, services: { select: { service: true, detail: true } }, salesInvoices: { where: { company: "WEB_ROCZ_PVT" }, orderBy: { issueDate: "desc" }, select: { projectDate: true, paymentTerm: true } } } });
  const out: WebRoczPvtInvoiceDefaults = {};
  for (const c of clients) {
    const reserved = new Set(websiteServiceNames(c.websiteServices));
    out[c.name.trim().toLowerCase()] = {
      gstin: c.gstin || "",
      projectDate: c.salesInvoices.find((i) => i.projectDate)?.projectDate ?? "",
      // set in Add / Edit client, else from the latest invoice that has one
      paymentTerm: c.paymentTerm || (c.salesInvoices.find((i) => i.paymentTerm)?.paymentTerm ?? ""),
      services: c.services.filter((x) => !reserved.has(x.service)),
    };
  }
  return out;
}

// Read-only: the invoice number the form should suggest for an invoice dated `iso`.
export async function getWebRoczPvtNextInvoiceNumber(iso: string): Promise<string> {
  const u = await getCurrentUser();
  if (!u || !PVT_ROLES.includes(u.role)) return "";
  return nextPvtNumber(iso);
}

// Save an uploaded file under /public/uploads/<subdir>; returns its URL ("" when none).
async function saveUpload(file: unknown, subdir: string): Promise<string> {
  if (!file || typeof file === "string") return "";
  const f = file as File;
  if (!f.size || !f.arrayBuffer) return "";
  const { writeFile, mkdir } = await import("node:fs/promises");
  const path = await import("node:path");
  const safe = (f.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const fname = `${Date.now()}-${safe}`;
  const dir = path.join(process.cwd(), "public", "uploads", subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fname), Buffer.from(await f.arrayBuffer()));
  return `/uploads/${subdir}/${fname}`;
}

export type PvtInvoiceResult = { error: string } | null;

// Create a Web Rocz Pvt Ltd invoice from its own form: the invoice number is the suggested
// next one unless the accountant typed another, and the project date + payment type
// (prepayment / post payment) are kept on the invoice. GST is added on top of the amount.
export async function addWebRoczPvtInvoice(_prev: PvtInvoiceResult, fd: FormData): Promise<PvtInvoiceResult> {
  const me = await getCurrentUser();
  if (!me || !PVT_ROLES.includes(me.role)) return { error: "You do not have access to add invoices." };
  const clientName = s(fd, "clientName");
  // Either box on the form may be filled: the amount before GST, or the total with GST.
  const typedBase = Math.max(0, n(fd, "amount"));
  const typedTotal = Math.max(0, n(fd, "grandTotal"));
  if (!clientName) return { error: "Enter the company name." };
  if (typedBase <= 0 && typedTotal <= 0) return { error: "Enter the invoice amount." };
  const issueDate = /^\d{4}-\d{2}-\d{2}$/.test(s(fd, "issueDate")) ? s(fd, "issueDate") : new Date().toISOString().slice(0, 10);
  const number = s(fd, "number") || (await nextPvtNumber(issueDate));
  if (await prisma.salesInvoice.findUnique({ where: { number }, select: { id: true } })) return { error: `Invoice number ${number} is already used. Change the number and try again.` };
  const projectDate = /^\d{4}-\d{2}-\d{2}$/.test(s(fd, "projectDate")) ? s(fd, "projectDate") : "";
  const paymentTerm = ["PREPAID", "POSTPAID"].includes(s(fd, "paymentTerm")) ? s(fd, "paymentTerm") : "";
  const formGstin = s(fd, "gstin").toUpperCase();
  const proofUrl = await saveUpload(fd.get("paymentProof"), "payments");
  const invoiceDocUrl = await saveUpload(fd.get("invoiceDoc"), "invoices");

  // Existing client by name (case-insensitive), else a new GST client.
  const all = await prisma.client.findMany({ select: { id: true, code: true, name: true, gstin: true, gstRate: true, pocName: true, pocMobile: true, pocEmail: true } });
  let client = all.find((c) => c.name.trim().toLowerCase() === clientName.toLowerCase()) ?? null;
  if (!client) {
    const code = `CLI-${all.reduce((m, c) => (c.code.startsWith("CLI-") ? Math.max(m, parseInt(c.code.slice(4), 10) || 0) : m), 999) + 1}`;
    client = await prisma.client.create({ data: { code, name: clientName, status: "ACTIVE", gstApplicable: true, gstRate: GST_PCT, gstin: formGstin }, select: { id: true, code: true, name: true, gstin: true, gstRate: true, pocName: true, pocMobile: true, pocEmail: true } });
  } else if (formGstin && !client.gstin) {
    await prisma.client.update({ where: { id: client.id }, data: { gstin: formGstin, gstApplicable: true } });
  }
  const gstin = formGstin || client.gstin || "";
  const taxPct = client.gstRate > 0 ? client.gstRate : GST_PCT;
  // The total on the invoice is exactly the "Total with GST" typed on the form; the taxable
  // amount and GST are worked back from it (no rupee gained or lost to rounding).
  const total = typedTotal > 0 ? typedTotal : typedBase + Math.round((typedBase * taxPct) / 100);
  const base = typedTotal > 0 ? Math.round((typedTotal * 100) / (100 + taxPct)) : typedBase;
  const taxAmount = total - base;
  const received = Math.min(Math.max(0, n(fd, "received")), total);
  const due = /^\d{4}-\d{2}-\d{2}$/.test(s(fd, "dueDate")) ? s(fd, "dueDate") : (() => { const d = new Date(issueDate + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 15); return d.toISOString().slice(0, 10); })();
  const state = stateFromGstin(gstin);
  const description = s(fd, "desc");

  const inv = await prisma.salesInvoice.create({
    data: {
      number, clientId: client.id, pipeline: "WEBROCZ", company: "WEB_ROCZ_PVT",
      billTo: client.name, contact: client.pocName ?? "", phone: client.pocMobile ?? "", email: client.pocEmail ?? "", clientGstin: gstin,
      ...(state ? { clientState: state, placeOfSupply: state } : {}),
      items: JSON.stringify([{ name: "Digital Marketing Services", qty: 1, rate: base, amount: base }]),
      subtotal: base, taxPct, taxAmount, total, received, paymentProof: proofUrl, invoiceDoc: invoiceDocUrl,
      paymentStatus: received >= total ? "Fully Received" : received > 0 ? "Partially Received" : "Pending",
      issueDate, dueDate: due, projectDate, paymentTerm,
      ...(description ? { notes: description } : {}),
    },
  });
  if (received > 0) {
    await prisma.payment.create({ data: { invoiceId: inv.id, amount: received, date: issueDate, mode: "OTHER", note: proofUrl ? "Invoice opening · payment screenshot attached" : "Invoice opening", ref: proofUrl, by: me.name } });
  }
  revalidatePath("/invoices");
  revalidatePath(`/accounts/${client.id}`);
  revalidatePath("/pipeline/web-rocz-pvt");
  // Land on the invoice page so it can be checked and sent right away.
  redirect(`/invoices/${inv.id}`);
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
      ...(fd.has("paymentTerm") ? { paymentTerm: ["PREPAID", "POSTPAID"].includes(s(fd, "paymentTerm")) ? s(fd, "paymentTerm") : "" } : {}),
      ...(fd.has("billingDay") ? { billingDay: Math.min(31, Math.max(0, n(fd, "billingDay"))) } : {}),
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
// Optional, for a single party's statement: Address, Item (the service on the invoice),
//   Payment Date (the day the money actually came in) and Payment Ref (receipt number).
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
  // The received amounts are recorded under the accountant picked in the dialog (an admin
  // usually imports payments the accountant collected); otherwise under whoever imports.
  const pickedBy = s(fd, "collectedBy");
  const collector = pickedBy && (await prisma.user.findFirst({ where: { name: pickedBy, active: true }, select: { id: true } })) ? pickedBy : me.name;
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
    const item = get(row, "item", "item name", "service") || "Digital Marketing Services";
    const address = get(row, "address", "party address");
    const payDate = isoDate(get(row, "payment date", "received date")) || date;
    const payRef = get(row, "payment ref", "payment no", "receipt no");
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
        ...(address ? { clientAddress: address } : {}),
        items: JSON.stringify([{ name: item, qty: 1, rate: subtotal, amount: subtotal }]),
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
      await prisma.payment.create({ data: { invoiceId: inv.id, amount: received, date: payDate, mode: type.includes("cash") ? "CASH" : type.includes("bank") ? "BANK" : "OTHER", ref: payRef, note: "Imported from the sale report", by: collector } });
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

// Read-only: a client's own follow-up log (Phone / WhatsApp / earlier), newest first, for the
// Follow-up button on the Web Rocz Pvt Ltd invoices list.
export async function getWebRoczPvtClientFollowups(clientId: string): Promise<{ date: string; by: string; note: string; next?: string; via?: string }[]> {
  const u = await getCurrentUser();
  if (!u || !PVT_ROLES.includes(u.role) || !clientId) return [];
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { followupLog: true } });
  try {
    const arr = JSON.parse(c?.followupLog || "[]");
    return Array.isArray(arr) ? arr.sort((a, b) => (a.date < b.date ? 1 : -1)) : [];
  } catch { return []; }
}
