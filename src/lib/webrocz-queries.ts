import { prisma } from "./prisma";
import { WEBSITE_ONLY_SERVICES } from "./webrocz-services";

// Digital-marketing services of a client for the Web Rocz edit form: everything tagged on
// the client except the website services, which belong to Web Solutions.
export async function getWebRoczClientServices(clientId: string) {
  const [rows, client] = await Promise.all([
    prisma.clientService.findMany({ where: { clientId }, select: { service: true, detail: true } }),
    prisma.client.findUnique({ where: { id: clientId }, select: { websiteServices: true } }),
  ]);
  const reserved = new Set(websiteServiceNames(client?.websiteServices));
  return rows.filter((r) => !reserved.has(r.service));
}

// Lower-cased client name → domain, so the Web Rocz invoice form can fill the domain as soon
// as a known company is picked.
export async function getClientDomains(): Promise<Record<string, string>> {
  const clients = await prisma.client.findMany({ select: { name: true, websiteDomain: true, website: true } });
  const out: Record<string, string> = {};
  for (const c of clients) { const d = c.websiteDomain || c.website || ""; if (d) out[c.name.trim().toLowerCase()] = d; }
  return out;
}

export function websiteServiceNames(websiteServicesJson: string | null | undefined): string[] {
  let own: string[] = [];
  try { const a = JSON.parse(websiteServicesJson || "[]"); if (Array.isArray(a)) own = a.map(String); } catch { /* ignore */ }
  return [...WEBSITE_ONLY_SERVICES, ...own];
}
