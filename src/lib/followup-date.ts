import "server-only";
import { prisma } from "./prisma";

// One "next follow-up" date per client. Wherever the accountant sets it — the client's
// Follow-up popup, an invoice's follow-up, or Payment Reminders — it is the client's date, and
// the newest one replaces the older one everywhere (earlier dates kept on that client's
// invoices are cleared, so the invoices list never shows a stale date).
// An invoice that belongs to no client keeps its own date.

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

// The client an invoice belongs to: its linked client, else the client with exactly its bill-to name.
export async function clientIdOfInvoice(inv: { clientId: string | null; billTo: string }): Promise<string | null> {
  if (inv.clientId) return inv.clientId;
  const name = norm(inv.billTo);
  if (!name) return null;
  const hit = (await prisma.client.findMany({ select: { id: true, name: true } })).filter((c) => norm(c.name) === name);
  return hit.length === 1 ? hit[0].id : null;
}

// The ids of a client's invoices (linked, or unlinked with exactly the client's name).
async function invoiceIdsOfClient(clientId: string): Promise<string[]> {
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
  if (!c) return [];
  const [linked, loose] = await Promise.all([
    prisma.salesInvoice.findMany({ where: { clientId }, select: { id: true } }),
    prisma.salesInvoice.findMany({ where: { clientId: null }, select: { id: true, billTo: true } }),
  ]);
  return [...linked.map((i) => i.id), ...loose.filter((i) => norm(i.billTo) === norm(c.name)).map((i) => i.id)];
}

// Set (date) or remove ("") the client's next follow-up date.
export async function setClientFollowupDate(clientId: string, date: string) {
  const ids = await invoiceIdsOfClient(clientId);
  await prisma.$transaction([
    prisma.client.update({ where: { id: clientId }, data: { nextFollowup: date } }),
    ...(ids.length ? [prisma.salesInvoice.updateMany({ where: { id: { in: ids }, nextFollowup: { not: null } }, data: { nextFollowup: null } })] : []),
  ]);
}

// Set (date) or remove ("") the next follow-up from an invoice: it goes on the invoice's client;
// an invoice with no client keeps it itself.
export async function setInvoiceFollowupDate(invoiceId: string, date: string) {
  const inv = await prisma.salesInvoice.findUnique({ where: { id: invoiceId }, select: { clientId: true, billTo: true } });
  if (!inv) return;
  const clientId = await clientIdOfInvoice(inv);
  if (clientId) await setClientFollowupDate(clientId, date);
  else await prisma.salesInvoice.update({ where: { id: invoiceId }, data: { nextFollowup: date || null } });
}
