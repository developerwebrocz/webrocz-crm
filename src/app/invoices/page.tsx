import { getInvoices } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import InvoicesDashboard from "@/components/InvoicesDashboard";
import CompanyNav from "@/components/CompanyNav";
import { COMPANY_KEYS } from "@/lib/domain";

export const dynamic = "force-dynamic";

const DASH_ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "ACCOUNTANT"];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!DASH_ROLES.includes(user.role)) redirect("/");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const company = typeof sp.company === "string" ? sp.company : "";
  const d = await getInvoices({ q, status, company });
  const hideApproval = user.role === "ACCOUNTANT";
  // Opened from a company's sidebar (hub=1) → stay inside that company: a CompanyNav header and
  // the invoices scoped to it (no cross-company tabs). Otherwise the normal tabbed dashboard,
  // where the company tabs filter in place.
  const inHub = sp.hub === "1" && (COMPANY_KEYS as readonly string[]).includes(company);
  const dash = <InvoicesDashboard rows={d.rows} totals={d.totals} companyCounts={d.companyCounts} clientNames={d.clientNames} q={q} status={status} company={company} hideApproval={hideApproval} embedded={inHub} />;
  if (!inHub) return dash;
  return (
    <div className="space-y-5">
      <CompanyNav company={company} active="invoices" />
      {dash}
    </div>
  );
}
