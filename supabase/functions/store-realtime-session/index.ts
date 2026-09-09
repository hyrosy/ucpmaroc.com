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
      .select("theme_config, site_name")
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
    const instructions = `You are ${botName}, a friendly voice assistant for ${portfolio?.site_name || "this store"}. Speak naturally and concisely.
Creator instructions: ${config.store_chat_ai_prompt || "Be polite, helpful, and concise."}
Store knowledge: ${config.store_chat_training_text || "No additional notes provided."}
Always disclose that you are an AI assistant if asked. If the visitor needs a human agent, tell them their request will be passed to the team.`;

    const sessionRes = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        voice: config.store_chat_voice_name || "alloy",
        instructions,
        input_audio_transcription: { model: "whisper-1" },
      }),
    });

    if (!sessionRes.ok) {
      const errText = await sessionRes.text();
      console.error("Realtime session error:", errText);
      return new Response(JSON.stringify({ error: "Could not start voice session" }), {
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
