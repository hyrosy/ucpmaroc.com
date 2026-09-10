import React, { useEffect, useState } from "react";
import { supabase } from "@/supabaseClient";
import { useOutletContext } from "react-router-dom";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  Eye,
  MousePointerClick,
  TrendingUp,
  Users,
  ShoppingBag,
  Activity,
  ShoppingCart,
  MessageCircle,
  Link as LinkIcon,
  FileText,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import SiteFilter from "@/components/dashboard/SiteFilter";
import { Badge } from "@/components/ui/badge";

const AnalyticsPage = () => {
  const { actorData, selectedSiteId, setSelectedSiteId } = useOutletContext<ActorDashboardContextType>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter State
  const [sites, setSites] = useState<any[]>([]);

  // Raw Data (Fetched Once)
  const [allEvents, setAllEvents] = useState<any[]>([]);

  // Computed Stats (Derived from Filter)
  const [stats, setStats] = useState({
    totalViews: 0,
    totalClicks: 0,
    viewsTrend: [] as any[],
    recentEvents: [] as any[],
    whatsappClicks: 0,
    cartClicks: 0,
    linkClicks: 0,
    formClicks: 0,
    topProducts: [] as any[],
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!actorData.id) return;
      setLoading(true);

      // 1. Fetch Sites for Filter
      const { data: mySites } = await supabase
        .from("portfolios")
        .select("id, site_name")
        .eq("actor_id", actorData.id);
      if (mySites) setSites(mySites);

      // 2. Fetch ALL Analytics Events (Last 30 days)
      // We fetch all and filter locally for speed and flexibility
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: events, error: eventsError } = await supabase
        .from("analytics_events")
        .select("*")
        .eq("actor_id", actorData.id)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (eventsError) {
        setError("We could not load your analytics right now.");
      } else if (events) {
        setAllEvents(events);
      }
      setLoading(false);
    };

    fetchData();
  }, [actorData.id]);

  // Recalculate when Filter or Data changes
  useEffect(() => {
    if (loading) return;

    // 1. Filter Events
    const filtered =
      selectedSiteId === "all"
        ? allEvents
        : allEvents.filter((e) => e.portfolio_id === selectedSiteId);

    // 2. Compute KPI Totals
    const views = filtered.filter((e) => e.event_type === "page_view");
    const clicks = filtered.filter((e) => e.event_type !== "page_view");

    // 3. Compute Chart Data (Group by Date)
    const dailyMap = new Map<string, number>();
    const clicksMap = new Map<string, number>();

    // Initialize last 30 days with 0
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      dailyMap.set(dateStr, 0);
      clicksMap.set(dateStr, 0);
    }

    views.forEach((v) => {
      const dateKey = v.created_at.split("T")[0];
      if (dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
      }
    });

    let whatsappClicks = 0;
    let cartClicks = 0;
    let linkClicks = 0;
    let formClicks = 0;
    const productCounts: Record<string, number> = {};

    clicks.forEach((c) => {
      const dateKey = c.created_at.split("T")[0];
      if (clicksMap.has(dateKey)) {
        clicksMap.set(dateKey, (clicksMap.get(dateKey) || 0) + 1);
      }

      if (c.event_type === "whatsapp_click") whatsappClicks++;
      else if (c.event_type === "add_to_cart") cartClicks++;
      else if (c.event_type === "link_click") linkClicks++;
      else if (c.event_type === "form_open" || c.event_type === "form_submit") formClicks++;
      else linkClicks++;

      const pName = c.metadata?.product_name;
      if (pName) {
        productCounts[pName] = (productCounts[pName] || 0) + 1;
      }
    });

    const trendData = Array.from(dailyMap.entries()).map(([date, view_count]) => ({
      date,
      view_count,
      click_count: clicksMap.get(date) || 0,
    }));

    const topProducts = Object.entries(productCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 4. Update State
    setStats({
      totalViews: views.length,
      totalClicks: clicks.length,
      viewsTrend: trendData,
      recentEvents: clicks.slice(0, 10), // Show last 10 interactions
      whatsappClicks,
      cartClicks,
      linkClicks,
      formClicks,
      topProducts,
    });
  }, [selectedSiteId, allEvents, loading]);

  if (loading)
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  if (error)
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-center">
        <p className="font-semibold text-destructive">{error}</p>
        <button type="button" onClick={() => window.location.reload()} className="text-sm font-semibold text-primary hover:underline">
          Try again
        </button>
      </div>
    );

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-8xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">Analytics & Insights</h1>
          <p className="text-muted-foreground mt-2 font-medium">
            Deep tracking of your portfolio performance and engagement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SiteFilter
            sites={sites}
            selectedSiteId={selectedSiteId}
            onChange={setSelectedSiteId}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden relative">
          <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{stats.totalViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Past 30 Days</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-sm overflow-hidden relative">
          <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/10 rounded-bl-full -mr-4 -mt-4" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Interactions</CardTitle>
            <MousePointerClick className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{stats.totalClicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Clicks on Shop/Links
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-sm overflow-hidden relative">
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Conv. Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">
              {stats.totalViews > 0
                ? ((stats.totalClicks / stats.totalViews) * 100).toFixed(1)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Visitor to Interaction</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-sm overflow-hidden relative">
          <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/10 rounded-bl-full -mr-4 -mt-4" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Cart & Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{stats.cartClicks + stats.whatsappClicks}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Checkout Intents</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Main Chart */}
        <Card className="lg:col-span-2 rounded-2xl shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><Activity size={18} className="text-primary"/> Traffic & Engagement</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px] pt-4">
            {stats.viewsTrend.some((d) => d.view_count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.viewsTrend}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--muted-foreground))"
                    opacity={0.1}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) =>
                      new Date(val).toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "short",
                      })
                    }
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    minTickGap={30}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      color: "hsl(var(--foreground))",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    }}
                    cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "3 3" }}
                    labelFormatter={(val) =>
                      new Date(val).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="view_count"
                    name="Page Views"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    fill="url(#colorViews)"
                  />
                  <Area
                    type="monotone"
                    dataKey="click_count"
                    name="Interactions"
                    stroke="#10b981"
                    strokeWidth={3}
                    fill="url(#colorClicks)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/20 border-2 border-dashed rounded-xl">
                <Activity className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-sm font-medium">No traffic data yet. Share your link!</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Interaction Breakdown */}
        <Card className="rounded-2xl shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><MousePointerClick size={18} className="text-primary"/> Action Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2 font-medium text-muted-foreground"><MessageCircle size={14} className="text-green-500" /> WhatsApp Orders</span>
                <span className="font-bold">{stats.whatsappClicks}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-1000" style={{ width: `${stats.totalClicks > 0 ? (stats.whatsappClicks / stats.totalClicks) * 100 : 0}%` }} />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2 font-medium text-muted-foreground"><ShoppingCart size={14} className="text-blue-500" /> Add to Cart</span>
                <span className="font-bold">{stats.cartClicks}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${stats.totalClicks > 0 ? (stats.cartClicks / stats.totalClicks) * 100 : 0}%` }} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2 font-medium text-muted-foreground"><FileText size={14} className="text-amber-500" /> Form Submissions</span>
                <span className="font-bold">{stats.formClicks}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-1000" style={{ width: `${stats.totalClicks > 0 ? (stats.formClicks / stats.totalClicks) * 100 : 0}%` }} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2 font-medium text-muted-foreground"><LinkIcon size={14} className="text-purple-500" /> Link Clicks</span>
                <span className="font-bold">{stats.linkClicks}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full transition-all duration-1000" style={{ width: `${stats.totalClicks > 0 ? (stats.linkClicks / stats.totalClicks) * 100 : 0}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 pb-8">
        {/* Recent Activity Feed */}
        <Card className="lg:col-span-2 rounded-2xl shadow-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity size={18} className="text-primary"/> Live Activity Feed</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <div className="space-y-0">
              {stats.recentEvents.length > 0 ? (
                stats.recentEvents.map((event, i) => (
                  <div key={event.id || i} className="flex items-start gap-4 py-4 border-b border-border last:border-0 last:pb-0 hover:bg-muted/10 transition-colors rounded-xl px-2">
                    <div className={cn("p-2.5 rounded-xl mt-0.5 shadow-sm", event.event_type.includes("whatsapp") ? "bg-green-100 text-green-600" : event.event_type.includes("cart") ? "bg-blue-100 text-blue-600" : event.event_type.includes("form") ? "bg-amber-100 text-amber-600" : "bg-purple-100 text-purple-600")}>
                      {event.event_type.includes("whatsapp") ? (
                        <MessageCircle size={18} />
                      ) : event.event_type.includes("form") ? (
                        <FileText size={18} />
                      ) : event.event_type.includes("link") ? (
                        <LinkIcon size={18} />
                      ) : (
                        <ShoppingCart size={18} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {event.event_type === "whatsapp_click"
                          ? "Started WhatsApp Order"
                          : event.event_type === "form_submit" || event.event_type === "form_open"
                          ? "Interacted with Form"
                          : "Clicked Product Link"}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-medium mt-0.5 uppercase tracking-wider">
                        {new Date(event.created_at).toLocaleDateString()} at{" "}
                        {new Date(event.created_at).toLocaleTimeString()}
                      </p>
                      {event.metadata?.product_name && (
                        <Badge variant="secondary" className="mt-2 text-[10px] bg-muted font-bold text-muted-foreground">
                          {event.metadata.product_name}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground font-medium">
                  No recent interactions. Share your portfolio to get started!
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="rounded-2xl shadow-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingBag size={18} className="text-primary"/> Top Products</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <div className="space-y-4">
              {stats.topProducts.length > 0 ? (
                stats.topProducts.map((prod, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-muted/20 p-3 rounded-xl border border-border/50">
                    <div className="flex items-center gap-3 overflow-hidden pr-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0">
                        {idx + 1}
                      </div>
                      <span className="font-bold text-sm truncate" title={prod.name}>{prod.name}</span>
                    </div>
                    <Badge variant="outline" className="font-mono bg-background shadow-sm shrink-0">
                      {prod.count} clicks
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground font-medium">
                  Not enough data to rank products.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsPage;
