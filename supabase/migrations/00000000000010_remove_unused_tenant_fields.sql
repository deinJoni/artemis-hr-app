-- Remove unused tenant fields
-- These fields are no longer used in onboarding and are replaced by admin user info

alter table public.tenants
  drop column if exists company_location,
  drop column if exists contact_name,
  drop column if exists contact_email,
  drop column if exists contact_phone,
  drop column if exists needs_summary,
  drop column if exists key_priorities;

comment on table public.tenants is 'Tenant information. Contact info is now stored via the admin user (owner role in memberships).';

