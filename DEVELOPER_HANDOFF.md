# WebRocz Agency OS — Developer Handoff

Internal CRM for WebRocz Digital Agency. Live at **https://admin.webrocz.com**.

> ℹ️ **Secrets are NOT in this file.** Server IP, SSH password, the production `AUTH_SECRET`, the Resend API key and login passwords are shared **privately by the owner** (not committed to git). Placeholders below show where each value goes.

---

## 1. Tech stack
- **Next.js 16.3.2** (App Router, React 19) — TypeScript, Tailwind v4
- **Prisma 7** + `@prisma/adapter-better-sqlite3` (SQLite, file `prisma/dev.db`)
- Auth: `jose` JWT in an httpOnly cookie `wr_session` (HS256), scrypt password hashing
- Server Actions + `revalidatePath` for all mutations
- Hosting: single VPS, Nginx → Node (`next start`) on port 3005, managed by PM2

## 2. Local setup
```bash
npm install
# create .env (see section 6)
npx prisma generate
npx prisma db push
npm run dev          # http://localhost:3000
```

## 3. Build — MUST use webpack (not Turbopack)
`package.json` build script is `next build --webpack`. **Do not switch to Turbopack** —
Turbopack has a bug that skips the client-reference-manifest for `/sales`, which 500s the
whole route. Webpack build is slower (~2 min) but correct.

## 4. Deploy process (from a Windows dev machine)
The app is deployed as a **tarball built locally**, shipped, and rebuilt on the server.

```bash
# 1. build + tar (from the app/ folder). NEVER include .env or prisma/*.db — they clobber prod.
tar --exclude='./node_modules' --exclude='./.next/cache' --exclude='./.git' \
    --exclude='./.env' --exclude='./prisma/*.db' --exclude='./prisma/*.db-journal' \
    -czf webrocz-crm.tar.gz .

# 2. upload  (SERVER_IP is shared privately by the owner)
scp webrocz-crm.tar.gz root@SERVER_IP:/root/

# 3. deploy on server (extract → migrate → clean rebuild → restart)
ssh root@SERVER_IP "tar -xzf /root/webrocz-crm.tar.gz -C /var/www/webrocz && cd /var/www/webrocz && npx prisma db push --schema=prisma/schema.prisma && rm -rf .next && npm run build && pm2 restart webrocz-crm"
```

## 5. Server
- **VPS:** `root@SERVER_IP` — the IP and SSH password are shared **privately by the owner** (not in this repo)
- **App dir:** `/var/www/webrocz`
- **PM2 process:** `webrocz-crm` (id **2**), fork mode, port 3005
- 🚫 **DO NOT touch** the other PM2 apps on this box: `showyours` (id 0) and `digital-hat-api` (id 1).
- **Nginx:** site config in `/etc/nginx/sites-available/` for `admin.webrocz.com` → proxies to `127.0.0.1:3005`. **`proxy_buffering off;` is REQUIRED** in the `location /` block — without it Next RSC streaming breaks and SPA navigation 500s.
- Logs: `pm2 logs webrocz-crm --err --lines 40`

## 6. Environment — create `.env` yourself (NOT committed to git)
```
DATABASE_URL="file:./prisma/dev.db"
AUTH_SECRET="<generate your own for local dev; owner shares the prod value privately>"
RESEND_API_KEY="<Resend key — owner shares privately>"
EMAIL_FROM="noreply@webrocz.com"
EMAIL_REPLY_TO="webrocz@gmail.com"
```
For local dev generate your own `AUTH_SECRET` (e.g. `openssl rand -hex 32`). The production value lives only in the server's `.env` — the owner shares it privately if you need to match live sessions.

## 7. CRITICAL gotchas (learned the hard way)
1. **NEVER ship `.env` or `prisma/*.db` in the deploy tarball** — the extract runs over the live install and would wipe the production DB / overwrite prod secrets. The exclude flags above handle this — always verify with `tar -tzf webrocz-crm.tar.gz | grep -E "\.env$|prisma/.*\.db"` (must be empty).
2. **Build with webpack** (see §3).
3. **`serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"]`** in `next.config.ts` — webpack can't bundle the SQLite native module; without this every page 500s.
4. **One-off DB scripts** live in `prisma/*.ts`, run with `npx tsx prisma/<script>.ts`. `tsconfig.json` excludes `prisma/**/*.ts` from the build so they don't break `next build`.
5. **Uploaded files** (quotations, resumes) are saved to `public/uploads/…` and served by the `src/app/uploads/[...path]/route.ts` handler.

## 8. App structure & roles
Roles (see `src/lib/domain.ts` `ROLES`): SUPER_ADMIN, SUB_ADMIN, SALES_HEAD, SALES_EXEC,
AM_HEAD, ACCOUNT_MANAGER, DM_HEAD, DM_EXEC, SEO_HEAD, SEO, DESIGNER, EDITOR, DEV_HEAD, WEB_DEV, ACCOUNTANT.

- **`/` (Dashboard)** — role-based: Super Admin → agency overview; Sales → Sales Dashboard; Accountant → Accountant Dashboard; others → their console.
- **Sales CRM** (`/sales`, `/sales/[id]`) — pipeline stages: Leads → Follow-up → Quotation → Reminder → Meeting → Client Onboarding → Lost. Categories: Website Development / Digital Marketing. On onboard → creates Client + invoice + notifies the relevant team (`src/app/sales-actions.ts`).
- **Invoices** (`/invoices`) — accountant + super admin. GST tax-invoice format, Super-Admin approval gates download/email.
- **Accountant Dashboard** — clients & invoices (pending/received/date), monthly Website-vs-DM breakdown, employees.
- **Hiring** (`/hiring`) — recruitment pipeline (super admin). `src/app/recruit-actions.ts`.
- **Sidebar / access:** `src/components/Sidebar.tsx`; each page guards its own role list.

Key files: `src/lib/queries.ts` (all reads), `src/app/*-actions.ts` (all writes), `src/components/*` (UI).

## 9. Test logins (portal `/staff`)
Test/staff accounts and their shared dev password are provided **privately by the owner**.
Roles available for testing: Sales Executive, Sales Head, Accountant, Website Head,
Developer, Marketing Head, DM Executive, and Super Admin.

Re-seed all test logins locally: `npx tsx prisma/dummy-logins.ts` (see that script for the
emails it creates; set your own passwords there for local use).
