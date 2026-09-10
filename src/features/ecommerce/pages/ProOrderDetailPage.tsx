import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  ArrowLeft,
  Package,
  Phone,
  ShoppingBag,
  User,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  RotateCcw,
  PlayCircle,
  Mail,
  Send,
  MessageSquare,
  Tag,
  FileDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STATUS_MAP = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  in_progress: {
    label: "In Progress",
    icon: PlayCircle,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
  refunded: {
    label: "Refunded",
    icon: RotateCcw,
    color: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
  },
};

export default function ProOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { actorData } = useOutletContext<ActorDashboardContextType>();

  const [order, setOrder] = useState<any>(null);
  const [siteName, setSiteName] = useState<string>("Portfolio");
  const [loading, setLoading] = useState(true);

  // Chat State
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Notes State
  const [internalNotes, setInternalNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id || !actorData.id) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("pro_orders")
        .select("*")
        .eq("id", id)
        .eq("actor_id", actorData.id)
        .maybeSingle();

      if (data) {
        setOrder(data);
        setInternalNotes(data.notes || "");
        if (data.portfolio_id) {
          const { data: site } = await supabase.from("portfolios").select("site_name").eq("id", data.portfolio_id).maybeSingle();
          if (site) setSiteName(site.site_name || "Portfolio");
        }
      }
      setLoading(false);
    };
    fetchOrder();
  }, [id, actorData.id]);

  // Chat Effect
  useEffect(() => {
    if (!order) return;
    const fetchMessages = async () => {
      const { data } = await supabase.from("pro_order_messages").select("*").eq("order_id", order.id).order("created_at", { ascending: true });
      if (data) setMessages(data);
    };
    fetchMessages();

    const channel = supabase
      .channel(`admin_order_chat_${order.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pro_order_messages", filter: `order_id=eq.${order.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [order?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateStatus = async (newStatus: string) => {
    setOrder({ ...order, status: newStatus });
    await supabase.from("pro_orders").update({ status: newStatus }).eq("id", order.id);
  };

  const saveNotes = async () => {
    setIsSavingNotes(true);
    await supabase.from("pro_orders").update({ notes: internalNotes }).eq("id", order.id);
    setOrder({ ...order, notes: internalNotes });
    setIsSavingNotes(false);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !order) return;
    setIsSendingMsg(true);
    const tempMsg = newMessage;
    setNewMessage("");
    await supabase.from("pro_order_messages").insert({
      order_id: order.id,
      sender_type: "owner",
      message: tempMsg,
    });
    setIsSendingMsg(false);
  };

  const formatOrderId = (idStr: string) => `#ORD-${idStr.substring(0, 6).toUpperCase()}`;
  const parseVariants = (variants: Record<string, any>, items?: any[]) => {
    if (items && items.length > 0) return null; // Handled individually
    if (!variants || Object.keys(variants).length === 0) return null;
    return Object.entries(variants).map(([key, val]) => `${key}: ${val?.label || val}`).join(" • ");
  };

  const extractOrderDetails = () => {
    const coreExtra: any = {};
    const customData: { key: string; value: string }[] = [];
    if (!order?.notes) return { coreExtra, customData };

    const redundantKeys = [
      "checkout_name", "name", "full name", "checkout_email", "email", "email address",
      "checkout_phone", "phone", "phone number", "checkout_address", "address", "shipping address",
      "street address", "checkout_city", "city", "checkout_zip", "zip", "zip code", "postal code",
      "zip / postal code", "checkout_country", "country", "payment method", "bank name",
      "account holder", "iban", "iban/account no", "payment intent"
    ];

    const parsedNotes = order.notes.split("\n")
      .filter((line: string) => line.includes(":") && !line.trim().startsWith("Cart Items:") && !line.trim().startsWith("Form Details:"))
      .map((line: string) => {
        const [key, ...rest] = line.split(":");
        return { key: key.trim(), value: rest.join(":").trim() };
      });

    parsedNotes.forEach((item: any) => {
      const k = item.key.toLowerCase();
      if (k === "checkout_email" || k === "email" || k === "email address") coreExtra.email = item.value;
      else if (k === "checkout_city" || k === "city") coreExtra.city = item.value;
      else if (k === "checkout_zip" || k === "zip" || k === "postal code") coreExtra.zip = item.value;
      else if (k === "checkout_country" || k === "country") coreExtra.country = item.value;
      else if (k === "payment method") coreExtra.paymentMethod = item.value;
      else if (k === "bank name") coreExtra.bankName = item.value;
      else if (k === "account holder") coreExtra.bankHolder = item.value;
      else if (k === "iban" || k === "iban/account no") coreExtra.bankIban = item.value;
      else if (k === "payment intent") coreExtra.paymentIntent = item.value;
      else if (!redundantKeys.includes(k) && !k.startsWith("field_")) customData.push(item);
    });
    return { coreExtra, customData };
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <h2 className="text-2xl font-bold mb-4">Order Not Found</h2>
        <Button onClick={() => navigate("/dashboard/orders")}>Back to Orders</Button>
      </div>
    );
  }

  const { coreExtra, customData } = extractOrderDetails();
  const StatusIcon = STATUS_MAP[order.status as keyof typeof STATUS_MAP]?.icon || Clock;

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-7xl mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/dashboard/orders")} className="h-10 w-10 rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                {formatOrderId(order.id)}
              </h1>
              <Badge variant="outline" className={cn("font-bold px-3 py-1 shadow-sm", STATUS_MAP[order.status as keyof typeof STATUS_MAP]?.color)}>
                <StatusIcon className="w-3 h-3 mr-1.5" /> {STATUS_MAP[order.status as keyof typeof STATUS_MAP]?.label}
              </Badge>
            </div>
            <div className="text-muted-foreground mt-1 text-sm font-medium flex items-center gap-2">
              {new Date(order.created_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
              <span>•</span>
              <span>Store: {siteName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2-COLUMN SHOPIFY LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Main Details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. Items */}
          <Card className="rounded-2xl border-border shadow-sm bg-background">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShoppingBag size={18} className="text-primary" /> Order Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {order.items && order.items.length > 0 ? (
                <div className="space-y-4">
                  {order.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-start justify-between gap-4 pb-4 border-b border-border/50 last:border-0 last:pb-0">
                      <div className="flex gap-4 items-center">
                        {item.image ? (
                          <div className="w-16 h-16 rounded-xl border bg-muted overflow-hidden shrink-0">
                            <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-xl border bg-muted flex items-center justify-center shrink-0">
                            <Package className="w-6 h-6 text-muted-foreground opacity-50" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-foreground text-base">
                            {item.title}
                          </div>
                          <div className="text-muted-foreground font-medium mt-1 text-sm">
                            Qty: {item.quantity}
                          </div>
                          {item.variant && item.variant !== "default" && (
                            <div className="text-muted-foreground font-medium mt-1.5 text-xs flex items-center gap-1 bg-muted w-max px-2 py-0.5 rounded-md">
                              <Tag size={12} /> {item.variant}
                            </div>
                          )}
                          {item.requiresShipping === false && (
                            <div className="text-blue-500 font-bold mt-1.5 text-xs flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 w-max px-2 py-0.5 rounded-md">
                              <FileDown size={12} /> Digital Delivery
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-base font-black font-mono text-foreground mt-1">
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-bold text-foreground text-lg">{order.product_name}</div>
                    <div className="text-muted-foreground font-medium mt-1">Qty: {order.quantity}</div>
                    {parseVariants(order.variants, order.items) && (
                      <div className="text-muted-foreground font-medium mt-2 text-sm flex items-center gap-1.5 bg-muted w-max px-2 py-1 rounded-md">
                        <Tag size={14} /> {parseVariants(order.variants, order.items)}
                      </div>
                    )}
                  </div>
                  <div className="text-xl font-black font-mono text-foreground bg-muted px-3 py-1.5 rounded-lg border border-border">
                    {order.product_price}
                  </div>
                </div>
              )}
              <div className="mt-6 pt-4 border-t border-border flex justify-between items-center bg-muted/30 p-4 rounded-xl">
                <span className="font-bold text-muted-foreground uppercase tracking-widest text-sm">Total Paid</span>
                <span className="text-2xl font-black font-mono text-foreground">
                  {order.amount_cents ? `$${(order.amount_cents / 100).toFixed(2)}` : order.product_price}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 2. Payment & Custom Form Data */}
          {(coreExtra.paymentMethod || customData.length > 0) && (
            <Card className="rounded-2xl border-border shadow-sm bg-background">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <DollarSign size={18} className="text-primary" /> Payment & Form Data
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {coreExtra.paymentMethod && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Method</Label>
                      <div className="font-bold mt-1">{coreExtra.paymentMethod}</div>
                    </div>
                    {coreExtra.paymentIntent && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Transaction ID</Label>
                        <div className="font-mono text-xs mt-1 text-muted-foreground break-all">{coreExtra.paymentIntent}</div>
                      </div>
                    )}
                  </div>
                )}
                {customData.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider border-b pb-1 w-full block">Custom Fields</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {customData.map((item, idx) => (
                        <div key={idx} className="bg-muted/30 p-3 rounded-lg border border-border">
                          <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">{item.key}</div>
                          <div className="font-medium text-sm whitespace-pre-wrap">{item.value || "—"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 3. Real-Time Chat */}
          <Card className="rounded-2xl border-border shadow-sm bg-background flex flex-col h-[500px]">
            <CardHeader className="border-b border-border/50 pb-4 shrink-0">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MessageSquare size={18} className="text-primary" /> Customer Chat
              </CardTitle>
            </CardHeader>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                  <MessageSquare size={32} className="mb-2" />
                  <p className="text-sm">No messages yet.</p>
                  <p className="text-xs">Send a message to update the customer.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={cn("flex flex-col max-w-[80%]", msg.sender_type === "owner" ? "ml-auto items-end" : "items-start")}>
                    <div className={cn("p-3 rounded-2xl text-sm shadow-sm", msg.sender_type === "owner" ? "bg-primary text-primary-foreground rounded-br-none" : "bg-card border border-border text-foreground rounded-bl-none")}>
                      {msg.message}
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">
                      {msg.sender_type === "owner" ? "You" : order.customer_name} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t bg-background flex items-center gap-3 shrink-0 rounded-b-2xl">
              <Input placeholder="Type a message to the customer..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="rounded-full bg-muted/50 border-transparent focus-visible:ring-primary h-12" />
              <Button type="submit" size="icon" className="rounded-full shrink-0 h-12 w-12 shadow-sm" disabled={!newMessage.trim() || isSendingMsg}>
                {isSendingMsg ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </Button>
            </form>
          </Card>

        </div>

        {/* RIGHT COLUMN: Customer & Internal Notes */}
        <div className="space-y-6">
          
          {/* 1. Customer */}
          <Card className="rounded-2xl border-border shadow-sm bg-background">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <User size={18} className="text-primary" /> Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {(order.customer_name || "G")[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-foreground text-base">
                    {order.customer_name || "Guest Checkout"}
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-border/50">
                {coreExtra.email && (
                  <div className="flex items-start gap-3">
                    <Mail size={16} className="text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email</div>
                      <a href={`mailto:${coreExtra.email}`} className="font-medium text-primary hover:underline mt-0.5 block">{coreExtra.email}</a>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Phone size={16} className="text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Phone</div>
                    <div className="font-medium text-foreground mt-0.5">{order.customer_phone || "Not provided"}</div>
                  </div>
                </div>
                {order.customer_address && order.customer_address !== "No Address Provided" && (
                  <div className="flex items-start gap-3">
                    <MapPin size={16} className="text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Shipping Address</div>
                      <div className="font-medium text-foreground mt-0.5 leading-relaxed">
                        {order.customer_address}
                        {(coreExtra.city || coreExtra.zip || coreExtra.country) && (
                          <div className="text-muted-foreground text-sm mt-1">
                            {[coreExtra.city, coreExtra.zip, coreExtra.country].filter(Boolean).join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 2. Order Status Update */}
          <Card className="rounded-2xl border-border shadow-sm bg-background">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <PlayCircle size={18} className="text-primary" /> Fulfillment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {order.items?.some((i: any) => i.requiresShipping === false) && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
                  <FileDown className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed font-medium">This order contains digital items or services. No physical shipping label is required.</p>
                </div>
              )}
              <Label className="font-bold text-foreground mb-2 block">Update Order Status</Label>
              <Select value={order.status} onValueChange={(val) => updateStatus(val)}>
                <SelectTrigger className="h-12 bg-background border-border rounded-xl font-medium focus:ring-primary shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-xl">
                  {Object.entries(STATUS_MAP).map(([key, info]) => (
                    <SelectItem key={key} value={key} className="font-medium cursor-pointer py-3">
                      <div className="flex items-center gap-2">
                        <info.icon className="w-4 h-4 opacity-50" /> {info.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* 3. Internal Notes */}
          <Card className="rounded-2xl border-border shadow-sm bg-background">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileText size={18} className="text-primary" /> Internal Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Add tracking links, internal references, or private notes here..."
                className="min-h-[120px] bg-muted/30 border-border rounded-xl resize-none focus:ring-primary shadow-sm"
              />
              <Button
                onClick={saveNotes}
                disabled={isSavingNotes || internalNotes === order.notes}
                className="w-full h-10 rounded-xl font-bold mt-4 shadow-sm"
              >
                {isSavingNotes ? <Loader2 className="animate-spin h-4 w-4" /> : "Save Notes"}
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}