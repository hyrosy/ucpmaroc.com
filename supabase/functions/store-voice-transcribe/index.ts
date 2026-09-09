import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bot+ premium feature: turns a recorded visitor voice note into text using OpenAI transcription.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const portfolioId = String(formData.get("portfolio_id") || "");
    const audioFile = formData.get("audio");

    if (!portfolioId || !(audioFile instanceof File)) {
      return new Response(JSON.stringify({ error: "Missing portfolio_id or audio file" }), {
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
      .select("theme_config")
      .eq("id", portfolioId)
      .single();

    const config = portfolio?.theme_config || {};
    if (!config.store_chat_voice_messages_enabled) {
      return new Response(JSON.stringify({ error: "Voice messages are not enabled for this store" }), {
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

    const upstreamForm = new FormData();
    upstreamForm.append("file", audioFile, "voice-note.webm");
    upstreamForm.append("model", "gpt-4o-mini-transcribe");

    const transcriptionRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}` },
      body: upstreamForm,
    });

    if (!transcriptionRes.ok) {
      const errText = await transcriptionRes.text();
      console.error("Transcription error:", errText);
      return new Response(JSON.stringify({ error: "Transcription failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await transcriptionRes.json();
    return new Response(JSON.stringify({ text: result.text || "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
