-- Sensitive Data Flags
-- This migration adds sensitive data categorization to employees

-- ==============================================
-- 1. ADD SENSITIVE DATA FLAGS COLUMN
-- ==============================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS sensitive_data_flags JSONB DEFAULT '{}'::jsonb;

-- Add index for sensitive data queries
CREATE INDEX IF NOT EXISTS employees_sensitive_flags_idx ON public.employees (tenant_id)
WHERE sensitive_data_flags IS NOT NULL AND sensitive_data_flags != '{}'::jsonb;

