import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { getOrCreateStripeCustomer } from "../_shared/stripeCustomer.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { action, actorId, paymentMethodId } = await req.json();
    if (!actorId) throw new Error("actorId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const customerId = await getOrCreateStripeCustomer(supabase, stripe, actorId);

    if (action === "create_setup_intent") {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        usage: "off_session",
      });
      return json({ clientSecret: setupIntent.client_secret });
    }

    if (action === "list_payment_methods") {
      const [methods, customer] = await Promise.all([
        stripe.paymentMethods.list({ customer: customerId, type: "card" }),
        stripe.customers.retrieve(customerId),
      ]);
      const defaultId =
        !customer.deleted ? customer.invoice_settings?.default_payment_method ?? null : null;
      const cards = methods.data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
        isDefault: pm.id === defaultId,
      }));
      return json({ paymentMethods: cards });
    }

    if (action === "detach_payment_method") {
      if (!paymentMethodId) throw new Error("paymentMethodId is required");
      // Verify this payment method actually belongs to this actor's customer before detaching.
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (pm.customer !== customerId) throw new Error("Payment method does not belong to this account");
      await stripe.paymentMethods.detach(paymentMethodId);
      return json({ success: true });
    }

    if (action === "set_default_payment_method") {
      if (!paymentMethodId) throw new Error("paymentMethodId is required");
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (pm.customer !== customerId) throw new Error("Payment method does not belong to this account");
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      return json({ success: true });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    return json({ error: error.message }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
