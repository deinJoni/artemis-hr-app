-- =============================================================================
-- ensure workflows feature flag enabled once infrastructure exists
-- -----------------------------------------------------------------------------
-- * runs after feature flag tables + seed are available (20251118120000)
-- * idempotently enables workflows for every tenant for testing
-- =============================================================================

do $$
declare
  v_flags_ready boolean;
  v_feature_ready boolean;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'tenant_feature_flags'
  ) into v_flags_ready;

  if not v_flags_ready then
    raise notice 'tenant_feature_flags missing, skipping workflows enablement';
    return;
  end if;

  select exists (
    select 1
    from public.features
    where slug = 'workflows'
  ) into v_feature_ready;

  if not v_feature_ready then
    raise notice 'workflows feature definition missing, skipping workflows enablement';
    return;
  end if;

  insert into public.tenant_feature_flags (tenant_id, feature_id, enabled, reason)
  select 
    t.id as tenant_id,
    f.id as feature_id,
    true as enabled,
    'Enabled for testing (post-feature-flag backfill)' as reason
  from public.tenants t
  cross join public.features f
  where f.slug = 'workflows'
  on conflict (tenant_id, feature_id) 
  do update set 
    enabled = true,
    reason = 'Enabled for testing (post-feature-flag backfill)',
    updated_at = now();
end
$$;


