-- 20251119150000_employee_team_rls.sql
-- Purpose: tighten employee row-level security so that managers only see their direct reports
-- Notes:
--   * Owners, admins, and people ops retain full tenant-wide visibility.
--   * Managers are restricted to employees they directly manage.
--   * Individual employees can still see their own record.

drop policy if exists employees_read on public.employees;

create policy employees_read on public.employees
for select
to authenticated
using (
  -- service role bypass for system jobs
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = employees.tenant_id
      and m.role in ('owner', 'admin', 'people_ops')
  )
  or public.app_is_employee_manager(employees.id, employees.tenant_id)
  or employees.user_id = public.app_current_user_id()
);

comment on policy employees_read on public.employees is
  'Owners/admins/people_ops see all employees. Managers see direct reports. Individuals see their own record.';


