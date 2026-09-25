"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { updateClientWebsite, addClientWebsite } from "@/app/actions";
import { downloadCsv } from "@/lib/csv";
import { Globe, Search, ChevronLeft, ChevronRight, Download, Pencil, X, ServerCog, CalendarClock, Plus, IndianRupee } from "lucide-react";

const PAGE_SIZE = 12;
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmtDate = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };
const todayISO = () => new Date().toISOString().slice(0, 10);

type Row = {
  id: string; code: string; name: string; phone: string; email: string; status: string;
  websiteName: string; domain: string; hostingTaken: boolean; takenDate: string; expiryDate: string;
  renewAmount: number; daysToExpiry: number | null; expiring: boolean; expired: boolean; hasWebsite: boolean; detailsFilled: boolean; isWebsiteClient: boolean; websiteGst: boolean; websiteNoGst: boolean;
};
type Counts = { all: number; tracked: number; hosting: number; expiring: number; expired: number };
type Totals = { renewDue: number; renewAll: number };

export default function WebsiteRenewals({ rows, counts, totals }: { rows: Row[]; counts: Counts; totals: Totals }) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"tracked" | "expiring">("tracked");
  const [gstSel, setGstSel] = useState("ALL"); // ALL | GST | NOGST
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const nq = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      if (!r.hasWebsite) return false; // website page → only website clients
      if (view === "expiring" && !r.expiring) return false;
      if (gstSel === "GST" && !r.websiteGst) return false;
      if (gstSel === "NOGST" && !r.websiteNoGst) return false;
      if (nq && !`${r.name} ${r.code} ${r.websiteName} ${r.domain} ${r.phone}`.toLowerCase().includes(nq)) return false;
      return true;
    });
    // expiring first (soonest), then by name
    list.sort((a, b) => {
      const da = a.daysToExpiry ?? 99999, db = b.daysToExpiry ?? 99999;
      return da - db || a.name.localeCompare(b.name);
    });
    return list;
  }, [rows, nq, view, gstSel]);

  const [page, setPage] = useState(1);
  const sig = `${nq}|${view}|${gstSel}`;
  const [prevSig, setPrevSig] = useState(sig);
  if (prevSig !== sig) { setPrevSig(sig); setPage(1); }
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);

  const exportCsv = () => downloadCsv(
    `website-renewals-${todayISO()}.csv`,
    ["Client", "Code", "Website", "Domain", "Hosting", "Taken", "Expiry", "Renewal amount", "Days to expiry"],
    filtered.map((r) => [r.name, r.code, r.websiteName, r.domain, r.hostingTaken ? "Yes" : "No", r.takenDate, r.expiryDate, r.renewAmount, r.daysToExpiry ?? ""]),
  );

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(100deg, color-mix(in srgb, var(--indigo) 10%, white), color-mix(in srgb, var(--sky) 6%, white))" }}>
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] text-white shadow-sm" style={{ background: "linear-gradient(135deg, var(--indigo), var(--sky))" }}><Globe size={20} /></span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-extrabold tracking-tight">Website renewals</span>
                <span className="rounded-full border border-[var(--line-2)] bg-white/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--indigo)]">Finance</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{counts.tracked} website{counts.tracked === 1 ? "" : "s"} · {counts.hosting} on our hosting · <b style={{ color: "var(--rose)" }}>{counts.expiring}</b> expiring soon</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAddOpen(true)} className="btn btn-violet"><Plus size={15} /> Add website</button>
            <button onClick={exportCsv} className="btn btn-ghost"><Download size={15} /> Export CSV</button>
            <Link href="/" prefetch className="btn btn-ghost">← Dashboard</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Website clients" value={String(counts.tracked)} icon={<Globe size={15} />} />
        <Kpi label="Hosting with us" value={String(counts.hosting)} tone="var(--indigo)" icon={<ServerCog size={15} />} />
        <Kpi label="Expiring ≤ 30d" value={String(counts.expiring)} tone="var(--amber)" icon={<CalendarClock size={15} />} />
        <Kpi label="Renewal due" value={inr(totals.renewDue)} tone="var(--rose)" icon={<IndianRupee size={15} />} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1 sm:max-w-[300px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, website, domain…" className="input !py-2 !pl-9" />
        </div>
        <div className="inline-flex rounded-[var(--r-md)] border border-[var(--line-2)] p-0.5">
          {([["tracked", "Website clients"], ["expiring", "Expiring"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setView(k)} className={`rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold ${view === k ? "bg-[var(--violet)] text-white" : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]"}`}>{label}</button>
          ))}
        </div>
        <select value={gstSel} onChange={(e) => setGstSel(e.target.value)} className="select !w-auto"><option value="ALL">GST &amp; Non-GST</option><option value="GST">With GST</option><option value="NOGST">Without GST</option></select>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[980px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["#", "Client", "Website name", "Domain", "Hosting", "Date taken", "Expiry", "Renewal ₹", "Actions"].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No website clients{view === "expiring" ? " expiring" : ""} found. Use “Add website” to add one.</td></tr>}
              {paged.map((r, i) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3 text-[12.5px] text-[var(--faint)] tnum">{start + i + 1}</td>
                  <td className="px-5 py-3"><Link href={`/accounts/${r.id}`} prefetch className="text-[13px] font-semibold text-[var(--violet)] hover:underline">{r.name}</Link><div className="text-[11px] text-[var(--faint)]">{r.code}{r.phone ? ` · ${r.phone}` : ""}</div></td>
                  <td className="px-5 py-3 text-[12.5px]">{r.websiteName || "—"}</td>
                  <td className="px-5 py-3 text-[12.5px]">{r.domain ? <a href={r.domain.startsWith("http") ? r.domain : `https://${r.domain}`} target="_blank" rel="noreferrer" className="text-[var(--indigo)] hover:underline">{r.domain}</a> : "—"}</td>
                  <td className="px-5 py-3">{r.hostingTaken ? <span className="rounded-full bg-[color-mix(in_srgb,var(--emerald)_14%,white)] px-2 py-0.5 text-[11px] font-bold text-[var(--emerald)]">Yes</span> : <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-bold text-[var(--muted)]">No</span>}</td>
                  <td className="px-5 py-3 text-[12.5px] tnum">{fmtDate(r.takenDate)}</td>
                  <td className="px-5 py-3 text-[12.5px] tnum">
                    {r.expiryDate ? (
                      <span className="inline-flex items-center gap-1.5">
                        {fmtDate(r.expiryDate)}
                        {r.expired ? <span className="rounded-full bg-[color-mix(in_srgb,var(--rose)_14%,white)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--rose)]">expired</span>
                          : r.expiring ? <span className="rounded-full bg-[color-mix(in_srgb,var(--amber)_16%,white)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--amber)]">expiring{r.daysToExpiry != null ? ` ${r.daysToExpiry}d` : ""}</span>
                          : null}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum">{r.renewAmount > 0 ? inr(r.renewAmount) : "—"}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => setEditRow(r)} className="inline-flex items-center gap-1 rounded-[7px] border border-[var(--line-2)] px-2 py-1 text-[12px] font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"><Pencil size={13} /> {r.detailsFilled ? "Edit website" : "Add details"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-3">
            <span className="text-[12.5px] text-[var(--muted)]">Showing <b className="tnum">{start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)}</b> of <b className="tnum">{filtered.length}</b></span>
            <div className="flex items-center gap-1.5">
              <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="btn btn-ghost btn-sm disabled:opacity-40"><ChevronLeft size={14} /> Prev</button>
              <span className="px-2 text-[12.5px] font-semibold tnum">{cur} / {totalPages}</span>
              <button disabled={cur >= totalPages} onClick={() => setPage(cur + 1)} className="btn btn-ghost btn-sm disabled:opacity-40">Next <ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {editRow && <WebsiteModal r={editRow} close={() => setEditRow(null)} />}
      {addOpen && <AddWebsiteModal rows={rows} close={() => setAddOpen(false)} />}
    </div>
  );
}

function WebsiteModal({ r, close }: { r: Row; close: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[480px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Website · {r.name}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Track the website, hosting and renewal/expiry.</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={updateClientWebsite} className="space-y-3 overflow-y-auto scroll-thin px-6 py-5">
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="return" value="/renewals" />
          <label className="block"><span className="eyebrow">Website name</span><input name="websiteName" defaultValue={r.websiteName} className="input mt-1" placeholder="e.g. Acme Corporate Site" /></label>
          <label className="block"><span className="eyebrow">Domain</span><input name="websiteDomain" defaultValue={r.domain} className="input mt-1" placeholder="e.g. acme.com" /></label>
          <label className="block"><span className="eyebrow">Hosting taken with us?</span><select name="hostingTaken" defaultValue={r.hostingTaken ? "yes" : "no"} className="select mt-1"><option value="no">No</option><option value="yes">Yes</option></select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Date taken</span><input name="websiteTakenDate" type="date" defaultValue={r.takenDate} className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Expiry date</span><input name="websiteExpiryDate" type="date" defaultValue={r.expiryDate} className="input mt-1" /></label>
          </div>
          <label className="block"><span className="eyebrow">Renewal amount (₹)</span><input name="websiteRenewAmount" type="number" min={0} defaultValue={r.renewAmount} className="input mt-1" placeholder="e.g. 8000" /></label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-violet"><Globe size={15} /> Save website</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add website: pick a client (those without a website first) and fill the details.
function AddWebsiteModal({ rows, close }: { rows: Row[]; close: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[480px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Add website</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Type the client name and record their website, hosting &amp; renewal.</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={addClientWebsite} className="space-y-3 overflow-y-auto scroll-thin px-6 py-5">
          <input type="hidden" name="return" value="/renewals" />
          <label className="block"><span className="eyebrow">Client name *</span>
            <input name="clientName" required list="client-names" className="input mt-1" placeholder="Type the client / company name" />
            <datalist id="client-names">{rows.map((r) => <option key={r.id} value={r.name} />)}</datalist>
            <span className="mt-1 block text-[11px] text-[var(--faint)]">Matches an existing client, or creates a new one if the name is new.</span>
          </label>
          <label className="block"><span className="eyebrow">Website name</span><input name="websiteName" className="input mt-1" placeholder="e.g. Acme Corporate Site" /></label>
          <label className="block"><span className="eyebrow">Domain</span><input name="websiteDomain" className="input mt-1" placeholder="e.g. acme.com" /></label>
          <label className="block"><span className="eyebrow">Hosting taken with us?</span><select name="hostingTaken" defaultValue="no" className="select mt-1"><option value="no">No</option><option value="yes">Yes</option></select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Date taken</span><input name="websiteTakenDate" type="date" className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Expiry date</span><input name="websiteExpiryDate" type="date" className="input mt-1" /></label>
          </div>
          <label className="block"><span className="eyebrow">Renewal amount (₹)</span><input name="websiteRenewAmount" type="number" min={0} defaultValue={0} className="input mt-1" placeholder="e.g. 8000" /></label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-violet"><Plus size={15} /> Add website</button>
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
