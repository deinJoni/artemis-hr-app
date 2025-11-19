-- Automatically seed default leave types whenever a tenant is created
create or replace function public.auto_seed_leave_types()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.leave_types (
    tenant_id,
    name,
    code,
    requires_approval,
    requires_certificate,
    allow_negative_balance,
    enforce_minimum_entitlement,
    color,
    is_active
  )
  values
    (new.id, 'Vacation', 'VACATION', true, false, false, false, '#3B82F6', true),
    (new.id, 'Sick Leave', 'SICK', false, true, true, false, '#EF4444', true),
    (new.id, 'Personal Leave', 'PERSONAL', true, false, false, false, '#10B981', true)
  on conflict (tenant_id, code) do nothing;

  return new;
end;
$$;

drop trigger if exists auto_seed_leave_types on public.tenants;

create trigger auto_seed_leave_types
after insert on public.tenants
for each row
execute function public.auto_seed_leave_types();
