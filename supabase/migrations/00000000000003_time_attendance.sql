-- Time Attendance Migration
-- This migration creates time tracking, overtime, and approval tables
-- Includes: time_entries (with enhancements), overtime_balances, overtime_rules, overtime_requests, time_entry_audit

-- ==============================================
-- 1. TIME ENTRIES TABLE (with all enhancements)
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

-- ==============================================
-- 2. OVERTIME BALANCES TABLE
-- ==============================================

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

-- ==============================================
-- 3. OVERTIME RULES TABLE
-- ==============================================

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

-- ==============================================
-- 4. OVERTIME REQUESTS TABLE
-- ==============================================

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

-- ==============================================
-- 5. TIME ENTRY AUDIT TABLE
-- ==============================================

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
-- 6. FUNCTIONS
-- ==============================================

create or replace function public.requires_time_entry_approval(
  entry_date date,
  entry_type text,
  user_id uuid
)
returns boolean
language plpgsql
as $$
begin
  if entry_type = 'manual' and entry_date < current_date then
    return true;
  end if;
  
  return false;
end;
$$;

create or replace function public.create_time_entry_audit(
  p_time_entry_id uuid,
  p_changed_by uuid,
  p_field_name text,
  p_old_value jsonb,
  p_new_value jsonb,
  p_change_reason text default null
)
returns uuid
language plpgsql
as $$
declare
  audit_id uuid;
begin
  insert into public.time_entry_audit (
    time_entry_id,
    changed_by,
    field_name,
    old_value,
    new_value,
    change_reason
  ) values (
    p_time_entry_id,
    p_changed_by,
    p_field_name,
    p_old_value,
    p_new_value,
    p_change_reason
  ) returning id into audit_id;
  
  return audit_id;
end;
$$;

create or replace function public.check_time_entry_overlap(
  p_user_id uuid,
  p_tenant_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_exclude_id uuid default null
)
returns boolean
language plpgsql
as $$
declare
  overlap_count integer;
begin
  select count(*)
  into overlap_count
  from public.time_entries
  where user_id = p_user_id
    and tenant_id = p_tenant_id
    and approval_status != 'rejected'
    and (p_exclude_id is null or id != p_exclude_id)
    and (
      (p_start_time >= clock_in_at and p_start_time < coalesce(clock_out_at, now()))
      or
      (p_end_time > clock_in_at and p_end_time <= coalesce(clock_out_at, now()))
      or
      (p_start_time <= clock_in_at and p_end_time >= coalesce(clock_out_at, now()))
    );
  
  return overlap_count > 0;
end;
$$;

-- ==============================================
-- 7. TRIGGERS
-- ==============================================

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

-- ==============================================
-- 8. ROW LEVEL SECURITY
-- ==============================================

alter table public.time_entries enable row level security;
alter table public.overtime_balances enable row level security;
alter table public.overtime_rules enable row level security;
alter table public.overtime_requests enable row level security;
alter table public.time_entry_audit enable row level security;

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

-- ==============================================
-- 9. INITIAL DATA SETUP
-- ==============================================

insert into public.overtime_rules (tenant_id, name, is_default)
select 
  t.id as tenant_id,
  'Default Overtime Rules' as name,
  true as is_default
from public.tenants t
where not exists (
  select 1 from public.overtime_rules otr where otr.tenant_id = t.id and otr.is_default = true
);

-- ==============================================
-- 10. HELPER VIEWS
-- ==============================================

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

