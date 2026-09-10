// In src/components/ConversationChatBox.tsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/supabaseClient';
import { Send, ArrowLeft, RefreshCw, FilePlus2} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
// Note: This version doesn't include Voice Notes for simplicity.
// You can add it back by copying the logic from your old ChatBox.
import { MessageSquareText } from 'lucide-react'; // Import a nice icon
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // <-- Import Avatar
import { Link, useNavigate } from 'react-router-dom'; // <-- Add useNavigate
import CreateOfferFromChatModal from '@/components/CreateOfferFromChatModal'; // <-- Import new modal
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from "@/components/ui/card"; // <-- Import Card components

interface Message {
  id: string;
  created_at: string;
  sender_user_id: string;
  content: string;

}

interface OfferDetails {
    title: string;
    services: string;
    agreement: string;
    price: number;
}

interface ChatBoxProps {
  conversationId: string;
  currentUserId: string; // The auth.uid() of the logged-in user
  otherUserName: string;
  otherUserAvatar: string; // <-- Add avatar prop
  otherUser_AuthId: string;
  currentUserProfileType: 'client' | 'actor' | null; // <-- Add this prop
}

const ConversationChatBox: React.FC<ChatBoxProps> = ({ conversationId, currentUserId, otherUserName, otherUserAvatar, otherUser_AuthId, currentUserProfileType }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [messagesLoading, setMessagesLoading] = useState(true); // <-- Add loading state
    const navigate = useNavigate();
    const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
    const [isAcceptingOffer, setIsAcceptingOffer] = useState<string | null>(null); // Track which offer is being accepted
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Fetch initial messages
    useEffect(() => {
        const fetchMessages = async () => {
            setMessagesLoading(true); // <-- Start loading
            const { data, error } = await supabase
                .from('messages') 
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });
            
            if (error) {
                console.error("Error fetching messages:", error);
                setMessages([]);
            } else {
                setMessages(data || []);
            }
            setMessagesLoading(false); // <-- Stop loading
        };
        fetchMessages();
    }, [conversationId]);

    // Real-time subscription
    useEffect(() => {
        const channel = supabase.channel(`messages-for-${conversationId}`) // <-- NEW CHANNEL
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages', // <-- NEW TABLE
                filter: `conversation_id=eq.${conversationId}` 
            },
                (payload) => {
                    setMessages(currentMessages => [...currentMessages, payload.new as Message]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId]);
    
    // Scroll to bottom when new messages arrive
    useEffect(() => {
        setTimeout(scrollToBottom, 100);
    }, [messages]);

    // --- This function SENDS the [PENDING_OFFER] message ---
    const handleSendOffer = async (details: { title: string; services: string; agreement: string; price: number; }) => {
        const content = `[PENDING_OFFER]:${JSON.stringify(details)}`;
        
        await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_user_id: currentUserId,
                content: content,
            });
        setIsOfferModalOpen(false);
    };

    // --- This function is called by the CLIENT ---
    const handleAcceptOffer = async (offerDetails: OfferDetails) => {
        const offerId = btoa(JSON.stringify(offerDetails));
        setIsAcceptingOffer(offerId);

        try {
            const { data: newOrderId, error } = await supabase.rpc(
                'accept_chat_offer_and_create_order', {
                    p_actor_user_id: otherUser_AuthId, 
                    p_client_user_id: currentUserId, 
                    p_offer_title: offerDetails.title,
                    p_offer_agreement: offerDetails.agreement,
                    p_offer_price: offerDetails.price,
                    p_service_text: offerDetails.services // <-- Pass 'services' as 'p_service_text'
                }
            );

            if (error) throw error;

            // Success! Redirect the client to the order page to pay
            navigate(`/order/${newOrderId}`);

        } catch (error) {
            console.error("Error accepting offer:", error);
            setIsAcceptingOffer(null);
            // Show an error message to the user
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentUserId) return;
        setIsLoading(true);
        const contentToSend = newMessage.trim();
        setNewMessage('');
        
        await supabase
            .from('messages') // <-- NEW TABLE
            .insert({
                conversation_id: conversationId,
                sender_user_id: currentUserId,
                content: contentToSend,
            });  
        setIsLoading(false);
    };

    return (
            
        // Outer Container: Set relative for positioning
        <div className="relative h-full flex flex-col">
            
            {/* 1. Header (Top Bar) */}
            <div className="flex-shrink-0 p-3 border-b flex items-center gap-3 bg-background relative z-20">
                <Link                    to={currentUserProfileType === 'actor' ? '/dashboard/messages' : '/messages'} 
                    className="md:hidden p-1 rounded-full hover:bg-muted"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <Avatar>
                    <AvatarImage src={otherUserAvatar} alt={otherUserName} />
                    <AvatarFallback>{otherUserName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <h3 className="text-base font-semibold">{otherUserName}</h3>
                </div>
                {currentUserProfileType === 'actor' && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="ml-auto"
                        onClick={() => setIsOfferModalOpen(true)}
                    >
                        <FilePlus2 className="h-5 w-5" />
                    </Button>
                )}
            </div>

            {/* --- 2. Message Area (The Scrollable Content) --- */}
            {/* pb-32 lifts content above the fixed input form (p-4 + form height) 
               AND the fixed mobile dashboard nav bar (h-16). */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-6">
                {messagesLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <p>Loading messages...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center p-8 mt-20">
                        <MessageSquareText size={48} className="text-muted-foreground/50 mb-4" />
                        <h3 className="text-xl font-semibold">
                            Start the conversation
                        </h3>
                        <p className="text-muted-foreground mt-2">
                            This is the beginning of your direct message history with <strong className="text-foreground">{otherUserName}</strong>.
                        </p>
                    </div>
                ) : (

                    <div className="space-y-4">



                    {messages.map(msg => {
                    // --- RENDER THE NEW PENDING OFFER CARD ---
                    if (msg.content.startsWith('[PENDING_OFFER]:')) {
                            const offerJson = msg.content.substring(16);
                            const offerData = JSON.parse(offerJson);
                        const offerId = btoa(offerJson); // Same unique ID
                        
                        return (
                            <div key={msg.id} className={`flex my-4 ${
                                msg.sender_user_id === currentUserId ? 'justify-end' : 'justify-start'
                            }`}>
                                <Card className="w-[300px]">
                                    <CardHeader>
                                        <CardTitle>{offerData.title}</CardTitle>
                                        <CardDescription className="text-primary font-semibold">{offerData.services}</CardDescription>
                                        <CardDescription>
                                            {msg.sender_user_id === currentUserId 
                                                ? "You sent an offer" 
                                                : `Offer from ${otherUserName}`
                                            }
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-3xl font-bold">{offerData.price} MAD</p>
                                        <p className="text-sm text-muted-foreground mt-2">{offerData.agreement}</p>
                                    </CardContent>
                                    
                                    {/* Show "Accept" button ONLY to the client */}
                                    {msg.sender_user_id !== currentUserId && (
                                        <CardFooter>
                                            <Button 
                                                className="w-full"
                                                disabled={isAcceptingOffer === offerId}
                                                onClick={() => handleAcceptOffer(offerData)}
                                            >
                                                {isAcceptingOffer === offerId ? (
                                                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                                                ) : null}
                                                {isAcceptingOffer === offerId ? "Creating Order..." : "Review & Accept"}
                                            </Button>
                                        </CardFooter>
                                    )}
                                </Card>
                            </div>
                        );
                    }
                    
                    // --- RENDER THE CONFIRMED OFFER CARD ---
                    // This is the card from my *last* proposal. We'll keep it.
                    // This will be posted by the *new* function.
                    if (msg.content.startsWith('[OFFER]:')) {
                        // ... (keep the logic for the [OFFER] card here) ...
                        // This card links to the order page.
                    }

                    // --- Normal message bubble ---
                        return (

                        <div key={msg.id} className={`flex ${
                            msg.sender_user_id === currentUserId ? 'justify-end' : 'justify-start'
                        }`}>
                            <div className={`rounded-lg px-4 py-2 max-w-[80%] ${
                                msg.sender_user_id === currentUserId 
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                            }`}>
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                <p className={`text-xs text-right mt-1 ${
                                    msg.sender_user_id === currentUserId ? 'text-primary-foreground/70' : 'text-muted-foreground/70'
                                }`}>
                                  {new Date(msg.created_at).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    );
                  })}
                    <div ref={messagesEndRef} />
                </div>
                ) 
            }
        </div>            
           {/* --- 3. Input Form --- */}
            <div className="z-10 shrink-0 border-t bg-background p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:p-4">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        disabled={isLoading}
                    />
                    <Button 
                        type="submit"
                        size="icon"
                        disabled={isLoading || !newMessage.trim()}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>

            {/* --- MODAL RENDERING (This remains correct) --- */}
            {isOfferModalOpen && (
                <CreateOfferFromChatModal 
                    onClose={() => setIsOfferModalOpen(false)}
                    onSend={handleSendOffer}
                />
            )}
        </div>
    );
};

export default ConversationChatBox;