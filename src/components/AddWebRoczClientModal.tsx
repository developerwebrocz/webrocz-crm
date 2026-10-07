"use client";

import { X, UserPlus } from "lucide-react";
import { addClientFromFinance } from "@/app/actions";
import WebRoczServicePicker from "@/components/WebRoczServicePicker";
import WebRoczPaymentType from "@/components/WebRoczPaymentType";
import WebRoczAccountManagerSelect from "@/components/WebRoczAccountManager";

// Web Rocz (digital marketing, non-GST) "Add client" form. Kept in its own file so the
// Web Solutions add-client form (AddClientModal in FinanceClients) is never affected.
export default function AddWebRoczClientModal({ close }: { close: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Add Web Rocz client</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Digital Marketing only · Without GST</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={addClientFromFinance} className="space-y-3 overflow-y-auto scroll-thin px-6 py-5">
          <input type="hidden" name="return" value="/pipeline/web-rocz" />
          <input type="hidden" name="gst" value="0" />
          <input type="hidden" name="billingCompany" value="WEB_ROCZ" />

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
            <label className="block"><span className="eyebrow">Invoice date</span><select name="billingDay" defaultValue="0" className="select mt-1"><option value="0">Not set</option>{[1, 5, 10, 15, 20, 25].map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
          </div>
          <label className="block">
            <span className="eyebrow">Upload SLA (optional)</span>
            <input name="slaFile" type="file" accept="image/*,.pdf,.doc,.docx" className="input mt-1 !py-1.5 text-[12px]" />
            <span className="mt-1.5 block text-[11px] text-[var(--faint)]">PDF / image — shows in the company hub with a Download link.</span>
          </label>

          <WebRoczPaymentType />

          <WebRoczServicePicker />

          <div className="rounded-[10px] border border-[var(--line)] p-3">
            <label className="block"><span className="text-[12px] font-semibold text-[var(--magenta)]">Digital Marketing (₹)</span><input name="dmAmount" type="number" min={0} defaultValue={0} className="input mt-1" placeholder="0" /></label>
            <label className="mt-3 block"><span className="eyebrow">Amount already paid (₹)</span><input name="paid" type="number" min={0} defaultValue={0} className="input mt-1" placeholder="0" /></label>
            <p className="mt-2 text-[11.5px] text-[var(--faint)]">The amount creates one Web Rocz invoice for this client.</p>
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
