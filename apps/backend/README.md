## Local development

Install dependencies with Bun and run the hot-reloading server:

```sh
bun install
bun run dev
```

The server listens on `http://localhost:3000` (configured in `src/server.ts`).

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
