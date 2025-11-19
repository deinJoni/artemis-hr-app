-- =============================================================================
-- Enable workflows feature by default for all tenants
-- -----------------------------------------------------------------------------
-- * flips the workflows feature slug to default_enabled = true
-- * removes redundant tenant overrides that were used during testing
--   so future behavior relies on the new default
-- =============================================================================

do $$
declare
  v_feature_id uuid;
begin
  select id
    into v_feature_id
  from public.features
  where slug = 'workflows'
  limit 1;

  if v_feature_id is null then
    raise notice 'workflows feature definition missing, skipping default enablement';
    return;
  end if;

  update public.features
     set default_enabled = true,
         updated_at = now()
   where id = v_feature_id;

  delete from public.tenant_feature_flags
   where feature_id = v_feature_id
     and enabled = true;
end
$$;


