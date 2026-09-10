import React, { useEffect, useState, useRef } from "react";
import { useParams, useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Send, Package, MessageSquare, Badge } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CustomerOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { customer, portfolio } = useOutletContext<any>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOrderAndMessages = async () => {
      if (!id) return;
      
      if (!customer?.id) {
        setLoading(false);
        return;
      }
      
      const { data: oData } = await supabase.from("pro_orders").select("*").eq("id", id).or(`customer_id.eq.${customer.id},notes.ilike.%${customer.email}%`).maybeSingle();
      if (!oData) { navigate("../orders"); return; }
      setOrder(oData);

      const { data: mData } = await supabase.from("pro_order_messages").select("*").eq("order_id", id).order("created_at", { ascending: true });
      if (mData) setMessages(mData);
      setLoading(false);
    };
    
    fetchOrderAndMessages();

    // 🚀 SUPABASE REALTIME CHAT LISTENER
    const channel = supabase
      .channel(`order_chat_${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pro_order_messages", filter: `order_id=eq.${id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, customer?.id, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    setIsSending(true);
    const tempMsg = newMessage;
    setNewMessage("");

    await supabase.from("pro_order_messages").insert({
      order_id: id,
      sender_type: "customer",
      message: tempMsg,
    });
    setIsSending(false);
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate("../orders")} className="-ml-4 text-muted-foreground"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Orders</Button>
      
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-6">
          {/* LIVE CHAT INTERFACE */}
          <Card className="rounded-2xl border-border shadow-sm flex flex-col h-[500px]">
            <div className="p-4 border-b bg-muted/20 font-bold flex items-center gap-2 text-foreground">
              <MessageSquare size={16} className="text-primary" /> Order Chat
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/50">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                  <MessageSquare size={32} className="mb-2" />
                  <p className="text-sm">No messages yet. Say hello!</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={cn("flex flex-col max-w-[80%]", msg.sender_type === "customer" ? "ml-auto items-end" : "items-start")}>
                    <div className={cn("p-3 rounded-2xl text-sm", msg.sender_type === "customer" ? "bg-primary text-primary-foreground rounded-br-none" : "bg-muted text-foreground rounded-bl-none")}>
                      {msg.message}
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="p-3 border-t bg-background flex items-center gap-2 shrink-0">
              <Input placeholder="Type your message..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="rounded-full bg-muted/50 border-transparent focus-visible:ring-primary h-10" />
              <Button type="submit" size="icon" className="rounded-full shrink-0 h-10 w-10 shadow-sm" disabled={!newMessage.trim() || isSending}>
                {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                <span className="sr-only">Send message</span>
              </Button>
            </form>
          </Card>
        </div>

        {/* ORDER DETAILS PANEL */}
        <div className="w-full md:w-80 shrink-0 space-y-4">
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            <div className="p-4 bg-primary/5 border-b border-primary/10">
              <h3 className="font-black text-primary text-lg">Order #{order.id.substring(0, 6).toUpperCase()}</h3>
              <div className="text-xs text-muted-foreground font-medium mt-0.5">{new Date(order.created_at).toLocaleString()}</div>
            </div>
            <CardContent className="p-5 space-y-4">
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center shrink-0 border"><Package className="text-muted-foreground" size={20}/></div>
                <div>
                  <div className="font-bold text-foreground leading-tight">{order.product_name}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">{order.product_price} × {order.quantity}</div>
                </div>
              </div>
              <div className="pt-3 border-t">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Status</div>
                <Badge variant="outline" className="capitalize shadow-sm bg-background">{order.status.replace("_", " ")}</Badge>
              </div>
              <div className="pt-3 border-t">
                <Button variant="outline" className="w-full text-xs shadow-sm" onClick={() => navigate(`/pro/${portfolio?.public_slug || 'portfolio'}/thank-you?order=${order.id}`)}>
                  View Invoice & Downloads
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}