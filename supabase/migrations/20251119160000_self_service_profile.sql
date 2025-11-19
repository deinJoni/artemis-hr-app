-- 20251119160000_self_service_profile.sql
-- Purpose: enable employee self-service profile updates that require manager approval

-- Extend approval categories to cover self-service profile changes
alter table public.approval_requests
  drop constraint if exists approval_requests_category_check;

alter table public.approval_requests
  add constraint approval_requests_category_check
  check (
    category in ('equipment','training','salary_change','profile_change')
  );

-- Table to store drafted and routed self-service profile change requests
create table if not exists public.employee_profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','pending','approved','denied','cancelled')),
  fields jsonb not null default '{}'::jsonb,
  current_snapshot jsonb not null default '{}'::jsonb,
  justification text,
  approval_request_id uuid references public.approval_requests(id) on delete set null,
  submitted_by_user_id uuid not null references auth.users(id) on delete cascade,
  submitted_at timestamptz,
  decided_at timestamptz,
  decision_reason text,
  approver_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_profile_change_requests_employee_idx
  on public.employee_profile_change_requests (tenant_id, employee_id, status);

create unique index if not exists employee_profile_change_requests_open_unique
  on public.employee_profile_change_requests (employee_id)
  where status in ('draft','pending');

create trigger set_updated_at_on_employee_profile_change_requests
before update on public.employee_profile_change_requests
for each row execute function public.set_updated_at();

alter table public.employee_profile_change_requests enable row level security;

create policy employee_profile_change_requests_select
on public.employee_profile_change_requests
for select to authenticated
using (
  public.app_has_permission('employees.write', tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = employee_profile_change_requests.employee_id
      and e.user_id = public.app_current_user_id()
  )
);

create policy employee_profile_change_requests_insert
on public.employee_profile_change_requests
for insert to authenticated
with check (
  exists (
    select 1
    from public.employees e
    where e.id = employee_profile_change_requests.employee_id
      and e.user_id = public.app_current_user_id()
  )
);

create policy employee_profile_change_requests_update_self
on public.employee_profile_change_requests
for update to authenticated
using (
  status = 'draft'
  and exists (
    select 1
    from public.employees e
    where e.id = employee_profile_change_requests.employee_id
      and e.user_id = public.app_current_user_id()
  )
)
with check (
  status = 'draft'
  and exists (
    select 1
    from public.employees e
    where e.id = employee_profile_change_requests.employee_id
      and e.user_id = public.app_current_user_id()
  )
);

create policy employee_profile_change_requests_update_manage
on public.employee_profile_change_requests
for update to authenticated
using (public.app_has_permission('employees.write', tenant_id))
with check (public.app_has_permission('employees.write', tenant_id));

create policy employee_profile_change_requests_delete_self
on public.employee_profile_change_requests
for delete to authenticated
using (
  status = 'draft'
  and exists (
    select 1
    from public.employees e
    where e.id = employee_profile_change_requests.employee_id
      and e.user_id = public.app_current_user_id()
  )
);
