import WorkReportPage from "@/components/WorkReportPage";

export const dynamic = "force-dynamic";

// Video Editor → Work Report (Super Admin)
export default function VideoReportPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  return <WorkReportPage kind="VIDEO" searchParams={searchParams} />;
}
