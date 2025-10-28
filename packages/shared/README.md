### @vibe/shared

Shared types, utilities, schemas, and hooks for the monorepo.

Usage:

```ts
import { ExampleChartResponseSchema, ExampleTableResponseSchema } from "@vibe/shared";
```

The package publishes compiled ESM output under `dist/`, so always run `pnpm --filter @vibe/shared build` (or the workspace `vercel-build` task) before deploying consumers like the backend Edge function.
