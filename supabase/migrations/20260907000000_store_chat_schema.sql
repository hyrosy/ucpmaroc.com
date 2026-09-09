create table if not exists public.store_conversations (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  visitor_session_id text not null,
  customer_id uuid references public.pro_customers(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'agent_requested', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.store_conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('visitor', 'owner', 'ai_bot')),
  content text not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists store_conversations_portfolio_visitor_idx
  on public.store_conversations (portfolio_id, visitor_session_id);
create index if not exists store_conversations_updated_at_idx
  on public.store_conversations (updated_at desc);
create index if not exists store_messages_conversation_created_at_idx
  on public.store_messages (conversation_id, created_at);

alter table public.store_conversations enable row level security;
alter table public.store_messages enable row level security;

drop policy if exists "Storefront visitors can create conversations" on public.store_conversations;
create policy "Storefront visitors can create conversations"
  on public.store_conversations for insert
  to anon, authenticated
  with check (status = 'open');

drop policy if exists "Storefront visitors can read conversations" on public.store_conversations;
create policy "Storefront visitors can read conversations"
  on public.store_conversations for select
  to anon, authenticated
  using (
    visitor_session_id = coalesce(current_setting('request.headers', true)::json ->> 'x-visitor-session-id', '')
    or exists (
      select 1 from public.portfolios
      join public.actors on actors.id = portfolios.actor_id
      where portfolios.id = store_conversations.portfolio_id
        and actors.user_id = auth.uid()
    )
  );

drop policy if exists "Store owners can update conversations" on public.store_conversations;
create policy "Store owners can update conversations"
  on public.store_conversations for update
  to authenticated
  using (exists (
    select 1 from public.portfolios
    join public.actors on actors.id = portfolios.actor_id
    where portfolios.id = store_conversations.portfolio_id
      and actors.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.portfolios
    join public.actors on actors.id = portfolios.actor_id
    where portfolios.id = store_conversations.portfolio_id
      and actors.user_id = auth.uid()
  ));

drop policy if exists "Storefront visitors can create messages" on public.store_messages;
create policy "Storefront visitors can create messages"
  on public.store_messages for insert
  to anon, authenticated
  with check (sender_type = 'visitor' and exists (
    select 1 from public.store_conversations
    where store_conversations.id = store_messages.conversation_id
      and store_conversations.visitor_session_id = coalesce(current_setting('request.headers', true)::json ->> 'x-visitor-session-id', '')
      and store_conversations.status <> 'closed'
  ));

drop policy if exists "Storefront visitors can read messages" on public.store_messages;
create policy "Storefront visitors can read messages"
  on public.store_messages for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.store_conversations
      where store_conversations.id = store_messages.conversation_id
        and store_conversations.visitor_session_id = coalesce(current_setting('request.headers', true)::json ->> 'x-visitor-session-id', '')
    )
    or exists (
      select 1
      from public.store_conversations
      join public.portfolios on portfolios.id = store_conversations.portfolio_id
      join public.actors on actors.id = portfolios.actor_id
      where store_conversations.id = store_messages.conversation_id
        and actors.user_id = auth.uid()
    )
  );

drop policy if exists "Store owners can create messages" on public.store_messages;
create policy "Store owners can create messages"
  on public.store_messages for insert
  to authenticated
  with check (sender_type = 'owner' and exists (
    select 1
    from public.store_conversations
    join public.portfolios on portfolios.id = store_conversations.portfolio_id
    join public.actors on actors.id = portfolios.actor_id
    where store_conversations.id = store_messages.conversation_id
      and actors.user_id = auth.uid()
  ));

grant select, insert on public.store_conversations to anon, authenticated;
grant update on public.store_conversations to authenticated;
grant select, insert on public.store_messages to anon, authenticated;