-- Consolidated Functions Migration
-- This migration creates all PostgreSQL functions and trigger functions
-- Functions are separated from tables to allow proper dependency ordering

-- ==============================================
-- 1. CORE HELPER FUNCTIONS
-- ==============================================
-- Note: app_current_user_id(), set_updated_at(), and app_has_permission() 
-- are defined in migration 1 as they are needed by triggers and RLS policies

create or replace function public.app_create_tenant(p_name text)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public.app_current_user_id();
  v_tenant public.tenants;
  v_template_id uuid;
  v_workflow_id uuid;
  v_version_id uuid;
  v_slug text := 'standard-offboarding';
  v_slug_exists boolean;
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

  -- Create default offboarding workflow from template
  -- Look up the "Standard Offboarding" template
  select id into v_template_id
  from public.workflow_templates
  where name = 'Standard Offboarding'
    and kind = 'offboarding'
  limit 1;

  -- Only create workflow if template exists
  if v_template_id is not null then
    -- Check for slug uniqueness and adjust if needed
    select exists(
      select 1 from public.workflows
      where tenant_id = v_tenant.id
        and slug = v_slug
    ) into v_slug_exists;

    if v_slug_exists then
      -- Append a suffix if slug already exists
      v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
    end if;

    -- Create workflow
    insert into public.workflows (tenant_id, name, slug, kind, status, created_by, updated_by)
    values (
      v_tenant.id,
      'Standard Offboarding',
      v_slug,
      'offboarding',
      'published',
      v_user,
      v_user
    )
    returning id into v_workflow_id;

    -- Create workflow version from template
    insert into public.workflow_versions (
      workflow_id,
      version_number,
      is_active,
      definition,
      created_by,
      published_at
    )
    select
      v_workflow_id,
      1,
      true,
      blocks,
      v_user,
      now()
    from public.workflow_templates
    where id = v_template_id
    returning id into v_version_id;

    -- Update workflow with active version
    update public.workflows
    set active_version_id = v_version_id
    where id = v_workflow_id;
  end if;

  return v_tenant;
end;
$$;

grant execute on function public.app_create_tenant(text) to authenticated;

-- ==============================================
-- 2. EMPLOYEE HELPER FUNCTIONS
-- ==============================================
-- Note: calculate_profile_completion, generate_employee_number, 
-- employee_before_insert, and employee_before_update are defined in migration 1
-- as they are needed by triggers

-- ==============================================
-- 3. TIME & ATTENDANCE FUNCTIONS
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
-- 4. LEAVE & ABSENCE FUNCTIONS
-- ==============================================
-- Note: create_leave_request_audit and audit_leave_request_changes 
-- are defined in migration 1 as they are needed by triggers

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


-- ==============================================
-- 5. RECRUITING FUNCTIONS
-- ==============================================
-- Note: generate_job_id, job_before_insert, create_default_pipeline_stages,
-- and job_after_insert are defined in migration 1 as they are needed by triggers

