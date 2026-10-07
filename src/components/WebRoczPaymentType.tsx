"use client";

import { useState } from "react";

// Payment type tick boxes (Prepayment / Post payment) for the Web Rocz and Web Rocz Pvt Ltd
// Add / Edit client forms. Only one can be ticked; it posts as `paymentTerm`
// (PREPAID | POSTPAID | "" when neither is ticked).
const TERMS = [
  { k: "PREPAID", label: "Prepayment", hint: "Paid before the work" },
  { k: "POSTPAID", label: "Post payment", hint: "Paid after the work" },
];

export default function WebRoczPaymentType({ initial = "" }: { initial?: string }) {
  const [term, setTerm] = useState(initial);
  return (
    <div>
      <span className="eyebrow">Payment type</span>
      <input type="hidden" name="paymentTerm" value={term} />
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {TERMS.map((t) => {
          const active = term === t.k;
          return (
            <label key={t.k} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-1.5" style={active ? { borderColor: "var(--violet)", background: "color-mix(in srgb, var(--violet) 5%, white)" } : { borderColor: "var(--line-2)" }}>
              <input type="checkbox" checked={active} onChange={(e) => setTerm(e.target.checked ? t.k : "")} className="h-4 w-4 accent-[var(--violet)]" />
              <span><span className="block text-[13px] font-semibold">{t.label}</span><span className="block text-[11px] text-[var(--faint)]">{t.hint}</span></span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
