-- Billing hardening: webhook idempotency (with TTL cleanup), chargeback handling,
-- and a safe atomic deduction RPC for future usage-based Platform Credit spend.

-- 1. Idempotency ledger for Stripe webhook events -----------------------------------------
create table if not exists public.processed_stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create index if not exists processed_stripe_events_processed_at_idx
  on public.processed_stripe_events (processed_at);

-- Stripe only retries webhooks for a few days, so we don't need to keep these rows forever.
create or replace function public.cleanup_processed_stripe_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.processed_stripe_events
  where processed_at < now() - interval '30 days';
$$;

-- Schedule the cleanup daily via pg_cron (available on Supabase by default).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'cleanup_processed_stripe_events';
    perform cron.schedule(
      'cleanup_processed_stripe_events',
      '0 3 * * *',
      $cron$select public.cleanup_processed_stripe_events();$cron$
    );
  end if;
end;
$$;

-- 2. Chargeback / dispute handling ----------------------------------------------------------
-- wallet_transactions only has: id, created_at, actor_id, amount, type, status, description
-- (no stripe_payment_intent_id column), so the disputed payment's actor/amount must be
-- resolved by the caller from Stripe's own PaymentIntent metadata, not looked up here.
alter table public.actors add column if not exists is_suspended boolean not null default false;
alter table public.actors add column if not exists suspended_reason text;

create or replace function public.handle_charge_dispute(
  p_actor_id uuid,
  p_credits_amount integer,
  p_dispute_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.actors
  set wallet_balance = coalesce(wallet_balance, 0) - p_credits_amount,
      is_suspended = true,
      suspended_reason = p_dispute_reason
  where id = p_actor_id;

  -- Ledger insert is best-effort: don't let an unexpected constraint on type/status
  -- roll back the balance debit and suspension above.
  begin
    insert into public.wallet_transactions (actor_id, amount, type, status, description)
    values (p_actor_id, -p_credits_amount, 'chargeback', 'reversed', p_dispute_reason);
  exception when others then
    raise warning 'handle_charge_dispute: could not write ledger row for actor %: %', p_actor_id, sqlerrm;
  end;
end;
$$;

-- 3. Atomic, race-safe Platform Credit deduction (for future Bot+ / usage-based spend) -----
-- Single UPDATE ... WHERE balance >= amount is atomic under Postgres's row-level locking,
-- so two concurrent requests can never both succeed in overdrawing the same account.
create or replace function public.deduct_platform_credits(
  p_actor_id uuid,
  p_amount integer,
  p_reason text
)
returns table (success boolean, remaining_balance integer) 
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  update public.actors
  set wallet_balance = wallet_balance - p_amount
  where id = p_actor_id
    and coalesce(wallet_balance, 0) >= p_amount
    and coalesce(is_suspended, false) = false
  returning wallet_balance into v_new_balance;

  if v_new_balance is null then
    return query select false, coalesce((select wallet_balance from public.actors where id = p_actor_id), 0);
    return;
  end if;

  begin
    insert into public.wallet_transactions (actor_id, amount, type, status, description)
    values (p_actor_id, -p_amount, 'usage', 'completed', p_reason);
  exception when others then
    raise warning 'deduct_platform_credits: could not write ledger row for actor %: %', p_actor_id, sqlerrm;
  end;

  return query select true, v_new_balance;
end;
$$;
