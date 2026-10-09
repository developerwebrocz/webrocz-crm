import { prisma } from "@/lib/prisma";
import RequestShootForm from "@/components/RequestShootForm";
import { Camera, MapPin } from "lucide-react";

// Account manager's own shoot requests to Studio X, with where each one stands:
// waiting for Studio X → scheduled (date, time, shooter) → in progress → completed.
// Shown on the account manager's dashboard, with the "Request a shoot" button.

const fmtDate = (iso: string) => { const [y, m, d] = (iso || "").split("-"); return d ? `${d}-${m}-${y}` : iso || "—"; };

function stage(s: { status: string; assignedToId: string | null }): { label: string; color: string } {
  if (s.status === "CANCELLED") return { label: "Cancelled", color: "var(--rose)" };
  if (s.status === "COMPLETED") return { label: "Completed", color: "var(--emerald)" };
  if (s.status === "IN_PROGRESS") return { label: "Shoot in progress", color: "var(--violet)" };
  if (!s.assignedToId) return { label: "Waiting for Studio X", color: "var(--amber)" };
  return { label: "Scheduled", color: "var(--sky)" };
}

export default async function MyShootRequests({ userId, clients }: { userId: string; clients: { id: string; name: string }[] }) {
  const shoots = await prisma.shoot.findMany({
    where: { requestedById: userId },
    include: { client: { select: { name: true } }, assignedTo: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 30,
  });
  const open = shoots.filter((s) => s.status === "SCHEDULED" || s.status === "IN_PROGRESS").length;
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: "var(--violet)" }}><Camera size={15} /></span>
          <div>
            <div className="text-[14.5px] font-bold">My shoot requests · Studio X</div>
            <div className="text-[12px] text-[var(--muted)]">{shoots.length === 0 ? "Ask Studio X for a client shoot — they schedule it and assign the shooter." : `${shoots.length} request${shoots.length === 1 ? "" : "s"} · ${open} open`}</div>
          </div>
        </div>
        <RequestShootForm clients={clients} />
      </div>
      {shoots.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-[var(--muted)]">No shoot requested yet. Click <b>Request a shoot</b> to send one to Studio X.</p>
      ) : (
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead><tr className="border-b border-[var(--line)]">{["Shoot date", "Client / shoot", "Where", "Note", "Shooter", "Status"].map((h) => <th key={h} className="th px-5 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {shoots.map((s) => {
                const st = stage(s);
                return (
                  <tr key={s.id} className="border-b border-[var(--line)] last:border-0 align-top">
                    <td className="whitespace-nowrap px-5 py-3">
                      <div className="font-semibold tnum">{fmtDate(s.date)}</div>
                      <div className="text-[11.5px] tnum text-[var(--muted)]">{s.startTime || "—"}{s.endTime ? ` – ${s.endTime}` : ""}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-semibold">{s.client?.name ?? "—"}</div>
                      <div className="text-[12px] text-[var(--muted)]">{s.title} <span className="text-[var(--faint)]">· {s.code}</span></div>
                    </td>
                    <td className="px-5 py-3 text-[12px]">
                      <span className="inline-flex items-center gap-1 font-semibold" style={{ color: s.locationType === "ON_LOCATION" ? "var(--amber)" : "var(--sky)" }}><MapPin size={11} /> {s.locationType === "ON_LOCATION" ? "On location" : "In-house"}</span>
                      {s.location && <div className="mt-0.5 text-[11.5px] text-[var(--muted)]">{s.location}</div>}
                    </td>
                    <td className="max-w-[260px] px-5 py-3 text-[12px] leading-snug text-[var(--ink-2)]">{s.notes ? <div className="line-clamp-3 whitespace-pre-wrap" title={s.notes}>{s.notes}</div> : <span className="text-[var(--faint)]">—</span>}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-[12.5px]">{s.assignedTo?.name ?? <span className="text-[var(--faint)]">Not assigned yet</span>}</td>
                    <td className="px-5 py-3"><span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ color: st.color, background: `color-mix(in srgb, ${st.color} 13%, white)` }}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
