-- Cross-functional approval workflows for equipment, training, and salary changes

-- 1. Table definition
create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category text not null check (category in ('equipment','training','salary_change')),
  status text not null default 'pending' check (status in ('pending','approved','denied','cancelled')),
  title text not null,
  summary text,
  justification text not null,
  details jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  needed_by date,
  requested_by_user_id uuid not null references auth.users(id) on delete cascade,
  requested_by_employee_id uuid references public.employees(id) on delete set null,
  approver_user_id uuid references auth.users(id) on delete set null,
  decision_reason text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approval_requests_tenant_idx on public.approval_requests (tenant_id);
create index if not exists approval_requests_status_idx on public.approval_requests (tenant_id, status);
create index if not exists approval_requests_category_idx on public.approval_requests (tenant_id, category);

create trigger set_updated_at_on_approval_requests
before update on public.approval_requests
for each row execute function public.set_updated_at();

alter table public.approval_requests enable row level security;

-- 2. Policies
create policy approval_requests_select_manage on public.approval_requests
for select to authenticated
using (public.app_has_permission('approvals.manage', tenant_id));

create policy approval_requests_insert_submit on public.approval_requests
for insert to authenticated
with check (public.app_has_permission('approvals.submit', tenant_id));

create policy approval_requests_update_manage on public.approval_requests
for update to authenticated
using (public.app_has_permission('approvals.manage', tenant_id))
with check (public.app_has_permission('approvals.manage', tenant_id));

-- 3. Permission seeds
insert into public.permissions (key) values
  ('approvals.submit'),
  ('approvals.manage')
on conflict do nothing;

insert into public.role_permissions (role, permission_key) values
  ('owner', 'approvals.submit'),
  ('owner', 'approvals.manage'),
  ('admin', 'approvals.submit'),
  ('admin', 'approvals.manage'),
  ('people_ops', 'approvals.submit'),
  ('people_ops', 'approvals.manage'),
  ('manager', 'approvals.submit'),
  ('manager', 'approvals.manage'),
  ('employee', 'approvals.submit')
on conflict do nothing;

-- 4. Summary view for joins with employees/departments
create or replace view public.approval_request_summary as
select
  ar.id,
  ar.tenant_id,
  ar.category,
  ar.status,
  ar.title,
  ar.summary,
  ar.justification,
  ar.details,
  ar.attachments,
  ar.needed_by,
  ar.requested_by_user_id,
  ar.requested_by_employee_id,
  ar.approver_user_id,
  ar.decision_reason,
  ar.requested_at,
  ar.decided_at,
  ar.created_at,
  ar.updated_at,
  e.name as requestor_name,
  e.job_title as requestor_job_title,
  d.name as department_name
from public.approval_requests ar
left join public.employees e on e.id = ar.requested_by_employee_id
left join public.departments d on d.id = e.department_id;

-- 5. Example seed entries per tenant for demo environments
insert into public.approval_requests (
  tenant_id,
  category,
  status,
  title,
  summary,
  justification,
  details,
  attachments,
  needed_by,
  requested_by_user_id,
  requested_by_employee_id,
  requested_at
)
select
  t.id,
  'equipment',
  'pending',
  'MacBook Pro 16" upgrade',
  'Design lead needs a spec bump before the Q3 rebrand sprint',
  'Current hardware is throttling when rendering motion assets. Upgrading to a 16" Pro keeps production on schedule.',
  jsonb_build_object(
    'itemType','Laptop',
    'specification','M3 Max, 64GB RAM, 2TB SSD',
    'justification','Required for heavy motion rendering workloads',
    'estimatedCost', 4299,
    'currency','USD',
    'urgency','high',
    'neededBy', to_char(now() + interval '10 day','YYYY-MM-DD')
  ),
  '[]'::jsonb,
  (now() + interval '10 day')::date,
  e.user_id,
  e.id,
  now() - interval '2 day'
from public.tenants t
cross join lateral (
  select e.id, e.user_id
  from public.employees e
  where e.tenant_id = t.id
  order by e.created_at
  limit 1
) as e
where not exists (
  select 1 from public.approval_requests existing
  where existing.tenant_id = t.id and existing.category = 'equipment'
);

insert into public.approval_requests (
  tenant_id,
  category,
  status,
  title,
  summary,
  justification,
  details,
  attachments,
  needed_by,
  requested_by_user_id,
  requested_by_employee_id,
  requested_at
)
select
  t.id,
  'training',
  'pending',
  'Product strategy certification',
  'Lead PM enrollment in Reforge to prep for the platform relaunch',
  'Training aligns the PM org on experimentation frameworks before the April launch window.',
  jsonb_build_object(
    'courseName','Reforge Product Strategy Sprint',
    'provider','Reforge',
    'schedule', to_char(now() + interval '20 day','YYYY-MM-DD'),
    'format','virtual',
    'estimatedCost', 1995,
    'currency','USD',
    'durationHours', 20,
    'expectedOutcome','Apply advanced strategy rituals to the data platform roadmap'
  ),
  '[]'::jsonb,
  (now() + interval '20 day')::date,
  e.user_id,
  e.id,
  now() - interval '1 day'
from public.tenants t
cross join lateral (
  select e.id, e.user_id
  from public.employees e
  where e.tenant_id = t.id
  order by e.created_at desc
  limit 1
) as e
where not exists (
  select 1 from public.approval_requests existing
  where existing.tenant_id = t.id and existing.category = 'training'
);

insert into public.approval_requests (
  tenant_id,
  category,
  status,
  title,
  summary,
  justification,
  details,
  attachments,
  needed_by,
  requested_by_user_id,
  requested_by_employee_id,
  requested_at
)
select
  t.id,
  'salary_change',
  'pending',
  'Senior AE promotion compensation change',
  'Adjust base salary and commission tier after exceeding targets three quarters in a row',
  'Move Alex Watson to the senior AE band and align compensation before the new fiscal year.',
  jsonb_build_object(
    'currentSalary', 115000,
    'proposedSalary', 128000,
    'currency','USD',
    'effectiveDate', to_char(now() + interval '30 day','YYYY-MM-DD'),
    'increasePercent', 0.113,
    'performanceSummary','Closed 135% of quota across the last 3 quarters while mentoring 2 junior reps'
  ),
  '[]'::jsonb,
  (now() + interval '30 day')::date,
  e.user_id,
  e.id,
  now() - interval '12 hour'
from public.tenants t
cross join lateral (
  select e.id, e.user_id
  from public.employees e
  where e.tenant_id = t.id
  order by e.updated_at desc
  limit 1
) as e
where not exists (
  select 1 from public.approval_requests existing
  where existing.tenant_id = t.id and existing.category = 'salary_change'
);
