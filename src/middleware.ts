import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC = ["/login", "/staff", "/share"]; // reachable without a session

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const rawCookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(rawCookie);

  // A cookie that is present but does NOT verify (e.g. signed with an older
  // AUTH_SECRET, or otherwise corrupt) is the classic "refresh logs me out"
  // cause: the browser keeps re-sending a dead cookie forever. We actively
  // DELETE it on the way out so a single clean login permanently fixes it for
  // every user — no "clear your cookies" needed.
  const staleCookie = !!rawCookie && !session;
  const clearStale = (res: NextResponse) => {
    if (staleCookie) res.cookies.delete(SESSION_COOKIE);
    return res;
  };

  // NOTE: we do NOT bounce signed-in users away from /login here. The JWT can be
  // signature-valid while its user no longer exists in the DB (e.g. after a re-seed),
  // and bouncing on JWT-validity alone caused an infinite /login ↔ / redirect loop
  // (ERR_TOO_MANY_REDIRECTS). The login pages themselves bounce only when getCurrentUser()
  // confirms a real user, which breaks the loop and lets a stale cookie be replaced.

  // not signed in and on a protected route → send to login (and drop the dead cookie)
  if (!session && !isPublic) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return clearStale(NextResponse.redirect(url));
  }
  // On the public login pages, still strip a dead cookie so the next login is clean.
  if (staleCookie && isPublic) {
    const h0 = new Headers(req.headers);
    h0.set("x-pathname", pathname);
    return clearStale(NextResponse.next({ request: { headers: h0 } }));
  }
  // Billing, AM Panel and Team are admin-only (Super Admin + Sub Admin).
  const isAdminRole = session?.role === "SUPER_ADMIN" || session?.role === "SUB_ADMIN";
  const adminOnly = pathname.startsWith("/billing") || pathname.startsWith("/am") || pathname.startsWith("/team");
  if (session && adminOnly && !isAdminRole) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Section access model — an employee can only open their OWN team's section; heads get
  // their department; admins (Super/Sub) get everything. Prevents seeing other teams' data by URL.
  if (session && !isAdminRole) {
    const AM = ["AM_HEAD", "ACCOUNT_MANAGER", "DM_EXEC"];
    const SECTIONS: { prefix: string; roles: string[] }[] = [
      { prefix: "/clients", roles: AM },
      { prefix: "/ads", roles: AM },
      { prefix: "/google-ads", roles: AM },
      { prefix: "/smo", roles: AM },
      { prefix: "/calendar", roles: AM },
      { prefix: "/seo", roles: ["SEO_HEAD", "SEO"] },
      { prefix: "/designs", roles: ["DESIGNER"] },
      { prefix: "/videos", roles: ["EDITOR"] },
      { prefix: "/projects", roles: ["DEV_HEAD", "WEB_DEV"] },
    ];
    const hit = SECTIONS.find((s) => pathname === s.prefix || pathname.startsWith(s.prefix + "/"));
    if (hit && !hit.roles.includes(session.role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
  // expose the path so the root layout can drop the app shell for public pages
  const h = new Headers(req.headers);
  h.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: h } });
}

export const config = {
  // run on everything except Next internals, the API, and static assets (incl. the logo png)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
