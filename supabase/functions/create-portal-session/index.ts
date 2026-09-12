import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import Stripe from "https://esm.sh/stripe@12.0.0"
import { getOrCreateStripeCustomer } from "../_shared/stripeCustomer.ts"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2022-11-15" })
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { customerId, actorId, returnUrl } = await req.json()

    let resolvedCustomerId = customerId
    if (!resolvedCustomerId && actorId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      )
      resolvedCustomerId = await getOrCreateStripeCustomer(supabase, stripe, actorId)
    }
    if (!resolvedCustomerId) throw new Error("customerId or actorId is required")

    const session = await stripe.billingPortal.sessions.create({
      customer: resolvedCustomerId,
      return_url: returnUrl,
    })

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})