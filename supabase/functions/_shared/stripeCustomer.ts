// Shared helper: resolve an actor's Stripe Customer, creating one if it doesn't exist yet.
// Used by any function that needs to attach a payment method, checkout session, or
// billing portal session to a specific actor's Stripe identity.
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

export async function getOrCreateStripeCustomer(
  supabase: any,
  stripe: Stripe,
  actorId: string
): Promise<string> {
  const { data: actor, error } = await supabase
    .from("actors")
    .select("id, stripe_customer_id, ActorName, ActorEmail")
    .eq("id", actorId)
    .single();

  if (error) throw error;
  if (actor?.stripe_customer_id) return actor.stripe_customer_id;

  const customer = await stripe.customers.create({
    name: actor?.ActorName ?? undefined,
    email: actor?.ActorEmail ?? undefined,
    metadata: { actor_id: actorId },
  });

  const { error: updateError } = await supabase
    .from("actors")
    .update({ stripe_customer_id: customer.id })
    .eq("id", actorId);
  if (updateError) throw updateError;

  return customer.id;
}
