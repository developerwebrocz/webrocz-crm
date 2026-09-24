"use client";

import { useSearchParams } from "next/navigation";

export default function AdsDayHeader({
  ams, activeAm, date, locked = false, lockedName = "", basePath = "/ads",
}: {
  ams: { id: string; name: string }[]; activeAm: string; date: string;
  locked?: boolean; lockedName?: string; basePath?: string;
}) {
  const sp = useSearchParams();

  function go(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    params.set(key, value);
    window.location.assign(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date" value={date} onChange={(e) => go("date", e.target.value)}
        className="input !w-auto !py-2 font-semibold"
      />
      {locked ? (
        <span className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface-2)] px-3 py-2 text-[13px] font-semibold">
          <span className="text-[var(--muted)]">AM</span> {lockedName}
        </span>
      ) : (
        <select value={activeAm} onChange={(e) => go("am", e.target.value)} className="select !w-auto !py-2 font-semibold">
          {ams.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}
    </div>
  );
}
