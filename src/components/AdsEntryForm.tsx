"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";

type Opt = { id: string; name: string; code?: string };

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn btn-violet disabled:opacity-60" disabled={pending}>{pending ? "Saving…" : "Save numbers"}</button>;
}

export default function AdsEntryForm({ clients, action, month }: { clients: Opt[]; action: (fd: FormData) => void; month: string }) {
  const [open, setOpen] = useState(false);

  if (!open) return <button onClick={() => setOpen(true)} className="btn btn-dark"><Plus size={15} /> Enter monthly numbers</button>;

  return (
    <div className="card card-pad w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Enter ads numbers · {month}</h2>
        <button onClick={() => setOpen(false)} className="text-[var(--muted)] hover:text-[var(--ink)]"><X size={18} /></button>
      </div>
      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <input type="hidden" name="month" value={month} />
        <label className="block sm:col-span-2 lg:col-span-1">
          <span className="eyebrow">Client *</span>
          <select name="clientId" required className="select mt-1.5" defaultValue="">
            <option value="" disabled>Select client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow">Platform *</span>
          <select name="platform" required className="select mt-1.5" defaultValue="META">
            <option value="META">Meta Ads</option>
            <option value="GOOGLE">Google Ads</option>
          </select>
        </label>
        <label className="block"><span className="eyebrow">Spend (₹)</span><input name="spend" type="number" min={0} className="input mt-1.5" placeholder="0" /></label>
        <label className="block"><span className="eyebrow">Leads</span><input name="leads" type="number" min={0} className="input mt-1.5" placeholder="0" /></label>
        <label className="block"><span className="eyebrow">Clicks</span><input name="clicks" type="number" min={0} className="input mt-1.5" placeholder="0" /></label>
        <label className="block"><span className="eyebrow">Impressions</span><input name="impressions" type="number" min={0} className="input mt-1.5" placeholder="0" /></label>
        <label className="block"><span className="eyebrow">Conversions</span><input name="conversions" type="number" min={0} className="input mt-1.5" placeholder="0" /></label>
        <div className="flex items-end"><Submit /></div>
      </form>
      <p className="mt-2 text-[11px] text-[var(--muted)]">CTR and CPL are calculated automatically. Saving updates the client&apos;s numbers for this month.</p>
    </div>
  );
}
