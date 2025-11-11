-- Office Locations Management
-- This migration adds tenant-configured office locations

-- ==============================================
-- 1. OFFICE LOCATIONS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.office_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address JSONB,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- Add indexes for office locations
CREATE INDEX IF NOT EXISTS office_locations_tenant_idx ON public.office_locations (tenant_id);
CREATE INDEX IF NOT EXISTS office_locations_name_idx ON public.office_locations (tenant_id, name);

-- Add trigger for updated_at
CREATE TRIGGER set_updated_at_on_office_locations
BEFORE UPDATE ON public.office_locations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ==============================================
-- 2. ADD OFFICE LOCATION TO EMPLOYEES
-- ==============================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS office_location_id UUID REFERENCES public.office_locations(id) ON DELETE SET NULL;

-- Add index for office location lookups
CREATE INDEX IF NOT EXISTS employees_office_location_idx ON public.employees (tenant_id, office_location_id);

-- ==============================================
-- 3. ROW LEVEL SECURITY
-- ==============================================

ALTER TABLE public.office_locations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read office locations for their tenant
CREATE POLICY office_locations_read
ON public.office_locations
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = public.app_current_user_id()
  )
);

-- Policy: Users with write permission can manage office locations
CREATE POLICY office_locations_write
ON public.office_locations
FOR ALL
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = public.app_current_user_id()
      AND (role = 'owner' OR role = 'admin')
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = public.app_current_user_id()
      AND (role = 'owner' OR role = 'admin')
  )
);

