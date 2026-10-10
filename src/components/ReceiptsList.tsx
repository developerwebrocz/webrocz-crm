"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, CheckCircle2, Clock3, ReceiptText, Wallet, ArrowRight } from "lucide-react";
import { COMPANIES } from "@/lib/domain";

// Payment receipts — every payment received, with whether its receipt has been sent to the
// client. "To send" is the list to clear after payments are recorded.

type Row = { id: string; receiptNo: string; date: string; amount: number; mode: string; ref: string; by: string; sentAt: string; sentBy: string; invoiceId: string; invoiceNumber: string; client: string; company: string; phone: string; earlier: boolean };

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmt = (iso: string) => { const [y, m, d] = (iso || "").split("-"); return d ? `${d}-${m}-${y}` : iso || "—"; };
const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, white)`;

export default function ReceiptsList({ rows, since }: { rows: Row[]; since: string }) {
  const [tab, setTab] = useState("TODO");
  const [q, setQ] = useState("");
  const todo = rows.filter((r) => !r.sentAt && !r.earlier);
  const sent = rows.filter((r) => r.sentAt);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (tab === "TODO" ? todo : tab === "SENT" ? sent : rows).filter((r) => !n || r.client.toLowerCase().includes(n) || r.receiptNo.toLowerCase().includes(n) || r.invoiceNumber.toLowerCase().includes(n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, tab, q]);
  const tiles = [
    { label: "Receipts to send", value: todo.length, sub: todo.length ? inr(todo.reduce((s, r) => s + r.amount, 0)) + " received" : "all sent", icon: Clock3, tone: todo.length ? "var(--amber)" : "var(--emerald)" },
    { label: "Receipts sent", value: sent.length, sub: "to clients", icon: CheckCircle2, tone: "var(--emerald)" },
    { label: "Payments received", value: rows.length, sub: inr(rows.reduce((s, r) => s + r.amount, 0)), icon: Wallet, tone: "var(--violet)" },
  ];
  const tabs = [{ key: "TODO", label: "To send", n: todo.length }, { key: "SENT", label: "Sent", n: sent.length }, { key: "ALL", label: "All payments", n: rows.length }];

  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow">Accounts</div>
        <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Payment Receipts</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">A receipt for every payment received — send it to the client after the payment is recorded.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((k) => (
          <div key={k.label} className="card card-pad">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{k.label}</span>
              <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px]" style={{ background: tint(k.tone, 12), color: k.tone }}><k.icon size={15} /></span>
            </div>
            <div className="mt-1.5 text-[28px] font-extrabold leading-none tracking-tight tnum">{k.value}</div>
            <div className="mt-1.5 text-[11.5px] text-[var(--muted)]">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-5 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {tabs.map((t) => <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`pill ${tab === t.key ? "pill-dark" : ""}`}>{t.label} <span className={`ml-1 tnum ${tab === t.key ? "opacity-70" : "text-[var(--muted)]"}`}>{t.n}</span></button>)}
          </div>
          <label className="relative ml-auto block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, receipt, invoice…" className="input !h-9 !w-[240px] !py-0 !pl-8 text-[13px]" />
          </label>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[880px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                <th className="px-5 py-2.5 text-left">Paid on</th>
                <th className="px-3 py-2.5 text-left">Receipt no.</th>
                <th className="px-3 py-2.5 text-left">Client</th>
                <th className="px-3 py-2.5 text-left">Invoice</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5 text-left">Mode</th>
                <th className="px-3 py-2.5 text-left">Receipt</th>
                <th className="px-5 py-2.5 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="whitespace-nowrap px-5 py-2.5 font-semibold tnum">{fmt(r.date)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tnum">{r.receiptNo}</td>
                  <td className="max-w-[240px] px-3 py-2.5"><div className="truncate font-bold" title={r.client}>{r.client}</div><div className="text-[11px] text-[var(--muted)]">{COMPANIES[r.company]?.label ?? ""}</div></td>
                  <td className="whitespace-nowrap px-3 py-2.5"><Link href={`/invoices/${r.invoiceId}`} className="font-semibold hover:text-[var(--violet)] hover:underline">{r.invoiceNumber}</Link></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-extrabold text-[var(--emerald)] tnum">{inr(r.amount)}</td>
                  <td className="px-3 py-2.5"><span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)]">{r.mode}</span></td>
                  <td className="px-3 py-2.5">
                    {r.sentAt
                      ? <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-[var(--emerald)]" style={{ background: tint("var(--emerald)", 11) }}><CheckCircle2 size={11} /> Sent</span>
                      : r.earlier
                        ? <span className="text-[11.5px] text-[var(--faint)]" title={`Paid before receipts started (${fmt(since)})`}>Earlier payment</span>
                        : <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: tint("var(--amber)", 14), color: "#92600a" }}><Clock3 size={11} /> To send</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right"><Link href={`/receipts/${r.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-[var(--line-2)] bg-[var(--surface)] px-2.5 text-[12px] font-bold hover:bg-[var(--surface-3)]"><ReceiptText size={13} /> {r.sentAt || r.earlier ? "Receipt" : "Send receipt"} <ArrowRight size={12} /></Link></td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-14 text-center">
                  <div className="mx-auto grid h-11 w-11 place-items-center rounded-full" style={{ background: tint("var(--emerald)", 12), color: "var(--emerald)" }}><CheckCircle2 size={20} /></div>
                  <div className="mt-2 text-[14px] font-bold">{tab === "TODO" ? "Every receipt has been sent" : "Nothing here"}</div>
                  <div className="mt-0.5 text-[12.5px] text-[var(--muted)]">{tab === "TODO" ? "A new payment will show here until its receipt is sent." : "Try another tab or clear the search."}</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
