"use client";

import { useEffect, useState } from "react";

// A page that was opened before a new version went live can still hold the old version's
// buttons and scripts. Its next click then fails with "Server Action … was not found on the
// server" (or a script chunk fails to load). That is not a real error — the page only needs
// the new version — so it is refreshed by itself, once.
const STALE = /was not found on the server|Failed to find Server Action|ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i;
const FLAG = "wr-stale-reload";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = STALE.test(`${error?.name ?? ""} ${error?.message ?? ""}`);
  const [refreshing, setRefreshing] = useState(stale);

  useEffect(() => {
    if (!stale) return;
    let last = 0;
    try { last = Number(sessionStorage.getItem(FLAG) || 0); } catch { /* storage blocked — still reload once below */ }
    // refresh by itself, but never in a loop: at most once every 30 seconds
    if (Date.now() - last > 30_000) {
      try { sessionStorage.setItem(FLAG, String(Date.now())); } catch { /* ignore */ }
      window.location.reload();
      return;
    }
    const t = setTimeout(() => setRefreshing(false), 0); // already refreshed just now — show the button instead
    return () => clearTimeout(t);
  }, [stale]);

  if (stale) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--violet)_12%,white)] text-2xl">↻</div>
        <h1 className="mt-4 text-xl font-bold">{refreshing ? "Updating to the latest version…" : "A new version is ready"}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{refreshing ? "The CRM was just updated. This page is refreshing by itself." : "The CRM was updated while this page was open. Refresh to continue — then do the last step again."}</p>
        {!refreshing && <button onClick={() => window.location.reload()} className="btn btn-dark mt-5">Refresh page</button>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--rose)_12%,white)] text-2xl">⚠</div>
      <h1 className="mt-4 text-xl font-bold">Something went wrong</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">{error.message || "An unexpected error occurred while loading this page."}</p>
      <button onClick={reset} className="btn btn-dark mt-5">Try again</button>
    </div>
  );
}
