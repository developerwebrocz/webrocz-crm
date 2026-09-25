# WebRocz Agency OS

A CRM / operations dashboard for a digital-marketing agency — clients, agreed monthly
deliverables, team workload, per-department progress, ads performance and reports.
Rebuilt from the WebRocz design canvases into a modern full-stack app.

## Stack

| Layer     | Choice |
|-----------|--------|
| Framework | **Next.js 16** (App Router, React 19, Turbopack) |
| Language  | **TypeScript** |
| Styling   | **Tailwind CSS v4** + a small design-token layer in `globals.css` |
| Data      | **Prisma 7** with the `better-sqlite3` driver adapter (SQLite dev DB) |
| Mutations | **Server Actions** (`src/app/actions.ts`) |
| Icons     | lucide-react |

Swap to Postgres for production by changing `provider` in `prisma/schema.prisma`
and `DATABASE_URL` — the query/aggregation layer is DB-agnostic.

## Getting started

```bash
npm install          # installs deps + runs prisma generate (postinstall)
npm run db:push      # create the SQLite schema
npm run db:seed      # seed team + 30 demo clients + a month of work updates
npm run dev          # http://localhost:3000
```

Other scripts: `npm run build`, `npm run db:studio`.

## Data model (`prisma/schema.prisma`)

- **User** — team member with a `role` (Super Admin, AM Head, Account Manager, SEO Head, SEO, Designer, Editor).
- **Client** — company, POC, retainer, status, assigned account manager.
- **ClientService** — which services a client bought (SEO, SMO, Video, Meta/Google Ads, CRM, Web, Branding, Other).
- **Deliverable** — agreed monthly target per `(service, metric)` e.g. `SMO/reels = 8`.
- **Assignment** — team member ↔ client per department.
- **WorkUpdate** — the dated activity log (drives every total, health score and report). Includes SEO ranking fields.
- **AdsPerformance** — monthly Meta/Google numbers per client, entered separately from onboarding.

SQLite can't hold Prisma enums, so allowed values live in `src/lib/domain.ts` (the single source of truth).

## Key logic

- `src/lib/queries.ts` — all reads + aggregations (agreed vs completed vs pending, department
  workload, client health bands, team workload, urgent work, ads and report rollups).
- `src/lib/period.ts` — reporting periods and the **time-factor model** (today 0.05, week 0.25,
  month 1, last-month 0.9) used to scale monthly targets to a shorter window.
- Only `COMPLETED` / `APPROVED` updates count toward a target; `keywords` is a target metric, not a countable unit.

## Screens

`/` dashboard · `/clients` + `/clients/new` + `/clients/[id]` · `/updates` work log ·
`/am` account-manager panel · `/ads` ads performance · `/reports` (CSV / print).
"# webrocz-crm" 
