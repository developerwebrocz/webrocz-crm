import type { CSSProperties } from "react";

// Clients whose payments Rajesh Sir (Super Admin) follows up ("Follow-up payment by"):
// a light gold row and a small tag, so the accountants and Sir can tell them apart in the lists.
export const SIR_ROW: CSSProperties = { background: "color-mix(in srgb, var(--amber) 13%, white)", boxShadow: "inset 3px 0 0 var(--amber)" };

// list order: Rajesh Sir's clients first, then the Accountant's, then the rest
export const followupRank = (by?: string | null) => (by === "Rajesh Sir" ? 0 : by === "Accountant" ? 1 : 2);

export function SirTag() {
  return <span className="ml-1.5 inline-block whitespace-nowrap rounded-full bg-[color-mix(in_srgb,var(--amber)_22%,white)] px-1.5 py-px align-middle text-[10px] font-bold text-[#8a5a00]">Rajesh Sir</span>;
}
