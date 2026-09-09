import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Bot, Sparkles, RefreshCw, Mic, Square, Phone, PhoneOff } from 'lucide-react';
import { createVisitorSupabase, supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useCartStore } from '@/features/ecommerce/store/useCartStore';

interface StorefrontChatWidgetProps {
  portfolioId: string;
  storeSlug?: string;
  storeName?: string;
  botName?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  aiEnabled?: boolean;
  iconType?: string;
  customIconUrl?: string;
  welcomeMessage?: string;
  suggestedQuestions?: Array<string | { question: string; answer?: string }>;
  aiMessageColor?: string;
  visitorMessageColor?: string;
  panelBackground?: string;
  panelBackgroundImage?: string;
  panelPattern?: 'none' | 'dots' | 'grid' | 'diagonal';
  panelGradient?: string;
  sendButtonColor?: string;
  sendButtonLabel?: string;
  inputPlaceholder?: string;
  launcherPosition?: 'left' | 'right';
  launcherStyle?: 'message' | 'bot' | 'sparkles' | 'custom' | 'peek';
  voiceMessagesEnabled?: boolean;
  liveVoiceEnabled?: boolean;
  isInline?: boolean;
}

interface LiveTranscriptLine {
  role: 'visitor' | 'assistant';
  text: string;
}

interface StoreMessage {
  id: string;
  conversation_id: string | null;
  sender_type: 'visitor' | 'owner' | 'ai_bot';
  content: string;
  created_at: string;
  message_type?: 'text' | 'product_recommendation' | 'lead_form';
  metadata?: Record<string, unknown> | null;
}

const StorefrontChatWidget: React.FC<StorefrontChatWidgetProps> = ({ portfolioId, storeSlug, storeName = 'Store Support', botName = 'UCP Assistant', headerTitle, aiEnabled = false, iconType = 'message', customIconUrl = '', welcomeMessage, suggestedQuestions = [], aiMessageColor = '#6366f1', visitorMessageColor = '#111827', panelBackground = '#f8fafc', panelBackgroundImage = '', panelPattern = 'none', panelGradient = '', sendButtonColor = '#111827', sendButtonLabel = 'Send message', inputPlaceholder = 'Type a message...', launcherPosition = 'right', launcherStyle, voiceMessagesEnabled = false, liveVoiceEnabled = false, isInline = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<StoreMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string>('');
  const [visitorReady, setVisitorReady] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [orderEmail, setOrderEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [contactFormTouched, setContactFormTouched] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSubmitError, setContactSubmitError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveCallStatus, setLiveCallStatus] = useState<'idle' | 'connecting' | 'active'>('idle');
  const [liveCallError, setLiveCallError] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [liveTranscript, setLiveTranscript] = useState<LiveTranscriptLine[]>([]);
  const addItem = useCartStore(state => state.addItem);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const livePeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const liveAudioElRef = useRef<HTMLAudioElement | null>(null);
  const liveDataChannelRef = useRef<RTCDataChannel | null>(null);
  const conversationPromiseRef = useRef<Promise<string> | null>(null);
  const conversationLookupRef = useRef<Promise<string | null> | null>(null);
  const visitorSupabaseRef = useRef(supabase);
  const aiTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startAiTyping = useCallback(() => {
    if (!aiEnabled) return;
    if (aiTypingTimeoutRef.current) clearTimeout(aiTypingTimeoutRef.current);
    setAiTyping(true);
    aiTypingTimeoutRef.current = setTimeout(() => setAiTyping(false), 45_000);
  }, [aiEnabled]);

  const stopAiTyping = useCallback(() => {
    if (aiTypingTimeoutRef.current) clearTimeout(aiTypingTimeoutRef.current);
    aiTypingTimeoutRef.current = null;
    setAiTyping(false);
  }, []);

  const submitContactForm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!contactName.trim() || !contactEmail.includes('@')) return;
    setContactSubmitting(true);
    setContactSubmitError('');
    const sent = await handleSendDirect(`My name is ${contactName.trim()} and my email is ${contactEmail.trim()}. Please save my contact details.`);
    setContactSubmitting(false);
    if (!sent) {
      setContactSubmitError('We could not send that yet. Please try again.');
      return;
    }
    setContactName('');
    setContactEmail('');
    setContactFormTouched(false);
  };

  const submitOrderForm = (event: React.FormEvent) => {
    event.preventDefault();
    if (!orderEmail.includes('@') || !orderNumber.trim()) return;
    void handleSendDirect(`Please check order ${orderNumber.trim()} for ${orderEmail.trim()}.`);
    setOrderEmail('');
    setOrderNumber('');
  };

  const startVoiceRecording = async () => {
    if (!voiceMessagesEnabled || isRecording || isTranscribing) return;
    setVoiceError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Voice recording is not supported in this browser.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingStreamRef.current = stream;
      recordedChunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setIsTranscribing(true);
        try {
          const audio = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const formData = new FormData();
          formData.append('portfolio_id', portfolioId);
          formData.append('audio', audio, 'voice-note.webm');
          const { data, error } = await supabase.functions.invoke('store-voice-transcribe', { body: formData });
          if (error || !data?.text) throw error || new Error('No transcription returned');
          await handleSendDirect(data.text);
        } catch (error) {
          console.error('Voice transcription failed:', error);
          setVoiceError(error instanceof Error ? error.message : 'Voice transcription failed.');
        } finally {
          setIsTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone access failed:', error);
      setVoiceError(error instanceof Error ? error.message : 'Microphone access was denied.');
    }
  };

  const stopVoiceRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  };

  const stopLiveVoice = useCallback(() => {
    liveDataChannelRef.current?.close();
    livePeerConnectionRef.current?.close();
    liveStreamRef.current?.getTracks().forEach(track => track.stop());
    liveDataChannelRef.current = null;
    livePeerConnectionRef.current = null;
    liveStreamRef.current = null;
    setLiveCallStatus('idle');
  }, []);

  const startLiveVoice = async () => {
    if (!liveVoiceEnabled || liveCallStatus !== 'idle') return;
    setLiveCallError('');
    setVoiceError('');
    setLiveCallStatus('connecting');
    try {
      const { data: session, error: sessionError } = await supabase.functions.invoke('store-realtime-session', { body: { portfolio_id: portfolioId } });
      const ephemeralKey = session?.client_secret?.value;
      if (sessionError || !ephemeralKey) throw sessionError || new Error('Voice session unavailable');

      const peer = new RTCPeerConnection();
      const audio = new Audio();
      audio.autoplay = true;
      peer.ontrack = event => {
        audio.srcObject = event.streams[0];
        liveAudioElRef.current = audio;
      };
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphone.getTracks().forEach(track => peer.addTrack(track, microphone));
      const channel = peer.createDataChannel('oai-events');
      channel.onmessage = event => {
        let payload: { type?: string; delta?: string; transcript?: string };
        try {
          payload = JSON.parse(event.data) as { type?: string; delta?: string; transcript?: string };
        } catch {
          return;
        }
        if (payload.type === 'conversation.item.input_audio_transcription.completed' && payload.transcript) {
          setLiveTranscript(prev => [...prev, { role: 'visitor', text: payload.transcript || '' }]);
        }
        if (payload.type === 'response.audio_transcript.delta' && payload.delta) {
          setLiveTranscript(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') return [...prev.slice(0, -1), { ...last, text: last.text + payload.delta }];
            return [...prev, { role: 'assistant', text: payload.delta || '' }];
          });
        }
      };
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const answer = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
        method: 'POST',
        body: offer.sdp,
        headers: { Authorization: `Bearer ${ephemeralKey}`, 'Content-Type': 'application/sdp' },
      });
      if (!answer.ok) throw new Error('Could not connect to live voice');
      await peer.setRemoteDescription({ type: 'answer', sdp: await answer.text() });
      livePeerConnectionRef.current = peer;
      liveDataChannelRef.current = channel;
      liveStreamRef.current = microphone;
      setLiveTranscript([]);
      setLiveCallStatus('active');
    } catch (error) {
      stopLiveVoice();
      setLiveCallError(error instanceof Error ? error.message : 'Live voice could not start');
    }
  };

  const addProductToCart = (product: { id: string; title: string; price?: number; images?: string[] }) => {
    addItem({
      id: product.id,
      title: product.title,
      price: Number(product.price || 0),
      image: product.images?.[0],
      quantity: 1,
      storeId: portfolioId,
    });
  };

  const getOrCreateConversation = async () => {
    const existingConversationId = conversationId || await conversationLookupRef.current;
    if (existingConversationId) {
      setConversationId(existingConversationId);
      return existingConversationId;
    }
    if (!visitorId) throw new Error('Visitor session is not ready');
    if (conversationPromiseRef.current) return conversationPromiseRef.current;

    conversationPromiseRef.current = visitorSupabaseRef.current
      .from('store_conversations')
      .insert({ portfolio_id: portfolioId, visitor_session_id: visitorId, status: 'open' })
      .select('id')
      .single()
      .then(({ data, error }) => {
        if (error || !data) throw error || new Error('Unable to create conversation');
        setConversationId(data.id);
        return data.id;
      })
      .finally(() => {
        conversationPromiseRef.current = null;
      });

    return conversationPromiseRef.current;
  };

  // 1. Setup Visitor Session
  useEffect(() => {
    let vid = localStorage.getItem('ucp_visitor_id');
    if (!vid) {
      vid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'v-' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('ucp_visitor_id', vid);
    }
    setVisitorId(vid);
    setVisitorReady(true);
    visitorSupabaseRef.current = createVisitorSupabase(vid);

    // Check for existing conversation
    conversationLookupRef.current = visitorSupabaseRef.current
        .from('store_conversations')
        .select('id')
        .eq('portfolio_id', portfolioId)
        .eq('visitor_session_id', vid)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setConversationId(data.id);
          return data?.id ?? null;
        });
  }, [portfolioId]);

  // 2. Fetch Messages and Subscribe to Realtime
  useEffect(() => {
    if (!conversationId) return;

    const fetchMessages = async () => {
      const { data } = await visitorSupabaseRef.current
        .from('store_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (data) {
         const latestMessage = data[data.length - 1] as StoreMessage | undefined;
         if (latestMessage?.sender_type === 'visitor') startAiTyping();
         if (latestMessage?.sender_type === 'ai_bot') stopAiTyping();
         setMessages(prev => {
             const temps = prev.filter(m => String(m.id).startsWith('temp-') && !data.some(d => d.content === m.content));
             return [...data, ...temps];
         });
      }
    };
    fetchMessages();

    const channel = visitorSupabaseRef.current.channel(`store_chat_${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'store_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        if (payload.new.sender_type === 'ai_bot') stopAiTyping();
        setMessages(prev => {
           if (prev.find(m => m.id === payload.new.id || (m.content === payload.new.content && m.id.toString().startsWith('temp-')))) {
              return prev.map(m => (m.content === payload.new.content && m.id.toString().startsWith('temp-')) ? payload.new : m);
           }
           return [...prev, payload.new];
        });
      })
      .subscribe();

    return () => { visitorSupabaseRef.current.removeChannel(channel); };
  }, [conversationId, startAiTyping, stopAiTyping]);

  useEffect(() => () => stopAiTyping(), [stopAiTyping]);
  useEffect(() => () => stopLiveVoice(), [stopLiveVoice]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

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

    let activeConvId: string;
    try {
      activeConvId = await getOrCreateConversation();
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      return;
    }

    const { error: msgError } = await visitorSupabaseRef.current.from('store_messages').insert({
      conversation_id: activeConvId,
      sender_type: 'visitor',
      content: msgContent
    });
    if (msgError) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      stopAiTyping();
      return;
    }
    startAiTyping();
  };

  // Fast-track function for the AI action buttons
  const handleSendDirect = async (text: string): Promise<boolean> => {
    if (!visitorReady) return false;
    let activeConvId: string;
    try {
      activeConvId = await getOrCreateConversation();
    } catch (error) {
      console.error('Error creating conversation:', error);
      return false;
    }
    
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, conversation_id: activeConvId, sender_type: 'visitor', content: text, created_at: new Date().toISOString() }]);

    const { error: msgError } = await visitorSupabaseRef.current.from('store_messages').insert({
      conversation_id: activeConvId, sender_type: 'visitor', content: text
    });
    if (msgError) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      stopAiTyping();
      return false;
    }
    startAiTyping();
    return true;
  };

  const handleResetChat = () => {
    if (window.confirm('Are you sure you want to clear this conversation and start fresh?')) {
      const newVid = 'v-' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('ucp_visitor_id', newVid);
      setVisitorId(newVid);
      visitorSupabaseRef.current = createVisitorSupabase(newVid);
      setConversationId(null);
      conversationPromiseRef.current = null;
      conversationLookupRef.current = Promise.resolve(null);
      setVisitorReady(true);
      stopAiTyping();
      setMessages([]);
    }
  };

  const isCustom = iconType === 'custom' && customIconUrl;
  const effectiveLauncherStyle = launcherStyle === 'message' && iconType !== 'message' ? iconType : launcherStyle;
  const patternStyle = panelPattern === 'dots'
    ? { backgroundImage: 'radial-gradient(rgba(100,116,139,.18) 1px, transparent 1px)', backgroundSize: '16px 16px' }
    : panelPattern === 'grid'
      ? { backgroundImage: 'linear-gradient(rgba(100,116,139,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(100,116,139,.12) 1px, transparent 1px)', backgroundSize: '20px 20px' }
      : panelPattern === 'diagonal'
        ? { backgroundImage: 'repeating-linear-gradient(135deg, rgba(100,116,139,.1) 0, rgba(100,116,139,.1) 1px, transparent 1px, transparent 12px)' }
        : undefined;

  return (
    <div className={cn(isInline ? "relative flex flex-col items-end w-full" : `fixed bottom-6 z-50 flex flex-col items-end ${launcherPosition === 'left' ? 'left-6' : 'right-6'}`)}>
      {isOpen && (
        <div role="dialog" aria-modal="true" aria-label={`${headerTitle || storeName} chat`} className={cn("mb-4 flex max-h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl transition-all", isInline ? "h-[450px] w-full max-w-[380px]" : "h-[min(450px,calc(100dvh-6rem))] w-[min(380px,calc(100vw-2rem))]")}>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-white" style={{ background: sendButtonColor }}>
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">{botName || headerTitle || storeName} {aiEnabled && <Bot className="h-3.5 w-3.5" />}</h3>
              <p className="flex items-center gap-1 text-[10px] opacity-75"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />{aiEnabled ? 'Online' : 'Usually replies soon'}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20" onClick={handleResetChat} title="Restart Conversation">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Close chat" title="Close chat" className="text-primary-foreground hover:bg-primary-foreground/20" onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <ScrollArea className="relative flex-1" style={{ backgroundColor: panelBackground, backgroundImage: panelGradient || (panelBackgroundImage ? `linear-gradient(rgba(248,250,252,.78), rgba(248,250,252,.78)), url(${panelBackgroundImage})` : patternStyle?.backgroundImage), backgroundSize: panelBackgroundImage ? 'cover' : patternStyle?.backgroundSize, backgroundPosition: 'center', ...(!panelBackgroundImage && !panelGradient ? patternStyle : {}) }}>
            <div className="space-y-4 p-4 pb-24">
                {liveCallStatus !== 'idle' && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-foreground">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{liveCallStatus === 'connecting' ? 'Connecting to live voice…' : 'Live voice active'}</span>
                      <Button type="button" size="sm" variant="outline" onClick={stopLiveVoice}><PhoneOff className="mr-1.5 h-3.5 w-3.5" /> End</Button>
                    </div>
                    {liveTranscript.length > 0 && <div className="mt-2 max-h-24 space-y-1 overflow-y-auto text-muted-foreground">{liveTranscript.slice(-6).map((line, index) => <p key={`${line.role}-${index}`}><strong>{line.role === 'visitor' ? 'You' : botName}:</strong> {line.text}</p>)}</div>}
                    {liveCallError && <p role="alert" className="mt-2 text-destructive">{liveCallError}</p>}
                  </div>
                )}
                {voiceError && <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"><span>{voiceError}</span><button type="button" className="font-semibold underline" onClick={() => setVoiceError('')}>Dismiss</button></div>}
                {messages.length === 0 && (
                   <div className="space-y-4">
                       <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm bg-background border rounded-bl-sm text-foreground">
                              {aiEnabled && <div className="flex items-center gap-1 mb-1 text-[10px] font-bold uppercase opacity-80"><Bot className="h-3 w-3" /> {botName}</div>}
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
                  const showContactForm = displayContent.includes('[CONTACT_FORM]');
                  const showOrderForm = displayContent.includes('[ORDER_FORM]');
                  if (displayContent.includes('[APPROVE_MARKETING]')) {
                      showApproveBtn = true;
                      displayContent = displayContent.replace('[APPROVE_MARKETING]', '').trim();
                  }
                      displayContent = displayContent.replace('[CONTACT_FORM]', '').trim();
                      displayContent = displayContent.replace('[ORDER_FORM]', '').trim();
                  const isLastMessage = i === messages.length - 1;

                  return (
                  <div key={i} className={`flex ${msg.sender_type === 'visitor' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.sender_type === 'visitor' ? 'text-white rounded-br-sm' : msg.sender_type === 'ai_bot' ? 'text-white rounded-bl-sm' : 'bg-background border rounded-bl-sm text-foreground'}`} style={msg.sender_type === 'visitor' ? { backgroundColor: visitorMessageColor } : msg.sender_type === 'ai_bot' ? { backgroundColor: aiMessageColor } : undefined}>
                      {msg.sender_type === 'ai_bot' && <div className="flex items-center gap-1 mb-1 text-[10px] font-bold uppercase opacity-80"><Bot className="h-3 w-3" /> {botName}</div>}
                      {displayContent}
                      {msg.message_type === 'product_recommendation' && Array.isArray(msg.metadata?.products) && (
                        <div className="mt-3 grid gap-2">
                          {(msg.metadata.products as Array<{ id: string; title: string; short_description?: string; price?: number; compare_at_price?: number; images?: string[]; slug?: string; stock_count?: number; delivery_type?: string; action_type?: string; checkout_url?: string }>).map(product => (
                            <div key={product.id} className="group rounded-xl bg-white/15 p-2 transition-colors hover:bg-white/25">
                              <a href={`/pro/${storeSlug || 'portfolio'}/product/${product.slug || product.id}`} className="flex gap-3">
                              {product.images?.[0] && <img src={product.images[0]} alt="" className="h-14 w-14 rounded-lg object-cover" />}
                              <span className="min-w-0 flex-1"><strong className="block truncate">{product.title}</strong><span className="block text-xs opacity-80">{product.short_description || 'View product details'}</span><span className="mt-1 flex items-center gap-2 text-xs font-semibold"><span>${product.price ?? 'Contact us'}</span>{product.compare_at_price && product.compare_at_price > (product.price || 0) && <del className="font-normal opacity-60">${product.compare_at_price}</del>}</span><span className="mt-1 block text-[10px] uppercase tracking-wide opacity-70">{product.delivery_type === 'physical' && product.stock_count === 0 ? 'Currently unavailable' : 'View details'} <span className="opacity-0 transition-opacity group-hover:opacity-100">→</span></span></span>
                              </a>
                              {product.action_type === 'link' && product.checkout_url ? <a href={product.checkout_url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-xs font-semibold underline underline-offset-2">Open product link</a> : product.action_type === 'cart' || !product.action_type ? <Button type="button" size="sm" className="mt-2 h-8 w-full bg-white text-slate-900 hover:bg-white/90" disabled={product.delivery_type === 'physical' && product.stock_count === 0} onClick={() => addProductToCart(product)}>{product.delivery_type === 'physical' && product.stock_count === 0 ? 'Unavailable' : 'Add to cart'}</Button> : <a href={`/pro/${storeSlug || 'portfolio'}/product/${product.slug || product.id}`} className="mt-2 block text-center text-xs font-semibold underline underline-offset-2">View options</a>}
                            </div>
                          ))}
                        </div>
                      )}
                      {showContactForm && (
                        <form onSubmit={submitContactForm} className="mt-3 space-y-2 rounded-xl bg-white/15 p-3" noValidate>
                          <p className="text-xs font-medium">Where should we reach you?</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="sr-only" htmlFor={`chat-contact-name-${msg.id}`}>Your name</label>
                            <Input id={`chat-contact-name-${msg.id}`} name="name" autoComplete="name" value={contactName} onChange={event => setContactName(event.target.value)} onBlur={() => setContactFormTouched(true)} placeholder="Your name" aria-label="Your name" className="h-9 bg-white text-slate-900" required />
                            <label className="sr-only" htmlFor={`chat-contact-email-${msg.id}`}>Email address</label>
                            <Input id={`chat-contact-email-${msg.id}`} name="email" type="email" autoComplete="email" value={contactEmail} onChange={event => setContactEmail(event.target.value)} onBlur={() => setContactFormTouched(true)} placeholder="Email address" aria-label="Email address" className="h-9 bg-white text-slate-900" required />
                          </div>
                          {contactFormTouched && (!contactName.trim() || !contactEmail.includes('@')) && <p className="text-[11px] text-white/80">Enter your name and a valid email.</p>}
                          {contactSubmitError && <p role="alert" className="text-[11px] text-white/90">{contactSubmitError}</p>}
                          <Button type="submit" size="sm" disabled={contactSubmitting || !contactName.trim() || !contactEmail.includes('@')} className="w-full bg-white text-slate-900 hover:bg-white/90">{contactSubmitting ? 'Sending...' : 'Continue'}</Button>
                        </form>
                      )}
                      {showOrderForm && (
                        <form onSubmit={submitOrderForm} className="mt-3 space-y-2 rounded-xl bg-white/15 p-3">
                          <Input type="email" value={orderEmail} onChange={event => setOrderEmail(event.target.value)} placeholder="Order email" aria-label="Order email" className="h-9 bg-white text-slate-900" required />
                          <Input value={orderNumber} onChange={event => setOrderNumber(event.target.value)} placeholder="Order number" aria-label="Order number" className="h-9 bg-white text-slate-900" required />
                          <Button type="submit" size="sm" className="w-full bg-white text-slate-900 hover:bg-white/90">Check order status</Button>
                        </form>
                      )}
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
                {aiTyping && (
                  <div className="flex justify-start animate-in fade-in duration-200" aria-live="polite">
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-white shadow-sm" style={{ backgroundColor: aiMessageColor }}>
                      <Bot className="h-3 w-3" />
                      <span>{botName} is typing</span>
                      <span className="flex gap-1" aria-hidden="true">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white" />
                      </span>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
            </div>
          </ScrollArea>
          <form onSubmit={handleSend} className="absolute bottom-3 left-3 right-3 z-10 flex items-center gap-1.5 rounded-2xl border border-border/60 bg-background/90 p-1.5 shadow-lg backdrop-blur-xl">
            {voiceMessagesEnabled && <Button type="button" variant={isRecording ? 'destructive' : 'outline'} size="icon" onClick={isRecording ? stopVoiceRecording : startVoiceRecording} disabled={isTranscribing || liveCallStatus !== 'idle'} aria-label={isRecording ? 'Stop voice recording' : 'Record voice message'} title={isTranscribing ? 'Transcribing voice message' : isRecording ? 'Stop recording' : 'Record voice message'}>{isTranscribing ? <Bot className="h-4 w-4 animate-pulse" /> : isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button>}
            {liveVoiceEnabled && <Button type="button" variant={liveCallStatus === 'active' ? 'destructive' : 'outline'} size="icon" onClick={liveCallStatus === 'idle' ? startLiveVoice : stopLiveVoice} disabled={isRecording || liveCallStatus === 'connecting'} aria-label={liveCallStatus === 'active' ? 'End live voice' : 'Start live voice'} title={liveCallStatus === 'active' ? 'End live voice' : 'Start live voice'}>{liveCallStatus === 'active' ? <PhoneOff className="h-4 w-4" /> : <Phone className="h-4 w-4" />}</Button>}
            <Input aria-label={inputPlaceholder} placeholder={inputPlaceholder} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="h-10 flex-1 rounded-xl border-0 bg-transparent shadow-none focus-visible:ring-0" />
            <Button type="submit" size="icon" className="rounded-full shrink-0 text-white" style={{ backgroundColor: sendButtonColor }} disabled={!newMessage.trim() || !visitorReady} title={sendButtonLabel} aria-label={sendButtonLabel}><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      )}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close chat' : `Open ${headerTitle || storeName} chat`}
          className={cn(
          "relative h-14 w-14 flex items-center justify-center bg-transparent border-0 outline-none shadow-none cursor-pointer transition-transform hover:scale-110 z-50", 
          isOpen ? "text-foreground" : "text-primary drop-shadow-2xl"
        )}
      >
        {isOpen ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background border shadow-md"><X className="h-6 w-6" /></div>
        ) : effectiveLauncherStyle === 'peek' ? (
          <div className={cn("flex h-16 w-16 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-2xl", launcherPosition === 'right' ? "translate-x-3" : "-translate-x-3")} title={`${botName} chat`}>
            <Bot className="h-9 w-9" strokeWidth={1.7} />
          </div>
        ) : (effectiveLauncherStyle === 'custom' || (!effectiveLauncherStyle && isCustom)) && customIconUrl ? (
          <img src={customIconUrl} alt="Chat" className="h-full w-full object-contain drop-shadow-2xl" />
        ) : (effectiveLauncherStyle || iconType) === 'sparkles' ? (
          <Sparkles className="h-12 w-12 drop-shadow-xl" strokeWidth={1.5} />
        ) : (effectiveLauncherStyle || iconType) === 'bot' ? (
          <Bot className="h-12 w-12 drop-shadow-xl" strokeWidth={1.5} />
        ) : (
          <MessageCircle className="h-14 w-14 drop-shadow-xl fill-current" strokeWidth={1} />
        )}
      </button>
    </div>
  );
};
export default StorefrontChatWidget;