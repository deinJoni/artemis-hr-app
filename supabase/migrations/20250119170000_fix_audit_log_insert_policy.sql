-- ==============================================
-- Fix: Add INSERT policy for employee_audit_log
-- ==============================================
-- The employee_audit_log table had RLS enabled but only a SELECT policy.
-- This migration adds an INSERT policy to allow audit log entries to be created
-- when users with employees.write permission make changes.

-- Allow authenticated users to insert audit log entries when:
-- 1. They have employees.write permission for the tenant, OR
-- 2. They are logging their own action (changed_by matches current user)
-- This ensures audit logs can always be created for actions the user is performing
create policy "employee_audit_log_insert" on public.employee_audit_log
for insert
to authenticated
with check (
  public.app_has_permission('employees.write', tenant_id)
  OR changed_by = (select auth.uid())
);

