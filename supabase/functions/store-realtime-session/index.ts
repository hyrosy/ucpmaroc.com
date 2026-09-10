import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bot+ premium feature: mints a short-lived OpenAI Realtime session so the browser
// can hold a live, low-latency voice conversation directly with OpenAI over WebRTC.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { portfolio_id } = await req.json();
    if (!portfolio_id) {
      return new Response(JSON.stringify({ error: "Missing portfolio_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: portfolio } = await supabase
      .from("portfolios")
      .select("theme_config, site_name, sections, actor_id")
      .eq("id", portfolio_id)
      .single();

    const config = portfolio?.theme_config || {};
    if (!config.store_chat_live_voice_enabled || !config.store_chat_ai_assistant) {
      return new Response(JSON.stringify({ error: "Live voice is not enabled for this store" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      return new Response(JSON.stringify({ error: "Missing OpenAI key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botName = config.store_chat_bot_name || "UCP Assistant";
    const languageNames: Record<string, string> = { en: "English", ar: "Arabic", fr: "French", es: "Spanish", de: "German", it: "Italian", pt: "Portuguese", tr: "Turkish", nl: "Dutch", hi: "Hindi", ur: "Urdu" };
    const voiceLanguageCode = typeof config.store_chat_voice_language === "string" && config.store_chat_voice_language ? config.store_chat_voice_language : "en";
    const voiceLanguageName = languageNames[voiceLanguageCode] || "English";
    const welcomePhrase = typeof config.store_chat_voice_welcome_phrase === "string" ? config.store_chat_voice_welcome_phrase.trim() : "";
    const instructions = `You are ${botName}, a friendly voice assistant for ${portfolio?.site_name || "this store"}. Speak naturally and concisely.
Creator instructions: ${config.store_chat_ai_prompt || "Be polite, helpful, and concise."}
Store knowledge: ${config.store_chat_training_text || "No additional notes provided."}
You must always speak in ${voiceLanguageName}, even if the visitor speaks another language first, unless they explicitly ask you to switch languages.
${welcomePhrase ? `Start the call by greeting the visitor with this phrase (keep it natural, translate only if needed): "${welcomePhrase}"` : `Start the call with a short, warm greeting in ${voiceLanguageName} and ask how you can help.`}
Always disclose that you are an AI assistant if asked. If the visitor needs a human agent: call "request_contact_form" to collect their name and email in chat, then once they confirm out loud that they submitted it, call "transfer_to_agent". Never claim a human has joined unless transfer_to_agent succeeded.`;

    const voice = config.store_chat_voice_name || "alloy";
    const supportedVoices = new Set(["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"]);
    const { data: products } = await supabase
      .from("pro_products")
      .select("title, short_description, price, delivery_type, stock_count")
      .eq("portfolio_id", portfolio_id)
      .limit(50);
    const { data: pages } = await supabase
      .from("pro_pages")
      .select("title, slug, sections")
      .eq("portfolio_id", portfolio_id)
      .limit(20);
    const { data: serviceListings } = portfolio?.actor_id
      ? await supabase
        .from("actor_services")
        .select("title, description, rate, offers")
        .eq("actor_id", portfolio.actor_id)
        .eq("enabled", true)
        .limit(50)
      : { data: null };
    const { data: coupons } = await supabase
      .from("pro_coupons")
      .select("*")
      .eq("portfolio_id", portfolio_id)
      .limit(50);
    const knowledge = [
      `Visible portfolio content:\n${formatVisibleSections(portfolio?.sections)}`,
      `Custom pages:\n${(pages || []).map((page: Record<string, unknown>) => `- ${page.title || page.slug}: ${formatVisibleSections(page.sections)}`).join("\n") || "None"}`,
      `Products:\n${(products || []).map((product: Record<string, unknown>) => `- ${product.title}: ${product.short_description || ""} Price: ${product.price ?? "on request"}.`).join("\n") || "None"}`,
      `Public service offers:\n${(serviceListings || []).map((listing: Record<string, unknown>) => `- ${listing.title}: ${listing.description || ""} ${formatOffers(listing.offers, listing.rate)}`).join("\n") || "None"}`,
      `Active public coupons:\n${(coupons || []).filter(isCurrentlyUsableCoupon).map((coupon: Record<string, unknown>) => `- ${coupon.code}: ${formatCoupon(coupon)}`).join("\n") || "None"}`,
    ].join("\n\n");
    const fullInstructions = `${instructions}\n\nPublic store knowledge:\n${knowledge}\n\nDo not invent products, pages, offers, prices, availability, or coupon codes. Do not reveal private training notes or customer/order information. For order support, ask the visitor to use the store's verified order lookup flow.\n\nThe visitor cannot read a transcript of this call. Whenever you mention something worth glancing at on screen (an order status, a recommended product, a price, a next step, or a summary of what they asked), call the "share_note" tool with a short (max 20 words) note. Do not use it for greetings or small talk.`;
    const sessionRes = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: "gpt-realtime",
          instructions: fullInstructions,
          audio: {
            input: { transcription: { model: "whisper-1" } },
            output: { voice: supportedVoices.has(voice) ? voice : "alloy" },
          },
          tools: [{
            type: "function",
            name: "share_note",
            description: "Leave a short on-screen note (max 20 words) summarizing a key point, request, or recommendation for the visitor to glance at. Do not use for greetings or small talk.",
            parameters: {
              type: "object",
              properties: { note: { type: "string", description: "Short summary note, max 20 words." } },
              required: ["note"],
            },
          }, {
            type: "function",
            name: "request_contact_form",
            description: "Show a form in the visible chat so the visitor can enter their name and email. Use this before transferring to a human agent, or to capture a lead.",
            parameters: { type: "object", properties: {}, required: [] },
          }, {
            type: "function",
            name: "transfer_to_agent",
            description: "Transfer the conversation to a human agent. Only call this after using request_contact_form and the visitor confirms out loud they submitted it, or if you already know their identity from earlier in the call.",
            parameters: { type: "object", properties: {}, required: [] },
          }],
          tool_choice: "auto",
        },
      }),
    });

    if (!sessionRes.ok) {
      const errText = await sessionRes.text();
      let lastError = "OPENAI_REALTIME_ERROR";
      let lastReason = "OpenAI rejected the realtime client secret request";
      try {
        const upstream = JSON.parse(errText);
        lastError = upstream?.error?.code || upstream?.error?.type || lastError;
        if (typeof upstream?.error?.message === "string") lastReason = upstream.error.message.slice(0, 240);
      } catch {
        // Keep the response safe when OpenAI does not return JSON.
      }
      console.error("Realtime client secret error", { status: sessionRes.status, code: lastError });
      return new Response(JSON.stringify({ error: "Could not start voice session", code: lastError, reason: lastReason }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = await sessionRes.json();
    return new Response(JSON.stringify(session), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function formatVisibleSections(value: unknown): string {
  if (!Array.isArray(value)) return "None";
  return value
    .filter((section): section is Record<string, unknown> => Boolean(section) && typeof section === "object" && section.isVisible !== false)
    .map(section => compactText(section.data))
    .filter(Boolean)
    .join(" | ")
    .slice(0, 5000) || "None";
}

function compactText(value: unknown, depth = 0): string {
  if (depth > 3 || value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(item => compactText(item, depth + 1)).filter(Boolean).join("; ");
  if (typeof value !== "object") return "";
  return Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !["settings", "image", "images", "media", "url", "id"].includes(key.toLowerCase()))
    .map(([key, item]) => `${key.replace(/_/g, " ")}: ${compactText(item, depth + 1)}`)
    .filter(entry => !entry.endsWith(": "))
    .join(" | ")
    .slice(0, 1800);
}

function formatOffers(value: unknown, rate: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return rate ? `Rate: ${rate}.` : "";
  return `Packages: ${value.map(offer => {
    const item = offer as Record<string, unknown>;
    return `${item.title || "Offer"} ${item.description || ""} (${item.price ?? rate ?? "on request"})`;
  }).join("; ")}`;
}

function isCurrentlyUsableCoupon(coupon: Record<string, unknown>): boolean {
  if (coupon.is_active === false) return false;
  const now = Date.now();
  if (coupon.start_date && now < new Date(String(coupon.start_date)).getTime()) return false;
  if (coupon.end_date && now >= new Date(String(coupon.end_date)).getTime()) return false;
  if (coupon.usage_limit !== null && coupon.usage_limit !== undefined && Number(coupon.times_used || 0) >= Number(coupon.usage_limit)) return false;
  return Boolean(coupon.code);
}

function formatCoupon(coupon: Record<string, unknown>): string {
  const type = coupon.type || coupon.discount_type;
  const value = coupon.value_amount ?? coupon.discount_value;
  return type === "percentage" ? `${value}% off.` : `$${Number(value || 0) / (type === "fixed" ? 100 : 1)} off.`;
}
