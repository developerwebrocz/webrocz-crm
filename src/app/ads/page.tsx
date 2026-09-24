import AdsWorkspace from "@/components/AdsWorkspace";

export const dynamic = "force-dynamic";

export default async function AdsPage({ searchParams }: PageProps<"/ads">) {
  return <AdsWorkspace mode="meta" searchParams={searchParams} />;
}
