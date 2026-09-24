"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { logFollowup } from "@/app/sales-actions";
import { deleteClientFinance, addClientFromFinance } from "@/app/actions";
import { downloadCsv } from "@/lib/csv";
import { Users, Search, ReceiptText, Wallet, CheckCircle2, ChevronRight, ChevronLeft, StickyNote, Pencil, Trash2, X, History, Download, UserPlus } from "lucide-react";

const PAGE_SIZE = 10;

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (iso: string, n: number) => { const d = new Date((iso || todayISO()) + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

type MiniInv = { category: string; total: number; received: number; balance: number; overdue: boolean; issueDate: string };
type Note = { invId: string; invNumber: string; date: string; by: string; note: string };
type Row = { id: string; code: string; name: string; contact: string; phone: string; email: string; status: string; retainer: number; category: string; invs: MiniInv[]; notes: Note[]; noteTarget: { id: string; number: string } | null };

export default function FinanceClients({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [clientSel, setClientSel] = useState("ALL"); // ALL | <clientId>
  const [cat, setCat] = useState("ALL");
  const [payStatus, setPayStatus] = useState("ALL"); // ALL | overdue | due | paid | unbilled
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [notesRow, setNotesRow] = useState<Row | null>(null);
  const [delRow, setDelRow] = useState<Row | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const nq = q.trim().toLowerCase();

  const catMatch = (c: string) => cat === "ALL" || (cat === "WEBSITE" ? (c === "Website" || c === "Both") : (c === "Digital Marketing" || c === "Both"));
  const pFrom = from, pTo = to; // filter invoices by issue date within [from, to]
  const dateActive = !!pFrom || !!pTo;
  const catActive = cat !== "ALL";

  // Category + date only re-scope each client's TOTALS (all clients stay in the list).
  const computed = useMemo(() => rows.map((r) => {
    const invs = r.invs.filter((i) => catMatch(i.category) && (!pFrom || i.issueDate >= pFrom) && (!pTo || i.issueDate <= pTo));
    const billed = invs.reduce((s, i) => s + i.total, 0);
    const received = invs.reduce((s, i) => s + i.received, 0);
    const pending = invs.reduce((s, i) => s + i.balance, 0);
    const overdueAmt = invs.filter((i) => i.overdue).reduce((s, i) => s + i.balance, 0);
    return { ...r, billed, received, pending, overdueAmt, invoices: invs.length };
  }), [rows, cat, pFrom, pTo]);

  const filtered = useMemo(() => {
    const list = computed.filter((r) => {
      if (clientSel !== "ALL" && r.id !== clientSel) return false;
      if (nq && !`${r.name} ${r.code} ${r.contact} ${r.phone} ${r.email}`.toLowerCase().includes(nq)) return false;
      if (payStatus === "overdue" && r.overdueAmt <= 0) return false;
      if (payStatus === "due" && !(r.pending > 0 && r.overdueAmt <= 0)) return false;
      if (payStatus === "paid" && !(r.billed > 0 && r.pending <= 0)) return false;
      if (payStatus === "unbilled" && r.billed > 0) return false;
      return true;
    });
    list.sort((a, b) => (b.pending - a.pending) || (b.billed - a.billed) || a.name.localeCompare(b.name));
    return list;
  }, [computed, nq, payStatus, clientSel]);

  const totals = useMemo(() => ({
    clients: filtered.length,
    billed: filtered.reduce((s, r) => s + r.billed, 0),
    received: filtered.reduce((s, r) => s + r.received, 0),
    pending: filtered.reduce((s, r) => s + r.pending, 0),
    overdueAmt: filtered.reduce((s, r) => s + r.overdueAmt, 0),
  }), [filtered]);

  // pagination — reset to page 1 when filters change (render-time, no effect)
  const [page, setPage] = useState(1);
  const filterSig = `${nq}|${cat}|${payStatus}|${pFrom}|${pTo}|${clientSel}`;
  const [prevSig, setPrevSig] = useState(filterSig);
  if (prevSig !== filterSig) { setPrevSig(filterSig); setPage(1); }
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);

  const scopeLabel = cat === "WEBSITE" ? "Website" : cat === "DM" ? "Digital Marketing" : "All";

  const exportCsv = () => downloadCsv(
    `clients-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Client", "Code", "Category", "Invoices", "Billed", "Received", "Pending", "Overdue", "Phone", "Email"],
    filtered.map((r) => [r.name, r.code, r.category, r.invoices, r.billed, r.received, r.pending, r.overdueAmt, r.phone, r.email]),
  );

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(100deg, color-mix(in srgb, var(--violet) 10%, white), color-mix(in srgb, var(--magenta) 6%, white))" }}>
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] text-white shadow-sm" style={{ background: "linear-gradient(135deg, var(--magenta), var(--violet))" }}><Users size={20} /></span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-extrabold tracking-tight">Clients</span>
                <span className="rounded-full border border-[var(--line-2)] bg-white/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--violet)]">Finance</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{totals.clients} clients · Billed {inr(totals.billed)} · Pending <b style={{ color: "var(--amber)" }}>{inr(totals.pending)}</b></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAddOpen(true)} className="btn btn-violet"><UserPlus size={15} /> Add Client</button>
            <button onClick={exportCsv} className="btn btn-ghost"><Download size={15} /> Export CSV</button>
            <Link href="/" prefetch className="btn btn-ghost">← Dashboard</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={`Total billed${scopeLabel !== "All" ? ` · ${scopeLabel}` : ""}`} value={inr(totals.billed)} icon={<ReceiptText size={15} />} />
        <Kpi label="Received" value={inr(totals.received)} tone="var(--emerald)" icon={<CheckCircle2 size={15} />} />
        <Kpi label="Pending" value={inr(totals.pending)} tone="var(--amber)" icon={<Wallet size={15} />} />
        <Kpi label="Overdue" value={inr(totals.overdueAmt)} tone="var(--rose)" />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1 sm:max-w-[300px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, code, phone, email…" className="input !py-2 !pl-9" />
        </div>
        <select value={clientSel} onChange={(e) => setClientSel(e.target.value)} className="select !w-auto max-w-[220px]"><option value="ALL">All clients</option>{rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="select !w-auto"><option value="ALL">All categories</option><option value="WEBSITE">Website Development</option><option value="DM">Digital Marketing</option></select>
        <select value={payStatus} onChange={(e) => setPayStatus(e.target.value)} className="select !w-auto"><option value="ALL">All payments</option><option value="overdue">Has overdue</option><option value="due">Balance due</option><option value="paid">Fully paid</option><option value="unbilled">Not billed</option></select>
        <div className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface)] px-2.5 py-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input !w-auto !border-0 !py-1 !px-1 !shadow-none" aria-label="From date" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input !w-auto !border-0 !py-1 !px-1 !shadow-none" aria-label="To date" />
          {dateActive && <button onClick={() => { setFrom(""); setTo(""); }} className="text-[var(--faint)] hover:text-[var(--rose)]" title="Clear dates">✕</button>}
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[1080px] text-left">
            <thead><tr className="border-b border-[var(--line)]">{["#", "Client", "Category", "Invoices", "Billed", "Received", "Pending", "Overdue", "Actions"].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No clients found.</td></tr>}
              {paged.map((r, i) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3 text-[12.5px] text-[var(--faint)] tnum">{start + i + 1}</td>
                  <td className="px-5 py-3"><Link href={`/accounts/${r.id}`} prefetch className="text-[13px] font-semibold text-[var(--violet)] hover:underline">{r.name}</Link><div className="text-[11px] text-[var(--faint)]">{r.code}{r.phone ? ` · ${r.phone}` : ""}</div></td>
                  <td className="px-5 py-3"><CatChip c={catActive ? scopeLabel : r.category} /></td>
                  <td className="px-5 py-3 text-[12.5px] tnum">{r.invoices}</td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum">{inr(r.billed)}</td>
                  <td className="px-5 py-3 text-[13px] tnum" style={{ color: "var(--emerald)" }}>{inr(r.received)}</td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum" style={{ color: r.pending > 0 ? "var(--amber)" : "var(--emerald)" }}>{inr(r.pending)}</td>
                  <td className="px-5 py-3 text-[13px] font-semibold tnum" style={{ color: r.overdueAmt > 0 ? "var(--rose)" : "var(--faint)" }}>{r.overdueAmt > 0 ? inr(r.overdueAmt) : "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setNotesRow(r)} title="Notes / follow-ups" className="inline-flex items-center gap-1 rounded-[7px] border border-[var(--line-2)] px-2 py-1 text-[12px] font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"><StickyNote size={13} /> Notes{r.notes.length > 0 && <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-[var(--violet)] px-1 text-[9px] font-bold text-white">{r.notes.length}</span>}</button>
                      <Link href={`/accounts/${r.id}`} prefetch title="Edit info & invoices" className="inline-flex items-center gap-1 rounded-[7px] border border-[var(--line-2)] px-2 py-1 text-[12px] font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"><Pencil size={13} /> Edit</Link>
                      <button onClick={() => setDelRow(r)} title="Delete client" className="inline-flex items-center gap-1 rounded-[7px] border border-[var(--line-2)] px-2 py-1 text-[12px] font-semibold text-[var(--rose)] hover:bg-[color-mix(in_srgb,var(--rose)_10%,white)]"><Trash2 size={13} /> Delete</button>
                    </div>
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

      {notesRow && <NotesModal r={notesRow} close={() => setNotesRow(null)} />}
      {delRow && <DeleteModal r={delRow} close={() => setDelRow(null)} />}
      {addOpen && <AddClientModal close={() => setAddOpen(false)} />}
    </div>
  );
}

function AddClientModal({ close }: { close: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Add new client</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Register a client for billing. You can raise invoices for them afterwards.</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={addClientFromFinance} className="space-y-3 overflow-y-auto scroll-thin px-6 py-5">
          <input type="hidden" name="return" value="/accounts" />
          <label className="block"><span className="eyebrow">Client / company name *</span><input name="name" required className="input mt-1" placeholder="Acme Pvt Ltd" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Contact person</span><input name="pocName" className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Phone</span><input name="pocMobile" className="input mt-1" /></label>
          </div>
          <label className="block"><span className="eyebrow">Email</span><input name="pocEmail" type="email" className="input mt-1" /></label>
          <div className="rounded-[10px] border border-[var(--line)] p-3">
            <div className="eyebrow mb-2">Amount to be paid — per service</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-[12px] font-semibold text-[var(--indigo)]">Website Development (₹)</span><input name="webAmount" type="number" min={0} defaultValue={0} className="input mt-1" placeholder="0" /></label>
              <label className="block"><span className="text-[12px] font-semibold text-[var(--magenta)]">Digital Marketing (₹)</span><input name="dmAmount" type="number" min={0} defaultValue={0} className="input mt-1" placeholder="0" /></label>
            </div>
            <label className="mt-3 block"><span className="eyebrow">Amount already paid (₹)</span><input name="paid" type="number" min={0} defaultValue={0} className="input mt-1" placeholder="0" /></label>
            <p className="mt-2 text-[11.5px] text-[var(--faint)]">Each service creates its own invoice (so Website vs DM stays separate). Paid amount is applied Website first. Leave amounts at 0 to just register the client.</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-violet"><UserPlus size={15} /> Add client</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NotesModal({ r, close }: { r: Row; close: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Follow-ups · {r.name}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{r.notes.length} note{r.notes.length === 1 ? "" : "s"}{r.noteTarget ? ` · new note → ${r.noteTarget.number}` : ""}</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>

        <div className="max-h-[38vh] overflow-y-auto scroll-thin px-6 py-4">
          {r.notes.length === 0 && <p className="text-[12.5px] text-[var(--muted)]">No follow-ups logged yet.</p>}
          <div className="space-y-2">
            {r.notes.map((n, i) => (
              <div key={i} className="rounded-[10px] border border-[var(--line)] px-3 py-2 text-[12.5px]">
                <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--faint)]"><span className="tnum">{n.date}</span><span>· {n.by || "—"}</span><span className="ml-auto font-semibold">{n.invNumber}</span></div>
                <div className="mt-0.5 text-[var(--ink-2)]">{n.note}</div>
              </div>
            ))}
          </div>
        </div>

        {r.noteTarget ? (
          <form action={logFollowup} className="space-y-3 border-t border-[var(--line)] px-6 py-4">
            <input type="hidden" name="invoiceId" value={r.noteTarget.id} />
            <input type="hidden" name="return" value="/accounts" />
            <label className="block"><span className="eyebrow">Add note</span><textarea name="note" rows={2} className="input mt-1" placeholder="e.g. Called — will pay by Friday" /></label>
            <label className="block"><span className="eyebrow">Next follow-up date</span><input name="nextFollowup" type="date" defaultValue={addDaysISO(todayISO(), 3)} className="input mt-1" /></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={close} className="btn btn-ghost">Close</button><button type="submit" className="btn btn-violet"><History size={15} /> Save note</button></div>
          </form>
        ) : (
          <div className="border-t border-[var(--line)] px-6 py-4 text-[12px] text-[var(--muted)]">Raise an invoice for this client to log follow-ups.</div>
        )}
      </div>
    </div>
  );
}

function DeleteModal({ r, close }: { r: Row; close: () => void }) {
  const invCount = r.invs.length;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="w-full max-w-[420px] overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 px-6 py-5">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-full" style={{ background: "color-mix(in srgb, var(--rose) 14%, white)", color: "var(--rose)" }}><Trash2 size={18} /></span>
          <div>
            <h2 className="text-[16px] font-bold">Delete {r.name}?</h2>
            <p className="mt-1 text-[12.5px] text-[var(--muted)]">This permanently removes the client{invCount > 0 ? ` and its ${invCount} invoice${invCount === 1 ? "" : "s"} (and their payments)` : ""}. This cannot be undone.</p>
          </div>
        </div>
        <form action={deleteClientFinance} className="flex justify-end gap-2 border-t border-[var(--line)] px-6 py-3">
          <input type="hidden" name="id" value={r.id} />
          <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
          <button type="submit" className="btn btn-sm" style={{ background: "var(--rose)", color: "#fff" }}><Trash2 size={14} /> Delete client</button>
        </form>
      </div>
    </div>
  );
}

function CatChip({ c }: { c: string }) {
  const map: Record<string, string> = { Website: "var(--indigo)", "Digital Marketing": "var(--magenta)", Both: "var(--violet)" };
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
