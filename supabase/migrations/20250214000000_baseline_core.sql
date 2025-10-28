-- Idempotent: safe to re-run on local environments.

do $$
begin
  if not exists (
    select 1
    from pg_extension
    where extname = 'pgcrypto'
  ) then
    execute 'create extension "pgcrypto"';
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('owner', 'admin', 'manager', 'employee');
  end if;
end
$$;

create or replace function public.app_current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  company_name text,
  company_location text,
  company_size text,
  contact_name text,
  contact_email text,
  contact_phone text,
  key_priorities text,
  needs_summary text,
  onboarding_step smallint not null default 0,
  setup_completed boolean not null default false,
  activated_at timestamptz
);

create table if not exists public.memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role app_role not null default 'employee',
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

create table if not exists public.permissions (
  key text primary key
);

create table if not exists public.role_permissions (
  role app_role not null,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role, permission_key)
);

create or replace function public.app_has_permission(permission text, tenant uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.memberships m
    join public.role_permissions rp on rp.role = m.role
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = tenant
      and (rp.permission_key = permission or m.role = 'owner')
  )
$$;

create or replace function public.app_create_tenant(p_name text)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public.app_current_user_id();
  v_tenant public.tenants;
begin
  if v_user is null then
    raise exception 'unauthorized';
  end if;

  insert into public.tenants(name)
  values (p_name)
  returning * into v_tenant;

  insert into public.memberships(user_id, tenant_id, role)
  values (v_user, v_tenant.id, 'owner')
  on conflict do nothing;

  return v_tenant;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public._drop_trigger_if_exists(schema_name text, table_name text, trigger_name text)
returns void
language plpgsql
as $$
begin
  if exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = trigger_name
      and n.nspname = schema_name
      and c.relname = table_name
  ) then
    execute format('drop trigger %I on %I.%I', trigger_name, schema_name, table_name);
  end if;
end;
$$;

create or replace function public._drop_policy_if_exists(schema_name text, table_name text, policy_name text)
returns void
language plpgsql
as $$
begin
  if exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.polname = policy_name
      and n.nspname = schema_name
      and c.relname = table_name
  ) then
    execute format('drop policy %I on %I.%I', policy_name, schema_name, table_name);
  end if;
end;
$$;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  name text not null,
  manager_id uuid references public.employees(id),
  created_at timestamptz not null default now(),
  custom_fields jsonb
);

create index if not exists employees_tenant_email_idx
  on public.employees (tenant_id, email);

create table if not exists public.employee_custom_field_defs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  key text not null,
  type text not null check (type in ('text','number','date','select','boolean')),
  required boolean not null default false,
  options jsonb,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create index if not exists employee_custom_field_defs_tenant_idx
  on public.employee_custom_field_defs (tenant_id, position, created_at);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  display_name text not null,
  pto_balance_days numeric(6,2) not null default 0,
  sick_balance_days numeric(6,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'pto_balance_days'
  ) then
    execute 'alter table public.profiles add column pto_balance_days numeric(6,2) not null default 0';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'sick_balance_days'
  ) then
    execute 'alter table public.profiles add column sick_balance_days numeric(6,2) not null default 0';
  end if;
end;
$$;

select public._drop_trigger_if_exists('public','profiles','set_updated_at_on_profiles');
create trigger set_updated_at_on_profiles
before update on public.profiles
for each row
execute function public.set_updated_at();

create table if not exists public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('onboarding','offboarding')),
  name text not null,
  description text,
  blocks jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflow_templates_kind_idx
  on public.workflow_templates (kind);

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  kind text not null check (kind in ('onboarding','offboarding')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  active_version_id uuid,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists public.workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  version_number int not null,
  is_active boolean not null default false,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  published_at timestamptz,
  unique (workflow_id, version_number)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workflows_active_version_fk'
      and conrelid = 'public.workflows'::regclass
  ) then
    alter table public.workflows
      add constraint workflows_active_version_fk
      foreign key (active_version_id) references public.workflow_versions(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists workflow_versions_workflow_idx
  on public.workflow_versions (workflow_id, is_active);

create table if not exists public.workflow_nodes (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.workflow_versions(id) on delete cascade,
  node_key text not null,
  type text not null check (type in ('trigger','action','delay','logic')),
  label text,
  config jsonb,
  ui_position jsonb,
  created_at timestamptz not null default now(),
  unique (version_id, node_key)
);

create table if not exists public.workflow_edges (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.workflow_versions(id) on delete cascade,
  source_node_id uuid not null references public.workflow_nodes(id) on delete cascade,
  target_node_id uuid not null references public.workflow_nodes(id) on delete cascade,
  condition jsonb,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists workflow_edges_version_idx
  on public.workflow_edges (version_id);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  version_id uuid not null references public.workflow_versions(id),
  employee_id uuid references public.employees(id) on delete set null,
  trigger_source text,
  status text not null default 'pending' check (status in ('pending','in_progress','paused','completed','canceled','failed')),
  started_at timestamptz default now(),
  completed_at timestamptz,
  canceled_at timestamptz,
  failed_at timestamptz,
  last_error text,
  context jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workflow_runs_tenant_status_idx
  on public.workflow_runs (tenant_id, status);

create table if not exists public.workflow_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  node_id uuid not null references public.workflow_nodes(id),
  status text not null default 'pending' check (status in ('pending','queued','waiting_input','in_progress','completed','failed','canceled')),
  assigned_to jsonb,
  due_at timestamptz,
  payload jsonb,
  result jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists workflow_run_steps_run_idx
  on public.workflow_run_steps (run_id, status);

create table if not exists public.workflow_action_queue (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  node_id uuid references public.workflow_nodes(id) on delete set null,
  resume_at timestamptz not null,
  attempts int not null default 0,
  last_error text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workflow_action_queue_resume_idx
  on public.workflow_action_queue (resume_at);

create table if not exists public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists workflow_events_run_idx
  on public.workflow_events (run_id, created_at);

create table if not exists public.employee_journey_views (
  run_id uuid primary key references public.workflow_runs(id) on delete cascade,
  share_token uuid not null default gen_random_uuid(),
  hero_copy text,
  cta_label text,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists employee_journey_views_share_idx
  on public.employee_journey_views (share_token);

select public._drop_trigger_if_exists('public','workflows','set_updated_at_on_workflows');
create trigger set_updated_at_on_workflows
before update on public.workflows
for each row
execute function public.set_updated_at();

select public._drop_trigger_if_exists('public','employee_journey_views','set_updated_at_on_journey_views');
create trigger set_updated_at_on_journey_views
before update on public.employee_journey_views
for each row
execute function public.set_updated_at();

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','completed')),
  progress_pct numeric(5,2) not null default 0,
  due_date date,
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_tenant_employee_idx
  on public.goals (tenant_id, employee_id, status);

create table if not exists public.goal_key_results (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  label text not null,
  target_value numeric,
  current_value numeric,
  status text not null default 'pending' check (status in ('pending','in_progress','achieved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goal_key_results_goal_idx
  on public.goal_key_results (goal_id);

create table if not exists public.goal_updates (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists goal_updates_goal_idx
  on public.goal_updates (goal_id, created_at desc);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  manager_user_id uuid not null references auth.users(id),
  employee_id uuid not null references public.employees(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','completed')),
  scheduled_for timestamptz,
  completed_at timestamptz,
  last_updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists check_ins_tenant_employee_idx
  on public.check_ins (tenant_id, employee_id, status);

create table if not exists public.check_in_agendas (
  check_in_id uuid primary key references public.check_ins(id) on delete cascade,
  accomplishments text,
  priorities text,
  roadblocks text,
  notes_json jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.check_in_private_notes (
  check_in_id uuid primary key references public.check_ins(id) on delete cascade,
  manager_user_id uuid not null references auth.users(id),
  body text,
  created_at timestamptz not null default now()
);

create or replace view public.employee_goal_summaries as
select
  e.id as employee_id,
  e.tenant_id,
  count(g.id) filter (where g.status <> 'completed') as active_goals,
  coalesce(count(g.id), 0) as total_goals,
  coalesce(sum(case when g.status = 'completed' then 1 else 0 end), 0) as completed_goals,
  coalesce(avg(g.progress_pct), 0)::numeric(5,2) as avg_progress_pct,
  (
    select max(ci.completed_at)
    from public.check_ins ci
    where ci.employee_id = e.id
      and ci.tenant_id = e.tenant_id
      and ci.status = 'completed'
  ) as last_check_in_at
from public.employees e
left join public.goals g on g.employee_id = e.id and g.tenant_id = e.tenant_id
group by e.id, e.tenant_id;

select public._drop_trigger_if_exists('public','goals','set_updated_at_on_goals');
create trigger set_updated_at_on_goals
before update on public.goals
for each row
execute function public.set_updated_at();

select public._drop_trigger_if_exists('public','goal_key_results','set_updated_at_on_goal_key_results');
create trigger set_updated_at_on_goal_key_results
before update on public.goal_key_results
for each row
execute function public.set_updated_at();

select public._drop_trigger_if_exists('public','check_ins','set_updated_at_on_check_ins');
create trigger set_updated_at_on_check_ins
before update on public.check_ins
for each row
execute function public.set_updated_at();

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  duration_minutes int generated always as (
    case
      when clock_out_at is null then null
      else (extract(epoch from (clock_out_at - clock_in_at)) / 60)::int
    end
  ) stored,
  location jsonb,
  created_at timestamptz not null default now()
);

create index if not exists time_entries_tenant_user_in_idx
  on public.time_entries (tenant_id, user_id, clock_in_at);

create index if not exists time_entries_tenant_in_idx
  on public.time_entries (tenant_id, clock_in_at);

create unique index if not exists time_entries_unique_open
  on public.time_entries (tenant_id, user_id)
  where clock_out_at is null;

create table if not exists public.time_off_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  leave_type text not null check (leave_type in ('vacation','sick','personal','unpaid','other')),
  status text not null default 'pending' check (status in ('pending','approved','denied','cancelled')),
  approver_user_id uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  constraint time_off_requests_date_range_chk check (start_date <= end_date)
);

create index if not exists time_off_requests_tenant_user_start_idx
  on public.time_off_requests (tenant_id, user_id, start_date);

create index if not exists time_off_requests_tenant_status_idx
  on public.time_off_requests (tenant_id, status);

-- Enable RLS
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.employees enable row level security;
alter table public.employee_custom_field_defs enable row level security;
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.workflow_templates enable row level security;
alter table public.workflows enable row level security;
alter table public.workflow_versions enable row level security;
alter table public.workflow_nodes enable row level security;
alter table public.workflow_edges enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.workflow_run_steps enable row level security;
alter table public.workflow_action_queue enable row level security;
alter table public.workflow_events enable row level security;
alter table public.employee_journey_views enable row level security;
alter table public.goals enable row level security;
alter table public.goal_key_results enable row level security;
alter table public.goal_updates enable row level security;
alter table public.check_ins enable row level security;
alter table public.check_in_agendas enable row level security;
alter table public.check_in_private_notes enable row level security;
alter table public.time_entries enable row level security;
alter table public.time_off_requests enable row level security;

-- Permission tables
select public._drop_policy_if_exists('public','permissions','permissions_select_authenticated');
create policy permissions_select_authenticated
on public.permissions
for select
to authenticated
using ( true );

select public._drop_policy_if_exists('public','permissions','permissions_manage_service');
create policy permissions_manage_service
on public.permissions
for all
to service_role
using ( true )
with check ( true );

select public._drop_policy_if_exists('public','role_permissions','role_permissions_select_authenticated');
create policy role_permissions_select_authenticated
on public.role_permissions
for select
to authenticated
using ( true );

select public._drop_policy_if_exists('public','role_permissions','role_permissions_manage_service');
create policy role_permissions_manage_service
on public.role_permissions
for all
to service_role
using ( true )
with check ( true );

-- Tenant policies
select public._drop_policy_if_exists('public','tenants','tenants_select_own');
create policy tenants_select_own
on public.tenants
for select
to authenticated
using (
  exists (
    select 1 from public.memberships m
    where m.tenant_id = tenants.id
      and m.user_id = public.app_current_user_id()
  )
);

select public._drop_policy_if_exists('public','tenants','tenants_update_admins');
create policy tenants_update_admins
on public.tenants
for update
to authenticated
using ( public.app_has_permission('members.manage', tenants.id) )
with check ( public.app_has_permission('members.manage', tenants.id) );

-- Membership policies
select public._drop_policy_if_exists('public','memberships','memberships_select_self');
create policy memberships_select_self
on public.memberships
for select
to authenticated
using ( user_id = public.app_current_user_id() );

select public._drop_policy_if_exists('public','memberships','memberships_insert_by_admins');
create policy memberships_insert_by_admins
on public.memberships
for insert
to authenticated
with check (
  public.app_has_permission('members.manage', memberships.tenant_id)
  and (
    memberships.role <> 'owner'
    or exists (
      select 1
      from public.memberships owner
      where owner.tenant_id = memberships.tenant_id
        and owner.user_id = public.app_current_user_id()
        and owner.role = 'owner'
    )
  )
);

select public._drop_policy_if_exists('public','memberships','memberships_update_by_admins');
create policy memberships_update_by_admins
on public.memberships
for update
to authenticated
using (
  public.app_has_permission('members.manage', memberships.tenant_id)
  and (
    memberships.role <> 'owner'
    or exists (
      select 1
      from public.memberships owner
      where owner.tenant_id = memberships.tenant_id
        and owner.user_id = public.app_current_user_id()
        and owner.role = 'owner'
    )
  )
)
with check (
  public.app_has_permission('members.manage', memberships.tenant_id)
  and (
    memberships.role <> 'owner'
    or exists (
      select 1
      from public.memberships owner
      where owner.tenant_id = memberships.tenant_id
        and owner.user_id = public.app_current_user_id()
        and owner.role = 'owner'
    )
  )
);

select public._drop_policy_if_exists('public','memberships','memberships_delete_by_admins');
create policy memberships_delete_by_admins
on public.memberships
for delete
to authenticated
using (
  public.app_has_permission('members.manage', memberships.tenant_id)
  and (
    memberships.role <> 'owner'
    or exists (
      select 1
      from public.memberships owner
      where owner.tenant_id = memberships.tenant_id
        and owner.user_id = public.app_current_user_id()
        and owner.role = 'owner'
    )
  )
);

-- Employee tables
select public._drop_policy_if_exists('public','employees','employees_read');
create policy employees_read
on public.employees
for select
to authenticated
using ( public.app_has_permission('employees.read', employees.tenant_id) );

select public._drop_policy_if_exists('public','employees','employees_write_insert');
create policy employees_write_insert
on public.employees
for insert
to authenticated
with check ( public.app_has_permission('employees.write', employees.tenant_id) );

select public._drop_policy_if_exists('public','employees','employees_write_update');
create policy employees_write_update
on public.employees
for update
to authenticated
using ( public.app_has_permission('employees.write', employees.tenant_id) )
with check ( public.app_has_permission('employees.write', employees.tenant_id) );

select public._drop_policy_if_exists('public','employees','employees_write_delete');
create policy employees_write_delete
on public.employees
for delete
to authenticated
using ( public.app_has_permission('employees.write', employees.tenant_id) );

select public._drop_policy_if_exists('public','employee_custom_field_defs','employee_field_defs_read');
create policy employee_field_defs_read
on public.employee_custom_field_defs
for select
to authenticated
using ( public.app_has_permission('employees.read', employee_custom_field_defs.tenant_id) );

select public._drop_policy_if_exists('public','employee_custom_field_defs','employee_field_defs_write_insert');
create policy employee_field_defs_write_insert
on public.employee_custom_field_defs
for insert
to authenticated
with check ( public.app_has_permission('employees.fields.manage', employee_custom_field_defs.tenant_id) );

select public._drop_policy_if_exists('public','employee_custom_field_defs','employee_field_defs_write_update');
create policy employee_field_defs_write_update
on public.employee_custom_field_defs
for update
to authenticated
using ( public.app_has_permission('employees.fields.manage', employee_custom_field_defs.tenant_id) )
with check ( public.app_has_permission('employees.fields.manage', employee_custom_field_defs.tenant_id) );

select public._drop_policy_if_exists('public','employee_custom_field_defs','employee_field_defs_write_delete');
create policy employee_field_defs_write_delete
on public.employee_custom_field_defs
for delete
to authenticated
using ( public.app_has_permission('employees.fields.manage', employee_custom_field_defs.tenant_id) );

select public._drop_policy_if_exists('public','profiles','profiles_select_self');
create policy profiles_select_self
on public.profiles
for select
to authenticated
using ( user_id = public.app_current_user_id() );

select public._drop_policy_if_exists('public','profiles','profiles_insert_self');
create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (
  user_id = public.app_current_user_id()
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = profiles.tenant_id
  )
);

select public._drop_policy_if_exists('public','profiles','profiles_update_self');
create policy profiles_update_self
on public.profiles
for update
to authenticated
using (
  user_id = public.app_current_user_id()
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = profiles.tenant_id
  )
)
with check (
  user_id = public.app_current_user_id()
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = profiles.tenant_id
  )
);

-- Workflow policies
select public._drop_policy_if_exists('public','workflow_templates','workflow_templates_select_all');
create policy workflow_templates_select_all
on public.workflow_templates
for select
to authenticated
using ( true );

select public._drop_policy_if_exists('public','workflows','workflows_select');
create policy workflows_select
on public.workflows
for select
to authenticated
using (
  public.app_has_permission('workflows.read', workflows.tenant_id)
  or public.app_has_permission('workflows.manage', workflows.tenant_id)
);

select public._drop_policy_if_exists('public','workflows','workflows_modify');
create policy workflows_modify
on public.workflows
for all
to authenticated
using ( public.app_has_permission('workflows.manage', workflows.tenant_id) )
with check ( public.app_has_permission('workflows.manage', workflows.tenant_id) );

select public._drop_policy_if_exists('public','workflow_versions','workflow_versions_access');
create policy workflow_versions_access
on public.workflow_versions
for all
to authenticated
using (
  exists (
    select 1
    from public.workflows w
    where w.id = workflow_versions.workflow_id
      and (
        public.app_has_permission('workflows.read', w.tenant_id)
        or public.app_has_permission('workflows.manage', w.tenant_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.workflows w
    where w.id = workflow_versions.workflow_id
      and public.app_has_permission('workflows.manage', w.tenant_id)
  )
);

select public._drop_policy_if_exists('public','workflow_nodes','workflow_nodes_access');
create policy workflow_nodes_access
on public.workflow_nodes
for all
to authenticated
using (
  exists (
    select 1
    from public.workflow_versions v
    join public.workflows w on w.id = v.workflow_id
    where v.id = workflow_nodes.version_id
      and (
        public.app_has_permission('workflows.read', w.tenant_id)
        or public.app_has_permission('workflows.manage', w.tenant_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_versions v
    join public.workflows w on w.id = v.workflow_id
    where v.id = workflow_nodes.version_id
      and public.app_has_permission('workflows.manage', w.tenant_id)
  )
);

select public._drop_policy_if_exists('public','workflow_edges','workflow_edges_access');
create policy workflow_edges_access
on public.workflow_edges
for all
to authenticated
using (
  exists (
    select 1
    from public.workflow_versions v
    join public.workflows w on w.id = v.workflow_id
    where v.id = workflow_edges.version_id
      and (
        public.app_has_permission('workflows.read', w.tenant_id)
        or public.app_has_permission('workflows.manage', w.tenant_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_versions v
    join public.workflows w on w.id = v.workflow_id
    where v.id = workflow_edges.version_id
      and public.app_has_permission('workflows.manage', w.tenant_id)
  )
);

select public._drop_policy_if_exists('public','workflow_runs','workflow_runs_select');
create policy workflow_runs_select
on public.workflow_runs
for select
to authenticated
using (
  public.app_has_permission('workflows.read', workflow_runs.tenant_id)
  or public.app_has_permission('workflows.run.manage', workflow_runs.tenant_id)
  or public.app_has_permission('workflows.manage', workflow_runs.tenant_id)
);

select public._drop_policy_if_exists('public','workflow_runs','workflow_runs_modify');
create policy workflow_runs_modify
on public.workflow_runs
for all
to authenticated
using (
  public.app_has_permission('workflows.run.manage', workflow_runs.tenant_id)
  or public.app_has_permission('workflows.manage', workflow_runs.tenant_id)
)
with check (
  public.app_has_permission('workflows.run.manage', workflow_runs.tenant_id)
  or public.app_has_permission('workflows.manage', workflow_runs.tenant_id)
);

select public._drop_policy_if_exists('public','workflow_run_steps','workflow_run_steps_access');
create policy workflow_run_steps_access
on public.workflow_run_steps
for all
to authenticated
using (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = workflow_run_steps.run_id
      and (
        public.app_has_permission('workflows.read', r.tenant_id)
        or public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = workflow_run_steps.run_id
      and (
        public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
);

select public._drop_policy_if_exists('public','workflow_action_queue','workflow_action_queue_access');
create policy workflow_action_queue_access
on public.workflow_action_queue
for all
to authenticated
using (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = workflow_action_queue.run_id
      and (
        public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = workflow_action_queue.run_id
      and (
        public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
);

select public._drop_policy_if_exists('public','workflow_events','workflow_events_access');
create policy workflow_events_access
on public.workflow_events
for all
to authenticated
using (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = workflow_events.run_id
      and (
        public.app_has_permission('workflows.read', r.tenant_id)
        or public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = workflow_events.run_id
      and (
        public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
);

select public._drop_policy_if_exists('public','employee_journey_views','employee_journey_views_access');
create policy employee_journey_views_access
on public.employee_journey_views
for all
to authenticated
using (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = employee_journey_views.run_id
      and (
        public.app_has_permission('workflows.read', r.tenant_id)
        or public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = employee_journey_views.run_id
      and (
        public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
);

-- Goals/check-ins policies (email match uses auth.jwt())
select public._drop_policy_if_exists('public','goals','goals_select');
create policy goals_select
on public.goals
for select
to authenticated
using (
  public.app_has_permission('goals.read', tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = goals.employee_id
      and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  )
);

select public._drop_policy_if_exists('public','goals','goals_insert');
create policy goals_insert
on public.goals
for insert
to authenticated
with check (
  public.app_has_permission('goals.write', tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = goals.employee_id
      and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  )
);

select public._drop_policy_if_exists('public','goals','goals_update');
create policy goals_update
on public.goals
for update
to authenticated
using (
  public.app_has_permission('goals.write', tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = goals.employee_id
      and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  )
)
with check (
  public.app_has_permission('goals.write', tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = goals.employee_id
      and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  )
);

select public._drop_policy_if_exists('public','goals','goals_delete');
create policy goals_delete
on public.goals
for delete
to authenticated
using (
  public.app_has_permission('goals.write', tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = goals.employee_id
      and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  )
);

select public._drop_policy_if_exists('public','goal_key_results','goal_key_results_select');
create policy goal_key_results_select
on public.goal_key_results
for select
to authenticated
using (
  exists (
    select 1
    from public.goals g
    where g.id = goal_key_results.goal_id
      and (
        public.app_has_permission('goals.read', g.tenant_id)
        or exists (
          select 1
          from public.employees e
          where e.id = g.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
);

select public._drop_policy_if_exists('public','goal_key_results','goal_key_results_write');
create policy goal_key_results_write
on public.goal_key_results
for all
to authenticated
using (
  exists (
    select 1
    from public.goals g
    where g.id = goal_key_results.goal_id
      and (
        public.app_has_permission('goals.write', g.tenant_id)
        or exists (
          select 1
          from public.employees e
          where e.id = g.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.goals g
    where g.id = goal_key_results.goal_id
      and (
        public.app_has_permission('goals.write', g.tenant_id)
        or exists (
          select 1
          from public.employees e
          where e.id = g.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
);

select public._drop_policy_if_exists('public','goal_updates','goal_updates_select');
create policy goal_updates_select
on public.goal_updates
for select
to authenticated
using (
  exists (
    select 1
    from public.goals g
    where g.id = goal_updates.goal_id
      and (
        public.app_has_permission('goals.read', g.tenant_id)
        or exists (
          select 1
          from public.employees e
          where e.id = g.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
);

select public._drop_policy_if_exists('public','goal_updates','goal_updates_insert');
create policy goal_updates_insert
on public.goal_updates
for insert
to authenticated
with check (
  exists (
    select 1
    from public.goals g
    where g.id = goal_updates.goal_id
      and (
        public.app_has_permission('goals.write', g.tenant_id)
        or exists (
          select 1
          from public.employees e
          where e.id = g.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
  and author_id = public.app_current_user_id()
);

select public._drop_policy_if_exists('public','check_ins','check_ins_select');
create policy check_ins_select
on public.check_ins
for select
to authenticated
using (
  public.app_has_permission('check_ins.read', tenant_id)
  or manager_user_id = public.app_current_user_id()
  or exists (
    select 1
    from public.employees e
    where e.id = check_ins.employee_id
      and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  )
);

select public._drop_policy_if_exists('public','check_ins','check_ins_insert');
create policy check_ins_insert
on public.check_ins
for insert
to authenticated
with check (
  public.app_has_permission('check_ins.write', tenant_id)
  or manager_user_id = public.app_current_user_id()
);

select public._drop_policy_if_exists('public','check_ins','check_ins_update');
create policy check_ins_update
on public.check_ins
for update
to authenticated
using (
  public.app_has_permission('check_ins.write', tenant_id)
  or manager_user_id = public.app_current_user_id()
)
with check (
  public.app_has_permission('check_ins.write', tenant_id)
  or manager_user_id = public.app_current_user_id()
);

select public._drop_policy_if_exists('public','check_in_agendas','check_in_agendas_select');
create policy check_in_agendas_select
on public.check_in_agendas
for select
to authenticated
using (
  exists (
    select 1
    from public.check_ins ci
    where ci.id = check_in_agendas.check_in_id
      and (
        public.app_has_permission('check_ins.read', ci.tenant_id)
        or ci.manager_user_id = public.app_current_user_id()
        or exists (
          select 1
          from public.employees e
          where e.id = ci.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
);

select public._drop_policy_if_exists('public','check_in_agendas','check_in_agendas_write');
create policy check_in_agendas_write
on public.check_in_agendas
for all
to authenticated
using (
  exists (
    select 1
    from public.check_ins ci
    where ci.id = check_in_agendas.check_in_id
      and (
        public.app_has_permission('check_ins.write', ci.tenant_id)
        or ci.manager_user_id = public.app_current_user_id()
        or exists (
          select 1
          from public.employees e
          where e.id = ci.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.check_ins ci
    where ci.id = check_in_agendas.check_in_id
      and (
        public.app_has_permission('check_ins.write', ci.tenant_id)
        or ci.manager_user_id = public.app_current_user_id()
        or exists (
          select 1
          from public.employees e
          where e.id = ci.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
);

select public._drop_policy_if_exists('public','check_in_private_notes','check_in_private_notes_select');
create policy check_in_private_notes_select
on public.check_in_private_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.check_ins ci
    where ci.id = check_in_private_notes.check_in_id
      and (
        public.app_has_permission('check_ins.read', ci.tenant_id)
        or ci.manager_user_id = public.app_current_user_id()
      )
  )
);

select public._drop_policy_if_exists('public','check_in_private_notes','check_in_private_notes_upsert');
create policy check_in_private_notes_upsert
on public.check_in_private_notes
for all
to authenticated
using ( manager_user_id = public.app_current_user_id() )
with check ( manager_user_id = public.app_current_user_id() );

-- Time policies
select public._drop_policy_if_exists('public','time_entries','time_entries_select_self_or_tenant');
create policy time_entries_select_self_or_tenant
on public.time_entries
for select
to authenticated
using (
  user_id = public.app_current_user_id()
  or public.app_has_permission('time.read', tenant_id)
);

select public._drop_policy_if_exists('public','time_entries','time_entries_insert_self');
create policy time_entries_insert_self
on public.time_entries
for insert
to authenticated
with check (
  user_id = public.app_current_user_id()
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = time_entries.tenant_id
  )
);

select public._drop_policy_if_exists('public','time_entries','time_entries_update_self_or_time_write');
create policy time_entries_update_self_or_time_write
on public.time_entries
for update
to authenticated
using (
  (
    user_id = public.app_current_user_id()
    and exists (
      select 1
      from public.memberships m
      where m.user_id = public.app_current_user_id()
        and m.tenant_id = time_entries.tenant_id
    )
  )
  or public.app_has_permission('time.write', tenant_id)
)
with check (
  (
    user_id = public.app_current_user_id()
    and exists (
      select 1
      from public.memberships m
      where m.user_id = public.app_current_user_id()
        and m.tenant_id = time_entries.tenant_id
    )
  )
  or public.app_has_permission('time.write', tenant_id)
);

select public._drop_policy_if_exists('public','time_entries','time_entries_delete_time_write');
create policy time_entries_delete_time_write
on public.time_entries
for delete
to authenticated
using ( public.app_has_permission('time.write', tenant_id) );

select public._drop_policy_if_exists('public','time_off_requests','time_off_requests_select_self_or_tenant');
create policy time_off_requests_select_self_or_tenant
on public.time_off_requests
for select
to authenticated
using (
  user_id = public.app_current_user_id()
  or public.app_has_permission('time.read', tenant_id)
);

select public._drop_policy_if_exists('public','time_off_requests','time_off_requests_insert_self');
create policy time_off_requests_insert_self
on public.time_off_requests
for insert
to authenticated
with check (
  user_id = public.app_current_user_id()
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = time_off_requests.tenant_id
  )
);

select public._drop_policy_if_exists('public','time_off_requests','time_off_requests_update_approvers');
create policy time_off_requests_update_approvers
on public.time_off_requests
for update
to authenticated
using ( public.app_has_permission('time_off.approve', tenant_id) )
with check ( public.app_has_permission('time_off.approve', tenant_id) );

select public._drop_policy_if_exists('public','time_off_requests','time_off_requests_cancel_self');
create policy time_off_requests_cancel_self
on public.time_off_requests
for update
to authenticated
using (
  user_id = public.app_current_user_id()
  and status = 'pending'
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = time_off_requests.tenant_id
  )
)
with check (
  user_id = public.app_current_user_id()
  and status in ('pending','cancelled')
  and approver_user_id is null
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = time_off_requests.tenant_id
  )
);

-- Permission seeds
insert into public.permissions (key) values
  ('members.manage'),
  ('employees.read'),
  ('employees.write'),
  ('employees.fields.manage'),
  ('workflows.read'),
  ('workflows.manage'),
  ('workflows.run.manage'),
  ('workflows.template.use'),
  ('goals.read'),
  ('goals.write'),
  ('check_ins.read'),
  ('check_ins.write'),
  ('time.read'),
  ('time.write'),
  ('time_off.approve'),
  ('calendar.read')
on conflict do nothing;

insert into public.role_permissions (role, permission_key) values
  ('owner','members.manage'),
  ('owner','employees.read'),
  ('owner','employees.write'),
  ('owner','employees.fields.manage'),
  ('owner','workflows.read'),
  ('owner','workflows.manage'),
  ('owner','workflows.run.manage'),
  ('owner','workflows.template.use'),
  ('owner','goals.read'),
  ('owner','goals.write'),
  ('owner','check_ins.read'),
  ('owner','check_ins.write'),
  ('owner','time.read'),
  ('owner','time.write'),
  ('owner','time_off.approve'),
  ('owner','calendar.read'),
  ('admin','members.manage'),
  ('admin','employees.read'),
  ('admin','employees.write'),
  ('admin','employees.fields.manage'),
  ('admin','workflows.read'),
  ('admin','workflows.manage'),
  ('admin','workflows.run.manage'),
  ('admin','workflows.template.use'),
  ('admin','goals.read'),
  ('admin','goals.write'),
  ('admin','check_ins.read'),
  ('admin','check_ins.write'),
  ('admin','time.read'),
  ('admin','time.write'),
  ('admin','time_off.approve'),
  ('admin','calendar.read'),
  ('manager','employees.read'),
  ('manager','employees.write'),
  ('manager','workflows.read'),
  ('manager','workflows.run.manage'),
  ('manager','workflows.template.use'),
  ('manager','goals.read'),
  ('manager','goals.write'),
  ('manager','check_ins.read'),
  ('manager','check_ins.write'),
  ('manager','time.read'),
  ('manager','time.write'),
  ('manager','time_off.approve'),
  ('manager','calendar.read'),
  ('employee','employees.read'),
  ('employee','workflows.read')
on conflict do nothing;

revoke all on function public.app_create_tenant(text) from public;
grant execute on function public.app_create_tenant(text) to authenticated;

-- Seed workflow templates
insert into public.workflow_templates (kind, name, description, blocks)
values
  (
    'onboarding',
    'Standard Onboarding',
    'A balanced onboarding journey that welcomes new hires and guides core setup tasks.',
    jsonb_build_object(
      'nodes', jsonb_build_array(
        jsonb_build_object('id','trigger_hire','type','trigger','label','When employee is hired','config', jsonb_build_object('event','employee.created')),
        jsonb_build_object('id','action_welcome_email','type','action','label','Send welcome email','config', jsonb_build_object('template','welcome_email_basic')),
        jsonb_build_object('id','action_collect_docs','type','action','label','Collect paperwork','config', jsonb_build_object('documents', jsonb_build_array('w4','direct_deposit_form'))),
        jsonb_build_object('id','delay_day2','type','delay','label','Wait 1 day','config', jsonb_build_object('duration', jsonb_build_object('value',1,'unit','day'))),
        jsonb_build_object('id','action_schedule_orientation','type','action','label','Schedule orientation','config', jsonb_build_object('eventType','orientation','durationMinutes',60))
      ),
      'edges', jsonb_build_array(
        jsonb_build_object('source','trigger_hire','target','action_welcome_email'),
        jsonb_build_object('source','action_welcome_email','target','action_collect_docs'),
        jsonb_build_object('source','action_collect_docs','target','delay_day2'),
        jsonb_build_object('source','delay_day2','target','action_schedule_orientation')
      ),
      'metadata', jsonb_build_object('version',1,'estimatedDurationDays',5)
    )
  ),
  (
    'onboarding',
    'Executive Onboarding',
    'Concierge-style onboarding with leadership introductions and accelerated tooling access.',
    jsonb_build_object(
      'nodes', jsonb_build_array(
        jsonb_build_object('id','trigger_exec_hire','type','trigger','label','When executive is hired','config', jsonb_build_object('event','employee.created','filters', jsonb_build_object('department','Executive'))),
        jsonb_build_object('id','action_preboarding_pack','type','action','label','Send pre-boarding package','config', jsonb_build_object('tasks', jsonb_build_array('complete_profile','upload_bio'))),
        jsonb_build_object('id','action_it_fast_track','type','action','label','Fast-track IT access','config', jsonb_build_object('priority','high')),
        jsonb_build_object('id','action_schedule_executive_rounds','type','action','label','Book leadership 1:1s','config', jsonb_build_object('meetings', jsonb_build_array('CEO','CFO','CHRO')))
      ),
      'edges', jsonb_build_array(
        jsonb_build_object('source','trigger_exec_hire','target','action_preboarding_pack'),
        jsonb_build_object('source','action_preboarding_pack','target','action_it_fast_track'),
        jsonb_build_object('source','action_it_fast_track','target','action_schedule_executive_rounds')
      ),
      'metadata', jsonb_build_object('version',1,'persona','executive')
    )
  ),
  (
    'offboarding',
    'Standard Offboarding',
    'Handles access removal, equipment collection, and farewell messaging for departing teammates.',
    jsonb_build_object(
      'nodes', jsonb_build_array(
        jsonb_build_object('id','trigger_last_day_set','type','trigger','label','When last day is scheduled','config', jsonb_build_object('event','employee.offboardingScheduled')),
        jsonb_build_object('id','action_notify_managers','type','action','label','Notify manager & HR','config', jsonb_build_object('channels', jsonb_build_array('email','slack'))),
        jsonb_build_object('id','action_reclaim_assets','type','action','label','Collect company assets','config', jsonb_build_object('assets', jsonb_build_array('laptop','badge','vpn_token'))),
        jsonb_build_object('id','action_disable_accounts','type','action','label','Disable accounts','config', jsonb_build_object('systems', jsonb_build_array('gsuite','slack','hris'))),
        jsonb_build_object('id','action_exit_interview','type','action','label','Schedule exit interview','config', jsonb_build_object('ownerRole','hr_manager'))
      ),
      'edges', jsonb_build_array(
        jsonb_build_object('source','trigger_last_day_set','target','action_notify_managers'),
        jsonb_build_object('source','action_notify_managers','target','action_reclaim_assets'),
        jsonb_build_object('source','action_reclaim_assets','target','action_disable_accounts'),
        jsonb_build_object('source','action_disable_accounts','target','action_exit_interview')
      ),
      'metadata', jsonb_build_object('version',1,'estimatedDurationDays',3)
  )
)
on conflict do nothing;

drop function public._drop_trigger_if_exists(text, text, text);
drop function public._drop_policy_if_exists(text, text, text);
