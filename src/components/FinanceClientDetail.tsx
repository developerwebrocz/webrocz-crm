"use client";

import { useState } from "react";
import Link from "next/link";
import { recordPayment, createClientInvoice } from "@/app/sales-actions";
import { updateClientFinance } from "@/app/actions";
import { ReceiptText, Wallet, CheckCircle2, Clock, Phone, Mail, IndianRupee, X, ArrowLeft, Building2, Plus, Pencil } from "lucide-react";

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmtDate = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };
const todayISO = () => new Date().toISOString().slice(0, 10);

type Client = { id: string; code: string; name: string; website: string | null; industry: string | null; pocName: string | null; pocMobile: string | null; pocEmail: string | null; monthlyRetainer: number; status: string; renewalDate: string; onboardDate: string; notes: string | null };
type Inv = { id: string; number: string; total: number; received: number; balance: number; approved: boolean; paymentStatus: string; issueDate: string; dueDate: string; leadId: string | null; category: string; overdue: boolean };
type Pay = { id: string; invoiceId: string; invoiceNumber: string; amount: number; date: string; mode: string; ref: string; note: string; by: string };
type Totals = { billed: number; received: number; pending: number; overdue: number; invoices: number };

export default function FinanceClientDetail({ client, invoices, payments, totals, openPayId }: { client: Client; invoices: Inv[]; payments: Pay[]; totals: Totals; openPayId?: string }) {
  const [payInv, setPayInv] = useState<Inv | null>(() => invoices.find((i) => i.id === openPayId && i.balance > 0) ?? null);
  const [newInv, setNewInv] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const backUrl = `/accounts/${client.id}`;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(100deg, color-mix(in srgb, var(--violet) 10%, white), color-mix(in srgb, var(--magenta) 6%, white))" }}>
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] text-white shadow-sm" style={{ background: "linear-gradient(135deg, var(--magenta), var(--violet))" }}><Building2 size={20} /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[18px] font-extrabold tracking-tight">{client.name}</span>
                <span className="rounded-full border border-[var(--line-2)] bg-white/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--violet)]">{client.code}</span>
                <span className="rounded-full border border-[var(--line-2)] bg-white/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--muted)]">{client.status}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-[12.5px] text-[var(--muted)]">
                {client.pocName && <span>{client.pocName}</span>}
                {client.pocMobile && <a href={`tel:${client.pocMobile}`} className="inline-flex items-center gap-1 text-[var(--violet)]"><Phone size={12} /> {client.pocMobile}</a>}
                {client.pocEmail && <a href={`mailto:${client.pocEmail}`} className="inline-flex items-center gap-1 text-[var(--violet)]"><Mail size={12} /> {client.pocEmail}</a>}
                {client.monthlyRetainer > 0 && <span>Retainer {inr(client.monthlyRetainer)}/mo</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditOpen(true)} className="btn btn-ghost btn-sm"><Pencil size={14} /> Edit info</button>
            <Link href="/accounts" prefetch className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> All clients</Link>
          </div>
        </div>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total billed" value={inr(totals.billed)} icon={<ReceiptText size={15} />} />
        <Kpi label="Received" value={inr(totals.received)} tone="var(--emerald)" icon={<CheckCircle2 size={15} />} />
        <Kpi label="Pending" value={inr(totals.pending)} tone="var(--amber)" icon={<Wallet size={15} />} />
        <Kpi label="Overdue" value={inr(totals.overdue)} tone="var(--rose)" icon={<Clock size={15} />} />
      </div>

      {/* invoices */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <h2 className="text-[14px] font-bold">Invoices ({invoices.length})</h2>
          <button onClick={() => setNewInv(true)} className="btn btn-violet btn-sm"><Plus size={14} /> New invoice</button>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[820px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Invoice", "Category", "Date", "Due", "Total", "Received", "Pending", "Status", ""].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {invoices.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No invoices for this client yet.</td></tr>}
              {invoices.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3 text-[12.5px] font-semibold">{r.number}{!r.approved && <span className="ml-1 text-[10.5px] font-bold text-[var(--amber)]">(unapproved)</span>}</td>
                  <td className="px-5 py-3"><CatChip c={r.category} /></td>
                  <td className="px-5 py-3 text-[12.5px] text-[var(--muted)] tnum">{fmtDate(r.issueDate)}</td>
                  <td className="px-5 py-3 text-[12.5px] tnum" style={{ color: r.overdue ? "var(--rose)" : "var(--muted)" }}>{fmtDate(r.dueDate)}{r.overdue ? " ⚠" : ""}</td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum">{inr(r.total)}</td>
                  <td className="px-5 py-3 text-[13px] tnum" style={{ color: "var(--emerald)" }}>{inr(r.received)}</td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum" style={{ color: r.balance > 0 ? (r.overdue ? "var(--rose)" : "var(--amber)") : "var(--emerald)" }}>{inr(r.balance)}</td>
                  <td className="px-5 py-3 text-[12px]">{r.balance <= 0 ? <span style={{ color: "var(--emerald)" }}>Paid</span> : r.received > 0 ? <span style={{ color: "var(--violet)" }}>Part paid</span> : <span style={{ color: "var(--amber)" }}>{r.paymentStatus || "Pending"}</span>}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      {r.balance > 0 && <button onClick={() => setPayInv(r)} className="btn btn-sm btn-emerald"><IndianRupee size={13} /> Pay</button>}
                      <Link href={`/invoices/${r.id}`} prefetch className="btn btn-ghost btn-sm">Open</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* payment history */}
      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-3"><h2 className="text-[14px] font-bold">Payment history ({payments.length})</h2></div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Date", "Invoice", "Amount", "Mode", "Ref", "Note", "By"].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No payments recorded yet.</td></tr>}
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3 text-[12.5px] tnum">{fmtDate(p.date)}</td>
                  <td className="px-5 py-3 text-[12.5px] font-semibold">{p.invoiceNumber}</td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum" style={{ color: "var(--emerald)" }}>{inr(p.amount)}</td>
                  <td className="px-5 py-3 text-[12px]"><span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)]">{p.mode}</span></td>
                  <td className="px-5 py-3 text-[12px] text-[var(--muted)]">{p.ref || "—"}</td>
                  <td className="px-5 py-3 text-[12px] text-[var(--muted)]">{p.note || "—"}</td>
                  <td className="px-5 py-3 text-[12px] text-[var(--muted)]">{p.by || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {payInv && <PaymentModal inv={payInv} clientName={client.name} back={backUrl} close={() => setPayInv(null)} />}
      {newInv && <NewInvoiceModal clientId={client.id} clientName={client.name} close={() => setNewInv(false)} />}
      {editOpen && <EditModal client={client} close={() => setEditOpen(false)} />}
    </div>
  );
}

function EditModal({ client, close }: { client: Client; close: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Edit client</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{client.code} · update contact, retainer &amp; renewal. Raise invoices from the Invoices section below.</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={updateClientFinance} className="space-y-3 overflow-y-auto scroll-thin px-6 py-5">
          <input type="hidden" name="id" value={client.id} />
          <label className="block"><span className="eyebrow">Client / company name *</span><input name="name" required defaultValue={client.name} className="input mt-1" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Contact person</span><input name="pocName" defaultValue={client.pocName ?? ""} className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Phone</span><input name="pocMobile" defaultValue={client.pocMobile ?? ""} className="input mt-1" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Email</span><input name="pocEmail" type="email" defaultValue={client.pocEmail ?? ""} className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Website</span><input name="website" defaultValue={client.website ?? ""} className="input mt-1" /></label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block"><span className="eyebrow">Monthly retainer (₹)</span><input name="monthlyRetainer" type="number" min={0} defaultValue={client.monthlyRetainer} className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Status</span><select name="status" defaultValue={client.status} className="select mt-1"><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="UPCOMING">Upcoming</option></select></label>
            <label className="block"><span className="eyebrow">Renewal date</span><input name="renewalDate" type="date" defaultValue={client.renewalDate || ""} className="input mt-1" /></label>
          </div>
          <label className="block"><span className="eyebrow">Industry</span><input name="industry" defaultValue={client.industry ?? ""} className="input mt-1" placeholder="optional" /></label>
          <label className="block"><span className="eyebrow">Notes</span><textarea name="notes" rows={2} defaultValue={client.notes ?? ""} className="input mt-1" placeholder="optional" /></label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-violet"><Pencil size={15} /> Save changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewInvoiceModal({ clientId, clientName, close }: { clientId: string; clientName: string; close: () => void }) {
  const today = todayISO();
  const due = (() => { const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 15); return d.toISOString().slice(0, 10); })();
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[480px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">New invoice</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{clientName} · one invoice per service keeps Website &amp; DM separate.</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={createClientInvoice} className="space-y-3 overflow-y-auto scroll-thin px-6 py-5">
          <input type="hidden" name="clientId" value={clientId} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Service</span><select name="category" defaultValue="WEBSITE" className="select mt-1"><option value="WEBSITE">Website Development</option><option value="DM">Digital Marketing</option></select></label>
            <label className="block"><span className="eyebrow">Amount (₹, before GST)</span><input name="amount" type="number" min={1} required className="input mt-1" placeholder="0" /></label>
          </div>
          <label className="block"><span className="eyebrow">Description (on invoice)</span><input name="desc" className="input mt-1" placeholder="optional — defaults to the service name" /></label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block"><span className="eyebrow">GST %</span><input name="taxPct" type="number" min={0} defaultValue={18} className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Issue date</span><input name="issueDate" type="date" defaultValue={today} className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Due date</span><input name="dueDate" type="date" defaultValue={due} className="input mt-1" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Received now (₹)</span><input name="received" type="number" min={0} defaultValue={0} className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Payment mode</span><select name="mode" defaultValue="UPI" className="select mt-1"><option value="UPI">UPI</option><option value="BANK">Bank transfer</option><option value="CHEQUE">Cheque</option><option value="CASH">Cash</option><option value="CARD">Card</option><option value="OTHER">Other</option></select></label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-violet"><Plus size={15} /> Create invoice</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaymentModal({ inv, clientName, back, close }: { inv: Inv; clientName: string; back: string; close: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="w-full max-w-[440px] overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Record payment</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{inv.number} · {clientName} · Balance <b style={{ color: "var(--amber)" }}>{inr(inv.balance)}</b></p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={recordPayment} className="space-y-3 px-6 py-5">
          <input type="hidden" name="invoiceId" value={inv.id} />
          <input type="hidden" name="return" value={back} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Amount (₹)</span><input name="amount" type="number" min={1} max={inv.balance} defaultValue={inv.balance} required className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Date</span><input name="date" type="date" defaultValue={todayISO()} className="input mt-1" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Mode</span><select name="mode" defaultValue="UPI" className="select mt-1"><option value="UPI">UPI</option><option value="BANK">Bank transfer</option><option value="CHEQUE">Cheque</option><option value="CASH">Cash</option><option value="CARD">Card</option><option value="OTHER">Other</option></select></label>
            <label className="block"><span className="eyebrow">Ref / UTR / Cheque no</span><input name="ref" className="input mt-1" placeholder="optional" /></label>
          </div>
          <label className="block"><span className="eyebrow">Note</span><input name="note" className="input mt-1" placeholder="optional" /></label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-emerald"><IndianRupee size={15} /> Record payment</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CatChip({ c }: { c: string }) {
  const map: Record<string, string> = { Website: "var(--indigo)", "Digital Marketing": "var(--magenta)", Both: "var(--violet)", Other: "var(--muted)" };
  const color = map[c] ?? "var(--muted)";
  return <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `color-mix(in srgb, ${color} 12%, white)`, color }}>{c}</span>;
}
function Kpi({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon?: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{icon}{label}</div>
      <div className="mt-1.5 text-[19px] font-extrabold tnum" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}
