# Job Scout

An AI-powered personal job scouting agent that continuously searches multiple job sources, uses Gemini AI to summarize and score opportunities, and presents them in a polished dashboard for review, organization, and social post generation.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/job-scout run dev` — run the frontend (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **Frontend**: React + Vite, TanStack Query, Wouter, Tailwind CSS, shadcn/ui
- **Backend**: Express 5, PostgreSQL, Drizzle ORM
- **AI**: Gemini (`gemini-2.5-flash`) via `@google/genai` — job summarization and social post generation
- **Validation**: Zod (`zod/v4`), `drizzle-zod`, generated from OpenAPI spec
- **API codegen**: Orval (from OpenAPI spec)

## Required Secrets

- `GEMINI_API_KEY` — your Gemini API key (from https://aistudio.google.com/apikey)
- `DATABASE_URL` — auto-provisioned PostgreSQL connection string

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for the API contract
- `lib/db/src/schema/` — Drizzle table definitions (jobs, keywords, sources, settings, notes, social_posts, scheduler_runs)
- `artifacts/api-server/src/routes/` — route handlers (jobs, stats, keywords, sources, settings, notes, social, scheduler)
- `artifacts/api-server/src/lib/gemini.ts` — Gemini AI integration for job summarization and social post generation
- `artifacts/job-scout/src/pages/` — Dashboard, JobsFeed, JobDetail, Keywords, Sources, Settings, History pages

## Architecture decisions

- **OpenAPI-first**: All API contracts defined in `openapi.yaml` → codegen produces typed React Query hooks and Zod validation schemas
- **Single-user**: Settings table has one row; `getOrCreateSettings()` bootstraps defaults on first request
- **Job deduplication**: `url` column has a `UNIQUE` constraint — duplicate URLs are silently skipped during scans
- **Scheduler**: In-process scheduler using Node.js intervals; `isScanning` flag prevents concurrent runs; scan state persisted in `scheduler_runs` table
- **AI resilience**: Gemini failures during scan are caught and logged — jobs are still saved without AI fields rather than failing the entire scan
- **SSRF mitigation**: RSS fetch has 10s timeout and AbortController; production should add additional URL allowlisting

## Product

- **Dashboard** — live stats: total jobs, new opportunities, pipeline status, top sources, recent activity feed. "Trigger Scan" runs job discovery immediately.
- **Job Feed** — paginated, filterable list of discovered jobs with AI relevance scores (color-coded 0–100), status management, and favorites
- **Job Detail** — full AI analysis: summary, requirements, why-it-fits, technology stack, seniority. Notes, status history, social post generator.
- **Keywords** — editable search terms used to filter discovered jobs and guide AI relevance scoring
- **Sources** — job boards with enable/disable toggle (Remote OK, We Work Remotely, HN Who Is Hiring via RSS; LinkedIn, Wellfound as future connectors)
- **Settings** — scheduler frequency, remote-only toggle, salary filter, company black/whitelists, notification preferences
- **Scanner History** — run history with job counts, duration, and status

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/db/src/schema/`, run `pnpm run typecheck:libs` before checking artifact packages — stale lib declarations cause false type errors
- The `avg()` SQL function returns a string from `node-postgres`, not a number — always `parseFloat()` before calling numeric methods
- Orval generates `<OperationIdPascal>Body` Zod schemas — never name OpenAPI components with that pattern or you get TS2308 export collision
- `useTriggerScan` mutation takes `void` — call `mutateAsync(undefined as unknown as void)` when needed

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Gemini model used: `gemini-2.5-flash` — change in `artifacts/api-server/src/lib/gemini.ts`
