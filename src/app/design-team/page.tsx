import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getClientOptions } from "@/lib/queries";
import { getEditCountBoard, canOpenEditCount, isVideoAdmin } from "@/lib/edit-count-queries";
import { TEAMS } from "@/lib/team-kinds";
import EditCountBoard from "@/components/EditCountBoard";
import DesignSheet from "@/components/DesignSheet";
import { getDesignSheet } from "@/lib/design-sheet-queries";

export const dynamic = "force-dynamic";

// Design team "Design Count": each designer's designs per day (the designers' Google Sheet).
// Designers see their own; the design team lead and admins see everyone, assign design work
// and can load the old sheet. Same page as the video team's Editing Count, for the designers.
export default async function DesignTeamPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canOpenEditCount(user, "DESIGN")) redirect("/");
  const sp = await searchParams;
  const month = typeof sp.month === "string" ? sp.month : undefined;
  const saved = typeof sp.saved === "string" ? sp.saved : "";
  const d = await getEditCountBoard(user, month, "DESIGN");
  // designers name the client of each design they log, so everyone gets the client list
  const clients = (await getClientOptions()).map((c) => ({ id: c.id, name: c.name }));
  const board = <EditCountBoard team={TEAMS.DESIGN} d={d} me={{ id: user.id, name: user.name, isEditor: user.role === "DESIGNER", isAdmin: isVideoAdmin(user) }} clients={clients} saved={saved} />;
  // a designer keeps their own page (enter the day, see their days)
  if (!d.seeAll) return board;
  // Super Admin / design lead: the team's work as one simple sheet first; entering or
  // correcting a day, the month table and assigning work are folded underneath
  const q = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const sheet = await getDesignSheet({ period: q("period"), client: q("client"), designer: q("designer") });
  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow">Design team</div>
        <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Design work</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">What each designer did — for which client, how many, and who assigned it</p>
      </div>
      <DesignSheet d={sheet} />
      <details className="card !p-0 overflow-hidden" open={!!saved || !!month}>
        <summary className="cursor-pointer px-5 py-3.5 text-[14px] font-bold text-[var(--violet)]">Enter or correct a day · month table · assign work</summary>
        <div className="border-t border-[var(--line)] p-5">{board}</div>
      </details>
    </div>
  );
}
