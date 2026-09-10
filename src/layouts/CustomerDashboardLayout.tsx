import React, { useEffect, useState } from "react";
import { Outlet, useParams, useNavigate, NavLink, useLocation } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { Loader2, Package, User, LogOut, Store, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CustomerPortfolio {
  id: string;
  site_name: string | null;
  public_slug: string;
}

interface CustomerProfile {
  name?: string | null;
  email?: string | null;
}

export default function CustomerDashboardLayout() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState<CustomerPortfolio | null>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);

  useEffect(() => {
    const initializeDashboard = async () => {
      setLoading(true);

      // 1. Verify Authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate(`/pro/${slug}/login`);
        return;
      }

      // 2. Fetch the specific store/portfolio the user is trying to access
      const { data: portData } = await supabase
        .from("portfolios")
        .select("id, site_name, public_slug")
        .eq("public_slug", slug)
        .maybeSingle();

      if (!portData) {
        navigate("/not-found");
        return;
      }
      setPortfolio(portData);

      // 3. Check if a pro_customer bridging record exists for this specific store
      let { data: custData } = await supabase
        .from("pro_customers")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("portfolio_id", portData.id)
        .maybeSingle();

      // 4. If no bridging record exists, create one! This makes them an official customer of this store.
      if (!custData) {
        const { data: newCust, error } = await supabase
          .from("pro_customers")
          .insert({
            user_id: session.user.id,
            portfolio_id: portData.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || "Customer",
          })
          .select()
          .single();

        if (!error && newCust) custData = newCust;
      }

      setCustomer(custData);
      setLoading(false);
    };

    initializeDashboard();
  }, [slug, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate(`/pro/${slug}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium text-sm">Loading your account...</p>
      </div>
    );
  }

  const NAV_ITEMS = [
    { name: "Overview", to: `/pro/${slug}/dashboard`, icon: User, end: true },
    { name: "Order History", to: `/pro/${slug}/dashboard/orders`, icon: Package, end: false },
    { name: "Messages", to: `/pro/${slug}/dashboard/messages`, icon: MessageSquare, end: false },
  ];

  return (
    <div className="min-h-[100dvh] bg-muted/10 flex min-h-0 flex-col md:flex-row pt-[var(--public-nav-height)]">
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex min-h-0 flex-col w-[260px] shrink-0 bg-background border-r border-border h-[calc(100dvh-var(--public-nav-height))] sticky top-[var(--public-nav-height)] z-40 overflow-y-auto custom-scrollbar">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate(`/pro/${slug}`)}>
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <Store size={20} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Store</div>
              <div className="font-black text-foreground leading-tight truncate">{portfolio.site_name || "My Shop"}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2">My Account</div>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <item.icon size={18} />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="px-3 py-2 mb-2">
            <div className="text-xs font-bold text-foreground truncate">{customer?.name || "Customer"}</div>
            <div className="text-[10px] text-muted-foreground truncate">{customer?.email}</div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
            <LogOut size={16} className="mr-2" /> Log out
          </Button>
        </div>
      </aside>

      {/* --- MOBILE HEADER & NAV --- */}
      <div className="md:hidden bg-background border-b border-border sticky top-[var(--public-nav-height)] z-40 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2 font-black text-lg" onClick={() => navigate(`/pro/${slug}`)}>
            <Store size={20} className="text-primary" /> {portfolio.site_name}
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground">
            <LogOut size={18} />
          </Button>
        </div>
        <div role="tablist" aria-label="Customer account navigation" className="flex overflow-x-auto overscroll-x-contain no-scrollbar px-2 pb-0 border-t border-border/50">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )
              }
              aria-current={location.pathname === item.to || (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)) ? 'page' : undefined}
            >
              <item.icon size={16} />
              {item.name}
            </NavLink>
          ))}
        </div>
      </div>

      {/* --- MAIN DASHBOARD CONTENT --- */}
      <main className="min-w-0 flex-1 px-4 py-5 pb-24 sm:px-6 md:px-8 md:py-8 md:pb-10">
        <Outlet context={{ customer, portfolio }} />
      </main>
    </div>
  );
}