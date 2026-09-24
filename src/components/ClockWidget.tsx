"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Play, Square } from "lucide-react";

function fmt(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Btn({ on }: { on: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition disabled:opacity-60 ${on ? "bg-[color-mix(in_srgb,var(--rose)_12%,white)] text-[var(--rose)] hover:bg-[color-mix(in_srgb,var(--rose)_18%,white)]" : "bg-[var(--violet)] text-white hover:bg-[var(--indigo)]"}`}
    >
      {on ? <><Square size={13} /> Clock out</> : <><Play size={13} /> Clock in</>}
    </button>
  );
}

export default function ClockWidget({
  startedAt, todaySeconds, clockInAction, clockOutAction,
}: {
  startedAt: string | null; todaySeconds: number;
  clockInAction: () => void; clockOutAction: () => void;
}) {
  const running = !!startedAt;
  const [elapsed, setElapsed] = useState(todaySeconds);

  useEffect(() => {
    if (!running || !startedAt) { setElapsed(todaySeconds); return; }
    const startMs = new Date(startedAt).getTime();
    const base = todaySeconds - Math.round((Date.now() - startMs) / 1000); // today minus current run, so we can re-add live
    const tick = () => setElapsed(Math.max(0, base + Math.round((Date.now() - startMs) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [running, startedAt, todaySeconds]);

  return (
    <div className="hidden items-center gap-2.5 rounded-full border border-[var(--line-2)] bg-[var(--surface-2)] py-1 pl-3 pr-1 md:flex">
      <span className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${running ? "bg-[var(--emerald)] animate-pulse" : "bg-[var(--faint)]"}`} />
        <span className="tabular-nums text-[13px] font-bold tracking-tight">{fmt(elapsed)}</span>
      </span>
      <form action={running ? clockOutAction : clockInAction}>
        <Btn on={running} />
      </form>
    </div>
  );
}
