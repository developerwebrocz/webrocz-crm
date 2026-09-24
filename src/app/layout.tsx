import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { prisma } from "@/lib/prisma";
import { getSearchIndex, getAlerts, getApprovalsCount, getMyOpenTaskCount, deptForRole, getDueReminderCount } from "@/lib/queries";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { stopImpersonate } from "@/app/actions";
import { Eye } from "lucide-react";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WebRocz",
  description: "Digital marketing agency CRM — clients, deliverables, team workload and reports.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Effective user = the impersonated employee when a Super Admin is "viewing as", else self.
  const user = await getCurrentUser();

  // public client-facing pages (share links) never get the internal app shell
  const pathname = (await headers()).get("x-pathname") ?? "";
  // Designers & Video Editors get a dedicated full-screen "Studio" layout (its own dark
  // sidebar) on their board routes — so those skip the shared CRM shell. Super Admin
  // (and anyone impersonating) keeps the normal shell so oversight + the exit banner work.
  const studioRole = !!user && (user.role === "DESIGNER" || user.role === "EDITOR") && !user.impersonatedBy;
  const studioRoute = pathname === "/" || pathname.startsWith("/designs") || pathname.startsWith("/videos");
  // Only public share links + the creative studio pages skip the CRM shell.
  const bare = pathname.startsWith("/share") || (studioRole && studioRoute);

  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full" suppressHydrationWarning>
        {user && !bare ? <AppShell user={user} userId={user.id} impersonatedBy={user.impersonatedBy}>{children}</AppShell> : children}
      </body>
    </html>
  );
}

async function AppShell({ user, userId, impersonatedBy, children }: { user: { name: string; role: string }; userId: string; impersonatedBy?: string | null; children: React.ReactNode }) {
  const [clientCount, search, alerts, approvalsCount, taskCount, reminderCount] = await Promise.all([
    prisma.client.count().catch(() => 0),
    getSearchIndex().catch(() => ({ clients: [], projects: [], team: [] })),
    getAlerts(userId).catch(() => ({ count: 0, items: [] })),
    // approvals badge scoped by role: admin = all, head = their dept, others = 0
    ((user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN") ? getApprovalsCount() : deptForRole(user.role) ? getApprovalsCount(deptForRole(user.role)!) : Promise.resolve(0)).catch(() => 0),
    getMyOpenTaskCount(userId).catch(() => 0),
    getDueReminderCount().catch(() => 0),
  ]);
  return (
    <>
      {impersonatedBy && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-[var(--ink)] px-4 py-2 text-center text-[13px] font-semibold text-white">
          <span className="inline-flex items-center gap-2"><Eye size={15} /> Viewing as <b>{user.name}</b> · you are still signed in as {impersonatedBy}</span>
          <form action={stopImpersonate}>
            <button className="rounded-md bg-white/15 px-3 py-1 text-[12.5px] font-bold hover:bg-white/25">Exit to Super Admin</button>
          </form>
        </div>
      )}
      <TopBar user={user} search={search} alerts={alerts} />
      <MobileNav />
      <div className="flex">
        <Sidebar clientCount={clientCount} approvalsCount={approvalsCount} taskCount={taskCount} reminderCount={reminderCount} user={user} />
        <main className="min-w-0 flex-1 px-5 py-7 sm:px-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </>
  );
}
