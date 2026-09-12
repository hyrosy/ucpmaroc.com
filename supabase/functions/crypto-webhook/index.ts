import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import * as crypto from "node:crypto";

serve(async (req) => {
  try {
    // 1. Extract the signature
    const signatureHeader = req.headers.get("x-nowpayments-sig");
    const ipnSecret = Deno.env.get("NOWPAYMENTS_IPN_SECRET");

    if (!signatureHeader || !ipnSecret) {
      throw new Error("Missing signature or IPN secret configuration.");
    }

    const body = await req.json();
    console.log("NOWPayments Webhook Received:", body);

    // 2. 🛡️ VERIFY THE SIGNATURE (Military-grade security)
    // NOWPayments requires sorting the keys alphabetically before hashing
    const sortedString = JSON.stringify(body, Object.keys(body).sort());
    const hmac = crypto.createHmac("sha512", ipnSecret);
    hmac.update(sortedString);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== signatureHeader) {
      console.error("FORGED WEBHOOK DETECTED!");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
      });
    }

    // 3. Process the legitimate payment
    if (
      body.payment_status === "finished" ||
      body.payment_status === "confirmed"
    ) {
      // We embedded the Actor ID in the order_id earlier (e.g., "TOPUP_uuid_12345")
      const orderIdParts = body.order_id.split("_");

      if (orderIdParts[0] === "TOPUP") {
        const actorId = orderIdParts[1];
        // We embedded the coin amount in the description (e.g., "550 UCP Coins")
        const coinsAmount = parseInt(body.order_description.split(" ")[0]);

        if (actorId && coinsAmount) {
          const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
          );

          // Idempotency: NOWPayments can resend the same IPN call. Record it first;
          // if it's already been processed, skip crediting the account again.
          const { error: dedupeError } = await supabase
            .from("processed_stripe_events")
            .insert({ event_id: `NOWPAYMENTS_${body.payment_id}`, event_type: "crypto_topup" });
          if (dedupeError) {
            if (dedupeError.code === "23505") {
              return new Response(JSON.stringify({ status: "success", deduped: true }), { status: 200 });
            }
            throw dedupeError;
          }

          // Safely add coins to wallet and write a transaction receipt!
          const { error } = await supabase.rpc("process_stripe_topup", {
            p_actor_id: actorId,
            p_coins_amount: coinsAmount,
            p_amount_paid_cents: Math.round(body.pay_amount * 100),
            p_stripe_payment_intent_id: `NOWPAYMENTS_${body.payment_id}`,
          });

          if (error) throw error;
          console.log(
            `Successfully credited ${coinsAmount} coins to ${actorId}`
          );
        }
      }
    }

    return new Response(JSON.stringify({ status: "success" }), { status: 200 });
  } catch (error: any) {
    console.error("Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
    });
  }
});
