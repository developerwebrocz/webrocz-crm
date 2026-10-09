"use client";

import { useEffect, useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import { addInvoice } from "@/app/sales-actions";
import { getWebRoczInvoiceDefaults, type WebRoczInvoiceDefaults } from "@/app/webrocz-actions";
import { WEB_ROCZ_CLIENT_SERVICES } from "@/lib/webrocz-services";

// Web Rocz (digital marketing, non-GST) invoice — billed monthly: tick the services and enter
// one invoice amount. Picking a known company ticks the services chosen for it in Add / Edit
// client. Kept in its own file so the Web Solutions invoice form (AddInvoiceModal) is never
// affected by changes here.
const WEB_ROCZ_SERVICES = WEB_ROCZ_CLIENT_SERVICES.map((x) => x.name);

// `lockClientName` is used from a client's own page. `clientDomains` / `defaultDomain` are
// still accepted from older callers but unused — this form no longer asks for a domain.
type Props = { clientNames: string[]; close: () => void; returnTo?: string; clientDomains?: Record<string, string>; lockClientName?: string; defaultDomain?: string };

export default function AddWebRoczInvoiceModal({ clientNames, close, returnTo = "/invoices", lockClientName }: Props) {
  const [name, setName] = useState(lockClientName ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [customs, setCustoms] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  // Saved services per client (lower-cased name), loaded once when the form opens.
  const [defaults, setDefaults] = useState<WebRoczInvoiceDefaults>({});
  // Once the accountant changes a tick by hand, auto-fill never overwrites it.
  const svcEdited = useRef(false);
  const nameRef = useRef(name);

  const applyClient = (clientName: string, from: WebRoczInvoiceDefaults) => {
    if (svcEdited.current) return;
    const names = (from[clientName.trim().toLowerCase()]?.services ?? []).map((x) => x.service);
    setOn(Object.fromEntries(names.filter((n) => WEB_ROCZ_SERVICES.includes(n)).map((n) => [n, true])));
    setCustoms(names.filter((n) => !WEB_ROCZ_SERVICES.includes(n)));
  };
  useEffect(() => {
    let alive = true;
    getWebRoczInvoiceDefaults().then((d) => { if (!alive) return; setDefaults(d); applyClient(nameRef.current, d); }).catch(() => { /* form still works without auto-fill */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pickName = (v: string) => { setName(v); nameRef.current = v; applyClient(v, defaults); };
  // Monthly counts saved for the picked client (e.g. "8 blogs/month · 25 keywords"), shown beside the service.
  const detailOf = (sv: string) => defaults[name.trim().toLowerCase()]?.services.find((x) => x.service === sv)?.detail ?? "";
  const tick = (sv: string, v: boolean) => { svcEdited.current = true; setOn((p) => ({ ...p, [sv]: v })); };
  const editCustoms = (fn: (cs: string[]) => string[]) => { svcEdited.current = true; setCustoms(fn); };

  // The invoice itself always carries one "Digital Marketing" line for the full amount; the
  // ticks only show which services this client takes.
  const picked = [...WEB_ROCZ_SERVICES.filter((k) => on[k]), ...customs.map((c) => c.trim()).filter(Boolean)];
  const total = Math.max(0, Number(amount) || 0);
  const [err, setErr] = useState("");
  // The button stays clickable; what is missing is explained instead of silently blocking.
  const problem = total <= 0 ? "Enter the invoice amount." : "";
  const check = (e: React.SyntheticEvent) => { if (problem) e.preventDefault(); setErr(problem); };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Add new invoice · Web Rocz</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Monthly digital marketing invoice · Without GST</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={addInvoice} className="space-y-3 overflow-y-auto scroll-thin px-6 py-4">
          <input type="hidden" name="return" value={returnTo} />
          <input type="hidden" name="category" value="DM" />
          <input type="hidden" name="gst" value="0" />
          <input type="hidden" name="items" value={JSON.stringify([{ name: "Digital Marketing Services", qty: 1, rate: total, amount: total }])} />
          {picked.map((sv, i) => <input key={i} type="hidden" name="services" value={sv} />)}
          <datalist id="webrocz-inv-client-names">{clientNames.map((nm) => <option key={nm} value={nm} />)}</datalist>

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Invoice date</span><input name="issueDate" type="date" defaultValue={today} className="input mt-1" /></label>
            <label className="block"><span className="eyebrow">Company name</span><input name="clientName" required list="webrocz-inv-client-names" value={name} onChange={(e) => pickName(e.target.value)} readOnly={!!lockClientName} className={"input mt-1" + (lockClientName ? " bg-[var(--surface-2)]" : "")} placeholder="Company / client" /></label>
          </div>

          <div>
            <span className="eyebrow">Services</span>
            <div className="mt-1.5 space-y-2 rounded-[10px] border border-[var(--line)] p-3">
              {WEB_ROCZ_SERVICES.map((sv) => (
                <label key={sv} className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
                  <input type="checkbox" checked={on[sv] || false} onChange={(e) => { tick(sv, e.target.checked); setErr(""); }} className="h-4 w-4 accent-[var(--violet)]" /> {sv}
                  {on[sv] && detailOf(sv) ? <span className="text-[11px] font-normal text-[var(--muted)]">· {detailOf(sv)}</span> : null}
                </label>
              ))}
              {customs.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={c} onChange={(e) => { editCustoms((cs) => cs.map((v, j) => (j === i ? e.target.value : v))); setErr(""); }} className="input flex-1" placeholder="Other service" />
                  <button type="button" onClick={() => editCustoms((cs) => cs.filter((_, j) => j !== i))} title="Remove" className="grid h-8 w-8 flex-none place-items-center rounded-[8px] border border-[var(--line-2)] text-[var(--rose)] hover:bg-[color-mix(in_srgb,var(--rose)_10%,white)]"><X size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => editCustoms((cs) => [...cs, ""])} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--violet)] hover:underline"><Plus size={13} /> Add service</button>
            </div>
          </div>

          <label className="block rounded-[12px] border border-[var(--line-2)] px-4 py-3" style={{ background: "color-mix(in srgb, var(--violet) 6%, white)" }}>
            <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Invoice amount (₹)</span>
            <input name="amount" type="number" min={0} value={amount} onChange={(e) => { setAmount(e.target.value); setErr(""); }} className={"input mt-1.5 !text-[18px] !font-extrabold tnum" + (err && total <= 0 ? " !border-[var(--rose)]" : "")} placeholder="0" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Amount received (optional)</span><input name="received" type="number" min={0} className="input mt-1" placeholder="0" /></label>
            <label className="block"><span className="eyebrow">Due date (optional)</span><input name="dueDate" type="date" className="input mt-1" /></label>
          </div>
          <label className="block"><span className="eyebrow">Description (optional)</span><input name="desc" className="input mt-1" placeholder="optional notes" /></label>
          <p className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2 text-[11.5px] text-[var(--muted)]">→ <b>Web Rocz</b> · Non-GST serial series</p>

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
