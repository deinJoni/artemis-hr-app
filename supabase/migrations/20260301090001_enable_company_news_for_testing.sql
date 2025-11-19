-- Enable company_news feature for all tenants (for testing purposes)
-- This allows company news to be used without requiring superadmin access
-- Same pattern as workflows feature enablement

do $$
declare
  v_table_exists boolean;
  v_feature_exists boolean;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'tenant_feature_flags'
  ) into v_table_exists;

  if not v_table_exists then
    raise notice 'tenant_feature_flags not yet available – skipping company_news enablement seed';
    return;
  end if;

  select exists (
    select 1
    from public.features
    where slug = 'company_news'
  ) into v_feature_exists;

  if not v_feature_exists then
    raise notice 'company_news feature definition missing, skipping company_news enablement';
    return;
  end if;

  insert into public.tenant_feature_flags (tenant_id, feature_id, enabled, reason)
  select 
    t.id as tenant_id,
    f.id as feature_id,
    true as enabled,
    'Enabled for testing' as reason
  from public.tenants t
  cross join public.features f
  where f.slug = 'company_news'
  on conflict (tenant_id, feature_id) 
  do update set 
    enabled = true,
    reason = 'Enabled for testing',
    updated_at = now();
end
$$;

