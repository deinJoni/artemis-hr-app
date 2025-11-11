-- Onboarding & Offboarding MVP Migration
-- This migration creates tables for equipment tracking, access management, and exit interviews
-- Includes: equipment_items, access_grants, exit_interviews

-- ==============================================
-- 1. EQUIPMENT ITEMS TABLE
-- ==============================================

create table if not exists public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  type text not null check (type in ('laptop', 'monitor', 'keyboard', 'mouse', 'mobile_device', 'badge', 'access_card', 'other')),
  brand text,
  model text,
  serial_number text,
  status text not null default 'available' check (status in ('available', 'assigned', 'returned', 'maintenance', 'retired')),
  assigned_at timestamptz,
  returned_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_items_tenant_idx on public.equipment_items (tenant_id);
create index if not exists equipment_items_employee_idx on public.equipment_items (tenant_id, employee_id);
create index if not exists equipment_items_status_idx on public.equipment_items (tenant_id, status);
create index if not exists equipment_items_type_idx on public.equipment_items (tenant_id, type);
create index if not exists equipment_items_serial_idx on public.equipment_items (tenant_id, serial_number)
where serial_number is not null;

-- ==============================================
-- 2. ACCESS GRANTS TABLE
-- ==============================================

create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  system_name text not null,
  system_type text check (system_type in ('email', 'vpn', 'application', 'building', 'cloud_service', 'other')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  granted_by uuid references auth.users(id) on delete set null,
  revoked_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists access_grants_tenant_employee_idx on public.access_grants (tenant_id, employee_id);
create index if not exists access_grants_system_idx on public.access_grants (tenant_id, system_name);
create index if not exists access_grants_active_idx on public.access_grants (tenant_id, employee_id, revoked_at)
where revoked_at is null;
create index if not exists access_grants_granted_at_idx on public.access_grants (tenant_id, granted_at desc);

-- ==============================================
-- 3. EXIT INTERVIEWS TABLE
-- ==============================================

create table if not exists public.exit_interviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  conducted_at timestamptz not null default now(),
  reason_for_leaving text check (reason_for_leaving in ('resignation', 'termination', 'retirement', 'contract_end', 'other')),
  job_satisfaction_rating integer check (job_satisfaction_rating >= 1 and job_satisfaction_rating <= 5),
  manager_relationship_rating integer check (manager_relationship_rating >= 1 and manager_relationship_rating <= 5),
  company_culture_rating integer check (company_culture_rating >= 1 and company_culture_rating <= 5),
  would_recommend boolean,
  feedback_json jsonb,
  is_anonymous boolean not null default false,
  conducted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exit_interviews_tenant_employee_idx on public.exit_interviews (tenant_id, employee_id);
create index if not exists exit_interviews_conducted_at_idx on public.exit_interviews (tenant_id, conducted_at desc);
create index if not exists exit_interviews_reason_idx on public.exit_interviews (tenant_id, reason_for_leaving);

-- ==============================================
-- 4. TRIGGERS
-- ==============================================

create trigger set_updated_at_on_equipment_items
before update on public.equipment_items
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_access_grants
before update on public.access_grants
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_exit_interviews
before update on public.exit_interviews
for each row
execute function public.set_updated_at();

-- ==============================================
-- 5. ROW LEVEL SECURITY
-- ==============================================

alter table public.equipment_items enable row level security;
alter table public.access_grants enable row level security;
alter table public.exit_interviews enable row level security;

-- Equipment items policies
create policy equipment_items_read on public.equipment_items
for select to authenticated
using (public.app_has_permission('employees.read', tenant_id));

create policy equipment_items_write on public.equipment_items
for all to authenticated
using (public.app_has_permission('employees.write', tenant_id))
with check (public.app_has_permission('employees.write', tenant_id));

-- Access grants policies
create policy access_grants_read on public.access_grants
for select to authenticated
using (public.app_has_permission('employees.read', tenant_id));

create policy access_grants_write on public.access_grants
for all to authenticated
using (public.app_has_permission('employees.write', tenant_id))
with check (public.app_has_permission('employees.write', tenant_id));

-- Exit interviews policies
create policy exit_interviews_read on public.exit_interviews
for select to authenticated
using (public.app_has_permission('employees.read', tenant_id));

create policy exit_interviews_write on public.exit_interviews
for all to authenticated
using (public.app_has_permission('employees.write', tenant_id))
with check (public.app_has_permission('employees.write', tenant_id));

-- Allow employees to submit their own exit interview
create policy exit_interviews_insert_self on public.exit_interviews
for insert to authenticated
with check (
  exists (
    select 1
    from public.employees e
    where e.id = exit_interviews.employee_id
      and e.user_id = public.app_current_user_id()
      and e.tenant_id = exit_interviews.tenant_id
  )
);

-- ==============================================
-- 6. HELPER VIEWS
-- ==============================================

create or replace view public.equipment_summary as
select 
  ei.id,
  ei.tenant_id,
  ei.employee_id,
  ei.type,
  ei.brand,
  ei.model,
  ei.serial_number,
  ei.status,
  ei.assigned_at,
  ei.returned_at,
  ei.notes,
  ei.created_at,
  ei.updated_at,
  e.name as employee_name,
  e.email as employee_email,
  e.employee_number
from public.equipment_items ei
left join public.employees e on ei.employee_id = e.id;

create or replace view public.access_grants_summary as
select 
  ag.id,
  ag.tenant_id,
  ag.employee_id,
  ag.system_name,
  ag.system_type,
  ag.granted_at,
  ag.revoked_at,
  ag.granted_by,
  ag.revoked_by,
  ag.notes,
  ag.created_at,
  ag.updated_at,
  e.name as employee_name,
  e.email as employee_email,
  e.employee_number,
  granter.name as granted_by_name,
  revoker.name as revoked_by_name,
  case when ag.revoked_at is null then true else false end as is_active
from public.access_grants ag
left join public.employees e on ag.employee_id = e.id
left join public.employees granter on ag.granted_by = granter.user_id and ag.tenant_id = granter.tenant_id
left join public.employees revoker on ag.revoked_by = revoker.user_id and ag.tenant_id = revoker.tenant_id;

create or replace view public.exit_interview_summary as
select 
  ei.id,
  ei.tenant_id,
  ei.employee_id,
  ei.conducted_at,
  ei.reason_for_leaving,
  ei.job_satisfaction_rating,
  ei.manager_relationship_rating,
  ei.company_culture_rating,
  ei.would_recommend,
  ei.feedback_json,
  ei.is_anonymous,
  ei.conducted_by,
  ei.created_at,
  ei.updated_at,
  e.name as employee_name,
  e.email as employee_email,
  e.employee_number,
  conductor.name as conducted_by_name
from public.exit_interviews ei
left join public.employees e on ei.employee_id = e.id
left join public.employees conductor on ei.conducted_by = conductor.user_id and ei.tenant_id = conductor.tenant_id;

