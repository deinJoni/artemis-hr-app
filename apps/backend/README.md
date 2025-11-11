## Local development

Install workspace dependencies and start the backend in watch mode:

```sh
pnpm install
pnpm --filter backend dev
```

The dev script uses Bun under the hood (see `package.json`) and serves the API on `http://localhost:3000` as configured in `src/server.ts`. You can also run `bun install && bun run dev` directly from `apps/backend` if you prefer working without the workspace tooling.

## API reference

See [API_ENDPOINTS.md](./API_ENDPOINTS.md) for a complete catalogue of every `/api` endpoint, grouped by domain with request/response notes.

### Route organization

- `src/index.ts` wires middleware (auth, CORS, Supabase bindings) and mounts each domain router via `register*Routes` helpers.
- Smaller domains expose their handlers from `src/routes/<domain>.ts`, while more complex modules (employees, performance, time management, etc.) live under `src/features/<domain>/router.ts` with supporting services and utilities beside them.
- Shared helpers and middleware sit in `src/lib` and `src/middleware` (for example `require-user.ts` and `tenant-context.ts`).

When adding a new domain, place its router where it fits best (`src/routes` for light modules, `src/features/<domain>` for heavier ones), export a `registerDomainRoutes` helper, and invoke it from `src/index.ts`.

## Building with Turbo

The workspace `build` task type-checks the backend so downstream apps can rely on the shared types before their own builds run. Execute it directly or via Turbo:

```sh
pnpm turbo run build --filter=backend...
```

Turbo ensures `@vibe/shared` finishes its `build` first (`^build` dependency), so the generated declarations from the shared package are ready before the backend task executes. The backend build only type-checks and then drops an empty `dist/.placeholder` file so Turbo's caching doesn't complain about missing outputs.

## Deploying to Vercel

1. Point the Vercel project root to `apps/backend`.
2. Set the build command to `pnpm run vercel-build` (defined at the repo root).
3. Add the required Supabase environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`) in the Vercel dashboard.

The deployment entry point is `api/[[...route]].ts`, which adapts the existing Hono app to Vercel's Edge runtime. Vercel will list the function under that catch-all path in the deployment summary, but the handler still receives whichever URL path the client requested.
