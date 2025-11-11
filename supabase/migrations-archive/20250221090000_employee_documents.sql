-- Employee documents support & RBAC extensions

do $$
begin
  if not exists (
    select 1
    from pg_type t
      join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'app_role'
      and e.enumlabel = 'people_ops'
  ) then
    alter type app_role add value 'people_ops';
  end if;
end
$$;

insert into public.permissions (key) values
  ('employees.documents.read'),
  ('employees.documents.write')
on conflict do nothing;

insert into public.role_permissions (role, permission_key) values
  ('owner','employees.documents.read'),
  ('owner','employees.documents.write'),
  ('admin','employees.documents.read'),
  ('admin','employees.documents.write'),
  ('manager','employees.documents.read')
on conflict do nothing;

insert into storage.buckets (id, name, public)
values ('employee-documents', 'employee-documents', false)
on conflict (id) do nothing;

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  uploaded_at timestamptz not null default now(),
  description text
);

create index if not exists employee_documents_tenant_employee_idx
  on public.employee_documents (tenant_id, employee_id, uploaded_at desc);

alter table public.employee_documents enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.polname = 'employee_documents_read'
      and n.nspname = 'public'
      and c.relname = 'employee_documents'
  ) then
    execute 'drop policy employee_documents_read on public.employee_documents';
  end if;
end
$$;
create policy employee_documents_read
on public.employee_documents
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
    where p.polname = 'employee_documents_write_insert'
      and n.nspname = 'public'
      and c.relname = 'employee_documents'
  ) then
    execute 'drop policy employee_documents_write_insert on public.employee_documents';
  end if;
end
$$;
create policy employee_documents_write_insert
on public.employee_documents
for insert
to authenticated
with check ( public.app_has_permission('employees.documents.write', tenant_id) );

do $$
begin
  if exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.polname = 'employee_documents_write_delete'
      and n.nspname = 'public'
      and c.relname = 'employee_documents'
  ) then
    execute 'drop policy employee_documents_write_delete on public.employee_documents';
  end if;
end
$$;
create policy employee_documents_write_delete
on public.employee_documents
for delete
to authenticated
using ( public.app_has_permission('employees.documents.write', tenant_id) );
