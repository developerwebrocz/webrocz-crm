"use client";

import { useState } from "react";
import { X, Plus, UserPlus } from "lucide-react";
import { addClientFromFinance } from "@/app/actions";

// Web Rocz (digital marketing, non-GST) "Add client" form. Kept in its own file so the
// Web Solutions add-client form (AddClientModal in FinanceClients) is never affected.
// `counts` are the monthly quantities asked beside the tick (saved on the client's service).
const WEB_ROCZ_CLIENT_SERVICES: { name: string; counts?: { field: string; label: string }[] }[] = [
  { name: "Meta Ads" },
  { name: "Google Ads" },
  { name: "SEO", counts: [{ field: "seoBlogs", label: "Blogs / month" }, { field: "seoKeywords", label: "Keywords" }] },
  { name: "SMO", counts: [{ field: "smoPosts", label: "Posts / month" }] },
  { name: "GMB" },
  { name: "CRM" },
  { name: "Videoshoot", counts: [{ field: "videoShoots", label: "Shoots / month" }] },
  { name: "AI Reels", counts: [{ field: "aiReels", label: "Reels / month" }] },
];

export default function AddWebRoczClientModal({ close }: { close: () => void }) {
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [customs, setCustoms] = useState<string[]>([]);
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
          {customs.map((c) => c.trim()).filter(Boolean).map((c, i) => <input key={i} type="hidden" name="dmServices" value={c} />)}

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Company name *</span><input name="name" required className="input mt-1" placeholder="Acme Pvt Ltd" /></label>
            <label className="block"><span className="eyebrow">Domain name</span><input name="website" className="input mt-1" placeholder="e.g. acme.com" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Contact person</span><input name="pocName" className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Phone</span><input name="pocMobile" className="input mt-1" /></label>
          </div>
          <label className="block"><span className="eyebrow">Email</span><input name="pocEmail" type="email" className="input mt-1" /></label>
          <label className="block">
            <span className="eyebrow">Upload SLA (optional)</span>
            <input name="slaFile" type="file" accept="image/*,.pdf,.doc,.docx" className="input mt-1 !py-1.5 text-[12px]" />
            <span className="mt-1.5 block text-[11px] text-[var(--faint)]">PDF / image — shows in the company hub with a Download link.</span>
          </label>

          <div>
            <span className="eyebrow">Digital Marketing services</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {WEB_ROCZ_CLIENT_SERVICES.map((sv) => {
                const active = on[sv.name] || false;
                return (
                  <div key={sv.name} className={`flex min-h-[44px] items-center gap-2 rounded-[10px] border px-3 py-1.5 transition-colors ${sv.counts ? "col-span-2" : ""}`} style={active ? { borderColor: "var(--magenta)", background: "color-mix(in srgb, var(--magenta) 5%, white)" } : { borderColor: "var(--line-2)" }}>
                    <label className="flex flex-1 cursor-pointer items-center gap-2 text-[13px] font-semibold"><input type="checkbox" name="dmServices" value={sv.name} checked={active} onChange={(e) => setOn((p) => ({ ...p, [sv.name]: e.target.checked }))} className="h-4 w-4 accent-[var(--magenta)]" /> {sv.name}</label>
                    {sv.counts && (active
                      ? sv.counts.map((c, ci) => <label key={c.field} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--muted)]">{c.label}<input name={c.field} type="number" min={0} autoFocus={ci === 0} className="input !w-[68px] !py-1.5" placeholder="0" /></label>)
                      : <span className="text-[11.5px] text-[var(--faint)]">{sv.counts.map((c) => c.label).join(" · ")}</span>)}
                  </div>
                );
              })}
              {customs.map((c, i) => (
                <div key={i} className="col-span-2 flex items-center gap-2">
                  <input value={c} onChange={(e) => setCustoms((cs) => cs.map((v, j) => (j === i ? e.target.value : v)))} autoFocus className="input flex-1" placeholder="Other service name" />
                  <button type="button" onClick={() => setCustoms((cs) => cs.filter((_, j) => j !== i))} title="Remove" className="grid h-9 w-9 flex-none place-items-center rounded-[8px] border border-[var(--line-2)] text-[var(--rose)] hover:bg-[color-mix(in_srgb,var(--rose)_10%,white)]"><X size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setCustoms((cs) => [...cs, ""])} className="col-span-2 inline-flex min-h-[40px] items-center justify-center gap-1 rounded-[10px] border border-dashed text-[12.5px] font-semibold text-[var(--magenta)] hover:bg-[var(--surface-2)]" style={{ borderColor: "var(--line-2)" }}><Plus size={13} /> Add service</button>
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--faint)]">Tick the services this client has taken — shown on hover in the clients list.</p>
          </div>

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
