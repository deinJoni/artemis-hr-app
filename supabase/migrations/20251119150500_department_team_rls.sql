-- 20251119150500_department_team_rls.sql
-- Purpose: scope department visibility for managers to the departments that include their direct reports.
-- Owners, admins, and people ops retain tenant-wide access.

drop policy if exists departments_read on public.departments;

create policy departments_read on public.departments
for select
to authenticated
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = departments.tenant_id
      and m.role in ('owner', 'admin', 'people_ops')
  )
  or (
    exists (
      select 1
      from public.memberships m
      where m.user_id = public.app_current_user_id()
        and m.tenant_id = departments.tenant_id
        and m.role = 'manager'
    )
    and exists (
      select 1
      from public.employees e
      where e.tenant_id = departments.tenant_id
        and e.department_id = departments.id
        and e.manager_id = public.app_get_user_employee_id(departments.tenant_id)
    )
  )
);

comment on policy departments_read on public.departments is
  'Owners/admins/people ops see all departments. Managers see departments where their direct reports sit.';


