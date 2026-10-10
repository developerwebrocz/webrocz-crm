import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getReceiptList } from "@/lib/receipts";
import { COMPANIES } from "@/lib/domain";
import ReceiptsList from "@/components/ReceiptsList";

export const dynamic = "force-dynamic";

// Receipts — one for every amount received; "To send" is what still has to go to the client.
// ?company=WEB_ROCZ shows one billing company (opened from that company's menu).
const ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "ACCOUNTANT"];

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ROLES.includes(user.role)) redirect("/");
  const sp = await searchParams;
  const company = typeof sp.company === "string" && COMPANIES[sp.company] ? sp.company : "";
  const d = await getReceiptList(company);
  return <ReceiptsList key={company} rows={d.list} company={company} />;
}
