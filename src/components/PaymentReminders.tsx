"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { COMPANIES } from "@/lib/domain";
import { todayIST } from "@/lib/india-date";
import { setPaymentReminder, clearPaymentReminder } from "@/app/reminder-actions";
import type { PaymentReminder } from "@/lib/payment-reminders";
import { BellRing, AlertTriangle, CalendarClock, CalendarDays, CalendarRange, Phone, MessageCircle, IndianRupee, Clock3, X, ChevronDown, Check, BellOff, MessageSquareText } from "lucide-react";

// Payment Reminders — the follow-ups the accountant set by hand ("follow up again tomorrow"),
// as a pipeline by their date: Overdue → Today → This week → Later. A reminder is set from the
// Follow-up popup of a client, from an invoice's follow-up, or here with "Remind on".
// "No reminder set" lists the invoices with money pending that nobody scheduled yet.

type Stage = "overdue" | "today" | "week" | "later" | "none";

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmt = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysFrom = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, white)`;

const STAGES: { key: Stage; label: string; hint: string; tone: string; icon: typeof BellRing }[] = [
  { key: "overdue", label: "Overdue", hint: "reminder date passed", tone: "var(--rose)", icon: AlertTriangle },
  { key: "today", label: "Today", hint: "follow up today", tone: "var(--amber)", icon: BellRing },
  { key: "week", label: "This week", hint: "next 7 days", tone: "var(--violet)", icon: CalendarDays },
  { key: "later", label: "Later", hint: "after 7 days", tone: "var(--sky)", icon: CalendarRange },
  { key: "none", label: "No reminder set", hint: "payment pending", tone: "var(--muted)", icon: BellOff },
];

// `pageSize`: how many rows of a stage show before "Show all" (more on the full page).
// `mineFirst` (Super Admin): open on the clients marked "Rajesh Sir" in Follow-up payment by, with
// a switch to see everyone's.
export default function PaymentReminders({ rows: allRows, pageSize: PAGE = 8, mineFirst = false }: { rows: PaymentReminder[]; pageSize?: number; mineFirst?: boolean }) {
  const [onlyMine, setOnlyMine] = useState(mineFirst);
  const rows = useMemo(() => (onlyMine ? allRows.filter((r) => r.followupBy === "Rajesh Sir") : allRows), [allRows, onlyMine]);
  const today = todayIST();
  const weekEnd = addDays(today, 7);

  const items = useMemo(() => rows.map((r) => {
    const stage: Stage = !r.remindOn ? "none" : r.remindOn < today ? "overdue" : r.remindOn === today ? "today" : r.remindOn <= weekEnd ? "week" : "later";
    return { ...r, stage, lateDays: r.balance > 0 && r.dueDate && r.dueDate < today ? daysFrom(r.dueDate, today) : 0 };
  }).sort((a, b) => (a.remindOn !== b.remindOn ? (a.remindOn < b.remindOn ? -1 : 1) : b.balance - a.balance)), [rows, today, weekEnd]);

  const by = (s: Stage) => items.filter((r) => r.stage === s);
  const scheduled = items.filter((r) => r.stage !== "none");
  // open on the first stage that needs attention; with nothing scheduled, on the unscheduled list
  const firstBusy = STAGES.find((s) => by(s.key).length > 0)?.key ?? "today";
  const [stage, setStage] = useState<Stage | null>(null);
  const active = stage ?? firstBusy;
  const [more, setMore] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const list = by(active);
  const shown = more ? list : list.slice(0, PAGE);
  const tone = STAGES.find((s) => s.key === active)!.tone;

  const waLink = (r: (typeof items)[number]) => {
    const digits = r.phone.replace(/\D/g, "");
    const phone = digits.length === 10 ? `91${digits}` : digits;
    if (phone.length < 11) return "";
    const from = COMPANIES[r.company]?.label ?? "Web Rocz";
    const about = r.kind === "invoice"
      ? `Invoice ${r.label}${r.issueDate ? ` dated ${fmt(r.issueDate)}` : ""} has a pending amount of ${inr(r.balance)}${r.dueDate ? ` (due on ${fmt(r.dueDate)})` : ""}.`
      : `There is a pending amount of ${inr(r.balance)} on your account.`;
    const text = r.balance > 0
      ? `Hello ${r.contact || r.name},\n\nThis is a gentle reminder from ${from}. ${about}\n\nKindly arrange the payment at the earliest. Please ignore this message if it is already paid.\n\nThank you.`
      : `Hello ${r.contact || r.name},\n\nThis is ${from}, following up with you.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: tint("var(--amber)", 14), color: "#92600a" }}><BellRing size={16} /></span>
          <div>
            <h2 className="text-[14px] font-bold">Payment reminders</h2>
            <p className="text-[11.5px] text-[var(--muted)]">Follow-ups you set — “follow up again on …” in a client’s or invoice’s Follow-up brings it here on that date</p>
          </div>
        </div>
        {mineFirst && (
          <div className="inline-flex rounded-[9px] border border-[var(--line-2)] bg-[var(--surface-2)] p-0.5">
            {([[true, "Rajesh Sir"], [false, "All"]] as const).map(([v, l]) => (
              <button key={l} type="button" onClick={() => { setOnlyMine(v); setStage(null); }} className={`rounded-[7px] px-3 py-1 text-[12px] font-semibold ${onlyMine === v ? "bg-[var(--violet)] text-white" : "text-[var(--ink-2)]"}`}>{l}</button>
            ))}
          </div>
        )}
        <span className="text-[12px] text-[var(--muted)]"><b className="tnum text-[var(--ink)]">{scheduled.length}</b> reminder{scheduled.length === 1 ? "" : "s"} set · <b className="tnum" style={{ color: "var(--amber)" }}>{by("overdue").length + by("today").length}</b> due now</span>
      </div>

      {/* the pipeline */}
      <div className="grid grid-cols-2 gap-2.5 border-b border-[var(--line)] p-3 md:grid-cols-3 xl:grid-cols-5">
        {STAGES.map((s) => {
          const g = by(s.key); const on = active === s.key;
          return (
            <button key={s.key} type="button" onClick={() => { setStage(s.key); setMore(false); setEditing(null); }}
              className="rounded-[12px] border px-4 py-3 text-left transition"
              style={{ borderColor: on ? s.tone : "var(--line-2)", borderStyle: s.key === "none" && !on ? "dashed" : "solid", background: on ? tint(s.tone, 7) : "var(--surface)", boxShadow: on ? `0 0 0 1px ${s.tone}` : undefined }}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: s.tone }}><s.icon size={13} /> {s.label}</span>
                <span className="text-[20px] font-extrabold leading-none tnum" style={{ color: g.length ? s.tone : "var(--faint)" }}>{g.length}</span>
              </div>
              <div className="mt-1.5 text-[13px] font-bold tnum">{inr(g.reduce((t, r) => t + r.balance, 0))}</div>
              <div className="text-[10.5px] text-[var(--faint)]">{s.hint}</div>
            </button>
          );
        })}
      </div>

      {/* the reminders in the chosen stage */}
      <div className="divide-y divide-[var(--line)]">
        {list.length === 0 && (
          <div className="px-5 py-9 text-center text-[13px] text-[var(--muted)]">
            {active === "none" ? "Every pending invoice has a reminder set." : scheduled.length === 0 ? "No reminder is set yet. Open a client’s Follow-up, write the note and pick “Follow up again on” — it will show here on that date." : "Nothing in this stage."}
          </div>
        )}
        {shown.map((r) => {
          const wa = waLink(r);
          const tel = r.phone.replace(/[^\d+]/g, "");
          const open = r.clientId ? `/accounts/${r.clientId}` : `/invoices/${r.id}`;
          return (
            <div key={r.key} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1 basis-[260px]">
                  <Link href={open} className="block truncate text-[13.5px] font-bold text-[var(--violet)] hover:underline">{r.name}</Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--muted)]">
                    {r.kind === "invoice" ? <Link href={`/invoices/${r.id}`} className="font-semibold text-[var(--ink-2)] hover:underline">{r.label}</Link> : <span className="font-semibold text-[var(--ink-2)]">{r.label}</span>}
                    {COMPANIES[r.company] && <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-px text-[10px] font-semibold">{COMPANIES[r.company].label}</span>}
                    {r.remindOn ? <span className="inline-flex items-center gap-1 font-semibold" style={{ color: r.stage === "overdue" ? "var(--rose)" : "#92600a" }}><Clock3 size={11} /> follow up {fmt(r.remindOn)}</span> : null}
                    {r.balance > 0 && r.dueDate && <span>due {fmt(r.dueDate)}</span>}
                    {r.lateDays > 0 && <span className="font-semibold text-[var(--rose)]">{r.lateDays} day{r.lateDays === 1 ? "" : "s"} late</span>}
                  </div>
                  {r.lastNote && <div className="mt-1 flex items-start gap-1.5 text-[12px] text-[var(--ink-2)]"><MessageSquareText size={12} className="mt-0.5 flex-none text-[var(--faint)]" /><span className="line-clamp-2">{r.lastNote}<span className="text-[var(--faint)]"> — {[r.lastBy, fmt(r.lastOn)].filter((x) => x && x !== "—").join(", ")}</span></span></div>}
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-extrabold tnum" style={{ color: r.balance > 0 ? tone : "var(--faint)" }}>{r.balance > 0 ? inr(r.balance) : "No dues"}</div>
                  {r.balance > 0 && <div className="text-[10.5px] text-[var(--faint)] tnum">of {inr(r.total)}</div>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {wa
                    ? <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-[9px] px-2.5 text-[12px] font-bold text-white" style={{ background: "#16a34a" }} title="Open WhatsApp with the reminder message ready"><MessageCircle size={13} /> WhatsApp</a>
                    : <span className="inline-flex h-8 items-center rounded-[9px] border border-dashed border-[var(--line-2)] px-2.5 text-[11.5px] text-[var(--faint)]" title="Add the client's phone number to message them">No phone</span>}
                  {tel && <a href={`tel:${tel}`} className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]" title={`Call ${r.phone}`}><Phone size={13} /></a>}
                  <button type="button" onClick={() => setEditing(editing === r.key ? null : r.key)} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-[var(--line-2)] bg-[var(--surface)] px-2.5 text-[12px] font-bold hover:bg-[var(--surface-2)]" title="Follow up again on another date"><CalendarClock size={13} /> {r.remindOn ? "Follow up again" : "Set reminder"}</button>
                  {r.remindOn && (
                    <form action={clearPaymentReminder}>
                      <input type="hidden" name="kind" value={r.kind} /><input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-[var(--line-2)] bg-[var(--surface)] px-2.5 text-[12px] font-bold text-[var(--emerald)] hover:bg-[var(--surface-2)]" title="Followed up — remove this reminder"><Check size={13} /> Done</button>
                    </form>
                  )}
                  {r.balance > 0 && <Link href={r.clientId ? `/accounts/${r.clientId}${r.kind === "invoice" ? `?pay=${r.id}` : ""}` : `/invoices/${r.id}`} className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--line-2)] bg-[var(--surface)] text-[var(--emerald)] hover:bg-[var(--surface-2)]" title="Record the payment received"><IndianRupee size={13} /></Link>}
                </div>
              </div>
              {editing === r.key && <RemindForm r={r} today={today} close={() => setEditing(null)} />}
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

// "Follow up again on": tomorrow / in 3 days / next week or any date, and what the client said.
function RemindForm({ r, today, close }: { r: PaymentReminder; today: string; close: () => void }) {
  const [date, setDate] = useState(addDays(today, 1));
  const quick = [{ label: "Tomorrow", d: addDays(today, 1) }, { label: "In 3 days", d: addDays(today, 3) }, { label: "Next week", d: addDays(today, 7) }];
  return (
    <form action={async (fd) => { await setPaymentReminder(fd); close(); }} className="mt-2.5 space-y-2.5 rounded-[10px] border border-[var(--line-2)] bg-[var(--surface-2)] p-3">
      <input type="hidden" name="kind" value={r.kind} /><input type="hidden" name="id" value={r.id} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="block"><span className="eyebrow">Follow up again on</span><input name="date" type="date" required min={addDays(today, 1)} value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1 !w-auto !py-1.5" /></label>
        <div className="flex flex-wrap gap-1.5 pb-0.5">
          {quick.map((q) => (
            <button key={q.label} type="button" onClick={() => setDate(q.d)} className="rounded-full border px-2.5 py-1 text-[12px] font-semibold" style={{ borderColor: date === q.d ? "var(--violet)" : "var(--line-2)", background: date === q.d ? "color-mix(in srgb, var(--violet) 9%, white)" : "var(--surface)", color: date === q.d ? "var(--violet)" : "var(--ink-2)" }}>{q.label}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-[220px] flex-1"><span className="eyebrow">What the client said (optional)</span><input name="note" maxLength={300} placeholder="e.g. Will pay on Friday" className="input mt-1 !py-1.5" /></label>
        <button type="submit" className="btn btn-violet btn-sm">Save reminder</button>
        <button type="button" onClick={close} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]" title="Close"><X size={14} /></button>
      </div>
    </form>
  );
}
