-- Teams Management
-- This migration adds teams and team members tables

-- ==============================================
-- 1. TEAMS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  team_lead_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- Add indexes for teams
CREATE INDEX IF NOT EXISTS teams_tenant_idx ON public.teams (tenant_id);
CREATE INDEX IF NOT EXISTS teams_department_idx ON public.teams (tenant_id, department_id);
CREATE INDEX IF NOT EXISTS teams_lead_idx ON public.teams (team_lead_id);

-- Add trigger for updated_at
CREATE TRIGGER set_updated_at_on_teams
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ==============================================
-- 2. TEAM MEMBERS JUNCTION TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, employee_id)
);

-- Add indexes for team members
CREATE INDEX IF NOT EXISTS team_members_team_idx ON public.team_members (team_id);
CREATE INDEX IF NOT EXISTS team_members_employee_idx ON public.team_members (employee_id);

-- ==============================================
-- 3. ROW LEVEL SECURITY
-- ==============================================

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read teams for their tenant
CREATE POLICY teams_read
ON public.teams
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = public.app_current_user_id()
  )
);

-- Policy: Users with write permission can manage teams
CREATE POLICY teams_write
ON public.teams
FOR ALL
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = public.app_current_user_id()
      AND (role = 'owner' OR role = 'admin' OR role = 'manager')
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = public.app_current_user_id()
      AND (role = 'owner' OR role = 'admin' OR role = 'manager')
  )
);

-- Policy: Users can read team members for teams in their tenant
CREATE POLICY team_members_read
ON public.team_members
FOR SELECT
USING (
  team_id IN (
    SELECT id FROM public.teams
    WHERE tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = public.app_current_user_id()
    )
  )
);

-- Policy: Users with write permission can manage team members
CREATE POLICY team_members_write
ON public.team_members
FOR ALL
USING (
  team_id IN (
    SELECT id FROM public.teams
    WHERE tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = public.app_current_user_id()
        AND (role = 'owner' OR role = 'admin' OR role = 'manager')
    )
  )
)
WITH CHECK (
  team_id IN (
    SELECT id FROM public.teams
    WHERE tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = public.app_current_user_id()
        AND (role = 'owner' OR role = 'admin' OR role = 'manager')
    )
  )
);

