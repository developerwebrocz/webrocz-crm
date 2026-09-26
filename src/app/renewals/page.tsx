import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getWebsiteRenewals } from "@/lib/queries";
import WebsiteRenewals from "@/components/WebsiteRenewals";
import CompanyNav from "@/components/CompanyNav";

export const dynamic = "force-dynamic";

const ALLOWED = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

// Website renewals belong to the website companies. In a company hub the list is pre-scoped:
// Web Solutions → non-GST websites, Web Rocz Pvt Ltd → GST websites.
const SLUG_TO_COMPANY: Record<string, string> = { "web-solutions": "WEB_SOLUTIONS", "web-rocz-pvt": "WEB_ROCZ_PVT" };

export default async function WebsiteRenewalsPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED.includes(user.role)) redirect("/");
  const sp = await searchParams;
  const slug = typeof sp.company === "string" ? sp.company : "";
  const companyKey = SLUG_TO_COMPANY[slug];
  const { rows, counts, totals } = await getWebsiteRenewals();
  if (!companyKey) return <WebsiteRenewals rows={rows} counts={counts} totals={totals} />;
  const lockedGst = companyKey === "WEB_ROCZ_PVT" ? "GST" : "NOGST";
  return (
    <div className="space-y-5">
      <CompanyNav company={companyKey} active="renewals" />
      <WebsiteRenewals rows={rows} counts={counts} totals={totals} embedded lockedGst={lockedGst} />
    </div>
  );
}
