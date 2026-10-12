import "server-only";
import { prisma } from "./prisma";
import { managedBy } from "./am-scope";

// Does this person work on the client — as its account manager, or because it is shared with them?
export async function managesClient(userId: string, clientId: string): Promise<boolean> {
  return (await prisma.client.count({ where: { id: clientId, ...managedBy(userId) } })) > 0;
}
