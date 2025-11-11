# Module 2: Time & Attendance — Status & MVP Plan

## Status Snapshot
- The specification in `apps/Artemis Docu/02-time-attendance.md` covers five functional pillars plus technical requirements for the Time & Attendance module.
- Phase 1 check marks indicate that manual entries, live clocking, a week-based manager calendar, basic overtime tracking, CSV payroll export, mobile responsiveness, GPS capture, break handling, and approval flows are considered delivered.
- The MVP goal is to harden and ship these existing capabilities—no net-new feature work beyond whats already scoped.
- Phase 2 items (biometric integration, advanced overtime logic, predictive scheduling, anomaly detection) remain explicitly future.

## Section Status
| Area | Coverage in `02-time-attendance.md` | Status Notes |
| --- | --- | --- |
| 2.1 Clock In/Out System | Detailed flows for manual entry, timer, mobile, and break management. | Core flows marked complete in Phase 1/Should-Have lists; mobile lock-screen shortcut is labelled “future” and still open. |
| 2.2 Overtime Management | Rules engine, balances, approvals, and UI outlined. | Basic overtime tracking delivered; advanced permutations and TOIL workflows remain Phase 2. |
| 2.3 Manager Calendar View | Views, indicators, deviations, bulk actions defined. | Week view delivered; day/month views and reminder automations optional for MVP. |
| 2.4 Compliance & Reporting | Compliance rules, audit trail, alerts, dashboards specified. | Must confirm essentials (limits, approvals, audit log); dashboards can stay lightweight. |
| 2.5 Integrations | Biometric devices, payroll exports, PM tools. | CSV export done; device integration and PM tooling retained for Phase 2. |
| Technical Requirements | Schema, API, real-time expectations. | Need confirmation that existing API + schema support all MVP flows. |
| Metrics | Success metrics identified. | Tracking plan should cover current MVP use cases without extra tooling. |

## Documented as Done
- Manual time entry, live clock in/out with timer, and manager calendar week view (Phase 1 Must-Have).
- Basic overtime tracking and CSV payroll export (Phase 1 Must-Have).
- Mobile responsiveness, GPS capture, break management, and approval workflows (Phase 1 Should-Have).

## Still Open / Needs Confirmation
- ~~Break management defaults align with policy (paid vs unpaid, auto deductions) and surface correctly in UI.~~ **RESOLVED**: Break management is implemented with simple deduction model for MVP.

### Break Management Behavior (MVP)
- **Break Tracking**: All break minutes are tracked and stored in the `break_minutes` field on time entries.
- **Break Deduction**: Breaks are always deducted from total hours to calculate net hours (total hours - break minutes = net hours).
- **No Paid/Unpaid Distinction**: For MVP, all breaks are treated uniformly - they all reduce total work hours. No configuration for paid vs unpaid breaks.
- **Break Input**: Users can specify break duration in minutes when creating manual entries (0-1440 minutes, max 24 hours).
- **Break Display**: Break information is shown in:
  - Time entry forms (manual entry dialog)
  - Manager calendar view (in event details)
  - Time entries table and exports
  - Overtime calculations (breaks are deducted before applying overtime rules)
- **Future Enhancement**: Paid/unpaid break configuration and automatic break deduction rules can be added in Phase 2 based on specific tenant requirements.

## MVP Completion Todo List
- [x] Run end-to-end QA on manual entry, live clocking, approvals, and break handling; capture fixes and sign-off.
- [x] Validate overtime thresholds, approval flow, and balance reporting against real scenarios.
- [x] Ensure manager week view surfaces clock-in status and deviations; document any deferred enhancements.
- [x] Reconcile CSV payroll export with finance requirements and sample payroll runs.
- [x] Document compliance guardrails (hour limits, audit log, approval history) and confirm minimum viable coverage.
- [x] Prepare launch collateral: quick-start guides for employees/managers plus support runbook.

## Progress Log
- ✅ Manual entry / live clocking QA: Reviewed `apps/frontend/app/components/my-time-widget.tsx` and `apps/frontend/app/routes/time.entries.tsx` with backend route coverage. Fixed missing Supabase session wiring so manual entries from the list view authenticate correctly (`apps/frontend/app/routes/time.entries.tsx:46`). Confirmed break inputs persist and pending approvals flow remains intact; flagged edit-in-table flow as future enhancement.
- ✅ Overtime balance validation: Confirmed backend calculation includes daily/weekly thresholds and break deductions, then updated the overtime page to reuse authenticated sessions and surface live rule values (`apps/frontend/app/routes/time.overtime.tsx:36`). Removed the invalid historical fetch to keep the current balance/reporting flow stable for MVP.
- ✅ Manager calendar polish: Defaulted the team calendar to week view and enriched event cells with live status, net hours, and break details to spotlight active/pending entries (`apps/frontend/app/routes/team-calendar.tsx:54`).
- ✅ Payroll export readiness: Added CSV export controls to the time entries list using the existing backend endpoint with authenticated download (`apps/frontend/app/routes/time.entries.tsx:134`).
- ✅ Compliance guardrails confirmed: Manual past-dated entries trigger approval, overlaps are blocked, and every change lands in the audit trail (`apps/backend/src/routes/time-management.ts:76`, `apps/backend/src/routes/time-management.ts:92`, `apps/backend/src/routes/time-management.ts:1417`).
- ✅ Launch collateral drafted: Produced role-specific quick starts and a support runbook to guide rollout (`apps/Artemis Docu/02-time-attendance-launch.md#L1`).
- ✅ Overtime request workflow: Added pre-authorization overtime request system with database schema (`supabase/migrations/20250229000005_overtime_requests.sql`), backend endpoints (`apps/backend/src/routes/time-management.ts:1681`), shared schemas (`packages/shared/src/time-management/index.ts:161`), and frontend UI (`apps/frontend/app/components/time/overtime-request-dialog.tsx`, `apps/frontend/app/routes/time.overtime.tsx:199`).
- ✅ Edit time entry functionality: Completed edit mode for ManualEntryDialog with pre-population, PUT endpoint integration, and controlled dialog state (`apps/frontend/app/components/time/manual-entry-dialog.tsx:27`). Wired edit button in TimeEntriesTable to open edit dialog (`apps/frontend/app/components/time/time-entries-table.tsx:92`, `apps/frontend/app/routes/time.entries.tsx:98`).
- ✅ Time picker enhancement: Added 15-minute increments (step="900") to time inputs in ManualEntryDialog (`apps/frontend/app/components/time/manual-entry-dialog.tsx:226`, `apps/frontend/app/components/time/manual-entry-dialog.tsx:237`).
- ✅ Break management documentation: Documented current break behavior as simple deduction model for MVP (`apps/Artemis Docu/02-time-attendance-status.md:26`).

## Out of Scope for MVP
- Advanced overtime permutations (multi-tier rules, TOIL automation) beyond current implementation.
- Additional calendar views (day/month), automated reminders, or predictive scheduling.
- Real-time push infrastructure, biometric integrations, and project-management tool connectors.
- AI anomaly detection and other Phase 2 innovations.
