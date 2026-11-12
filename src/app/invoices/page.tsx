import { getInvoices } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import InvoicesDashboard from "@/components/InvoicesDashboard";
import CompanyNav from "@/components/CompanyNav";
import { COMPANY_KEYS } from "@/lib/domain";
import { getClientDomains } from "@/lib/webrocz-queries";

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
  // invoice date filter: From – To dates
  const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const from = isDay(sp.from) ? sp.from : "";
  const to = isDay(sp.to) ? sp.to : "";
  const d = await getInvoices({ q, status, company, from, to });
  const hideApproval = user.role === "ACCOUNTANT";
  // Opened from a company's sidebar (hub=1) → stay inside that company: a CompanyNav header and
  // the invoices scoped to it (no cross-company tabs). Otherwise the normal tabbed dashboard,
  // where the company tabs filter in place.
  const inHub = sp.hub === "1" && (COMPANY_KEYS as readonly string[]).includes(company);
  // Web Rocz only: client → domain map so its invoice form fills the domain automatically.
  const clientDomains = company === "WEB_ROCZ" ? await getClientDomains() : undefined;
  const dash = <InvoicesDashboard rows={d.rows} totals={d.totals} companyCounts={d.companyCounts} clientNames={d.clientNames} clientDomains={clientDomains} q={q} status={status} company={company} from={from} to={to} hideApproval={hideApproval} embedded={inHub} canDelete={["SUPER_ADMIN", "SUB_ADMIN"].includes(user.role)} />;
  if (!inHub) return dash;
  return (
    <div className="space-y-5">
      <CompanyNav company={company} active="invoices" />
      {dash}
    </div>
  );
}
