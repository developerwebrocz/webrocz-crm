import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDesignPostingBoard, canOpenDesignPostings } from "@/lib/design-posting-queries";
import DesignPostingsBoard from "@/components/DesignPostingsBoard";

export const dynamic = "force-dynamic";

// Design team "Assigned Postings": the week's clients for each designer. Designers see their
// own; the design team lead and admins see everyone and assign clients.
export default async function DesignPostingsPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canOpenDesignPostings(user)) redirect("/");
  const sp = await searchParams;
  const d = await getDesignPostingBoard(user, typeof sp.week === "string" ? sp.week : undefined);
  const add = typeof sp.add === "string" ? sp.add : "";
  return <DesignPostingsBoard key={`${d.week}|${add}`} d={d} meId={user.id} saved={typeof sp.saved === "string" ? sp.saved : ""} openAdd={add} />;
}
