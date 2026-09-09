-- Requires pg_net and Vault secrets configured in the Supabase project:
-- supabase_url: the project URL
-- store_ai_bot_webhook_secret: the value of STORE_AI_BOT_WEBHOOK_SECRET
create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto;

create or replace function public.notify_store_ai_bot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_url text;
  webhook_secret text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'supabase_url' limit 1;
  select decrypted_secret into webhook_secret from vault.decrypted_secrets where name = 'store_ai_bot_webhook_secret' limit 1;

  if project_url is null or webhook_secret is null then
    raise warning 'Store AI bot webhook secrets are not configured';
    return new;
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/store-ai-bot',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-store-webhook-signature', 'sha256=' || encode(hmac(convert_to(jsonb_build_object('type', 'INSERT', 'table', 'store_messages', 'schema', 'public', 'record', row_to_json(new), 'old_record', null)::text, 'utf8'), convert_to(webhook_secret, 'utf8'), 'sha256'), 'hex')),
    body := jsonb_build_object('type', 'INSERT', 'table', 'store_messages', 'schema', 'public', 'record', row_to_json(new), 'old_record', null)
  );
  return new;
end;
$$;

drop trigger if exists store_messages_ai_bot_webhook on public.store_messages;
create trigger store_messages_ai_bot_webhook
after insert on public.store_messages
for each row execute function public.notify_store_ai_bot();