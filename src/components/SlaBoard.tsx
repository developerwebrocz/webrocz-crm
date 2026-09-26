"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { uploadSla, generateInvoiceFromSla, deleteSla } from "@/app/sales-actions";
import { downloadCsv } from "@/lib/csv";
import { FileSignature, Upload, Search, Download, ReceiptText, FileText, Trash2, CheckCircle2, Clock, IndianRupee, X } from "lucide-react";

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmtDate = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split(" ")[0].split("-"); return d ? `${d}-${m}-${y}` : iso; };

type Row = {
  id: string; clientId: string; clientName: string; clientCode: string; matched: boolean;
  title: string; service: string; amount: number; gst: boolean; fileUrl: string; notes: string;
  pocMobile: string; pocEmail: string; gstin: string;
  status: string; invoiceNumber: string; uploadedBy: string; createdAt: string;
};
type Counts = { all: number; pending: number; invoiced: number };
type Totals = { pendingAmount: number };

export default function SlaBoard({ rows, counts, totals, canUpload, canGenerate }: { rows: Row[]; counts: Counts; totals: Totals; canUpload: boolean; canGenerate: boolean }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("UPLOADED"); // default: only pending (moved/invoiced ones drop off the list)
  const [addOpen, setAddOpen] = useState(false);
  const nq = q.trim().toLowerCase();

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== "ALL" && r.status !== status) return false;
    if (nq && !`${r.clientName} ${r.clientCode} ${r.title} ${r.uploadedBy}`.toLowerCase().includes(nq)) return false;
    return true;
  }), [rows, nq, status]);

  const exportCsv = () => downloadCsv(
    `slas-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Client", "Title", "Service", "Amount", "GST", "Status", "Invoice", "Uploaded by", "Date"],
    filtered.map((r) => [r.clientName, r.title, r.service === "DM" ? "Digital Marketing" : "Website", r.amount, r.gst ? "With GST" : "Without GST", r.status, r.invoiceNumber, r.uploadedBy, r.createdAt]),
  );

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(100deg, color-mix(in srgb, var(--violet) 10%, white), color-mix(in srgb, var(--indigo) 6%, white))" }}>
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] text-white shadow-sm" style={{ background: "linear-gradient(135deg, var(--indigo), var(--violet))" }}><FileSignature size={20} /></span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-extrabold tracking-tight">SLAs</span>
                <span className="rounded-full border border-[var(--line-2)] bg-white/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--violet)]">{canUpload && !canGenerate ? "Sales" : "Finance"}</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{counts.all} SLA{counts.all === 1 ? "" : "s"} · <b style={{ color: "var(--amber)" }}>{counts.pending}</b> to invoice · {counts.invoiced} invoiced</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canUpload && <button onClick={() => setAddOpen(true)} className="btn btn-violet"><Upload size={15} /> Upload SLA</button>}
            <button onClick={exportCsv} className="btn btn-ghost"><Download size={15} /> Export CSV</button>
            <Link href="/" prefetch className="btn btn-ghost">← Dashboard</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total SLAs" value={String(counts.all)} icon={<FileSignature size={15} />} />
        <Kpi label="To invoice" value={String(counts.pending)} tone="var(--amber)" icon={<Clock size={15} />} />
        <Kpi label="Invoiced" value={String(counts.invoiced)} tone="var(--emerald)" icon={<CheckCircle2 size={15} />} />
        <Kpi label="Pending value" value={inr(totals.pendingAmount)} tone="var(--indigo)" icon={<IndianRupee size={15} />} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1 sm:max-w-[300px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, title, uploader…" className="input !py-2 !pl-9" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="select !w-auto"><option value="ALL">All status</option><option value="UPLOADED">To invoice</option><option value="INVOICED">Invoiced</option></select>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[980px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["#", "Client", "SLA", "Service", "Amount", "GST", "Status", "File", "Actions"].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No SLAs{canUpload ? " yet — upload one to get started." : " uploaded yet."}</td></tr>}
              {filtered.map((r, i) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3 text-[12.5px] text-[var(--faint)] tnum">{i + 1}</td>
                  <td className="px-5 py-3">{r.matched ? <Link href={`/accounts/${r.clientId}`} prefetch className="text-[13px] font-semibold text-[var(--violet)] hover:underline">{r.clientName}</Link> : <span className="text-[13px] font-semibold">{r.clientName}<span className="ml-1.5 rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[var(--muted)]">new</span></span>}<div className="text-[11px] text-[var(--faint)]">{r.clientCode ? `${r.clientCode} · ` : ""}{r.uploadedBy ? `by ${r.uploadedBy} · ` : ""}{fmtDate(r.createdAt)}</div></td>
                  <td className="px-5 py-3 text-[12.5px]">{r.title || "—"}</td>
                  <td className="px-5 py-3 text-[12px]"><span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `color-mix(in srgb, ${r.service === "DM" ? "var(--magenta)" : "var(--indigo)"} 12%, white)`, color: r.service === "DM" ? "var(--magenta)" : "var(--indigo)" }}>{r.service === "DM" ? "Digital Marketing" : "Website"}</span></td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum">{inr(r.amount)}</td>
                  <td className="px-5 py-3 text-[12px] font-semibold" style={{ color: r.gst ? "var(--violet)" : "var(--faint)" }}>{r.gst ? "With GST" : "No GST"}</td>
                  <td className="px-5 py-3">{r.status === "INVOICED" ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--emerald)" }}><CheckCircle2 size={13} /> Invoiced{r.invoiceNumber ? ` · ${r.invoiceNumber}` : ""}</span> : <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--amber)" }}><Clock size={13} /> To invoice</span>}</td>
                  <td className="px-5 py-3">{r.fileUrl ? <a href={r.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--indigo)] hover:underline"><FileText size={13} /> View</a> : <span className="text-[var(--faint)]">—</span>}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      {canGenerate && r.status === "UPLOADED" && (
                        <form action={generateInvoiceFromSla} className="flex items-center gap-1">
                          <input type="hidden" name="slaId" value={r.id} />
                          <input type="hidden" name="return" value="/sla" />
                          <select name="company" required defaultValue="" className="select !w-auto !py-1 !text-[12px]">
                            <option value="" disabled>Move to…</option>
                            <option value="WEB_SOLUTIONS">Web Solutions</option>
                            <option value="WEB_ROCZ">Web Rocz</option>
                            <option value="WEB_ROCZ_PVT">Web Rocz Pvt Ltd</option>
                          </select>
                          <button type="submit" className="btn btn-sm btn-violet"><ReceiptText size={13} /> Move</button>
                        </form>
                      )}
                      <form action={deleteSla}><input type="hidden" name="slaId" value={r.id} /><input type="hidden" name="return" value="/sla" /><button type="submit" title="Delete SLA" className="inline-flex items-center gap-1 rounded-[7px] border border-[var(--line-2)] px-2 py-1 text-[12px] font-semibold text-[var(--rose)] hover:bg-[color-mix(in_srgb,var(--rose)_10%,white)]"><Trash2 size={13} /></button></form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && <UploadModal close={() => setAddOpen(false)} />}
    </div>
  );
}

function UploadModal({ close }: { close: () => void }) {
  const [service, setService] = useState("WEBSITE");
  const [gst, setGst] = useState("1");
  const withGst = gst === "1";
  // Web Solutions = Website + non-GST, Web Rocz = DM + non-GST, Web Rocz Pvt Ltd = With GST.
  const target = withGst ? "Web Rocz Pvt Ltd" : service === "DM" ? "Web Rocz" : "Web Solutions";
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Upload SLA</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Attach the agreement and fill the client details — the accountant generates the invoice and files it under the right company from this.</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={uploadSla} encType="multipart/form-data" className="space-y-3 overflow-y-auto scroll-thin px-6 py-5">
          <label className="block"><span className="eyebrow">Client name *</span><input name="clientName" required className="input mt-1" placeholder="Type the client / company name" /><span className="mt-1 block text-[11px] text-[var(--faint)]">If it matches an existing client, the SLA links to them automatically — otherwise the accountant creates them from these details.</span></label>
          <label className="block"><span className="eyebrow">SLA title / description</span><input name="title" className="input mt-1" placeholder="e.g. Website + SEO annual agreement" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Contact person</span><input name="pocName" className="input mt-1" placeholder="e.g. Riya Sharma" /></label>
            <label className="block"><span className="eyebrow">Phone</span><input name="pocMobile" className="input mt-1" placeholder="10-digit mobile" /></label>
          </div>
          <label className="block"><span className="eyebrow">Email</span><input name="pocEmail" type="email" className="input mt-1" placeholder="client@example.com" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Service</span><select name="service" value={service} onChange={(e) => setService(e.target.value)} className="select mt-1"><option value="WEBSITE">Website</option><option value="DM">Digital Marketing</option></select></label>
            <label className="block"><span className="eyebrow">GST</span><select name="gst" value={gst} onChange={(e) => setGst(e.target.value)} className="select mt-1"><option value="1">With GST 18%</option><option value="0">Without GST</option></select></label>
          </div>
          {withGst && <label className="block"><span className="eyebrow">Client GSTIN</span><input name="gstin" className="input mt-1" placeholder="e.g. 36AABC…" /><span className="mt-1 block text-[11px] text-[var(--faint)]">Sets the place of supply (CGST/SGST vs IGST) on the tax invoice.</span></label>}
          <label className="block"><span className="eyebrow">Amount (₹, before GST)</span><input name="amount" type="number" min={0} required className="input mt-1" placeholder="0" /></label>
          <label className="block"><span className="eyebrow">SLA document</span><input name="file" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="input mt-1 !py-2" /></label>
          <label className="block"><span className="eyebrow">Notes</span><input name="notes" className="input mt-1" placeholder="optional" /></label>
          <p className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2 text-[11.5px] text-[var(--muted)]">Accountant files this under → <b>{target}</b> · {withGst ? "GST" : "Non-GST"} series</p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-violet"><Upload size={15} /> Upload SLA</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon?: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{icon}{label}</div>
      <div className="mt-1.5 text-[19px] font-extrabold tnum" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}
