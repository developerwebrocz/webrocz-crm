import { getFollowupsBoard } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import FollowupsBoard from "@/components/FollowupsBoard";

export const dynamic = "force-dynamic";

const SALES_ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "SALES_HEAD", "SALES_EXEC"];

export default async function FollowupsPage({ searchParams }: PageProps<"/sales/followups">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!SALES_ROLES.includes(user.role)) redirect("/");
  const sp = await searchParams;
  const pipeline = sp.pipeline === "DIGITALHAT" ? "DIGITALHAT" : "WEBROCZ";
  const d = await getFollowupsBoard(user.id, user.role, pipeline);
  return <FollowupsBoard buckets={d.buckets} counts={d.counts} />;
}
