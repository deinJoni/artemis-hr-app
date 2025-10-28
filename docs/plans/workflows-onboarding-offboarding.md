# Onboarding & Offboarding Workflows – Implementation Plan

_Last updated: 2025-02-14 (Codex planning pass)._

---

## 1. Vision & Success Criteria

- Deliver a drag-and-drop workflow builder that is friendly enough for HR managers yet powerful enough to orchestrate complex onboarding/offboarding journeys.
- Generate personalized employee-facing journey pages that surface tasks, documents, meetings, and progress in one place.
- Ensure workflows can automate integrations across existing Artemis features (documents, tasks, calendar, profile updates) with minimal manual intervention.
- Provide auditable execution trails to satisfy compliance requirements for access removal and asset return during offboarding.

Success means HR admins can configure, publish, and monitor workflows without engineering support, and employees can self-serve their onboarding/offboarding tasks end-to-end.

---

## 2. Personas & Primary Flows

**HR Manager**
- Browse available templates on `/workflows`.
- Create a new workflow via a template or a blank canvas.
- Drag blocks onto the canvas, configure triggers, add actions, and publish a workflow.
- Assign workflows to employees manually or rely on automatic triggers (e.g., employee start date).
- Monitor active runs, intervene when steps fail, and mark items complete if needed.

**Employee**
- Receive an email notification and dashboard card pointing to their personal journey page.
- Complete tasks, e-sign documents, book meetings, and upload confirmations directly in the flow.
- See real-time progress (percent complete, upcoming tasks, overdue items) and contextual guidance.

**System**
- Listens for trigger events (employee created/updated, offboarding flag, manual assignment).
- Instantiates workflow runs, persists state transitions, and fires integrations reliably.
- Tracks completion metrics and surfaces analytics to HR managers.

---

## 3. Architectural Overview

**Current landscape**
- Backend: `apps/backend/src/index.ts` exposes tenant-scoped APIs on Hono, backed by Supabase (RLS enforced via RPC `app_has_permission`).
- Frontend: `apps/frontend/app` uses React Router 7 with shadcn/ui and Supabase auth; sidebar navigation lives in `app/components/app-sidebar.tsx`.
- Shared schemas live in `packages/shared`.

**Proposed additions**
- **Workflow domain** in Supabase with versioned definitions, nodes, edges, runs, and step state tables.
- **Workflow engine service** inside the backend that:
  - Validates workflows on publish.
  - Processes trigger events and enqueues actions.
  - Persists audit logs and exposes execution status APIs.
- **Workflows UI surface** with:
  - `/workflows` list/grid view for templates and live workflows.
  - `/workflows/:id/builder` visual editor powered by React Flow.
  - `/journeys/:runId` employee-facing page.
- Integration hooks so employee creation/offboarding flows can launch runs automatically.

---

## 4. Data Model & Persistence (Supabase)

| Table | Purpose | Key Columns | Notes |
| --- | --- | --- | --- |
| `workflow_templates` | Seeded best-practice templates (system managed) | `id`, `kind` (`onboarding`/`offboarding`), `name`, `description`, `blocks` (JSON) | Tenant_id nullable; store reusable blueprints. |
| `workflows` | Tenant-owned workflow definitions | `id`, `tenant_id`, `name`, `slug`, `kind`, `status` (`draft`/`published`/`archived`), `active_version_id`, `created_by`, `updated_at` | RLS `workflows.manage` (owner/admin). |
| `workflow_versions` | Snapshot of a workflow at publish time | `id`, `workflow_id`, `version_number`, `is_active`, `definition`, `created_at`, `created_by` | `definition` stores normalized references to nodes/edges for quick cloning. |
| `workflow_nodes` | Nodes belonging to a version | `id`, `version_id`, `type` (`trigger`/`action`/`delay`/`logic`), `config` (JSON), `ui_position` | Keep config JSON for block-specific settings (document ids, emails, etc.). |
| `workflow_edges` | Directed edges between nodes | `id`, `version_id`, `source_node_id`, `target_node_id`, `condition` (JSON), `order` | Support conditional branches (e.g., guard checks). |
| `workflow_runs` | A workflow instantiated for an employee | `id`, `tenant_id`, `workflow_id`, `version_id`, `employee_id`, `trigger_source`, `status`, `started_at`, `completed_at`, `canceled_at`, `context` | Status: `pending`, `in_progress`, `paused`, `completed`, `canceled`, `failed`. |
| `workflow_run_steps` | Individual step executions | `id`, `run_id`, `node_id`, `status`, `due_at`, `assigned_to`, `payload`, `result`, `error`, `completed_at` | `assigned_to` allows tasks to go to departments or specific users. |
| `workflow_action_queue` | Pending asynchronous jobs | `id`, `run_id`, `node_id`, `resume_at`, `attempts`, `last_error`, `metadata` | Used for delays, reminders, and retriable integrations. |
| `employee_journey_views` | Stores cached page metadata & tokens | `run_id`, `share_token`, `last_viewed_at`, `hero_copy`, `cta_label` | Supports secure public link to the journey page. |
| `workflow_events` | Append-only audit trail | `id`, `run_id`, `event_type`, `payload`, `created_at`, `created_by` | Keep track of manual overrides, failures, notifications sent. |

**Supporting work**
- Add new permission keys: `workflows.read`, `workflows.manage`, `workflows.run.manage`, `workflows.template.use`.
- Extend generated types in `packages/shared/src/index.ts` for new schemas, Zod validators, and enums (block types, statuses).
- Update Supabase RLS policies mirroring existing approach (`app_has_permission` RPC).

---

## 5. Backend Services & APIs (`apps/backend/src/index.ts`)

1. **Workflow definition management**
   - `GET /api/workflows/:tenantId` → list workflows with status filters and run counts.
   - `POST /api/workflows/:tenantId` → create from template or blank; validate payload via Zod.
   - `GET /api/workflows/:tenantId/:workflowId` → fetch definition (latest draft & active version).
   - `PUT /api/workflows/:tenantId/:workflowId` → update draft metadata or nodes.
   - `POST /api/workflows/:tenantId/:workflowId/publish` → validate graph (connected, single trigger, no cycles, compatible configs), version it, set `active_version_id`.
   - `POST /api/workflows/:tenantId/:workflowId/duplicate` → clone to new draft.
   - `PATCH /api/workflows/:tenantId/:workflowId/status` → archive/restore.

2. **Template service**
   - `GET /api/workflow-templates` (global) with filters by `kind`.
   - `POST /api/workflows/:tenantId/import-template/:templateId` → copy template into tenant draft.

3. **Workflow execution**
   - `POST /api/workflows/:tenantId/:workflowId/run` → manual assignment to specific employee(s).
   - `POST /api/workflows/:tenantId/runs/:runId/retry` → resume failed run.
   - `POST /api/workflows/:tenantId/runs/:runId/cancel` → cancel or pause run.
   - `GET /api/workflows/:tenantId/runs` → paginated runs overview with filtering by status, employee, workflow, date.
   - `GET /api/workflows/:tenantId/runs/:runId` → fetch run detail, step status timeline, audit events.
   - `PATCH /api/workflows/:tenantId/runs/:runId/steps/:stepId` → manual override (mark complete, reassign, add note).

4. **Employee journey endpoints**
   - `GET /api/journeys/:shareToken` → read-only view for employee page.
   - `POST /api/journeys/:shareToken/steps/:stepId/complete` → allow employee to submit completion info (with guard rails by step type).

5. **Trigger ingestion**
   - Hook into existing employee endpoints: after a successful POST/PUT in `/api/employees/:tenantId`, call `workflowEngine.handleEvent({ type: 'employee.created', tenantId, employeeId, payload })`.
   - Add endpoint or background job to handle offboarding triggers (e.g., `employee.offboardingScheduled` when HR sets last day).
   - Build internal helpers for triggers to select matching workflows (`kind`, trigger conditions) and create runs.

6. **Engine runtime**
   - Implement `workflowEngine` module with responsibilities:
     - Graph validation and normalization on publish.
     - Run instantiation (set `workflow_runs` row, create first step records).
     - Step processor to execute actions (document creation, email send, calendar scheduling, tasks) via adapters.
     - Delay & retry handling using `workflow_action_queue`.
     - Emitting audit events and updating run status.
   - Provide adapters for integrations (documents, tasks, email, calendar) with clear error handling and retries.

7. **Tooling**
   - Add Bun cron/interval worker (same process) polling `workflow_action_queue` every minute for due jobs.
   - Instrument with structured logging and optional metrics (e.g., counts per status).

---

## 6. Workflow Engine Design

- **State machine**
  - `pending` → `in_progress` when trigger fires.
  - Step statuses: `idle`, `waiting_input`, `queued`, `in_progress`, `completed`, `failed`, `canceled`.
  - Run completes when all terminal branches complete; fails if any step fails without retry path.
- **Execution flow**
  1. Load active version + graph.
  2. Topologically walk from trigger node(s), enqueue first action nodes.
  3. For synchronous actions (e.g., updating profile), execute immediately.
  4. For asynchronous actions (documents, tasks with external completion), mark step as `waiting_input` and rely on webhook or manual completion.
  5. For delays, create entry in `workflow_action_queue` with `resume_at`.
- **Events & notifications**
  - On state changes, push audit events + optional Realtime channel for UI updates.
  - Build email notifications for employees (welcome/farewell) and step reminders (daily digest).
- **Error handling**
  - Capture integration errors, increment `attempts`, schedule retry with exponential backoff until max attempts reached → mark step failed and notify HR.
- **Extensibility**
  - Define block registry shared across frontend/back (map block type to config schema, UI form, backend executor).

---

## 7. Frontend Implementation (`apps/frontend/app`)

1. **Navigation & routing**
   - Add `/workflows` route in `app/routes.ts` and update sidebar `navItems` (`app/components/app-sidebar.tsx`) to include "Workflows".
   - Create nested route structure: `routes/workflows.tsx` (list) and `routes/workflows.$workflowId.builder.tsx`.
   - Add `/journeys/:shareToken` route for employee view (public layout variant).

2. **Workflows list page**
   - Reuse `Card` components to render grid of workflows with status pills, run counts, CTA to `+ Create workflow`.
   - Provide tabs/filters (Onboarding, Offboarding, Archived).
   - Include recent activity list (pull from `/api/workflows/:tenantId/runs?status=in_progress`).

3. **Template picker modal**
   - On `+ Create workflow`, open modal with template cards (images, descriptions).
   - Option to start from scratch.

4. **Visual builder**
   - Integrate `reactflow` with custom node components for triggers/actions/delays.
   - Left panel: block palette (Trigger, Send Email, Assign Task, Send Document, Schedule Event, Delay).
   - Canvas: supports pan/zoom, connection lines, validation (only one trigger start).
   - Right panel: property editor (forms powered by Zod schema per block).
   - Top bar: workflow title input, status indicator, buttons for Save Draft, Publish, Preview.
   - Autosave to draft via `PUT /api/workflows/:tenantId/:workflowId`.

5. **Run monitoring**
   - Add `routes/workflows.$workflowId.runs.tsx` for run detail (timeline, step statuses, audit log).
   - Use websockets/Realtime channel (optional) to live update.

6. **Employee journey page**
   - Standalone layout (hide sidebar), friendly welcome hero section, progress bar, step list with animations.
   - Step components align with block type (e.g., show embedded document viewer, CTA to schedule, confirm asset return).
   - Provide context for manager contact and help resources.

7. **Employee creation integration**
   - Extend `apps/frontend/app/routes/employees.tsx` wizard to optionally select workflow(s) during creation (multi-select).
   - Surface active workflow runs inside employee detail drawer (if exists).

8. **Design system updates**
   - Add icons for new blocks (lucide icons like `Flowchart`, `Clock`, `Mail`).
   - Possibly extend color tokens for workflow statuses.

9. **State management**
   - Create React Query hooks (`useWorkflows`, `useWorkflowRuns`, `useJourney`) under `app/hooks`.
   - Handle optimistic updates and error toasts.

---

## 8. Integrations & Automation

- **Documents**: Provide action block to call existing e-signature endpoint, store document ID on step payload, listen for completion webhook to mark step done.
- **Tasks**: Introduce integration adapter to create tasks assigned to departments; ensure tasks table (if upcoming) can reference `workflow_run_step_id`.
- **Calendar**: Connect to Google/Microsoft via backend or stub for now; at minimum, allow ICS export while building full sync later.
- **Email**: Use Supabase or transactional provider for welcome/farewell emails; allow custom subject/body with template variables (`{{employee.name}}`, `{{manager.name}}`).
- **Profile updates**: Provide action to update Supabase `employees` data (role, buddy assignment).
- **IT integrations (future)**: Keep action interface generic to plug in device provisioning or account deprovisioning tools.

---

## 9. Permissions, Security, & Compliance

- RBAC:
  - Owners/Admins → manage definitions, publish, view runs.
  - Managers → start runs, view employees under their team, mark steps complete.
  - Employees → read-only access to their own journeys (via signed token).
- Enforce tenant scoping on every query (`eq('tenant_id', tenantId)`).
- Secure journey links with `share_token` (UUID) plus short-lived JWT for API calls.
- Log every manual override in `workflow_events` with actor & timestamp.
- Ensure PII stored in step payloads is minimized or encrypted where required.

---

## 10. Observability & Analytics

- Instrument backend with structured logs (`workflowId`, `runId`, `stepId`, `tenantId`).
- Add Supabase log-based dashboards or ship to external log provider.
- Track metrics:
  - Time-to-complete per workflow.
  - Drop-off rate per step.
  - Average retries/errors per action type.
- Surface analytics in future `/workflows/analytics` tab (phase 2).

---

## 11. Testing Strategy

- **Unit tests**
  - Workflow validation rules (acyclic graph, config schema).
  - Step executor adapters with mocked external services.
- **Integration tests**
  - Publish workflow and simulate trigger event, ensure steps progress correctly.
  - Employee journey API authentication & completion flow.
- **E2E smoke**
  - Using Playwright/Cypress: create workflow from template, publish, assign to employee, employee completes tasks.
- **Load & reliability**
  - Stress test run creation to ensure queue handles concurrent hires.
- Establish seed data for templates in test fixtures.

---

## 12. Phase Roadmap & Progress Tracker

| Status | Phase | Key Deliverables |
| --- | --- | --- |
| [ ] | Phase 0 – Stakeholder alignment | Confirm requirements (copy, compliance), finalize template list, agree on success metrics. |
| [x] | Phase 1 – Data foundations | Supabase migrations, RLS policies, shared types, seed templates. |
| [ ] | Phase 2 – Backend engine MVP | Definition CRUD, publish validation, run instantiation, basic step executors (email, task, document). |
| [ ] | Phase 3 – Frontend foundations | `/workflows` list, navigation updates, template picker, hooks. |
| [ ] | Phase 4 – Visual builder | React Flow canvas, block editors, draft autosave, publish workflow. |
| [ ] | Phase 5 – Employee journey UX | Public journey page, email notifications, completion flows. |
| [ ] | Phase 6 – Integrations & automation | Employee creation hook, offboarding trigger, delay queue, audit log UI. |
| [ ] | Phase 7 – QA & launch readiness | Testing, analytics instrumentation, error handling polish, documentation. |

Use this table to mark progress as implementation advances (convert `[ ]` → `[x]` per phase).

**Progress update (2025-02-14):** Supabase workflow schema, permissions, and shared Zod types have been landed. Template seeding and engine scaffolding remain open before Phase 1 can be formally closed.

**Progress update (2025-02-14, later):** Backend scaffolding now exposes workflow list/create/update/publish endpoints with typed payloads, and initial workflow templates are seeded in Supabase. Engine execution, run queue processing, and richer builder UI remain.

---

## Implementation TODOs (in progress)

- [x] Reconcile Supabase migrations so `baseline_core`, `employees_domain`, and `workflow_domain` apply cleanly without duplicate policy/table errors (dedupe overlapping statements from `20251027123000_baseline_multi_tenant.sql`).
- [x] Re-run full Supabase reset to confirm workflows schema + template seeds succeed after migration fixes (run `supabase start` first, then `supabase db reset --workdir supabase`).
- [x] Restore backend dependencies and get `pnpm --filter backend typecheck` passing locally.
- [x] Harden Supabase migrations for idempotency (policies/triggers) so resets run without manual intervention.
- [x] Add `pnpm db:bootstrap` helper to replay schema after `supabase db reset`.
- [x] Hook `/workflows` frontend route into `GET /api/workflows/:tenantId` to display seeded templates/drafts.
- [ ] Add workflow detail view + builder scaffolding (React Flow canvas, property editor, save/publish actions).
- [ ] Implement workflow engine runtime: trigger ingestion, run instantiation, step execution, delay queue worker.
- [ ] Wire employee create/offboarding events to workflow engine and surface run status in employee views.
- [ ] Build template picker modal and workflow metadata management in the UI.
- [ ] Design and implement employee journey page backed by `employee_journey_views` data.
- [ ] Add automated tests covering workflow definition CRUD and engine execution paths.

---

## 13. Open Questions & Risks

- Which integrations must be functional for V1 (calendar, devices, ticketing)? Need stakeholder prioritization.
- Do we support multiple concurrent workflows per employee (e.g., onboarding + security training) at launch?
- How to authenticate external partners (IT, facilities) who might receive tasks but are not Artemis members?
- What SLA do we need for workflow execution? If near-real-time, we may need dedicated worker processes beyond cron polling.
- Legal/compliance review for employee data stored in audit logs and emails.

---

## 14. Dependencies & Follow-ups

- Gather template content (copy, recommended actions) from HR subject matter experts.
- Confirm email provider capabilities (transactional templates, localization).
- Ensure document service (if separate) exposes API for template selection and status webhooks.
- Plan migration path for existing employees (retroactive onboarding?).
- Coordinate with design for builder mockups and employee journey visuals.

---

## 15. Launch Checklist (to be completed during execution)

- [ ] All phases in tracker marked complete.
- [ ] Run books for HR admins and support teams published.
- [ ] Monitoring dashboards configured for workflow failures.
- [ ] Security review completed (RLS, data retention).
- [ ] Beta test with internal tenant; collect feedback and iterate.
