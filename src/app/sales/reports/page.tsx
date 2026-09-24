import { getSalesReports } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SalesReports from "@/components/SalesReports";

export const dynamic = "force-dynamic";

const REPORT_ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "SALES_HEAD", "SALES_EXEC"];

export default async function SalesReportsPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!REPORT_ROLES.includes(user.role)) redirect("/");
  const sp = await searchParams;
  const pipeline = sp.pipeline === "DIGITALHAT" ? "DIGITALHAT" : "WEBROCZ";
  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";
  const exec = typeof sp.exec === "string" ? sp.exec : "";
  const [d, execs] = await Promise.all([
    getSalesReports(pipeline, from || undefined, to || undefined, exec || undefined),
    prisma.user.findMany({ where: { role: { in: ["SALES_EXEC", "SALES_HEAD"] }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return <SalesReports execRows={d.execRows} categoryRows={d.categoryRows} dailyRows={d.dailyRows} monthlyRows={d.monthlyRows} totals={d.totals} execs={execs} exec={exec} pipeline={pipeline} from={from} to={to} />;
}
