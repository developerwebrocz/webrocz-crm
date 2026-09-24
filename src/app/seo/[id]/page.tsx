import { getSeoClient } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import SeoClientDetail from "@/components/SeoClientDetail";

export const dynamic = "force-dynamic";

export default async function SeoClientPage({ params, searchParams }: PageProps<"/seo/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const sp = await searchParams;
  const month = typeof sp.month === "string" ? sp.month : undefined;
  const data = await getSeoClient(id, user.id, user.role, month);
  if (!data) redirect("/seo");
  return <SeoClientDetail data={data} />;
}
