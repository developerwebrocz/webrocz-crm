"use client";

import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { addClientFromFinance } from "@/app/actions";
import WebRoczServicePicker from "@/components/WebRoczServicePicker";
import WebRoczPaymentType from "@/components/WebRoczPaymentType";
import WebRoczAccountManagerSelect from "@/components/WebRoczAccountManager";

// Web Rocz Pvt Ltd (digital marketing, GST 18%) "Add client" form. Kept in its own file so
// the Web Rocz and Web Solutions add-client forms are never affected. Website services
// (Domain / Hosting + SSL / Website Designing) are deliberately not offered here.
const GST_PCT = 18;
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");

export default function AddWebRoczPvtClientModal({ close }: { close: () => void }) {
  const [amount, setAmount] = useState("");
  const base = Math.max(0, Number(amount) || 0);
  const gstAmount = Math.round((base * GST_PCT) / 100);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Add Web Rocz Pvt Ltd client</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Digital Marketing · With GST {GST_PCT}%</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={addClientFromFinance} className="space-y-3 overflow-y-auto scroll-thin px-6 py-5">
          <input type="hidden" name="return" value="/pipeline/web-rocz-pvt" />
          <input type="hidden" name="gst" value={GST_PCT} />
          <input type="hidden" name="billingCompany" value="WEB_ROCZ_PVT" />

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Company name *</span><input name="name" required className="input mt-1" placeholder="Acme Pvt Ltd" /></label>
            <label className="block"><span className="eyebrow">Account manager</span><WebRoczAccountManagerSelect /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Contact person</span><input name="pocName" className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Phone</span><input name="pocMobile" className="input mt-1" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Email</span><input name="pocEmail" type="email" className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Invoice date</span><select name="billingDay" defaultValue="0" className="select mt-1"><option value="0">Not set</option>{Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
          </div>
          <label className="block">
            <span className="eyebrow">Upload SLA (optional)</span>
            <input name="slaFile" type="file" accept="image/*,.pdf,.doc,.docx" className="input mt-1 !py-1.5 text-[12px]" />
            <span className="mt-1.5 block text-[11px] text-[var(--faint)]">PDF / image — shows in the company hub with a Download link.</span>
          </label>
          <label className="block"><span className="eyebrow">Client GSTIN</span><input name="gstin" className="input mt-1 uppercase" placeholder="e.g. 36AABC…" /></label>

          <WebRoczPaymentType />

          <WebRoczServicePicker />

          <div className="rounded-[10px] border border-[var(--line)] p-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-[12px] font-semibold text-[var(--magenta)]">Digital Marketing (₹) <span className="font-normal text-[var(--faint)]">before GST</span></span><input name="dmAmount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="input mt-1" placeholder="0" /></label>
              <label className="block"><span className="eyebrow">Amount already paid (₹)</span><input name="paid" type="number" min={0} defaultValue={0} className="input mt-1" placeholder="0" /></label>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-[10px] px-3.5 py-2.5" style={{ background: "color-mix(in srgb, var(--violet) 6%, white)" }}>
              <span className="text-[11.5px] font-semibold text-[var(--muted)]">GST {GST_PCT}% <span className="tnum text-[var(--ink-2)]">{inr(gstAmount)}</span></span>
              <span className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--muted)]">Total with GST <span className="ml-1 text-[18px] font-extrabold normal-case tnum text-[var(--violet)]">{inr(base + gstAmount)}</span></span>
            </div>
            <p className="mt-2 text-[11.5px] text-[var(--faint)]">The amount creates one Web Rocz Pvt Ltd GST invoice for this client.</p>
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
