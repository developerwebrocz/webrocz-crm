// An Account Manager / Digital Marketing Executive works only with the clients they manage:
// client lists, pickers, the client page and search show just those. AM Head and the admins
// see every client; the other teams (design, video, SEO …) are not affected by this.
export const OWN_CLIENTS_ONLY = ["ACCOUNT_MANAGER", "DM_EXEC"];

// The id to filter clients by ("only this manager's clients"), or undefined for "all clients".
export function ownClientsOf(user: { id: string; role: string } | null | undefined): string | undefined {
  return user && OWN_CLIENTS_ONLY.includes(user.role) ? user.id : undefined;
}

// A client's services are saved by two screens: the account-management form (keys like
// META_ADS) and the accounts side (names like "Meta Ads"). These are the same service under
// two names — so the edit form shows it ticked, and saving does not add it a second time.
export const SERVICE_ALIAS: Record<string, string> = { META_ADS: "Meta Ads", GOOGLE_ADS: "Google Ads", VIDEO: "Videoshoot" };

// A client can be shared: besides its account manager, other account managers work on it too.
// They are kept as assignments of this kind, and see / edit the client exactly like its manager.
export const SHARED_AM = "SHARED_AM";

// "The clients this person works on": they are the account manager, or the client is shared with them.
export const managedBy = (userId: string) => ({
  AND: [{ OR: [{ accountManagerId: userId }, { assignments: { some: { userId, department: SHARED_AM } } }] }],
});
