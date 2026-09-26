"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, ShieldCheck, Clock, MessageSquarePlus, X, Pencil, Trash2, Plus } from "lucide-react";
import { companyLabel, COMPANY_KEYS } from "@/lib/domain";
import { addInvoiceNote, deleteSalesInvoice } from "@/app/sales-actions";
import AddInvoiceModal from "@/components/AddInvoiceModal";

/* eslint-disable @typescript-eslint/no-explicit-any */
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmtD = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split(" ")[0].split("-"); return d ? `${d}-${m}-${y}` : iso; };
const todayISO = () => new Date().toISOString().slice(0, 10);

const STATUS = [
  { k: "", label: "All" },
  { k: "pending_approval", label: "Pending approval" },
  { k: "approved", label: "Approved" },
  { k: "unpaid", label: "Balance due" },
  { k: "overdue", label: "Overdue" },
  { k: "paid", label: "Fully paid" },
];

const COMPANY_TABS = [{ k: "", label: "All companies" }, ...COMPANY_KEYS.map((k) => ({ k, label: companyLabel(k) }))];

export default function InvoicesDashboard({ rows, totals, companyCounts, clientNames = [], q, status, company, hideApproval, embedded }: { rows: any[]; totals: any; companyCounts: Record<string, { count: number; billed: number }>; clientNames?: string[]; q: string; status: string; company: string; hideApproval?: boolean; embedded?: boolean }) {
  const statusOptions = hideApproval ? STATUS.filter((s) => s.k !== "pending_approval" && s.k !== "approved") : STATUS;
  const [fuInv, setFuInv] = useState<any>(null); // invoice whose follow-ups modal is open
  const [delInv, setDelInv] = useState<any>(null); // invoice pending delete confirmation
  const [addOpen, setAddOpen] = useState(false); // "add new invoice" modal
  const tabHref = (co: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (co) p.set("company", co);
    const qs = p.toString();
    return `/invoices${qs ? `?${qs}` : ""}`;
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {embedded
          ? <div />
          : <div>
              <h1 className="text-[26px] font-extrabold tracking-tight">Invoices</h1>
              <p className="text-[13px] text-[var(--muted)]">All client invoices — track {hideApproval ? "payments &amp; follow-ups" : "approval, payments &amp; follow-ups"}.</p>
            </div>}
        <button onClick={() => setAddOpen(true)} className="btn btn-violet"><Plus size={16} /> Add new invoice</button>
      </div>

      {/* company tabs — hidden inside a company hub (CompanyNav locks the company) */}
      {!embedded && (
      <div className="flex flex-wrap gap-2">
        {COMPANY_TABS.map((t) => {
          const active = company === t.k;
          const c = companyCounts[t.k || "ALL"] ?? { count: 0, billed: 0 };
          return (
            <Link key={t.k || "all"} href={tabHref(t.k)} prefetch className={`inline-flex items-center gap-1.5 rounded-[10px] border px-4 py-2 text-[13px] font-semibold transition ${active ? "border-transparent bg-[var(--violet)] text-white shadow-sm" : "border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]"}`}>
              {t.label}{t.k && <span className={`text-[10px] font-bold uppercase tracking-wide ${active ? "text-white/70" : "text-[var(--faint)]"}`}>{t.k === "WEB_ROCZ_PVT" ? "GST" : "No GST"}</span>}
              <span className={`grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold tnum ${active ? "bg-white/25 text-white" : "bg-[var(--surface-2)] text-[var(--ink-2)]"}`}>{c.count}</span>
            </Link>
          );
        })}
      </div>
      )}

      {/* KPIs */}
      <div className={`grid gap-3 sm:grid-cols-2 ${hideApproval ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}>
        <Kpi label="Invoices" value={String(totals.count)} icon={<FileText size={16} />} />
        <Kpi label="Total billed" value={inr(totals.billed)} />
        <Kpi label="Received" value={inr(totals.received)} tone="var(--emerald)" />
        <Kpi label="Balance due" value={inr(totals.balance)} tone="var(--amber)" />
        {!hideApproval && <Kpi label="Pending approval" value={String(totals.pendingApproval)} tone="var(--violet)" icon={<Clock size={16} />} />}
      </div>

      {/* filters */}
      <form method="get" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="company" value={company} />
        <input name="q" defaultValue={q} placeholder="Search invoice no. / client / phone…" className="input !w-auto min-w-[240px]" />
        <select name="status" defaultValue={status} className="select !w-auto">{statusOptions.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}</select>
        <button className="btn btn-ghost btn-sm">Apply</button>
        {(q || status) && <Link href={company ? `/invoices?company=${company}` : "/invoices"} className="btn btn-ghost btn-sm">Clear</Link>}
      </form>

      {/* table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
              <th className="th">Invoice</th><th className="th">Company</th><th className="th">Client</th><th className="th">Date</th><th className="th !text-right">Total</th><th className="th !text-right">Balance</th><th className="th !pl-10">Payment</th>{!hideApproval && <th className="th">Approval</th>}<th className="th">Actions</th>
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={hideApproval ? 8 : 9} className="px-4 py-10 text-center text-[13px] text-[var(--muted)]">No invoices found.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-3 font-semibold">{r.number}</td>
                  <td className="px-4 py-3"><div className="text-[12px] font-semibold">{companyLabel(r.company)}</div><span className={`text-[10px] font-bold ${r.gst ? "text-[var(--violet)]" : "text-[var(--faint)]"}`}>{r.gst ? "GST" : "No GST"}</span></td>
                  <td className="px-4 py-3">{r.clientId ? <Link href={`/accounts/${r.clientId}`} prefetch className="font-semibold text-[var(--violet)] hover:underline">{r.billTo}</Link> : r.billTo}<div className="text-[11.5px] text-[var(--faint)]">{r.phone || r.email || ""}</div></td>
                  <td className="px-4 py-3 text-[var(--ink-2)]">{r.issueDate}</td>
                  <td className="px-4 py-3 text-right tnum">{inr(r.total)}</td>
                  <td className="px-4 py-3 text-right tnum" style={{ color: r.balance > 0 ? "var(--amber)" : "var(--emerald)" }}>{inr(r.balance)}</td>
                  <td className="py-3 pl-10 pr-4">{r.paymentStatus}</td>
                  {!hideApproval && <td className="px-4 py-3">
                    {r.approved
                      ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--emerald)" }}><ShieldCheck size={13} /> Approved</span>
                      : <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--amber)" }}><Clock size={13} /> Pending</span>}
                  </td>}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setFuInv(r)} title="Follow-ups" className="inline-flex items-center gap-1 rounded-[7px] border border-[var(--line-2)] px-2 py-1 text-[12px] font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"><MessageSquarePlus size={13} /> Follow-up{r.followups?.length > 0 && <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-[var(--violet)] px-1 text-[9px] font-bold text-white">{r.followups.length}</span>}</button>
                      <Link href={`/invoices/${r.id}`} prefetch title="Open & edit invoice" className="inline-flex items-center gap-1 rounded-[7px] border border-[var(--line-2)] px-2 py-1 text-[12px] font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"><Pencil size={13} /> Edit</Link>
                      <button onClick={() => setDelInv(r)} title="Delete invoice" className="inline-flex items-center gap-1 rounded-[7px] border border-[var(--line-2)] px-2 py-1 text-[12px] font-semibold text-[var(--rose)] hover:bg-[color-mix(in_srgb,var(--rose)_10%,white)]"><Trash2 size={13} /> Delete</button>
                    </div>
                    {r.nextFollowup && <div className="mt-1 text-[10.5px] text-[var(--amber)] tnum">next follow-up {fmtD(r.nextFollowup)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {fuInv && <InvoiceFollowupModal inv={fuInv} close={() => setFuInv(null)} />}
      {delInv && <DeleteInvoiceModal inv={delInv} close={() => setDelInv(null)} />}
      {addOpen && <AddInvoiceModal clientNames={clientNames} close={() => setAddOpen(false)} lockCompany={embedded ? company : undefined} returnTo={embedded ? `/invoices?company=${company}&hub=1` : "/invoices"} />}
    </div>
  );
}

// Confirm + delete an invoice (payments cascade; any linked SLA reverts to "to invoice").
function DeleteInvoiceModal({ inv, close }: { inv: any; close: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="w-full max-w-[420px] overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 px-6 py-5">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-full" style={{ background: "color-mix(in srgb, var(--rose) 14%, white)", color: "var(--rose)" }}><Trash2 size={18} /></span>
          <div>
            <h2 className="text-[16px] font-bold">Delete invoice {inv.number}?</h2>
            <p className="mt-1 text-[12.5px] text-[var(--muted)]">{inv.billTo} · {inr(inv.total)}. This permanently removes the invoice and its recorded payments. This cannot be undone.</p>
          </div>
        </div>
        <form action={deleteSalesInvoice} className="flex justify-end gap-2 border-t border-[var(--line)] px-6 py-3">
          <input type="hidden" name="invoiceId" value={inv.id} />
          <input type="hidden" name="return" value="/invoices" />
          <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
          <button type="submit" className="btn btn-sm" style={{ background: "var(--rose)", color: "#fff" }}><Trash2 size={14} /> Delete invoice</button>
        </form>
      </div>
    </div>
  );
}

// View an invoice's follow-up notes and add a new one (with a next-follow-up date).
function InvoiceFollowupModal({ inv, close }: { inv: any; close: () => void }) {
  const notes: { date: string; by: string; note: string }[] = inv.followups ?? [];
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[480px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Follow-up · {inv.number}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{inv.billTo} · {notes.length} note{notes.length === 1 ? "" : "s"}{inv.nextFollowup ? ` · next ${fmtD(inv.nextFollowup)}` : ""}</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <div className="max-h-[38vh] overflow-y-auto scroll-thin px-6 py-4">
          {notes.length === 0 && <p className="text-[12.5px] text-[var(--muted)]">No follow-ups logged yet.</p>}
          <div className="space-y-2">
            {notes.map((n, i) => (
              <div key={i} className="rounded-[10px] border border-[var(--line)] px-3 py-2 text-[12.5px]">
                <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--faint)]"><span className="tnum">{fmtD(n.date)}</span><span className="font-semibold text-[var(--violet)]">· {n.by || "—"}</span></div>
                <div className="mt-0.5 text-[var(--ink-2)]">{n.note}</div>
              </div>
            ))}
          </div>
        </div>
        <form action={addInvoiceNote} className="space-y-3 border-t border-[var(--line)] px-6 py-4">
          <input type="hidden" name="invoiceId" value={inv.id} />
          <input type="hidden" name="leadId" value={inv.leadId ?? ""} />
          <label className="block"><span className="eyebrow">Add follow-up note</span><textarea name="note" required rows={2} className="input mt-1" placeholder="e.g. Called client, will pay by 25th" /></label>
          <label className="block"><span className="eyebrow">Next follow-up</span><input name="nextFollowup" type="date" defaultValue={inv.nextFollowup || todayISO()} className="input mt-1" /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={close} className="btn btn-ghost">Close</button><button type="submit" className="btn btn-violet"><MessageSquarePlus size={15} /> Save follow-up</button></div>
        </form>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon?: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{icon}{label}</div>
      <div className="mt-1.5 text-[20px] font-extrabold tnum" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}
