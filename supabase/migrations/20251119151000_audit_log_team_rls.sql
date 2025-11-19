-- 20251119151000_audit_log_team_rls.sql
-- Purpose: align employee audit log visibility with employee/team access rules.

drop policy if exists employee_audit_log_read on public.employee_audit_log;

create policy employee_audit_log_read on public.employee_audit_log
for select
to authenticated
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = employee_audit_log.tenant_id
      and m.role in ('owner', 'admin', 'people_ops')
  )
  or public.app_is_employee_manager(employee_audit_log.employee_id, employee_audit_log.tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = employee_audit_log.employee_id
      and e.user_id = public.app_current_user_id()
  )
);

comment on policy employee_audit_log_read on public.employee_audit_log is
  'Owners/admins/people ops see all audit log entries. Managers see entries for their direct reports. Employees see their own history.';


