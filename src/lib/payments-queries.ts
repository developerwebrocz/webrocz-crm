import { prisma } from "./prisma";

// Raw data for the Payments pipeline (/payments): every invoice with its amounts, every
// payment in the ledger, and the clients they belong to. The page filters and totals these
// in the browser, so changing a filter never needs another round trip.
export type PayInvoice = { id: string; number: string; clientKey: string; clientId: string | null; clientName: string; company: string; total: number; received: number; issueDate: string; dueDate: string };
export type PayEntry = { id: string; invoiceId: string; invoiceNumber: string; clientKey: string; clientId: string | null; clientName: string; company: string; amount: number; date: string; mode: string; ref: string; note: string; by: string };
export type PayClient = { key: string; id: string | null; code: string; name: string; phone: string; accountManager: string; billingDay: number; lastFollowup: PayFollowup | null };
// The newest follow-up logged on the client (Phone / WhatsApp / earlier untyped ones).
export type PayFollowup = { date: string; time: string; by: string; note: string; next: string; via: string };

function latestFollowup(raw: string | null | undefined): PayFollowup | null {
  try {
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr) || !arr.length) return null;
    let best = arr[0], bestKey = `${arr[0]?.date || ""} ${arr[0]?.time || ""}`;
    for (const f of arr) { const k = `${f?.date || ""} ${f?.time || ""}`; if (k >= bestKey) { best = f; bestKey = k; } } // later entry wins a tie
    return { date: String(best?.date || ""), time: String(best?.time || ""), by: String(best?.by || ""), note: String(best?.note || ""), next: String(best?.next || ""), via: String(best?.via || "") };
  } catch { return null; }
}

export async function getPaymentsPipeline(): Promise<{ invoices: PayInvoice[]; payments: PayEntry[]; clients: PayClient[] }> {
  const [invs, pays, cls] = await Promise.all([
    prisma.salesInvoice.findMany({ orderBy: { issueDate: "asc" }, select: { id: true, number: true, clientId: true, billTo: true, company: true, taxPct: true, total: true, received: true, issueDate: true, dueDate: true } }),
    prisma.payment.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }], select: { id: true, invoiceId: true, amount: true, date: true, mode: true, ref: true, note: true, by: true } }),
    prisma.client.findMany({ select: { id: true, code: true, name: true, pocMobile: true, billingDay: true, followupLog: true, accountManager: { select: { name: true } } } }),
  ]);
  const clientById = new Map(cls.map((c) => [c.id, c]));
  // An invoice without a client link is grouped under its bill-to name.
  const keyOf = (i: { clientId: string | null; billTo: string }) => i.clientId || `name:${(i.billTo || "").trim().toLowerCase()}`;
  // Older invoices carry no company tag: a GST invoice is Pvt Ltd, the rest stay unassigned.
  const companyOf = (i: { company: string; taxPct: number }) => i.company || (i.taxPct > 0 ? "WEB_ROCZ_PVT" : "OTHER");

  const invoices: PayInvoice[] = invs.map((i) => ({
    id: i.id, number: i.number, clientKey: keyOf(i), clientId: i.clientId,
    clientName: (i.clientId && clientById.get(i.clientId)?.name) || i.billTo || "—",
    company: companyOf(i), total: i.total, received: Math.min(i.received, i.total), issueDate: i.issueDate, dueDate: i.dueDate || "",
  }));
  const invById = new Map(invoices.map((i) => [i.id, i]));
  const payments: PayEntry[] = pays.flatMap((p) => {
    const inv = invById.get(p.invoiceId);
    if (!inv) return [];
    return [{ id: p.id, invoiceId: p.invoiceId, invoiceNumber: inv.number, clientKey: inv.clientKey, clientId: inv.clientId, clientName: inv.clientName, company: inv.company, amount: p.amount, date: p.date, mode: p.mode, ref: p.ref, note: p.note, by: p.by || "—" }];
  });
  const seen = new Set<string>();
  const clients: PayClient[] = [];
  for (const i of invoices) {
    if (seen.has(i.clientKey)) continue;
    seen.add(i.clientKey);
    const c = i.clientId ? clientById.get(i.clientId) : undefined;
    clients.push({ key: i.clientKey, id: i.clientId, code: c?.code ?? "", name: i.clientName, phone: c?.pocMobile ?? "", accountManager: c?.accountManager?.name ?? "", billingDay: c?.billingDay ?? 0, lastFollowup: latestFollowup(c?.followupLog) });
  }
  return { invoices, payments, clients };
}
