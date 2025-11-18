-- Core Foundation Migration
-- This migration creates all foundational infrastructure, auth, tenants, and core HR tables
-- Includes: tenants, memberships, permissions, employees, departments, office locations, teams, documents, audit logs

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

-- ==============================================
-- 2. HELPER FUNCTIONS
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

-- ==============================================
-- 3.5. HELPER FUNCTIONS (after tables are created)
-- ==============================================

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

-- ==============================================
-- 4. EMPLOYEES TABLE (with all enhancements)
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
-- 5. DEPARTMENTS TABLE (after employees, since it references employees)
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

-- Add foreign key constraints for employees after referenced tables exist
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

create trigger set_updated_at_on_profiles
before update on public.profiles
for each row
execute function public.set_updated_at();

-- ==============================================
-- 10. EMPLOYEE DOCUMENTS TABLE (with versioning)
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

create trigger set_updated_at_on_employee_documents
before update on public.employee_documents
for each row
execute function public.set_updated_at();

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
-- 14. EMPLOYEE HELPER FUNCTIONS
-- ==============================================

-- Function to calculate profile completion percentage
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

-- Function to auto-generate employee number
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

-- Trigger function to auto-generate employee number and calculate profile completion
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

-- Trigger function to update profile completion on employee updates
-- Changed to BEFORE trigger to prevent infinite recursion
create or replace function public.employee_before_update()
returns trigger
language plpgsql
as $$
begin
  -- Calculate and set profile completion before the update
  new.profile_completion_pct := public.calculate_profile_completion(new);
  
  return new;
end;
$$;

-- ==============================================
-- 15. TRIGGERS FOR EMPLOYEES
-- ==============================================

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

-- ==============================================
-- 16. ROW LEVEL SECURITY
-- ==============================================

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

-- ==============================================
-- 17. PERMISSIONS AND ROLE PERMISSIONS SEEDS
-- ==============================================

insert into public.permissions (key) values
  ('members.manage'),
  ('employees.read'),
  ('employees.write'),
  ('employees.fields.manage'),
  ('employees.documents.read'),
  ('employees.documents.write'),
  ('employees.audit.read'),
  ('employees.compensation.read'),
  ('employees.compensation.write'),
  ('employees.sensitive.read'),
  ('employees.sensitive.write'),
  ('employees.import'),
  ('departments.manage'),
  ('departments.read'),
  ('office_locations.read'),
  ('office_locations.write'),
  ('teams.read'),
  ('teams.write'),
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
  ('time.approve'),
  ('time.edit_past'),
  ('time.view_team'),
  ('time_off.approve'),
  ('overtime.view'),
  ('overtime.approve'),
  ('calendar.read'),
  ('leave.manage_types'),
  ('leave.manage_balances'),
  ('leave.manage_holidays'),
  ('leave.view_team_calendar'),
  ('leave.approve_requests'),
  ('recruiting.jobs.read'),
  ('recruiting.jobs.write'),
  ('recruiting.candidates.read'),
  ('recruiting.candidates.write')
on conflict do nothing;

insert into public.role_permissions (role, permission_key) values
  -- Owner: all permissions
  ('owner', 'members.manage'),
  ('owner', 'employees.read'),
  ('owner', 'employees.write'),
  ('owner', 'employees.fields.manage'),
  ('owner', 'employees.documents.read'),
  ('owner', 'employees.documents.write'),
  ('owner', 'employees.audit.read'),
  ('owner', 'employees.compensation.read'),
  ('owner', 'employees.compensation.write'),
  ('owner', 'employees.sensitive.read'),
  ('owner', 'employees.sensitive.write'),
  ('owner', 'employees.import'),
  ('owner', 'departments.manage'),
  ('owner', 'departments.read'),
  ('owner', 'office_locations.read'),
  ('owner', 'office_locations.write'),
  ('owner', 'teams.read'),
  ('owner', 'teams.write'),
  ('owner', 'workflows.read'),
  ('owner', 'workflows.manage'),
  ('owner', 'workflows.run.manage'),
  ('owner', 'workflows.template.use'),
  ('owner', 'goals.read'),
  ('owner', 'goals.write'),
  ('owner', 'check_ins.read'),
  ('owner', 'check_ins.write'),
  ('owner', 'time.read'),
  ('owner', 'time.write'),
  ('owner', 'time.approve'),
  ('owner', 'time.edit_past'),
  ('owner', 'time.view_team'),
  ('owner', 'time_off.approve'),
  ('owner', 'overtime.view'),
  ('owner', 'overtime.approve'),
  ('owner', 'calendar.read'),
  ('owner', 'leave.manage_types'),
  ('owner', 'leave.manage_balances'),
  ('owner', 'leave.manage_holidays'),
  ('owner', 'leave.view_team_calendar'),
  ('owner', 'leave.approve_requests'),
  ('owner', 'recruiting.jobs.read'),
  ('owner', 'recruiting.jobs.write'),
  ('owner', 'recruiting.candidates.read'),
  ('owner', 'recruiting.candidates.write'),
  
  -- Admin: all permissions
  ('admin', 'members.manage'),
  ('admin', 'employees.read'),
  ('admin', 'employees.write'),
  ('admin', 'employees.fields.manage'),
  ('admin', 'employees.documents.read'),
  ('admin', 'employees.documents.write'),
  ('admin', 'employees.audit.read'),
  ('admin', 'employees.compensation.read'),
  ('admin', 'employees.compensation.write'),
  ('admin', 'employees.sensitive.read'),
  ('admin', 'employees.sensitive.write'),
  ('admin', 'employees.import'),
  ('admin', 'departments.manage'),
  ('admin', 'departments.read'),
  ('admin', 'office_locations.read'),
  ('admin', 'office_locations.write'),
  ('admin', 'teams.read'),
  ('admin', 'teams.write'),
  ('admin', 'workflows.read'),
  ('admin', 'workflows.manage'),
  ('admin', 'workflows.run.manage'),
  ('admin', 'workflows.template.use'),
  ('admin', 'goals.read'),
  ('admin', 'goals.write'),
  ('admin', 'check_ins.read'),
  ('admin', 'check_ins.write'),
  ('admin', 'time.read'),
  ('admin', 'time.write'),
  ('admin', 'time.approve'),
  ('admin', 'time.edit_past'),
  ('admin', 'time.view_team'),
  ('admin', 'time_off.approve'),
  ('admin', 'overtime.view'),
  ('admin', 'overtime.approve'),
  ('admin', 'calendar.read'),
  ('admin', 'leave.manage_types'),
  ('admin', 'leave.manage_balances'),
  ('admin', 'leave.manage_holidays'),
  ('admin', 'leave.view_team_calendar'),
  ('admin', 'leave.approve_requests'),
  ('admin', 'recruiting.jobs.read'),
  ('admin', 'recruiting.jobs.write'),
  ('admin', 'recruiting.candidates.read'),
  ('admin', 'recruiting.candidates.write'),
  
  -- People Ops: most permissions except compensation write
  ('people_ops', 'employees.read'),
  ('people_ops', 'employees.write'),
  ('people_ops', 'employees.documents.read'),
  ('people_ops', 'employees.documents.write'),
  ('people_ops', 'employees.fields.manage'),
  ('people_ops', 'employees.audit.read'),
  ('people_ops', 'employees.compensation.read'),
  ('people_ops', 'employees.sensitive.read'),
  ('people_ops', 'employees.import'),
  ('people_ops', 'departments.manage'),
  ('people_ops', 'departments.read'),
  ('people_ops', 'office_locations.read'),
  ('people_ops', 'office_locations.write'),
  ('people_ops', 'teams.read'),
  ('people_ops', 'teams.write'),
  ('people_ops', 'workflows.read'),
  ('people_ops', 'goals.read'),
  ('people_ops', 'goals.write'),
  ('people_ops', 'check_ins.read'),
  ('people_ops', 'calendar.read'),
  ('people_ops', 'time.approve'),
  ('people_ops', 'time.edit_past'),
  ('people_ops', 'time.view_team'),
  ('people_ops', 'overtime.view'),
  ('people_ops', 'overtime.approve'),
  ('people_ops', 'leave.manage_types'),
  ('people_ops', 'leave.manage_balances'),
  ('people_ops', 'leave.manage_holidays'),
  ('people_ops', 'leave.view_team_calendar'),
  ('people_ops', 'leave.approve_requests'),
  ('people_ops', 'recruiting.jobs.read'),
  ('people_ops', 'recruiting.jobs.write'),
  ('people_ops', 'recruiting.candidates.read'),
  ('people_ops', 'recruiting.candidates.write'),
  
  -- Manager: limited permissions
  ('manager', 'employees.read'),
  ('manager', 'employees.write'),
  ('manager', 'employees.audit.read'),
  ('manager', 'departments.read'),
  ('manager', 'office_locations.read'),
  ('manager', 'teams.read'),
  ('manager', 'teams.write'),
  ('manager', 'workflows.read'),
  ('manager', 'workflows.run.manage'),
  ('manager', 'workflows.template.use'),
  ('manager', 'goals.read'),
  ('manager', 'goals.write'),
  ('manager', 'check_ins.read'),
  ('manager', 'check_ins.write'),
  ('manager', 'time.read'),
  ('manager', 'time.write'),
  ('manager', 'time.approve'),
  ('manager', 'time.view_team'),
  ('manager', 'time_off.approve'),
  ('manager', 'overtime.view'),
  ('manager', 'calendar.read'),
  ('manager', 'leave.view_team_calendar'),
  ('manager', 'leave.approve_requests'),
  
  -- Employee: basic permissions
  ('employee', 'employees.read'),
  ('employee', 'workflows.read'),
  ('employee', 'office_locations.read'),
  ('employee', 'teams.read'),
  ('employee', 'overtime.view')
on conflict do nothing;

-- ==============================================
-- 18. GRANT PERMISSIONS
-- ==============================================

revoke all on function public.app_create_tenant(text) from public;
grant execute on function public.app_create_tenant(text) to authenticated;

-- ==============================================
-- 19. HELPER VIEWS
-- ==============================================

-- View for employee summary with department info
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

-- View for department hierarchy
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

