### @vibe/shared

Shared types, utilities, schemas, and hooks for the monorepo.

Usage:

```ts
import { ExampleChartResponseSchema, ExampleTableResponseSchema } from "@vibe/shared";
```

The package publishes compiled ESM output under `dist/`, so always run `pnpm --filter @vibe/shared build` (or the workspace `vercel-build` task) before deploying consumers like the backend Edge function.

## Module layout

Contracts are grouped by domain so consumers can discover related schemas quickly:

- `analytics` &mdash; demo chart/table responses used on the dashboard.
- `tenants` &mdash; tenant onboarding, profile bootstrap, and tenant update contracts.
- `memberships` &mdash; RBAC membership payloads and `AppRoleEnum`.
- `employees` &mdash; employee core records, documents, departments, teams, and audit trail schemas.
- `time-management` &mdash; time entry, overtime, leave management, and related enums.
- `workflows` &mdash; workflow templates, versions, runs, and queue records.
- `performance` &mdash; goal, key-result, and check-in contracts.
- `imports` &mdash; CSV preview/confirm/result schemas shared by import flows.
- `common` &mdash; shared primitives, enums, and helper utilities reused across domains.

You can continue importing from the package root for convenience:

```ts
import { TimeEntrySchema, TimeOffStatusEnum } from "@vibe/shared";
```

or scope imports to a domain to keep intent obvious:

```ts
import { TimeEntrySchema, LeaveRequestListResponseSchema } from "@vibe/shared/time-management";
```
