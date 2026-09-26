"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { addInvoice } from "@/app/sales-actions";

// Create a brand-new invoice. Client is typed (matches an existing client or creates one);
// GST + service pick the billing entity & serial series. When `lockCompany` is set (opened
// from inside a company hub), the service / GST are fixed to that entity.
export default function AddInvoiceModal({ clientNames, close, returnTo = "/invoices", lockCompany }: { clientNames: string[]; close: () => void; returnTo?: string; lockCompany?: string }) {
  const [category, setCategory] = useState(lockCompany === "WEB_ROCZ" ? "DM" : "WEBSITE");
  const [gst, setGst] = useState(lockCompany === "WEB_ROCZ_PVT");
  const lockGst = !!lockCompany;                    // every company fixes its GST flag
  const lockCat = lockCompany === "WEB_SOLUTIONS" || lockCompany === "WEB_ROCZ"; // Pvt Ltd does both services
  const target = gst ? "Web Rocz Pvt Ltd" : category === "DM" ? "Web Rocz" : "Web Solutions";
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Add new invoice{lockCompany ? ` · ${target}` : ""}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Type the client name — an existing client is reused, a new name creates one. Company &amp; serial follow GST + service.</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={addInvoice} className="space-y-3 overflow-y-auto scroll-thin px-6 py-4">
          <input type="hidden" name="return" value={returnTo} />
          <label className="block">
            <span className="eyebrow">Client / company name</span>
            <input name="clientName" required list="inv-client-names" className="input mt-1" placeholder="Type the client / company name" />
            <datalist id="inv-client-names">{clientNames.map((nm) => <option key={nm} value={nm} />)}</datalist>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Service</span>
              {lockCat
                ? <><input type="hidden" name="category" value={category} /><div className="input mt-1 flex items-center bg-[var(--surface-2)] text-[var(--muted)]">{category === "DM" ? "Digital Marketing" : "Website"}</div></>
                : <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="select mt-1">
                    <option value="WEBSITE">Website</option>
                    <option value="DM">Digital Marketing</option>
                  </select>}
            </label>
            <label className="block"><span className="eyebrow">GST</span>
              {lockGst
                ? <><input type="hidden" name="gst" value={gst ? "1" : "0"} /><div className="input mt-1 flex items-center bg-[var(--surface-2)] text-[var(--muted)]">{gst ? "With GST (18%)" : "Without GST"}</div></>
                : <select name="gst" value={gst ? "1" : "0"} onChange={(e) => setGst(e.target.value === "1")} className="select mt-1">
                    <option value="0">Without GST</option>
                    <option value="1">With GST (18%)</option>
                  </select>}
            </label>
          </div>
          {gst && <label className="block"><span className="eyebrow">Client GSTIN</span><input name="gstin" className="input mt-1" placeholder="e.g. 36AABCU9603R1ZM" /><span className="mt-1 block text-[11px] text-[var(--faint)]">Sets the place of supply (CGST/SGST vs IGST) on the tax invoice.</span></label>}
          <label className="block"><span className="eyebrow">Description (optional)</span><input name="desc" className="input mt-1" placeholder={category === "DM" ? "Digital Marketing" : "Website Development"} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Amount (before GST)</span><input name="amount" type="number" min={1} required className="input mt-1" placeholder="e.g. 50000" /></label>
            <label className="block"><span className="eyebrow">Amount received (optional)</span><input name="received" type="number" min={0} className="input mt-1" placeholder="0" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Invoice date</span><input name="issueDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Due date (optional)</span><input name="dueDate" type="date" className="input mt-1" /></label>
          </div>
          <p className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2 text-[11.5px] text-[var(--muted)]">
            → <b>{target}</b> · {gst ? "GST" : "Non-GST"} serial series
          </p>
          <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={close} className="btn btn-ghost">Cancel</button><button type="submit" className="btn btn-violet"><Plus size={15} /> Create invoice</button></div>
        </form>
      </div>
    </div>
  );
}
