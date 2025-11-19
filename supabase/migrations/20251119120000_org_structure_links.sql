-- =============================================================================
-- Migration: 20251119120000_org_structure_links.sql
-- Purpose : Link departments and teams to office locations and expose location
--           metadata through the department_hierarchy view.
-- Changes :
--   1. Add office_location_id columns to departments and teams.
--   2. Create supporting indexes for tenant/location lookups.
--   3. Refresh department_hierarchy view to include location context.
-- =============================================================================

-- 1) Extend departments with office location reference
alter table if exists public.departments
  add column if not exists office_location_id uuid references public.office_locations(id) on delete set null;

create index if not exists departments_location_idx
  on public.departments (tenant_id, office_location_id)
  where office_location_id is not null;

-- 2) Extend teams with office location reference
alter table if exists public.teams
  add column if not exists office_location_id uuid references public.office_locations(id) on delete set null;

create index if not exists teams_location_idx
  on public.teams (tenant_id, office_location_id)
  where office_location_id is not null;

-- 3) Recreate department_hierarchy view with location metadata
drop view if exists public.department_hierarchy;

create view public.department_hierarchy as
with recursive dept_tree as (
  select
    d.id,
    d.tenant_id,
    d.name,
    d.description,
    d.parent_id,
    d.head_employee_id,
    d.cost_center,
    d.office_location_id,
    0 as level,
    array[d.id] as path,
    d.name as full_path
  from public.departments d
  where d.parent_id is null

  union all

  select
    d.id,
    d.tenant_id,
    d.name,
    d.description,
    d.parent_id,
    d.head_employee_id,
    d.cost_center,
    d.office_location_id,
    dt.level + 1,
    dt.path || d.id,
    dt.full_path || ' > ' || d.name
  from public.departments d
  join dept_tree dt on d.parent_id = dt.id
)
select
  dt.*,
  e.name as head_name,
  e.email as head_email,
  (select count(*) from public.employees where department_id = dt.id) as employee_count,
  ol.name as office_location_name,
  ol.timezone as office_location_timezone
from dept_tree dt
left join public.employees e on dt.head_employee_id = e.id
left join public.office_locations ol on dt.office_location_id = ol.id
order by dt.tenant_id, dt.level, dt.name;

comment on column public.departments.office_location_id is
  'Optional reference to the department''s primary office location';

comment on column public.teams.office_location_id is
  'Optional reference to the team''s primary office location';

