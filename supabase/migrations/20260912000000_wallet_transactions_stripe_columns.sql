-- Add Stripe correlation columns to wallet_transactions and widen its type/status
-- constraints (if any) so chargeback/usage ledger rows aren't silently rejected.

alter table public.wallet_transactions
  add column if not exists stripe_payment_intent_id text;

alter table public.wallet_transactions
  add column if not exists amount_paid_cents integer;

create index if not exists wallet_transactions_stripe_payment_intent_id_idx
  on public.wallet_transactions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- Widen any existing CHECK constraints on `type`/`status` to also allow the values used by
-- handle_charge_dispute ('chargeback' / 'reversed') and deduct_platform_credits
-- ('usage' / 'completed'), instead of guessing at their current definition.
do $$
declare
  v_conname text;
  v_condef text;
begin
  for v_conname, v_condef in
    select conname, pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.wallet_transactions'::regclass
      and contype = 'c'
  loop
    if v_condef ilike '%type%' and v_condef not ilike '%chargeback%' then
      execute format('alter table public.wallet_transactions drop constraint %I', v_conname);
      execute format(
        'alter table public.wallet_transactions add constraint %I check (type in (%L, %L, %L, %L))',
        v_conname, 'purchase', 'redeem_code', 'chargeback', 'usage'
      );
    elsif v_condef ilike '%status%' and v_condef not ilike '%reversed%' then
      execute format('alter table public.wallet_transactions drop constraint %I', v_conname);
      execute format(
        'alter table public.wallet_transactions add constraint %I check (status in (%L, %L, %L, %L))',
        v_conname, 'pending', 'completed', 'failed', 'reversed'
      );
    end if;
  end loop;
end;
$$;

-- Re-create handle_charge_dispute to record the Stripe payment intent + disputed amount,
-- now that wallet_transactions has columns for them. Signature grew from 3 to 5 params,
-- so the old overload must be dropped explicitly or it would linger alongside this one.
drop function if exists public.handle_charge_dispute(uuid, integer, text);

create or replace function public.handle_charge_dispute(
  p_actor_id uuid,
  p_credits_amount integer,
  p_stripe_payment_intent_id text,
  p_amount_cents integer,
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

  insert into public.wallet_transactions
    (actor_id, amount, type, status, description, stripe_payment_intent_id, amount_paid_cents)
  values
    (p_actor_id, -p_credits_amount, 'chargeback', 'reversed', p_dispute_reason, p_stripe_payment_intent_id, p_amount_cents);
end;
$$;

-- Re-create deduct_platform_credits so usage ledger rows always persist now too.
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

  insert into public.wallet_transactions (actor_id, amount, type, status, description)
  values (p_actor_id, -p_amount, 'usage', 'completed', p_reason);

  return query select true, v_new_balance;
end;
$$;
