// Web Rocz (digital marketing) services offered in the Web Rocz add / edit client forms.
// Web Solutions has its own website services (Domain / Hosting + SSL / Website Designing)
// and never reads this file.

// `counts` are the monthly quantities asked beside the tick. They are saved as readable
// text on the client's service, e.g. "8 blogs/month · 30 keywords".
export type WebRoczCount = { field: string; label: string; unit: string };
export const WEB_ROCZ_CLIENT_SERVICES: { name: string; counts?: WebRoczCount[] }[] = [
  { name: "Meta Ads" },
  { name: "Google Ads" },
  { name: "SEO", counts: [{ field: "seoBlogs", label: "Blogs / month", unit: "blogs/month" }, { field: "seoKeywords", label: "Keywords", unit: "keywords" }] },
  { name: "SMO", counts: [{ field: "smoPosts", label: "Posts / month", unit: "posts/month" }, { field: "smoAiReels", label: "AI Reels / month", unit: "AI reels/month" }] },
  { name: "Videoshoot", counts: [{ field: "videoShootHours", label: "Shoot hours", unit: "shoot hours" }, { field: "videoReelEdits", label: "Reel edits", unit: "reel edits" }] },
  { name: "GMB" },
  { name: "CRM" },
];

// Website services belong to Web Solutions — never listed or changed by the Web Rocz forms.
export const WEBSITE_ONLY_SERVICES = ["Domain", "Hosting + SSL", "Website Designing"];

// "8 blogs/month · 30 keywords" → 8 for the blogs count, 30 for the keywords count.
export function countFromDetail(detail: string | null | undefined, unit: string): number {
  const m = (detail || "").match(new RegExp(`(\\d+)\\s*${unit.replace("/", "\\/")}`));
  return m ? parseInt(m[1], 10) : 0;
}
export function detailFromCounts(counts: WebRoczCount[], qty: (field: string) => number): string {
  return counts.map((c) => ({ c, q: qty(c.field) })).filter((x) => x.q > 0).map((x) => `${x.q} ${x.c.unit}`).join(" · ");
}

// Services typed with "+ Add service" on the Web Rocz / Web Rocz Pvt Ltd invoice form are
// printed on the invoice as their own lines under "Digital Marketing Services" (without a
// separate price — the invoice amount covers them). The ticked standard services (Meta Ads,
// SEO …) are not printed: they are what "Digital Marketing Services" stands for. A typed name
// that is just another word for that main line ("All DM", "Digital Marketing") is skipped too.
export function invoiceExtraLines(customs: string[]): string[] {
  const standard = new Set(WEB_ROCZ_CLIENT_SERVICES.map((x) => x.name.toLowerCase()));
  const seen = new Set<string>();
  return customs.map((c) => c.trim().replace(/\s+/g, " ")).filter((c) => {
    const k = c.toLowerCase();
    if (!c || standard.has(k) || seen.has(k) || /^(all\s*)?(dm|digital\s+marketing(\s+services?)?)$/i.test(c)) return false;
    seen.add(k);
    return true;
  });
}

// ---- What a Web Rocz / Web Rocz Pvt Ltd invoice prints as its service lines ----
// • services ticked and / or typed with "+ Add service" → exactly those, one line each
//   (the first line carries the invoice amount, the others read "Included");
// • nothing ticked and nothing added → one line, "Digital Marketing Services".
export const DM_LINE = "Digital Marketing Services";
// another way of saying the default line ("Digital Marketing", "All DM") is not a service of its own
const isGenericDm = (name: string) => /^(all\s*)?(dm|digital\s+marketing(\s+services?)?)$/i.test(name.trim());

// Clean list of service names for the invoice: trimmed, no repeats, no "Digital Marketing".
export function invoiceServiceNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names.map((c) => String(c ?? "").trim().replace(/\s+/g, " ")).filter((c) => {
    const k = c.toLowerCase();
    if (!c || seen.has(k) || isGenericDm(c)) return false;
    seen.add(k);
    return true;
  });
}

export type DmInvoiceItem = { name: string; qty: number; rate: number; amount: number; picked?: boolean };
// Lines saved with a new invoice. `picked` on the first line says: these are exactly what was
// chosen on the form (so an invoice saved with nothing chosen keeps "Digital Marketing Services").
export function buildDmInvoiceItems(names: string[], amount: number): DmInvoiceItem[] {
  const list = invoiceServiceNames(names);
  return (list.length ? list : [DM_LINE]).map((name, i) => ({ name, qty: 1, rate: i === 0 ? amount : 0, amount: i === 0 ? amount : 0, ...(i === 0 ? { picked: true } : {}) }));
}

// Lines to print. New invoices print what was saved. Invoices saved before this rule did not
// record the ticked services, so for those: the services named in the saved line, else the
// services saved on the client (what the form had ticked), plus any "+ Add service" lines —
// and "Digital Marketing Services" when there is none. An invoice with its own priced lines
// (itemized / imported) and a Pvt Ltd invoice with a typed description print as saved.
export function dmInvoiceLines(company: string, saved: Partial<DmInvoiceItem>[], subtotal: number, clientServices: string[]): Partial<DmInvoiceItem>[] {
  const rename = (it: Partial<DmInvoiceItem>) => (isGenericDm(String(it?.name ?? "")) ? { ...it, name: DM_LINE } : it);
  if (!saved.length) return [{ name: DM_LINE, qty: 1, rate: subtotal, amount: subtotal }];
  if (saved[0]?.picked) return saved.map(rename);
  const others = saved.slice(1);
  if (others.some((it) => (it?.amount || 0) > 0 || (it?.rate || 0) > 0)) return saved.map(rename);
  const line1 = String(saved[0]?.name ?? "").trim();
  const standard = new Set(WEB_ROCZ_CLIENT_SERVICES.map((x) => x.name.toLowerCase()));
  const parts = line1.split(",").map((x) => x.trim()).filter(Boolean);
  const fromLine = parts.some((x) => standard.has(x.toLowerCase())) ? parts : [];
  if (company === "WEB_ROCZ_PVT" && line1 && !isGenericDm(line1) && !fromLine.length) return saved;
  const names = invoiceServiceNames([...(fromLine.length ? fromLine : clientServices), ...others.map((it) => String(it?.name ?? ""))]);
  return (names.length ? names : [DM_LINE]).map((name, i) => ({ name, qty: 1, rate: i === 0 ? subtotal : 0, amount: i === 0 ? subtotal : 0 }));
}
