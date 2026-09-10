import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bot+ premium feature: lets the live-voice assistant leave a short written note in the
// visible chat thread (via the "share_note" realtime tool) without exposing a full transcript.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { portfolio_id, conversation_id, note } = await req.json();
    const trimmedNote = String(note || "").trim().slice(0, 280);
    if (!portfolio_id || !conversation_id || !trimmedNote) {
      return new Response(JSON.stringify({ error: "Missing portfolio_id, conversation_id, or note" }), {
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
      .eq("id", portfolio_id)
      .single();

    const config = portfolio?.theme_config || {};
    if (!config.store_chat_live_voice_enabled || !config.store_chat_ai_assistant) {
      return new Response(JSON.stringify({ error: "Live voice is not enabled for this store" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: conversation } = await supabase
      .from("store_conversations")
      .select("id, status")
      .eq("id", conversation_id)
      .eq("portfolio_id", portfolio_id)
      .maybeSingle();
    if (!conversation || conversation.status === "closed") {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabase.from("store_messages").insert({
      conversation_id,
      sender_type: "ai_bot",
      content: trimmedNote,
      message_type: "text",
    });
    if (insertError) {
      return new Response(JSON.stringify({ error: "Failed to save note" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("store_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversation_id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
