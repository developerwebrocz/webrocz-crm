// Shown at once while a page loads after a click in the menu or a list — the sidebar and top
// bar stay, only the page area waits. (Pages are no longer loaded in advance for every link
// on screen, which made the whole CRM slow.)
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 animate-pulse rounded-[10px] bg-[var(--surface-2)]" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-[14px] bg-[var(--surface-2)]" />)}
      </div>
      <div className="h-72 animate-pulse rounded-[14px] bg-[var(--surface-2)]" />
    </div>
  );
}
