import React, { useEffect, useState } from "react";
import { supabase } from "@/supabaseClient";
import { useOutletContext } from "react-router-dom";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";
import { Card } from "@/components/ui/card";
import { Mail, Phone, Calendar, ArrowUpRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SiteFilter from "@/components/dashboard/SiteFilter";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import DashboardState from "@/components/dashboard/DashboardState";

interface Site {
  id: string;
  site_name: string | null;
  public_slug?: string | null;
}

interface CustomerOrder {
  id: string;
  amount_cents?: number | null;
  product_price?: string | null;
  status?: string | null;
}

interface CustomerRecord {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  portfolio_id: string;
  created_at: string;
  pro_orders: CustomerOrder[];
}

export default function CustomersPage() {
  const { actorData, selectedSiteId, setSelectedSiteId } = useOutletContext<ActorDashboardContextType>();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!actorData?.id) return;
      setLoading(true);
      setLoadError(false);

      // First fetch sites to know which portfolios belong to this actor
      const { data: mySites, error: sitesError } = await supabase.from("portfolios").select("id, site_name, public_slug").eq("actor_id", actorData.id);
      if (sitesError) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      if (mySites) setSites(mySites);

      if (!mySites || mySites.length === 0) {
        setLoading(false);
        return;
      }

      const siteIds = mySites.map(s => s.id);

      const query = supabase
        .from("pro_customers")
        .select("*, pro_orders(id, amount_cents, product_price, status)")
        .in("portfolio_id", siteIds)
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) setLoadError(true);
      if (data) setCustomers(data);
      setLoading(false);
    };

    fetchCustomers();
  }, [actorData?.id]);

  const calculateLTV = (orders: CustomerOrder[]) => {
    if (!orders || orders.length === 0) return 0;
    return orders.reduce((sum, o) => {
      if (o.status === "cancelled" || o.status === "refunded") return sum;
      if (o.amount_cents) return sum + (o.amount_cents / 100);
      const parsed = parseFloat(o.product_price?.replace(/[^0-9.]/g, "") || "0");
      return sum + (isNaN(parsed) ? 0 : parsed);
    }, 0);
  };

  const filteredCustomers = customers.filter(c => selectedSiteId === "all" || c.portfolio_id === selectedSiteId);

  if (loading) return <DashboardState variant="loading" title="Loading customers" description="Preparing your customer workspace." className="mx-4 my-8 md:mx-auto md:max-w-7xl" />;
  if (loadError) return <DashboardState variant="error" title="Customers could not load" description="We couldn't retrieve customer data right now." actionLabel="Try again" onAction={() => window.location.reload()} className="mx-4 my-8 md:mx-auto md:max-w-7xl" />;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      <DashboardPageHeader
        title="Customers"
        description="Manage registered client accounts and lifetime value."
        actions={<div className="flex items-center gap-3">
          <SiteFilter
            sites={sites}
            selectedSiteId={selectedSiteId}
            onChange={setSelectedSiteId}
          />
        </div>}
      />

      {filteredCustomers.length === 0 ? (
        <DashboardState variant="empty" title="No customers yet" description="Customers will appear here after they create an account or place an order." />
      ) : (
        <Card className="rounded-xl shadow-sm border-border overflow-hidden animate-in fade-in">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-bold">Customer</TableHead>
                  <TableHead className="font-bold">Store</TableHead>
                  <TableHead className="font-bold">Joined</TableHead>
                  <TableHead className="font-bold text-center">Orders</TableHead>
                  <TableHead className="font-bold text-right">Lifetime Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((c) => {
                  const port = sites.find(s => s.id === c.portfolio_id);
                  const ltv = calculateLTV(c.pro_orders);
                  return (
                    <TableRow key={c.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="font-bold text-foreground flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">
                            {(c.name || "C")[0].toUpperCase()}
                          </div>
                          {c.name || "Customer"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                          <Mail size={12}/> {c.email}
                        </div>
                        {c.phone && (
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                            <Phone size={12}/> {c.phone}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-medium">
                        {port?.site_name || port?.public_slug || "Global"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <div className="flex items-center gap-1.5"><Calendar size={14}/> {new Date(c.created_at).toLocaleDateString()}</div>
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {c.pro_orders?.length || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-bold font-mono text-primary flex items-center justify-end gap-1">
                          ${ltv.toFixed(2)} <ArrowUpRight size={14}/>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}