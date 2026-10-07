"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { recordPayment, createClientInvoice, generateInvoiceFromSla } from "@/app/sales-actions";
import { updateClientFinance, logClientFollowup } from "@/app/actions";
import { companyLabel } from "@/lib/domain";
import AddInvoiceModal from "@/components/AddInvoiceModal";
import EditWebRoczClientModal from "@/components/EditWebRoczClientModal";
import EditWebRoczPvtClientModal from "@/components/EditWebRoczPvtClientModal";
import AddWebRoczInvoiceModal from "@/components/AddWebRoczInvoiceModal";
import WebRoczClientCard from "@/components/WebRoczClientCard";
import WebRoczPvtClientCard from "@/components/WebRoczPvtClientCard";
import AddWebRoczPvtInvoiceModal from "@/components/AddWebRoczPvtInvoiceModal";
import { ReceiptText, Wallet, CheckCircle2, Clock, Phone, Mail, IndianRupee, X, ArrowLeft, Building2, Plus, Pencil, MessageSquarePlus, CalendarClock, Globe, FileSignature, FileText, Download } from "lucide-react";

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmtDate = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split(" ")[0].split("-"); return d ? `${d}-${m}-${y}` : iso; };
const todayISO = () => new Date().toISOString().slice(0, 10);

type Client = { id: string; code: string; name: string; website: string | null; industry: string | null; pocName: string | null; pocMobile: string | null; pocEmail: string | null; monthlyRetainer: number; status: string; renewalDate: string; gstApplicable: boolean; gstRate: number; gstin: string; onboardDate: string; notes: string | null; websiteName: string; websiteDomain: string; websiteServices: string; domainTaken: boolean; domainAmount: number; hostingTaken: boolean; hostingAmount: number; designAmount: number; websiteTakenDate: string; websiteExpiryDate: string; websiteRenewAmount: number; nextFollowup: string; accountManagerId: string | null };
type Inv = { id: string; number: string; total: number; received: number; balance: number; approved: boolean; paymentStatus: string; issueDate: string; dueDate: string; leadId: string | null; category: string; overdue: boolean; company: string; followups: { date: string; by: string; note: string }[]; invoiceDoc?: string; projectDate?: string; paymentTerm?: string };
type Pay = { id: string; invoiceId: string; invoiceNumber: string; amount: number; date: string; mode: string; ref: string; note: string; by: string };
type Followup = { date: string; by: string; note: string; next?: string };
type Sla = { id: string; title: string; service: string; amount: number; gst: boolean; fileUrl: string; notes: string; status: string; uploadedBy: string; createdAt: string };
type Totals = { billed: number; received: number; pending: number; overdue: number; invoices: number };

export default function FinanceClientDetail({ client, invoices, payments, totals, clientFollowups, slas, openPayId, company, dmServices = [] }: { client: Client; invoices: Inv[]; payments: Pay[]; totals: Totals; clientFollowups: Followup[]; slas: Sla[]; openPayId?: string; company?: string; dmServices?: { service: string; detail: string | null }[] }) {
  const [payInv, setPayInv] = useState<Inv | null>(() => invoices.find((i) => i.id === openPayId && i.balance > 0) ?? null);
  const [newInv, setNewInv] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const router = useRouter();
  const backUrl = `/accounts/${client.id}`;
  // A Web Solutions client → its "New invoice" uses the website form (services + amounts +
  // payment screenshot). Detected from the URL company context OR any Web Solutions invoice.
  const isWebSolClient = company === "WEB_SOLUTIONS" || invoices.some((i) => i.company === "WEB_SOLUTIONS");
  // A Web Rocz (digital marketing) client → "Edit info" opens the Web Rocz form (DM services,
  // no domain / hosting / renewal). Web Solutions clients keep the website edit form.
  const isWebRoczClient = company === "WEB_ROCZ" || (!isWebSolClient && invoices.some((i) => i.company === "WEB_ROCZ"));
  // A Web Rocz Pvt Ltd (GST) client → its own edit form (DM services + GSTIN). Opened from the
  // Pvt Ltd hub this always applies; otherwise only for a client that is neither of the above.
  const isWebRoczPvtClient = company === "WEB_ROCZ_PVT" || (!isWebSolClient && !isWebRoczClient && invoices.some((i) => i.company === "WEB_ROCZ_PVT"));
  // Website services this client has taken (for the details card).
  // Latest SLA with an uploaded file (slas arrive newest-first) → Download button in the card.
  const slaDoc = slas.find((x) => x.fileUrl) ?? null;
  const webServices = (() => { try { const a = JSON.parse(client.websiteServices || "[]"); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } })();

  // Date filters over this client's invoices: a month picker + a From–To calendar range.
  const [month, setMonth] = useState("ALL"); // ALL | YYYY-MM
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Full contiguous month list: from the earliest invoice (or 12 months back, whichever is
  // earlier) up to the current month — so the picker isn't limited to months that have invoices.
  const monthOptions = useMemo(() => {
    const invMonths = invoices.map((i) => (i.issueDate || "").slice(0, 7)).filter(Boolean);
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const back12 = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const back12ym = `${back12.getFullYear()}-${String(back12.getMonth() + 1).padStart(2, "0")}`;
    const earliest = [back12ym, ...invMonths].sort()[0];
    const out: string[] = [];
    let [y, m] = earliest.split("-").map(Number);
    const [cy, cm] = cur.split("-").map(Number);
    // include any invoice months that are in the future too
    const maxYm = [cur, ...invMonths].sort().pop()!;
    const [my, mm] = maxYm.split("-").map(Number);
    const endY = Math.max(cy, my), endM = my > cy || (my === cy && mm > cm) ? mm : cm;
    while (y < endY || (y === endY && m <= endM)) {
      out.push(`${y}-${String(m).padStart(2, "0")}`);
      m++; if (m > 12) { m = 1; y++; }
    }
    return out.sort((a, b) => (a < b ? -1 : 1)); // chronological order (oldest → newest)
  }, [invoices]);
  const fInvoices = useMemo(() => invoices.filter((i) => {
    // Company scope: inside a company hub, show only that billing entity's invoices for this
    // client (so the same client's Web Solutions / Web Rocz / Pvt Ltd invoices stay separate).
    if (company && i.company !== company) return false;
    const d = i.issueDate || "";
    if (month !== "ALL" && !d.startsWith(month)) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }), [invoices, month, from, to, company]);
  const filterActive = month !== "ALL" || !!from || !!to || !!company;
  const fTotals = useMemo(() => ({
    billed: fInvoices.reduce((s, i) => s + i.total, 0),
    received: fInvoices.reduce((s, i) => s + i.received, 0),
    pending: fInvoices.reduce((s, i) => s + i.balance, 0),
    overdue: fInvoices.filter((i) => i.overdue).reduce((s, i) => s + i.balance, 0),
    invoices: fInvoices.length,
  }), [fInvoices]);
  const view = filterActive ? fTotals : totals;
  // Payment history scoped to the company's invoices when viewing inside a company hub.
  const fPayments = useMemo(() => {
    if (!company) return payments;
    const ids = new Set(fInvoices.map((i) => i.id));
    return payments.filter((p) => ids.has(p.invoiceId));
  }, [payments, fInvoices, company]);
  // Which months still have an unpaid balance (shown as short chips: Sep '26, Oct '26).
  const pendingMonths = useMemo(() => {
    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const map = new Map<string, number>();
    for (const i of fInvoices) if (i.balance > 0 && i.issueDate) { const k = i.issueDate.slice(0, 7); map.set(k, (map.get(k) ?? 0) + i.balance); }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([ym, amount]) => { const [y, m] = ym.split("-"); return { label: `${MON[parseInt(m, 10) - 1] ?? m} '${y.slice(2)}`, amount }; });
  }, [fInvoices]);
  const pendingTotal = pendingMonths.reduce((s, m) => s + m.amount, 0);
  const monthLabel = (m: string) => { const [y, mo] = m.split("-"); return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(mo, 10) - 1] ?? mo} ${y}`; };

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
            {/* Web Rocz Pvt Ltd: straight back to the page this client was opened from (the
                Pvt Ltd clients list or its invoices page); the hub if opened directly. */}
            {isWebRoczPvtClient && <button onClick={() => (window.history.length > 1 ? router.back() : router.push("/pipeline/web-rocz-pvt"))} className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> Back</button>}
            <button onClick={() => setEditOpen(true)} className="btn btn-ghost btn-sm"><Pencil size={14} /> Edit info</button>
            <Link href="/accounts" prefetch className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> All clients</Link>
          </div>
        </div>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={`Total billed${filterActive ? " · filtered" : ""}`} value={inr(view.billed)} icon={<ReceiptText size={15} />} />
        <Kpi label="Received" value={inr(view.received)} tone="var(--emerald)" icon={<CheckCircle2 size={15} />} />
        <Kpi label="Pending" value={inr(view.pending)} tone="var(--amber)" icon={<Wallet size={15} />} />
        <Kpi label="Overdue" value={inr(view.overdue)} tone="var(--rose)" icon={<Clock size={15} />} />
      </div>

      {isWebSolClient && (
        <div className="grid gap-3 lg:grid-cols-2">
          {/* Left — client & domain details */}
          <div className="card card-pad">
            <h3 className="eyebrow mb-2.5 flex items-center gap-1.5"><Globe size={13} className="text-[var(--violet)]" /> Client &amp; domain</h3>
            <div className="text-[12.5px]">
              <DRow label="Domain name" value={client.websiteDomain || "—"} />
              <DRow label="Contact person" value={client.pocName || "—"} />
              <DRow label="Phone" value={client.pocMobile || "—"} />
              <DRow label="Email" value={client.pocEmail || "—"} />
              <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] py-1.5">
                <span className="text-[12px] text-[var(--muted)]">Services</span>
                <span className="flex flex-wrap justify-end gap-1">
                  {webServices.length ? webServices.map((s) => <span key={s} className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-2)]">{s}</span>) : <span className="font-semibold">—</span>}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-[12px] text-[var(--muted)]">SLA</span>
                {slaDoc
                  ? <a href={slaDoc.fileUrl} download className="btn btn-violet btn-sm"><Download size={13} /> Download SLA</a>
                  : <span className="font-semibold">—</span>}
              </div>
            </div>
          </div>
          {/* Right — registration & renewal */}
          <div className="card card-pad">
            <h3 className="eyebrow mb-2.5 flex items-center gap-1.5"><CalendarClock size={13} className="text-[var(--violet)]" /> Registration &amp; renewal</h3>
            <div className="text-[12.5px]">
              <DRow label="Register date" value={fmtDate(client.websiteTakenDate)} />
              <DRow label="Expiry date" value={fmtDate(client.websiteExpiryDate)} />
              <DRow label="Domain amount" value={inr(client.domainAmount)} />
              <DRow label="Hosting amount" value={inr(client.hostingAmount)} />
              {client.designAmount > 0 && <DRow label="Website designing" value={inr(client.designAmount)} />}
              <div className="mt-1.5 flex items-center justify-between gap-3 rounded-[8px] px-2.5 py-2" style={{ background: "color-mix(in srgb, var(--violet) 6%, white)" }}>
                <span className="text-[12px] font-semibold text-[var(--muted)]">Renewal amount</span>
                <span className="text-[15px] font-extrabold tnum text-[var(--violet)]">{inr(client.websiteRenewAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {isWebRoczClient && company !== "WEB_ROCZ_PVT" && <WebRoczClientCard client={client} services={dmServices} slaUrl={slaDoc?.fileUrl ?? ""} invoices={invoices} />}
      {isWebRoczPvtClient && <WebRoczPvtClientCard client={client} services={dmServices} slaUrl={slaDoc?.fileUrl ?? ""} invoices={invoices} />}

      {pendingMonths.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[var(--line)] px-3 py-2.5" style={{ background: "color-mix(in srgb, var(--amber) 6%, white)" }}>
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Payment pending for</span>
          {pendingMonths.map((m) => (
            <span key={m.label} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-2)] bg-white px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--amber)]">
              {m.label}<span className="tnum text-[var(--ink-2)]">{inr(m.amount)}</span>
            </span>
          ))}
          <span className="text-[11px] font-semibold text-[var(--muted)]">· {pendingMonths.length} month{pendingMonths.length === 1 ? "" : "s"} · total {inr(pendingTotal)}</span>
        </div>
      )}

      {/* date filters — month picker + From–To calendar range */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Filter invoices</span>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="select !w-auto"><option value="ALL">All months</option>{monthOptions.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
        <div className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface)] px-2.5 py-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input !w-auto !border-0 !py-1 !px-1 !shadow-none" aria-label="From date" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input !w-auto !border-0 !py-1 !px-1 !shadow-none" aria-label="To date" />
        </div>
        {filterActive && <button onClick={() => { setMonth("ALL"); setFrom(""); setTo(""); }} className="btn btn-ghost btn-sm">Clear</button>}
      </div>

      {/* invoices */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <h2 className="text-[14px] font-bold">Invoices ({fInvoices.length}{filterActive ? ` of ${invoices.length}` : ""})</h2>
          <button onClick={() => setNewInv(true)} className="btn btn-violet btn-sm"><Plus size={14} /> New invoice</button>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[820px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Invoice", "Company", "Category", "Date", "Due", "Total", "Received", "Pending", "Status", ""].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {fInvoices.length === 0 && <tr><td colSpan={10} className="px-5 py-10 text-center text-sm text-[var(--muted)]">{filterActive ? "No invoices in this period." : "No invoices for this client yet."}</td></tr>}
              {fInvoices.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3 text-[12.5px] font-semibold">{r.number}</td>
                  <td className="px-5 py-3 text-[11.5px] font-semibold text-[var(--ink-2)]">{r.company ? companyLabel(r.company) : "—"}</td>
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
                      {r.invoiceDoc && <a href={r.invoiceDoc} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="View uploaded invoice document"><FileText size={13} /> Doc</a>}
                      <Link href={`/invoices/${r.id}`} prefetch className="btn btn-ghost btn-sm">Open</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SLAs uploaded by sales — accountant generates the invoice from them */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <h2 className="flex items-center gap-1.5 text-[14px] font-bold"><FileSignature size={15} className="text-[var(--violet)]" /> SLAs ({slas.length})</h2>
          <Link href="/sla" prefetch className="btn btn-ghost btn-sm">All SLAs</Link>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[760px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["SLA", "Service", "Amount", "GST", "Status", "File", "Actions"].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {slas.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-[var(--muted)]">No SLAs uploaded for this client yet.</td></tr>}
              {slas.map((sla) => (
                <tr key={sla.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3 text-[12.5px]">{sla.title || "—"}<div className="text-[11px] text-[var(--faint)]">{sla.uploadedBy ? `by ${sla.uploadedBy} · ` : ""}{fmtDate(sla.createdAt)}</div></td>
                  <td className="px-5 py-3"><CatChip c={sla.service === "DM" ? "Digital Marketing" : "Website"} /></td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum">{inr(sla.amount)}</td>
                  <td className="px-5 py-3 text-[12px] font-semibold" style={{ color: sla.gst ? "var(--violet)" : "var(--faint)" }}>{sla.gst ? "With GST" : "No GST"}</td>
                  <td className="px-5 py-3 text-[12px]">{sla.status === "INVOICED" ? <span style={{ color: "var(--emerald)" }}>Invoiced</span> : <span style={{ color: "var(--amber)" }}>To invoice</span>}</td>
                  <td className="px-5 py-3">{sla.fileUrl ? <a href={sla.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--indigo)] hover:underline"><FileText size={13} /> View</a> : <span className="text-[var(--faint)]">—</span>}</td>
                  <td className="px-5 py-3">
                    {sla.status === "UPLOADED"
                      ? <form action={generateInvoiceFromSla}><input type="hidden" name="slaId" value={sla.id} /><input type="hidden" name="return" value={backUrl} /><button type="submit" className="btn btn-sm btn-violet"><ReceiptText size={13} /> Generate invoice</button></form>
                      : <span className="text-[12px] text-[var(--faint)]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* payment history */}
      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-3"><h2 className="text-[14px] font-bold">Payment history ({fPayments.length})</h2></div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["Date", "Invoice", "Amount", "Mode", "Ref", "Note", "By"].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {fPayments.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No payments recorded yet.</td></tr>}
              {fPayments.map((p) => (
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

      {/* Accountant follow-ups on this client (name stamped on each) */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <h2 className="flex items-center gap-1.5 text-[14px] font-bold"><MessageSquarePlus size={15} className="text-[var(--violet)]" /> Follow-ups ({clientFollowups.length})</h2>
          {client.nextFollowup && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--amber)]"><CalendarClock size={13} /> Next: {fmtDate(client.nextFollowup)}</span>}
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <form action={logClientFollowup} className="space-y-3">
            <input type="hidden" name="id" value={client.id} />
            <input type="hidden" name="return" value={backUrl} />
            <label className="block"><span className="eyebrow">Log a response / note</span><textarea name="note" rows={3} className="input mt-1" placeholder="e.g. Spoke to POC — payment promised by Friday" /></label>
            <label className="block"><span className="eyebrow">Next follow-up date</span><input name="next" type="date" defaultValue={client.nextFollowup || todayISO()} className="input mt-1" /></label>
            <button type="submit" className="btn btn-violet"><MessageSquarePlus size={15} /> Save follow-up</button>
          </form>
          <div className="max-h-[280px] overflow-y-auto scroll-thin">
            {clientFollowups.length === 0 && invoices.every((i) => i.followups.length === 0) && <p className="text-[12.5px] text-[var(--muted)]">No follow-ups logged yet.</p>}
            <div className="space-y-2">
              {clientFollowups.map((n, i) => (
                <div key={i} className="rounded-[10px] border border-[var(--line)] px-3 py-2 text-[12.5px]">
                  <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--faint)]"><span className="tnum">{fmtDate(n.date)}</span><span className="font-semibold text-[var(--violet)]">· {n.by || "—"}</span>{n.next && <span className="ml-auto inline-flex items-center gap-1"><CalendarClock size={11} /> {fmtDate(n.next)}</span>}</div>
                  <div className="mt-0.5 text-[var(--ink-2)]">{n.note}</div>
                </div>
              ))}
              {invoices.flatMap((inv) => inv.followups.map((n, i) => (
                <div key={`${inv.id}-${i}`} className="rounded-[10px] border border-dashed border-[var(--line)] px-3 py-2 text-[12.5px]">
                  <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--faint)]"><span className="tnum">{fmtDate(n.date)}</span><span>· {n.by || "—"}</span><span className="ml-auto font-semibold">{inv.number}</span></div>
                  <div className="mt-0.5 text-[var(--ink-2)]">{n.note}</div>
                </div>
              )))}
            </div>
          </div>
        </div>
      </div>

      {payInv && <PaymentModal inv={payInv} clientName={client.name} back={backUrl} close={() => setPayInv(null)} />}
      {newInv && (company === "WEB_ROCZ_PVT"
        ? <AddWebRoczPvtInvoiceModal clientNames={[]} lockClientName={client.name} returnTo={`${backUrl}?company=WEB_ROCZ_PVT`} close={() => setNewInv(false)} />
        : isWebSolClient
        ? <AddInvoiceModal clientNames={[]} lockClientName={client.name} lockCompany="WEB_SOLUTIONS" defaultDomain={client.websiteDomain} returnTo={backUrl} close={() => setNewInv(false)} />
        : isWebRoczClient
        ? <AddWebRoczInvoiceModal clientNames={[]} lockClientName={client.name} defaultDomain={client.websiteDomain || client.website || ""} returnTo={`${backUrl}?company=WEB_ROCZ`} close={() => setNewInv(false)} />
        : isWebRoczPvtClient
        ? <AddWebRoczPvtInvoiceModal clientNames={[]} lockClientName={client.name} returnTo={`${backUrl}?company=WEB_ROCZ_PVT`} close={() => setNewInv(false)} />
        : <NewInvoiceModal clientId={client.id} clientName={client.name} defaultTaxPct={client.gstApplicable ? client.gstRate : 0} defaultGstin={client.gstin} close={() => setNewInv(false)} />)}
      {editOpen && (company === "WEB_ROCZ_PVT"
        ? <EditWebRoczPvtClientModal client={client} services={dmServices} close={() => setEditOpen(false)} />
        : isWebRoczClient
        ? <EditWebRoczClientModal client={client} services={dmServices} close={() => setEditOpen(false)} />
        : isWebRoczPvtClient
        ? <EditWebRoczPvtClientModal client={client} services={dmServices} close={() => setEditOpen(false)} />
        : <EditModal client={client} close={() => setEditOpen(false)} />)}
    </div>
  );
}

const FIXED_SERVICES = ["Domain", "Hosting + SSL", "Website Designing"];
function EditModal({ client, close }: { client: Client; close: () => void }) {
  const initServices = (() => { try { const a = JSON.parse(client.websiteServices || "[]"); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } })();
  const [domainOn, setDomainOn] = useState(client.domainTaken || initServices.includes("Domain"));
  const [hostingOn, setHostingOn] = useState(client.hostingTaken || initServices.includes("Hosting + SSL"));
  const [designOn, setDesignOn] = useState(initServices.includes("Website Designing"));
  const [customs, setCustoms] = useState<string[]>(initServices.filter((s) => !FIXED_SERVICES.includes(s)));
  const [domainAmt, setDomainAmt] = useState(client.domainAmount || 0);
  const [hostingAmt, setHostingAmt] = useState(client.hostingAmount || 0);
  const [designAmt, setDesignAmt] = useState(client.designAmount || 0);
  const [registerDate, setRegisterDate] = useState(client.websiteTakenDate || "");
  // Renewal = the amounts of the ticked services; expiry = register date + 1 year. Both auto.
  const renewal = (domainOn ? domainAmt || 0 : 0) + (hostingOn ? hostingAmt || 0 : 0);
  const expiry = (() => { if (!registerDate) return ""; const d = new Date(registerDate + "T00:00:00Z"); if (isNaN(d.getTime())) return ""; d.setUTCFullYear(d.getUTCFullYear() + 1); return d.toISOString().slice(0, 10); })();
  const fmtD = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Edit client</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{client.code} · update details, domain / hosting &amp; renewal.</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={updateClientFinance} className="space-y-3 overflow-y-auto scroll-thin px-6 py-5">
          <input type="hidden" name="id" value={client.id} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Company name *</span><input name="name" required defaultValue={client.name} className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Domain name</span><input name="websiteDomain" defaultValue={client.websiteDomain} className="input mt-1" placeholder="e.g. acme.com" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Contact person</span><input name="pocName" defaultValue={client.pocName ?? ""} className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Phone number</span><input name="pocMobile" defaultValue={client.pocMobile ?? ""} className="input mt-1" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Email</span><input name="pocEmail" type="email" defaultValue={client.pocEmail ?? ""} className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Status</span><select name="status" defaultValue={client.status} className="select mt-1"><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="UPCOMING">Upcoming</option></select></label>
          </div>
          <div className="rounded-[10px] border border-[var(--line)] p-3">
            <div className="eyebrow mb-2 flex items-center gap-1.5"><Globe size={13} /> Services</div>
            <div className="space-y-2 text-[13px] font-semibold">
              <div className="flex items-center gap-2">
                <label className="flex flex-1 items-center gap-2"><input type="checkbox" name="svc" value="Domain" checked={domainOn} onChange={(e) => setDomainOn(e.target.checked)} className="h-4 w-4 accent-[var(--violet)]" /> Domain</label>
                {domainOn && <input name="domainAmount" type="number" min={0} value={domainAmt} onChange={(e) => setDomainAmt(parseInt(e.target.value, 10) || 0)} className="input !w-32 !py-1.5 font-normal" placeholder="₹ amount" />}
              </div>
              <div className="flex items-center gap-2">
                <label className="flex flex-1 items-center gap-2"><input type="checkbox" name="svc" value="Hosting + SSL" checked={hostingOn} onChange={(e) => setHostingOn(e.target.checked)} className="h-4 w-4 accent-[var(--violet)]" /> Hosting + SSL</label>
                {hostingOn && <input name="hostingAmount" type="number" min={0} value={hostingAmt} onChange={(e) => setHostingAmt(parseInt(e.target.value, 10) || 0)} className="input !w-32 !py-1.5 font-normal" placeholder="₹ amount" />}
              </div>
              <div className="flex items-center gap-2">
                <label className="flex flex-1 items-center gap-2"><input type="checkbox" name="svc" value="Website Designing" checked={designOn} onChange={(e) => setDesignOn(e.target.checked)} className="h-4 w-4 accent-[var(--violet)]" /> Website Designing</label>
                {designOn && <input name="designAmount" type="number" min={0} value={designAmt} onChange={(e) => setDesignAmt(parseInt(e.target.value, 10) || 0)} className="input !w-32 !py-1.5 font-normal" placeholder="₹ amount" />}
              </div>
              {customs.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input name="svc" value={c} onChange={(e) => setCustoms((cs) => cs.map((v, j) => (j === i ? e.target.value : v)))} className="input flex-1 font-normal" placeholder="Custom service" />
                  <button type="button" onClick={() => setCustoms((cs) => cs.filter((_, j) => j !== i))} title="Remove" className="grid h-8 w-8 flex-none place-items-center rounded-[8px] border border-[var(--line-2)] text-[var(--rose)] hover:bg-[color-mix(in_srgb,var(--rose)_10%,white)]"><X size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setCustoms((cs) => [...cs, ""])} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--violet)] hover:underline"><Plus size={13} /> Add</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block"><span className="text-[12px] font-semibold">Register date</span><input name="websiteTakenDate" type="date" value={registerDate} onChange={(e) => setRegisterDate(e.target.value)} className="input mt-1" /></label>
              <div><span className="text-[12px] font-semibold">Expiry date <span className="font-normal text-[var(--faint)]">(auto · +1 yr)</span></span>
                <div className="input mt-1 flex items-center bg-[var(--surface-2)] text-[var(--muted)]">{fmtD(expiry)}</div>
                <input type="hidden" name="websiteExpiryDate" value={expiry} />
              </div>
            </div>
            <label className="mt-3 block"><span className="text-[12px] font-semibold">Renewal amount (₹) <span className="font-normal text-[var(--faint)]">(auto · domain + hosting)</span></span>
              <input name="websiteRenewAmount" type="number" value={renewal} readOnly className="input mt-1 bg-[var(--surface-2)] font-semibold" /></label>
          </div>
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

function NewInvoiceModal({ clientId, clientName, defaultTaxPct, defaultGstin, close }: { clientId: string; clientName: string; defaultTaxPct: number; defaultGstin: string; close: () => void }) {
  const today = todayISO();
  const due = (() => { const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 15); return d.toISOString().slice(0, 10); })();
  const GST_OPTS = [0, 18];
  const [taxPct, setTaxPct] = useState(String(defaultTaxPct));
  const noGst = taxPct === "0"; // Without GST → no GSTIN to capture
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
          {noGst ? (
            <label className="block"><span className="eyebrow">GST</span><select name="taxPct" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} className="select mt-1"><option value="0">Without GST</option>{GST_OPTS.filter((g) => g > 0).map((g) => <option key={g} value={String(g)}>With GST {g}%</option>)}</select></label>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="eyebrow">GST</span><select name="taxPct" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} className="select mt-1"><option value="0">Without GST</option>{GST_OPTS.filter((g) => g > 0).map((g) => <option key={g} value={String(g)}>With GST {g}%</option>)}</select></label>
              <label className="block"><span className="eyebrow">Client GSTIN</span><input name="gstin" defaultValue={defaultGstin} className="input mt-1" placeholder="e.g. 36AABC…" /></label>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
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

function DRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-1.5 last:border-0">
      <span className="text-[12px] text-[var(--muted)]">{label}</span>
      <span className="text-right font-semibold text-[var(--ink)]">{value}</span>
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
