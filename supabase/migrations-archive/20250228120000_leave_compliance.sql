-- Leave & Absence Compliance Features
-- This migration adds blackout periods, minimum entitlement enforcement, and compliance validation

-- ==============================================
-- 1. BLACKOUT PERIODS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.blackout_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type_id UUID REFERENCES public.leave_types(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

-- Add indexes for blackout_periods
CREATE INDEX IF NOT EXISTS blackout_periods_tenant_idx ON public.blackout_periods (tenant_id);
CREATE INDEX IF NOT EXISTS blackout_periods_dates_idx ON public.blackout_periods (tenant_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS blackout_periods_leave_type_idx ON public.blackout_periods (tenant_id, leave_type_id) WHERE leave_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS blackout_periods_department_idx ON public.blackout_periods (tenant_id, department_id) WHERE department_id IS NOT NULL;

-- Add RLS policies for blackout_periods
ALTER TABLE public.blackout_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view blackout periods in their tenant"
  ON public.blackout_periods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
      AND m.tenant_id = blackout_periods.tenant_id
    )
  );

CREATE POLICY "Users with leave.manage_holidays permission can manage blackout periods"
  ON public.blackout_periods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      JOIN public.role_permissions rp ON rp.role = m.role
      WHERE m.user_id = auth.uid()
      AND m.tenant_id = blackout_periods.tenant_id
      AND rp.permission_key = 'leave.manage_holidays'
    )
  );

-- ==============================================
-- 2. ADD MINIMUM ENTITLEMENT COLUMNS TO LEAVE_TYPES
-- ==============================================

ALTER TABLE public.leave_types
  ADD COLUMN IF NOT EXISTS minimum_entitlement_days NUMERIC(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enforce_minimum_entitlement BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leave_types.minimum_entitlement_days IS 'Minimum number of days that must be taken (e.g., EU requirement of 20 days for annual leave)';
COMMENT ON COLUMN public.leave_types.enforce_minimum_entitlement IS 'Whether to enforce minimum entitlement check during leave requests';

-- ==============================================
-- 3. ENHANCE CHECK_LEAVE_BALANCE FUNCTION
-- ==============================================

CREATE OR REPLACE FUNCTION public.check_leave_balance(
  p_employee_id UUID,
  p_leave_type_id UUID,
  p_days_requested NUMERIC(5,2),
  p_check_minimum_entitlement BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  current_balance NUMERIC(5,2);
  allow_negative BOOLEAN;
  minimum_entitlement NUMERIC(5,2);
  enforce_minimum BOOLEAN;
  used_ytd NUMERIC(5,2);
  period_end DATE;
  result JSONB;
BEGIN
  -- Get current balance and leave type settings
  SELECT 
    lb.balance_days,
    lb.used_ytd,
    lb.period_end,
    lt.allow_negative_balance,
    lt.minimum_entitlement_days,
    lt.enforce_minimum_entitlement
  INTO current_balance, used_ytd, period_end, allow_negative, minimum_entitlement, enforce_minimum
  FROM public.leave_balances lb
  JOIN public.leave_types lt ON lb.leave_type_id = lt.id
  WHERE lb.employee_id = p_employee_id
  AND lb.leave_type_id = p_leave_type_id
  AND lb.period_start <= CURRENT_DATE
  AND lb.period_end >= CURRENT_DATE
  ORDER BY lb.period_start DESC
  LIMIT 1;
  
  -- If no balance record found, return error
  IF current_balance IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error_code', 'NO_BALANCE_RECORD',
      'message', 'No leave balance record found for this leave type'
    );
  END IF;
  
  -- Check if request exceeds balance (unless negative is allowed)
  IF current_balance < p_days_requested AND NOT allow_negative THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error_code', 'INSUFFICIENT_BALANCE',
      'message', format('Insufficient leave balance. Available: %s days, Requested: %s days', current_balance, p_days_requested),
      'available_balance', current_balance,
      'requested_days', p_days_requested
    );
  END IF;
  
  -- Check minimum entitlement if requested
  IF p_check_minimum_entitlement AND enforce_minimum AND minimum_entitlement IS NOT NULL THEN
    -- Calculate what the balance would be after this request
    DECLARE
      balance_after_request NUMERIC(5,2);
      days_remaining_at_period_end NUMERIC(5,2);
    BEGIN
      balance_after_request := current_balance - p_days_requested;
      days_remaining_at_period_end := balance_after_request;
      
      -- Check if remaining balance would violate minimum entitlement
      IF days_remaining_at_period_end > minimum_entitlement THEN
        RETURN jsonb_build_object(
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
      END IF;
    END;
  END IF;
  
  -- All checks passed
  RETURN jsonb_build_object(
    'valid', true,
    'current_balance', current_balance,
    'available_balance', current_balance,
    'used_ytd', used_ytd,
    'period_end', period_end
  );
END;
$$;

-- ==============================================
-- 4. CREATE CHECK_BLACKOUT_PERIODS FUNCTION
-- ==============================================

CREATE OR REPLACE FUNCTION public.check_blackout_periods(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_leave_type_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  conflicting_period RECORD;
  result JSONB;
BEGIN
  -- Check for overlapping blackout periods
  SELECT 
    bp.id,
    bp.name,
    bp.start_date,
    bp.end_date,
    bp.reason
  INTO conflicting_period
  FROM public.blackout_periods bp
  WHERE bp.tenant_id = p_tenant_id
  AND (
    -- Period overlaps with blackout: start_date <= blackout.end_date AND end_date >= blackout.start_date
    (p_start_date <= bp.end_date AND p_end_date >= bp.start_date)
  )
  AND (
    -- No leave type restriction OR matches leave type
    bp.leave_type_id IS NULL OR bp.leave_type_id = p_leave_type_id
  )
  AND (
    -- No department restriction OR matches department
    bp.department_id IS NULL OR bp.department_id = p_department_id
  )
  ORDER BY bp.start_date
  LIMIT 1;
  
  -- If conflict found, return error
  IF conflicting_period IS NOT NULL THEN
    RETURN jsonb_build_object(
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
  END IF;
  
  -- No conflict
  RETURN jsonb_build_object(
    'has_conflict', false
  );
END;
$$;

-- ==============================================
-- 5. CREATE VALIDATE_LEAVE_REQUEST_COMPLIANCE FUNCTION
-- ==============================================

CREATE OR REPLACE FUNCTION public.validate_leave_request_compliance(
  p_tenant_id UUID,
  p_employee_id UUID,
  p_leave_type_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_days_requested NUMERIC(5,2),
  p_department_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  balance_check JSONB;
  blackout_check JSONB;
  leave_type_record RECORD;
  final_result JSONB;
BEGIN
  -- Get leave type configuration
  SELECT 
    enforce_minimum_entitlement,
    minimum_entitlement_days
  INTO leave_type_record
  FROM public.leave_types
  WHERE id = p_leave_type_id
  AND tenant_id = p_tenant_id;
  
  IF leave_type_record IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error_code', 'INVALID_LEAVE_TYPE',
      'message', 'Leave type not found'
    );
  END IF;
  
  -- Check balance (with minimum entitlement check if enabled)
  balance_check := public.check_leave_balance(
    p_employee_id,
    p_leave_type_id,
    p_days_requested,
    leave_type_record.enforce_minimum_entitlement
  );
  
  IF (balance_check->>'valid')::boolean = false THEN
    RETURN balance_check;
  END IF;
  
  -- Check blackout periods
  blackout_check := public.check_blackout_periods(
    p_tenant_id,
    p_start_date,
    p_end_date,
    p_leave_type_id,
    p_department_id
  );
  
  IF (blackout_check->>'has_conflict')::boolean = true THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error_code', 'BLACKOUT_PERIOD_CONFLICT',
      'message', blackout_check->>'message',
      'blackout_period', blackout_check->'blackout_period'
    );
  END IF;
  
  -- All checks passed
  RETURN jsonb_build_object(
    'valid', true,
    'balance_check', balance_check,
    'blackout_check', blackout_check
  );
END;
$$;

-- ==============================================
-- 6. CREATE CHECK_UNUSED_LEAVE_ALERT FUNCTION
-- ==============================================

CREATE OR REPLACE FUNCTION public.check_unused_leave_alert(
  p_tenant_id UUID DEFAULT NULL,
  p_days_before_period_end INTEGER DEFAULT 30
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  employee_email TEXT,
  leave_type_id UUID,
  leave_type_name TEXT,
  current_balance NUMERIC(5,2),
  minimum_entitlement NUMERIC(5,2),
  period_end DATE,
  days_until_period_end INTEGER,
  days_to_use NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as employee_id,
    e.name as employee_name,
    e.email as employee_email,
    lt.id as leave_type_id,
    lt.name as leave_type_name,
    lb.balance_days as current_balance,
    lt.minimum_entitlement_days as minimum_entitlement,
    lb.period_end as period_end,
    (lb.period_end - CURRENT_DATE)::INTEGER as days_until_period_end,
    (lb.balance_days - COALESCE(lt.minimum_entitlement_days, 0)) as days_to_use
  FROM public.leave_balances lb
  JOIN public.employees e ON lb.employee_id = e.id
  JOIN public.leave_types lt ON lb.leave_type_id = lt.id
  WHERE (p_tenant_id IS NULL OR lb.tenant_id = p_tenant_id)
  AND lb.period_start <= CURRENT_DATE
  AND lb.period_end >= CURRENT_DATE
  AND lt.enforce_minimum_entitlement = true
  AND lt.minimum_entitlement_days IS NOT NULL
  AND lt.minimum_entitlement_days > 0
  AND lb.balance_days > lt.minimum_entitlement_days
  AND (lb.period_end - CURRENT_DATE) <= p_days_before_period_end
  AND (lb.period_end - CURRENT_DATE) > 0
  ORDER BY lb.period_end ASC, e.name;
END;
$$;

COMMENT ON FUNCTION public.check_unused_leave_alert IS 'Identifies employees who should be alerted about unused leave approaching period end. Returns employees with balance exceeding minimum entitlement within specified days of period end. Should be called by a scheduled job (e.g., monthly).';

-- ==============================================
-- 7. ADD TRIGGER FOR UPDATED_AT ON BLACKOUT_PERIODS
-- ==============================================

CREATE OR REPLACE FUNCTION public.update_blackout_periods_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_blackout_periods_updated_at
  BEFORE UPDATE ON public.blackout_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_blackout_periods_updated_at();

