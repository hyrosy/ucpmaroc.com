create table if not exists public.store_ai_bot_events (
  message_id text primary key,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed')),
  updated_at timestamptz not null default now()
);

create or replace function public.notify_store_ai_bot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_url text;
  webhook_secret text;
  payload jsonb;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'supabase_url' limit 1;
  select decrypted_secret into webhook_secret from vault.decrypted_secrets where name = 'store_ai_bot_webhook_secret' limit 1;

  if project_url is null or webhook_secret is null then
    raise warning 'Store AI bot webhook secrets are not configured';
    return new;
  end if;

  insert into public.store_ai_bot_events (message_id)
  values (new.id::text)
  on conflict (message_id) do nothing;

  payload := jsonb_build_object('type', 'INSERT', 'table', 'store_messages', 'schema', 'public', 'record', row_to_json(new), 'old_record', null);
  perform net.http_post(
    url := project_url || '/functions/v1/store-ai-bot',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-store-webhook-signature', 'sha256=' || encode(hmac(convert_to(payload::text, 'utf8'), convert_to(webhook_secret, 'utf8'), 'sha256'), 'hex')),
    body := payload
  );
  return new;
end;
$$;

drop trigger if exists store_messages_ai_bot_webhook on public.store_messages;
create trigger store_messages_ai_bot_webhook
after insert on public.store_messages
for each row when (new.sender_type = 'visitor')
execute function public.notify_store_ai_bot();