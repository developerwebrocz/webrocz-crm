import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getClientOptions } from "@/lib/queries";
import { getEditCountBoard, canOpenEditCount, isVideoAdmin } from "@/lib/edit-count-queries";
import { TEAMS } from "@/lib/team-kinds";
import EditCountBoard from "@/components/EditCountBoard";

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
  const clients = d.seeAll ? (await getClientOptions()).map((c) => ({ id: c.id, name: c.name })) : [];
  return <EditCountBoard team={TEAMS.DESIGN} d={d} me={{ id: user.id, name: user.name, isEditor: user.role === "DESIGNER", isAdmin: isVideoAdmin(user) }} clients={clients} saved={saved} />;
}
