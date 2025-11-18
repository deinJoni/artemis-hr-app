-- Add language column to tenants table for onboarding
-- Language options: German, English

alter table public.tenants
  add column if not exists language text
    check (language is null or language in ('German', 'English'));

comment on column public.tenants.language is 'Preferred language for the tenant (German or English)';

