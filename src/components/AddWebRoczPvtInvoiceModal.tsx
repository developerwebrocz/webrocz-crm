"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { addInvoice } from "@/app/sales-actions";
import { WEB_ROCZ_CLIENT_SERVICES } from "@/lib/webrocz-services";

// Web Rocz Pvt Ltd (digital marketing, GST 18%) invoice — tick the services, enter their
// amounts before GST; GST and the total are worked out below. Website services (Domain /
// Hosting + SSL / Website Designing) and the website-renewal block are not offered here.
// Kept in its own file so the Web Solutions and Web Rocz invoice forms are never affected.
const PVT_SERVICES = WEB_ROCZ_CLIENT_SERVICES.map((x) => x.name);
const GST_PCT = 18;
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");

export default function AddWebRoczPvtInvoiceModal({ clientNames, close, returnTo = "/invoices" }: { clientNames: string[]; close: () => void; returnTo?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [svc, setSvc] = useState<Record<string, { on: boolean; amount: string }>>({});
  const [customs, setCustoms] = useState<{ name: string; amount: string }[]>([]);
  const setSvcOn = (k: string, on: boolean) => setSvc((p) => ({ ...p, [k]: { on, amount: p[k]?.amount ?? "" } }));
  const setSvcAmt = (k: string, amount: string) => setSvc((p) => ({ ...p, [k]: { on: p[k]?.on ?? true, amount } }));
  const lineItems = [
    ...PVT_SERVICES.filter((k) => svc[k]?.on).map((k) => ({ name: k, qty: 1, rate: Number(svc[k].amount || 0), amount: Number(svc[k].amount || 0) })),
    ...customs.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), qty: 1, rate: Number(c.amount || 0), amount: Number(c.amount || 0) })),
  ];
  const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const gstAmount = Math.round((subtotal * GST_PCT) / 100);
  const [err, setErr] = useState("");
  // The button stays clickable; what is missing is explained instead of silently blocking.
  const problem = lineItems.length === 0 ? "Tick at least one service and enter its amount." : subtotal <= 0 ? "Enter the amount beside the ticked service." : "";
  const check = (e: React.SyntheticEvent) => { if (problem) e.preventDefault(); setErr(problem); };
  const missing = (amount: string) => (err && Number(amount || 0) <= 0 ? " !border-[var(--rose)]" : "");
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Add new invoice · Web Rocz Pvt Ltd</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Digital marketing tax invoice · With GST {GST_PCT}%</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={addInvoice} className="space-y-3 overflow-y-auto scroll-thin px-6 py-4">
          <input type="hidden" name="return" value={returnTo} />
          <input type="hidden" name="category" value="DM" />
          <input type="hidden" name="gst" value="1" />
          <input type="hidden" name="amount" value={String(subtotal)} />
          <input type="hidden" name="items" value={JSON.stringify(lineItems)} />
          {lineItems.map((li, i) => <input key={i} type="hidden" name="services" value={li.name} />)}
          <datalist id="webrocz-pvt-inv-client-names">{clientNames.map((nm) => <option key={nm} value={nm} />)}</datalist>

          <label className="block"><span className="eyebrow">Invoice date</span><input name="issueDate" type="date" defaultValue={today} className="input mt-1" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Company name</span><input name="clientName" required list="webrocz-pvt-inv-client-names" className="input mt-1" placeholder="Company / client" /></label>
            <label className="block"><span className="eyebrow">Domain name</span><input name="domain" className="input mt-1" placeholder="e.g. acme.com" /></label>
          </div>
          <label className="block"><span className="eyebrow">Client GSTIN</span><input name="gstin" className="input mt-1 uppercase" placeholder="e.g. 36AABCU9603R1ZM" /><span className="mt-1 block text-[11px] text-[var(--faint)]">Sets the place of supply (CGST/SGST vs IGST) on the tax invoice.</span></label>

          <div>
            <span className="eyebrow">Services &amp; amounts (before GST)</span>
            <div className="mt-1.5 space-y-2 rounded-[10px] border border-[var(--line)] p-3">
              {PVT_SERVICES.map((sv) => (
                <div key={sv} className="flex items-center gap-2">
                  <label className="flex flex-1 items-center gap-2 text-[13px] font-medium"><input type="checkbox" checked={svc[sv]?.on || false} onChange={(e) => { setSvcOn(sv, e.target.checked); setErr(""); }} className="h-4 w-4 accent-[var(--violet)]" /> {sv}</label>
                  {svc[sv]?.on && <input type="number" min={0} autoFocus value={svc[sv].amount} onChange={(e) => { setSvcAmt(sv, e.target.value); setErr(""); }} className={"input !w-32 !py-1.5" + missing(svc[sv].amount)} placeholder="₹ amount" />}
                </div>
              ))}
              {customs.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={c.name} onChange={(e) => setCustoms((cs) => cs.map((v, j) => (j === i ? { ...v, name: e.target.value } : v)))} className="input flex-1" placeholder="Custom service" />
                  <input type="number" min={0} value={c.amount} onChange={(e) => { setCustoms((cs) => cs.map((v, j) => (j === i ? { ...v, amount: e.target.value } : v))); setErr(""); }} className={"input !w-32 !py-1.5" + (c.name.trim() ? missing(c.amount) : "")} placeholder="₹ amount" />
                  <button type="button" onClick={() => setCustoms((cs) => cs.filter((_, j) => j !== i))} title="Remove" className="grid h-8 w-8 flex-none place-items-center rounded-[8px] border border-[var(--line-2)] text-[var(--rose)] hover:bg-[color-mix(in_srgb,var(--rose)_10%,white)]"><X size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setCustoms((cs) => [...cs, { name: "", amount: "" }])} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--violet)] hover:underline"><Plus size={13} /> Add service</button>
            </div>
          </div>

          <div className="rounded-[12px] border border-[var(--line-2)] px-4 py-3" style={{ background: "color-mix(in srgb, var(--violet) 6%, white)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Subtotal</span>
              <span className="text-[15px] font-extrabold tnum text-[var(--ink)]">{inr(subtotal)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[12px] text-[var(--muted)]"><span>GST {GST_PCT}%</span><span className="tnum">{inr(gstAmount)}</span></div>
            <div className="mt-1.5 flex items-center justify-between border-t border-[var(--line)] pt-1.5"><span className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Total (incl. GST)</span><span className="text-[22px] font-extrabold tnum text-[var(--violet)]">{inr(subtotal + gstAmount)}</span></div>
          </div>

          <div className="rounded-[12px] border border-[var(--line)] p-3.5">
            <span className="eyebrow">Payment</span>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="block"><span className="text-[11.5px] font-medium text-[var(--muted)]">Amount received (₹)</span><input name="received" type="number" min={0} className="input mt-1" placeholder="0" /></label>
              <label className="block"><span className="text-[11.5px] font-medium text-[var(--muted)]">Payment screenshot</span><input name="paymentProof" type="file" accept="image/*,.pdf" className="input mt-1 !py-1.5 text-[12px]" /></label>
            </div>
            <span className="mt-1.5 block text-[11px] text-[var(--faint)]">Optional — attach the UPI / bank payment proof.</span>
          </div>

          <div className="rounded-[12px] border border-[var(--line)] p-3.5">
            <span className="eyebrow">Invoice document (optional)</span>
            <input name="invoiceDoc" type="file" accept="image/*,.pdf" className="input mt-2 !py-1.5 text-[12px]" />
            <span className="mt-1.5 block text-[11px] text-[var(--faint)]">Attach the signed / printed invoice (PDF / image) — shows a View link in the invoices list.</span>
          </div>

          <label className="block"><span className="eyebrow">Description (optional)</span><input name="desc" className="input mt-1" placeholder="optional notes" /></label>
          <p className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2 text-[11.5px] text-[var(--muted)]">→ <b>Web Rocz Pvt Ltd</b> · GST serial series</p>

          {err && <p className="rounded-[10px] px-3 py-2 text-[12.5px] font-semibold text-[var(--rose)]" style={{ background: "color-mix(in srgb, var(--rose) 8%, white)" }}>{err}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
            <button type="submit" onClick={check} className="btn btn-violet"><Plus size={15} /> Create invoice</button>
          </div>
        </form>
      </div>
    </div>
  );
}
