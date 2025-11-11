-- Permissions for Office Locations and Teams
-- This migration adds permissions for new features

-- ==============================================
-- 1. ADD NEW PERMISSIONS
-- ==============================================

INSERT INTO public.permissions (key) VALUES
  ('office_locations.read'),
  ('office_locations.write'),
  ('teams.read'),
  ('teams.write')
ON CONFLICT DO NOTHING;

-- ==============================================
-- 2. ASSIGN PERMISSIONS TO ROLES
-- ==============================================

-- Owner: full access
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('owner', 'office_locations.read'),
  ('owner', 'office_locations.write'),
  ('owner', 'teams.read'),
  ('owner', 'teams.write')
ON CONFLICT DO NOTHING;

-- Admin: full access
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('admin', 'office_locations.read'),
  ('admin', 'office_locations.write'),
  ('admin', 'teams.read'),
  ('admin', 'teams.write')
ON CONFLICT DO NOTHING;

-- Manager: read and write access
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('manager', 'office_locations.read'),
  ('manager', 'teams.read'),
  ('manager', 'teams.write')
ON CONFLICT DO NOTHING;

-- Employee: read-only access
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('employee', 'office_locations.read'),
  ('employee', 'teams.read')
ON CONFLICT DO NOTHING;

-- People Ops: full access
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('people_ops', 'office_locations.read'),
  ('people_ops', 'office_locations.write'),
  ('people_ops', 'teams.read'),
  ('people_ops', 'teams.write')
ON CONFLICT DO NOTHING;

