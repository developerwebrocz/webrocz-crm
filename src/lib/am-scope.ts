// An Account Manager / Digital Marketing Executive works only with the clients they manage:
// client lists, pickers, the client page and search show just those. AM Head and the admins
// see every client; the other teams (design, video, SEO …) are not affected by this.
export const OWN_CLIENTS_ONLY = ["ACCOUNT_MANAGER", "DM_EXEC"];

// The id to filter clients by ("only this manager's clients"), or undefined for "all clients".
export function ownClientsOf(user: { id: string; role: string } | null | undefined): string | undefined {
  return user && OWN_CLIENTS_ONLY.includes(user.role) ? user.id : undefined;
}
