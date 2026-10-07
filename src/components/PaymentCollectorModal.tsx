"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, CheckCircle2, UserCheck } from "lucide-react";
import { getPaymentCollectors, reassignPaymentCollector, type Collector, type ReassignResult } from "@/app/payments-actions";

// "Change name" on the Payments page: put the payments recorded under one person under the
// accountant who actually collected them. Only the "collected by" name changes.
const inr = (v: number) => "₹" + Math.round(v || 0).toLocaleString("en-IN");
const ROLE: Record<string, string> = { ACCOUNTANT: "Accountant", SUPER_ADMIN: "Super Admin", SUB_ADMIN: "Sub Admin" };
type Pay = { id: string; amount: number };

export default function PaymentCollectorModal({ from, all, inPeriod, periodLabel, close }: { from: string; all: Pay[]; inPeriod: Pay[]; periodLabel: string; close: () => void }) {
  const router = useRouter();
  const [people, setPeople] = useState<Collector[] | null>(null);
  const [scope, setScope] = useState<"ALL" | "PERIOD">("ALL");
  const [result, action, pending] = useActionState<ReassignResult, FormData>(reassignPaymentCollector, null);
  useEffect(() => {
    let alive = true;
    getPaymentCollectors().then((d) => { if (alive) setPeople(d); }).catch(() => { if (alive) setPeople([]); });
    return () => { alive = false; };
  }, []);
  const chosen = scope === "ALL" ? all : inPeriod;
  const total = (rows: Pay[]) => rows.reduce((s, p) => s + p.amount, 0);
  const others = (people ?? []).filter((p) => p.name !== from);
  const done = result?.ok;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex w-full max-w-[460px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Change who collected</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Payments now shown under <b>{from}</b>.</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        {done ? (
          <div className="space-y-4 px-6 py-6">
            <p className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-[var(--emerald)]" style={{ background: "color-mix(in srgb, var(--emerald) 8%, white)" }}><CheckCircle2 size={16} className="mt-0.5 flex-none" /> {result?.message}</p>
            <div className="flex justify-end"><button type="button" onClick={() => { close(); router.refresh(); }} className="btn btn-violet">Done</button></div>
          </div>
        ) : (
          <form action={action} className="space-y-3 px-6 py-5">
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="ids" value={JSON.stringify(chosen.map((p) => p.id))} />
            <label className="block">
              <span className="eyebrow block">Collected by (correct name)</span>
              <select name="to" required defaultValue="" className="select mt-1">
                <option value="" disabled>{people === null ? "Loading…" : "Choose the accountant…"}</option>
                {others.map((p) => <option key={p.name} value={p.name}>{p.name} — {ROLE[p.role] ?? p.role}</option>)}
              </select>
              {people !== null && others.length === 0 && <span className="mt-1.5 block text-[11.5px] text-[var(--rose)]">No other accountant or admin login exists yet. Add the accountant in Team first.</span>}
            </label>
            <div>
              <span className="eyebrow block">Which payments</span>
              <div className="mt-1.5 space-y-2">
                <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-[var(--line-2)] px-3 py-2 text-[13px]"><input type="radio" checked={scope === "ALL"} onChange={() => setScope("ALL")} className="accent-[var(--violet)]" /><span className="flex-1 font-semibold">All of {from}&apos;s payments</span><span className="text-[12px] text-[var(--muted)] tnum">{all.length} · {inr(total(all))}</span></label>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-[var(--line-2)] px-3 py-2 text-[13px]"><input type="radio" checked={scope === "PERIOD"} onChange={() => setScope("PERIOD")} className="accent-[var(--violet)]" /><span className="flex-1 font-semibold">Only {periodLabel.toLowerCase()}</span><span className="text-[12px] text-[var(--muted)] tnum">{inPeriod.length} · {inr(total(inPeriod))}</span></label>
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--faint)]">Only the name changes — amounts, dates and invoices stay as they are. The company filter on the page applies.</p>
            </div>
            {result && !result.ok && <p className="rounded-[10px] px-3 py-2 text-[12.5px] font-semibold text-[var(--rose)]" style={{ background: "color-mix(in srgb, var(--rose) 8%, white)" }}>{result.message}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
              <button type="submit" disabled={pending || chosen.length === 0} className="btn btn-violet disabled:opacity-60"><UserCheck size={15} /> {pending ? "Changing…" : `Change ${chosen.length} payment${chosen.length === 1 ? "" : "s"}`}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
