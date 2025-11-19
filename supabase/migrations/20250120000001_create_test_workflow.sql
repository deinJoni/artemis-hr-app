-- Create a test workflow from the Standard Onboarding template for testing
-- This creates a published workflow that will automatically trigger when employees are created

do $$
declare
  v_tenant_id uuid;
  v_template_id uuid;
  v_workflow_id uuid;
  v_version_id uuid;
  v_user_id uuid;
begin
  -- Get the first tenant (for testing)
  select id into v_tenant_id from public.tenants limit 1;
  
  -- Get the Standard Onboarding template
  select id into v_template_id 
  from public.workflow_templates 
  where name = 'Standard Onboarding' 
  limit 1;
  
  -- Get a user to set as creator
  select id into v_user_id from auth.users limit 1;
  
  if v_tenant_id is null or v_template_id is null or v_user_id is null then
    raise notice 'Missing required data: tenant_id=%, template_id=%, user_id=%', v_tenant_id, v_template_id, v_user_id;
    return;
  end if;
  
  -- Create workflow
  insert into public.workflows (tenant_id, name, slug, kind, status, created_by, updated_by)
  values (
    v_tenant_id,
    'Standard Onboarding',
    'standard-onboarding',
    'onboarding',
    'published',
    v_user_id,
    v_user_id
  )
  returning id into v_workflow_id;
  
  -- Create workflow version from template
  insert into public.workflow_versions (
    workflow_id,
    version_number,
    is_active,
    definition,
    created_by,
    published_at
  )
  select
    v_workflow_id,
    1,
    true,
    blocks,
    v_user_id,
    now()
  from public.workflow_templates
  where id = v_template_id
  returning id into v_version_id;
  
  -- Update workflow with active version
  update public.workflows
  set active_version_id = v_version_id
  where id = v_workflow_id;
  
  raise notice 'Created workflow % with version % for tenant %', v_workflow_id, v_version_id, v_tenant_id;
end $$;

