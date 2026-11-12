import { prisma } from "@/lib/prisma";

// One place that hands out invoice numbers, so every way of creating an invoice (company
// forms, Add client, CSV import, SLA, sales onboarding) continues the same series:
//
//   GST invoices — Web Rocz Pvt Ltd:   2026-27/180      (highest number so far + 1, from 180 on in 2026-27)
//   Non-GST — Web Solutions / Web Rocz: NG/2026-27/025
//
// The financial year (April–March) is taken from the INVOICE DATE, not from today — an invoice
// dated 28 March but entered in April still belongs to the old year's series.
// (Older GST invoices numbered "GST/2026-27/001" keep their numbers; new ones no longer use
// that second series.)

export function fyOfDate(iso?: string): string {
  const ok = !!iso && /^\d{4}-\d{2}-\d{2}/.test(iso);
  const d = ok ? new Date(iso!.slice(0, 10) + "T00:00:00Z") : new Date(Date.now() + 5.5 * 60 * 60 * 1000); // today in India
  const y = d.getUTCFullYear(), start = d.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

// Web Rocz Pvt Ltd (GST): the number a year's series continues from — the next GST invoice is
// never below it ("2026-27/180" onwards). A year not listed starts from 1 as usual.
const GST_SERIES_START: Record<string, number> = { "2026-27": 180 };

export async function nextInvoiceNumbers(gst: boolean, issueDate: string | undefined, count = 1): Promise<string[]> {
  const prefix = gst ? `${fyOfDate(issueDate)}/` : `NG/${fyOfDate(issueDate)}/`;
  const used = await prisma.salesInvoice.findMany({ where: { number: { startsWith: prefix } }, select: { number: true } });
  // highest purely numeric ending in this series (not just the most recently created row)
  const highest = used.reduce((m, i) => { const v = i.number.slice(prefix.length); return /^\d+$/.test(v) ? Math.max(m, parseInt(v, 10)) : m; }, 0);
  const start = gst ? GST_SERIES_START[fyOfDate(issueDate)] ?? 1 : 1;
  const max = Math.max(highest, start - 1);
  return Array.from({ length: Math.max(1, count) }, (_, k) => (gst ? `${prefix}${max + 1 + k}` : `${prefix}${String(max + 1 + k).padStart(3, "0")}`));
}

export const nextInvoiceNumber = async (gst: boolean, issueDate?: string) => (await nextInvoiceNumbers(gst, issueDate, 1))[0];
