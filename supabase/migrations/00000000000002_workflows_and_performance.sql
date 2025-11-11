-- Workflows and Performance Migration
-- This migration creates the workflow engine and performance management tables
-- Includes: workflows, goals, check-ins

-- ==============================================
-- 1. WORKFLOW TABLES
-- ==============================================

create table if not exists public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('onboarding','offboarding')),
  name text not null,
  description text,
  blocks jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflow_templates_kind_idx
  on public.workflow_templates (kind);

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  kind text not null check (kind in ('onboarding','offboarding')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  active_version_id uuid,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists public.workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  version_number int not null,
  is_active boolean not null default false,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  published_at timestamptz,
  unique (workflow_id, version_number)
);

alter table public.workflows
  add constraint workflows_active_version_fk
  foreign key (active_version_id) references public.workflow_versions(id)
  on delete set null;

create index if not exists workflow_versions_workflow_idx
  on public.workflow_versions (workflow_id, is_active);

create table if not exists public.workflow_nodes (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.workflow_versions(id) on delete cascade,
  node_key text not null,
  type text not null check (type in ('trigger','action','delay','logic')),
  label text,
  config jsonb,
  ui_position jsonb,
  created_at timestamptz not null default now(),
  unique (version_id, node_key)
);

create table if not exists public.workflow_edges (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.workflow_versions(id) on delete cascade,
  source_node_id uuid not null references public.workflow_nodes(id) on delete cascade,
  target_node_id uuid not null references public.workflow_nodes(id) on delete cascade,
  condition jsonb,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists workflow_edges_version_idx
  on public.workflow_edges (version_id);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  version_id uuid not null references public.workflow_versions(id),
  employee_id uuid references public.employees(id) on delete set null,
  trigger_source text,
  status text not null default 'pending' check (status in ('pending','in_progress','paused','completed','canceled','failed')),
  started_at timestamptz default now(),
  completed_at timestamptz,
  canceled_at timestamptz,
  failed_at timestamptz,
  last_error text,
  context jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workflow_runs_tenant_status_idx
  on public.workflow_runs (tenant_id, status);

create table if not exists public.workflow_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  node_id uuid not null references public.workflow_nodes(id),
  status text not null default 'pending' check (status in ('pending','queued','waiting_input','in_progress','completed','failed','canceled')),
  assigned_to jsonb,
  due_at timestamptz,
  payload jsonb,
  result jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists workflow_run_steps_run_idx
  on public.workflow_run_steps (run_id, status);

create table if not exists public.workflow_action_queue (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  node_id uuid references public.workflow_nodes(id) on delete set null,
  resume_at timestamptz not null,
  attempts int not null default 0,
  last_error text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workflow_action_queue_resume_idx
  on public.workflow_action_queue (resume_at);

create table if not exists public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists workflow_events_run_idx
  on public.workflow_events (run_id, created_at);

create table if not exists public.employee_journey_views (
  run_id uuid primary key references public.workflow_runs(id) on delete cascade,
  share_token uuid not null default gen_random_uuid(),
  hero_copy text,
  cta_label text,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists employee_journey_views_share_idx
  on public.employee_journey_views (share_token);

-- ==============================================
-- 2. PERFORMANCE MANAGEMENT TABLES
-- ==============================================

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','completed')),
  progress_pct numeric(5,2) not null default 0,
  due_date date,
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_tenant_employee_idx
  on public.goals (tenant_id, employee_id, status);

create table if not exists public.goal_key_results (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  label text not null,
  target_value numeric,
  current_value numeric,
  status text not null default 'pending' check (status in ('pending','in_progress','achieved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goal_key_results_goal_idx
  on public.goal_key_results (goal_id);

create table if not exists public.goal_updates (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists goal_updates_goal_idx
  on public.goal_updates (goal_id, created_at desc);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  manager_user_id uuid not null references auth.users(id),
  employee_id uuid not null references public.employees(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','completed')),
  scheduled_for timestamptz,
  completed_at timestamptz,
  last_updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists check_ins_tenant_employee_idx
  on public.check_ins (tenant_id, employee_id, status);

create table if not exists public.check_in_agendas (
  check_in_id uuid primary key references public.check_ins(id) on delete cascade,
  accomplishments text,
  priorities text,
  roadblocks text,
  notes_json jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.check_in_private_notes (
  check_in_id uuid primary key references public.check_ins(id) on delete cascade,
  manager_user_id uuid not null references auth.users(id),
  body text,
  created_at timestamptz not null default now()
);

-- ==============================================
-- 3. TRIGGERS
-- ==============================================

create trigger set_updated_at_on_workflows
before update on public.workflows
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_employee_journey_views
before update on public.employee_journey_views
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_goals
before update on public.goals
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_goal_key_results
before update on public.goal_key_results
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_check_ins
before update on public.check_ins
for each row
execute function public.set_updated_at();

-- ==============================================
-- 4. ROW LEVEL SECURITY
-- ==============================================

alter table public.workflow_templates enable row level security;
alter table public.workflows enable row level security;
alter table public.workflow_versions enable row level security;
alter table public.workflow_nodes enable row level security;
alter table public.workflow_edges enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.workflow_run_steps enable row level security;
alter table public.workflow_action_queue enable row level security;
alter table public.workflow_events enable row level security;
alter table public.employee_journey_views enable row level security;
alter table public.goals enable row level security;
alter table public.goal_key_results enable row level security;
alter table public.goal_updates enable row level security;
alter table public.check_ins enable row level security;
alter table public.check_in_agendas enable row level security;
alter table public.check_in_private_notes enable row level security;

-- Workflow templates policies
create policy workflow_templates_select_all on public.workflow_templates
for select to authenticated using (true);

-- Workflows policies
create policy workflows_select on public.workflows
for select to authenticated
using (
  public.app_has_permission('workflows.read', workflows.tenant_id)
  or public.app_has_permission('workflows.manage', workflows.tenant_id)
);

create policy workflows_modify on public.workflows
for all to authenticated
using (public.app_has_permission('workflows.manage', workflows.tenant_id))
with check (public.app_has_permission('workflows.manage', workflows.tenant_id));

-- Workflow versions policies
create policy workflow_versions_access on public.workflow_versions
for all to authenticated
using (
  exists (
    select 1
    from public.workflows w
    where w.id = workflow_versions.workflow_id
      and (
        public.app_has_permission('workflows.read', w.tenant_id)
        or public.app_has_permission('workflows.manage', w.tenant_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.workflows w
    where w.id = workflow_versions.workflow_id
      and public.app_has_permission('workflows.manage', w.tenant_id)
  )
);

-- Workflow nodes policies
create policy workflow_nodes_access on public.workflow_nodes
for all to authenticated
using (
  exists (
    select 1
    from public.workflow_versions v
    join public.workflows w on w.id = v.workflow_id
    where v.id = workflow_nodes.version_id
      and (
        public.app_has_permission('workflows.read', w.tenant_id)
        or public.app_has_permission('workflows.manage', w.tenant_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_versions v
    join public.workflows w on w.id = v.workflow_id
    where v.id = workflow_nodes.version_id
      and public.app_has_permission('workflows.manage', w.tenant_id)
  )
);

-- Workflow edges policies
create policy workflow_edges_access on public.workflow_edges
for all to authenticated
using (
  exists (
    select 1
    from public.workflow_versions v
    join public.workflows w on w.id = v.workflow_id
    where v.id = workflow_edges.version_id
      and (
        public.app_has_permission('workflows.read', w.tenant_id)
        or public.app_has_permission('workflows.manage', w.tenant_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_versions v
    join public.workflows w on w.id = v.workflow_id
    where v.id = workflow_edges.version_id
      and public.app_has_permission('workflows.manage', w.tenant_id)
  )
);

-- Workflow runs policies
create policy workflow_runs_select on public.workflow_runs
for select to authenticated
using (
  public.app_has_permission('workflows.read', workflow_runs.tenant_id)
  or public.app_has_permission('workflows.run.manage', workflow_runs.tenant_id)
  or public.app_has_permission('workflows.manage', workflow_runs.tenant_id)
);

create policy workflow_runs_modify on public.workflow_runs
for all to authenticated
using (
  public.app_has_permission('workflows.run.manage', workflow_runs.tenant_id)
  or public.app_has_permission('workflows.manage', workflow_runs.tenant_id)
)
with check (
  public.app_has_permission('workflows.run.manage', workflow_runs.tenant_id)
  or public.app_has_permission('workflows.manage', workflow_runs.tenant_id)
);

-- Workflow run steps policies
create policy workflow_run_steps_access on public.workflow_run_steps
for all to authenticated
using (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = workflow_run_steps.run_id
      and (
        public.app_has_permission('workflows.read', r.tenant_id)
        or public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = workflow_run_steps.run_id
      and (
        public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
);

-- Workflow action queue policies
create policy workflow_action_queue_access on public.workflow_action_queue
for all to authenticated
using (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = workflow_action_queue.run_id
      and (
        public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = workflow_action_queue.run_id
      and (
        public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
);

-- Workflow events policies
create policy workflow_events_access on public.workflow_events
for all to authenticated
using (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = workflow_events.run_id
      and (
        public.app_has_permission('workflows.read', r.tenant_id)
        or public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = workflow_events.run_id
      and (
        public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
);

-- Employee journey views policies
create policy employee_journey_views_access on public.employee_journey_views
for all to authenticated
using (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = employee_journey_views.run_id
      and (
        public.app_has_permission('workflows.read', r.tenant_id)
        or public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_runs r
    where r.id = employee_journey_views.run_id
      and (
        public.app_has_permission('workflows.run.manage', r.tenant_id)
        or public.app_has_permission('workflows.manage', r.tenant_id)
      )
  )
);

-- Goals policies
create policy goals_select on public.goals
for select to authenticated
using (
  public.app_has_permission('goals.read', tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = goals.employee_id
      and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  )
);

create policy goals_insert on public.goals
for insert to authenticated
with check (
  public.app_has_permission('goals.write', tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = goals.employee_id
      and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  )
);

create policy goals_update on public.goals
for update to authenticated
using (
  public.app_has_permission('goals.write', tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = goals.employee_id
      and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  )
)
with check (
  public.app_has_permission('goals.write', tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = goals.employee_id
      and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  )
);

create policy goals_delete on public.goals
for delete to authenticated
using (
  public.app_has_permission('goals.write', tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = goals.employee_id
      and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  )
);

-- Goal key results policies
create policy goal_key_results_select on public.goal_key_results
for select to authenticated
using (
  exists (
    select 1
    from public.goals g
    where g.id = goal_key_results.goal_id
      and (
        public.app_has_permission('goals.read', g.tenant_id)
        or exists (
          select 1
          from public.employees e
          where e.id = g.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
);

create policy goal_key_results_write on public.goal_key_results
for all to authenticated
using (
  exists (
    select 1
    from public.goals g
    where g.id = goal_key_results.goal_id
      and (
        public.app_has_permission('goals.write', g.tenant_id)
        or exists (
          select 1
          from public.employees e
          where e.id = g.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.goals g
    where g.id = goal_key_results.goal_id
      and (
        public.app_has_permission('goals.write', g.tenant_id)
        or exists (
          select 1
          from public.employees e
          where e.id = g.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
);

-- Goal updates policies
create policy goal_updates_select on public.goal_updates
for select to authenticated
using (
  exists (
    select 1
    from public.goals g
    where g.id = goal_updates.goal_id
      and (
        public.app_has_permission('goals.read', g.tenant_id)
        or exists (
          select 1
          from public.employees e
          where e.id = g.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
);

create policy goal_updates_insert on public.goal_updates
for insert to authenticated
with check (
  exists (
    select 1
    from public.goals g
    where g.id = goal_updates.goal_id
      and (
        public.app_has_permission('goals.write', g.tenant_id)
        or exists (
          select 1
          from public.employees e
          where e.id = g.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
  and author_id = public.app_current_user_id()
);

-- Check-ins policies
create policy check_ins_select on public.check_ins
for select to authenticated
using (
  public.app_has_permission('check_ins.read', tenant_id)
  or manager_user_id = public.app_current_user_id()
  or exists (
    select 1
    from public.employees e
    where e.id = check_ins.employee_id
      and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  )
);

create policy check_ins_insert on public.check_ins
for insert to authenticated
with check (
  public.app_has_permission('check_ins.write', tenant_id)
  or manager_user_id = public.app_current_user_id()
);

create policy check_ins_update on public.check_ins
for update to authenticated
using (
  public.app_has_permission('check_ins.write', tenant_id)
  or manager_user_id = public.app_current_user_id()
)
with check (
  public.app_has_permission('check_ins.write', tenant_id)
  or manager_user_id = public.app_current_user_id()
);

-- Check-in agendas policies
create policy check_in_agendas_select on public.check_in_agendas
for select to authenticated
using (
  exists (
    select 1
    from public.check_ins ci
    where ci.id = check_in_agendas.check_in_id
      and (
        public.app_has_permission('check_ins.read', ci.tenant_id)
        or ci.manager_user_id = public.app_current_user_id()
        or exists (
          select 1
          from public.employees e
          where e.id = ci.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
);

create policy check_in_agendas_write on public.check_in_agendas
for all to authenticated
using (
  exists (
    select 1
    from public.check_ins ci
    where ci.id = check_in_agendas.check_in_id
      and (
        public.app_has_permission('check_ins.write', ci.tenant_id)
        or ci.manager_user_id = public.app_current_user_id()
        or exists (
          select 1
          from public.employees e
          where e.id = ci.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.check_ins ci
    where ci.id = check_in_agendas.check_in_id
      and (
        public.app_has_permission('check_ins.write', ci.tenant_id)
        or ci.manager_user_id = public.app_current_user_id()
        or exists (
          select 1
          from public.employees e
          where e.id = ci.employee_id
            and lower(coalesce(e.email, '')) = lower(coalesce((auth.jwt()->>'email')::text, ''))
        )
      )
  )
);

-- Check-in private notes policies
create policy check_in_private_notes_select on public.check_in_private_notes
for select to authenticated
using (
  exists (
    select 1
    from public.check_ins ci
    where ci.id = check_in_private_notes.check_in_id
      and (
        public.app_has_permission('check_ins.read', ci.tenant_id)
        or ci.manager_user_id = public.app_current_user_id()
      )
  )
);

create policy check_in_private_notes_upsert on public.check_in_private_notes
for all to authenticated
using (manager_user_id = public.app_current_user_id())
with check (manager_user_id = public.app_current_user_id());

-- ==============================================
-- 5. HELPER VIEWS
-- ==============================================

create or replace view public.employee_goal_summaries as
select
  e.id as employee_id,
  e.tenant_id,
  count(g.id) filter (where g.status <> 'completed') as active_goals,
  coalesce(count(g.id), 0) as total_goals,
  coalesce(sum(case when g.status = 'completed' then 1 else 0 end), 0) as completed_goals,
  coalesce(avg(g.progress_pct), 0)::numeric(5,2) as avg_progress_pct,
  (
    select max(ci.completed_at)
    from public.check_ins ci
    where ci.employee_id = e.id
      and ci.tenant_id = e.tenant_id
      and ci.status = 'completed'
  ) as last_check_in_at
from public.employees e
left join public.goals g on g.employee_id = e.id and g.tenant_id = e.tenant_id
group by e.id, e.tenant_id;

-- ==============================================
-- 6. SEED DATA
-- ==============================================

insert into public.workflow_templates (kind, name, description, blocks)
values
  (
    'onboarding',
    'Standard Onboarding',
    'A balanced onboarding journey that welcomes new hires and guides core setup tasks.',
    jsonb_build_object(
      'nodes', jsonb_build_array(
        jsonb_build_object('id','trigger_hire','type','trigger','label','When employee is hired','config', jsonb_build_object('event','employee.created')),
        jsonb_build_object('id','action_welcome_email','type','action','label','Send welcome email','config', jsonb_build_object('template','welcome_email_basic')),
        jsonb_build_object('id','action_collect_docs','type','action','label','Collect paperwork','config', jsonb_build_object('documents', jsonb_build_array('w4','direct_deposit_form'))),
        jsonb_build_object('id','delay_day2','type','delay','label','Wait 1 day','config', jsonb_build_object('duration', jsonb_build_object('value',1,'unit','day'))),
        jsonb_build_object('id','action_schedule_orientation','type','action','label','Schedule orientation','config', jsonb_build_object('eventType','orientation','durationMinutes',60))
      ),
      'edges', jsonb_build_array(
        jsonb_build_object('source','trigger_hire','target','action_welcome_email'),
        jsonb_build_object('source','action_welcome_email','target','action_collect_docs'),
        jsonb_build_object('source','action_collect_docs','target','delay_day2'),
        jsonb_build_object('source','delay_day2','target','action_schedule_orientation')
      ),
      'metadata', jsonb_build_object('version',1,'estimatedDurationDays',5)
    )
  ),
  (
    'onboarding',
    'Executive Onboarding',
    'Concierge-style onboarding with leadership introductions and accelerated tooling access.',
    jsonb_build_object(
      'nodes', jsonb_build_array(
        jsonb_build_object('id','trigger_exec_hire','type','trigger','label','When executive is hired','config', jsonb_build_object('event','employee.created','filters', jsonb_build_object('department','Executive'))),
        jsonb_build_object('id','action_preboarding_pack','type','action','label','Send pre-boarding package','config', jsonb_build_object('tasks', jsonb_build_array('complete_profile','upload_bio'))),
        jsonb_build_object('id','action_it_fast_track','type','action','label','Fast-track IT access','config', jsonb_build_object('priority','high')),
        jsonb_build_object('id','action_schedule_executive_rounds','type','action','label','Book leadership 1:1s','config', jsonb_build_object('meetings', jsonb_build_array('CEO','CFO','CHRO')))
      ),
      'edges', jsonb_build_array(
        jsonb_build_object('source','trigger_exec_hire','target','action_preboarding_pack'),
        jsonb_build_object('source','action_preboarding_pack','target','action_it_fast_track'),
        jsonb_build_object('source','action_it_fast_track','target','action_schedule_executive_rounds')
      ),
      'metadata', jsonb_build_object('version',1,'persona','executive')
    )
  ),
  (
    'offboarding',
    'Standard Offboarding',
    'Handles access removal, equipment collection, and farewell messaging for departing teammates.',
    jsonb_build_object(
      'nodes', jsonb_build_array(
        jsonb_build_object('id','trigger_last_day_set','type','trigger','label','When last day is scheduled','config', jsonb_build_object('event','employee.offboardingScheduled')),
        jsonb_build_object('id','action_notify_managers','type','action','label','Notify manager & HR','config', jsonb_build_object('channels', jsonb_build_array('email','slack'))),
        jsonb_build_object('id','action_reclaim_assets','type','action','label','Collect company assets','config', jsonb_build_object('assets', jsonb_build_array('laptop','badge','vpn_token'))),
        jsonb_build_object('id','action_disable_accounts','type','action','label','Disable accounts','config', jsonb_build_object('systems', jsonb_build_array('gsuite','slack','hris'))),
        jsonb_build_object('id','action_exit_interview','type','action','label','Schedule exit interview','config', jsonb_build_object('ownerRole','hr_manager'))
      ),
      'edges', jsonb_build_array(
        jsonb_build_object('source','trigger_last_day_set','target','action_notify_managers'),
        jsonb_build_object('source','action_notify_managers','target','action_reclaim_assets'),
        jsonb_build_object('source','action_reclaim_assets','target','action_disable_accounts'),
        jsonb_build_object('source','action_disable_accounts','target','action_exit_interview')
      ),
      'metadata', jsonb_build_object('version',1,'estimatedDurationDays',3)
  )
)
on conflict do nothing;

