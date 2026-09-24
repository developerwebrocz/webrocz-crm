import { getAmPanel } from "@/lib/queries";
import { Avatar, Badge, Card, Eyebrow, Progress, ServiceChips } from "@/components/ui";
import { CLIENT_STATUS, inr, inrShort } from "@/lib/domain";
import AmPicker from "@/components/AmPicker";

export const dynamic = "force-dynamic";

export default async function AmPanelPage({ searchParams }: PageProps<"/am">) {
  const sp = await searchParams;
  const amId = typeof sp.am === "string" ? sp.am : undefined;
  const { ams, active, clients } = await getAmPanel(amId);
  const current = ams.find((a) => a.id === active);

  const totalRetainer = clients.reduce((s, c) => s + c.retainer, 0);
  const avgPct = clients.length ? Math.round(clients.reduce((s, c) => s + c.pct, 0) / clients.length) : 0;
  const onTrack = clients.filter((c) => c.pct >= 80).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Account manager panel</Eyebrow>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">AM Panel</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Viewing as {current?.name ?? "—"} · monitor-only health across departments</p>
        </div>
        <AmPicker ams={ams.map((a) => ({ id: a.id, name: a.name }))} active={active ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><Eyebrow>My clients</Eyebrow><div className="mt-2 text-4xl font-extrabold">{clients.length}</div></Card>
        <Card><Eyebrow>Book value</Eyebrow><div className="mt-2 text-4xl font-extrabold">{inrShort(totalRetainer)}</div><div className="eyebrow mt-1">/mo</div></Card>
        <Card><Eyebrow>Avg progress</Eyebrow><div className="mt-2 text-4xl font-extrabold">{avgPct}%</div></Card>
        <Card><Eyebrow>On track</Eyebrow><div className="mt-2 text-4xl font-extrabold">{onTrack}<span className="text-lg text-[var(--muted)]">/{clients.length}</span></div></Card>
      </div>

      <Card pad={false}>
        <div className="p-4"><Eyebrow>My clients · target vs actual</Eyebrow></div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="eyebrow border-y border-[var(--line)] text-left">
                <th className="px-4 py-2.5 font-semibold">Client</th>
                <th className="px-4 py-2.5 font-semibold">Services</th>
                <th className="px-4 py-2.5 font-semibold">Budget</th>
                <th className="px-4 py-2.5 font-semibold">Progress</th>
                <th className="px-4 py-2.5 font-semibold">Health</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-[var(--line)] hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} size={34} />
                      <div><div className="font-semibold">{c.name}</div><div className="eyebrow">{c.code}</div></div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><ServiceChips services={c.services} /></td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold">{inr(c.retainer)}</td>
                  <td className="px-4 py-3 min-w-[150px]">
                    <div className="flex justify-between text-xs"><span className="font-semibold">{c.completed}/{c.agreed}</span><span className="text-[var(--muted)]">{c.pct}%</span></div>
                    <div className="mt-1"><Progress pct={c.pct} /></div>
                  </td>
                  <td className="px-4 py-3"><Badge tone={c.band.tone}>{c.band.label}</Badge></td>
                  <td className="px-4 py-3 text-right"><a href={`/clients/${c.id}`} className="text-sm font-semibold text-[var(--violet)]">Open</a></td>
                </tr>
              ))}
              {clients.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">No clients assigned to this manager yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
