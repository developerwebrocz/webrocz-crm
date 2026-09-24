import { getDevBoard } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { createDevProject, updateDevProject, deleteDevProject, addDevTask, toggleDevTask, deleteDevTask, toggleDevShare } from "@/app/actions";
import { redirect } from "next/navigation";
import DevBoard from "@/components/DevBoard";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isDev = user.role === "WEB_DEV";
  const { devs, clients, rows, stats, workload, unassigned, activity } = await getDevBoard(isDev ? user.id : undefined);

  return (
    <DevBoard
      rows={rows} stats={stats} devs={devs} clients={clients} workload={workload} unassigned={unassigned} activity={activity}
      canPickAssignee={!isDev} isSuper={user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN"} selfId={user.id} selfName={user.name}
      createAction={createDevProject} updateAction={updateDevProject} deleteAction={deleteDevProject}
      addTaskAction={addDevTask} toggleTaskAction={toggleDevTask} deleteTaskAction={deleteDevTask} shareAction={toggleDevShare}
    />
  );
}
