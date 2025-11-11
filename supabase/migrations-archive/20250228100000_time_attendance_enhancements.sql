-- Time & Attendance Module - Phase 1 MVP Enhancement
-- This migration extends the existing time tracking system with manual entry, break management, overtime tracking, and manager approvals

-- ==============================================
-- 1. EXTEND TIME_ENTRIES TABLE
-- ==============================================

-- Add new columns to time_entries table
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS break_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS project_task TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'clock' CHECK (entry_type IN ('clock', 'manual')),
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved', 'pending', 'rejected')),
  ADD COLUMN IF NOT EXISTS approver_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add constraint for break validation
ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_break_validation CHECK (break_minutes >= 0 AND break_minutes <= 1440); -- Max 24 hours

-- Add constraint for notes length
ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_notes_length CHECK (notes IS NULL OR LENGTH(notes) <= 500);

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS time_entries_approval_status_idx ON public.time_entries (tenant_id, approval_status);
CREATE INDEX IF NOT EXISTS time_entries_entry_type_idx ON public.time_entries (tenant_id, entry_type);
CREATE INDEX IF NOT EXISTS time_entries_updated_at_idx ON public.time_entries (tenant_id, updated_at DESC);

-- ==============================================
-- 2. OVERTIME BALANCES TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.overtime_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- e.g., '2025-W10' for week, '2025-02' for month
  regular_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  overtime_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.5,
  carry_over_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, period)
);

-- Add indexes for overtime_balances
CREATE INDEX IF NOT EXISTS overtime_balances_tenant_user_idx ON public.overtime_balances (tenant_id, user_id, period DESC);
CREATE INDEX IF NOT EXISTS overtime_balances_period_idx ON public.overtime_balances (tenant_id, period DESC);

-- ==============================================
-- 3. OVERTIME RULES TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.overtime_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  daily_threshold NUMERIC(4,2) NOT NULL DEFAULT 8.0,
  weekly_threshold NUMERIC(5,2) NOT NULL DEFAULT 40.0,
  daily_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.5,
  weekly_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.5,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for overtime_rules
CREATE INDEX IF NOT EXISTS overtime_rules_tenant_idx ON public.overtime_rules (tenant_id);
CREATE INDEX IF NOT EXISTS overtime_rules_default_idx ON public.overtime_rules (tenant_id, is_default) WHERE is_default = true;

-- ==============================================
-- 4. TIME ENTRY AUDIT TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.time_entry_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for time_entry_audit
CREATE INDEX IF NOT EXISTS time_entry_audit_time_entry_idx ON public.time_entry_audit (time_entry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS time_entry_audit_changed_by_idx ON public.time_entry_audit (changed_by, created_at DESC);

-- ==============================================
-- 5. NEW PERMISSIONS
-- ==============================================

-- Add new permissions for time management features
INSERT INTO public.permissions (key) VALUES
  ('time.approve'),
  ('time.edit_past'),
  ('time.view_team'),
  ('overtime.view'),
  ('overtime.approve')
ON CONFLICT (key) DO NOTHING;

-- ==============================================
-- 6. ROLE PERMISSIONS
-- ==============================================

-- Grant permissions to roles
INSERT INTO public.role_permissions (role, permission_key) VALUES
  -- Owner gets all permissions
  ('owner', 'time.approve'),
  ('owner', 'time.edit_past'),
  ('owner', 'time.view_team'),
  ('owner', 'overtime.view'),
  ('owner', 'overtime.approve'),
  
  -- Admin gets all permissions
  ('admin', 'time.approve'),
  ('admin', 'time.edit_past'),
  ('admin', 'time.view_team'),
  ('admin', 'overtime.view'),
  ('admin', 'overtime.approve'),
  
  -- People Ops gets most permissions
  ('people_ops', 'time.approve'),
  ('people_ops', 'time.edit_past'),
  ('people_ops', 'time.view_team'),
  ('people_ops', 'overtime.view'),
  ('people_ops', 'overtime.approve'),
  
  -- Manager gets limited permissions
  ('manager', 'time.approve'),
  ('manager', 'time.view_team'),
  ('manager', 'overtime.view'),
  
  -- Employee gets basic permissions
  ('employee', 'overtime.view')
ON CONFLICT (role, permission_key) DO NOTHING;

-- ==============================================
-- 7. ROW LEVEL SECURITY POLICIES
-- ==============================================

-- Enable RLS on new tables
ALTER TABLE public.overtime_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entry_audit ENABLE ROW LEVEL SECURITY;

-- Overtime balances policies
CREATE POLICY overtime_balances_read ON public.overtime_balances
  FOR SELECT TO authenticated
  USING (
    public.app_has_permission('overtime.view', tenant_id) AND
    (user_id = auth.uid() OR public.app_has_permission('time.view_team', tenant_id))
  );

CREATE POLICY overtime_balances_manage ON public.overtime_balances
  FOR ALL TO authenticated
  USING (public.app_has_permission('overtime.approve', tenant_id))
  WITH CHECK (public.app_has_permission('overtime.approve', tenant_id));

-- Overtime rules policies
CREATE POLICY overtime_rules_read ON public.overtime_rules
  FOR SELECT TO authenticated
  USING (public.app_has_permission('overtime.view', tenant_id));

CREATE POLICY overtime_rules_manage ON public.overtime_rules
  FOR ALL TO authenticated
  USING (public.app_has_permission('overtime.approve', tenant_id))
  WITH CHECK (public.app_has_permission('overtime.approve', tenant_id));

-- Time entry audit policies
CREATE POLICY time_entry_audit_read ON public.time_entry_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.time_entries te 
      WHERE te.id = time_entry_audit.time_entry_id 
      AND public.app_has_permission('time.view_team', te.tenant_id)
    )
  );

-- Update existing time_entries policies to include new columns
-- (The existing policies should already cover the new columns)

-- ==============================================
-- 8. TRIGGERS AND FUNCTIONS
-- ==============================================

-- Add updated_at trigger for time_entries
CREATE TRIGGER set_updated_at_on_time_entries
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Add updated_at triggers for new tables
CREATE TRIGGER set_updated_at_on_overtime_balances
  BEFORE UPDATE ON public.overtime_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_on_overtime_rules
  BEFORE UPDATE ON public.overtime_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Function to check if time entry requires approval
CREATE OR REPLACE FUNCTION public.requires_time_entry_approval(
  entry_date DATE,
  entry_type TEXT,
  user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Manual entries for past dates require approval
  IF entry_type = 'manual' AND entry_date < CURRENT_DATE THEN
    RETURN true;
  END IF;
  
  -- Future: Add more complex rules here
  RETURN false;
END;
$$;

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION public.create_time_entry_audit(
  p_time_entry_id UUID,
  p_changed_by UUID,
  p_field_name TEXT,
  p_old_value JSONB,
  p_new_value JSONB,
  p_change_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  audit_id UUID;
BEGIN
  INSERT INTO public.time_entry_audit (
    time_entry_id,
    changed_by,
    field_name,
    old_value,
    new_value,
    change_reason
  ) VALUES (
    p_time_entry_id,
    p_changed_by,
    p_field_name,
    p_old_value,
    p_new_value,
    p_change_reason
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$;

-- Function to check for overlapping time entries
CREATE OR REPLACE FUNCTION public.check_time_entry_overlap(
  p_user_id UUID,
  p_tenant_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  overlap_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO overlap_count
  FROM public.time_entries
  WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id
    AND approval_status != 'rejected'
    AND (p_exclude_id IS NULL OR id != p_exclude_id)
    AND (
      -- New entry starts during existing entry
      (p_start_time >= clock_in_at AND p_start_time < COALESCE(clock_out_at, NOW()))
      OR
      -- New entry ends during existing entry
      (p_end_time > clock_in_at AND p_end_time <= COALESCE(clock_out_at, NOW()))
      OR
      -- New entry completely contains existing entry
      (p_start_time <= clock_in_at AND p_end_time >= COALESCE(clock_out_at, NOW()))
    );
  
  RETURN overlap_count > 0;
END;
$$;

-- ==============================================
-- 9. INITIAL DATA SETUP
-- ==============================================

-- Create default overtime rules for existing tenants
INSERT INTO public.overtime_rules (tenant_id, name, is_default)
SELECT 
  t.id as tenant_id,
  'Default Overtime Rules' as name,
  true as is_default
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.overtime_rules otr WHERE otr.tenant_id = t.id AND otr.is_default = true
);

-- ==============================================
-- 10. HELPER VIEWS
-- ==============================================

-- View for time entry summary with employee info
CREATE OR REPLACE VIEW public.time_entry_summary AS
SELECT 
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
  -- Calculate net hours (duration minus breaks)
  CASE 
    WHEN te.duration_minutes IS NOT NULL THEN 
      GREATEST(0, te.duration_minutes - COALESCE(te.break_minutes, 0))
    ELSE NULL
  END as net_minutes
FROM public.time_entries te
LEFT JOIN public.employees e ON te.user_id = e.user_id AND te.tenant_id = e.tenant_id
LEFT JOIN public.employees approver ON te.approver_user_id = approver.user_id AND te.tenant_id = approver.tenant_id
LEFT JOIN public.employees editor ON te.edited_by = editor.user_id AND te.tenant_id = editor.tenant_id;

-- View for pending approvals
CREATE OR REPLACE VIEW public.pending_time_approvals AS
SELECT 
  tes.*,
  e.manager_id,
  m.name as manager_name,
  m.email as manager_email
FROM public.time_entry_summary tes
LEFT JOIN public.employees e ON tes.user_id = e.user_id AND tes.tenant_id = e.tenant_id
LEFT JOIN public.employees m ON e.manager_id = m.id
WHERE tes.approval_status = 'pending'
ORDER BY tes.created_at DESC;
