# Leave & Absence Module — Status & MVP Plan

## Current Status

### Done
- Core employee request flow delivered (interactive calendar, balance visibility, half-day/hour support) per section 3.1 and Phase 1 must-haves.
- Single and multi-level approval workflows live with auto-approval rules, delegation, and notifications (sections 3.2, Phase 1 Should-Have).
- Holiday calendar coverage (top 10 countries), team calendar views, and conflict detection in production (sections 3.3 & 3.4, Phase 1 lists).
- Accrual engine, carry-over logic, and manual balance adjustments operating with defined database schema/API endpoints (Technical Requirements, Phase 1 Should-Have).
- Success metrics drafted and ready for instrumentation (Success Metrics section).

### Outstanding / Gaps
- ✅ Compliance guardrails implemented: Minimum entitlement checks, blackout period enforcement, and unused leave alert function are operational.
- ✅ Leave reporting/exports implemented: Dedicated analytics endpoints, database views, and reporting UI dashboard are complete.
- Phase 2 roadmap items (advanced accrual formulas, payroll integration, predictive analytics, mobile push, iCal sync) intentionally deferred.

## MVP Completion TODOs
- **Auth wiring**
  - [x] Update leave route loaders to pass Supabase `session` + `apiBaseUrl` props down to child components.
  - [x] Refactor leave components to consume session/API context (e.g., via hooks or props) and remove hardcoded `session={null}`.
- **Frontend config**
  - [x] Expose backend URL through Vite (e.g., `import.meta.env.VITE_BACKEND_URL`) and replace `process.env.API_BASE_URL` usage across leave components.
  - [x] Add runtime guardrails/logging for missing API base URL.
- **Compliance logic**
  - [x] Extend `check_leave_balance` or new service to enforce minimum entitlement and negative-balance rules per leave type.
  - [x] Implement blackout-period validation in leave request handler with appropriate error messaging.
  - [x] Schedule unused-leave alert job (or document if deferred) and surface admin override workflows.
- **Reporting & exports**
  - [x] Define leave analytics API (utilization, trends) and back it with SQL views/materialized data.
  - [x] Build lightweight reporting UI (dashboard cards + CSV/PDF export) or adjust documentation expectations.
  - [x] Add smoke tests covering export endpoints.
- **QA & docs**
  - [x] Author regression checklist for multi-region holiday coverage and run at least one pass.
  - [x] Update enablement collateral once implementation items above land (setup checklist, FAQ).
- **Backlog hygiene**
  - [ ] Reconfirm Phase 2 scope/owners after MVP sign-off and park in roadmap tracker.

## Progress Notes
- ✅ Implementation complete: All MVP items delivered.
- ✅ Steps 1–3 from the frontend plan delivered: new `ApiProvider` shares session/base URL, leave routes consume the context, and downstream components shed `process.env` usage.
- ✅ Compliance logic implemented: Blackout periods, minimum entitlement checks, and validation functions are operational.
- ✅ Reporting & analytics delivered: Analytics endpoints, database views, and dashboard UI are complete.
- ✅ QA checklist created: Comprehensive regression test cases documented in `docs/qa/leave-absence-regression-checklist.md`.
