import "server-only";
import { prisma } from "./prisma";

// Which video editors get "My Shoots": the ones an admin put on the shoot team (they are the
// editors Studio X assigns as the shooter). An editor who has an open shoot assigned to them
// still sees it, so an assigned shoot is never hidden from the person who has to do it.
export async function editorHasShoots(user: { id: string; shootTeam?: boolean | null }) {
  if (user.shootTeam) return true;
  const open = await prisma.shoot.count({ where: { assignedToId: user.id, status: { in: ["SCHEDULED", "IN_PROGRESS"] } } });
  return open > 0;
}
