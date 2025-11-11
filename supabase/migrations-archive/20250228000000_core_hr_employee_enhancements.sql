-- Core HR Module MVP - Enhanced Employee Fields, Departments, Audit Log, and Document Versioning
-- This migration adds comprehensive HR management capabilities to the existing employee system

-- ==============================================
-- 1. ENHANCED EMPLOYEE FIELDS
-- ==============================================

-- Add new columns to employees table for comprehensive HR data
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS phone_personal TEXT,
  ADD COLUMN IF NOT EXISTS phone_work TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS home_address JSONB,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS department_id UUID,
  ADD COLUMN IF NOT EXISTS employment_type TEXT CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern', 'seasonal')),
  ADD COLUMN IF NOT EXISTS work_location TEXT CHECK (work_location IN ('office', 'remote', 'hybrid')),
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'terminated', 'inactive')),
  ADD COLUMN IF NOT EXISTS salary_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS salary_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS salary_frequency TEXT CHECK (salary_frequency IN ('yearly', 'monthly', 'weekly', 'hourly')),
  ADD COLUMN IF NOT EXISTS bank_account_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS tax_id_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS profile_completion_pct INTEGER DEFAULT 0 CHECK (profile_completion_pct >= 0 AND profile_completion_pct <= 100),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS employees_tenant_status_idx ON public.employees (tenant_id, status);
CREATE INDEX IF NOT EXISTS employees_tenant_department_idx ON public.employees (tenant_id, department_id);
CREATE INDEX IF NOT EXISTS employees_employee_number_idx ON public.employees (employee_number);

-- Add constraint for date validation
ALTER TABLE public.employees
  ADD CONSTRAINT employees_date_range_check CHECK (end_date IS NULL OR start_date IS NULL OR start_date <= end_date);

-- ==============================================
-- 2. DEPARTMENTS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  head_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  cost_center TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- Add foreign key constraint for department_id in employees
ALTER TABLE public.employees
  ADD CONSTRAINT employees_department_fk 
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

-- Add indexes for departments
CREATE INDEX IF NOT EXISTS departments_tenant_idx ON public.departments (tenant_id);
CREATE INDEX IF NOT EXISTS departments_parent_idx ON public.departments (parent_id);
CREATE INDEX IF NOT EXISTS departments_head_idx ON public.departments (head_employee_id);

-- ==============================================
-- 3. EMPLOYEE AUDIT LOG TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.employee_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'document_added', 'document_removed', 'status_changed')),
  field_name TEXT, -- Which field changed
  old_value JSONB, -- Previous value
  new_value JSONB, -- New value
  change_reason TEXT, -- Optional comment
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for audit log
CREATE INDEX IF NOT EXISTS employee_audit_log_employee_idx ON public.employee_audit_log (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS employee_audit_log_tenant_idx ON public.employee_audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS employee_audit_log_changed_by_idx ON public.employee_audit_log (changed_by, created_at DESC);

-- ==============================================
-- 4. DOCUMENT VERSIONING SUPPORT
-- ==============================================

-- Extend employee_documents table with versioning
ALTER TABLE public.employee_documents
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES public.employee_documents(id),
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('contract', 'certification', 'id_document', 'performance', 'medical', 'other')),
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add indexes for document versioning
CREATE INDEX IF NOT EXISTS employee_documents_category_idx ON public.employee_documents (tenant_id, category);
CREATE INDEX IF NOT EXISTS employee_documents_expiry_idx ON public.employee_documents (tenant_id, expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS employee_documents_version_idx ON public.employee_documents (employee_id, is_current, version DESC);

-- ==============================================
-- 5. EMPLOYEE STATUS HISTORY TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.employee_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'on_leave', 'terminated', 'inactive')),
  effective_date DATE NOT NULL,
  reason TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for status history
CREATE INDEX IF NOT EXISTS employee_status_history_employee_idx ON public.employee_status_history (employee_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS employee_status_history_status_idx ON public.employee_status_history (status, effective_date DESC);

-- ==============================================
-- 6. NEW PERMISSIONS
-- ==============================================

-- Add new permissions for HR features
INSERT INTO public.permissions (key) VALUES
  ('employees.audit.read'),
  ('employees.compensation.read'),
  ('employees.compensation.write'),
  ('employees.sensitive.read'),
  ('employees.sensitive.write'),
  ('employees.import'),
  ('departments.manage'),
  ('departments.read')
ON CONFLICT (key) DO NOTHING;

-- ==============================================
-- 7. ROLE PERMISSIONS
-- ==============================================

-- Grant permissions to roles
INSERT INTO public.role_permissions (role, permission_key) VALUES
  -- Owner gets all permissions
  ('owner', 'employees.audit.read'),
  ('owner', 'employees.compensation.read'),
  ('owner', 'employees.compensation.write'),
  ('owner', 'employees.sensitive.read'),
  ('owner', 'employees.sensitive.write'),
  ('owner', 'employees.import'),
  ('owner', 'departments.manage'),
  ('owner', 'departments.read'),
  
  -- Admin gets all permissions
  ('admin', 'employees.audit.read'),
  ('admin', 'employees.compensation.read'),
  ('admin', 'employees.compensation.write'),
  ('admin', 'employees.sensitive.read'),
  ('admin', 'employees.sensitive.write'),
  ('admin', 'employees.import'),
  ('admin', 'departments.manage'),
  ('admin', 'departments.read'),
  
  -- People Ops gets most permissions except compensation write
  ('people_ops', 'employees.audit.read'),
  ('people_ops', 'employees.compensation.read'),
  ('people_ops', 'employees.sensitive.read'),
  ('people_ops', 'employees.import'),
  ('people_ops', 'departments.manage'),
  ('people_ops', 'departments.read'),
  
  -- Manager gets limited permissions
  ('manager', 'employees.audit.read'),
  ('manager', 'departments.read')
ON CONFLICT (role, permission_key) DO NOTHING;

-- ==============================================
-- 8. ROW LEVEL SECURITY POLICIES
-- ==============================================

-- Enable RLS on new tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_status_history ENABLE ROW LEVEL SECURITY;

-- Department policies
CREATE POLICY departments_read ON public.departments
  FOR SELECT TO authenticated
  USING (public.app_has_permission('departments.read', tenant_id));

CREATE POLICY departments_manage ON public.departments
  FOR ALL TO authenticated
  USING (public.app_has_permission('departments.manage', tenant_id))
  WITH CHECK (public.app_has_permission('departments.manage', tenant_id));

-- Employee audit log policies
CREATE POLICY employee_audit_log_read ON public.employee_audit_log
  FOR SELECT TO authenticated
  USING (public.app_has_permission('employees.audit.read', tenant_id));

-- Employee status history policies
CREATE POLICY employee_status_history_read ON public.employee_status_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.employees e 
    WHERE e.id = employee_status_history.employee_id 
    AND public.app_has_permission('employees.read', e.tenant_id)
  ));

CREATE POLICY employee_status_history_write ON public.employee_status_history
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.employees e 
    WHERE e.id = employee_status_history.employee_id 
    AND public.app_has_permission('employees.write', e.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.employees e 
    WHERE e.id = employee_status_history.employee_id 
    AND public.app_has_permission('employees.write', e.tenant_id)
  ));

-- ==============================================
-- 9. TRIGGERS AND FUNCTIONS
-- ==============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers
CREATE TRIGGER set_updated_at_on_employees
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_on_departments
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_on_employee_documents
  BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Function to calculate profile completion percentage
CREATE OR REPLACE FUNCTION public.calculate_profile_completion(employee_row public.employees)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  total_fields INTEGER := 0;
  filled_fields INTEGER := 0;
BEGIN
  -- Count required fields (excluding sensitive ones that are optional)
  total_fields := 8; -- name, email, job_title, department_id, employment_type, start_date, status, phone_work
  
  -- Check each required field
  IF employee_row.name IS NOT NULL AND employee_row.name != '' THEN filled_fields := filled_fields + 1; END IF;
  IF employee_row.email IS NOT NULL AND employee_row.email != '' THEN filled_fields := filled_fields + 1; END IF;
  IF employee_row.job_title IS NOT NULL AND employee_row.job_title != '' THEN filled_fields := filled_fields + 1; END IF;
  IF employee_row.department_id IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF employee_row.employment_type IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF employee_row.start_date IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF employee_row.status IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF employee_row.phone_work IS NOT NULL AND employee_row.phone_work != '' THEN filled_fields := filled_fields + 1; END IF;
  
  -- Calculate percentage
  IF total_fields = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND((filled_fields::DECIMAL / total_fields::DECIMAL) * 100);
END;
$$;

-- Function to auto-generate employee number
CREATE OR REPLACE FUNCTION public.generate_employee_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  employee_num TEXT;
BEGIN
  year_part := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Get next sequence number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(employee_number FROM 9) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM public.employees
  WHERE employee_number LIKE 'EMP-' || year_part || '-%';
  
  employee_num := 'EMP-' || year_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN employee_num;
END;
$$;

-- Trigger to auto-generate employee number and calculate profile completion
CREATE OR REPLACE FUNCTION public.employee_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Auto-generate employee number if not provided
  IF NEW.employee_number IS NULL THEN
    NEW.employee_number := public.generate_employee_number();
  END IF;
  
  -- Calculate initial profile completion
  NEW.profile_completion_pct := public.calculate_profile_completion(NEW);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER employee_before_insert_trigger
  BEFORE INSERT ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.employee_before_insert();

-- Trigger to update profile completion on employee updates
CREATE OR REPLACE FUNCTION public.employee_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update profile completion percentage
  UPDATE public.employees
  SET profile_completion_pct = public.calculate_profile_completion(NEW)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER employee_after_update_trigger
  AFTER UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.employee_after_update();

-- ==============================================
-- 10. INITIAL DATA SETUP
-- ==============================================

-- Create default departments for existing tenants
INSERT INTO public.departments (tenant_id, name, description)
SELECT 
  t.id as tenant_id,
  'General' as name,
  'Default department for employees without specific department assignment' as description
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.departments d WHERE d.tenant_id = t.id
);

-- Update existing employees to have default department and status
UPDATE public.employees
SET 
  department_id = (
    SELECT d.id 
    FROM public.departments d 
    WHERE d.tenant_id = employees.tenant_id 
    AND d.name = 'General'
    LIMIT 1
  ),
  status = 'active',
  profile_completion_pct = public.calculate_profile_completion(employees)
WHERE department_id IS NULL;

-- ==============================================
-- 11. HELPER VIEWS
-- ==============================================

-- View for employee summary with department info
CREATE OR REPLACE VIEW public.employee_summary AS
SELECT 
  e.id,
  e.tenant_id,
  e.employee_number,
  e.name,
  e.email,
  e.job_title,
  e.status,
  e.profile_completion_pct,
  e.created_at,
  e.updated_at,
  d.name as department_name,
  d.id as department_id,
  m.name as manager_name,
  m.id as manager_id
FROM public.employees e
LEFT JOIN public.departments d ON e.department_id = d.id
LEFT JOIN public.employees m ON e.manager_id = m.id;

-- View for department hierarchy
CREATE OR REPLACE VIEW public.department_hierarchy AS
WITH RECURSIVE dept_tree AS (
  -- Base case: root departments (no parent)
  SELECT 
    id,
    tenant_id,
    name,
    description,
    parent_id,
    head_employee_id,
    cost_center,
    0 as level,
    ARRAY[id] as path,
    name as full_path
  FROM public.departments
  WHERE parent_id IS NULL
  
  UNION ALL
  
  -- Recursive case: child departments
  SELECT 
    d.id,
    d.tenant_id,
    d.name,
    d.description,
    d.parent_id,
    d.head_employee_id,
    d.cost_center,
    dt.level + 1,
    dt.path || d.id,
    dt.full_path || ' > ' || d.name
  FROM public.departments d
  JOIN dept_tree dt ON d.parent_id = dt.id
)
SELECT 
  dt.*,
  e.name as head_name,
  e.email as head_email,
  (SELECT COUNT(*) FROM public.employees WHERE department_id = dt.id) as employee_count
FROM dept_tree dt
LEFT JOIN public.employees e ON dt.head_employee_id = e.id
ORDER BY dt.tenant_id, dt.level, dt.name;
