import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // 1. Parse the Webhook Payload
    const payload = await req.json();
    const visitorMessage = payload.record;

    // Only react to messages sent by visitors
    if (visitorMessage.sender_type !== 'visitor') {
      return new Response("Ignored: Not a visitor message", { status: 200 });
    }

    // 2. Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Get Conversation & Store Settings
    const { data: conv } = await supabase
      .from('store_conversations')
      .select('portfolio_id, status')
      .eq('id', visitorMessage.conversation_id)
      .single();

    if (!conv) return new Response("Conversation not found", { status: 404 });

    // If a human agent is handling this conversation, silence the AI
    if (conv.status === 'agent_requested') {
      return new Response("Conversation is being handled by a human", { status: 200 });
    }

    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('theme_config, site_name, sections')
      .eq('id', conv.portfolio_id)
      .single();

    const config = portfolio?.theme_config || {};
    
    // 4. Intercept Pre-defined FAQs (Answers instantly without hitting OpenAI)
    const faqs = config.store_chat_suggested_questions || [];
    const matchedFaq = faqs.find((f: any) => typeof f === 'object' && f.question && f.question.trim() === visitorMessage.content.trim() && f.answer && f.answer.trim());
    
    if (matchedFaq) {
      await supabase.from('store_messages').insert({
        conversation_id: visitorMessage.conversation_id,
        sender_type: 'ai_bot',
        content: matchedFaq.answer.trim()
      });
      await supabase.from('store_conversations').update({ updated_at: new Date().toISOString() }).eq('id', visitorMessage.conversation_id);
      return new Response("Replied with predefined FAQ answer", { status: 200 });
    }

    // 5. Verify AI is enabled
    if (!config.store_chat_ai_assistant) {
      // If AI is disabled, send an automated away message ONLY on the very first message
      const { count } = await supabase.from('store_messages').select('*', { count: 'exact', head: true }).eq('conversation_id', visitorMessage.conversation_id);
      if (count === 1) {
        await supabase.from('store_messages').insert({
          conversation_id: visitorMessage.conversation_id,
          sender_type: 'ai_bot',
          content: "Hi there! 👋 Our live agents are currently away. Please leave your name and email address, along with your question, and we'll get back to you as soon as possible!"
        });
        await supabase.from('store_conversations').update({ updated_at: new Date().toISOString() }).eq('id', visitorMessage.conversation_id);
      }
      return new Response("AI is disabled for this store", { status: 200 });
    }

    // 5. Fetch Store Product Catalog
    const { data: products } = await supabase
      .from('pro_products')
      .select('title, short_description, price, delivery_type, stock_count')
      .eq('portfolio_id', conv.portfolio_id)
      .limit(50); // Limit to top 50 to save context tokens

    // Format the catalog so the AI understands it easily
    const catalogText = products?.map(p => {
      const availability = (p.delivery_type === 'physical' && p.stock_count <= 0) ? 'Out of Stock' : 'In Stock';
      return `- ${p.title}: $${p.price} (${availability}) - ${p.short_description || ''}`;
    }).join('\n') || 'No products available currently.';

    // Parse Portfolio Sections for General Context
    const sectionsText = portfolio?.sections?.map((s: any) => {
      let text = `- [${s.type.toUpperCase()}] `;
      if (s.data?.title) text += `${s.data.title}: `;
      const desc = s.data?.description || s.data?.content || s.data?.text || s.data?.about_text;
      if (desc) text += desc;
      return text;
    }).filter((t: string) => t.length > 15).join('\n') || 'No additional portfolio sections.';

    // 6. Build the Master System Prompt
    const systemPrompt = `You are the AI Customer Support Assistant for ${portfolio?.site_name || 'this store'}.
IMPORTANT: You MUST introduce yourself as an AI assistant if asked.
Creator's Specific Instructions: ${config.store_chat_ai_prompt || 'Be polite, helpful, and concise.'}

Here is our current product catalog. Use this to answer questions and recommend products:
${catalogText}

Here is information about the creator's portfolio, biography, services, and PRE-ANSWERED FAQs:
${sectionsText}

RULES:
1. If the user asks about the status of an order, ask for their email address and order number, then use "check_order_status".
2. If you think the user is a potential client/buyer, ask for their name and email address so the team can follow up. Once provided, use the "capture_contact_info" tool.
3. If the user explicitly asks to speak to a human agent, or needs complex support you cannot provide, use the "transfer_to_agent" tool to hand off the conversation.`;

    const marketingPrompt = config.store_chat_marketing_optin ? `
IMPORTANT - COUPONS & LEADS:
If the user asks about a discount or promo code, offer them a discount in exchange for subscribing to our marketing emails.
1. First, ask for their name and email.
2. Once they provide their name and email, tell them to confirm their subscription by clicking the approve button. You MUST include the exact text "[APPROVE_MARKETING]" in your message so the UI button appears. Do NOT give them the code yet.
3. When the user explicitly approves (e.g. they say "I approve marketing emails"), use the "subscribe_to_marketing" tool.
4. After the tool succeeds, use "check_discount_code" to find a valid code (or offer the fallback code ${config.store_chat_marketing_coupon || 'WELCOME10'}) and give it to them!` : '';

    // 7. Fetch Chat History
    const { data: history } = await supabase
      .from('store_messages')
      .select('content, sender_type')
      .eq('conversation_id', visitorMessage.conversation_id)
      .order('created_at', { ascending: false })
      .limit(10);

    const openAiMessages = [
      { role: 'system', content: systemPrompt + '\n' + marketingPrompt },
      ...(history?.reverse().map(m => ({
        role: m.sender_type === 'visitor' ? 'user' : 'assistant',
        content: m.content || "(empty message)"
      })) || [])
    ];

    // 8. Define the Tools for OpenAI
    const tools = [{
      type: "function",
      function: {
        name: "check_order_status",
        description: "Looks up a customer's order status in the database using their email and order ID.",
        parameters: {
          type: "object",
          properties: {
            email: { type: "string", description: "The customer's email address." },
            order_id: { type: "string", description: "The order number/ID (e.g. 1004, ORD-123)." }
          },
          required: ["email", "order_id"]
        }
      }
    }, {
      type: "function",
      function: {
        name: "check_discount_code",
        description: "Checks if a discount or promo code is valid for this store.",
        parameters: {
          type: "object",
          properties: { code: { type: "string", description: "The promo code (e.g. WELCOME10)." } },
          required: ["code"]
        }
      }
    }, {
      type: "function",
      function: {
        name: "capture_contact_info",
        description: "Saves a visitor's name and email address in the database so customer service can contact them.",
        parameters: {
          type: "object",
          properties: { 
            name: { type: "string", description: "The visitor's name." },
            email: { type: "string", description: "The visitor's email address." } 
          },
          required: ["name", "email"]
        }
      }
    }, {
      type: "function",
      function: {
        name: "subscribe_to_marketing",
        description: "Saves a visitor as a lead who has explicitly opted into marketing emails.",
        parameters: {
          type: "object",
          properties: { 
            name: { type: "string", description: "The visitor's name." },
            email: { type: "string", description: "The visitor's email address." } 
          },
          required: ["name", "email"]
        }
      }
    }, {
      type: "function",
      function: {
        name: "transfer_to_agent",
        description: "Transfers the conversation to a human agent when the user requests it or needs complex help.",
        parameters: { type: "object", properties: {}, required: [] }
      }
    }];

    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) {
      console.error("Missing OPENAI_API_KEY environment variable.");
      return new Response("Missing OpenAI Key", { status: 500 });
    }

    // 9. Initial Call to OpenAI
    let aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: openAiMessages, tools: tools })
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("OpenAI API Error:", errText);
      return new Response("OpenAI Error", { status: 502 });
    }

    let aiData = await aiRes.json();
    let message = aiData.choices[0].message;

    // 10. Handle Tool Executions
    if (message.tool_calls) {
      openAiMessages.push(message); // Add the AI's tool call request to the history

      for (const toolCall of message.tool_calls) {
        let args;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (parseError) {
          console.error("AI returned invalid JSON arguments:", parseError);
          openAiMessages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: "Error: Invalid arguments provided by AI." });
          continue; // Skip execution but provide fallback to AI
        }

        if (toolCall.function.name === 'check_order_status') {
          
          // Query Supabase for the exact order
          const { data: order } = await supabase
            .from('pro_orders')
            .select('status, total_price, created_at, order_id_string')
            .eq('portfolio_id', conv.portfolio_id)
            .ilike('client_email', args.email)
            .or(`order_id_string.eq.${args.order_id},display_id.ilike.%${args.order_id}%`)
            .maybeSingle();

          const toolResult = order 
            ? `Order found! Status is "${order.status}". Total: $${order.total_price}. Ordered on: ${new Date(order.created_at).toLocaleDateString()}` 
            : `No order found for email "${args.email}" and ID "${args.order_id}".`;

          openAiMessages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: toolResult });
        } 
        else if (toolCall.function.name === 'check_discount_code') {
          const { data: coupon } = await supabase
            .from('pro_coupons')
            .select('discount_type, discount_value, end_date, is_active')
            .eq('portfolio_id', conv.portfolio_id)
            .ilike('code', args.code)
            .maybeSingle();

          let toolResult = `Coupon code "${args.code}" is invalid or does not exist.`;
          if (coupon && coupon.is_active && (!coupon.end_date || new Date() < new Date(coupon.end_date))) {
             const discountText = coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `$${coupon.discount_value}`;
             toolResult = `Coupon "${args.code}" is valid! It provides a ${discountText} discount.`;
          }
          openAiMessages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: toolResult });
        }
        else if (toolCall.function.name === 'capture_contact_info') {
          
          let { data: customer } = await supabase
            .from('pro_customers')
            .select('id')
            .eq('portfolio_id', conv.portfolio_id)
            .ilike('email', args.email)
            .maybeSingle();

          // 1. If they don't exist, create a new customer profile for them
          if (!customer) {
            const { data: newCustomer } = await supabase.from('pro_customers').insert({
              portfolio_id: conv.portfolio_id,
              email: args.email.toLowerCase(),
              full_name: args.name
            }).select('id').single();
            customer = newCustomer;
          }

          // 2. Link the conversation to this customer so the 24h cron-job never deletes it!
          if (customer) {
            await supabase.from('store_conversations').update({ customer_id: customer.id }).eq('id', visitorMessage.conversation_id);
          }

          openAiMessages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: `Contact info saved successfully for ${args.name} (${args.email}). Thank them and let them know you'll be in touch!` });
        }
        else if (toolCall.function.name === 'subscribe_to_marketing') {
          
          // 1. Add to Leads with marketing_opt_in = true
          let { data: lead } = await supabase
            .from('leads')
            .select('id')
            .eq('portfolio_id', conv.portfolio_id)
            .ilike('email', args.email)
            .maybeSingle();

          if (!lead) {
            await supabase.from('leads').insert({ portfolio_id: conv.portfolio_id, name: args.name, email: args.email.toLowerCase(), source: 'Store AI Bot', marketing_opt_in: true });
          } else {
            await supabase.from('leads').update({ marketing_opt_in: true }).eq('id', lead.id);
          }

          // 2. Also ensure they are in pro_customers so the chat doesn't get deleted by the 24h cron job
          let { data: customer } = await supabase
            .from('pro_customers')
            .select('id')
            .eq('portfolio_id', conv.portfolio_id)
            .ilike('email', args.email)
            .maybeSingle();

          if (!customer) {
            const { data: newCustomer } = await supabase.from('pro_customers').insert({ portfolio_id: conv.portfolio_id, email: args.email.toLowerCase(), full_name: args.name }).select('id').single();
            customer = newCustomer;
          }

          if (customer) {
            await supabase.from('store_conversations').update({ customer_id: customer.id }).eq('id', visitorMessage.conversation_id);
          }

          openAiMessages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: `Successfully subscribed ${args.email} to marketing leads. You MUST now give them the coupon code.` });
        }
        else if (toolCall.function.name === 'transfer_to_agent') {
          await supabase.from('store_conversations').update({ status: 'agent_requested' }).eq('id', visitorMessage.conversation_id);
          openAiMessages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: "Successfully requested human agent. Tell the user an agent will be with them shortly." });
        }
      }

      // Second Call to OpenAI (Now containing the Tool results)
      aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: openAiMessages })
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error("OpenAI API Error (Tool Call):", errText);
        return new Response("OpenAI Error", { status: 502 });
      }

      aiData = await aiRes.json();
      message = aiData.choices[0].message;
    }

    // 11. Save the final AI response to the database
    await supabase.from('store_messages').insert({ conversation_id: visitorMessage.conversation_id, sender_type: 'ai_bot', content: message.content });
    await supabase.from('store_conversations').update({ updated_at: new Date().toISOString() }).eq('id', visitorMessage.conversation_id);

    return new Response("AI Reply completed successfully", { status: 200 });
  } catch (err) { return new Response(String(err), { status: 500 }); }
});