import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getVideoJobBoard, canOpenVideoJobs } from "@/lib/video-job-queries";
import ClientVideosBoard from "@/components/ClientVideosBoard";

export const dynamic = "force-dynamic";

// Video team "Client Videos": every client shoot with its editing and posting status.
// Editors see the clients assigned to them; the team lead, the shoot team and admins see all.
export default async function ClientVideosPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canOpenVideoJobs(user)) redirect("/");
  const sp = await searchParams;
  const d = await getVideoJobBoard(user, typeof sp.month === "string" ? sp.month : undefined);
  const tab = typeof sp.tab === "string" ? sp.tab : "";
  // keyed by the tab / editor so picking another one in the sidebar shows it straight away
  const editor = typeof sp.editor === "string" ? sp.editor : "";
  return <ClientVideosBoard key={`${tab}|${editor}`} d={d} meId={user.id} saved={typeof sp.saved === "string" ? sp.saved : ""} initialTab={tab} initialEditor={editor} openAdd={sp.add === "1"} />;
}
