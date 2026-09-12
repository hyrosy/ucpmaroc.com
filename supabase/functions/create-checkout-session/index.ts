import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import Stripe from "https://esm.sh/stripe@12.0.0"
import { getOrCreateStripeCustomer } from "../_shared/stripeCustomer.ts"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2022-11-15",
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
        mode, // 'payment' (for coins) or 'subscription' (for plans)
        priceId, // Stripe Price ID (for plans)
        amount, // Amount in cents (for dynamic coin top-up)
        name, // Name of the product (e.g. "100 UCP Coins")
        metadata, // { actor_id: '...', type: 'top_up' | 'subscription' }
        successUrl,
        cancelUrl
    } = await req.json()

    let line_items = [];

    if (mode === 'subscription') {
        // A. Recurring Plan
        line_items.push({
            price: priceId,
            quantity: 1,
        });
    } else {
        // B. One-time Coin Top-Up
        // We create the product on the fly for the specific amount
        line_items.push({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: name || 'Wallet Top Up',
                    description: 'Credits for your UCP Wallet',
                },
                unit_amount: amount, // Amount in cents! (e.g. 2000 for $20.00)
            },
            quantity: 1,
        });
    }

    // Attach a persistent Stripe Customer so the card is reusable in the billing portal
    // and the customer-scoped payment-methods manager, instead of a throwaway guest checkout.
    let customerId: string | undefined
    if (metadata?.actor_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      )
      customerId = await getOrCreateStripeCustomer(supabase, stripe, metadata.actor_id)
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: mode,
      line_items: line_items,
      metadata: metadata, // Crucial! This tells our Webhook who to credit later.
      customer: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})