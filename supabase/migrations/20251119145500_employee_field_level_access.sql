-- 20251119145500_employee_field_level_access.sql
-- Purpose: expose a view that automatically masks compensation and sensitive fields
-- Notes:
--   * The view leverages app_has_permission() to determine whether the active user
--     can see compensation or sensitive information.
--   * Consumers can query employees_public instead of employees to get pre-filtered data.

drop view if exists public.employees_public;

create or replace view public.employees_public
with (security_barrier = true)
as
select
  e.id,
  e.tenant_id,
  e.email,
  e.name,
  e.manager_id,
  e.user_id,
  e.employee_number,
  e.date_of_birth,
  e.nationality,
  e.phone_personal,
  e.phone_work,
  e.emergency_contact_name,
  e.emergency_contact_phone,
  e.home_address,
  e.job_title,
  e.department_id,
  e.employment_type,
  e.work_location,
  e.start_date,
  e.end_date,
  e.status,
  case
    when public.app_has_permission('employees.compensation.read', e.tenant_id)
      then e.salary_amount
    else null
  end as salary_amount,
  case
    when public.app_has_permission('employees.compensation.read', e.tenant_id)
      then e.salary_currency
    else null
  end as salary_currency,
  case
    when public.app_has_permission('employees.compensation.read', e.tenant_id)
      then e.salary_frequency
    else null
  end as salary_frequency,
  case
    when public.app_has_permission('employees.sensitive.read', e.tenant_id)
      then e.bank_account_encrypted
    else null
  end as bank_account_encrypted,
  case
    when public.app_has_permission('employees.sensitive.read', e.tenant_id)
      then e.tax_id_encrypted
    else null
  end as tax_id_encrypted,
  e.profile_completion_pct,
  e.office_location_id,
  e.sensitive_data_flags,
  e.created_at,
  e.updated_at,
  e.custom_fields
from public.employees e;

comment on view public.employees_public is
  'Employee records with compensation and sensitive fields automatically masked unless the current user has the appropriate permission.';

grant select on public.employees_public to authenticated;
grant select on public.employees_public to service_role;

