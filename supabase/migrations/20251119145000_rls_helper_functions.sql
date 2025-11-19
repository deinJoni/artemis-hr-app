-- 20251119145000_rls_helper_functions.sql
-- Purpose: introduce helper functions to support row-level security checks
-- Affected objects:
--   - public.app_get_user_employee_id(uuid)
--   - public.app_get_manager_employee_ids(uuid)
--   - public.app_is_employee_manager(uuid, uuid)
-- Notes:
--   * Functions run as security definer with search_path limited to public.
--   * These helpers can be referenced inside policies without recursive permission checks.

create or replace function public.app_get_user_employee_id(p_tenant_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select e.id
  from public.employees e
  where e.tenant_id = p_tenant_id
    and e.user_id = public.app_current_user_id()
  limit 1
$$;

comment on function public.app_get_user_employee_id(uuid) is
  'Returns the employee.id that belongs to the current auth user inside the given tenant.';

grant execute on function public.app_get_user_employee_id(uuid) to authenticated;

create or replace function public.app_get_manager_employee_ids(p_tenant_id uuid)
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    array_agg(e.id order by e.id),
    '{}'
  )
  from public.employees e
  where e.tenant_id = p_tenant_id
    and e.manager_id = public.app_get_user_employee_id(p_tenant_id)
$$;

comment on function public.app_get_manager_employee_ids(uuid) is
  'Returns an array of employee ids that are directly managed by the current auth user inside the given tenant.';

grant execute on function public.app_get_manager_employee_ids(uuid) to authenticated;

create or replace function public.app_is_employee_manager(p_employee_id uuid, p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = p_employee_id
      and e.tenant_id = p_tenant_id
      and e.manager_id = public.app_get_user_employee_id(p_tenant_id)
  )
$$;

comment on function public.app_is_employee_manager(uuid, uuid) is
  'Returns true when the current auth user manages the specified employee inside the given tenant.';

grant execute on function public.app_is_employee_manager(uuid, uuid) to authenticated;


