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

export function websiteServiceNames(websiteServicesJson: string | null | undefined): string[] {
  let own: string[] = [];
  try { const a = JSON.parse(websiteServicesJson || "[]"); if (Array.isArray(a)) own = a.map(String); } catch { /* ignore */ }
  return [...WEBSITE_ONLY_SERVICES, ...own];
}
