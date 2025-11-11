-- Overtime Request Workflow
-- This migration adds a table for pre-authorization overtime requests

-- ==============================================
-- 1. OVERTIME REQUESTS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  estimated_hours NUMERIC(5,2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  approver_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  denial_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT overtime_requests_date_range_chk CHECK (start_date <= end_date),
  CONSTRAINT overtime_requests_hours_chk CHECK (estimated_hours > 0 AND estimated_hours <= 168) -- Max 168 hours (1 week)
);

-- Add indexes for overtime_requests
CREATE INDEX IF NOT EXISTS overtime_requests_tenant_user_idx ON public.overtime_requests (tenant_id, user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS overtime_requests_tenant_status_idx ON public.overtime_requests (tenant_id, status);
CREATE INDEX IF NOT EXISTS overtime_requests_approver_idx ON public.overtime_requests (tenant_id, approver_user_id) WHERE approver_user_id IS NOT NULL;

-- ==============================================
-- 2. ROW LEVEL SECURITY POLICIES
-- ==============================================

ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own overtime requests
CREATE POLICY overtime_requests_read_own ON public.overtime_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Managers can view their team's overtime requests
CREATE POLICY overtime_requests_read_team ON public.overtime_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = auth.uid()
      AND e.tenant_id = overtime_requests.tenant_id
      AND (
        public.app_has_permission('time.view_team', e.tenant_id)
        OR EXISTS (
          SELECT 1 FROM public.employees ee
          WHERE ee.manager_id = e.id
          AND ee.user_id = overtime_requests.user_id
          AND ee.tenant_id = overtime_requests.tenant_id
        )
      )
    )
  );

-- Users can create their own overtime requests
CREATE POLICY overtime_requests_create ON public.overtime_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
      AND m.tenant_id = overtime_requests.tenant_id
    )
  );

-- Approvers can update overtime requests
CREATE POLICY overtime_requests_update ON public.overtime_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = auth.uid()
      AND e.tenant_id = overtime_requests.tenant_id
      AND (
        public.app_has_permission('time.approve', e.tenant_id)
        OR EXISTS (
          SELECT 1 FROM public.employees ee
          WHERE ee.manager_id = e.id
          AND ee.user_id = overtime_requests.user_id
          AND ee.tenant_id = overtime_requests.tenant_id
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = auth.uid()
      AND e.tenant_id = overtime_requests.tenant_id
      AND (
        public.app_has_permission('time.approve', e.tenant_id)
        OR EXISTS (
          SELECT 1 FROM public.employees ee
          WHERE ee.manager_id = e.id
          AND ee.user_id = overtime_requests.user_id
          AND ee.tenant_id = overtime_requests.tenant_id
        )
      )
    )
  );

-- Users can cancel their own pending requests
CREATE POLICY overtime_requests_cancel ON public.overtime_requests
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'cancelled'
  );

-- ==============================================
-- 3. TRIGGERS
-- ==============================================

CREATE TRIGGER set_updated_at_on_overtime_requests
  BEFORE UPDATE ON public.overtime_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ==============================================
-- 4. HELPER VIEW
-- ==============================================

CREATE OR REPLACE VIEW public.overtime_requests_summary AS
SELECT 
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
FROM public.overtime_requests or_req
LEFT JOIN public.employees e ON or_req.user_id = e.user_id AND or_req.tenant_id = e.tenant_id
LEFT JOIN public.employees approver ON or_req.approver_user_id = approver.user_id AND or_req.tenant_id = approver.tenant_id;

