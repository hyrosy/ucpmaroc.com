import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, Sparkles, RefreshCw } from 'lucide-react';
import { supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface StorefrontChatWidgetProps {
  portfolioId: string;
  storeName?: string;
  aiEnabled?: boolean;
  iconType?: string;
  customIconUrl?: string;
  welcomeMessage?: string;
  suggestedQuestions?: any[];
  isInline?: boolean;
}

const StorefrontChatWidget: React.FC<StorefrontChatWidgetProps> = ({ portfolioId, storeName = 'Store Support', aiEnabled = false, iconType = 'message', customIconUrl = '', welcomeMessage, suggestedQuestions = [], isInline = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Setup Visitor Session
  useEffect(() => {
    let vid = localStorage.getItem('ucp_visitor_id');
    if (!vid) {
      vid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'v-' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('ucp_visitor_id', vid);
    }
    setVisitorId(vid);

    // Check for existing conversation
    const checkExisting = async () => {
      const { data } = await supabase
        .from('store_conversations')
        .select('id')
        .eq('portfolio_id', portfolioId)
        .eq('visitor_session_id', vid)
        .maybeSingle();
      
      if (data) setConversationId(data.id);
    };
    checkExisting();
  }, [portfolioId]);

  // 2. Fetch Messages and Subscribe to Realtime
  useEffect(() => {
    if (!conversationId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('store_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (data) {
         setMessages(prev => {
             const temps = prev.filter(m => String(m.id).startsWith('temp-') && !data.some(d => d.content === m.content));
             return [...data, ...temps];
         });
      }
    };
    fetchMessages();

    const channel = supabase.channel(`store_chat_${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'store_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMessages(prev => {
           if (prev.find(m => m.id === payload.new.id || (m.content === payload.new.content && m.id.toString().startsWith('temp-')))) {
              return prev.map(m => (m.content === payload.new.content && m.id.toString().startsWith('temp-')) ? payload.new : m);
           }
           return [...prev, payload.new];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // 3. Scroll to bottom safely
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msgContent = newMessage;
    setNewMessage('');

    // Optimistic UI update (Instant feedback)
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, conversation_id: conversationId, sender_type: 'visitor', content: msgContent, created_at: new Date().toISOString() }]);

    let activeConvId = conversationId;

    // Create conversation on the fly if it doesn't exist
    if (!activeConvId) {
      const { data, error } = await supabase
        .from('store_conversations')
        .insert({ portfolio_id: portfolioId, visitor_session_id: visitorId, status: 'open' })
        .select()
        .single();
        
      if (error) { setMessages(prev => prev.filter(m => m.id !== tempId)); return; }
      activeConvId = data.id;
      setConversationId(activeConvId);
    }

    const { error: msgError } = await supabase.from('store_messages').insert({
      conversation_id: activeConvId,
      sender_type: 'visitor',
      content: msgContent
    });
    if (msgError) setMessages(prev => prev.filter(m => m.id !== tempId));
  };

  // Fast-track function for the AI action buttons
  const handleSendDirect = async (text: string) => {
    let activeConvId = conversationId;
    if (!activeConvId) {
      const { data, error } = await supabase
        .from('store_conversations')
        .insert({ portfolio_id: portfolioId, visitor_session_id: visitorId, status: 'open' })
        .select()
        .single();
      if (error) return console.error('Error creating conversation:', error);
      activeConvId = data.id;
      setConversationId(activeConvId);
    }
    
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, conversation_id: activeConvId, sender_type: 'visitor', content: text, created_at: new Date().toISOString() }]);

    const { error: msgError } = await supabase.from('store_messages').insert({
      conversation_id: activeConvId, sender_type: 'visitor', content: text
    });
    if (msgError) setMessages(prev => prev.filter(m => m.id !== tempId));
  };

  const handleResetChat = () => {
    if (window.confirm('Are you sure you want to clear this conversation and start fresh?')) {
      const newVid = 'v-' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('ucp_visitor_id', newVid);
      setVisitorId(newVid);
      setConversationId(null);
      setMessages([]);
    }
  };

  const isCustom = iconType === 'custom' && customIconUrl;

  return (
    <div className={cn(isInline ? "relative flex flex-col items-end w-full" : "fixed bottom-6 right-6 z-50 flex flex-col items-end")}>
      {isOpen && (
        <div className={cn("mb-4 flex flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl transition-all", isInline ? "h-[450px] w-full max-w-[380px]" : "h-[450px] w-[350px] sm:w-[380px]")}>
          <div className="flex items-center justify-between bg-primary p-4 text-primary-foreground">
            <div>
              <h3 className="font-semibold flex items-center gap-2">{storeName} {aiEnabled && <Bot className="h-4 w-4" />}</h3>
              <p className="text-xs opacity-90">{aiEnabled ? 'AI Assistant is online ⚡' : 'We typically reply in a few minutes.'}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20" onClick={handleResetChat} title="Restart Conversation">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20" onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 p-4 bg-muted/10">
            <div className="space-y-4">
                {messages.length === 0 && (
                   <div className="space-y-4">
                       <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm bg-background border rounded-bl-sm text-foreground">
                              {aiEnabled && <div className="flex items-center gap-1 mb-1 text-[10px] font-bold uppercase opacity-80"><Bot className="h-3 w-3" /> AI Bot</div>}
                              {welcomeMessage || 'Hi! 👋 How can we help you today?'}
                          </div>
                       </div>
                       {suggestedQuestions && suggestedQuestions.length > 0 && (
                           <div className="flex flex-wrap gap-2 justify-end animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
                               {suggestedQuestions.filter(q => q && (typeof q === 'object' ? q.question?.trim() : typeof q === 'string' && q.trim())).map((qObj, idx) => {
                                   const qText = typeof qObj === 'string' ? qObj : qObj.question;
                                   return (
                                   <button
                                       key={idx} 
                                       onClick={() => handleSendDirect(qText)}
                                       className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-full transition-colors font-medium text-left shadow-sm max-w-[90%] line-clamp-2"
                                   >
                                       {qText}
                                   </button>
                               )})}
                           </div>
                       )}
                   </div>
                )}
                {messages.map((msg, i) => {
                  // Intercept AI action triggers
                  let displayContent = msg.content || '';
                  let showApproveBtn = false;
                  if (displayContent.includes('[APPROVE_MARKETING]')) {
                      showApproveBtn = true;
                      displayContent = displayContent.replace('[APPROVE_MARKETING]', '').trim();
                  }
                  const isLastMessage = i === messages.length - 1;

                  return (
                  <div key={i} className={`flex ${msg.sender_type === 'visitor' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.sender_type === 'visitor' ? 'bg-primary text-primary-foreground rounded-br-sm' : msg.sender_type === 'ai_bot' ? 'bg-indigo-500 text-white rounded-bl-sm' : 'bg-background border rounded-bl-sm text-foreground'}`}>
                      {msg.sender_type === 'ai_bot' && <div className="flex items-center gap-1 mb-1 text-[10px] font-bold uppercase opacity-80"><Bot className="h-3 w-3" /> AI Bot</div>}
                      {displayContent}
                      {showApproveBtn && msg.sender_type === 'ai_bot' && isLastMessage && (
                         <Button 
                           size="sm" variant="secondary" className="mt-3 w-full font-bold shadow-sm text-xs h-8 text-indigo-700 bg-white hover:bg-gray-100" 
                           onClick={() => handleSendDirect("I approve marketing emails.")}
                         >
                           ✅ Approve & Get Coupon
                         </Button>
                      )}
                    </div>
                  </div>
                )})}
                <div ref={scrollRef} />
            </div>
          </ScrollArea>
          <form onSubmit={handleSend} className="flex items-center gap-2 border-t bg-background p-3">
            <Input placeholder="Type a message..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1 rounded-full bg-muted/30 focus-visible:ring-primary" />
            <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={!newMessage.trim()}><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      )}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={cn(
          "relative h-14 w-14 flex items-center justify-center bg-transparent border-0 outline-none shadow-none cursor-pointer transition-transform hover:scale-110 z-50", 
          isOpen ? "text-foreground" : "text-primary drop-shadow-2xl"
        )}
      >
        {isOpen ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background border shadow-md"><X className="h-6 w-6" /></div>
        ) : isCustom ? (
          <img src={customIconUrl} alt="Chat" className="h-full w-full object-contain drop-shadow-2xl" />
        ) : iconType === 'sparkles' ? (
          <Sparkles className="h-12 w-12 drop-shadow-xl" strokeWidth={1.5} />
        ) : iconType === 'bot' ? (
          <Bot className="h-12 w-12 drop-shadow-xl" strokeWidth={1.5} />
        ) : (
          <MessageCircle className="h-14 w-14 drop-shadow-xl fill-current" strokeWidth={1} />
        )}
      </button>
    </div>
  );
};
export default StorefrontChatWidget;