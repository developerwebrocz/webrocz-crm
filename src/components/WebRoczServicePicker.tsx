"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { WEB_ROCZ_CLIENT_SERVICES, countFromDetail } from "@/lib/webrocz-services";

// Service tiles shared by the Web Rocz add + edit client forms: tick a service, enter its
// monthly counts beside it, or add any other service by name. Posts every picked service
// as `dmServices` and each count under its own field name (seoBlogs, smoPosts, …).
export default function WebRoczServicePicker({ initial = [] }: { initial?: { service: string; detail: string | null }[] }) {
  const fixed = WEB_ROCZ_CLIENT_SERVICES.map((x) => x.name);
  const detailOf = (name: string) => initial.find((x) => x.service === name)?.detail ?? "";
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(initial.filter((x) => fixed.includes(x.service)).map((x) => [x.service, true])));
  const [customs, setCustoms] = useState<string[]>(() => initial.map((x) => x.service).filter((sv) => !fixed.includes(sv)));
  return (
    <div>
      <span className="eyebrow">Digital Marketing services</span>
      {customs.map((c) => c.trim()).filter(Boolean).map((c, i) => <input key={i} type="hidden" name="dmServices" value={c} />)}
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {WEB_ROCZ_CLIENT_SERVICES.map((sv) => {
          const active = on[sv.name] || false;
          return (
            <div key={sv.name} className={`flex min-h-[44px] items-center gap-2 rounded-[10px] border px-3 py-1.5 transition-colors ${sv.counts ? "col-span-2" : ""}`} style={active ? { borderColor: "var(--magenta)", background: "color-mix(in srgb, var(--magenta) 5%, white)" } : { borderColor: "var(--line-2)" }}>
              <label className="flex flex-1 cursor-pointer items-center gap-2 text-[13px] font-semibold"><input type="checkbox" name="dmServices" value={sv.name} checked={active} onChange={(e) => setOn((p) => ({ ...p, [sv.name]: e.target.checked }))} className="h-4 w-4 accent-[var(--magenta)]" /> {sv.name}</label>
              {sv.counts && (active
                ? sv.counts.map((c, ci) => <label key={c.field} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--muted)]">{c.label}<input name={c.field} type="number" min={0} defaultValue={countFromDetail(detailOf(sv.name), c.unit) || ""} autoFocus={ci === 0 && !initial.some((x) => x.service === sv.name)} className="input !w-[68px] !py-1.5" placeholder="0" /></label>)
                : <span className="text-[11.5px] text-[var(--faint)]">{sv.counts.map((c) => c.label).join(" · ")}</span>)}
            </div>
          );
        })}
        {customs.map((c, i) => (
          <div key={i} className="col-span-2 flex items-center gap-2">
            <input value={c} onChange={(e) => setCustoms((cs) => cs.map((v, j) => (j === i ? e.target.value : v)))} className="input flex-1" placeholder="Other service name" />
            <button type="button" onClick={() => setCustoms((cs) => cs.filter((_, j) => j !== i))} title="Remove" className="grid h-9 w-9 flex-none place-items-center rounded-[8px] border border-[var(--line-2)] text-[var(--rose)] hover:bg-[color-mix(in_srgb,var(--rose)_10%,white)]"><X size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={() => setCustoms((cs) => [...cs, ""])} className="col-span-2 inline-flex min-h-[40px] items-center justify-center gap-1 rounded-[10px] border border-dashed text-[12.5px] font-semibold text-[var(--magenta)] hover:bg-[var(--surface-2)]" style={{ borderColor: "var(--line-2)" }}><Plus size={13} /> Add service</button>
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--faint)]">Tick the services this client has taken — shown on hover in the clients list.</p>
    </div>
  );
}
