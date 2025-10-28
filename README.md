## Vibe Scaffold Monorepo

This is a pnpm-based monorepo with frontend and backend apps and a shared package.

### Structure

```
project-root/
├── apps/
│   ├── frontend/          # React 19, React Router 7, Tailwind 4, Shadcn, Vite tooling
│   └── backend/           # Hono TypeScript API (Bun dev), CORS enabled
├── packages/
│   └── shared/            # Shared types, utilities, schemas, hooks
├── node_modules/          # Root dependencies (pnpm workspaces)
├── .env.example           # Example env for local dev
├── pnpm-workspace.yaml    # Workspace definitions
├── turbo.json             # Turborepo pipeline
├── scripts/               # Project-level helper scripts
└── package.json           # Root scripts (dev/build/lint/test)
```

## Tech stack

### Frontend (`apps/frontend`)
- React 19, React Router 7
- Vite tooling with Tailwind CSS 4
- Shadcn UI and lucide-react icons

Run locally:

```bash
pnpm --filter frontend dev
```

Build:

```bash
pnpm --filter frontend build
```

### Backend (`apps/backend`)
- Hono API with CORS enabled for local development
- Developed with Bun hot reload
- Entry: `apps/backend/src/index.ts`

Run locally:

```bash
pnpm --filter backend dev
```

### Shared package (`packages/shared`)
Reusable types and utilities exported as `@vibe/shared`.

Import from apps:

```ts
import { ExampleChartResponseSchema, ExampleTableResponseSchema } from "@vibe/shared";
```

Build shared:

```bash
pnpm --filter @vibe/shared build
```

## Getting started

### Prerequisites
- Node 20+
- pnpm 10+
- Bun (for backend dev)

### Install

```bash
pnpm install
```

### Develop all apps together

```bash
pnpm dev
```

This runs Turbo: `turbo run dev --parallel` across workspaces.

### Build all

```bash
pnpm build
```

### Useful scripts
- `scripts/dev.sh`: runs `pnpm dev`
- `scripts/build.sh`: runs `pnpm build`

## Environment variables

Copy `.env.example` to `.env` at the root (or per-app as needed). Root `.env` is a convenient place to keep shared values for local dev; app-specific frameworks may also load per-app env files.

Provided keys (extend as needed):
- Frontend (`apps/frontend`)
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_BACKEND_URL` (defaults to `http://localhost:8787` if not set)
- Backend (`apps/backend`)
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY` (used for per-user client)
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose to client)
  - `PORT` (optional, defaults to `8787`)

## Monorepo and Turbo

Turbo orchestrates common tasks with sensible defaults:
- `dev`: not cached, persistent processes
- `build`: depends on upstream `^build`, caches outputs (`build/**`, `dist/**`)
- `lint`, `typecheck`, `test`: ready to wire into each package

Example targeted runs:

```bash
pnpm --filter frontend lint
pnpm --filter @vibe/shared typecheck
```

## Adding new packages/apps

1. Create a new workspace under `packages/` or `apps/`.
2. Add its own `package.json` and scripts.
3. Reference other workspaces with `"workspace:*"` semver.
4. Update imports (e.g., `@vibe/shared`).

## Roadmap / TODO (high-level)
- Performance & Goals polish: realtime agenda sync, autosave indicators, richer goal editing.
- Harden role & permission model (feature flag for managers, explicit employee ↔ user mapping).
- Add automated testing + accessibility sweeps across frontend and backend.
- Instrument analytics and reporting for goal completion and check-in cadence.
- Evaluate CI with Turbo remote caching (optional).

## Performance & Goals module
- Managers can open `/my-team` to view roster cards, start check-ins, and jump into a collaborative workspace that links to team goals.
- Employees (and managers) can visit `/employees/:employeeId/growth` for the new Growth & Goals hub with drag-to-move columns, progress sliders, and check-in history.
- Backend endpoints: `/api/my-team`, `/api/my-team/:employeeId/goals`, `/api/goals`, `/api/check-ins` (plus variants) power the experience; see `apps/backend/src/index.ts` for handlers.
- Schema lives in `supabase/migrations/20250217153000_performance_goals_module.sql`; shared Zod contracts live in `packages/shared`.
- Run `pnpm --filter frontend dev` then sign in; sidebar will reveal "My Team" for accounts with manager permissions.

## Employee custom fields and adding employees

Tenant admins/owners can define custom fields for employees and capture values during employee creation. Managers can add employees but cannot change field definitions.

- Permissions
  - `employees.read`: list and view employees and field definitions
  - `employees.write`: create/update/delete employees and their custom_fields
  - `employees.fields.manage`: create/update/delete field definitions (owner/admin)

- Data model
  - `public.employee_custom_field_defs`: per-tenant fields: `name`, `key`, `type` (`text|number|date|select|boolean`), `required`, `options` (e.g. `{ "choices": ["HR","Sales"] }`), `position`
  - `public.employees.custom_fields jsonb`: stores values keyed by field `key`

- API endpoints (auth required)
  - GET `/api/employee-fields/:tenantId` — list field definitions
  - POST `/api/employee-fields/:tenantId` — create definition
  - PUT `/api/employee-fields/:tenantId/:id` — update definition
  - DELETE `/api/employee-fields/:tenantId/:id` — delete definition
  - Existing employees endpoints now accept/return `custom_fields`

- Frontend usage
  - Employees page has a "Manage Employee Fields" panel to add/delete fields and an Add Employee form that renders dynamic inputs for current definitions.
  - The employees table renders dynamic columns for custom fields, ordered by `position`.

Notes
- Unknown custom field keys are rejected server-side; values are coerced by type (e.g., dates to ISO strings; select values must match `choices`).

## License
Choose and add a license file appropriate for your project.


## Architecture

- Frontend: React 19 + React Router 7 with SSR, Tailwind v4, shadcn/ui.
  - Route loaders co-locate data requirements. Example route fetches data client-side with a Supabase JWT and shows login/health banners.
- Backend: Hono (TypeScript) served by Bun. CORS enabled in dev. Endpoints validate input/output with zod from `@vibe/shared`.
  - Auth middleware validates Supabase JWT using a service client and attaches a per-user Supabase client that enforces RLS.
- Shared package: `@vibe/shared` holds zod schemas and types for request/response shapes and DB types, ensuring end-to-end type safety.
- Database: Supabase Postgres with RLS-based multi-tenancy.
  - Core: `tenants`, `memberships`, `app_role` enum, `permissions`, `role_permissions`.
  - Helper functions: `app_current_user_id()`, `app_has_permission()`, and `app_create_tenant()` (SECURITY DEFINER) for safe tenant creation.

Why this stack
- React Router SSR: simple file-based routing with loaders for predictable data flow and SSR compatibility.
- Hono: fast, minimal runtime with a clean request handler model and strong TS support.
- Zod + shared package: consistent runtime validation and inferred TypeScript types across frontend and backend.
- Supabase: managed auth + Postgres with first-class RLS enables secure multi-tenant data access with minimal boilerplate.

## Supabase auth & RBAC checklist

- **Token validation** — Each backend request passes through `requireUser`, which validates the Supabase JWT once with the service-role client, then reuses a user-scoped client so RLS policies stay in control. Keep the service key private; only the backend should instantiate `supabaseAdmin`.
- **Tenant scoping** — Database policies restrict reads/writes to the caller’s tenant via `app_has_permission`. Recent policy updates require an existing owner to grant, update, or delete the `owner` role, preventing admins from self-promoting.
- **User metadata** — On account creation, Supabase stores the primary tenant and role in `profiles` and `memberships`. UI components read `session.user.user_metadata.role` as a hint but always re-fetch authoritative data from the backend.
- **Production settings** — Enforce email confirmation, disable anonymous sign-ups you do not need, and rotate the service-role key if it ever leaks. Disable the Supabase dashboard “Enable signups” toggle if access should always flow through the app.
- **Debugging** — Client-side onboarding logs are silent by default. To trace flows locally, set `window.__ARTEMIS_DEBUG_ONBOARDING__ = true` in the browser console while running a dev build; sensitive values (like JWTs) are never printed.

## Local development flow (auth → JWT → backend → RLS)

1) Start the apps

```bash
pnpm dev
```

2) Configure env
- Keep all environment variables in a single root file: `.env.local`.
  - Frontend consumes `VITE_*` from the root `.env.local`.
  - Backend reads its keys from the same file.
  - Required variables:
    - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_BACKEND_URL`
    - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

3) Authenticate
- Visit `http://localhost:5173/login` (or your dev port) and sign up / sign in using the built-in form.
- The Supabase client persists the session in `localStorage` using the key `sb-vibe-auth`.

4) Example page behavior
- The example route checks backend health. If the backend is up and you are logged in, it fetches `/api/example/*` with `Authorization: Bearer <access_token>`.
- The backend validates the JWT, attaches a per-user Supabase client, and returns data. If not logged in, the page shows a banner asking you to log in. If backend is down, it shows a backend-down banner.

5) RLS enforcement
- Database policies restrict access by tenant and role. The per-user Supabase client forwards your JWT to Postgres, so row-level security applies automatically.

### Running Supabase locally (Docker)

This project is compatible with the Supabase CLI for local development.

Prerequisites
- Docker running
- Supabase CLI installed (`npm i -g supabase` or `brew install supabase/tap/supabase`)

Start Supabase locally
```bash
supabase start
```

Apply migrations (the CLI does this automatically on start; re-run if needed)
```bash
supabase db reset
```

Populate your `.env.local`
- After `supabase start`, the CLI prints local keys. Map them into `.env.local`:
  - `SUPABASE_URL=<local-api-url>`
  - `SUPABASE_ANON_KEY=<anon-key>`
  - `SUPABASE_SERVICE_ROLE_KEY=<service-role-key>`
  - Mirror to frontend variables:
    - `VITE_SUPABASE_URL=<local-api-url>`
    - `VITE_SUPABASE_ANON_KEY=<anon-key>`

Stop Supabase
```bash
supabase stop
```

## Quickstart: Create a tenant

You can create a tenant via the API. The endpoint requires authentication and will grant the caller the `owner` role in the new tenant via the `app_create_tenant()` RPC.

### Option A: Using curl

1) Obtain an access token
   - Sign in at `/login`, then open DevTools → Application → Local Storage → your app origin → key `sb-vibe-auth`.
   - Copy `access_token` from the stored JSON, e.g. via console:

   ```js
   JSON.parse(localStorage.getItem('sb-vibe-auth') || '{}')?.currentSession?.access_token
   ```

2) Create a tenant

```bash
BACKEND_URL=http://localhost:8787
ACCESS_TOKEN="<paste access token>"

curl -X POST "$BACKEND_URL/api/tenants" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Inc"}'
```

### Option B: From the browser console (after logging in)

```js
const token = JSON.parse(localStorage.getItem('sb-vibe-auth') || '{}')?.currentSession?.access_token;
await fetch((import.meta.env?.VITE_BACKEND_URL || 'http://localhost:8787') + '/api/tenants', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ name: 'Acme Inc' })
}).then(r => r.json());
```

If successful, you’ll get the created tenant object back and your user will be an `owner` of it.

## Time Management v1

Endpoints (backend at `http://localhost:8787` by default):
- `POST /api/time/clock-in` – start a time entry
- `POST /api/time/clock-out` – end current entry
- `GET /api/time/summary` – hours this week, balances, active entry
- `POST /api/time-off/requests` – create time off request
- `PUT /api/time-off/requests/:id/approve` – approve/deny (manager+)
- `GET /api/calendar?start=ISO&end=ISO` – events for Team Calendar (manager+)

Frontend:
- Dashboard shows "My Time" widget (+ Request Time Off)
- Team Calendar at `/calendar` (visible for manager+)
- Action Items lists pending requests for approval

Notes:
- All timestamps UTC. Balances live on `profiles` as `pto_balance_days`, `sick_balance_days`.
- Permissions added: `time.read`, `time.write`, `time_off.approve`, `calendar.read`.
