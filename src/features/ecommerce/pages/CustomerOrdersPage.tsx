import React, { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Package, ChevronRight, Clock, CheckCircle2, PlayCircle, XCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_MAP: any = {
  pending: { label: "Pending", icon: Clock, color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  in_progress: { label: "Processing", icon: PlayCircle, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  completed: { label: "Completed", icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  refunded: { label: "Refunded", icon: RotateCcw, color: "bg-gray-500/10 text-gray-600 border-gray-500/20" },
};

export default function CustomerOrdersPage() {
  const { customer, portfolio } = useOutletContext<any>();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!portfolio?.id) return;
      
      if (!customer?.id) {
        setLoading(false);
        return;
      }
      
      // 🚀 Auto-link previous guest orders by checking the email inside the notes column!
      const { data } = await supabase
        .from("pro_orders")
        .select("*")
        .eq("portfolio_id", portfolio.id)
        .or(`customer_id.eq.${customer.id},notes.ilike.%${customer.email}%`)
        .order("created_at", { ascending: false });

      if (data) setOrders(data);
      else setError("We could not load your orders.");
      setLoading(false);
    };
    fetchOrders();
  }, [customer, portfolio?.id]);

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error) return <div className="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center"><p className="font-semibold text-destructive">{error}</p><Button variant="outline" onClick={() => window.location.reload()}>Try again</Button></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-black text-foreground tracking-tight">Order History</h1>
        <p className="text-muted-foreground mt-1 font-medium">Track your purchases and view order details.</p>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed rounded-3xl bg-muted/10">
          <Package className="w-12 h-12 text-primary mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">No orders yet</h3>
          <p className="text-muted-foreground mb-6">Looks like you haven't made any purchases from this store.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusInfo = STATUS_MAP[order.status] || STATUS_MAP.pending;
            const StatusIcon = statusInfo.icon;

            return (
              <Card key={order.id} role="button" tabIndex={0} aria-label={`Open order ${order.product_name}`} className="rounded-2xl border-border shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary transition-all cursor-pointer group" onClick={() => navigate(`./${order.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`./${order.id}`); } }}>
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-muted/50 border flex items-center justify-center shrink-0">
                      <Package className="text-muted-foreground" size={24} />
                    </div>
                    <div>
                      <div className="font-bold text-foreground text-lg group-hover:text-primary transition-colors">{order.product_name}</div>
                      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Order #{order.id.substring(0, 8)} • {new Date(order.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-border">
                    <Badge variant="outline" className={cn("px-3 py-1 text-xs shadow-sm", statusInfo.color)}><StatusIcon size={12} className="mr-1.5" /> {statusInfo.label}</Badge>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="hidden sm:flex text-xs z-10 hover:text-primary" 
                      onClick={(e) => { e.stopPropagation(); navigate(`/pro/${portfolio.public_slug}/thank-you?order=${order.id}`); }}
                    >
                      View Receipt
                    </Button>
                    <ChevronRight className="text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}