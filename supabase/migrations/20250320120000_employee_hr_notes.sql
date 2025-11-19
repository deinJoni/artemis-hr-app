
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.employee_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  body text not null check (length(body) <= 5000),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_notes_employee_idx
  on public.employee_notes (tenant_id, employee_id, created_at desc);

create index if not exists employee_notes_created_by_idx
  on public.employee_notes (created_by, created_at desc);

create trigger set_updated_at_on_employee_notes
  before update on public.employee_notes
  for each row
  execute procedure public.handle_updated_at();

alter table public.employee_notes enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.polname = 'employee_notes_read'
      and n.nspname = 'public'
      and c.relname = 'employee_notes'
  ) then
    execute 'drop policy employee_notes_read on public.employee_notes';
  end if;
end
$$;

create policy employee_notes_read
on public.employee_notes
for select
to authenticated
using ( public.app_has_permission('employees.documents.read', tenant_id) );

do $$
begin
  if exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.polname = 'employee_notes_write'
      and n.nspname = 'public'
      and c.relname = 'employee_notes'
  ) then
    execute 'drop policy employee_notes_write on public.employee_notes';
  end if;
end
$$;

create policy employee_notes_write
on public.employee_notes
for all
to authenticated
using ( public.app_has_permission('employees.documents.write', tenant_id) )
with check ( public.app_has_permission('employees.documents.write', tenant_id) );
