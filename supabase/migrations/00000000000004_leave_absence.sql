-- Leave & Absence Migration
-- This migration creates leave management, compliance, and analytics tables
-- Includes: leave_types, leave_balances, holiday_calendars, blackout_periods, time_off_requests (enhanced), analytics views

-- ==============================================
-- 1. LEAVE TYPES TABLE (with minimum entitlement)
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

-- ==============================================
-- 2. LEAVE BALANCES TABLE
-- ==============================================

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

-- ==============================================
-- 3. HOLIDAY CALENDARS TABLE
-- ==============================================

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

-- ==============================================
-- 4. BLACKOUT PERIODS TABLE
-- ==============================================

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

-- ==============================================
-- 5. TIME OFF REQUESTS TABLE (with all enhancements)
-- ==============================================

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

-- ==============================================
-- 6. LEAVE REQUEST AUDIT TABLE
-- ==============================================

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
-- 7. FUNCTIONS
-- ==============================================

create or replace function public.calculate_working_days(
  p_start_date date,
  p_end_date date,
  p_tenant_id uuid
)
returns numeric(5,2)
language plpgsql
as $$
declare
  current_day date;
  working_days numeric(5,2) := 0;
  is_holiday boolean;
  is_weekend boolean;
begin
  if p_start_date > p_end_date then
    return 0;
  end if;
  
  current_day := p_start_date;
  
  while current_day <= p_end_date loop
    is_weekend := extract(dow from current_day) in (0, 6);
    
    select exists (
      select 1 from public.holiday_calendars hc
      where hc.tenant_id = p_tenant_id
      and hc.date = current_day
    ) into is_holiday;
    
    if not is_weekend and not is_holiday then
      working_days := working_days + 1;
    end if;
    
    current_day := current_day + interval '1 day';
  end loop;
  
  return working_days;
end;
$$;

create or replace function public.check_leave_balance(
  p_employee_id uuid,
  p_leave_type_id uuid,
  p_days_requested numeric(5,2),
  p_check_minimum_entitlement boolean default false
)
returns jsonb
language plpgsql
as $$
declare
  current_balance numeric(5,2);
  allow_negative boolean;
  minimum_entitlement numeric(5,2);
  enforce_minimum boolean;
  used_ytd numeric(5,2);
  period_end date;
begin
  select 
    lb.balance_days,
    lb.used_ytd,
    lb.period_end,
    lt.allow_negative_balance,
    lt.minimum_entitlement_days,
    lt.enforce_minimum_entitlement
  into current_balance, used_ytd, period_end, allow_negative, minimum_entitlement, enforce_minimum
  from public.leave_balances lb
  join public.leave_types lt on lb.leave_type_id = lt.id
  where lb.employee_id = p_employee_id
  and lb.leave_type_id = p_leave_type_id
  and lb.period_start <= current_date
  and lb.period_end >= current_date
  order by lb.period_start desc
  limit 1;
  
  if current_balance is null then
    return jsonb_build_object(
      'valid', false,
      'error_code', 'NO_BALANCE_RECORD',
      'message', 'No leave balance record found for this leave type'
    );
  end if;
  
  if current_balance < p_days_requested and not allow_negative then
    return jsonb_build_object(
      'valid', false,
      'error_code', 'INSUFFICIENT_BALANCE',
      'message', format('Insufficient leave balance. Available: %s days, Requested: %s days', current_balance, p_days_requested),
      'available_balance', current_balance,
      'requested_days', p_days_requested
    );
  end if;
  
  if p_check_minimum_entitlement and enforce_minimum and minimum_entitlement is not null then
    declare
      balance_after_request numeric(5,2);
      days_remaining_at_period_end numeric(5,2);
    begin
      balance_after_request := current_balance - p_days_requested;
      days_remaining_at_period_end := balance_after_request;
      
      if days_remaining_at_period_end > minimum_entitlement then
        return jsonb_build_object(
          'valid', false,
          'error_code', 'MINIMUM_ENTITLEMENT_VIOLATION',
          'message', format(
            'This request would leave %s days unused, but minimum entitlement is %s days. Please use at least %s days before the period ends.',
            days_remaining_at_period_end,
            minimum_entitlement,
            (current_balance - minimum_entitlement)
          ),
          'minimum_entitlement', minimum_entitlement,
          'would_remain', days_remaining_at_period_end
        );
      end if;
    end;
  end if;
  
  return jsonb_build_object(
    'valid', true,
    'current_balance', current_balance,
    'available_balance', current_balance,
    'used_ytd', used_ytd,
    'period_end', period_end
  );
end;
$$;

create or replace function public.check_blackout_periods(
  p_tenant_id uuid,
  p_start_date date,
  p_end_date date,
  p_leave_type_id uuid default null,
  p_department_id uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  conflicting_period record;
begin
  select 
    bp.id,
    bp.name,
    bp.start_date,
    bp.end_date,
    bp.reason
  into conflicting_period
  from public.blackout_periods bp
  where bp.tenant_id = p_tenant_id
  and (p_start_date <= bp.end_date and p_end_date >= bp.start_date)
  and (bp.leave_type_id is null or bp.leave_type_id = p_leave_type_id)
  and (bp.department_id is null or bp.department_id = p_department_id)
  order by bp.start_date
  limit 1;
  
  if conflicting_period is not null then
    return jsonb_build_object(
      'has_conflict', true,
      'blackout_period', jsonb_build_object(
        'id', conflicting_period.id,
        'name', conflicting_period.name,
        'start_date', conflicting_period.start_date,
        'end_date', conflicting_period.end_date,
        'reason', conflicting_period.reason
      ),
      'message', format(
        'Leave request conflicts with blackout period: %s (%s to %s)',
        conflicting_period.name,
        conflicting_period.start_date,
        conflicting_period.end_date
      )
    );
  end if;
  
  return jsonb_build_object('has_conflict', false);
end;
$$;

create or replace function public.validate_leave_request_compliance(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_days_requested numeric(5,2),
  p_department_id uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  balance_check jsonb;
  blackout_check jsonb;
  leave_type_record record;
begin
  select 
    enforce_minimum_entitlement,
    minimum_entitlement_days
  into leave_type_record
  from public.leave_types
  where id = p_leave_type_id
  and tenant_id = p_tenant_id;
  
  if leave_type_record is null then
    return jsonb_build_object(
      'valid', false,
      'error_code', 'INVALID_LEAVE_TYPE',
      'message', 'Leave type not found'
    );
  end if;
  
  balance_check := public.check_leave_balance(
    p_employee_id,
    p_leave_type_id,
    p_days_requested,
    leave_type_record.enforce_minimum_entitlement
  );
  
  if (balance_check->>'valid')::boolean = false then
    return balance_check;
  end if;
  
  blackout_check := public.check_blackout_periods(
    p_tenant_id,
    p_start_date,
    p_end_date,
    p_leave_type_id,
    p_department_id
  );
  
  if (blackout_check->>'has_conflict')::boolean = true then
    return jsonb_build_object(
      'valid', false,
      'error_code', 'BLACKOUT_PERIOD_CONFLICT',
      'message', blackout_check->>'message',
      'blackout_period', blackout_check->'blackout_period'
    );
  end if;
  
  return jsonb_build_object(
    'valid', true,
    'balance_check', balance_check,
    'blackout_check', blackout_check
  );
end;
$$;

create or replace function public.check_unused_leave_alert(
  p_tenant_id uuid default null,
  p_days_before_period_end integer default 30
)
returns table (
  employee_id uuid,
  employee_name text,
  employee_email text,
  leave_type_id uuid,
  leave_type_name text,
  current_balance numeric(5,2),
  minimum_entitlement numeric(5,2),
  period_end date,
  days_until_period_end integer,
  days_to_use numeric(5,2)
)
language plpgsql
as $$
begin
  return query
  select 
    e.id as employee_id,
    e.name as employee_name,
    e.email as employee_email,
    lt.id as leave_type_id,
    lt.name as leave_type_name,
    lb.balance_days as current_balance,
    lt.minimum_entitlement_days as minimum_entitlement,
    lb.period_end as period_end,
    (lb.period_end - current_date)::integer as days_until_period_end,
    (lb.balance_days - coalesce(lt.minimum_entitlement_days, 0)) as days_to_use
  from public.leave_balances lb
  join public.employees e on lb.employee_id = e.id
  join public.leave_types lt on lb.leave_type_id = lt.id
  where (p_tenant_id is null or lb.tenant_id = p_tenant_id)
  and lb.period_start <= current_date
  and lb.period_end >= current_date
  and lt.enforce_minimum_entitlement = true
  and lt.minimum_entitlement_days is not null
  and lt.minimum_entitlement_days > 0
  and lb.balance_days > lt.minimum_entitlement_days
  and (lb.period_end - current_date) <= p_days_before_period_end
  and (lb.period_end - current_date) > 0
  order by lb.period_end asc, e.name;
end;
$$;

comment on function public.check_unused_leave_alert is 'Identifies employees who should be alerted about unused leave approaching period end. Returns employees with balance exceeding minimum entitlement within specified days of period end. Should be called by a scheduled job (e.g., monthly).';

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
-- 8. TRIGGERS
-- ==============================================

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

-- ==============================================
-- 9. ROW LEVEL SECURITY
-- ==============================================

alter table public.leave_types enable row level security;
alter table public.leave_balances enable row level security;
alter table public.holiday_calendars enable row level security;
alter table public.blackout_periods enable row level security;
alter table public.time_off_requests enable row level security;
alter table public.leave_request_audit enable row level security;

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

-- Time off requests policies
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
using (public.app_has_permission('time_off.approve', tenant_id))
with check (public.app_has_permission('time_off.approve', tenant_id));

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

-- Allow the audit trigger function to insert records
-- The function uses SECURITY DEFINER, but RLS still applies to the INSERT
-- This policy allows authenticated users to insert audit records for their own requests
-- or if they have approval permissions
create policy leave_request_audit_insert on public.leave_request_audit
for insert to authenticated
with check (
  -- Allow if user has approval permission
  public.app_has_permission('leave.approve_requests', tenant_id)
  -- Or if the audit is for a request owned by the current user
  or exists (
    select 1 from public.time_off_requests tor
    join public.employees e on tor.user_id = e.user_id
    where tor.id = request_id
    and e.user_id = auth.uid()
    and e.tenant_id = tor.tenant_id
  )
);

-- ==============================================
-- 10. INITIAL DATA SETUP
-- ==============================================

insert into public.leave_types (tenant_id, name, code, requires_approval, requires_certificate, allow_negative_balance, color)
select 
  t.id as tenant_id,
  'Vacation' as name,
  'VACATION' as code,
  true as requires_approval,
  false as requires_certificate,
  false as allow_negative_balance,
  '#3B82F6' as color
from public.tenants t
where not exists (
  select 1 from public.leave_types lt where lt.tenant_id = t.id and lt.code = 'VACATION'
);

insert into public.leave_types (tenant_id, name, code, requires_approval, requires_certificate, allow_negative_balance, color)
select 
  t.id as tenant_id,
  'Sick Leave' as name,
  'SICK' as code,
  false as requires_approval,
  true as requires_certificate,
  true as allow_negative_balance,
  '#EF4444' as color
from public.tenants t
where not exists (
  select 1 from public.leave_types lt where lt.tenant_id = t.id and lt.code = 'SICK'
);

insert into public.leave_types (tenant_id, name, code, requires_approval, requires_certificate, allow_negative_balance, color)
select 
  t.id as tenant_id,
  'Personal Leave' as name,
  'PERSONAL' as code,
  true as requires_approval,
  false as requires_certificate,
  false as allow_negative_balance,
  '#10B981' as color
from public.tenants t
where not exists (
  select 1 from public.leave_types lt where lt.tenant_id = t.id and lt.code = 'PERSONAL'
);

-- ==============================================
-- 11. HELPER VIEWS
-- ==============================================

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

