"use client";

import { useActionState, useEffect, useState } from "react";
import { X, Upload, CheckCircle2 } from "lucide-react";
import { importWebRoczPvtSaleReport, type PvtImportResult } from "@/app/webrocz-pvt-actions";
import { getPaymentCollectors, type Collector } from "@/app/payments-actions";

// "Import" on the Web Rocz Pvt Ltd hub: upload the sale report (CSV) to add previous
// invoices with their own invoice numbers, dates, parties, GSTINs, totals and received
// amounts. Kept in its own file so the Web Solutions / Web Rocz import is never affected.
export default function ImportWebRoczPvtSaleReportModal({ close }: { close: () => void }) {
  const [result, action, pending] = useActionState<PvtImportResult, FormData>(importWebRoczPvtSaleReport, null);
  const done = result?.ok;
  // Who collected the payments in the file — the accountant by default.
  const [people, setPeople] = useState<Collector[]>([]);
  const [collectedBy, setCollectedBy] = useState("");
  useEffect(() => {
    let alive = true;
    getPaymentCollectors().then((d) => { if (!alive) return; setPeople(d); setCollectedBy((cur) => cur || d[0]?.name || ""); }).catch(() => { /* falls back to the person importing */ });
    return () => { alive = false; };
  }, []);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex w-full max-w-[500px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Import sale report · Web Rocz Pvt Ltd</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Add previous invoices from the sale report (CSV).</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>

        {done ? (
          <div className="space-y-3 px-6 py-5">
            <p className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-[var(--emerald)]" style={{ background: "color-mix(in srgb, var(--emerald) 8%, white)" }}><CheckCircle2 size={16} className="mt-0.5 flex-none" /> {result?.message}</p>
            <ul className="space-y-1 text-[12.5px] text-[var(--ink-2)]">{(result?.details ?? []).map((d) => <li key={d}>• {d}</li>)}</ul>
            <div className="flex justify-end"><button type="button" onClick={() => { close(); window.location.reload(); }} className="btn btn-violet">Done</button></div>
          </div>
        ) : (
          <form action={action} className="space-y-3 px-6 py-5">
            <label className="block">
              <span className="eyebrow">Sale report file (CSV)</span>
              <input name="file" type="file" accept=".csv,text/csv" required className="input mt-1 !py-1.5 text-[12px]" />
            </label>
            <label className="block">
              <span className="eyebrow">Payments collected by</span>
              <select name="collectedBy" value={collectedBy} onChange={(e) => setCollectedBy(e.target.value)} className="select mt-1">
                {people.length === 0 && <option value="">Me</option>}
                {people.map((p) => <option key={p.name} value={p.name}>{p.name}{p.role === "ACCOUNTANT" ? " — Accountant" : ""}</option>)}
              </select>
              <span className="mt-1.5 block text-[11px] text-[var(--faint)]">The received amounts in the file show under this name on the Payments page.</span>
            </label>
            <div className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2.5 text-[11.5px] leading-relaxed text-[var(--muted)]">
              Columns: <b>Date, Invoice No, Party Name, GSTIN, Phone, Total, Received, Payment Type</b>.<br />
              Each row becomes one Web Rocz Pvt Ltd invoice with the same invoice number. Total is taken as including GST 18%. A party that is not a client yet is created. Uploading the same file again adds nothing twice.
            </div>
            {result && !result.ok && <p className="rounded-[10px] px-3 py-2 text-[12.5px] font-semibold text-[var(--rose)]" style={{ background: "color-mix(in srgb, var(--rose) 8%, white)" }}>{result.message}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
              <button type="submit" disabled={pending} className="btn btn-violet disabled:opacity-60"><Upload size={15} /> {pending ? "Importing…" : "Import invoices"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
