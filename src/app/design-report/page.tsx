import WorkReportPage from "@/components/WorkReportPage";

export const dynamic = "force-dynamic";

// Designer → Work Report (Super Admin)
export default function DesignReportPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  return <WorkReportPage kind="DESIGN" searchParams={searchParams} />;
}
