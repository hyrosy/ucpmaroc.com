import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/supabaseClient";
import { useOutletContext } from "react-router-dom";
import { OrderDetailsModal } from '@/features/talent-marketplace';
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";

// --- shadcn/ui Imports ---
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// ---

// --- ENHANCEMENT: Import new icons ---
import { CalendarDays, ChevronRight, Clock3, FileText, Inbox, MessageCircle, Mic, Package, Paperclip, PencilLine, RefreshCw, Search, Video } from "lucide-react";

// --- Interface (Unchanged) ---
interface Order {
  actor_id: string;
  id: string;
  order_id_string: string;
  created_at: string;
  client_name: string;
  client_email: string;
  status: string;
  script: string;
  final_audio_url?: string;
  actors: {
    ActorName: string;
    ActorEmail?: string;
  };
  service_type: string;
  total_price: number | null;
  deliveries: {
    id: string;
    created_at: string;
    file_url: string;
    version_number: number;
  }[];
  last_message_content: string | null;
  last_message_timestamp: string | null;
  actor_has_unread_messages: boolean;
  client_has_unread_messages: boolean;
  from_chat_offer: boolean;
  material_file_urls: string[] | null; // <-- ADD THIS
  last_message_sender_role: "client" | "actor" | null;
  project_notes: string | null; // <-- ADD THIS
}

// --- ENHANCEMENT: Helper map for service icons ---
const serviceIcons = {
  voice_over: <Mic className="h-5 w-5" />,
  scriptwriting: <PencilLine className="h-5 w-5" />,
  video_editing: <Video className="h-5 w-5" />,
};

const serviceLabels: Record<string, string> = {
  voice_over: "Voice Over",
  scriptwriting: "Scriptwriting",
  video_editing: "Video Editing",
  delivery: "Delivery",
};

const needsActionStatuses = ["awaiting_offer", "offer_made", "Awaiting Actor Confirmation", "Awaiting Payment"];

const statusLabels: Record<string, string> = {
  awaiting_offer: "Awaiting your offer",
  offer_made: "Offer sent",
  "Awaiting Actor Confirmation": "Payment needs confirmation",
  "Awaiting Payment": "Awaiting payment",
  "In Progress": "In progress",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

const statusClasses: Record<string, string> = {
  awaiting_offer: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  offer_made: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "Awaiting Actor Confirmation": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "Awaiting Payment": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "In Progress": "bg-primary/15 text-primary",
  Completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Cancelled: "bg-destructive/15 text-destructive",
};

const DashboardOrders: React.FC = () => {
  const { actorData } = useOutletContext<ActorDashboardContextType>();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [activeOrderTab, setActiveOrderTab] = useState<
    "needs_action" | "active" | "completed" | "cancelled"
  >("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchOrders = useCallback(async () => {
    if (!actorData.id) return;
    setLoading(true);
    setError("");

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*, actors(ActorName, ActorEmail), deliveries(*)")
      .eq("actor_id", actorData.id)
      .order("created_at", { ascending: false });

    if (orderError) {
      setError(`Could not load orders: ${orderError.message}`);
    } else if (orderData) {
      const sortedOrderData = orderData.map((order) => ({
        ...order,
        deliveries: order.deliveries.sort(
          (
            a: { created_at: string | number | Date },
            b: { created_at: string | number | Date }
          ) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
      }));

      setOrders(sortedOrderData as Order[]);
    }
    setLoading(false);
  }, [actorData.id]); // <-- Add selectedOrder as a dependency

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]); // --- NEW: Realtime Subscription ---

  // ... after your existing useEffect ...

  useEffect(() => {
    // 1. Only subscribe if we have an actor ID
    if (!actorData.id) return; // 2. Create a channel to listen for changes

    const channel = supabase
      .channel(`public:orders:actor_id=eq.${actorData.id}`) // A unique name for this channel
      .on(
        "postgres_changes", // Listen for any database change
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `actor_id=eq.${actorData.id}`, // **IMPORTANT: Only listen for orders for THIS actor**
        },
        () => {
          setMessage("Orders updated.");
          fetchOrders();
        }
      )
      .subscribe(); // 3. The cleanup function: Unsubscribe when the component unmounts

    return () => {
      supabase.removeChannel(channel);
    };
  }, [actorData.id, fetchOrders]); // Re-run if actor or fetch function changes

  // 1. CREATE THE FUNCTION that does the actual work
  const handleActorConfirmPayment = async (orderId: string) => {
    // This is the logic that was missing

    // 1. Update the order status in Supabase
    const { error } = await supabase
      .from("orders")
      .update({ status: "In Progress" })
      .eq("id", orderId)
      .select() // <-- ADD .select()
      .single(); // <-- ADD .single()

    if (error) {
      console.error("Failed to update order status:", error);
      throw new Error(error.message);
    }

    await fetchOrders();

    // 4. Manually update the selectedOrder state
    setSelectedOrder((prev) =>
      prev ? { ...prev, status: "In Progress" } : null
    );
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const serviceTypes = Array.from(new Set(orders.map((order) => order.service_type))).filter(Boolean);
  const filteredOrders = orders.filter((order) => {
    const matchesTab = activeOrderTab === "needs_action"
      ? needsActionStatuses.includes(order.status)
      : activeOrderTab === "active"
        ? !["Completed", "Cancelled", ...needsActionStatuses].includes(order.status)
        : activeOrderTab === "completed"
          ? order.status === "Completed"
          : order.status === "Cancelled";
    const matchesSearch = !normalizedSearch || [order.order_id_string, order.client_name, order.client_email, serviceLabels[order.service_type] || order.service_type].some((value) => value?.toLowerCase().includes(normalizedSearch));
    const matchesService = serviceFilter === "all" || order.service_type === serviceFilter;
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesTab && matchesSearch && matchesService && matchesStatus;
  });

  const counts = {
    needsAction: orders.filter((order) => needsActionStatuses.includes(order.status)).length,
    active: orders.filter((order) => !["Completed", "Cancelled", ...needsActionStatuses].includes(order.status)).length,
    completed: orders.filter((order) => order.status === "Completed").length,
    cancelled: orders.filter((order) => order.status === "Cancelled").length,
  };

  // --- ENHANCEMENT: Helper component for the "Empty" state ---
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
      <Inbox className="h-16 w-16 mb-4" />
      <h3 className="text-lg font-semibold text-foreground">
        No {activeOrderTab.replace("_", " ")} orders
      </h3>
      <p className="text-sm">
        {activeOrderTab === "needs_action" &&
          "New requests and payment confirmations that need your attention will appear here."}
        {activeOrderTab === "active" &&
          "When a client accepts an offer, the order will move here."}
        {activeOrderTab === "completed" &&
          "After you deliver and get paid, orders will live here."}
        {activeOrderTab === "cancelled" && "Cancelled orders will be kept here for reference."}
      </p>
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-8 w-full max-w-8xl mx-auto ">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Agency workspace</p><h1 className="text-3xl font-bold">Orders</h1><p className="mt-1 text-sm text-muted-foreground">Manage requests, offers, delivery, and client activity from one place.</p></div>
        <Button variant="outline" onClick={fetchOrders} disabled={loading} className="gap-2"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh</Button>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-center text-sm">
          {message}
        </div>
      )}

      {error && <div className="mb-4 flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-center text-sm"><p className="text-destructive">{error}</p><Button variant="outline" onClick={fetchOrders}>Try again</Button></div>}

      <Card>
        <CardContent className="p-0 sm:p-6">
            <Tabs
            value={activeOrderTab}
            onValueChange={(value) =>
                setActiveOrderTab(value as "needs_action" | "active" | "completed" | "cancelled")
            }
          >
            <TabsList className="grid w-full grid-cols-2 rounded-none border-b sm:grid-cols-4 sm:rounded-lg sm:border-0">
              <TabsTrigger value="needs_action">
                Needs action
                {counts.needsAction > 0 && <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">{counts.needsAction}</span>}
              </TabsTrigger>
              <TabsTrigger value="active">Active <span className="ml-2 text-xs text-muted-foreground">{counts.active}</span></TabsTrigger>
              <TabsTrigger value="completed">Completed <span className="ml-2 text-xs text-muted-foreground">{counts.completed}</span></TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled <span className="ml-2 text-xs text-muted-foreground">{counts.cancelled}</span></TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="mt-6 grid gap-3 md:grid-cols-[1fr_180px_200px]">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search orders" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search client, order, or service" className="pl-9" /></div>
            <Select value={serviceFilter} onValueChange={setServiceFilter}><SelectTrigger><SelectValue placeholder="All services" /></SelectTrigger><SelectContent><SelectItem value="all">All services</SelectItem>{serviceTypes.map((service) => <SelectItem key={service} value={service}>{serviceLabels[service] || service.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{Array.from(new Set(orders.map((order) => order.status))).map((status) => <SelectItem key={status} value={status}>{statusLabels[status] || status}</SelectItem>)}</SelectContent></Select>
          </div>

          <div className="space-y-4 mt-6 p-6 sm:p-0">
            {loading ? (
              <p className="text-muted-foreground text-center py-4">
                Loading orders...
              </p>
            ) : filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                // --- ENHANCEMENT: Replaced Button with a clickable Card ---
                <Card
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedOrder(order); } }}
                  className={`group cursor-pointer border p-4 transition-all hover:border-primary/50 hover:bg-accent hover:shadow-md ${needsActionStatuses.includes(order.status) ? "border-l-4 border-l-primary" : ""}`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* --- Left Side: Order Info --- */}
                    <div className="flex items-center gap-4">
                      <span className="p-3 bg-muted rounded-full text-muted-foreground hidden sm:flex">
                        {/* --- ENHANCEMENT: Show service icon --- */}
                        {serviceIcons[order.service_type] || (
                          <Package className="h-5 w-5" />
                        )}
                      </span>
                      <div className="flex-grow">
                        <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-base text-foreground">{order.service_type === "voice_over" ? `Order #${order.order_id_string}` : `Quote #${order.order_id_string}`}</p><span className="text-xs text-muted-foreground">{serviceLabels[order.service_type] || order.service_type.replace(/_/g, " ")}</span></div>
                        <p className="text-sm text-muted-foreground">{order.client_name} · {order.client_email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(order.created_at).toLocaleDateString()}</span>{order.last_message_timestamp && <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />Recent activity</span>}{order.material_file_urls?.length ? <span className="flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" />Materials</span> : null}{order.deliveries?.length ? <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{order.deliveries.length} delivery{order.deliveries.length === 1 ? "" : "ies"}</span> : null}</div>
                      </div>
                    </div>

                    {/* --- Right Side: Status & Price --- */}
                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <span className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[order.status] || "bg-muted text-muted-foreground"}`}>{statusLabels[order.status] || order.status}</span>
                      {/* --- ENHANCEMENT: Show price --- */}
                      {order.total_price &&
                        order.status !== "awaiting_offer" && (
                          <p className="text-sm font-semibold text-foreground mt-0 sm:mt-1.5">
                            {order.total_price} MAD
                          </p>
                        )}
                      <div className="flex items-center gap-2 text-muted-foreground"><span className="sr-only">Open order</span>{order.actor_has_unread_messages && <MessageCircle className="h-4 w-4 text-primary" />}<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></div>
                    </div>
                  </div>
                </Card>
                // --- END ENHANCEMENT ---
              ))
            ) : (
              // --- ENHANCEMENT: Use new EmptyState component ---
              <EmptyState />
            )}
          </div>
        </CardContent>
      </Card>

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={fetchOrders}
          onActorConfirmPayment={handleActorConfirmPayment}
        />
      )}
    </div>
  );
};

export default DashboardOrders;
