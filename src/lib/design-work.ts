// Design Count: what a designer did on a day — for which client, what kind of design, how many.
// Saved on the day's count (EditCount.items, JSON); the day's number is the sum of these.
// Plain module (no server-only): used by the forms in the browser and by the server.

export const DESIGN_WORK_TYPES = ["Post", "Carousel", "Story", "Reel cover", "Banner", "Ad creative", "Logo", "Brochure / Flyer", "Other"] as const;
// the video team logs its day the same way (client · kind of video · how many)
export const VIDEO_WORK_TYPES = ["Reel", "Short video", "Intro", "Walkthrough", "Testimonial", "YouTube video", "Ad video", "Podcast", "Other"] as const;
export const workTypesFor = (kind: string): readonly string[] => (kind === "VIDEO" ? VIDEO_WORK_TYPES : DESIGN_WORK_TYPES);

export type DesignWorkItem = { client: string; type: string; count: number };

export function parseDesignItems(json: string | null | undefined): DesignWorkItem[] {
  try {
    const a = JSON.parse(json || "[]");
    if (!Array.isArray(a)) return [];
    return a
      .map((x) => ({ client: String(x?.client ?? "").replace(/\s+/g, " ").trim().slice(0, 160), type: String(x?.type ?? "").trim().slice(0, 40), count: Math.round(Number(x?.count)) }))
      .filter((x) => x.client && Number.isFinite(x.count) && x.count > 0 && x.count <= 200)
      .slice(0, 40);
  } catch { return []; }
}

// The same client's lines together: "Amma Selections — 3 Post, 1 Banner".
export function groupByClient(items: DesignWorkItem[]): { client: string; total: number; parts: string }[] {
  const by = new Map<string, { client: string; total: number; types: Map<string, number> }>();
  for (const it of items) {
    const k = it.client.toLowerCase();
    const g = by.get(k) ?? { client: it.client, total: 0, types: new Map<string, number>() };
    g.total += it.count;
    g.types.set(it.type || "Design", (g.types.get(it.type || "Design") ?? 0) + it.count);
    by.set(k, g);
  }
  return [...by.values()].map((g) => ({ client: g.client, total: g.total, parts: [...g.types.entries()].map(([t, n]) => `${n} ${t}`).join(", ") }));
}

// One line for a tooltip / the note column: "Amma Selections — 3 Post, 1 Banner · Elvo Suites — 2 Post".
export function designItemsLine(items: DesignWorkItem[]): string {
  return groupByClient(items).map((g) => `${g.client} — ${g.parts}`).join(" · ");
}
