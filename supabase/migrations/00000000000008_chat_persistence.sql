-- Chat Persistence Migration
-- This migration creates tables for chat conversations and messages
-- Includes: conversations, messages with tenant isolation and RLS policies

-- ==============================================
-- 1. ENUMS
-- ==============================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'message_author_type') then
    create type message_author_type as enum ('user', 'assistant', 'tool');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'conversation_status') then
    create type conversation_status as enum ('open', 'closed', 'archived');
  end if;
end
$$;

-- ==============================================
-- 2. TABLES
-- ==============================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text,
  status conversation_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  author_type message_author_type not null,
  author_id uuid references auth.users(id) on delete set null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

-- ==============================================
-- 3. INDEXES
-- ==============================================

-- Index for finding latest conversation for a user in a tenant
create index if not exists conversations_tenant_user_created_idx
  on public.conversations (tenant_id, created_by, created_at desc);

-- Index for finding conversations by status
create index if not exists conversations_tenant_status_idx
  on public.conversations (tenant_id, status, created_at desc);

-- Index for ordering messages within a conversation
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

-- Index for tenant-scoped message queries
create index if not exists messages_tenant_created_idx
  on public.messages (tenant_id, created_at);

-- ==============================================
-- 4. TRIGGERS
-- ==============================================

create trigger set_updated_at_on_conversations
before update on public.conversations
for each row
execute function public.set_updated_at();

-- ==============================================
-- 5. ROW LEVEL SECURITY
-- ==============================================

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Conversations policies
-- Users can read conversations they created in their tenant
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

-- Users can create conversations in their tenant
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

-- Users can update conversations they created
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

-- Users can delete conversations they created
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
-- Users can read messages from conversations they created
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

-- Users can insert messages in conversations they created within their tenant
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

