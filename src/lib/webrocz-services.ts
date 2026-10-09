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
