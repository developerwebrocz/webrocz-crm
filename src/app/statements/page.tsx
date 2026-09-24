import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getFinanceReports } from "@/lib/queries";
import FinanceReports from "@/components/FinanceReports";

export const dynamic = "force-dynamic";

const ALLOWED = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

// Resolve a named period (Indian FY = Apr–Mar) into a [from, to] date range.
function bounds(period: string, spFrom: string, spTo: string): [string, string] {
  if (period === "CUSTOM") return [spFrom, spTo];
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (period === "THIS_YEAR") return [`${y}-01-01`, `${y}-12-31`];
  if (period === "THIS_FY") { const fy = m >= 3 ? y : y - 1; return [`${fy}-04-01`, `${fy + 1}-03-31`]; }
  if (period === "LAST_FY") { const fy = (m >= 3 ? y : y - 1) - 1; return [`${fy}-04-01`, `${fy + 1}-03-31`]; }
  return ["", ""]; // ALL
}

export default async function FinanceReportsPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED.includes(user.role)) redirect("/");
  const sp = await searchParams;
  const period = typeof sp.period === "string" ? sp.period : "ALL";
  const spFrom = typeof sp.from === "string" ? sp.from : "";
  const spTo = typeof sp.to === "string" ? sp.to : "";
  const [from, to] = bounds(period, spFrom, spTo);
  const { monthly, topClients, modes, totals } = await getFinanceReports({ from, to });
  return <FinanceReports monthly={monthly} topClients={topClients} modes={modes} totals={totals} period={period} from={spFrom} to={spTo} />;
}
