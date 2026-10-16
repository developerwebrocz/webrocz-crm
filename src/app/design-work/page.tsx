import { redirect } from "next/navigation";

// "Designer Work" now lives on Design Count (the simple sheet at the top); old links land there.
export default async function DesignWorkPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  if (typeof sp.designer === "string") p.set("designer", sp.designer);
  if (typeof sp.period === "string" && ["today", "yesterday", "week", "month"].includes(sp.period)) p.set("period", sp.period);
  redirect(`/design-team${p.toString() ? `?${p.toString()}` : ""}`);
}
