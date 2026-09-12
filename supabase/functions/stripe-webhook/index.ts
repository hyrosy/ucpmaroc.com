import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (request) => {
  const signature = request.headers.get("Stripe-Signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return new Response("Webhook secret or signature missing", { status: 400 });
  }

  try {
    const body = await request.text();
    // Verify the event actually came from Stripe
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Idempotency: Stripe can redeliver the same event after a network retry.
    // Record the event id first; if it already exists, this event was already handled.
    const { error: dedupeError } = await supabase
      .from("processed_stripe_events")
      .insert({ event_id: event.id, event_type: event.type });
    if (dedupeError) {
      if (dedupeError.code === "23505") {
        return new Response(JSON.stringify({ received: true, deduped: true }), { status: 200 });
      }
      throw dedupeError;
    }

    // We only care about successful embedded payments
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const metadata = paymentIntent.metadata;

      // Is this a Platform Credits top-up?
      if (metadata && metadata.type === "top_up") {
        const actorId = metadata.actor_id;
        const coinsAmount = parseInt(metadata.coins_amount);

        // Call our secure SQL function to add the credits!
        const { error } = await supabase.rpc("process_stripe_topup", {
          p_actor_id: actorId,
          p_coins_amount: coinsAmount,
          p_amount_paid_cents: paymentIntent.amount,
          p_stripe_payment_intent_id: paymentIntent.id,
        });

        if (error) throw error;
      }
    }

    // A cardholder disputed a charge after credits were already granted from it.
    // Reverse the credited amount and suspend the account until it's settled.
    if (event.type === "charge.dispute.created") {
      const dispute = event.data.object as any;
      const paymentIntent = await stripe.paymentIntents.retrieve(dispute.payment_intent as string);
      if (paymentIntent.metadata?.type === "top_up") {
        const { error } = await supabase.rpc("handle_charge_dispute", {
          p_actor_id: paymentIntent.metadata.actor_id,
          p_credits_amount: parseInt(paymentIntent.metadata.coins_amount),
          p_stripe_payment_intent_id: paymentIntent.id,
          p_amount_cents: dispute.amount,
          p_dispute_reason: `Stripe chargeback on payment ${paymentIntent.id}`,
        });
        if (error) throw error;
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});
