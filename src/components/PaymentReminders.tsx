"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { COMPANIES } from "@/lib/domain";
import { todayIST } from "@/lib/india-date";
import { setPaymentReminder } from "@/app/reminder-actions";
import { BellRing, AlertTriangle, CalendarClock, CalendarDays, CalendarRange, Phone, MessageCircle, IndianRupee, Clock3, X, ChevronDown } from "lucide-react";

// Payment reminders — a pipeline of every invoice with money still pending, by when the client
// has to be reminded: Overdue → Today → This week → Later. The reminder date is the follow-up
// date the accountant set ("remind me on …"); until one is set it is the invoice's due date.

type Row = { id: string; clientId: string | null; number: string; billTo: string; contact: string | null; phone: string | null; total: number; received: number; balance: number; issueDate: string; dueDate: string; nextFollowup: string | null; company?: string };
type Stage = "overdue" | "today" | "week" | "later";

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmt = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysFrom = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, white)`;

const STAGES: { key: Stage; label: string; hint: string; tone: string; icon: typeof BellRing }[] = [
  { key: "overdue", label: "Overdue", hint: "reminder date passed", tone: "var(--rose)", icon: AlertTriangle },
  { key: "today", label: "Today", hint: "remind today", tone: "var(--amber)", icon: BellRing },
  { key: "week", label: "This week", hint: "next 7 days", tone: "var(--violet)", icon: CalendarDays },
  { key: "later", label: "Later", hint: "after 7 days", tone: "var(--sky)", icon: CalendarRange },
];
const PAGE = 8;

export default function PaymentReminders({ rows }: { rows: Row[] }) {
  const today = todayIST();
  const weekEnd = addDays(today, 7);

  const items = useMemo(() => rows.filter((r) => r.balance > 0).map((r) => {
    const remindOn = r.nextFollowup || r.dueDate || r.issueDate;
    const stage: Stage = !remindOn || remindOn < today ? "overdue" : remindOn === today ? "today" : remindOn <= weekEnd ? "week" : "later";
    return { ...r, remindOn, stage, lateDays: r.dueDate && r.dueDate < today ? daysFrom(r.dueDate, today) : 0 };
  }).sort((a, b) => (a.remindOn < b.remindOn ? -1 : a.remindOn > b.remindOn ? 1 : b.balance - a.balance)), [rows, today, weekEnd]);

  const by = (s: Stage) => items.filter((r) => r.stage === s);
  const firstBusy = STAGES.find((s) => by(s.key).length > 0)?.key ?? "overdue";
  const [stage, setStage] = useState<Stage | null>(null);
  const active = stage ?? firstBusy;
  const [more, setMore] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const list = by(active);
  const shown = more ? list : list.slice(0, PAGE);
  const tone = STAGES.find((s) => s.key === active)!.tone;

  const waLink = (r: (typeof items)[number]) => {
    const digits = (r.phone ?? "").replace(/\D/g, "");
    const phone = digits.length === 10 ? `91${digits}` : digits;
    if (phone.length < 11) return "";
    const from = COMPANIES[r.company ?? ""]?.label ?? "Web Rocz";
    const text = `Hello ${r.contact || r.billTo},\n\nThis is a gentle reminder from ${from}. Invoice ${r.number} dated ${fmt(r.issueDate)} has a pending amount of ${inr(r.balance)}${r.dueDate ? ` (due on ${fmt(r.dueDate)})` : ""}.\n\nKindly arrange the payment at the earliest. Please ignore this message if it is already paid.\n\nThank you.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: tint("var(--amber)", 14), color: "#92600a" }}><BellRing size={16} /></span>
          <div>
            <h2 className="text-[14px] font-bold">Payment reminders</h2>
            <p className="text-[11.5px] text-[var(--muted)]">Invoices with payment pending — who to remind and when</p>
          </div>
        </div>
        <span className="text-[12px] text-[var(--muted)]"><b className="tnum text-[var(--ink)]">{items.length}</b> pending · <b className="tnum" style={{ color: "var(--amber)" }}>{inr(items.reduce((s, r) => s + r.balance, 0))}</b></span>
      </div>

      {/* the pipeline */}
      <div className="grid grid-cols-2 gap-2.5 border-b border-[var(--line)] p-3 lg:grid-cols-4">
        {STAGES.map((s) => {
          const g = by(s.key); const on = active === s.key;
          return (
            <button key={s.key} type="button" onClick={() => { setStage(s.key); setMore(false); setEditing(null); }}
              className="rounded-[12px] border px-4 py-3 text-left transition"
              style={{ borderColor: on ? s.tone : "var(--line-2)", background: on ? tint(s.tone, 7) : "var(--surface)", boxShadow: on ? `0 0 0 1px ${s.tone}` : undefined }}>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: s.tone }}><s.icon size={13} /> {s.label}</span>
                <span className="text-[20px] font-extrabold leading-none tnum" style={{ color: g.length ? s.tone : "var(--faint)" }}>{g.length}</span>
              </div>
              <div className="mt-1.5 text-[13px] font-bold tnum">{inr(g.reduce((t, r) => t + r.balance, 0))}</div>
              <div className="text-[10.5px] text-[var(--faint)]">{s.hint}</div>
            </button>
          );
        })}
      </div>

      {/* the invoices in the chosen stage */}
      <div className="divide-y divide-[var(--line)]">
        {list.length === 0 && (
          <div className="px-5 py-9 text-center text-[13px] text-[var(--muted)]">{items.length === 0 ? "No payment is pending — nothing to remind." : "Nothing in this stage."}</div>
        )}
        {shown.map((r) => {
          const wa = waLink(r);
          const digits = (r.phone ?? "").replace(/[^\d+]/g, "");
          return (
            <div key={r.id} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1 basis-[240px]">
                  <Link href={r.clientId ? `/accounts/${r.clientId}` : `/invoices/${r.id}`} prefetch className="block truncate text-[13.5px] font-bold text-[var(--violet)] hover:underline">{r.billTo}</Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--muted)]">
                    <Link href={`/invoices/${r.id}`} className="font-semibold text-[var(--ink-2)] hover:underline">{r.number}</Link>
                    {r.company && COMPANIES[r.company] && <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-px text-[10px] font-semibold">{COMPANIES[r.company].label}</span>}
                    <span>due {fmt(r.dueDate)}</span>
                    {r.lateDays > 0 && <span className="font-semibold text-[var(--rose)]">{r.lateDays} day{r.lateDays === 1 ? "" : "s"} late</span>}
                    {r.nextFollowup && <span className="inline-flex items-center gap-1" style={{ color: "#92600a" }}><Clock3 size={11} /> remind {fmt(r.nextFollowup)}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-extrabold tnum" style={{ color: tone }}>{inr(r.balance)}</div>
                  <div className="text-[10.5px] text-[var(--faint)] tnum">of {inr(r.total)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {wa
                    ? <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-[9px] px-2.5 text-[12px] font-bold text-white" style={{ background: "#16a34a" }} title="Open WhatsApp with the reminder message ready"><MessageCircle size={13} /> Remind</a>
                    : <span className="inline-flex h-8 items-center rounded-[9px] border border-dashed border-[var(--line-2)] px-2.5 text-[11.5px] text-[var(--faint)]" title="Add the client's phone number to send a reminder">No phone</span>}
                  {digits && <a href={`tel:${digits}`} className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]" title={`Call ${r.phone}`}><Phone size={13} /></a>}
                  <button type="button" onClick={() => setEditing(editing === r.id ? null : r.id)} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-[var(--line-2)] bg-[var(--surface)] px-2.5 text-[12px] font-bold hover:bg-[var(--surface-2)]" title="Remind me again on another date"><CalendarClock size={13} /> Remind later</button>
                  <Link href={r.clientId ? `/accounts/${r.clientId}?pay=${r.id}` : `/invoices/${r.id}`} prefetch className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-[var(--line-2)] bg-[var(--surface)] px-2.5 text-[12px] font-bold text-[var(--emerald)] hover:bg-[var(--surface-2)]" title="Record the payment received"><IndianRupee size={13} /> Paid</Link>
                </div>
              </div>
              {editing === r.id && (
                <form action={async (fd) => { await setPaymentReminder(fd); setEditing(null); }} className="mt-2.5 flex flex-wrap items-end gap-2 rounded-[10px] border border-[var(--line-2)] bg-[var(--surface-2)] p-3">
                  <input type="hidden" name="invoiceId" value={r.id} />
                  <label className="block"><span className="eyebrow">Remind me on</span><input name="date" type="date" required min={today} defaultValue={r.nextFollowup && r.nextFollowup > today ? r.nextFollowup : addDays(today, 3)} className="input mt-1 !w-auto !py-1.5" /></label>
                  <label className="block min-w-[200px] flex-1"><span className="eyebrow">What the client said (optional)</span><input name="note" maxLength={300} placeholder="e.g. Will pay on Friday" className="input mt-1 !py-1.5" /></label>
                  <button type="submit" className="btn btn-violet btn-sm">Save</button>
                  <button type="button" onClick={() => setEditing(null)} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]" title="Close"><X size={14} /></button>
                </form>
              )}
            </div>
          );
        })}
      </div>
      {list.length > PAGE && (
        <button type="button" onClick={() => setMore(!more)} className="flex w-full items-center justify-center gap-1 border-t border-[var(--line)] py-2.5 text-[12.5px] font-bold text-[var(--violet)] hover:bg-[var(--surface-2)]">
          {more ? "Show less" : `Show all ${list.length}`} <ChevronDown size={14} style={{ transform: more ? "rotate(180deg)" : undefined }} />
        </button>
      )}
    </div>
  );
}
