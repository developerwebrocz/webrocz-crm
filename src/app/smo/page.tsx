import AdsWorkspace from "@/components/AdsWorkspace";

export const dynamic = "force-dynamic";

export default async function SmoPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  return <AdsWorkspace mode="smo" searchParams={searchParams} />;
}
