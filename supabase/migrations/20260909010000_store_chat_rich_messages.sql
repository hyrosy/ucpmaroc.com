alter table public.store_messages
  add column if not exists message_type text not null default 'text' check (message_type in ('text', 'product_recommendation', 'lead_form')),
  add column if not exists metadata jsonb;
