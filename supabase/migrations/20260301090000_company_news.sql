-- =============================================================================
-- Company News / Communications module
-- -----------------------------------------------------------------------------
-- * Adds company_news + company_news_activity tables with RLS + auditing
-- * Seeds communications permissions + feature toggle
-- =============================================================================

-- 1. Main table ----------------------------------------------------------------
create table if not exists public.company_news (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  summary text,
  body text not null,
  category text not null check (category in ('news', 'mitteilung', 'announcement')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  publish_at timestamptz,
  published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.company_news is 'Tenant-scoped internal news, announcements, and HR communications.';
comment on column public.company_news.category is 'news = general update, mitteilung = internal memo, announcement = company-wide announcement.';
comment on column public.company_news.status is 'draft|scheduled|published|archived lifecycle state.';

create index if not exists company_news_tenant_status_idx
  on public.company_news (tenant_id, status, coalesce(publish_at, created_at) desc);

create trigger set_company_news_updated_at
  before update on public.company_news
  for each row execute procedure public.set_updated_at();

alter table public.company_news enable row level security;

create policy company_news_select_read
  on public.company_news
  for select
  to authenticated
  using (public.app_has_permission('communications.news.read', tenant_id));

create policy company_news_insert_manage
  on public.company_news
  for insert
  to authenticated
  with check (public.app_has_permission('communications.news.manage', tenant_id));

create policy company_news_update_manage
  on public.company_news
  for update
  to authenticated
  using (public.app_has_permission('communications.news.manage', tenant_id))
  with check (public.app_has_permission('communications.news.manage', tenant_id));

create policy company_news_delete_manage
  on public.company_news
  for delete
  to authenticated
  using (public.app_has_permission('communications.news.manage', tenant_id));

-- 2. Activity log --------------------------------------------------------------
create table if not exists public.company_news_activity (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.company_news(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users(id) on delete set null,
  details jsonb,
  created_at timestamptz not null default now()
);

comment on table public.company_news_activity is 'Audit trail for company news lifecycle events.';

create index if not exists company_news_activity_news_idx
  on public.company_news_activity (news_id, created_at desc);

alter table public.company_news_activity enable row level security;

create policy company_news_activity_select
  on public.company_news_activity
  for select
  to authenticated
  using (public.app_has_permission('communications.news.read', tenant_id));

create policy company_news_activity_insert
  on public.company_news_activity
  for insert
  to authenticated
  with check (public.app_has_permission('communications.news.manage', tenant_id));

-- 3. Permissions ---------------------------------------------------------------
insert into public.permissions (key) values
  ('communications.news.read'),
  ('communications.news.manage'),
  ('communications.news.publish')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission_key) values
  ('owner', 'communications.news.read'),
  ('owner', 'communications.news.manage'),
  ('owner', 'communications.news.publish'),
  ('admin', 'communications.news.read'),
  ('admin', 'communications.news.manage'),
  ('admin', 'communications.news.publish'),
  ('people_ops', 'communications.news.read'),
  ('people_ops', 'communications.news.manage'),
  ('people_ops', 'communications.news.publish'),
  ('manager', 'communications.news.read'),
  ('employee', 'communications.news.read')
on conflict (role, permission_key) do nothing;

-- 4. Feature flag --------------------------------------------------------------
insert into public.feature_groups (key, name, description, sort_order)
values (
  'communications',
  'Communications & Engagement',
  'Company news, announcements, and other internal communications.',
  25
)
on conflict (key) do nothing;

with group_lookup as (
  select id from public.feature_groups where key = 'communications' limit 1
)
insert into public.features (slug, name, description, group_id, default_enabled)
select
  'company_news',
  'Company News',
  'Enables the company news publishing workspace and dashboard surface.',
  group_lookup.id,
  true
from group_lookup
on conflict (slug) do nothing;
