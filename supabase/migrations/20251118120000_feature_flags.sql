-- =============================================================================
-- feature flag infrastructure
-- -----------------------------------------------------------------------------
-- * introduces feature grouping + definition tables
-- * stores tenant-specific overrides and superadmin assignments
-- * exposes helper function `app_get_tenant_features` for efficient lookups
-- * seeds default groups/features aligned with README modules
-- =============================================================================

-- 1. feature groups ----------------------------------------------------------------
create table if not exists public.feature_groups (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.feature_groups is 'Logical grouping of product features (Core HR, Time & Attendance, etc).';
comment on column public.feature_groups.key is 'Stable identifier used by backend/frontend to bucket related toggles.';

create trigger set_feature_groups_updated_at
  before update on public.feature_groups
  for each row execute procedure public.set_updated_at();

alter table public.feature_groups enable row level security;

create policy feature_groups_select_authenticated
  on public.feature_groups
  for select
  to authenticated
  using (true);

-- 2. features -----------------------------------------------------------------------
create table if not exists public.features (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  group_id uuid not null references public.feature_groups(id) on delete cascade,
  default_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.features is 'Individual feature toggles addressable by slug.';
comment on column public.features.slug is 'Human-readable unique slug used throughout the stack.';

create index if not exists features_group_idx on public.features (group_id);

create trigger set_features_updated_at
  before update on public.features
  for each row execute procedure public.set_updated_at();

alter table public.features enable row level security;

create policy features_select_authenticated
  on public.features
  for select
  to authenticated
  using (true);

-- 3. tenant feature overrides -------------------------------------------------------
create table if not exists public.tenant_feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  feature_id uuid not null references public.features(id) on delete cascade,
  enabled boolean not null,
  reason text,
  notes text,
  toggled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_feature_flags_unique unique (tenant_id, feature_id)
);

comment on table public.tenant_feature_flags is 'Stores tenant-specific overrides for default feature behavior.';

create index if not exists tenant_feature_flags_tenant_idx
  on public.tenant_feature_flags (tenant_id);
create index if not exists tenant_feature_flags_feature_idx
  on public.tenant_feature_flags (feature_id);

create trigger set_tenant_feature_flags_updated_at
  before update on public.tenant_feature_flags
  for each row execute procedure public.set_updated_at();

alter table public.tenant_feature_flags enable row level security;

create policy tenant_feature_flags_select_authenticated
  on public.tenant_feature_flags
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.user_id = public.app_current_user_id()
        and m.tenant_id = tenant_id
    )
  );

-- 4. superadmins --------------------------------------------------------------------
create table if not exists public.superadmins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  notes text
);

comment on table public.superadmins is 'Users with cross-tenant access for feature management.';

alter table public.superadmins enable row level security;

create policy superadmins_select_authenticated
  on public.superadmins
  for select
  to authenticated
  using (public.app_current_user_id() = user_id);

-- service-role inserts/updates/deletes are handled outside RLS (backend uses supabaseAdmin).

-- 5. helper function ---------------------------------------------------------------
create or replace function public.app_get_tenant_features(p_tenant uuid)
returns table (
  feature_id uuid,
  slug text,
  name text,
  description text,
  group_key text,
  group_name text,
  default_enabled boolean,
  enabled boolean,
  source text
)
language sql
stable
as $$
  select
    f.id as feature_id,
    f.slug,
    f.name,
    f.description,
    fg.key as group_key,
    fg.name as group_name,
    f.default_enabled,
    coalesce(tff.enabled, f.default_enabled) as enabled,
    case
      when tff.id is not null then 'tenant_override'
      else 'default'
    end as source
  from public.features f
  join public.feature_groups fg on fg.id = f.group_id
  left join public.tenant_feature_flags tff
    on tff.feature_id = f.id
   and tff.tenant_id = p_tenant
  order by fg.sort_order, f.created_at;
$$;

comment on function public.app_get_tenant_features(p_tenant uuid) is 'Returns effective feature flags for the provided tenant id.';

-- 6. seed defaults ------------------------------------------------------------------
insert into public.feature_groups (key, name, description, sort_order)
values
  ('core_hr', 'Core HR & Employee Management', 'Employee profiles, departments, teams, documents, and bulk operations.', 10),
  ('time_attendance', 'Time & Attendance', 'Clock-in/out, manual entries, overtime and approvals.', 20),
  ('leave_absence', 'Leave & Absence', 'Leave requests, balances, approvals, and calendars.', 30),
  ('recruiting_ats', 'Recruiting & ATS', 'Jobs, pipelines, analytics, and recruiting workflows.', 40),
  ('workflows_automation', 'Workflows & Automation', 'Workflow builder, automation triggers, and goal tracking.', 50)
on conflict (key) do nothing;

with group_lookup as (
  select key, id from public.feature_groups
)
insert into public.features (slug, name, description, group_id, default_enabled)
values
  ('core_hr', 'Core HR Suite', 'Enables employee records, departments, teams, and related dashboards.', (select id from group_lookup where key = 'core_hr'), true),
  ('time_attendance', 'Time & Attendance', 'Enables calendar, approvals, overtime widgets, and My Time modules.', (select id from group_lookup where key = 'time_attendance'), true),
  ('leave_management', 'Leave & Absence', 'Enables leave requests, balances, admin tools, and analytics.', (select id from group_lookup where key = 'leave_absence'), true),
  ('recruiting', 'Recruiting & ATS', 'Enables recruiting dashboards, jobs, and analytics routes.', (select id from group_lookup where key = 'recruiting_ats'), false),
  ('workflows', 'Workflows & Automation', 'Enables workflow builder and automation routes.', (select id from group_lookup where key = 'workflows_automation'), false)
on conflict (slug) do nothing;


