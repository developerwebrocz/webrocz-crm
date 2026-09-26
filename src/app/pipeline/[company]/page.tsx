import { getCurrentUser } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getFinanceClients } from "@/lib/queries";
import FinanceClients from "@/components/FinanceClients";
import CompanyNav from "@/components/CompanyNav";

export const dynamic = "force-dynamic";

const ALLOWED = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

// URL slug → company key. One pipeline page per billing entity.
const SLUG_TO_COMPANY: Record<string, string> = {
  "web-solutions": "WEB_SOLUTIONS",
  "web-rocz": "WEB_ROCZ",
  "web-rocz-pvt": "WEB_ROCZ_PVT",
};

export default async function CompanyPipelinePage({ params }: { params: Promise<{ company: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED.includes(user.role)) redirect("/");
  const { company } = await params;
  const key = SLUG_TO_COMPANY[company];
  if (!key) notFound();
  const { rows, amUsers } = await getFinanceClients();
  return (
    <div className="space-y-5">
      <CompanyNav company={key} active="clients" />
      <FinanceClients rows={rows} amUsers={amUsers} lockedCompany={key} embedded />
    </div>
  );
}
