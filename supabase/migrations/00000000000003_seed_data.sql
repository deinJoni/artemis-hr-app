-- Consolidated Seed Data Migration
-- This migration inserts initial seed data: permissions, role_permissions, workflow_templates, leave types, and overtime rules

-- ==============================================
-- 1. PERMISSIONS SEED DATA
-- ==============================================

insert into public.permissions (key) values
  ('members.manage'),
  ('employees.read'),
  ('employees.write'),
  ('employees.fields.manage'),
  ('employees.documents.read'),
  ('employees.documents.write'),
  ('employees.audit.read'),
  ('employees.compensation.read'),
  ('employees.compensation.write'),
  ('employees.sensitive.read'),
  ('employees.sensitive.write'),
  ('employees.import'),
  ('departments.manage'),
  ('departments.read'),
  ('office_locations.read'),
  ('office_locations.write'),
  ('teams.read'),
  ('teams.write'),
  ('workflows.read'),
  ('workflows.manage'),
  ('workflows.run.manage'),
  ('workflows.template.use'),
  ('goals.read'),
  ('goals.write'),
  ('check_ins.read'),
  ('check_ins.write'),
  ('time.read'),
  ('time.write'),
  ('time.approve'),
  ('time.edit_past'),
  ('time.view_team'),
  ('time_off.approve'),
  ('overtime.view'),
  ('overtime.approve'),
  ('calendar.read'),
  ('leave.manage_types'),
  ('leave.manage_balances'),
  ('leave.manage_holidays'),
  ('leave.view_team_calendar'),
  ('leave.approve_requests'),
  ('recruiting.jobs.read'),
  ('recruiting.jobs.write'),
  ('recruiting.candidates.read'),
  ('recruiting.candidates.write')
on conflict do nothing;

-- ==============================================
-- 2. ROLE PERMISSIONS SEED DATA
-- ==============================================

insert into public.role_permissions (role, permission_key) values
  -- Owner: all permissions
  ('owner', 'members.manage'),
  ('owner', 'employees.read'),
  ('owner', 'employees.write'),
  ('owner', 'employees.fields.manage'),
  ('owner', 'employees.documents.read'),
  ('owner', 'employees.documents.write'),
  ('owner', 'employees.audit.read'),
  ('owner', 'employees.compensation.read'),
  ('owner', 'employees.compensation.write'),
  ('owner', 'employees.sensitive.read'),
  ('owner', 'employees.sensitive.write'),
  ('owner', 'employees.import'),
  ('owner', 'departments.manage'),
  ('owner', 'departments.read'),
  ('owner', 'office_locations.read'),
  ('owner', 'office_locations.write'),
  ('owner', 'teams.read'),
  ('owner', 'teams.write'),
  ('owner', 'workflows.read'),
  ('owner', 'workflows.manage'),
  ('owner', 'workflows.run.manage'),
  ('owner', 'workflows.template.use'),
  ('owner', 'goals.read'),
  ('owner', 'goals.write'),
  ('owner', 'check_ins.read'),
  ('owner', 'check_ins.write'),
  ('owner', 'time.read'),
  ('owner', 'time.write'),
  ('owner', 'time.approve'),
  ('owner', 'time.edit_past'),
  ('owner', 'time.view_team'),
  ('owner', 'time_off.approve'),
  ('owner', 'overtime.view'),
  ('owner', 'overtime.approve'),
  ('owner', 'calendar.read'),
  ('owner', 'leave.manage_types'),
  ('owner', 'leave.manage_balances'),
  ('owner', 'leave.manage_holidays'),
  ('owner', 'leave.view_team_calendar'),
  ('owner', 'leave.approve_requests'),
  ('owner', 'recruiting.jobs.read'),
  ('owner', 'recruiting.jobs.write'),
  ('owner', 'recruiting.candidates.read'),
  ('owner', 'recruiting.candidates.write'),
  
  -- Admin: all permissions
  ('admin', 'members.manage'),
  ('admin', 'employees.read'),
  ('admin', 'employees.write'),
  ('admin', 'employees.fields.manage'),
  ('admin', 'employees.documents.read'),
  ('admin', 'employees.documents.write'),
  ('admin', 'employees.audit.read'),
  ('admin', 'employees.compensation.read'),
  ('admin', 'employees.compensation.write'),
  ('admin', 'employees.sensitive.read'),
  ('admin', 'employees.sensitive.write'),
  ('admin', 'employees.import'),
  ('admin', 'departments.manage'),
  ('admin', 'departments.read'),
  ('admin', 'office_locations.read'),
  ('admin', 'office_locations.write'),
  ('admin', 'teams.read'),
  ('admin', 'teams.write'),
  ('admin', 'workflows.read'),
  ('admin', 'workflows.manage'),
  ('admin', 'workflows.run.manage'),
  ('admin', 'workflows.template.use'),
  ('admin', 'goals.read'),
  ('admin', 'goals.write'),
  ('admin', 'check_ins.read'),
  ('admin', 'check_ins.write'),
  ('admin', 'time.read'),
  ('admin', 'time.write'),
  ('admin', 'time.approve'),
  ('admin', 'time.edit_past'),
  ('admin', 'time.view_team'),
  ('admin', 'time_off.approve'),
  ('admin', 'overtime.view'),
  ('admin', 'overtime.approve'),
  ('admin', 'calendar.read'),
  ('admin', 'leave.manage_types'),
  ('admin', 'leave.manage_balances'),
  ('admin', 'leave.manage_holidays'),
  ('admin', 'leave.view_team_calendar'),
  ('admin', 'leave.approve_requests'),
  ('admin', 'recruiting.jobs.read'),
  ('admin', 'recruiting.jobs.write'),
  ('admin', 'recruiting.candidates.read'),
  ('admin', 'recruiting.candidates.write'),
  
  -- People Ops: most permissions except compensation write
  ('people_ops', 'employees.read'),
  ('people_ops', 'employees.write'),
  ('people_ops', 'employees.documents.read'),
  ('people_ops', 'employees.documents.write'),
  ('people_ops', 'employees.fields.manage'),
  ('people_ops', 'employees.audit.read'),
  ('people_ops', 'employees.compensation.read'),
  ('people_ops', 'employees.sensitive.read'),
  ('people_ops', 'employees.import'),
  ('people_ops', 'departments.manage'),
  ('people_ops', 'departments.read'),
  ('people_ops', 'office_locations.read'),
  ('people_ops', 'office_locations.write'),
  ('people_ops', 'teams.read'),
  ('people_ops', 'teams.write'),
  ('people_ops', 'workflows.read'),
  ('people_ops', 'goals.read'),
  ('people_ops', 'goals.write'),
  ('people_ops', 'check_ins.read'),
  ('people_ops', 'calendar.read'),
  ('people_ops', 'time.approve'),
  ('people_ops', 'time.edit_past'),
  ('people_ops', 'time.view_team'),
  ('people_ops', 'overtime.view'),
  ('people_ops', 'overtime.approve'),
  ('people_ops', 'leave.manage_types'),
  ('people_ops', 'leave.manage_balances'),
  ('people_ops', 'leave.manage_holidays'),
  ('people_ops', 'leave.view_team_calendar'),
  ('people_ops', 'leave.approve_requests'),
  ('people_ops', 'recruiting.jobs.read'),
  ('people_ops', 'recruiting.jobs.write'),
  ('people_ops', 'recruiting.candidates.read'),
  ('people_ops', 'recruiting.candidates.write'),
  
  -- Manager: limited permissions
  ('manager', 'employees.read'),
  ('manager', 'employees.write'),
  ('manager', 'employees.audit.read'),
  ('manager', 'departments.read'),
  ('manager', 'office_locations.read'),
  ('manager', 'teams.read'),
  ('manager', 'teams.write'),
  ('manager', 'workflows.read'),
  ('manager', 'workflows.run.manage'),
  ('manager', 'workflows.template.use'),
  ('manager', 'goals.read'),
  ('manager', 'goals.write'),
  ('manager', 'check_ins.read'),
  ('manager', 'check_ins.write'),
  ('manager', 'time.read'),
  ('manager', 'time.write'),
  ('manager', 'time.approve'),
  ('manager', 'time.view_team'),
  ('manager', 'time_off.approve'),
  ('manager', 'overtime.view'),
  ('manager', 'calendar.read'),
  ('manager', 'leave.view_team_calendar'),
  ('manager', 'leave.approve_requests'),
  
  -- Employee: basic permissions
  ('employee', 'employees.read'),
  ('employee', 'workflows.read'),
  ('employee', 'office_locations.read'),
  ('employee', 'teams.read'),
  ('employee', 'overtime.view')
on conflict do nothing;

-- ==============================================
-- 3. WORKFLOW TEMPLATES SEED DATA
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

-- ==============================================
-- 4. LEAVE TYPES SEED DATA (per tenant)
-- ==============================================

insert into public.leave_types (tenant_id, name, code, requires_approval, requires_certificate, allow_negative_balance, color)
select 
  t.id as tenant_id,
  'Vacation' as name,
  'VACATION' as code,
  true as requires_approval,
  false as requires_certificate,
  false as allow_negative_balance,
  '#3B82F6' as color
from public.tenants t
where not exists (
  select 1 from public.leave_types lt where lt.tenant_id = t.id and lt.code = 'VACATION'
);

insert into public.leave_types (tenant_id, name, code, requires_approval, requires_certificate, allow_negative_balance, color)
select 
  t.id as tenant_id,
  'Sick Leave' as name,
  'SICK' as code,
  false as requires_approval,
  true as requires_certificate,
  true as allow_negative_balance,
  '#EF4444' as color
from public.tenants t
where not exists (
  select 1 from public.leave_types lt where lt.tenant_id = t.id and lt.code = 'SICK'
);

insert into public.leave_types (tenant_id, name, code, requires_approval, requires_certificate, allow_negative_balance, color)
select 
  t.id as tenant_id,
  'Personal Leave' as name,
  'PERSONAL' as code,
  true as requires_approval,
  false as requires_certificate,
  false as allow_negative_balance,
  '#10B981' as color
from public.tenants t
where not exists (
  select 1 from public.leave_types lt where lt.tenant_id = t.id and lt.code = 'PERSONAL'
);

-- ==============================================
-- 5. OVERTIME RULES SEED DATA (per tenant)
-- ==============================================

insert into public.overtime_rules (tenant_id, name, is_default)
select 
  t.id as tenant_id,
  'Default Overtime Rules' as name,
  true as is_default
from public.tenants t
where not exists (
  select 1 from public.overtime_rules otr where otr.tenant_id = t.id and otr.is_default = true
);


