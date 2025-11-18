-- Consolidated Tables Migration
-- This migration creates all database tables, indexes, triggers, RLS policies, views, and storage buckets
-- Final state consolidated from migrations 1-10

-- ==============================================
-- 1. EXTENSIONS AND TYPES
-- ==============================================

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('owner', 'admin', 'manager', 'employee', 'people_ops');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'message_author_type') then
    create type message_author_type as enum ('user', 'assistant', 'tool');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'conversation_status') then
    create type conversation_status as enum ('open', 'closed', 'archived');
  end if;
end
$$;

-- ==============================================
-- 2. BASIC HELPER FUNCTIONS (needed by triggers)
-- ==============================================

create or replace function public.app_current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid()
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

-- ==============================================
-- 3. CORE TABLES
-- ==============================================

-- Tenants table (final state: with language column, without removed fields)
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  company_name text,
  company_size text,
  onboarding_step smallint not null default 0,
  setup_completed boolean not null default false,
  activated_at timestamptz,
  language text check (language is null or language in ('German', 'English'))
);

comment on column public.tenants.language is 'Preferred language for the tenant (German or English)';
comment on table public.tenants is 'Tenant information. Contact info is now stored via the admin user (owner role in memberships).';

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

-- Permission helper function (needed by RLS policies)
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

-- ==============================================
-- 4. EMPLOYEES TABLE
-- ==============================================

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  name text not null,
  manager_id uuid references public.employees(id),
  user_id uuid references auth.users(id) on delete set null,
  employee_number text unique,
  date_of_birth date,
  nationality text,
  phone_personal text,
  phone_work text,
  emergency_contact_name text,
  emergency_contact_phone text,
  home_address jsonb,
  job_title text,
  department_id uuid,
  employment_type text check (employment_type in ('full_time', 'part_time', 'contract', 'intern', 'seasonal')),
  work_location text check (work_location in ('office', 'remote', 'hybrid')),
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'on_leave', 'terminated', 'inactive')),
  salary_amount numeric(12,2),
  salary_currency text default 'USD',
  salary_frequency text check (salary_frequency in ('yearly', 'monthly', 'weekly', 'hourly')),
  bank_account_encrypted text,
  tax_id_encrypted text,
  profile_completion_pct integer default 0 check (profile_completion_pct >= 0 and profile_completion_pct <= 100),
  office_location_id uuid,
  sensitive_data_flags jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  custom_fields jsonb,
  constraint employees_date_range_check check (end_date is null or start_date is null or start_date <= end_date)
);

create index if not exists employees_tenant_email_idx on public.employees (tenant_id, email);
create index if not exists employees_tenant_status_idx on public.employees (tenant_id, status);
create index if not exists employees_tenant_department_idx on public.employees (tenant_id, department_id);
create index if not exists employees_employee_number_idx on public.employees (employee_number);
create index if not exists employees_office_location_idx on public.employees (tenant_id, office_location_id);
create index if not exists employees_sensitive_flags_idx on public.employees (tenant_id)
where sensitive_data_flags is not null and sensitive_data_flags != '{}'::jsonb;

-- ==============================================
-- 5. DEPARTMENTS TABLE
-- ==============================================

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  parent_id uuid references public.departments(id) on delete set null,
  head_employee_id uuid references public.employees(id) on delete set null,
  cost_center text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index if not exists departments_tenant_idx on public.departments (tenant_id);
create index if not exists departments_parent_idx on public.departments (parent_id);
create index if not exists departments_head_idx on public.departments (head_employee_id);

-- Add foreign key constraint for employees after departments table exists
alter table public.employees
  add constraint employees_department_fk 
  foreign key (department_id) references public.departments(id) on delete set null;

-- ==============================================
-- 6. OFFICE LOCATIONS TABLE
-- ==============================================

create table if not exists public.office_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  address jsonb,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index if not exists office_locations_tenant_idx on public.office_locations (tenant_id);
create index if not exists office_locations_name_idx on public.office_locations (tenant_id, name);

-- Add foreign key constraint for office_location_id in employees
alter table public.employees
  add constraint employees_office_location_fk
  foreign key (office_location_id) references public.office_locations(id) on delete set null;

-- ==============================================
-- 7. TEAMS TABLE
-- ==============================================

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  team_lead_id uuid references public.employees(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index if not exists teams_tenant_idx on public.teams (tenant_id);
create index if not exists teams_department_idx on public.teams (tenant_id, department_id);
create index if not exists teams_lead_idx on public.teams (team_lead_id);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, employee_id)
);

create index if not exists team_members_team_idx on public.team_members (team_id);
create index if not exists team_members_employee_idx on public.team_members (employee_id);

-- ==============================================
-- 8. EMPLOYEE CUSTOM FIELDS
-- ==============================================

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

-- ==============================================
-- 9. PROFILES TABLE
-- ==============================================

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  display_name text not null,
  pto_balance_days numeric(6,2) not null default 0,
  sick_balance_days numeric(6,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==============================================
-- 10. EMPLOYEE DOCUMENTS TABLE
-- ==============================================

insert into storage.buckets (id, name, public)
values ('employee-documents', 'employee-documents', false)
on conflict (id) do nothing;

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  uploaded_at timestamptz not null default now(),
  description text,
  version integer not null default 1,
  previous_version_id uuid references public.employee_documents(id),
  is_current boolean not null default true,
  category text check (category in ('contract', 'certification', 'id_document', 'performance', 'medical', 'other')),
  expiry_date date,
  updated_at timestamptz not null default now()
);

create index if not exists employee_documents_tenant_employee_idx
  on public.employee_documents (tenant_id, employee_id, uploaded_at desc);
create index if not exists employee_documents_category_idx on public.employee_documents (tenant_id, category);
create index if not exists employee_documents_expiry_idx on public.employee_documents (tenant_id, expiry_date)
where expiry_date is not null;
create index if not exists employee_documents_version_idx on public.employee_documents (employee_id, is_current, version desc);

-- ==============================================
-- 11. DOCUMENT EXPIRY NOTIFICATIONS TABLE
-- ==============================================

create table if not exists public.document_expiry_notifications (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.employee_documents(id) on delete cascade,
  notification_sent_at timestamptz not null default now(),
  notification_type text not null check (notification_type in ('expiring_soon', 'expired')),
  created_at timestamptz not null default now()
);

create index if not exists document_expiry_notifications_document_idx
  on public.document_expiry_notifications (document_id);
create index if not exists document_expiry_notifications_type_idx
  on public.document_expiry_notifications (notification_type, created_at desc);

-- ==============================================
-- 12. EMPLOYEE AUDIT LOG TABLE
-- ==============================================

create table if not exists public.employee_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  changed_by uuid not null references auth.users(id),
  action text not null check (action in ('created', 'updated', 'deleted', 'document_added', 'document_removed', 'status_changed')),
  field_name text,
  old_value jsonb,
  new_value jsonb,
  change_reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists employee_audit_log_employee_idx
  on public.employee_audit_log (employee_id, created_at desc);
create index if not exists employee_audit_log_tenant_idx
  on public.employee_audit_log (tenant_id, created_at desc);
create index if not exists employee_audit_log_changed_by_idx
  on public.employee_audit_log (changed_by, created_at desc);

-- ==============================================
-- 13. EMPLOYEE STATUS HISTORY TABLE
-- ==============================================

create table if not exists public.employee_status_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  status text not null check (status in ('active', 'on_leave', 'terminated', 'inactive')),
  effective_date date not null,
  reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists employee_status_history_employee_idx
  on public.employee_status_history (employee_id, effective_date desc);
create index if not exists employee_status_history_status_idx
  on public.employee_status_history (status, effective_date desc);

-- ==============================================
-- 13.5. EMPLOYEE HELPER FUNCTIONS (needed by triggers)
-- ==============================================

create or replace function public.calculate_profile_completion(employee_row public.employees)
returns integer
language plpgsql
as $$
declare
  total_fields integer := 0;
  filled_fields integer := 0;
begin
  total_fields := 8; -- name, email, job_title, department_id, employment_type, start_date, status, phone_work
  
  if employee_row.name is not null and employee_row.name != '' then filled_fields := filled_fields + 1; end if;
  if employee_row.email is not null and employee_row.email != '' then filled_fields := filled_fields + 1; end if;
  if employee_row.job_title is not null and employee_row.job_title != '' then filled_fields := filled_fields + 1; end if;
  if employee_row.department_id is not null then filled_fields := filled_fields + 1; end if;
  if employee_row.employment_type is not null then filled_fields := filled_fields + 1; end if;
  if employee_row.start_date is not null then filled_fields := filled_fields + 1; end if;
  if employee_row.status is not null then filled_fields := filled_fields + 1; end if;
  if employee_row.phone_work is not null and employee_row.phone_work != '' then filled_fields := filled_fields + 1; end if;
  
  if total_fields = 0 then
    return 0;
  end if;
  
  return round((filled_fields::decimal / total_fields::decimal) * 100);
end;
$$;

create or replace function public.generate_employee_number()
returns text
language plpgsql
as $$
declare
  year_part text;
  sequence_num integer;
  employee_num text;
begin
  year_part := extract(year from current_date)::text;
  
  select coalesce(max(cast(substring(employee_number from 9) as integer)), 0) + 1
  into sequence_num
  from public.employees
  where employee_number like 'EMP-' || year_part || '-%';
  
  employee_num := 'EMP-' || year_part || '-' || lpad(sequence_num::text, 4, '0');
  
  return employee_num;
end;
$$;

create or replace function public.employee_before_insert()
returns trigger
language plpgsql
as $$
begin
  if new.employee_number is null then
    new.employee_number := public.generate_employee_number();
  end if;
  
  new.profile_completion_pct := public.calculate_profile_completion(new);
  
  return new;
end;
$$;

create or replace function public.employee_before_update()
returns trigger
language plpgsql
as $$
begin
  new.profile_completion_pct := public.calculate_profile_completion(new);
  return new;
end;
$$;

-- ==============================================
-- 14. WORKFLOW TABLES
-- ==============================================

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

alter table public.workflows
  add constraint workflows_active_version_fk
  foreign key (active_version_id) references public.workflow_versions(id)
  on delete set null;

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

-- ==============================================
-- 15. PERFORMANCE MANAGEMENT TABLES
-- ==============================================

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

-- ==============================================
-- 16. TIME & ATTENDANCE TABLES
-- ==============================================

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
  break_minutes integer not null default 0,
  project_task text,
  notes text,
  entry_type text not null default 'clock' check (entry_type in ('clock', 'manual')),
  approval_status text not null default 'approved' check (approval_status in ('approved', 'pending', 'rejected')),
  approver_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  edited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_entries_break_validation check (break_minutes >= 0 and break_minutes <= 1440),
  constraint time_entries_notes_length check (notes is null or length(notes) <= 500)
);

create index if not exists time_entries_tenant_user_in_idx
  on public.time_entries (tenant_id, user_id, clock_in_at);
create index if not exists time_entries_tenant_in_idx
  on public.time_entries (tenant_id, clock_in_at);
create unique index if not exists time_entries_unique_open
  on public.time_entries (tenant_id, user_id)
  where clock_out_at is null;
create index if not exists time_entries_approval_status_idx
  on public.time_entries (tenant_id, approval_status);
create index if not exists time_entries_entry_type_idx
  on public.time_entries (tenant_id, entry_type);
create index if not exists time_entries_updated_at_idx
  on public.time_entries (tenant_id, updated_at desc);

create table if not exists public.overtime_balances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null,
  regular_hours numeric(8,2) not null default 0,
  overtime_hours numeric(8,2) not null default 0,
  overtime_multiplier numeric(3,2) not null default 1.5,
  carry_over_hours numeric(8,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, period)
);

create index if not exists overtime_balances_tenant_user_idx
  on public.overtime_balances (tenant_id, user_id, period desc);
create index if not exists overtime_balances_period_idx
  on public.overtime_balances (tenant_id, period desc);

create table if not exists public.overtime_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  daily_threshold numeric(4,2) not null default 8.0,
  weekly_threshold numeric(5,2) not null default 40.0,
  daily_multiplier numeric(3,2) not null default 1.5,
  weekly_multiplier numeric(3,2) not null default 1.5,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists overtime_rules_tenant_idx
  on public.overtime_rules (tenant_id);
create index if not exists overtime_rules_default_idx
  on public.overtime_rules (tenant_id, is_default)
  where is_default = true;

create table if not exists public.overtime_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  estimated_hours numeric(5,2) not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'cancelled')),
  approver_user_id uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  denial_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint overtime_requests_date_range_chk check (start_date <= end_date),
  constraint overtime_requests_hours_chk check (estimated_hours > 0 and estimated_hours <= 168)
);

create index if not exists overtime_requests_tenant_user_idx
  on public.overtime_requests (tenant_id, user_id, start_date desc);
create index if not exists overtime_requests_tenant_status_idx
  on public.overtime_requests (tenant_id, status);
create index if not exists overtime_requests_approver_idx
  on public.overtime_requests (tenant_id, approver_user_id)
  where approver_user_id is not null;

create table if not exists public.time_entry_audit (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  changed_by uuid not null references auth.users(id) on delete cascade,
  field_name text not null,
  old_value jsonb,
  new_value jsonb,
  change_reason text,
  created_at timestamptz not null default now()
);

create index if not exists time_entry_audit_time_entry_idx
  on public.time_entry_audit (time_entry_id, created_at desc);
create index if not exists time_entry_audit_changed_by_idx
  on public.time_entry_audit (changed_by, created_at desc);

-- ==============================================
-- 17. LEAVE & ABSENCE TABLES
-- ==============================================

create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  code text not null,
  requires_approval boolean not null default true,
  requires_certificate boolean not null default false,
  allow_negative_balance boolean not null default false,
  max_balance numeric(5,2) default null,
  minimum_entitlement_days numeric(5,2) default null,
  enforce_minimum_entitlement boolean not null default false,
  color text default '#3B82F6',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create index if not exists leave_types_tenant_idx on public.leave_types (tenant_id);
create index if not exists leave_types_active_idx on public.leave_types (tenant_id, is_active)
where is_active = true;

comment on column public.leave_types.minimum_entitlement_days is 'Minimum number of days that must be taken (e.g., EU requirement of 20 days for annual leave)';
comment on column public.leave_types.enforce_minimum_entitlement is 'Whether to enforce minimum entitlement check during leave requests';

create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id) on delete cascade,
  balance_days numeric(5,2) not null default 0,
  used_ytd numeric(5,2) not null default 0,
  period_start date not null,
  period_end date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, employee_id, leave_type_id, period_start)
);

create index if not exists leave_balances_employee_idx
  on public.leave_balances (tenant_id, employee_id, period_start desc);
create index if not exists leave_balances_leave_type_idx
  on public.leave_balances (tenant_id, leave_type_id);
create index if not exists leave_balances_period_idx
  on public.leave_balances (tenant_id, period_start, period_end);
create index if not exists leave_balances_current_period_idx
  on public.leave_balances (tenant_id, period_start, period_end);

create table if not exists public.holiday_calendars (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  date date not null,
  name text not null,
  is_half_day boolean not null default false,
  country text,
  region text,
  created_at timestamptz not null default now(),
  unique (tenant_id, date, name)
);

create index if not exists holiday_calendars_tenant_date_idx
  on public.holiday_calendars (tenant_id, date);
create index if not exists holiday_calendars_tenant_year_idx
  on public.holiday_calendars (tenant_id, extract(year from date));

create table if not exists public.blackout_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  leave_type_id uuid references public.leave_types(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists blackout_periods_tenant_idx
  on public.blackout_periods (tenant_id);
create index if not exists blackout_periods_dates_idx
  on public.blackout_periods (tenant_id, start_date, end_date);
create index if not exists blackout_periods_leave_type_idx
  on public.blackout_periods (tenant_id, leave_type_id)
  where leave_type_id is not null;
create index if not exists blackout_periods_department_idx
  on public.blackout_periods (tenant_id, department_id)
  where department_id is not null;

create table if not exists public.time_off_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  leave_type text not null check (leave_type in ('vacation','sick','personal','unpaid','other')),
  days_count numeric(5,2),
  half_day_start boolean default false,
  half_day_end boolean default false,
  attachment_path text,
  denial_reason text,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  leave_type_id uuid references public.leave_types(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','denied','cancelled')),
  approver_user_id uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_off_requests_date_range_chk check (start_date <= end_date)
);

create index if not exists time_off_requests_tenant_user_start_idx
  on public.time_off_requests (tenant_id, user_id, start_date);
create index if not exists time_off_requests_tenant_status_idx
  on public.time_off_requests (tenant_id, status);
create index if not exists time_off_requests_leave_type_idx
  on public.time_off_requests (tenant_id, leave_type_id);
create index if not exists time_off_requests_days_count_idx
  on public.time_off_requests (tenant_id, days_count);
create index if not exists time_off_requests_updated_at_idx
  on public.time_off_requests (tenant_id, updated_at desc);
create index if not exists time_off_requests_analytics_idx
  on public.time_off_requests (tenant_id, user_id, leave_type_id, status, start_date)
  where status = 'approved';
create index if not exists time_off_requests_month_idx
  on public.time_off_requests (tenant_id, start_date, status);

create table if not exists public.leave_request_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id uuid not null references public.time_off_requests(id) on delete cascade,
  changed_by uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('created', 'approved', 'denied', 'cancelled', 'modified')),
  old_values jsonb,
  new_values jsonb,
  reason text,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists leave_request_audit_tenant_idx
  on public.leave_request_audit (tenant_id);
create index if not exists leave_request_audit_request_idx
  on public.leave_request_audit (request_id, created_at desc);
create index if not exists leave_request_audit_changed_by_idx
  on public.leave_request_audit (changed_by, created_at desc);

-- ==============================================
-- 18. ONBOARDING/OFFBOARDING TABLES
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
-- 19. RECRUITING ATS TABLES
-- ==============================================

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_id text not null,
  title text not null,
  department_id uuid references public.departments(id) on delete set null,
  location_id uuid references public.office_locations(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'active', 'paused', 'filled', 'closed')),
  description text not null,
  requirements jsonb,
  employment_type text check (employment_type in ('full_time', 'part_time', 'contract', 'freelance')),
  work_location text check (work_location in ('remote', 'hybrid', 'on_site')),
  salary_min numeric(12,2),
  salary_max numeric(12,2),
  salary_currency text default 'USD',
  salary_hidden boolean not null default false,
  benefits jsonb,
  application_deadline date,
  created_by uuid not null references auth.users(id) on delete cascade,
  approved_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, job_id)
);

create index if not exists jobs_tenant_idx on public.jobs (tenant_id);
create index if not exists jobs_status_idx on public.jobs (tenant_id, status);
create index if not exists jobs_department_idx on public.jobs (tenant_id, department_id);
create index if not exists jobs_location_idx on public.jobs (tenant_id, location_id);
create index if not exists jobs_created_by_idx on public.jobs (tenant_id, created_by);
create index if not exists jobs_job_id_idx on public.jobs (tenant_id, job_id);

create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  channel text not null check (channel in ('linkedin', 'indeed', 'stepstone', 'jobs_bg', 'glassdoor', 'company_site', 'instagram', 'facebook', 'tiktok', 'other')),
  posted_at timestamptz,
  budget numeric(12,2),
  spent numeric(12,2) default 0,
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'completed', 'failed')),
  external_post_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_postings_job_idx on public.job_postings (job_id);
create index if not exists job_postings_channel_idx on public.job_postings (job_id, channel);
create index if not exists job_postings_status_idx on public.job_postings (job_id, status);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  resume_url text,
  cover_letter text,
  linkedin_url text,
  portfolio_url text,
  source text not null check (source in ('direct_apply', 'linkedin', 'indeed', 'referral', 'job_board', 'social_media', 'event', 'qr_code', 'other')),
  source_details jsonb,
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists candidates_tenant_idx on public.candidates (tenant_id);
create index if not exists candidates_email_idx on public.candidates (tenant_id, email);
create index if not exists candidates_source_idx on public.candidates (tenant_id, source);
create index if not exists candidates_applied_at_idx on public.candidates (tenant_id, applied_at desc);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  status text not null default 'applied' check (status in ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected')),
  current_stage_id uuid,
  match_score integer check (match_score >= 0 and match_score <= 100),
  application_answers jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);

create index if not exists applications_job_idx on public.applications (job_id);
create index if not exists applications_candidate_idx on public.applications (candidate_id);
create index if not exists applications_status_idx on public.applications (job_id, status);
create index if not exists applications_stage_idx on public.applications (job_id, current_stage_id);

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  name text not null,
  order_index integer not null,
  stage_type text not null check (stage_type in ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'custom')),
  auto_action jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, name),
  unique (job_id, order_index)
);

create index if not exists pipeline_stages_job_idx on public.pipeline_stages (job_id);
create index if not exists pipeline_stages_order_idx on public.pipeline_stages (job_id, order_index);

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  type text not null check (type in ('phone_screen', 'video', 'in_person', 'panel', 'technical_assessment')),
  scheduled_at timestamptz not null,
  duration_minutes integer default 60,
  location text,
  meeting_link text,
  interviewer_ids jsonb not null,
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interviews_application_idx on public.interviews (application_id);
create index if not exists interviews_scheduled_at_idx on public.interviews (scheduled_at);
create index if not exists interviews_status_idx on public.interviews (status);

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  evaluator_id uuid not null references auth.users(id) on delete cascade,
  scores jsonb not null,
  notes text,
  overall_rating integer check (overall_rating >= 1 and overall_rating <= 10),
  recommendation text check (recommendation in ('strong_yes', 'yes', 'maybe', 'no', 'strong_no')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (interview_id, evaluator_id)
);

create index if not exists evaluations_interview_idx on public.evaluations (interview_id);
create index if not exists evaluations_evaluator_idx on public.evaluations (evaluator_id);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  type text not null check (type in ('email', 'sms', 'whatsapp')),
  direction text not null check (direction in ('outbound', 'inbound')),
  subject text,
  content text not null,
  template_id uuid,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced')),
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists communications_tenant_candidate_idx on public.communications (tenant_id, candidate_id);
create index if not exists communications_type_idx on public.communications (tenant_id, type);
create index if not exists communications_sent_at_idx on public.communications (tenant_id, sent_at desc);

create table if not exists public.talent_pool (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users(id) on delete set null,
  engagement_score integer check (engagement_score >= 0 and engagement_score <= 100),
  tags text[],
  notes text,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, candidate_id)
);

create index if not exists talent_pool_tenant_idx on public.talent_pool (tenant_id);
create index if not exists talent_pool_candidate_idx on public.talent_pool (candidate_id);
create index if not exists talent_pool_engagement_idx on public.talent_pool (tenant_id, engagement_score desc);
create index if not exists talent_pool_tags_idx on public.talent_pool using gin (tags);

-- Storage bucket for candidate resumes
insert into storage.buckets (id, name, public)
values ('candidate-resumes', 'candidate-resumes', false)
on conflict (id) do nothing;

-- ==============================================
-- 20. CHAT PERSISTENCE TABLES
-- ==============================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text,
  status conversation_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_tenant_user_created_idx
  on public.conversations (tenant_id, created_by, created_at desc);
create index if not exists conversations_tenant_status_idx
  on public.conversations (tenant_id, status, created_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  author_type message_author_type not null,
  author_id uuid references auth.users(id) on delete set null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
create index if not exists messages_tenant_created_idx
  on public.messages (tenant_id, created_at);

-- ==============================================
-- 20.5. LEAVE AUDIT FUNCTIONS (needed by triggers)
-- ==============================================

create or replace function public.create_leave_request_audit(
  p_request_id uuid,
  p_changed_by uuid,
  p_action text,
  p_old_values jsonb default null,
  p_new_values jsonb default null,
  p_reason text default null,
  p_ip_address text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  audit_id uuid;
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id
  from public.time_off_requests
  where id = p_request_id;
  
  insert into public.leave_request_audit (
    request_id,
    tenant_id,
    changed_by,
    action,
    old_values,
    new_values,
    reason,
    ip_address
  ) values (
    p_request_id,
    v_tenant_id,
    p_changed_by,
    p_action,
    p_old_values,
    p_new_values,
    p_reason,
    p_ip_address
  ) returning id into audit_id;
  
  return audit_id;
end;
$$;

create or replace function public.audit_leave_request_changes()
returns trigger
language plpgsql
as $$
declare
  action_type text;
  old_values jsonb;
  new_values jsonb;
begin
  if tg_op = 'INSERT' then
    action_type := 'created';
    old_values := null;
    new_values := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    action_type := 'modified';
    old_values := to_jsonb(old);
    new_values := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    action_type := 'cancelled';
    old_values := to_jsonb(old);
    new_values := null;
  end if;
  
  perform public.create_leave_request_audit(
    coalesce(new.id, old.id),
    coalesce(new.approver_user_id, old.approver_user_id, auth.uid()),
    action_type,
    old_values,
    new_values,
    coalesce(new.denial_reason, old.denial_reason),
    null
  );
  
  return coalesce(new, old);
end;
$$;

-- ==============================================
-- 20.6. RECRUITING FUNCTIONS (needed by triggers)
-- ==============================================

create or replace function public.generate_job_id(tenant_uuid uuid)
returns text
language plpgsql
as $$
declare
  year_part text;
  sequence_num integer;
  job_num text;
begin
  year_part := extract(year from current_date)::text;
  
  select coalesce(max(cast(substring(job_id from 9) as integer)), 0) + 1
  into sequence_num
  from public.jobs
  where tenant_id = tenant_uuid
    and job_id like 'JOB-' || year_part || '-%';
  
  job_num := 'JOB-' || year_part || '-' || lpad(sequence_num::text, 4, '0');
  
  return job_num;
end;
$$;

create or replace function public.job_before_insert()
returns trigger
language plpgsql
as $$
begin
  if new.job_id is null or new.job_id = '' then
    new.job_id := public.generate_job_id(new.tenant_id);
  end if;
  
  return new;
end;
$$;

create or replace function public.create_default_pipeline_stages(job_uuid uuid)
returns void
language plpgsql
as $$
begin
  insert into public.pipeline_stages (job_id, name, order_index, stage_type)
  values
    (job_uuid, 'Applied', 1, 'applied'),
    (job_uuid, 'Screening', 2, 'screening'),
    (job_uuid, 'Interview', 3, 'interview'),
    (job_uuid, 'Offer', 4, 'offer'),
    (job_uuid, 'Hired', 5, 'hired'),
    (job_uuid, 'Rejected', 6, 'rejected')
  on conflict (job_id, name) do nothing;
end;
$$;

create or replace function public.job_after_insert()
returns trigger
language plpgsql
as $$
begin
  perform public.create_default_pipeline_stages(new.id);
  return new;
end;
$$;

-- ==============================================
-- 21. TRIGGERS (Some functions defined in migration 2)
-- ==============================================

create trigger set_updated_at_on_profiles
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_employee_documents
before update on public.employee_documents
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_employees
before update on public.employees
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_departments
before update on public.departments
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_office_locations
before update on public.office_locations
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_teams
before update on public.teams
for each row
execute function public.set_updated_at();

create trigger employee_before_insert_trigger
before insert on public.employees
for each row
execute function public.employee_before_insert();

create trigger employee_before_update_trigger
before update on public.employees
for each row
execute function public.employee_before_update();

create trigger set_updated_at_on_workflows
before update on public.workflows
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_employee_journey_views
before update on public.employee_journey_views
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_goals
before update on public.goals
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_goal_key_results
before update on public.goal_key_results
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_check_ins
before update on public.check_ins
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_time_entries
before update on public.time_entries
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_overtime_balances
before update on public.overtime_balances
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_overtime_rules
before update on public.overtime_rules
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_overtime_requests
before update on public.overtime_requests
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_leave_types
before update on public.leave_types
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_leave_balances
before update on public.leave_balances
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_time_off_requests
before update on public.time_off_requests
for each row
execute function public.set_updated_at();

create trigger update_blackout_periods_updated_at
before update on public.blackout_periods
for each row
execute function public.set_updated_at();

create trigger audit_leave_request_changes_trigger
after insert or update or delete on public.time_off_requests
for each row
execute function public.audit_leave_request_changes();

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

create trigger set_updated_at_on_jobs
before update on public.jobs
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_job_postings
before update on public.job_postings
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_candidates
before update on public.candidates
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_applications
before update on public.applications
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_pipeline_stages
before update on public.pipeline_stages
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_interviews
before update on public.interviews
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_evaluations
before update on public.evaluations
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_communications
before update on public.communications
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_talent_pool
before update on public.talent_pool
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_conversations
before update on public.conversations
for each row
execute function public.set_updated_at();

create trigger job_before_insert_trigger
before insert on public.jobs
for each row
execute function public.job_before_insert();

create trigger job_after_insert_trigger
after insert on public.jobs
for each row
execute function public.job_after_insert();

-- ==============================================
-- 22. ROW LEVEL SECURITY
-- ==============================================

-- Enable RLS on all tables
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.employees enable row level security;
alter table public.employee_custom_field_defs enable row level security;
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.departments enable row level security;
alter table public.office_locations enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.employee_documents enable row level security;
alter table public.document_expiry_notifications enable row level security;
alter table public.employee_audit_log enable row level security;
alter table public.employee_status_history enable row level security;
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
alter table public.overtime_balances enable row level security;
alter table public.overtime_rules enable row level security;
alter table public.overtime_requests enable row level security;
alter table public.time_entry_audit enable row level security;
alter table public.leave_types enable row level security;
alter table public.leave_balances enable row level security;
alter table public.holiday_calendars enable row level security;
alter table public.blackout_periods enable row level security;
alter table public.time_off_requests enable row level security;
alter table public.leave_request_audit enable row level security;
alter table public.equipment_items enable row level security;
alter table public.access_grants enable row level security;
alter table public.exit_interviews enable row level security;
alter table public.jobs enable row level security;
alter table public.job_postings enable row level security;
alter table public.candidates enable row level security;
alter table public.applications enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.interviews enable row level security;
alter table public.evaluations enable row level security;
alter table public.communications enable row level security;
alter table public.talent_pool enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- RLS Policies
-- Permission tables policies
create policy permissions_select_authenticated on public.permissions
for select to authenticated using (true);

create policy permissions_manage_service on public.permissions
for all to service_role using (true) with check (true);

create policy role_permissions_select_authenticated on public.role_permissions
for select to authenticated using (true);

create policy role_permissions_manage_service on public.role_permissions
for all to service_role using (true) with check (true);

-- Tenant policies
create policy tenants_select_own on public.tenants
for select to authenticated
using (
  exists (
    select 1 from public.memberships m
    where m.tenant_id = tenants.id
      and m.user_id = public.app_current_user_id()
  )
);

create policy tenants_update_admins on public.tenants
for update to authenticated
using (public.app_has_permission('members.manage', tenants.id))
with check (public.app_has_permission('members.manage', tenants.id));

-- Membership policies
create policy memberships_select_self on public.memberships
for select to authenticated
using (user_id = public.app_current_user_id());

create policy memberships_insert_by_admins on public.memberships
for insert to authenticated
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

create policy memberships_update_by_admins on public.memberships
for update to authenticated
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

create policy memberships_delete_by_admins on public.memberships
for delete to authenticated
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

-- Employee policies
create policy employees_read on public.employees
for select to authenticated
using (public.app_has_permission('employees.read', employees.tenant_id));

create policy employees_write_insert on public.employees
for insert to authenticated
with check (public.app_has_permission('employees.write', employees.tenant_id));

create policy employees_write_update on public.employees
for update to authenticated
using (public.app_has_permission('employees.write', employees.tenant_id))
with check (public.app_has_permission('employees.write', employees.tenant_id));

create policy employees_write_delete on public.employees
for delete to authenticated
using (public.app_has_permission('employees.write', employees.tenant_id));

-- Employee custom field defs policies
create policy employee_field_defs_read on public.employee_custom_field_defs
for select to authenticated
using (public.app_has_permission('employees.read', employee_custom_field_defs.tenant_id));

create policy employee_field_defs_write_insert on public.employee_custom_field_defs
for insert to authenticated
with check (public.app_has_permission('employees.fields.manage', employee_custom_field_defs.tenant_id));

create policy employee_field_defs_write_update on public.employee_custom_field_defs
for update to authenticated
using (public.app_has_permission('employees.fields.manage', employee_custom_field_defs.tenant_id))
with check (public.app_has_permission('employees.fields.manage', employee_custom_field_defs.tenant_id));

create policy employee_field_defs_write_delete on public.employee_custom_field_defs
for delete to authenticated
using (public.app_has_permission('employees.fields.manage', employee_custom_field_defs.tenant_id));

-- Profile policies
create policy profiles_select_self on public.profiles
for select to authenticated
using (user_id = public.app_current_user_id());

create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (
  user_id = public.app_current_user_id()
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = profiles.tenant_id
  )
);

create policy profiles_update_self on public.profiles
for update to authenticated
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

-- Department policies
create policy departments_read on public.departments
for select to authenticated
using (public.app_has_permission('departments.read', tenant_id));

create policy departments_manage on public.departments
for all to authenticated
using (public.app_has_permission('departments.manage', tenant_id))
with check (public.app_has_permission('departments.manage', tenant_id));

-- Office locations policies
create policy office_locations_read on public.office_locations
for select to authenticated
using (
  tenant_id in (
    select tenant_id from public.memberships
    where user_id = public.app_current_user_id()
  )
);

create policy office_locations_write on public.office_locations
for all to authenticated
using (
  tenant_id in (
    select tenant_id from public.memberships
    where user_id = public.app_current_user_id()
      and (role = 'owner' or role = 'admin')
  )
)
with check (
  tenant_id in (
    select tenant_id from public.memberships
    where user_id = public.app_current_user_id()
      and (role = 'owner' or role = 'admin')
  )
);

-- Teams policies
create policy teams_read on public.teams
for select to authenticated
using (
  tenant_id in (
    select tenant_id from public.memberships
    where user_id = public.app_current_user_id()
  )
);

create policy teams_write on public.teams
for all to authenticated
using (
  tenant_id in (
    select tenant_id from public.memberships
    where user_id = public.app_current_user_id()
      and (role = 'owner' or role = 'admin' or role = 'manager')
  )
)
with check (
  tenant_id in (
    select tenant_id from public.memberships
    where user_id = public.app_current_user_id()
      and (role = 'owner' or role = 'admin' or role = 'manager')
  )
);

create policy team_members_read on public.team_members
for select to authenticated
using (
  team_id in (
    select id from public.teams
    where tenant_id in (
      select tenant_id from public.memberships
      where user_id = public.app_current_user_id()
    )
  )
);

create policy team_members_write on public.team_members
for all to authenticated
using (
  team_id in (
    select id from public.teams
    where tenant_id in (
      select tenant_id from public.memberships
      where user_id = public.app_current_user_id()
        and (role = 'owner' or role = 'admin' or role = 'manager')
    )
  )
)
with check (
  team_id in (
    select id from public.teams
    where tenant_id in (
      select tenant_id from public.memberships
      where user_id = public.app_current_user_id()
        and (role = 'owner' or role = 'admin' or role = 'manager')
    )
  )
);

-- Employee documents policies
create policy employee_documents_read on public.employee_documents
for select to authenticated
using (public.app_has_permission('employees.documents.read', tenant_id));

create policy employee_documents_write_insert on public.employee_documents
for insert to authenticated
with check (public.app_has_permission('employees.documents.write', tenant_id));

create policy employee_documents_write_delete on public.employee_documents
for delete to authenticated
using (public.app_has_permission('employees.documents.write', tenant_id));

-- Document expiry notifications policies
create policy document_expiry_notifications_read on public.document_expiry_notifications
for select to authenticated
using (
  document_id in (
    select id from public.employee_documents
    where tenant_id in (
      select tenant_id from public.memberships
      where user_id = public.app_current_user_id()
    )
  )
);

create policy document_expiry_notifications_write on public.document_expiry_notifications
for insert to authenticated
with check (true);

-- Employee audit log policies
create policy employee_audit_log_read on public.employee_audit_log
for select to authenticated
using (public.app_has_permission('employees.audit.read', tenant_id));

-- Employee status history policies
create policy employee_status_history_read on public.employee_status_history
for select to authenticated
using (
  exists (
    select 1 from public.employees e 
    where e.id = employee_status_history.employee_id 
    and public.app_has_permission('employees.read', e.tenant_id)
  )
);

create policy employee_status_history_write on public.employee_status_history
for all to authenticated
using (
  exists (
    select 1 from public.employees e 
    where e.id = employee_status_history.employee_id 
    and public.app_has_permission('employees.write', e.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.employees e 
    where e.id = employee_status_history.employee_id 
    and public.app_has_permission('employees.write', e.tenant_id)
  )
);

-- Workflow templates policies
create policy workflow_templates_select_all on public.workflow_templates
for select to authenticated using (true);

-- Workflows policies
create policy workflows_select on public.workflows
for select to authenticated
using (
  public.app_has_permission('workflows.read', workflows.tenant_id)
  or public.app_has_permission('workflows.manage', workflows.tenant_id)
);

create policy workflows_modify on public.workflows
for all to authenticated
using (public.app_has_permission('workflows.manage', workflows.tenant_id))
with check (public.app_has_permission('workflows.manage', workflows.tenant_id));

-- Workflow versions policies
create policy workflow_versions_access on public.workflow_versions
for all to authenticated
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

-- Workflow nodes policies
create policy workflow_nodes_access on public.workflow_nodes
for all to authenticated
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

-- Workflow edges policies
create policy workflow_edges_access on public.workflow_edges
for all to authenticated
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

-- Workflow runs policies
create policy workflow_runs_select on public.workflow_runs
for select to authenticated
using (
  public.app_has_permission('workflows.read', workflow_runs.tenant_id)
  or public.app_has_permission('workflows.run.manage', workflow_runs.tenant_id)
  or public.app_has_permission('workflows.manage', workflow_runs.tenant_id)
);

create policy workflow_runs_modify on public.workflow_runs
for all to authenticated
using (
  public.app_has_permission('workflows.run.manage', workflow_runs.tenant_id)
  or public.app_has_permission('workflows.manage', workflow_runs.tenant_id)
)
with check (
  public.app_has_permission('workflows.run.manage', workflow_runs.tenant_id)
  or public.app_has_permission('workflows.manage', workflow_runs.tenant_id)
);

-- Workflow run steps policies
create policy workflow_run_steps_access on public.workflow_run_steps
for all to authenticated
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

-- Workflow action queue policies
create policy workflow_action_queue_access on public.workflow_action_queue
for all to authenticated
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

-- Workflow events policies
create policy workflow_events_access on public.workflow_events
for all to authenticated
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

-- Employee journey views policies
create policy employee_journey_views_access on public.employee_journey_views
for all to authenticated
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

-- Goals policies
create policy goals_select on public.goals
for select to authenticated
using (
  public.app_has_permission('goals.read', tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = goals.employee_id
      and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  )
);

create policy goals_insert on public.goals
for insert to authenticated
with check (
  public.app_has_permission('goals.write', tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = goals.employee_id
      and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  )
);

create policy goals_update on public.goals
for update to authenticated
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

create policy goals_delete on public.goals
for delete to authenticated
using (
  public.app_has_permission('goals.write', tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = goals.employee_id
      and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  )
);

-- Goal key results policies
create policy goal_key_results_select on public.goal_key_results
for select to authenticated
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

create policy goal_key_results_write on public.goal_key_results
for all to authenticated
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

-- Goal updates policies
create policy goal_updates_select on public.goal_updates
for select to authenticated
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

create policy goal_updates_insert on public.goal_updates
for insert to authenticated
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

-- Check-ins policies
create policy check_ins_select on public.check_ins
for select to authenticated
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

create policy check_ins_insert on public.check_ins
for insert to authenticated
with check (
  public.app_has_permission('check_ins.write', tenant_id)
  or manager_user_id = public.app_current_user_id()
);

create policy check_ins_update on public.check_ins
for update to authenticated
using (
  public.app_has_permission('check_ins.write', tenant_id)
  or manager_user_id = public.app_current_user_id()
)
with check (
  public.app_has_permission('check_ins.write', tenant_id)
  or manager_user_id = public.app_current_user_id()
);

-- Check-in agendas policies
create policy check_in_agendas_select on public.check_in_agendas
for select to authenticated
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

create policy check_in_agendas_write on public.check_in_agendas
for all to authenticated
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

-- Check-in private notes policies
create policy check_in_private_notes_select on public.check_in_private_notes
for select to authenticated
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

create policy check_in_private_notes_upsert on public.check_in_private_notes
for all to authenticated
using (manager_user_id = public.app_current_user_id())
with check (manager_user_id = public.app_current_user_id());

-- Time entries policies
create policy time_entries_select_self_or_tenant on public.time_entries
for select to authenticated
using (
  user_id = public.app_current_user_id()
  or public.app_has_permission('time.read', tenant_id)
);

create policy time_entries_insert_self on public.time_entries
for insert to authenticated
with check (
  user_id = public.app_current_user_id()
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = time_entries.tenant_id
  )
);

create policy time_entries_update_self_or_time_write on public.time_entries
for update to authenticated
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

create policy time_entries_delete_time_write on public.time_entries
for delete to authenticated
using (public.app_has_permission('time.write', tenant_id));

-- Overtime balances policies
create policy overtime_balances_read on public.overtime_balances
for select to authenticated
using (
  public.app_has_permission('overtime.view', tenant_id)
  and (user_id = auth.uid() or public.app_has_permission('time.view_team', tenant_id))
);

create policy overtime_balances_manage on public.overtime_balances
for all to authenticated
using (public.app_has_permission('overtime.approve', tenant_id))
with check (public.app_has_permission('overtime.approve', tenant_id));

-- Overtime rules policies
create policy overtime_rules_read on public.overtime_rules
for select to authenticated
using (public.app_has_permission('overtime.view', tenant_id));

create policy overtime_rules_manage on public.overtime_rules
for all to authenticated
using (public.app_has_permission('overtime.approve', tenant_id))
with check (public.app_has_permission('overtime.approve', tenant_id));

-- Overtime requests policies
create policy overtime_requests_read_own on public.overtime_requests
for select to authenticated
using (user_id = auth.uid());

create policy overtime_requests_read_team on public.overtime_requests
for select to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.user_id = auth.uid()
    and e.tenant_id = overtime_requests.tenant_id
    and (
      public.app_has_permission('time.view_team', e.tenant_id)
      or exists (
        select 1 from public.employees ee
        where ee.manager_id = e.id
        and ee.user_id = overtime_requests.user_id
        and ee.tenant_id = overtime_requests.tenant_id
      )
    )
  )
);

create policy overtime_requests_create on public.overtime_requests
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
    and m.tenant_id = overtime_requests.tenant_id
  )
);

create policy overtime_requests_update on public.overtime_requests
for update to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.user_id = auth.uid()
    and e.tenant_id = overtime_requests.tenant_id
    and (
      public.app_has_permission('time.approve', e.tenant_id)
      or exists (
        select 1 from public.employees ee
        where ee.manager_id = e.id
        and ee.user_id = overtime_requests.user_id
        and ee.tenant_id = overtime_requests.tenant_id
      )
    )
  )
)
with check (
  exists (
    select 1 from public.employees e
    where e.user_id = auth.uid()
    and e.tenant_id = overtime_requests.tenant_id
    and (
      public.app_has_permission('time.approve', e.tenant_id)
      or exists (
        select 1 from public.employees ee
        where ee.manager_id = e.id
        and ee.user_id = overtime_requests.user_id
        and ee.tenant_id = overtime_requests.tenant_id
      )
    )
  )
);

create policy overtime_requests_cancel on public.overtime_requests
for update to authenticated
using (
  user_id = auth.uid()
  and status = 'pending'
)
with check (
  user_id = auth.uid()
  and status = 'cancelled'
);

-- Time entry audit policies
create policy time_entry_audit_read on public.time_entry_audit
for select to authenticated
using (
  exists (
    select 1 from public.time_entries te 
    where te.id = time_entry_audit.time_entry_id 
    and public.app_has_permission('time.view_team', te.tenant_id)
  )
);

-- Leave types policies
create policy leave_types_read on public.leave_types
for select to authenticated
using (public.app_has_permission('time.read', tenant_id));

create policy leave_types_manage on public.leave_types
for all to authenticated
using (public.app_has_permission('leave.manage_types', tenant_id))
with check (public.app_has_permission('leave.manage_types', tenant_id));

-- Leave balances policies
create policy leave_balances_read_own on public.leave_balances
for select to authenticated
using (
  exists (
    select 1 from public.employees e 
    where e.id = leave_balances.employee_id 
    and e.user_id = auth.uid()
    and e.tenant_id = leave_balances.tenant_id
  )
);

create policy leave_balances_read_team on public.leave_balances
for select to authenticated
using (
  public.app_has_permission('leave.view_team_calendar', tenant_id)
  and exists (
    select 1 from public.employees e 
    where e.id = leave_balances.employee_id 
    and (
      e.manager_id in (
        select id from public.employees where user_id = auth.uid()
      )
      or e.user_id = auth.uid()
    )
    and e.tenant_id = leave_balances.tenant_id
  )
);

create policy leave_balances_manage on public.leave_balances
for all to authenticated
using (public.app_has_permission('leave.manage_balances', tenant_id))
with check (public.app_has_permission('leave.manage_balances', tenant_id));

-- Holiday calendars policies
create policy holiday_calendars_read on public.holiday_calendars
for select to authenticated
using (public.app_has_permission('time.read', tenant_id));

create policy holiday_calendars_manage on public.holiday_calendars
for all to authenticated
using (public.app_has_permission('leave.manage_holidays', tenant_id))
with check (public.app_has_permission('leave.manage_holidays', tenant_id));

-- Blackout periods policies
create policy blackout_periods_read on public.blackout_periods
for select to authenticated
using (
  exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
    and m.tenant_id = blackout_periods.tenant_id
  )
);

create policy blackout_periods_manage on public.blackout_periods
for all to authenticated
using (
  exists (
    select 1 from public.memberships m
    join public.role_permissions rp on rp.role = m.role
    where m.user_id = auth.uid()
    and m.tenant_id = blackout_periods.tenant_id
    and rp.permission_key = 'leave.manage_holidays'
  )
)
with check (
  exists (
    select 1 from public.memberships m
    join public.role_permissions rp on rp.role = m.role
    where m.user_id = auth.uid()
    and m.tenant_id = blackout_periods.tenant_id
    and rp.permission_key = 'leave.manage_holidays'
  )
);

-- Time off requests policies (using corrected policy from migration 7)
create policy time_off_requests_select_self_or_tenant on public.time_off_requests
for select to authenticated
using (
  user_id = public.app_current_user_id()
  or public.app_has_permission('time.read', tenant_id)
);

create policy time_off_requests_insert_self on public.time_off_requests
for insert to authenticated
with check (
  user_id = public.app_current_user_id()
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = time_off_requests.tenant_id
  )
);

create policy time_off_requests_update_approvers on public.time_off_requests
for update to authenticated
using (public.app_has_permission('leave.approve_requests', tenant_id))
with check (public.app_has_permission('leave.approve_requests', tenant_id));

create policy time_off_requests_cancel_self on public.time_off_requests
for update to authenticated
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

-- Leave request audit policies
create policy leave_request_audit_read on public.leave_request_audit
for select to authenticated
using (
  public.app_has_permission('leave.approve_requests', tenant_id)
  or exists (
    select 1 from public.time_off_requests tor
    join public.employees e on tor.user_id = e.user_id
    where tor.id = leave_request_audit.request_id
    and e.user_id = auth.uid()
    and e.tenant_id = tor.tenant_id
  )
);

create policy leave_request_audit_insert on public.leave_request_audit
for insert to authenticated
with check (
  public.app_has_permission('leave.approve_requests', tenant_id)
  or exists (
    select 1 from public.time_off_requests tor
    join public.employees e on tor.user_id = e.user_id
    where tor.id = request_id
    and e.user_id = auth.uid()
    and e.tenant_id = tor.tenant_id
  )
);

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

-- Jobs policies
create policy jobs_read on public.jobs
for select to authenticated
using (public.app_has_permission('recruiting.jobs.read', tenant_id));

create policy jobs_write on public.jobs
for all to authenticated
using (public.app_has_permission('recruiting.jobs.write', tenant_id))
with check (public.app_has_permission('recruiting.jobs.write', tenant_id));

-- Job postings policies
create policy job_postings_read on public.job_postings
for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = job_postings.job_id
    and public.app_has_permission('recruiting.jobs.read', j.tenant_id)
  )
);

create policy job_postings_write on public.job_postings
for all to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = job_postings.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.jobs j
    where j.id = job_postings.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
);

-- Candidates policies
create policy candidates_read on public.candidates
for select to authenticated
using (public.app_has_permission('recruiting.candidates.read', tenant_id));

create policy candidates_write on public.candidates
for all to authenticated
using (public.app_has_permission('recruiting.candidates.write', tenant_id))
with check (public.app_has_permission('recruiting.candidates.write', tenant_id));

-- Applications policies
create policy applications_read on public.applications
for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = applications.job_id
    and public.app_has_permission('recruiting.jobs.read', j.tenant_id)
  )
);

create policy applications_write on public.applications
for all to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = applications.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.jobs j
    where j.id = applications.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
);

-- Pipeline stages policies
create policy pipeline_stages_read on public.pipeline_stages
for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = pipeline_stages.job_id
    and public.app_has_permission('recruiting.jobs.read', j.tenant_id)
  )
);

create policy pipeline_stages_write on public.pipeline_stages
for all to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = pipeline_stages.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.jobs j
    where j.id = pipeline_stages.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
);

-- Interviews policies
create policy interviews_read on public.interviews
for select to authenticated
using (
  exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = interviews.application_id
    and public.app_has_permission('recruiting.jobs.read', j.tenant_id)
  )
);

create policy interviews_write on public.interviews
for all to authenticated
using (
  exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = interviews.application_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = interviews.application_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
);

-- Evaluations policies
create policy evaluations_read on public.evaluations
for select to authenticated
using (
  exists (
    select 1 from public.interviews i
    join public.applications a on a.id = i.application_id
    join public.jobs j on j.id = a.job_id
    where i.id = evaluations.interview_id
    and public.app_has_permission('recruiting.jobs.read', j.tenant_id)
  )
);

create policy evaluations_write on public.evaluations
for all to authenticated
using (
  exists (
    select 1 from public.interviews i
    join public.applications a on a.id = i.application_id
    join public.jobs j on j.id = a.job_id
    where i.id = evaluations.interview_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.interviews i
    join public.applications a on a.id = i.application_id
    join public.jobs j on j.id = a.job_id
    where i.id = evaluations.interview_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
);

-- Communications policies
create policy communications_read on public.communications
for select to authenticated
using (public.app_has_permission('recruiting.jobs.read', tenant_id));

create policy communications_write on public.communications
for all to authenticated
using (public.app_has_permission('recruiting.jobs.write', tenant_id))
with check (public.app_has_permission('recruiting.jobs.write', tenant_id));

-- Talent pool policies
create policy talent_pool_read on public.talent_pool
for select to authenticated
using (public.app_has_permission('recruiting.candidates.read', tenant_id));

create policy talent_pool_write on public.talent_pool
for all to authenticated
using (public.app_has_permission('recruiting.candidates.write', tenant_id))
with check (public.app_has_permission('recruiting.candidates.write', tenant_id));

-- Conversations policies
create policy conversations_select_own on public.conversations
for select to authenticated
using (
  created_by = (select public.app_current_user_id())
  and exists (
    select 1
    from public.memberships m
    where m.user_id = (select public.app_current_user_id())
      and m.tenant_id = conversations.tenant_id
  )
);

create policy conversations_insert_own on public.conversations
for insert to authenticated
with check (
  created_by = (select public.app_current_user_id())
  and exists (
    select 1
    from public.memberships m
    where m.user_id = (select public.app_current_user_id())
      and m.tenant_id = conversations.tenant_id
  )
);

create policy conversations_update_own on public.conversations
for update to authenticated
using (
  created_by = (select public.app_current_user_id())
  and exists (
    select 1
    from public.memberships m
    where m.user_id = (select public.app_current_user_id())
      and m.tenant_id = conversations.tenant_id
  )
)
with check (
  created_by = (select public.app_current_user_id())
  and exists (
    select 1
    from public.memberships m
    where m.user_id = (select public.app_current_user_id())
      and m.tenant_id = conversations.tenant_id
  )
);

create policy conversations_delete_own on public.conversations
for delete to authenticated
using (
  created_by = (select public.app_current_user_id())
  and exists (
    select 1
    from public.memberships m
    where m.user_id = (select public.app_current_user_id())
      and m.tenant_id = conversations.tenant_id
  )
);

-- Messages policies
create policy messages_select_own_conversations on public.messages
for select to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.created_by = (select public.app_current_user_id())
      and exists (
        select 1
        from public.memberships m
        where m.user_id = (select public.app_current_user_id())
          and m.tenant_id = messages.tenant_id
      )
  )
);

create policy messages_insert_own_conversations on public.messages
for insert to authenticated
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.created_by = (select public.app_current_user_id())
      and exists (
        select 1
        from public.memberships m
        where m.user_id = (select public.app_current_user_id())
          and m.tenant_id = messages.tenant_id
      )
  )
);

-- ==============================================
-- 23. HELPER VIEWS
-- ==============================================

-- Employee summary view
create or replace view public.employee_summary as
select 
  e.id,
  e.tenant_id,
  e.employee_number,
  e.name,
  e.email,
  e.job_title,
  e.status,
  e.profile_completion_pct,
  e.created_at,
  e.updated_at,
  d.name as department_name,
  d.id as department_id,
  m.name as manager_name,
  m.id as manager_id
from public.employees e
left join public.departments d on e.department_id = d.id
left join public.employees m on e.manager_id = m.id;

-- Department hierarchy view
create or replace view public.department_hierarchy as
with recursive dept_tree as (
  select 
    id,
    tenant_id,
    name,
    description,
    parent_id,
    head_employee_id,
    cost_center,
    0 as level,
    array[id] as path,
    name as full_path
  from public.departments
  where parent_id is null
  
  union all
  
  select 
    d.id,
    d.tenant_id,
    d.name,
    d.description,
    d.parent_id,
    d.head_employee_id,
    d.cost_center,
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
  (select count(*) from public.employees where department_id = dt.id) as employee_count
from dept_tree dt
left join public.employees e on dt.head_employee_id = e.id
order by dt.tenant_id, dt.level, dt.name;

-- Employee goal summaries view
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

-- Time entry summary view
create or replace view public.time_entry_summary as
select 
  te.id,
  te.tenant_id,
  te.user_id,
  te.clock_in_at,
  te.clock_out_at,
  te.duration_minutes,
  te.break_minutes,
  te.project_task,
  te.notes,
  te.entry_type,
  te.approval_status,
  te.approver_user_id,
  te.approved_at,
  te.edited_by,
  te.created_at,
  te.updated_at,
  e.name as employee_name,
  e.email as employee_email,
  e.employee_number,
  approver.name as approver_name,
  editor.name as editor_name,
  case 
    when te.duration_minutes is not null then 
      greatest(0, te.duration_minutes - coalesce(te.break_minutes, 0))
    else null
  end as net_minutes
from public.time_entries te
left join public.employees e on te.user_id = e.user_id and te.tenant_id = e.tenant_id
left join public.employees approver on te.approver_user_id = approver.user_id and te.tenant_id = approver.tenant_id
left join public.employees editor on te.edited_by = editor.user_id and te.tenant_id = editor.tenant_id;

-- Pending time approvals view
create or replace view public.pending_time_approvals as
select 
  tes.*,
  e.manager_id,
  m.name as manager_name,
  m.email as manager_email
from public.time_entry_summary tes
left join public.employees e on tes.user_id = e.user_id and tes.tenant_id = e.tenant_id
left join public.employees m on e.manager_id = m.id
where tes.approval_status = 'pending'
order by tes.created_at desc;

-- Overtime requests summary view
create or replace view public.overtime_requests_summary as
select 
  or_req.id,
  or_req.tenant_id,
  or_req.user_id,
  or_req.start_date,
  or_req.end_date,
  or_req.estimated_hours,
  or_req.reason,
  or_req.status,
  or_req.approver_user_id,
  or_req.decided_at,
  or_req.denial_reason,
  or_req.created_at,
  or_req.updated_at,
  e.name as employee_name,
  e.email as employee_email,
  approver.name as approver_name,
  approver.email as approver_email
from public.overtime_requests or_req
left join public.employees e on or_req.user_id = e.user_id and or_req.tenant_id = e.tenant_id
left join public.employees approver on or_req.approver_user_id = approver.user_id and or_req.tenant_id = approver.tenant_id;

-- Leave request summary view
create or replace view public.leave_request_summary as
select 
  tor.id,
  tor.tenant_id,
  tor.user_id,
  tor.start_date,
  tor.end_date,
  tor.days_count,
  tor.half_day_start,
  tor.half_day_end,
  tor.leave_type,
  tor.status,
  tor.approver_user_id,
  tor.decided_at,
  tor.note,
  tor.attachment_path,
  tor.denial_reason,
  tor.cancelled_by,
  tor.cancelled_at,
  tor.created_at,
  tor.updated_at,
  e.name as employee_name,
  e.email as employee_email,
  e.employee_number,
  lt.name as leave_type_name,
  lt.color as leave_type_color,
  lt.requires_certificate,
  approver.name as approver_name,
  canceller.name as cancelled_by_name
from public.time_off_requests tor
left join public.employees e on tor.user_id = e.user_id and tor.tenant_id = e.tenant_id
left join public.leave_types lt on tor.leave_type_id = lt.id
left join public.employees approver on tor.approver_user_id = approver.user_id and tor.tenant_id = approver.tenant_id
left join public.employees canceller on tor.cancelled_by = canceller.user_id and tor.tenant_id = canceller.tenant_id;

-- Team leave calendar view
create or replace view public.team_leave_calendar as
select 
  lrs.*,
  e.manager_id,
  m.name as manager_name,
  m.email as manager_email
from public.leave_request_summary lrs
left join public.employees e on lrs.user_id = e.user_id and lrs.tenant_id = e.tenant_id
left join public.employees m on e.manager_id = m.id
where lrs.status in ('pending', 'approved');

-- Leave balance summary view
create or replace view public.leave_balance_summary as
select 
  lb.id,
  lb.tenant_id,
  lb.employee_id,
  lb.leave_type_id,
  lb.balance_days,
  lb.used_ytd,
  lb.period_start,
  lb.period_end,
  lb.notes,
  lb.created_at,
  lb.updated_at,
  e.name as employee_name,
  e.email as employee_email,
  e.employee_number,
  lt.name as leave_type_name,
  lt.code as leave_type_code,
  lt.color as leave_type_color,
  lt.requires_approval,
  lt.requires_certificate,
  lt.allow_negative_balance,
  (lb.balance_days - lb.used_ytd) as remaining_balance
from public.leave_balances lb
left join public.employees e on lb.employee_id = e.id
left join public.leave_types lt on lb.leave_type_id = lt.id
where lb.period_start <= current_date and lb.period_end >= current_date;

-- Leave utilization summary view
create or replace view public.leave_utilization_summary as
select 
  lb.tenant_id,
  lb.employee_id,
  e.name as employee_name,
  e.email as employee_email,
  e.department_id,
  d.name as department_name,
  lb.leave_type_id,
  lt.name as leave_type_name,
  lt.code as leave_type_code,
  date_trunc('month', tor.start_date)::date as period_month,
  date_trunc('year', tor.start_date)::date as period_year,
  count(distinct tor.id) as request_count,
  coalesce(sum(tor.days_count), 0) as days_taken,
  max(lb.balance_days) as balance_at_period_start,
  max(lb.used_ytd) as used_ytd_total,
  case 
    when max(lb.balance_days) > 0 then 
      round((coalesce(sum(tor.days_count), 0)::numeric / max(lb.balance_days)) * 100, 2)
    else 0
  end as utilization_rate
from public.leave_balances lb
left join public.employees e on lb.employee_id = e.id
left join public.departments d on e.department_id = d.id
left join public.leave_types lt on lb.leave_type_id = lt.id
left join public.time_off_requests tor on 
  tor.user_id = e.user_id 
  and tor.tenant_id = lb.tenant_id
  and tor.leave_type_id = lb.leave_type_id
  and tor.status = 'approved'
  and date_trunc('month', tor.start_date)::date = date_trunc('month', lb.period_start)::date
where lb.period_start <= current_date and lb.period_end >= current_date
group by 
  lb.tenant_id,
  lb.employee_id,
  e.name,
  e.email,
  e.department_id,
  d.name,
  lb.leave_type_id,
  lt.name,
  lt.code,
  date_trunc('month', tor.start_date)::date,
  date_trunc('year', tor.start_date)::date;

-- Leave trends monthly view
create or replace view public.leave_trends_monthly as
select 
  tor.tenant_id,
  date_trunc('month', tor.start_date)::date as month,
  tor.leave_type_id,
  lt.name as leave_type_name,
  lt.code as leave_type_code,
  count(distinct tor.id) as request_count,
  count(distinct e.id) as employee_count,
  coalesce(sum(tor.days_count), 0) as total_days,
  avg(tor.days_count) as avg_days_per_request,
  min(tor.days_count) as min_days,
  max(tor.days_count) as max_days
from public.time_off_requests tor
join public.leave_types lt on tor.leave_type_id = lt.id
left join public.employees e on tor.user_id = e.user_id and tor.tenant_id = e.tenant_id
where tor.status = 'approved'
group by 
  tor.tenant_id,
  date_trunc('month', tor.start_date)::date,
  tor.leave_type_id,
  lt.name,
  lt.code;

-- Leave balance forecast view
create or replace view public.leave_balance_forecast as
select 
  lb.tenant_id,
  lb.employee_id,
  e.name as employee_name,
  e.email as employee_email,
  lb.leave_type_id,
  lt.name as leave_type_name,
  lt.code as leave_type_code,
  lb.balance_days as current_balance,
  lb.period_end,
  coalesce(sum(case when tor.status = 'approved' then tor.days_count else 0 end), 0) as approved_days_pending,
  coalesce(sum(case when tor.status = 'pending' then tor.days_count else 0 end), 0) as pending_days_requested,
  (lb.balance_days - coalesce(sum(case when tor.status = 'approved' then tor.days_count else 0 end), 0)) as projected_balance,
  case 
    when lb.period_end > current_date then 
      (lb.period_end - current_date)::integer
    else 0
  end as days_until_period_end
from public.leave_balances lb
join public.employees e on lb.employee_id = e.id
join public.leave_types lt on lb.leave_type_id = lt.id
left join public.time_off_requests tor on 
  tor.user_id = e.user_id 
  and tor.tenant_id = lb.tenant_id
  and tor.leave_type_id = lb.leave_type_id
  and tor.start_date > current_date
  and tor.status in ('approved', 'pending')
where lb.period_start <= current_date and lb.period_end >= current_date
group by 
  lb.tenant_id,
  lb.employee_id,
  e.name,
  e.email,
  lb.leave_type_id,
  lt.name,
  lt.code,
  lb.balance_days,
  lb.period_end;

comment on view public.leave_utilization_summary is 'Aggregated leave utilization metrics by employee, department, leave type, and month/year';
comment on view public.leave_trends_monthly is 'Monthly aggregates of leave taken by type with statistical summaries';
comment on view public.leave_balance_forecast is 'Projected leave balances based on current balance and pending/approved requests';

-- Equipment summary view
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

-- Access grants summary view
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

-- Exit interview summary view
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

