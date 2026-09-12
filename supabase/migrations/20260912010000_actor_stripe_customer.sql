-- Link each actor to a Stripe Customer object so the platform can store payment methods
-- (cards) for billing purposes, independent of any per-order Stripe Connect customer ids.
alter table public.actors add column if not exists stripe_customer_id text;

create index if not exists actors_stripe_customer_id_idx
  on public.actors (stripe_customer_id)
  where stripe_customer_id is not null;
