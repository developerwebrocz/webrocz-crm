"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { WEB_ROCZ_CLIENT_SERVICES, detailFromCounts } from "@/lib/webrocz-services";
import { websiteServiceNames } from "@/lib/webrocz-queries";
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
