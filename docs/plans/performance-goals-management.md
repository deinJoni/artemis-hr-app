# Performance & Goals Management – Implementation Plan

_Last updated: 2025-02-17 (Codex planning pass)._

---

## 0. TODO Tracker

| Item | Status | Notes |
| --- | --- | --- |
| Phase readiness: confirm manager eligibility rules and analytics KPIs with stakeholders. | 🔴 Not started | Need product/ops alignment. |
| Data foundations: add Supabase schema (goals, key results, check-ins, summaries) with RLS policies. | 🟡 In progress | Migration `20250217153000_performance_goals_module.sql` landed; email-based RLS guard still needs validation or alternate employee ↔ user mapping. |
| Shared contracts: expose Zod schemas and TypeScript types for new entities. | 🟢 Complete | Zod schemas/types shipped in `@vibe/shared`; shared build passes. |
| Backend services: implement `/api/my-team`, goal CRUD, and check-in lifecycle endpoints. | 🟢 Complete | Hono handlers in `apps/backend/src/index.ts` operational; typecheck + lint clean. Continue iterating on RLS and analytics hooks. |
| Frontend manager hub: `My Team` navigation entry, roster grid, check-in creation flow. | 🟢 Complete | `/my-team` route live with roster cards, per-card check-in trigger, and detailed workspace. |
| Frontend employee hub: `Growth & Goals` tab with Kanban board, goal detail modal, history tab. | 🟢 Complete | `/employees/:id/growth` implements three-column board, inline progress updates, goal editor, and history feed. |
| Collaboration polish: agenda locking, private notes handling, optimistic UI states. | 🟡 In progress | Baseline agenda editing works; need autosave indicators, real-time sync, and stronger private-note UX. |
| Testing & telemetry: unit/integration coverage, accessibility checks, analytics events. | 🔴 Not started | No automated coverage yet; type/lint gates green. |
| Documentation: update README roadmap and surface new module overview. | 🟢 Complete | README highlights the module, routes, and follow-up roadmap. |

### Backend follow-ups
- [ ] Validate RLS approach (email-based lookup) and consider dedicated user ↔ employee mapping for stronger guarantees.
- [ ] Wrap goal + key result changes in a transaction to avoid partial writes on failure.
- [ ] Emit analytics/audit events when goals or check-ins are created/updated.
- [ ] Queue notifications for upcoming check-ins and overdue goals (email/Slack hooks).

### Frontend follow-ups
- [ ] Add realtime collaboration / autosave indicators to shared agenda.
- [ ] Expand goal editor with key results, updates timeline, and attachments.
- [ ] Enhance drag-and-drop with keyboard accessibility and reordering within columns.
- [ ] Provide quick links from manager hub into check-in history snapshots.

### Quality & Ops follow-ups
- [ ] Add backend and frontend test coverage for goal CRUD, drag-and-drop moves, and check-in lifecycle.
- [ ] Define rollout toggle or feature flag for Performance & Goals module visibility.
- [ ] Document tenant seeding/backfill strategy for managers/direct reports + migrate existing tenants.
- [ ] Plan analytics dashboards for goal completion and check-in cadence.

---

## 1. Vision & Success Criteria

- Deliver a lightweight, always-on Performance & Goals experience that helps managers and employees stay aligned without bureaucratic overhead.
- Enable managers to run collaborative check-ins, see team goal health at a glance, and capture private follow-ups in minutes.
- Give employees a motivating "Growth & Goals" space to create, update, and celebrate progress on personal and team objectives.
- Ship an MVP that fits the existing Artemis design system, respects tenant RBAC, and can evolve toward real-time collaboration later.

Success means managers log in, understand their team’s status in under 30 seconds, and both sides adopt the check-in loop as a weekly rhythm.

---

## 2. Personas & Primary Flows

**Manager**
- Open the new `My Team` hub, see player cards for direct reports, filter by health.
- Launch a check-in for an employee, co-edit the shared agenda, review goals, finalize with private notes.
- Mark goals as updated, flag roadblocks, schedule next touchpoint.

**Employee**
- Visit their profile’s `Growth & Goals` tab, add/edit goals, drag cards across statuses.
- Prep notes in the shared check-in agenda, capture accomplishments, review history.
- Reference past check-ins to track commitments and wins.

**System**
- Ensures manager scopes show only direct reports (leveraging existing reporting relationships).
- Tracks goal progress, aggregates completion summaries per employee.
- Locks and archives agendas once a check-in is marked complete.

---

## 3. UX Overview

### 3.1 Manager Hub (`/my-team`)
- **Navigation**: Sidebar gains a `My Team` primary item (managers only). Consider `app/components/app-sidebar.tsx`.
- **Header**: Title + CTA button `+ Start a New Check-in`.
- **Player cards**: Avatar/name, goal progress pill (`x of y on track`), last check-in date, `View Goals` link.
- **Empty states**: Friendly illustration and copy for managers without reports or no goals.

### 3.2 Check-in Flow
- Triggered from CTA → modal/select employee → route `/my-team/check-ins/new?employeeId=`.
- Two-pane layout:
  - **Left**: shared agenda with pre-filled sections (Accomplishments, Priorities, Roadblocks). Initially simple textarea, upgrade path to collaborative editor (Tiptap + Supabase Realtime).
  - **Right**: read-only active goals list with status badges and recent updates.
- Pre-meeting: manager/employee can add notes asynchronously; highlight unread updates.
- Finalization: manager adds private notes (drawer), clicks `Complete Check-in`, agenda becomes read-only, `last_check_in` timestamp updates.

### 3.3 Employee Hub (`/employees/:id/growth`)
- Accessible tab `Growth & Goals` beside existing profile tabs (check `apps/frontend/app/routes/employees.$id.tsx`).
- **Goal board**: Kanban with columns `To Do`, `In Progress`, `Completed`; drag-and-drop (dnd-kit preferred).
- **Goal cards**: show title, target date, progress bar (derived from key results), quick status chips.
- **Goal detail**: slide-over modal with description, updates, key results CRUD, alignment to team/company objectives.
- **Check-in history**: secondary tab/list view grouping agendas by date with read-only content and attachments.

---

## 4. Data Model & Persistence (Supabase)

| Table | Purpose | Key Columns | Notes |
| --- | --- | --- | --- |
| `goals` | Stores individual goals per employee. | `id`, `tenant_id`, `employee_id`, `title`, `description`, `status` (`todo`/`in_progress`/`completed`), `progress_pct`, `due_date`, `created_by`, `updated_at` | `progress_pct` derived from key results; enforce tenant + manager access via RLS. |
| `goal_key_results` | Optional measurable checkpoints. | `id`, `goal_id`, `label`, `target_value`, `current_value`, `status`, `updated_at` | Enables detailed tracking without bloating goal row. |
| `goal_updates` | Timeline of user updates. | `id`, `goal_id`, `author_id`, `body`, `created_at` | Surfaces in detail view; keep markdown/plain text. |
| `check_ins` | Represents a single check-in session. | `id`, `tenant_id`, `manager_id`, `employee_id`, `scheduled_for`, `completed_at`, `status` (`draft`/`completed`), `last_updated_by` | Draft state until completion. |
| `check_in_agendas` | Shared agenda content. | `check_in_id`, `accomplishments`, `priorities`, `roadblocks`, `notes_json`, `updated_at` | Store structured JSON for future editor upgrades. |
| `check_in_private_notes` | Manager-only recap. | `check_in_id`, `manager_id`, `body`, `created_at` | Separate table to simplify RLS. |
| `employee_goal_summaries` (materialized view) | Summaries for player cards. | `employee_id`, `total_goals`, `on_track_goals`, `last_check_in_at` | Refresh nightly or via trigger on goal/check-in changes. |

Migration considerations:
- Extend existing `employees` table with `manager_id` or reuse current relationship metadata.
- Add indexes on `(tenant_id, manager_id)`, `(tenant_id, employee_id, status)` for dashboard queries.

---

## 5. Backend Services & APIs

- **Routing**: Introduce `/api/my-team` namespace in `apps/backend` (Hono). Versioned as needed.
- **Endpoints**:
  - `GET /api/my-team` → list direct reports with summaries (uses view).
  - `GET /api/my-team/:employeeId/goals` → fetch goals + key results.
  - `POST /api/goals` / `PATCH /api/goals/:id` / `DELETE /api/goals/:id`.
  - `POST /api/check-ins` → create draft, returns agenda template.
  - `PATCH /api/check-ins/:id` → update agenda fields, mark complete.
  - `POST /api/check-ins/:id/private-notes` → upsert manager-only note.
  - `GET /api/check-ins/:employeeId` → history for employee.
- **Services**:
  - Goal service: handles progress calculations, cascading updates when key results change.
  - Check-in service: enforces manager/employee relationship, archives agendas (immutable after completion).
  - Notification hooks: optional email/Slack to remind employee of upcoming check-in.
- **Validation**: Shared Zod schemas in `packages/shared` for request/response contracts.
- **Performance**: Use Supabase row-level caching or limit/offset with search params to keep `/my-team` fast.

---

## 6. Frontend Implementation Strategy

- **State management**: Continue using Remix loaders/actions with Supabase helpers. Cache manager roster via loader and revalidate on mutation.
- **UI components**:
  - Player cards: extend shadcn `Card` with progress bar component already used in dashboard.
  - Kanban board: integrate `@dnd-kit/core`, create column state in Remix loader, optimistic moves with fetcher submissions.
  - Shared agenda editor: start with `Textarea` per section; encapsulate in `SharedAgenda` component for swap-in later.
  - Check-in timeline: reuse existing `Timeline` component if available; otherwise simple list with date badges.
- **Navigation guard**: hide `My Team` item for non-managers; rely on server role check in loader.
- **Routing**:
  - `app/routes/my-team.tsx` (roster grid).
  - `app/routes/my-team.check-ins.$id.tsx` or nested segments for new vs existing.
  - `app/routes/employees.$id.growth.tsx` for employee hub tab.
- **Error handling**: toast on mutation failure, inline validation messages, auto-save cues when agenda updates.

---

## 7. Real-time & Collaboration Considerations

- MVP: Polling via Remix revalidate on submit; optimistic updates for agenda text.
- Future: Supabase Realtime or WebSocket channel keyed by `check_in_id` to sync edits.
- Maintain `notes_json` structure so collaborative editor can map sections to document nodes later.
- Consider presence indicators (typing avatars) in stretch phase.

---

## 8. Permissions, Security, & Compliance

- Enforce manager-only access to direct reports; verify `manager_id` from auth context in loaders and API handlers.
- Employees can CRUD their own goals; managers can edit goals for their reports.
- Private notes table RLS restricts read/write to `manager_id` (and tenant admins).
- Audit log: append entries to existing logging mechanism when goals or check-ins are completed.
- Data retention: agendas considered shared content; private notes accessible only to manager; document policy for exporting check-in history.

---

## 9. Integrations & Dependencies

- **People data**: confirm single source of truth for manager relationships (Supabase table or external HRIS sync).
- **Notifications**: evaluate existing email/Slack integration to send check-in reminders or goal nudges.
- **Design**: collaborate with Product/Design for player card visuals, agenda layout, Kanban styling.
- **Analytics**: plan to feed dashboards with goal completion rates and cadence adherence; align with future BI work.
- **External OKR tools (future)**: keep goal schema flexible for linking to company objectives or imported OKRs.

---

## 10. Testing Strategy

- **Unit tests**
  - Goal service: status transitions, progress calc from key results.
  - Check-in service: manager authorization, agenda locking on completion.
- **Integration tests**
  - `/api/my-team` returns correct roster and summary data.
  - Full check-in lifecycle (create draft → update agenda → complete → view history).
  - Goal CRUD with drag-and-drop reorder triggers expected mutations.
- **E2E**
  - Manager starts check-in, employee reviews goals, private note saved.
  - Employee adds goal, drags to `Completed`, card updates on manager view.
- **Manual/UX**
  - Responsive layouts for cards and board.
  - Accessibility: keyboard drag-and-drop fallback, aria labels for agenda.

---

## 11. Phase Roadmap & Progress Tracker

| Status | Phase | Key Deliverables |
| --- | --- | --- |
| [ ] | Phase 0 – Requirements alignment | Confirm copy, success metrics, manager eligibility rules, analytics needs. |
| [ ] | Phase 1 – Data foundations | Supabase migrations, RLS policies, shared Zod types, seed sample data. |
| [ ] | Phase 2 – Backend APIs | `my-team`, goals CRUD, check-in endpoints, summary materialized view. |
| [ ] | Phase 3 – Manager hub UI | Navigation updates, player card grid, empty states, data wiring. |
| [ ] | Phase 4 – Check-in workflow | Agenda editor, goal sidebar, completion flow, notifications (optional). |
| [ ] | Phase 5 – Employee growth hub | Goals board with drag-and-drop, detail modals, history tab. |
| [ ] | Phase 6 – Quality & telemetry | Tests, analytics events, accessibility sweep, performance validation. |

Update the table as phases complete (switch `[ ]` to `[x]`).

---

## 12. Open Questions & Risks

- Do we already store manager-report relationships, or do we need a new `manager_id` column + backfill?
- What cadence do teams expect for check-ins (weekly/bi-weekly)? Influences reminder logic.
- Should employees see manager private notes in any scenario (legal/compliance review)?
- Do goals require tagging/weighting or alignment to higher-level company OKRs for MVP?
- Are there data export requirements for performance records (PDF, CSV)?
- If we add collaborative editing, do we need conflict resolution strategy now (e.g., CRDT ready data model)?

---

## 13. Launch Checklist

- [ ] All roadmap phases marked complete.
- [ ] Manager and employee onboarding guides updated with new workflows.
- [ ] KPIs instrumented (goal completion, check-in frequency) and surfaced to stakeholders.
- [ ] Security review of RLS and private note access.
- [ ] Beta round with pilot managers; collect feedback and prioritize follow-ups.
- [ ] Support documentation and in-app help articles ready.

---

## 14. Next Steps After Specification Approval

- Prioritize open questions with stakeholders.
- Spin up design explorations for `My Team` and `Growth & Goals` hubs.
- Begin Phase 1 backlog grooming and assign engineering owners.
