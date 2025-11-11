-- Leave & Absence Management - Phase 1 MVP
-- This migration enhances the basic time-off system with comprehensive leave management

-- ==============================================
-- 1. LEAVE TYPES TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  requires_certificate BOOLEAN NOT NULL DEFAULT false,
  allow_negative_balance BOOLEAN NOT NULL DEFAULT false,
  max_balance NUMERIC(5,2) DEFAULT NULL, -- NULL means unlimited
  color TEXT DEFAULT '#3B82F6', -- Hex color for UI
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

-- Add indexes for leave_types
CREATE INDEX IF NOT EXISTS leave_types_tenant_idx ON public.leave_types (tenant_id);
CREATE INDEX IF NOT EXISTS leave_types_active_idx ON public.leave_types (tenant_id, is_active) WHERE is_active = true;

-- ==============================================
-- 2. LEAVE BALANCES TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  balance_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  used_ytd NUMERIC(5,2) NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, employee_id, leave_type_id, period_start)
);

-- Add indexes for leave_balances
CREATE INDEX IF NOT EXISTS leave_balances_employee_idx ON public.leave_balances (tenant_id, employee_id, period_start DESC);
CREATE INDEX IF NOT EXISTS leave_balances_leave_type_idx ON public.leave_balances (tenant_id, leave_type_id);
CREATE INDEX IF NOT EXISTS leave_balances_period_idx ON public.leave_balances (tenant_id, period_start, period_end);

-- ==============================================
-- 3. HOLIDAY CALENDARS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.holiday_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  is_half_day BOOLEAN NOT NULL DEFAULT false,
  country TEXT,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, date, name)
);

-- Add indexes for holiday_calendars
CREATE INDEX IF NOT EXISTS holiday_calendars_tenant_date_idx ON public.holiday_calendars (tenant_id, date);
CREATE INDEX IF NOT EXISTS holiday_calendars_tenant_year_idx ON public.holiday_calendars (tenant_id, EXTRACT(YEAR FROM date));

-- ==============================================
-- 4. LEAVE REQUEST AUDIT TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.leave_request_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES public.time_off_requests(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'approved', 'denied', 'cancelled', 'modified')),
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for leave_request_audit
CREATE INDEX IF NOT EXISTS leave_request_audit_tenant_idx ON public.leave_request_audit (tenant_id);
CREATE INDEX IF NOT EXISTS leave_request_audit_request_idx ON public.leave_request_audit (request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leave_request_audit_changed_by_idx ON public.leave_request_audit (changed_by, created_at DESC);

-- ==============================================
-- 5. ENHANCE TIME_OFF_REQUESTS TABLE
-- ==============================================

-- Add new columns to time_off_requests
ALTER TABLE public.time_off_requests
  ADD COLUMN IF NOT EXISTS days_count NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS half_day_start BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS half_day_end BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS denial_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS leave_type_id UUID REFERENCES public.leave_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS time_off_requests_leave_type_idx ON public.time_off_requests (tenant_id, leave_type_id);
CREATE INDEX IF NOT EXISTS time_off_requests_days_count_idx ON public.time_off_requests (tenant_id, days_count);
CREATE INDEX IF NOT EXISTS time_off_requests_updated_at_idx ON public.time_off_requests (tenant_id, updated_at DESC);

-- ==============================================
-- 6. NEW PERMISSIONS
-- ==============================================

-- Add new permissions for leave management
INSERT INTO public.permissions (key) VALUES
  ('leave.manage_types'),
  ('leave.manage_balances'),
  ('leave.manage_holidays'),
  ('leave.view_team_calendar'),
  ('leave.approve_requests')
ON CONFLICT (key) DO NOTHING;

-- ==============================================
-- 7. ROLE PERMISSIONS
-- ==============================================

-- Grant permissions to roles
INSERT INTO public.role_permissions (role, permission_key) VALUES
  -- Owner gets all permissions
  ('owner', 'leave.manage_types'),
  ('owner', 'leave.manage_balances'),
  ('owner', 'leave.manage_holidays'),
  ('owner', 'leave.view_team_calendar'),
  ('owner', 'leave.approve_requests'),
  
  -- Admin gets all permissions
  ('admin', 'leave.manage_types'),
  ('admin', 'leave.manage_balances'),
  ('admin', 'leave.manage_holidays'),
  ('admin', 'leave.view_team_calendar'),
  ('admin', 'leave.approve_requests'),
  
  -- People Ops gets most permissions
  ('people_ops', 'leave.manage_types'),
  ('people_ops', 'leave.manage_balances'),
  ('people_ops', 'leave.manage_holidays'),
  ('people_ops', 'leave.view_team_calendar'),
  ('people_ops', 'leave.approve_requests'),
  
  -- Manager gets limited permissions
  ('manager', 'leave.view_team_calendar'),
  ('manager', 'leave.approve_requests')
ON CONFLICT (role, permission_key) DO NOTHING;

-- ==============================================
-- 8. ROW LEVEL SECURITY POLICIES
-- ==============================================

-- Enable RLS on new tables
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_request_audit ENABLE ROW LEVEL SECURITY;

-- Leave types policies
CREATE POLICY leave_types_read ON public.leave_types
  FOR SELECT TO authenticated
  USING (public.app_has_permission('time.read', tenant_id));

CREATE POLICY leave_types_manage ON public.leave_types
  FOR ALL TO authenticated
  USING (public.app_has_permission('leave.manage_types', tenant_id))
  WITH CHECK (public.app_has_permission('leave.manage_types', tenant_id));

-- Leave balances policies
CREATE POLICY leave_balances_read_own ON public.leave_balances
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e 
      WHERE e.id = leave_balances.employee_id 
      AND e.user_id = auth.uid()
      AND e.tenant_id = leave_balances.tenant_id
    )
  );

CREATE POLICY leave_balances_read_team ON public.leave_balances
  FOR SELECT TO authenticated
  USING (
    public.app_has_permission('leave.view_team_calendar', tenant_id) AND
    EXISTS (
      SELECT 1 FROM public.employees e 
      WHERE e.id = leave_balances.employee_id 
      AND (
        e.manager_id IN (
          SELECT id FROM public.employees WHERE user_id = auth.uid()
        )
        OR e.user_id = auth.uid()
      )
      AND e.tenant_id = leave_balances.tenant_id
    )
  );

CREATE POLICY leave_balances_manage ON public.leave_balances
  FOR ALL TO authenticated
  USING (public.app_has_permission('leave.manage_balances', tenant_id))
  WITH CHECK (public.app_has_permission('leave.manage_balances', tenant_id));

-- Holiday calendars policies
CREATE POLICY holiday_calendars_read ON public.holiday_calendars
  FOR SELECT TO authenticated
  USING (public.app_has_permission('time.read', tenant_id));

CREATE POLICY holiday_calendars_manage ON public.holiday_calendars
  FOR ALL TO authenticated
  USING (public.app_has_permission('leave.manage_holidays', tenant_id))
  WITH CHECK (public.app_has_permission('leave.manage_holidays', tenant_id));

-- Leave request audit policies
CREATE POLICY leave_request_audit_read ON public.leave_request_audit
  FOR SELECT TO authenticated
  USING (
    public.app_has_permission('leave.approve_requests', tenant_id) OR
    EXISTS (
      SELECT 1 FROM public.time_off_requests tor
      JOIN public.employees e ON tor.user_id = e.user_id
      WHERE tor.id = leave_request_audit.request_id
      AND e.user_id = auth.uid()
      AND e.tenant_id = tor.tenant_id
    )
  );

-- ==============================================
-- 9. FUNCTIONS AND TRIGGERS
-- ==============================================

-- Function to calculate working days (excluding weekends and holidays)
CREATE OR REPLACE FUNCTION public.calculate_working_days(
  p_start_date DATE,
  p_end_date DATE,
  p_tenant_id UUID
)
RETURNS NUMERIC(5,2)
LANGUAGE plpgsql
AS $$
DECLARE
  current_day DATE;
  working_days NUMERIC(5,2) := 0;
  is_holiday BOOLEAN;
  is_weekend BOOLEAN;
BEGIN
  -- Validate input
  IF p_start_date > p_end_date THEN
    RETURN 0;
  END IF;
  
  current_day := p_start_date;
  
  WHILE current_day <= p_end_date LOOP
    -- Check if it's a weekend (Saturday = 6, Sunday = 0)
    is_weekend := EXTRACT(DOW FROM current_day) IN (0, 6);
    
    -- Check if it's a holiday
    SELECT EXISTS (
      SELECT 1 FROM public.holiday_calendars hc
      WHERE hc.tenant_id = p_tenant_id
      AND hc.date = current_day
    ) INTO is_holiday;
    
    -- Count as working day if not weekend and not holiday
    IF NOT is_weekend AND NOT is_holiday THEN
      working_days := working_days + 1;
    END IF;
    
    current_day := current_day + INTERVAL '1 day';
  END LOOP;
  
  RETURN working_days;
END;
$$;

-- Function to check leave balance
CREATE OR REPLACE FUNCTION public.check_leave_balance(
  p_employee_id UUID,
  p_leave_type_id UUID,
  p_days_requested NUMERIC(5,2)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_balance NUMERIC(5,2);
  allow_negative BOOLEAN;
BEGIN
  -- Get current balance for the employee and leave type
  SELECT lb.balance_days, lt.allow_negative_balance
  INTO current_balance, allow_negative
  FROM public.leave_balances lb
  JOIN public.leave_types lt ON lb.leave_type_id = lt.id
  WHERE lb.employee_id = p_employee_id
  AND lb.leave_type_id = p_leave_type_id
  AND lb.period_start <= CURRENT_DATE
  AND lb.period_end >= CURRENT_DATE
  ORDER BY lb.period_start DESC
  LIMIT 1;
  
  -- If no balance record found, return false
  IF current_balance IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if request is within balance or negative is allowed
  RETURN (current_balance >= p_days_requested) OR allow_negative;
END;
$$;

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION public.create_leave_request_audit(
  p_request_id UUID,
  p_changed_by UUID,
  p_action TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  audit_id UUID;
BEGIN
  INSERT INTO public.leave_request_audit (
    request_id,
    changed_by,
    action,
    old_values,
    new_values,
    reason,
    ip_address
  ) VALUES (
    p_request_id,
    p_changed_by,
    p_action,
    p_old_values,
    p_new_values,
    p_reason,
    p_ip_address
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$;

-- Trigger function for leave request changes
CREATE OR REPLACE FUNCTION public.audit_leave_request_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  action_type TEXT;
  old_values JSONB;
  new_values JSONB;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_type := 'created';
    old_values := NULL;
    new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    action_type := 'modified';
    old_values := to_jsonb(OLD);
    new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    action_type := 'cancelled';
    old_values := to_jsonb(OLD);
    new_values := NULL;
  END IF;
  
  -- Create audit entry
  PERFORM public.create_leave_request_audit(
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.approver_user_id, OLD.approver_user_id, auth.uid()),
    action_type,
    old_values,
    new_values,
    COALESCE(NEW.denial_reason, OLD.denial_reason),
    NULL -- IP address would need to be passed from application
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers
CREATE TRIGGER audit_leave_request_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.time_off_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_leave_request_changes();

-- Add updated_at triggers
CREATE TRIGGER set_updated_at_on_leave_types
  BEFORE UPDATE ON public.leave_types
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_on_leave_balances
  BEFORE UPDATE ON public.leave_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_on_time_off_requests
  BEFORE UPDATE ON public.time_off_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ==============================================
-- 10. MIGRATE EXISTING DATA
-- ==============================================

-- Create default leave types for existing tenants
INSERT INTO public.leave_types (tenant_id, name, code, requires_approval, requires_certificate, allow_negative_balance, color)
SELECT 
  t.id as tenant_id,
  'Vacation' as name,
  'VACATION' as code,
  true as requires_approval,
  false as requires_certificate,
  false as allow_negative_balance,
  '#3B82F6' as color
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.leave_types lt WHERE lt.tenant_id = t.id AND lt.code = 'VACATION'
);

INSERT INTO public.leave_types (tenant_id, name, code, requires_approval, requires_certificate, allow_negative_balance, color)
SELECT 
  t.id as tenant_id,
  'Sick Leave' as name,
  'SICK' as code,
  false as requires_approval,
  true as requires_certificate,
  true as allow_negative_balance,
  '#EF4444' as color
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.leave_types lt WHERE lt.tenant_id = t.id AND lt.code = 'SICK'
);

INSERT INTO public.leave_types (tenant_id, name, code, requires_approval, requires_certificate, allow_negative_balance, color)
SELECT 
  t.id as tenant_id,
  'Personal Leave' as name,
  'PERSONAL' as code,
  true as requires_approval,
  false as requires_certificate,
  false as allow_negative_balance,
  '#10B981' as color
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.leave_types lt WHERE lt.tenant_id = t.id AND lt.code = 'PERSONAL'
);

-- Migrate existing time_off_requests to use leave_type_id
UPDATE public.time_off_requests
SET leave_type_id = (
  SELECT lt.id 
  FROM public.leave_types lt 
  WHERE lt.tenant_id = time_off_requests.tenant_id 
  AND (
    (time_off_requests.leave_type = 'vacation' AND lt.code = 'VACATION') OR
    (time_off_requests.leave_type = 'sick' AND lt.code = 'SICK') OR
    (time_off_requests.leave_type = 'personal' AND lt.code = 'PERSONAL') OR
    (time_off_requests.leave_type = 'unpaid' AND lt.code = 'PERSONAL') OR
    (time_off_requests.leave_type = 'other' AND lt.code = 'PERSONAL')
  )
  LIMIT 1
)
WHERE leave_type_id IS NULL;

-- Calculate days_count for existing requests
UPDATE public.time_off_requests
SET days_count = public.calculate_working_days(start_date, end_date, tenant_id)
WHERE days_count IS NULL;

-- ==============================================
-- 11. HELPER VIEWS
-- ==============================================

-- View for leave request summary with employee and leave type info
CREATE OR REPLACE VIEW public.leave_request_summary AS
SELECT 
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
FROM public.time_off_requests tor
LEFT JOIN public.employees e ON tor.user_id = e.user_id AND tor.tenant_id = e.tenant_id
LEFT JOIN public.leave_types lt ON tor.leave_type_id = lt.id
LEFT JOIN public.employees approver ON tor.approver_user_id = approver.user_id AND tor.tenant_id = approver.tenant_id
LEFT JOIN public.employees canceller ON tor.cancelled_by = canceller.user_id AND tor.tenant_id = canceller.tenant_id;

-- View for team leave calendar
CREATE OR REPLACE VIEW public.team_leave_calendar AS
SELECT 
  lrs.*,
  e.manager_id,
  m.name as manager_name,
  m.email as manager_email
FROM public.leave_request_summary lrs
LEFT JOIN public.employees e ON lrs.user_id = e.user_id AND lrs.tenant_id = e.tenant_id
LEFT JOIN public.employees m ON e.manager_id = m.id
WHERE lrs.status IN ('pending', 'approved');

-- View for leave balance summary
CREATE OR REPLACE VIEW public.leave_balance_summary AS
SELECT 
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
FROM public.leave_balances lb
LEFT JOIN public.employees e ON lb.employee_id = e.id
LEFT JOIN public.leave_types lt ON lb.leave_type_id = lt.id
WHERE lb.period_start <= CURRENT_DATE AND lb.period_end >= CURRENT_DATE;
