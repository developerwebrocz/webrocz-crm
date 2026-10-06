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

// Accountant edits a Web Rocz (digital marketing) client: contact details, domain name and
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
  const domain = s(fd, "website");
  const seoOn = picked.includes("SEO");
  const seoBlogs = Math.max(0, n(fd, "seoBlogs"));
  const seoKeywords = Math.max(0, n(fd, "seoKeywords"));
  await prisma.client.update({
    where: { id },
    data: {
      name,
      website: domain || null,
      websiteDomain: domain,
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
