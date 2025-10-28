# Artemis Monorepo

Artemis is a workforce experience sandbox that brings onboarding, people operations, goal tracking, and time management into a single monorepo. The repository packages a production-ready React application, a typed Hono API, a shared schema library, and Supabase infrastructure so you can iterate quickly without trading off safety.

## Architecture at a Glance

- `apps/frontend` — React Router 7 + Tailwind 4 experience layer with auth, dashboards, and management flows.
- `apps/backend` — Bun-powered Hono API that enforces Supabase Row Level Security and multi-tenant business rules.
- `packages/shared` — Shared Zod schemas, enums, and TypeScript helpers consumed by both apps.
- `supabase` — Migrations, seeds, and local CLI configuration for auth, storage, and Postgres policies.
- `docs`, `scripts`, `tasks` — Product plans, operational scripts, and automation entry points.

## Feature Overview

### Frontend (`apps/frontend`)
- Guided onboarding that completes tenant setup and routes new members to the right workflow.
- Dashboard with workspace health, My Time widget, actionable notifications, and theme switching.
- People directory with profile editing, growth plan, and secure document management.
- Team views for managers: check-in feed, goal reviews, and team calendar overlay.
- Workflow builder and goal-setting experiences powered by shared schemas to stay type-safe.
- Auth, session persistence, and API calls wired to Supabase with graceful fallback states.

### Backend (`apps/backend`)
- Zero-trust Supabase JWT verification, per-request user clients, and tenant-aware authorization helpers.
- Tenant lifecycle endpoints: creation, bootstrap, metadata updates, and role-based access control.
- Membership and employee management including custom fields, secure storage uploads, and document downloads.
- Goal and check-in APIs that support multi-step updates, history, and manager approval queues.
- Time tracking, time-off requests, and calendar aggregation endpoints with manager approval flows.
- Workflow drafting, publishing, and retrieval backed by shared validation schemas.

### Shared Library (`packages/shared`)
- Canonical Zod schemas for tenants, memberships, employees, workflows, goals, check-ins, time tracking, and example data.
- Type-safe request/response contracts exported as `@vibe/shared` for both apps.
- Validation helpers that prevent drift between frontend forms and backend enforcement.

### Supabase Workspace (`supabase`)
- SQL migrations and seeds that encode table schemas, policies, and helper RPCs.
- CLI-ready config for local Docker environments, storage buckets (for employee documents), and RLS policies.
- Example seeds that let you experience the product flows immediately after bootstrap.

## Getting Started

1. **Install prerequisites**
   - Node.js 20+
   - `pnpm` 10+
   - Bun (backend dev server) — `brew install oven-sh/bun/bun` or the official installer
   - Supabase CLI (optional but recommended) — `brew install supabase/tap/supabase`
2. **Install dependencies**
   ```bash
   pnpm install
   ```
3. **Configure your environment**
   ```bash
   cp .env.example .env.local
   ```
   Populate the Supabase values after running `supabase start` (see below). Both apps read from the root `.env.local`, and the frontend expects keys prefixed with `VITE_`.

## Running the Stack

- **Start Supabase locally**
  ```bash
  supabase start
  ```
  The CLI prints local URLs and keys; copy them into `.env.local`. When you need a clean slate, run `supabase db reset`. Stop the services anytime with `supabase stop`.

- **Run everything in watch mode**
  ```bash
  pnpm dev
  ```
  Turborepo orchestrates the frontend and backend dev servers in parallel.

- **Targeted commands**
  - Frontend: `pnpm --filter frontend dev`, `pnpm --filter frontend build`
  - Backend: `pnpm --filter backend dev`, `pnpm --filter backend start`
  - Shared package: `pnpm --filter @vibe/shared build`

- **Production builds**
  ```bash
  pnpm build
  ```
  Generates the React Router build output and prepares the backend for deployment.

## Quality Checks

- Lint: `pnpm lint` (or `pnpm --filter <workspace> lint`)
- Type safety: `pnpm typecheck`
- Tests: placeholders return success for now; add workspace-specific suites as features solidify.
- Clean artifacts: `pnpm clean` drops Turborepo caches and workspace build outputs.

## Environment Reference

- Frontend expects `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally `VITE_BACKEND_URL`.
- Backend requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and optional `PORT`.
- `.env.local` is git-ignored; check `.env.example` for the latest keys to populate.

## Project Structure

```
.
├─ apps/
│  ├─ frontend/        # React Router 7 app (Tailwind 4, shadcn/ui, Supabase auth)
│  └─ backend/         # Hono API (Bun dev server, Supabase integration)
├─ packages/
│  └─ shared/          # Zod schemas, DTOs, helpers shared across the stack
├─ supabase/           # Migrations, seeds, CLI config for local Postgres & storage
├─ docs/               # Product plans, discovery notes, team rituals
├─ scripts/            # Helper scripts for cleaning, automation, CI hooks
├─ turbo.json          # Turborepo pipeline config
└─ pnpm-workspace.yaml # Workspace definitions for pnpm
```

## Next Steps

- Add real Supabase project credentials when you deploy to staging or production.
- Wire up CI to run `pnpm lint`, `pnpm typecheck`, and future test suites before merges.
- Extend `packages/shared` with any new domain areas to keep contracts synchronized.

Happy shipping! 🎯
