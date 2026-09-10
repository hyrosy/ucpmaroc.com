import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/supabaseClient';
import { ArrowLeft, MessageCircle, Search, Send, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useOutletContext } from 'react-router-dom';
import { ActorDashboardContextType } from '@/layouts/ActorDashboardLayout';
import { toast } from 'sonner';

interface StoreMessage {
    id: string;
    conversation_id: string;
    sender_type: 'visitor' | 'owner' | 'ai_bot';
    content: string;
    created_at: string;
}

interface StoreConversation {
    id: string;
    visitor_session_id: string;
    status: string;
    updated_at: string;
    store_messages: StoreMessage[];
    last_message?: StoreMessage | null;
}

export default function StoreInboxPage() {
    const { actorData } = useOutletContext<ActorDashboardContextType>();
    const [conversations, setConversations] = useState<StoreConversation[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [messages, setMessages] = useState<StoreMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchConversations = async () => {
        setLoading(true);
        setLoadError(null);
        if (!actorData?.id) return;

        const { data: portfolios, error: portfoliosError } = await supabase.from('portfolios').select('id').eq('actor_id', actorData.id);
        if (portfoliosError) {
            setLoadError('Unable to load your stores.');
            setLoading(false);
            return;
        }
        const pIds = portfolios?.map(p => p.id) || [];
        
        if (pIds.length > 0) {
            const { data, error } = await supabase
                .from('store_conversations')
                .select('*, store_messages(content, created_at, sender_type)')
                .in('portfolio_id', pIds)
                .order('updated_at', { ascending: false });
            
            if (error) {
                setLoadError('Unable to load conversations.');
                setLoading(false);
                return;
            }
            const processed = data?.map(conv => {
                const sortedMsgs = conv.store_messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                return { ...conv, last_message: sortedMsgs[0] || null };
            }) || [];
            setConversations(processed);
        }
        setLoading(false);
    };

    // Load conversations for the Creator's stores
    useEffect(() => {
        if (actorData?.id) fetchConversations();

        // Global listener to update sidebar in real-time
        const globalChannel = supabase.channel('global_inbox_updates')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'store_messages' }, payload => {
                setConversations(prev => {
                    const conv = prev.find(c => c.id === payload.new.conversation_id);
                    if (conv) {
                        const others = prev.filter(c => c.id !== payload.new.conversation_id);
                        return [{ ...conv, updated_at: payload.new.created_at, last_message: payload.new }, ...others];
                    } else {
                        fetchConversations();
                        return prev;
                    }
                });
            })
            .subscribe();

        return () => { supabase.removeChannel(globalChannel); };
    }, [actorData?.id]);

    // Load messages when a conversation is selected
    useEffect(() => {
        if (!activeId) return;
        const fetchMessages = async () => {
            setMessagesLoading(true);
            const { data, error } = await supabase
                .from('store_messages')
                .select('*')
                .eq('conversation_id', activeId)
                .order('created_at', { ascending: true });
            if (error) toast.error('Unable to load messages.');
            else if (data) setMessages(data);
            setMessagesLoading(false);
        };
        fetchMessages();

        // Sub to real-time chat
        const channel = supabase.channel(`inbox_${activeId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'store_messages', filter: `conversation_id=eq.${activeId}` }, payload => {
                setMessages(prev => {
                    if (prev.find(m => m.id === payload.new.id || (m.content === payload.new.content && String(m.id).startsWith('temp-')))) {
                        return prev.map(m => (m.content === payload.new.content && String(m.id).startsWith('temp-')) ? payload.new : m);
                    }
                    return [...prev, payload.new];
                });
                setConversations(prev => prev.map(c => c.id === activeId ? { ...c, updated_at: payload.new.created_at, last_message: payload.new } : c));
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeId]);

    useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, activeId]);

    const visibleConversations = conversations.filter(conv => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return conv.visitor_session_id.toLowerCase().includes(query) || conv.last_message?.content.toLowerCase().includes(query);
    });

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeId) return;
        const msg = newMessage;
        setNewMessage('');
        setIsSending(true);
        
        // Optimistic UI update
        const tempId = `temp-${Date.now()}`;
        setMessages(prev => [...prev, { id: tempId, conversation_id: activeId, sender_type: 'owner', content: msg, created_at: new Date().toISOString() }]);

        const { error } = await supabase.from('store_messages').insert({ conversation_id: activeId, sender_type: 'owner', content: msg });
        if (error) {
            setMessages(prev => prev.filter(m => m.id !== tempId));
            toast.error('Unable to send your reply.');
            setNewMessage(msg);
            setIsSending(false);
            return;
        }

        // Automatically set status to agent_requested so AI stops replying
        const { error: statusError } = await supabase.from('store_conversations').update({ status: 'agent_requested', updated_at: new Date().toISOString() }).eq('id', activeId);
        if (statusError) toast.error('Reply sent, but human takeover could not be activated.');
        setIsSending(false);
    };

    return (
        <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 w-full flex-col overflow-hidden bg-background md:flex-row">
            {/* Left Sidebar */}
            <div className={`${activeId ? 'hidden md:flex' : 'flex'} h-full w-full shrink-0 flex-col border-b bg-background md:w-[300px] md:border-b-0 md:border-r lg:w-[350px]`}>
                <div className="border-b border-border/60 bg-background p-4">
                    <h2 className="font-semibold text-lg flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-primary" /> Store Inbox
                    </h2>
                    <div className="relative mt-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search visitors..." value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className="border-transparent bg-muted/50 pl-9" aria-label="Search conversations" />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    {loading ? <p className="p-4 text-center text-sm text-muted-foreground">Loading...</p>
                    : loadError ? <div className="flex flex-col items-center gap-3 p-8 text-center text-sm text-destructive"><p>{loadError}</p><Button variant="outline" size="sm" onClick={fetchConversations}>Try again</Button></div>
                    : visibleConversations.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">{searchQuery ? 'No conversations match your search.' : 'No active live chats.'}</p>
                    : <div className="flex flex-col">
                        {visibleConversations.map(conv => (
                            <button key={conv.id} onClick={() => setActiveId(conv.id)} className={`flex items-start gap-3 border-b p-4 text-left transition-colors hover:bg-muted/50 ${activeId === conv.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}>
                                <Avatar className="h-10 w-10 border bg-background"><AvatarFallback className="bg-muted text-muted-foreground"><User className="h-5 w-5" /></AvatarFallback></Avatar>
                                <div className="flex-1 overflow-hidden">
                                    <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium text-sm flex items-center gap-1">Visitor #{conv.visitor_session_id.substring(0, 4)} {conv.status === 'agent_requested' && <span className="h-2 w-2 rounded-full bg-orange-500" title="Agent Handling" aria-label="Agent handling" />}</span>
                                        <span className="text-[10px] text-muted-foreground">{new Date(conv.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{conv.last_message?.sender_type === 'owner' ? 'You: ' : ''}{conv.last_message?.content || 'Started a chat'}</p>
                                </div>
                            </button>
                        ))}
                    </div>}
                </ScrollArea>
            </div>

            {/* Right Chat Area */}
            <div className={`${activeId ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-1 flex-col bg-muted/10`}>
                {activeId ? (
                    <>
                        <div className="z-10 flex shrink-0 items-center justify-between border-b border-border/60 bg-background p-4">
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setActiveId(null)} aria-label="Back to conversations"><ArrowLeft className="h-4 w-4" /></Button>
                                <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-primary">V</AvatarFallback></Avatar>
                                <div>
                                    <h3 className="font-semibold text-sm">Visitor #{activeId.substring(0, 4)}</h3>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500"></span> Live conversation</span></div>
                                </div>
                            </div>
                        </div>
                        <ScrollArea className="min-h-0 flex-1 p-4 sm:p-6">
                            <div className="space-y-4">
                                {messagesLoading ? <div className="py-8 text-center text-sm text-muted-foreground">Loading messages...</div> : messages.map((msg) => {
                                    const isOwner = msg.sender_type === 'owner';
                                    const isBot = msg.sender_type === 'ai_bot';
                                    return (
                                        <div key={msg.id} className={`flex ${isOwner ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${isOwner ? 'bg-primary text-primary-foreground rounded-br-sm' : isBot ? 'bg-indigo-500 text-white rounded-bl-sm' : 'bg-background border rounded-bl-sm'}`}>
                                                {isBot && <div className="flex items-center gap-1 mb-1 text-[10px] font-bold uppercase opacity-80"><Bot className="h-3 w-3" /> AI Assistant</div>}

                                                {(msg.content || '').replace('[APPROVE_MARKETING]', '')}
                                                <div className={`text-[10px] text-right mt-1 ${isOwner || isBot ? 'opacity-70' : 'text-muted-foreground'}`}>{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                            </div>
                                        </div>
                                    )
                                })}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>
                        <div className="shrink-0 border-t border-border/60 bg-background p-4">
                            <form onSubmit={handleSend} className="flex gap-2">
                                <Input aria-label="Reply to visitor" placeholder="Type your reply..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1" disabled={isSending} />
                                <Button type="submit" disabled={!newMessage.trim() || isSending}><Send className="h-4 w-4 mr-2" /> {isSending ? 'Sending...' : 'Send'}</Button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex h-full min-h-64 flex-col items-center justify-center space-y-4 text-muted-foreground">
                        <MessageCircle className="h-12 w-12 opacity-20" /><p>Select a conversation to start chatting</p>
                    </div>
                )}
            </div>
        </div>
    );
}