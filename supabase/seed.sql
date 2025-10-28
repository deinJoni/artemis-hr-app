-- Minimal seed data for Core HR & Employee Management Module
-- This file contains essential data to test the HR features

-- Insert sample tenant
INSERT INTO public.tenants (id, name, created_at, company_name, company_location) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Acme Corp', NOW(), 'Acme Corporation', 'San Francisco, CA')
ON CONFLICT (id) DO NOTHING;

-- Insert sample departments
INSERT INTO public.departments (id, tenant_id, name, description, parent_id, head_employee_id, cost_center, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Engineering', 'Software development and technical operations', NULL, NULL, 'ENG-001', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Product', 'Product management and strategy', NULL, NULL, 'PROD-001', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Sales', 'Sales and business development', NULL, NULL, 'SALES-001', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', 'Marketing', 'Marketing and communications', NULL, NULL, 'MKT-001', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440000', 'Human Resources', 'People operations and talent management', NULL, NULL, 'HR-001', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440000', 'Finance', 'Financial operations and accounting', NULL, NULL, 'FIN-001', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440000', 'Frontend Engineering', 'Frontend development team', '550e8400-e29b-41d4-a716-446655440001', NULL, 'ENG-002', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440000', 'Backend Engineering', 'Backend development team', '550e8400-e29b-41d4-a716-446655440001', NULL, 'ENG-003', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440000', 'DevOps', 'Infrastructure and operations', '550e8400-e29b-41d4-a716-446655440001', NULL, 'ENG-004', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample employees (without user_id references for now)
INSERT INTO public.employees (
  id, tenant_id, email, name, manager_id, custom_fields, employee_number, 
  date_of_birth, nationality, phone_personal, phone_work, emergency_contact_name, 
  emergency_contact_phone, home_address, job_title, department_id, employment_type, 
  work_location, start_date, end_date, status, salary_amount, salary_currency, 
  salary_frequency, bank_account_encrypted, tax_id_encrypted, profile_completion_pct, 
  created_at, updated_at
) VALUES
  -- CEO
  ('550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440000', 'sarah.chen@acme.com', 'Sarah Chen', NULL, '{"bio": "Visionary leader with 15+ years in tech"}', 'EMP-2024-001', '1980-03-15', 'US', '+1-555-0101', '+1-555-0102', 'John Chen', '+1-555-0103', '{"street": "123 Executive Ave", "city": "San Francisco", "state": "CA", "postal_code": "94105", "country": "US"}', 'Chief Executive Officer', '550e8400-e29b-41d4-a716-446655440001', 'full_time', 'office', '2020-01-15', NULL, 'active', 300000.00, 'USD', 'yearly', 'encrypted_bank_info_1', 'encrypted_tax_id_1', 95, NOW(), NOW()),
  
  -- CTO
  ('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440000', 'mike.rodriguez@acme.com', 'Mike Rodriguez', '550e8400-e29b-41d4-a716-446655440010', '{"bio": "Tech leader passionate about scalable systems"}', 'EMP-2024-002', '1985-07-22', 'US', '+1-555-0201', '+1-555-0202', 'Maria Rodriguez', '+1-555-0203', '{"street": "456 Tech Street", "city": "San Francisco", "state": "CA", "postal_code": "94107", "country": "US"}', 'Chief Technology Officer', '550e8400-e29b-41d4-a716-446655440001', 'full_time', 'office', '2020-02-01', NULL, 'active', 280000.00, 'USD', 'yearly', 'encrypted_bank_info_2', 'encrypted_tax_id_2', 90, NOW(), NOW()),
  
  -- HR Manager
  ('550e8400-e29b-41d4-a716-446655440019', '550e8400-e29b-41d4-a716-446655440000', 'admin@acme.com', 'HR Admin', '550e8400-e29b-41d4-a716-446655440010', '{"bio": "HR professional focused on employee experience"}', 'EMP-2024-010', '1984-06-20', 'US', '+1-555-1001', '+1-555-1002', 'Michael Admin', '+1-555-1003', '{"street": "741 HR Heights", "city": "San Francisco", "state": "CA", "postal_code": "94109", "country": "US"}', 'HR Manager', '550e8400-e29b-41d4-a716-446655440005', 'full_time', 'office', '2020-06-01', NULL, 'active', 110000.00, 'USD', 'yearly', 'encrypted_bank_info_10', 'encrypted_tax_id_10', 90, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Update department heads
UPDATE public.departments SET head_employee_id = '550e8400-e29b-41d4-a716-446655440010' WHERE id = '550e8400-e29b-41d4-a716-446655440001';
UPDATE public.departments SET head_employee_id = '550e8400-e29b-41d4-a716-446655440011' WHERE id = '550e8400-e29b-41d4-a716-446655440007';
UPDATE public.departments SET head_employee_id = '550e8400-e29b-41d4-a716-446655440019' WHERE id = '550e8400-e29b-41d4-a716-446655440005';

-- Insert sample custom field definitions
INSERT INTO public.employee_custom_field_defs (
  id, tenant_id, name, key, type, required, options, created_at
) VALUES
  ('550e8400-e29b-41d4-a716-446655440400', '550e8400-e29b-41d4-a716-446655440000', 'Bio', 'bio', 'text', false, NULL, NOW()),
  ('550e8400-e29b-41d4-a716-446655440401', '550e8400-e29b-41d4-a716-446655440000', 'LinkedIn Profile', 'linkedin', 'text', false, NULL, NOW()),
  ('550e8400-e29b-41d4-a716-446655440402', '550e8400-e29b-41d4-a716-446655440000', 'GitHub Profile', 'github', 'text', false, NULL, NOW()),
  ('550e8400-e29b-41d4-a716-446655440403', '550e8400-e29b-41d4-a716-446655440000', 'Skills', 'skills', 'text', false, NULL, NOW()),
  ('550e8400-e29b-41d4-a716-446655440404', '550e8400-e29b-41d4-a716-446655440000', 'Certifications', 'certifications', 'text', false, NULL, NOW())
ON CONFLICT (id) DO NOTHING;