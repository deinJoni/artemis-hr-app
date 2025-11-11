# Time & Attendance Launch Collateral

## Employee Quick Start
- **Clock in/out:** Use the `My Time` widget on the dashboard; the primary button shows the current state and a running timer once clocked in (`apps/frontend/app/components/my-time-widget.tsx`).
- **Manual time entry:** Select `Manual Entry` from the same widget or the Time Entries page. Add date, start/end, and break minutes; past dates auto-route to manager approval.
- **Check hours and overtime:** The `My Time` widget displays weekly totals and PTO balance, while the Overtime card shows current period overtime and carry-over once logged in.
- **Request corrections:** Edit or delete entries from the Time Entries table when necessary; approvals will re-trigger if policy requires it.

## Manager Quick Start
- **Review pending approvals:** Visit `/time/approvals` to approve or reject manual and corrected entries; status badges reflect in the calendar after decision.
- **Monitor the team calendar:** The `/calendar` route defaults to the week view with active sessions, net hours, and break data surfaced in each event for quick triage.
- **Export data:** From the Time Entries page, generate the payroll CSV (`Export CSV`) for the current date range; the Team Calendar export remains available for schedule snapshots.
- **Overtime oversight:** Use `/time/overtime` to review current balances and rule thresholds before granting additional overtime.

## Support Runbook
- **Daily checks:** Confirm `/api/time/summary` and `/api/overtime/balance` responses succeed for a spot-check user; ensure audit logs (`/api/time/entries/:id/audit`) record recent edits.
- **Stuck clocks:** If entries show as active beyond shift end, managers should use the approvals page to adjust and include a reason for the audit trail.
- **Export issues:** Verify `GET /api/time/export` with default month-to-date parameters returns 200; inspect Supabase logs for permission denials if exports fail.
- **Incident escalation:** Gather affected user IDs, time entry IDs, and timestamps. Escalate with audit log snapshots and API responses to engineering for deeper analysis.
