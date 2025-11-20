-- Row Level Security & Policies
-- Extracted from the original base migration.

-- ==============================================
-- 22. ROW LEVEL SECURITY
-- ==============================================

-- Enable RLS on all tables
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.employees enable row level security;
alter table public.employee_custom_field_defs enable row level security;
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.departments enable row level security;
alter table public.office_locations enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.employee_documents enable row level security;
alter table public.document_expiry_notifications enable row level security;
alter table public.employee_audit_log enable row level security;
alter table public.employee_status_history enable row level security;
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
alter table public.time_entries enable row level security;
alter table public.overtime_balances enable row level security;
alter table public.overtime_rules enable row level security;
alter table public.overtime_requests enable row level security;
alter table public.time_entry_audit enable row level security;
alter table public.leave_types enable row level security;
alter table public.leave_balances enable row level security;
alter table public.holiday_calendars enable row level security;
alter table public.blackout_periods enable row level security;
alter table public.time_off_requests enable row level security;
alter table public.leave_request_audit enable row level security;
alter table public.equipment_items enable row level security;
alter table public.access_grants enable row level security;
alter table public.exit_interviews enable row level security;
alter table public.jobs enable row level security;
alter table public.job_postings enable row level security;
alter table public.candidates enable row level security;
alter table public.applications enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.interviews enable row level security;
alter table public.evaluations enable row level security;
alter table public.communications enable row level security;
alter table public.talent_pool enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Helper functions for RLS policies
create or replace function public.app_get_user_employee_id(p_tenant_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select e.id
  from public.employees e
  where e.tenant_id = p_tenant_id
    and e.user_id = public.app_current_user_id()
  limit 1
$$;

comment on function public.app_get_user_employee_id(uuid) is
  'Returns the employee.id that belongs to the current auth user inside the given tenant.';

grant execute on function public.app_get_user_employee_id(uuid) to authenticated;

create or replace function public.app_get_manager_employee_ids(p_tenant_id uuid)
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    array_agg(e.id order by e.id),
    '{}'
  )
  from public.employees e
  where e.tenant_id = p_tenant_id
    and e.manager_id = public.app_get_user_employee_id(p_tenant_id)
$$;

comment on function public.app_get_manager_employee_ids(uuid) is
  'Returns an array of employee ids that are directly managed by the current auth user inside the given tenant.';

grant execute on function public.app_get_manager_employee_ids(uuid) to authenticated;

create or replace function public.app_is_employee_manager(p_employee_id uuid, p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = p_employee_id
      and e.tenant_id = p_tenant_id
      and e.manager_id = public.app_get_user_employee_id(p_tenant_id)
  )
$$;

comment on function public.app_is_employee_manager(uuid, uuid) is
  'Returns true when the current auth user manages the specified employee inside the given tenant.';

grant execute on function public.app_is_employee_manager(uuid, uuid) to authenticated;

-- RLS Policies
-- Permission tables policies
create policy permissions_select_authenticated on public.permissions
for select to authenticated using (true);

create policy permissions_manage_service on public.permissions
for all to service_role using (true) with check (true);

create policy role_permissions_select_authenticated on public.role_permissions
for select to authenticated using (true);

create policy role_permissions_manage_service on public.role_permissions
for all to service_role using (true) with check (true);

-- Tenant policies
create policy tenants_select_own on public.tenants
for select to authenticated
using (
  exists (
    select 1 from public.memberships m
    where m.tenant_id = tenants.id
      and m.user_id = public.app_current_user_id()
  )
);

create policy tenants_update_admins on public.tenants
for update to authenticated
using (public.app_has_permission('members.manage', tenants.id))
with check (public.app_has_permission('members.manage', tenants.id));

-- Membership policies
create policy memberships_select_self on public.memberships
for select to authenticated
using (user_id = public.app_current_user_id());

create policy memberships_insert_by_admins on public.memberships
for insert to authenticated
with check (
  public.app_has_permission('members.manage', memberships.tenant_id)
  and (
    memberships.role <> 'owner'
    or exists (
      select 1
      from public.memberships owner
      where owner.tenant_id = memberships.tenant_id
        and owner.user_id = public.app_current_user_id()
        and owner.role = 'owner'
    )
  )
);

create policy memberships_update_by_admins on public.memberships
for update to authenticated
using (
  public.app_has_permission('members.manage', memberships.tenant_id)
  and (
    memberships.role <> 'owner'
    or exists (
      select 1
      from public.memberships owner
      where owner.tenant_id = memberships.tenant_id
        and owner.user_id = public.app_current_user_id()
        and owner.role = 'owner'
    )
  )
)
with check (
  public.app_has_permission('members.manage', memberships.tenant_id)
  and (
    memberships.role <> 'owner'
    or exists (
      select 1
      from public.memberships owner
      where owner.tenant_id = memberships.tenant_id
        and owner.user_id = public.app_current_user_id()
        and owner.role = 'owner'
    )
  )
);

create policy memberships_delete_by_admins on public.memberships
for delete to authenticated
using (
  public.app_has_permission('members.manage', memberships.tenant_id)
  and (
    memberships.role <> 'owner'
    or exists (
      select 1
      from public.memberships owner
      where owner.tenant_id = memberships.tenant_id
        and owner.user_id = public.app_current_user_id()
        and owner.role = 'owner'
    )
  )
);

-- Employee policies
create policy employees_read on public.employees
for select to authenticated
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = employees.tenant_id
      and m.role in ('owner', 'admin', 'people_ops')
  )
  or public.app_is_employee_manager(employees.id, employees.tenant_id)
  or employees.user_id = public.app_current_user_id()
);

create policy employees_write_insert on public.employees
for insert to authenticated
with check (public.app_has_permission('employees.write', employees.tenant_id));

create policy employees_write_update on public.employees
for update to authenticated
using (public.app_has_permission('employees.write', employees.tenant_id))
with check (public.app_has_permission('employees.write', employees.tenant_id));

create policy employees_write_delete on public.employees
for delete to authenticated
using (public.app_has_permission('employees.write', employees.tenant_id));

-- Employee custom field defs policies
create policy employee_field_defs_read on public.employee_custom_field_defs
for select to authenticated
using (public.app_has_permission('employees.read', employee_custom_field_defs.tenant_id));

create policy employee_field_defs_write_insert on public.employee_custom_field_defs
for insert to authenticated
with check (public.app_has_permission('employees.fields.manage', employee_custom_field_defs.tenant_id));

create policy employee_field_defs_write_update on public.employee_custom_field_defs
for update to authenticated
using (public.app_has_permission('employees.fields.manage', employee_custom_field_defs.tenant_id))
with check (public.app_has_permission('employees.fields.manage', employee_custom_field_defs.tenant_id));

create policy employee_field_defs_write_delete on public.employee_custom_field_defs
for delete to authenticated
using (public.app_has_permission('employees.fields.manage', employee_custom_field_defs.tenant_id));

-- Profile policies
create policy profiles_select_self on public.profiles
for select to authenticated
using (user_id = public.app_current_user_id());

create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (
  user_id = public.app_current_user_id()
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = profiles.tenant_id
  )
);

create policy profiles_update_self on public.profiles
for update to authenticated
using (
  user_id = public.app_current_user_id()
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = profiles.tenant_id
  )
)
with check (
  user_id = public.app_current_user_id()
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = profiles.tenant_id
  )
);

-- Department policies
create policy departments_read on public.departments
for select to authenticated
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = departments.tenant_id
      and m.role in ('owner', 'admin', 'people_ops')
  )
  or (
    exists (
      select 1
      from public.memberships m
      where m.user_id = public.app_current_user_id()
        and m.tenant_id = departments.tenant_id
        and m.role = 'manager'
    )
    and exists (
      select 1
      from public.employees e
      where e.tenant_id = departments.tenant_id
        and e.department_id = departments.id
        and e.manager_id = public.app_get_user_employee_id(departments.tenant_id)
    )
  )
);

create policy departments_manage on public.departments
for all to authenticated
using (public.app_has_permission('departments.manage', tenant_id))
with check (public.app_has_permission('departments.manage', tenant_id));

-- Office locations policies
create policy office_locations_read on public.office_locations
for select to authenticated
using (
  tenant_id in (
    select tenant_id from public.memberships
    where user_id = public.app_current_user_id()
  )
);

create policy office_locations_write on public.office_locations
for all to authenticated
using (
  tenant_id in (
    select tenant_id from public.memberships
    where user_id = public.app_current_user_id()
      and (role = 'owner' or role = 'admin')
  )
)
with check (
  tenant_id in (
    select tenant_id from public.memberships
    where user_id = public.app_current_user_id()
      and (role = 'owner' or role = 'admin')
  )
);

-- Teams policies
create policy teams_read on public.teams
for select to authenticated
using (
  tenant_id in (
    select tenant_id from public.memberships
    where user_id = public.app_current_user_id()
  )
);

create policy teams_write on public.teams
for all to authenticated
using (
  tenant_id in (
    select tenant_id from public.memberships
    where user_id = public.app_current_user_id()
      and (role = 'owner' or role = 'admin' or role = 'manager')
  )
)
with check (
  tenant_id in (
    select tenant_id from public.memberships
    where user_id = public.app_current_user_id()
      and (role = 'owner' or role = 'admin' or role = 'manager')
  )
);

create policy team_members_read on public.team_members
for select to authenticated
using (
  team_id in (
    select id from public.teams
    where tenant_id in (
      select tenant_id from public.memberships
      where user_id = public.app_current_user_id()
    )
  )
);

create policy team_members_write on public.team_members
for all to authenticated
using (
  team_id in (
    select id from public.teams
    where tenant_id in (
      select tenant_id from public.memberships
      where user_id = public.app_current_user_id()
        and (role = 'owner' or role = 'admin' or role = 'manager')
    )
  )
)
with check (
  team_id in (
    select id from public.teams
    where tenant_id in (
      select tenant_id from public.memberships
      where user_id = public.app_current_user_id()
        and (role = 'owner' or role = 'admin' or role = 'manager')
    )
  )
);

-- Employee documents policies
create policy employee_documents_read on public.employee_documents
for select to authenticated
using (public.app_has_permission('employees.documents.read', tenant_id));

create policy employee_documents_write_insert on public.employee_documents
for insert to authenticated
with check (public.app_has_permission('employees.documents.write', tenant_id));

create policy employee_documents_write_delete on public.employee_documents
for delete to authenticated
using (public.app_has_permission('employees.documents.write', tenant_id));

-- Document expiry notifications policies
create policy document_expiry_notifications_read on public.document_expiry_notifications
for select to authenticated
using (
  document_id in (
    select id from public.employee_documents
    where tenant_id in (
      select tenant_id from public.memberships
      where user_id = public.app_current_user_id()
    )
  )
);

create policy document_expiry_notifications_write on public.document_expiry_notifications
for insert to authenticated
with check (true);

-- Employee audit log policies
create policy employee_audit_log_read on public.employee_audit_log
for select to authenticated
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = employee_audit_log.tenant_id
      and m.role in ('owner', 'admin', 'people_ops')
  )
  or public.app_is_employee_manager(employee_audit_log.employee_id, employee_audit_log.tenant_id)
  or exists (
    select 1
    from public.employees e
    where e.id = employee_audit_log.employee_id
      and e.user_id = public.app_current_user_id()
  )
);

create policy employee_audit_log_insert on public.employee_audit_log
for insert
to authenticated
with check (
  public.app_has_permission('employees.write', tenant_id)
  or changed_by = (select auth.uid())
);

-- Employee status history policies
create policy employee_status_history_read on public.employee_status_history
for select to authenticated
using (
  exists (
    select 1 from public.employees e 
    where e.id = employee_status_history.employee_id 
    and public.app_has_permission('employees.read', e.tenant_id)
  )
);

create policy employee_status_history_write on public.employee_status_history
for all to authenticated
using (
  exists (
    select 1 from public.employees e 
    where e.id = employee_status_history.employee_id 
    and public.app_has_permission('employees.write', e.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.employees e 
    where e.id = employee_status_history.employee_id 
    and public.app_has_permission('employees.write', e.tenant_id)
  )
);

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

-- Time entries policies
create policy time_entries_select_self_or_tenant on public.time_entries
for select to authenticated
using (
  user_id = public.app_current_user_id()
  or public.app_has_permission('time.read', tenant_id)
);

create policy time_entries_insert_self on public.time_entries
for insert to authenticated
with check (
  user_id = public.app_current_user_id()
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = time_entries.tenant_id
  )
);

create policy time_entries_update_self_or_time_write on public.time_entries
for update to authenticated
using (
  (
    user_id = public.app_current_user_id()
    and exists (
      select 1
      from public.memberships m
      where m.user_id = public.app_current_user_id()
        and m.tenant_id = time_entries.tenant_id
    )
  )
  or public.app_has_permission('time.write', tenant_id)
)
with check (
  (
    user_id = public.app_current_user_id()
    and exists (
      select 1
      from public.memberships m
      where m.user_id = public.app_current_user_id()
        and m.tenant_id = time_entries.tenant_id
    )
  )
  or public.app_has_permission('time.write', tenant_id)
);

create policy time_entries_delete_time_write on public.time_entries
for delete to authenticated
using (public.app_has_permission('time.write', tenant_id));

-- Overtime balances policies
create policy overtime_balances_read on public.overtime_balances
for select to authenticated
using (
  public.app_has_permission('overtime.view', tenant_id)
  and (user_id = auth.uid() or public.app_has_permission('time.view_team', tenant_id))
);

create policy overtime_balances_manage on public.overtime_balances
for all to authenticated
using (public.app_has_permission('overtime.approve', tenant_id))
with check (public.app_has_permission('overtime.approve', tenant_id));

-- Overtime rules policies
create policy overtime_rules_read on public.overtime_rules
for select to authenticated
using (public.app_has_permission('overtime.view', tenant_id));

create policy overtime_rules_manage on public.overtime_rules
for all to authenticated
using (public.app_has_permission('overtime.approve', tenant_id))
with check (public.app_has_permission('overtime.approve', tenant_id));

-- Overtime requests policies
create policy overtime_requests_read_own on public.overtime_requests
for select to authenticated
using (user_id = auth.uid());

create policy overtime_requests_read_team on public.overtime_requests
for select to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.user_id = auth.uid()
    and e.tenant_id = overtime_requests.tenant_id
    and (
      public.app_has_permission('time.view_team', e.tenant_id)
      or exists (
        select 1 from public.employees ee
        where ee.manager_id = e.id
        and ee.user_id = overtime_requests.user_id
        and ee.tenant_id = overtime_requests.tenant_id
      )
    )
  )
);

create policy overtime_requests_create on public.overtime_requests
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
    and m.tenant_id = overtime_requests.tenant_id
  )
);

create policy overtime_requests_update on public.overtime_requests
for update to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.user_id = auth.uid()
    and e.tenant_id = overtime_requests.tenant_id
    and (
      public.app_has_permission('time.approve', e.tenant_id)
      or exists (
        select 1 from public.employees ee
        where ee.manager_id = e.id
        and ee.user_id = overtime_requests.user_id
        and ee.tenant_id = overtime_requests.tenant_id
      )
    )
  )
)
with check (
  exists (
    select 1 from public.employees e
    where e.user_id = auth.uid()
    and e.tenant_id = overtime_requests.tenant_id
    and (
      public.app_has_permission('time.approve', e.tenant_id)
      or exists (
        select 1 from public.employees ee
        where ee.manager_id = e.id
        and ee.user_id = overtime_requests.user_id
        and ee.tenant_id = overtime_requests.tenant_id
      )
    )
  )
);

create policy overtime_requests_cancel on public.overtime_requests
for update to authenticated
using (
  user_id = auth.uid()
  and status = 'pending'
)
with check (
  user_id = auth.uid()
  and status = 'cancelled'
);

-- Time entry audit policies
create policy time_entry_audit_read on public.time_entry_audit
for select to authenticated
using (
  exists (
    select 1 from public.time_entries te 
    where te.id = time_entry_audit.time_entry_id 
    and public.app_has_permission('time.view_team', te.tenant_id)
  )
);

-- Leave types policies
create policy leave_types_read on public.leave_types
for select to authenticated
using (public.app_has_permission('time.read', tenant_id));

create policy leave_types_manage on public.leave_types
for all to authenticated
using (public.app_has_permission('leave.manage_types', tenant_id))
with check (public.app_has_permission('leave.manage_types', tenant_id));

-- Leave balances policies
create policy leave_balances_read_own on public.leave_balances
for select to authenticated
using (
  exists (
    select 1 from public.employees e 
    where e.id = leave_balances.employee_id 
    and e.user_id = auth.uid()
    and e.tenant_id = leave_balances.tenant_id
  )
);

create policy leave_balances_read_team on public.leave_balances
for select to authenticated
using (
  public.app_has_permission('leave.view_team_calendar', tenant_id)
  and exists (
    select 1 from public.employees e 
    where e.id = leave_balances.employee_id 
    and (
      e.manager_id in (
        select id from public.employees where user_id = auth.uid()
      )
      or e.user_id = auth.uid()
    )
    and e.tenant_id = leave_balances.tenant_id
  )
);

create policy leave_balances_manage on public.leave_balances
for all to authenticated
using (public.app_has_permission('leave.manage_balances', tenant_id))
with check (public.app_has_permission('leave.manage_balances', tenant_id));

-- Holiday calendars policies
create policy holiday_calendars_read on public.holiday_calendars
for select to authenticated
using (public.app_has_permission('time.read', tenant_id));

create policy holiday_calendars_manage on public.holiday_calendars
for all to authenticated
using (public.app_has_permission('leave.manage_holidays', tenant_id))
with check (public.app_has_permission('leave.manage_holidays', tenant_id));

-- Blackout periods policies
create policy blackout_periods_read on public.blackout_periods
for select to authenticated
using (
  exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
    and m.tenant_id = blackout_periods.tenant_id
  )
);

create policy blackout_periods_manage on public.blackout_periods
for all to authenticated
using (
  exists (
    select 1 from public.memberships m
    join public.role_permissions rp on rp.role = m.role
    where m.user_id = auth.uid()
    and m.tenant_id = blackout_periods.tenant_id
    and rp.permission_key = 'leave.manage_holidays'
  )
)
with check (
  exists (
    select 1 from public.memberships m
    join public.role_permissions rp on rp.role = m.role
    where m.user_id = auth.uid()
    and m.tenant_id = blackout_periods.tenant_id
    and rp.permission_key = 'leave.manage_holidays'
  )
);

-- Time off requests policies (using corrected policy from migration 7)
create policy time_off_requests_select_self_or_tenant on public.time_off_requests
for select to authenticated
using (
  user_id = public.app_current_user_id()
  or public.app_has_permission('time.read', tenant_id)
);

create policy time_off_requests_insert_self on public.time_off_requests
for insert to authenticated
with check (
  user_id = public.app_current_user_id()
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = time_off_requests.tenant_id
  )
);

create policy time_off_requests_update_approvers on public.time_off_requests
for update to authenticated
using (public.app_has_permission('leave.approve_requests', tenant_id))
with check (public.app_has_permission('leave.approve_requests', tenant_id));

create policy time_off_requests_cancel_self on public.time_off_requests
for update to authenticated
using (
  user_id = public.app_current_user_id()
  and status = 'pending'
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = time_off_requests.tenant_id
  )
)
with check (
  user_id = public.app_current_user_id()
  and status in ('pending','cancelled')
  and approver_user_id is null
  and exists (
    select 1
    from public.memberships m
    where m.user_id = public.app_current_user_id()
      and m.tenant_id = time_off_requests.tenant_id
  )
);

-- Leave request audit policies
create policy leave_request_audit_read on public.leave_request_audit
for select to authenticated
using (
  public.app_has_permission('leave.approve_requests', tenant_id)
  or exists (
    select 1 from public.time_off_requests tor
    join public.employees e on tor.user_id = e.user_id
    where tor.id = leave_request_audit.request_id
    and e.user_id = auth.uid()
    and e.tenant_id = tor.tenant_id
  )
);

create policy leave_request_audit_insert on public.leave_request_audit
for insert to authenticated
with check (
  public.app_has_permission('leave.approve_requests', tenant_id)
  or exists (
    select 1 from public.time_off_requests tor
    join public.employees e on tor.user_id = e.user_id
    where tor.id = request_id
    and e.user_id = auth.uid()
    and e.tenant_id = tor.tenant_id
  )
);

-- Equipment items policies
create policy equipment_items_read on public.equipment_items
for select to authenticated
using (public.app_has_permission('employees.read', tenant_id));

create policy equipment_items_write on public.equipment_items
for all to authenticated
using (public.app_has_permission('employees.write', tenant_id))
with check (public.app_has_permission('employees.write', tenant_id));

-- Access grants policies
create policy access_grants_read on public.access_grants
for select to authenticated
using (public.app_has_permission('employees.read', tenant_id));

create policy access_grants_write on public.access_grants
for all to authenticated
using (public.app_has_permission('employees.write', tenant_id))
with check (public.app_has_permission('employees.write', tenant_id));

-- Exit interviews policies
create policy exit_interviews_read on public.exit_interviews
for select to authenticated
using (public.app_has_permission('employees.read', tenant_id));

create policy exit_interviews_write on public.exit_interviews
for all to authenticated
using (public.app_has_permission('employees.write', tenant_id))
with check (public.app_has_permission('employees.write', tenant_id));

create policy exit_interviews_insert_self on public.exit_interviews
for insert to authenticated
with check (
  exists (
    select 1
    from public.employees e
    where e.id = exit_interviews.employee_id
      and e.user_id = public.app_current_user_id()
      and e.tenant_id = exit_interviews.tenant_id
  )
);

-- Jobs policies
create policy jobs_read on public.jobs
for select to authenticated
using (public.app_has_permission('recruiting.jobs.read', tenant_id));

create policy jobs_write on public.jobs
for all to authenticated
using (public.app_has_permission('recruiting.jobs.write', tenant_id))
with check (public.app_has_permission('recruiting.jobs.write', tenant_id));

-- Job postings policies
create policy job_postings_read on public.job_postings
for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = job_postings.job_id
    and public.app_has_permission('recruiting.jobs.read', j.tenant_id)
  )
);

create policy job_postings_write on public.job_postings
for all to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = job_postings.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.jobs j
    where j.id = job_postings.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
);

-- Candidates policies
create policy candidates_read on public.candidates
for select to authenticated
using (public.app_has_permission('recruiting.candidates.read', tenant_id));

create policy candidates_write on public.candidates
for all to authenticated
using (public.app_has_permission('recruiting.candidates.write', tenant_id))
with check (public.app_has_permission('recruiting.candidates.write', tenant_id));

-- Applications policies
create policy applications_read on public.applications
for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = applications.job_id
    and public.app_has_permission('recruiting.jobs.read', j.tenant_id)
  )
);

create policy applications_write on public.applications
for all to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = applications.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.jobs j
    where j.id = applications.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
);

-- Pipeline stages policies
create policy pipeline_stages_read on public.pipeline_stages
for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = pipeline_stages.job_id
    and public.app_has_permission('recruiting.jobs.read', j.tenant_id)
  )
);

create policy pipeline_stages_write on public.pipeline_stages
for all to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = pipeline_stages.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.jobs j
    where j.id = pipeline_stages.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
);

-- Interviews policies
create policy interviews_read on public.interviews
for select to authenticated
using (
  exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = interviews.application_id
    and public.app_has_permission('recruiting.jobs.read', j.tenant_id)
  )
);

create policy interviews_write on public.interviews
for all to authenticated
using (
  exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = interviews.application_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = interviews.application_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
);

-- Evaluations policies
create policy evaluations_read on public.evaluations
for select to authenticated
using (
  exists (
    select 1 from public.interviews i
    join public.applications a on a.id = i.application_id
    join public.jobs j on j.id = a.job_id
    where i.id = evaluations.interview_id
    and public.app_has_permission('recruiting.jobs.read', j.tenant_id)
  )
);

create policy evaluations_write on public.evaluations
for all to authenticated
using (
  exists (
    select 1 from public.interviews i
    join public.applications a on a.id = i.application_id
    join public.jobs j on j.id = a.job_id
    where i.id = evaluations.interview_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.interviews i
    join public.applications a on a.id = i.application_id
    join public.jobs j on j.id = a.job_id
    where i.id = evaluations.interview_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
);

-- Communications policies
create policy communications_read on public.communications
for select to authenticated
using (public.app_has_permission('recruiting.jobs.read', tenant_id));

create policy communications_write on public.communications
for all to authenticated
using (public.app_has_permission('recruiting.jobs.write', tenant_id))
with check (public.app_has_permission('recruiting.jobs.write', tenant_id));

-- Talent pool policies
create policy talent_pool_read on public.talent_pool
for select to authenticated
using (public.app_has_permission('recruiting.candidates.read', tenant_id));

create policy talent_pool_write on public.talent_pool
for all to authenticated
using (public.app_has_permission('recruiting.candidates.write', tenant_id))
with check (public.app_has_permission('recruiting.candidates.write', tenant_id));

-- Conversations policies
create policy conversations_select_own on public.conversations
for select to authenticated
using (
  created_by = (select public.app_current_user_id())
  and exists (
    select 1
    from public.memberships m
    where m.user_id = (select public.app_current_user_id())
      and m.tenant_id = conversations.tenant_id
  )
);

create policy conversations_insert_own on public.conversations
for insert to authenticated
with check (
  created_by = (select public.app_current_user_id())
  and exists (
    select 1
    from public.memberships m
    where m.user_id = (select public.app_current_user_id())
      and m.tenant_id = conversations.tenant_id
  )
);

create policy conversations_update_own on public.conversations
for update to authenticated
using (
  created_by = (select public.app_current_user_id())
  and exists (
    select 1
    from public.memberships m
    where m.user_id = (select public.app_current_user_id())
      and m.tenant_id = conversations.tenant_id
  )
)
with check (
  created_by = (select public.app_current_user_id())
  and exists (
    select 1
    from public.memberships m
    where m.user_id = (select public.app_current_user_id())
      and m.tenant_id = conversations.tenant_id
  )
);

create policy conversations_delete_own on public.conversations
for delete to authenticated
using (
  created_by = (select public.app_current_user_id())
  and exists (
    select 1
    from public.memberships m
    where m.user_id = (select public.app_current_user_id())
      and m.tenant_id = conversations.tenant_id
  )
);

-- Messages policies
create policy messages_select_own_conversations on public.messages
for select to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.created_by = (select public.app_current_user_id())
      and exists (
        select 1
        from public.memberships m
        where m.user_id = (select public.app_current_user_id())
          and m.tenant_id = messages.tenant_id
      )
  )
);

create policy messages_insert_own_conversations on public.messages
for insert to authenticated
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.created_by = (select public.app_current_user_id())
      and exists (
        select 1
        from public.memberships m
        where m.user_id = (select public.app_current_user_id())
          and m.tenant_id = messages.tenant_id
      )
  )
);

-- ==============================================
-- 23. HELPER VIEWS
-- ==============================================

-- Employee summary view
create or replace view public.employee_summary as
select 
  e.id,
  e.tenant_id,
  e.employee_number,
  e.name,
  e.email,
  e.job_title,
  e.status,
  e.profile_completion_pct,
  e.created_at,
  e.updated_at,
  d.name as department_name,
  d.id as department_id,
  m.name as manager_name,
  m.id as manager_id
from public.employees e
left join public.departments d on e.department_id = d.id
left join public.employees m on e.manager_id = m.id;

-- Department hierarchy view
create or replace view public.department_hierarchy as
with recursive dept_tree as (
  select
    d.id,
    d.tenant_id,
    d.name,
    d.description,
    d.parent_id,
    d.head_employee_id,
    d.cost_center,
    d.office_location_id,
    0 as level,
    array[d.id] as path,
    d.name as full_path
  from public.departments d
  where d.parent_id is null

  union all

  select
    d.id,
    d.tenant_id,
    d.name,
    d.description,
    d.parent_id,
    d.head_employee_id,
    d.cost_center,
    d.office_location_id,
    dt.level + 1,
    dt.path || d.id,
    dt.full_path || ' > ' || d.name
  from public.departments d
  join dept_tree dt on d.parent_id = dt.id
)
select
  dt.*,
  e.name as head_name,
  e.email as head_email,
  (select count(*) from public.employees where department_id = dt.id) as employee_count,
  ol.name as office_location_name,
  ol.timezone as office_location_timezone
from dept_tree dt
left join public.employees e on dt.head_employee_id = e.id
left join public.office_locations ol on dt.office_location_id = ol.id
order by dt.tenant_id, dt.level, dt.name;

-- Org structure view
create or replace view public.org_structure_view as
select
  e.id as employee_id,
  e.tenant_id,
  e.name as employee_name,
  e.email,
  e.job_title,
  e.employee_number,
  e.status,
  e.manager_id,
  e.dotted_line_manager_id,
  e.department_id,
  e.office_location_id,
  m.id as manager_employee_id,
  m.name as manager_name,
  m.email as manager_email,
  m.job_title as manager_job_title,
  dlm.id as dotted_line_manager_employee_id,
  dlm.name as dotted_line_manager_name,
  dlm.email as dotted_line_manager_email,
  dlm.job_title as dotted_line_manager_job_title,
  d.id as department_id_full,
  d.name as department_name,
  d.parent_id as department_parent_id,
  d.head_employee_id as department_head_id,
  d.cost_center,
  d.office_location_id as department_location_id,
  ol.id as location_id,
  ol.name as location_name,
  ol.timezone as location_timezone,
  ol.address as location_address,
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'description', t.description,
        'team_lead_id', t.team_lead_id
      )
    )
    from public.teams t
    inner join public.team_members tm on tm.team_id = t.id
    where tm.employee_id = e.id
  ) as teams
from public.employees e
left join public.employees m on e.manager_id = m.id
left join public.employees dlm on e.dotted_line_manager_id = dlm.id
left join public.departments d on e.department_id = d.id
left join public.office_locations ol on e.office_location_id = ol.id
where e.status = 'active';

comment on view public.org_structure_view is
  'Comprehensive view of organizational structure combining employees, managers, departments, locations, and teams';

grant select on public.org_structure_view to authenticated;
