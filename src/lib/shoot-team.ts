import "server-only";
import { prisma } from "./prisma";

// Which video editors get "My Shoots": the ones an admin put on the shoot team (they are the
// editors Studio X assigns as the shooter). An editor who has a
// shoot assigned to them still sees it, so an assigned shoot is never hidden from them.
export async function editorHasShoots(user: { id: string; shootTeam?: boolean | null }) {
  if (user.shootTeam) return true;
  // any shoot given to them (not only open ones), so a shoot assigned to them always shows
  const given = await prisma.shoot.count({ where: { assignedToId: user.id, status: { not: "CANCELLED" } } });
  return given > 0;
}
