import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getReceiptList, RECEIPTS_SINCE } from "@/lib/receipts";
import ReceiptsList from "@/components/ReceiptsList";

export const dynamic = "force-dynamic";

// Payment receipts — one per payment received; "To send" is what still has to go to the client.
const ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "ACCOUNTANT"];

export default async function ReceiptsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ROLES.includes(user.role)) redirect("/");
  const d = await getReceiptList();
  return <ReceiptsList rows={d.list} since={RECEIPTS_SINCE} />;
}
