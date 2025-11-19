-- =============================================================================
-- Migration: 20260302000000_org_structure_enhancements.sql
-- Purpose : Add dotted-line manager support and create org structure view
--           for efficient organizational hierarchy queries
-- Changes :
--   1. Add dotted_line_manager_id column to employees table
--   2. Create org_structure_view combining employees, departments, teams, locations
--   3. Add indexes for performance on hierarchy queries
-- =============================================================================

-- 1) Add dotted-line manager support for matrix organizations
alter table if exists public.employees
  add column if not exists dotted_line_manager_id uuid references public.employees(id) on delete set null;

create index if not exists employees_dotted_line_manager_idx
  on public.employees (tenant_id, dotted_line_manager_id)
  where dotted_line_manager_id is not null;

comment on column public.employees.dotted_line_manager_id is
  'Optional dotted-line manager for matrix organization reporting relationships';

-- 2) Create comprehensive org structure view
create or replace view public.org_structure_view as
select
  e.id as employee_id,
  e.tenant_id,
  e.name as employee_name,
  e.email,
  e.job_title,
  e.employee_number,
  e.status,
  e.manager_id,
  e.dotted_line_manager_id,
  e.department_id,
  e.office_location_id,
  -- Manager information
  m.id as manager_employee_id,
  m.name as manager_name,
  m.email as manager_email,
  m.job_title as manager_job_title,
  -- Dotted-line manager information
  dlm.id as dotted_line_manager_employee_id,
  dlm.name as dotted_line_manager_name,
  dlm.email as dotted_line_manager_email,
  dlm.job_title as dotted_line_manager_job_title,
  -- Department information
  d.id as department_id_full,
  d.name as department_name,
  d.parent_id as department_parent_id,
  d.head_employee_id as department_head_id,
  d.cost_center,
  d.office_location_id as department_location_id,
  -- Office location information
  ol.id as location_id,
  ol.name as location_name,
  ol.timezone as location_timezone,
  ol.address as location_address,
  -- Team information (aggregated)
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'description', t.description,
        'team_lead_id', t.team_lead_id
      )
    )
    from public.teams t
    inner join public.team_members tm on tm.team_id = t.id
    where tm.employee_id = e.id
  ) as teams
from public.employees e
left join public.employees m on e.manager_id = m.id
left join public.employees dlm on e.dotted_line_manager_id = dlm.id
left join public.departments d on e.department_id = d.id
left join public.office_locations ol on e.office_location_id = ol.id
where e.status = 'active';

comment on view public.org_structure_view is
  'Comprehensive view of organizational structure combining employees, managers, departments, locations, and teams';

-- 3) Create index for manager hierarchy queries
create index if not exists employees_manager_hierarchy_idx
  on public.employees (tenant_id, manager_id, status)
  where status = 'active' and manager_id is not null;

-- 4) Grant access to the view (RLS will be handled by underlying tables)
grant select on public.org_structure_view to authenticated;

