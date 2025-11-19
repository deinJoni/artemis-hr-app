# Tasks & Checklists Requirements

## Source References
- `README.md` sections on Workflows, Employee Management, onboarding/offboarding.
- `docs/PRD-Features-Core.md` (HR-CORE-012, HR-CORE-018, HR-CORE-024).
- `supabase/migrations/00000000000003_seed_data.sql` workflow templates (`Standard Onboarding`, `Executive Onboarding`, `Standard Offboarding`).

## Functional Expectations
1. Automatically generated tasks triggered by workflow templates:
   - Document collection (`documents` array in workflow nodes).
   - General to-dos (`tasks` array, priority/instructions).
   - Manager/employee/role-based assignments.
2. Checklist views for onboarding/offboarding:
   - Task progress tracking, statuses (pending → completed).
   - Detail payloads: due dates, instructions, required attachments.
3. Specialized Task Types:
   - Document upload task → user provides file(s), tracked per employee.
   - Form completion task → user fills structured data, validated server-side.
4. Centralized Task Hub:
   - Filter by assignee (me, team), type (general, document, form), status.
   - Actions: upload document, open form, mark complete.
5. Workflow builder/runtime alignment:
   - Workflow engine persists task type metadata on `workflow_run_steps`.
   - Task completion can attach structured payload (docs/form submission).

## Gaps Identified
1. Workflow engine currently stores payload but lacks explicit task type metadata.
2. No shared schemas describing task variants or completion payloads.
3. APIs limited to `/api/onboarding/tasks/:employeeId`; no tenant-wide tasks endpoint.
4. Document tasks do not integrate with existing employee document upload service.
5. Form tasks are not implemented (no schema storage/rendering).
6. Frontend lacks task hub route; only onboarding journey view exists.
7. No acceptance tests/docs covering document/form task flows.

## Acceptance Criteria Snapshot
1. Workflow steps differentiate task types and include metadata required by UI.
2. Global REST APIs allow fetching and completing tasks with validation.
3. Document upload + form submission flows update workflow run state.
4. Central Task Hub UI renders filters, detail modals, and actions.
5. Journey view consumes enriched metadata and supports new tasks.
6. README/PRD updated to reflect delivered behavior, and smoke tests documented.

## Implementation Notes (Nov 2025)
- Added `task_type` column with `general`, `document`, `form` classifications plus shared Zod types.
- New `/api/tasks` surface provides tenant-wide listing, completion, and document upload endpoints.
- Workflow engine now emits document + form tasks with structured payloads and due dates.
- `/tasks` route ships the Task Hub (filters, badges, document/form dialogs, optimistic completion).
- Employee journey (`/journeys/:shareToken`) now honors task types and uses the shared dialogs.


