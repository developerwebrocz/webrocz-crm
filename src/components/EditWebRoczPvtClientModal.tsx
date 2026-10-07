"use client";

import { X, Pencil } from "lucide-react";
import { updateWebRoczPvtClient } from "@/app/webrocz-pvt-actions";
import WebRoczServicePicker from "@/components/WebRoczServicePicker";
import WebRoczPaymentType from "@/components/WebRoczPaymentType";
import WebRoczAccountManagerSelect from "@/components/WebRoczAccountManager";

// Web Rocz Pvt Ltd (digital marketing, GST 18%) "Edit client" form — same fields as its
// add-client form: details, client GSTIN and the digital-marketing services. Domain / hosting
// amounts and renewal dates are not shown. Kept in its own file so the Web Rocz and Web
// Solutions edit forms are never affected.
type EditClient = { id: string; code: string; name: string; accountManagerId: string | null; pocName: string | null; pocMobile: string | null; pocEmail: string | null; status: string; notes: string | null; gstin: string; paymentTerm?: string; billingDay?: number };

export default function EditWebRoczPvtClientModal({ client, services, close }: { client: EditClient; services: { service: string; detail: string | null }[]; close: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Edit Web Rocz Pvt Ltd client</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{client.code} · Digital Marketing · With GST 18%</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={updateWebRoczPvtClient} className="space-y-3 overflow-y-auto scroll-thin px-6 py-5">
          <input type="hidden" name="id" value={client.id} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Company name *</span><input name="name" required defaultValue={client.name} className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Account manager</span><WebRoczAccountManagerSelect defaultValue={client.accountManagerId ?? ""} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Contact person</span><input name="pocName" defaultValue={client.pocName ?? ""} className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Phone</span><input name="pocMobile" defaultValue={client.pocMobile ?? ""} className="input mt-1" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Email</span><input name="pocEmail" type="email" defaultValue={client.pocEmail ?? ""} className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Status</span><select name="status" defaultValue={client.status} className="select mt-1"><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="UPCOMING">Upcoming</option></select></label>
          </div>
          <label className="block">
            <span className="eyebrow">Client GSTIN</span>
            <input name="gstin" defaultValue={client.gstin ?? ""} className="input mt-1 uppercase" placeholder="e.g. 36AABC…" />
            <span className="mt-1.5 block text-[11px] text-[var(--faint)]">Used on this client&apos;s GST tax invoices.</span>
          </label>

          <label className="block">
            <span className="eyebrow">Invoice date</span>
            <select name="billingDay" defaultValue={String(client.billingDay ?? 0)} className="select mt-1"><option value="0">Not set</option>{[...new Set([1, 5, 10, 15, 20, 25, ...(client.billingDay ? [client.billingDay] : [])])].sort((a, b) => a - b).map((d) => <option key={d} value={d}>{d}</option>)}</select>
            <span className="mt-1.5 block text-[11px] text-[var(--faint)]">The day of the month this client&apos;s invoice is raised (1, 5, 10, 15, 20 or 25).</span>
          </label>

          <WebRoczPaymentType initial={client.paymentTerm ?? ""} />

          <WebRoczServicePicker initial={services} />

          <label className="block"><span className="eyebrow">Notes</span><textarea name="notes" rows={2} defaultValue={client.notes ?? ""} className="input mt-1" placeholder="optional" /></label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-violet"><Pencil size={15} /> Save changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
