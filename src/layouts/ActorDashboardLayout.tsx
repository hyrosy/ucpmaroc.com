import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/supabaseClient";
import {
  Outlet,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  User,
  Music,
  AudioLines,
  Settings,
  LogOut,
  MessageSquare,
  Menu,
  DollarSign,
  ChevronRight,
  LayoutTemplate,
  BarChart3,
  Briefcase,
  Package,
  Mail,
  ShoppingBag,
  Layers,
  CreditCard,
  Truck,
  Tag,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  Search,
  Coins,
  Plus,
  ArrowRightLeft,
  Sparkles,
  Palette,
  LayoutDashboard,
  Globe,
  Store,
  Users,
  Star,
  Mic,
  PencilLine,
  Video,
  PackageCheck,
  Bot,
  AlertTriangle,
  Receipt,
  MessageCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import ThemeToggle from "@/components/ThemeToggle";
import PlatformLoader from "@/components/PlatformLoader";
import TopUpModal from "@/features/portfolio-builder/components/TopUpModal"; // 🚀 IMPORT TOPUP MODAL
import FloatingCommunicationDock from "@/features/messaging/components/FloatingCommunicationDock";

export interface ActorDashboardContextType {
  actorData: Partial<Actor>;
  role: string;
  selectedSiteId: string;
  setSelectedSiteId: React.Dispatch<React.SetStateAction<string>>;
}

// --- 1. Interface ---
interface Actor {
  id: string;
  ActorName: string;
  slug?: string;
  HeadshotURL?: string;
  is_p2p_enabled?: boolean;
  wallet_balance?: number;
  is_suspended?: boolean;
  suspended_reason?: string;
  country?: string;
  marketplace_status?: string;
  email?: string;
}

// --- NAVIGATION STRUCTURE ---
const NAV_GROUPS = [
  {
    label: "Admin",
    app: "builder",
    items: [
      {
        to: "/dashboard",
        name: "Overview",
        icon: BarChart3,
        description: "Traffic & Shop Stats",
      },
      {
        to: "/dashboard/orders",
        name: "Orders",
        icon: Package,
        description: "Manage sales",
      },
      {
        to: "/dashboard/products",
        name: "Products",
        icon: ShoppingBag,
        description: "Manage inventory",
      },
      {
        to: "/dashboard/customers",
        name: "Customers",
        icon: Users,
        description: "Manage client accounts",
      },
      {
        to: "/dashboard/reviews",
        name: "Reviews",
        icon: Star,
        description: "Approve store reviews",
      },
      {
        to: "/dashboard/leads",
        name: "Leads & Inbox",
        icon: Mail,
        description: "Contact submissions",
      },
      {
        to: "/dashboard/store-inbox",
        name: "Store Inbox",
        icon: MessageCircle,
        description: "Visitor live chats",
      },
    ],
  },
  {
    label: "Sales Channels",
    app: "builder",
    items: [
      {
        to: "/dashboard/portfolio",
        name: "Website Editor",
        icon: LayoutTemplate,
        description: "Edit your site",
      },
    ],
  },
  {
    label: "Marketing & Tools",
    app: "builder",
    items: [
      {
        to: "/dashboard/coupons",
        name: "Coupons",
        icon: Tag,
        description: "Discounts & Promos",
      },
      {
        to: "/dashboard/forms",
        name: "Forms & Checkout",
        icon: FileText,
        description: "Checkout fields",
      },
    ],
  },
  {
    label: "Store Configuration",
    app: "builder",
    items: [
      {
        to: "/dashboard/payments",
        name: "Payments & Integrations",
        icon: CreditCard,
        description: "Stripe & Payouts",
      },
      {
        to: "/dashboard/markets",
        name: "Markets & Regions",
        icon: Globe,
        description: "Where you sell",
      },
      {
        to: "/dashboard/shipping",
        name: "Shipping Rates",
        icon: Truck,
        description: "Manage shipping rules",
      },
      {
        to: "/dashboard/store-bot",
        name: "Chat Widget",
        icon: Bot,
        description: "Storefront chat settings",
      },
    ],
  },
  {
    label: "Account & Settings",
    app: "both",
    items: [
      {
        to: "/dashboard/settings",
        name: "Settings & Sites",
        icon: Settings,
        description: "Manage domains & profile",
      },
      {
        to: "/dashboard/billing",
        name: "Billing",
        icon: Receipt,
        description: "Credits, services & payment methods",
      },
      {
        to: "/dashboard/profile",
        name: "My Profile",
        icon: User,
        description: "Manage personal details",
      },
      {
        to: "/dashboard/creator-hub",
        name: "All Themes",
        icon: LayoutDashboard,
        description: "Manage Themes",
      },
      {
        to: "/dashboard/studio",
        name: "Theme Editor",
        icon: Palette,
        description: "Build Themes & Earn",
      },
    ],
  },
  {
    label: "UCP Agency (Marketplace)",
    app: "marketplace",
    marketplaceOnly: true, // 🚀 NEW FLAG FOR GATING
    items: [
      {
        to: "/dashboard/job-orders",
        name: "Job Orders",
        icon: Briefcase,
        description: "Active jobs",
      },
      {
        to: "/dashboard/messages",
        name: "Inbox",
        icon: MessageSquare,
        description: "Client messages",
      },
      {
        to: "/dashboard/services",
        name: "Services",
        icon: Settings,
        description: "Manage rates",
        children: [
          { to: "/dashboard/services/voice-over", name: "Voice Over", icon: Mic },
          { to: "/dashboard/services/scriptwriting", name: "Scriptwriting", icon: PencilLine },
          { to: "/dashboard/services/video-editing", name: "Video Editing", icon: Video },
          { to: "/dashboard/services/delivery", name: "Delivery", icon: PackageCheck },
        ],
      },
      {
        to: "/dashboard/demos",
        name: "Demos",
        icon: Music,
        description: "Your audio/video",
      },
      {
        to: "/dashboard/library",
        name: "Library",
        icon: AudioLines,
        description: "Delivered files",
      },
      {
        to: "/dashboard/earnings",
        name: "Earnings",
        icon: DollarSign,
        description: "Payouts & History",
      },
    ],
  },
];

const mobilePrimaryItems = [
  { to: "/dashboard", name: "Stats", icon: BarChart3 },
  { to: "/dashboard/orders", name: "Orders", icon: Package },
  { to: "/dashboard/portfolio", name: "Editor", icon: LayoutTemplate },
  { to: "/dashboard/messages", name: "Inbox", icon: MessageSquare },
];

const serviceSubmenuItems = [
  { to: "/dashboard/services/voice-over", name: "Voice Over", icon: Mic },
  { to: "/dashboard/services/scriptwriting", name: "Scriptwriting", icon: PencilLine },
  { to: "/dashboard/services/video-editing", name: "Video Editing", icon: Video },
  { to: "/dashboard/services/delivery", name: "Delivery", icon: PackageCheck },
];

const DASHBOARD_APP_MODE_STORAGE_KEY = "ucp_dashboard_app_mode";

const ActorDashboardLayout = () => {
  const [actorData, setActorData] = useState<Partial<Actor>>({});
  const [loading, setLoading] = useState(true);
  const [isPinnedCollapsed, setIsPinnedCollapsed] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false); // 🚀 TOPUP MODAL STATE
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");
  const [appMode, setAppMode] = useState<"builder" | "marketplace">(() => {
    if (typeof window === "undefined") return "builder";
    return window.localStorage.getItem(DASHBOARD_APP_MODE_STORAGE_KEY) === "marketplace"
      ? "marketplace"
      : "builder";
  });

  const navigate = useNavigate();
  const location = useLocation();
  const isMessagesPage = location.pathname.includes("/dashboard/messages") || location.pathname.includes("/dashboard/store-inbox");
  const isShopActive =
    location.pathname.includes("/products") ||
    location.pathname.includes("/collections");
  const isMarketplaceRoute = [
    "/dashboard/services",
    "/dashboard/job-orders",
    "/dashboard/demos",
    "/dashboard/library",
    "/dashboard/earnings",
    "/dashboard/payout-settings",
  ].some((path) => location.pathname.startsWith(path));
  const isCollapsed = isPinnedCollapsed && !isSidebarHovered;

  const [tourStep, setTourStep] = useState(0);
  useEffect(() => {
    const handleTour = (event: Event) => setTourStep((event as CustomEvent<number>).detail);
    window.addEventListener("TOUR_STEP_CHANGED", handleTour);
    return () => window.removeEventListener("TOUR_STEP_CHANGED", handleTour);
  }, []);

  useEffect(() => {
    if (location.pathname.includes("/dashboard/portfolio") || location.pathname.includes("/dashboard/studio")) {
      setIsPinnedCollapsed(true);
    } else {
      setIsPinnedCollapsed(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DASHBOARD_APP_MODE_STORAGE_KEY, appMode);
    }
  }, [appMode]);

  useEffect(() => {
    if (isMarketplaceRoute) setAppMode("marketplace");
  }, [isMarketplaceRoute]);

  const fetchActorData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/actor-login");
      return;
    }

    const { data: actorProfile, error: actorError } = await supabase
      .from("actors")
      .select(
        "id, ActorName, slug, HeadshotURL, is_p2p_enabled, wallet_balance, is_suspended, suspended_reason, country, marketplace_status"
      )
      .eq("user_id", user.id)
      .single();

    if (actorError || !actorProfile) {
      navigate("/create-profile", { state: { roleToCreate: "actor" } });
      return;
    }

    setActorData({ ...actorProfile, email: user.email });
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    fetchActorData();
  }, [fetchActorData]);

  useEffect(() => {
    if (!actorData.id) return;

    const channel = supabase
      .channel(`topbar_wallet_${actorData.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "actors",
          filter: `id=eq.${actorData.id}`,
        },
        (payload) => {
          setActorData((prev) => ({
            ...prev,
            wallet_balance: payload.new.wallet_balance,
            is_suspended: payload.new.is_suspended,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [actorData.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/actor-login");
  };

  const handleSwitchToClient = () => {
    navigate("/client-dashboard");
  };

  if (loading) {
    return <PlatformLoader message="Loading Workspace..." />;
  }

  const isMoroccan = actorData.country === "Morocco";
  const isApprovedMarketplace = actorData.marketplace_status === "approved";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      <SubscriptionProvider actorId={actorData.id}>
        {/* --- GLOBAL TOP-UP MODAL --- */}
        <TopUpModal
          isOpen={isTopUpOpen}
          onOpenChange={setIsTopUpOpen}
          actorData={actorData}
          profile={actorData}
          onSuccess={fetchActorData}
          notify={(type, title, msg) => console.log(type, title, msg)} // Ideally pass your real notify function here if available globally
        />

              {/* --- TOPBAR --- */}
      <header className="flex h-14 border-b border-border/40 bg-background/95 backdrop-blur fixed top-0 w-full z-50 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setIsPinnedCollapsed((collapsed) => !collapsed);
              setIsSidebarHovered(false);
            }}
            className="hidden md:flex text-muted-foreground hover:text-foreground"
          >
            {isCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (

                <PanelLeftClose size={18} />
              )}
            </Button>
            <div className="font-bold tracking-tight text-sm flex items-center gap-2">
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md text-xs">
                PRO
              </span>
              Workspace
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 🚀 THE WALLET WIDGET */}
            <div
              className={cn(
                "flex items-center rounded-full pr-1 pl-3 h-9 mr-2 transition-all border",
                (actorData.is_suspended || (actorData.wallet_balance ?? 0) < 0)
                  ? "bg-destructive/10 border-destructive/30"
                  : "bg-amber-500/10 border-amber-500/20",
                tourStep === 2 && "relative z-[10001] ring-4 ring-amber-500/50 bg-background shadow-2xl scale-105 pointer-events-auto"
              )}
            >
              <Coins size={14} className={cn("mr-2", (actorData.is_suspended || (actorData.wallet_balance ?? 0) < 0) ? "text-destructive" : "text-amber-500")} />
              <span className={cn("font-black text-sm mr-3", (actorData.is_suspended || (actorData.wallet_balance ?? 0) < 0) ? "text-destructive" : "text-amber-600 dark:text-amber-400")}>
                {actorData.wallet_balance?.toLocaleString() || 0}
              </span>
              <Button
                size="icon"
                className={cn(
                  "h-7 w-7 rounded-full text-white shadow-sm transition-all",
                  (actorData.is_suspended || (actorData.wallet_balance ?? 0) < 0)
                    ? "bg-destructive hover:bg-destructive/90"
                    : "bg-amber-500 hover:bg-amber-600",
                  tourStep === 2 && "animate-pulse"
                )}
                onClick={() => {
                  setIsTopUpOpen(true);
                  if (tourStep === 2) {
                    window.dispatchEvent(new CustomEvent("TOUR_STEP_CHANGED", { detail: 3 }));
                  }
                }}
              >
                <Plus size={14} />
              </Button>
            </div>

            <div className={cn("flex items-center gap-2 transition-opacity duration-300", tourStep === 2 && "opacity-20 pointer-events-none")}>
              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:inline-flex text-muted-foreground hover:text-foreground"
              >
                <Search size={18} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:inline-flex text-muted-foreground hover:text-foreground"
              >
                <Bell size={18} />
              </Button>
              <ThemeToggle />

              <div className="h-6 w-px bg-border mx-2" />

              {/* 🚀 THE PROFILE SWITCHER DROPDOWN */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-3 ml-2 cursor-pointer group outline-none">
                    <span className="text-sm font-semibold text-foreground hidden lg:block group-hover:text-primary transition-colors">
                      {actorData.ActorName}
                    </span>
                    <Avatar className="h-8 w-8 border border-border group-hover:opacity-80 transition-opacity ring-2 ring-transparent group-hover:ring-primary/20">
                      <AvatarImage
                        src={actorData.HeadshotURL}
                        className="object-cover"
                      />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {actorData.ActorName?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
                  <DropdownMenuLabel className="flex flex-col">
                    <span>{actorData.ActorName}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {actorData.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSwitchToClient}
                    className="cursor-pointer py-2 text-sm font-medium"
                  >
                    <ArrowRightLeft
                      size={16}
                      className="mr-2 text-muted-foreground"
                    />
                    Switch to Client Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/dashboard/profile")}
                    className="cursor-pointer py-2 text-sm font-medium"
                  >
                    <User size={16} className="mr-2 text-muted-foreground" />{" "}
                    Account Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-red-500 focus:bg-red-50 focus:text-red-600 py-2 font-bold"
                  >
                    <LogOut size={16} className="mr-2" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* ========================================== */}
        {/* 2. THE APP BODY (Sidebar + Main Content)     */}
        {/* ========================================== */}
        <div className="flex flex-1 pt-14">
          <aside
            onMouseEnter={() => {
              if (isPinnedCollapsed) setIsSidebarHovered(true);
            }}
            onMouseLeave={() => setIsSidebarHovered(false)}
            className={cn(
              "hidden md:flex flex-col fixed left-0 h-[calc(100vh-3.5rem)] border-r border-border/40 bg-background/80 backdrop-blur-xl z-40 transition-all duration-300 ease-in-out",
              isCollapsed ? "w-[72px]" : "w-[260px]",
              isPinnedCollapsed && isSidebarHovered && "shadow-2xl"
            )}
          >
            <nav className="flex-1 overflow-y-auto py-6 space-y-6 custom-scrollbar overflow-x-hidden">
            {/* 🚀 APP SWITCHER */}
            {isApprovedMarketplace && !isCollapsed && (
              <div className="px-4 mb-2 animate-in fade-in">
                <div className="flex bg-muted/50 p-1 rounded-xl border">
                  <button
                    onClick={() => setAppMode("builder")}
                    className={cn(
                      "flex-1 text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-1.5",
                      appMode === "builder"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Store size={14} /> Builder
                  </button>
                  <button
                    onClick={() => setAppMode("marketplace")}
                    className={cn(
                      "flex-1 text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-1.5",
                      appMode === "marketplace"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Briefcase size={14} /> Agency
                  </button>
                </div>
              </div>
            )}
            {isApprovedMarketplace && isCollapsed && (
              <div className="px-3 mb-2 flex justify-center">
                 <Button variant="ghost" size="icon" onClick={() => setAppMode(appMode === "builder" ? "marketplace" : "builder")} title={`Switch to ${appMode === "builder" ? "Agency" : "Builder"}`}>
                    <ArrowRightLeft size={18} />
                 </Button>
              </div>
            )}
              {NAV_GROUPS.map((group, idx) => {
                // 🚀 MARKETPLACE GATING LOGIC
                if (group.marketplaceOnly && !isApprovedMarketplace)
                  return null;
              // 🚀 APP MODE GATING LOGIC
              if (group.app !== "both" && group.app !== appMode)
                return null;

                return (
                  <div key={idx} className="space-y-1">
                    <h3
                      className={cn(
                        "px-4 text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-2 transition-opacity duration-200",
                        isCollapsed && "opacity-0 h-0 overflow-hidden mb-0"
                      )}
                    >
                      {group.label}
                    </h3>
                    <div className="space-y-1 px-3">
                      {group.items.map((item) => {
                        const isProductTab = item.to === "/dashboard/products";
                        const isActiveOverride = isProductTab && isShopActive;
                        const isServicesTab = item.to === "/dashboard/services";
                        const isServicesActive = isServicesTab && location.pathname.startsWith("/dashboard/services");

                        return (
                          <div key={item.name}>
                            <NavLink
                              to={item.to}
                              end={[
                                "/dashboard",
                                "/dashboard/settings",
                                "/dashboard/payments",
                              ].includes(item.to)}
                              title={isCollapsed ? item.name : undefined}
                              className={({ isActive }) =>
                                cn(
                                  "group flex items-center rounded-lg transition-all duration-200 outline-none select-none relative",
                                  isCollapsed
                                    ? "justify-center h-10 w-10 mx-auto"
                                    : "gap-3 px-3 py-2 w-full",
                                  isActive || isActiveOverride || isServicesActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                )
                              }
                            >
                              <item.icon
                                className={cn(
                                  "shrink-0 transition-colors",
                                  isCollapsed ? "h-5 w-5" : "h-4 w-4"
                                )}
                              />
                              {!isCollapsed && (
                                <>
                                  <span className="text-sm font-medium truncate">
                                    {item.name}
                                  </span>
                                  <ChevronRight
                                    size={14}
                                    className={cn(
                                      "ml-auto transition-all",
                                      isActiveOverride ||
                                        isServicesActive ||
                                        location.pathname === item.to
                                        ? "opacity-100"
                                        : "opacity-0",
                                      isShopActive &&
                                        isProductTab &&
                                        "rotate-90"
                                    )}
                                  />
                                </>
                              )}
                            </NavLink>
                            {/* DYNAMIC SUBMENU */}
                            {!isCollapsed && isProductTab && isShopActive && (
                              <div className="ml-9 mt-1 mb-2 flex flex-col space-y-1 border-l-2 border-border/50 pl-3 animate-in slide-in-from-top-2 duration-200">
                                <NavLink
                                  to="/dashboard/products"
                                  end
                                  className={({ isActive }) =>
                                    cn(
                                      "text-sm py-1.5 px-2 rounded-md transition-colors",
                                      isActive
                                        ? "text-foreground font-semibold bg-muted/50"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                    )
                                  }
                                >
                                  All Products
                                </NavLink>
                                <NavLink
                                  to="/dashboard/collections"
                                  className={({ isActive }) =>
                                    cn(
                                      "text-sm py-1.5 px-2 rounded-md transition-colors flex items-center",
                                      isActive
                                        ? "text-foreground font-semibold bg-muted/50"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                    )
                                  }
                                >
                                  <Layers className="w-3.5 h-3.5 mr-2 opacity-70" />{" "}
                                  Collections
                                </NavLink>
                              </div>
                            )}
                            {!isCollapsed && isServicesTab && isServicesActive && (
                              <div className="ml-9 mt-1 mb-2 flex flex-col space-y-1 border-l-2 border-primary/20 pl-3 animate-in slide-in-from-top-2 duration-200">
                                {serviceSubmenuItems.map((service) => (
                                  <NavLink
                                    key={service.to}
                                    to={service.to}
                                    className={({ isActive }) =>
                                      cn(
                                        "flex items-center gap-2 text-sm py-1.5 px-2 rounded-md transition-colors",
                                        isActive
                                          ? "text-foreground font-semibold bg-muted/50"
                                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                      )
                                    }
                                  >
                                    <service.icon className="h-3.5 w-3.5 opacity-70" />
                                    {service.name}
                                  </NavLink>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* 🚀 AGENCY APPLICATION UPSELL (Visible only to unapproved Moroccans) */}
              {isMoroccan && !isApprovedMarketplace && !isCollapsed && (
                <div className="px-4">
                  <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-background p-4 mt-6 group animate-in fade-in">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity text-amber-500">
                      <Sparkles size={48} />
                    </div>
                    <div className="flex items-center gap-2 mb-1 text-amber-600 dark:text-amber-500">
                      <Briefcase size={14} />
                      <h4 className="font-bold text-xs tracking-wide uppercase">
                        Join Agency
                      </h4>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-3 font-medium leading-relaxed">
                      You're in Morocco! Apply to the UCP Marketplace to get
                      hired directly.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => navigate("/dashboard/profile")}
                      className="w-full h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                    >
                      Apply Now
                    </Button>
                  </div>
                </div>
              )}
            </nav>
          </aside>

          {/* ========================================== */}
          {/* 3. THE MAIN CONTENT AREA                     */}
          {/* ========================================== */}
          <main
            className={cn(
              "flex-1 min-w-0 min-h-[calc(100vh-3.5rem)] flex flex-col transition-all duration-300 ease-in-out bg-background",
              isPinnedCollapsed ? "md:ml-[72px]" : "md:ml-[260px]",
              isMessagesPage ? "app-bottom-safe md:pb-0" : "app-bottom-safe pb-20 md:pb-8"
            )}
          >
        {actorData.is_suspended && (
          <div role="alert" className="m-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle size={16} className="shrink-0" />
              Account suspended: your credit balance is negative. Settle the outstanding amount to unlock your account.
            </div>
            <Button size="sm" variant="destructive" onClick={() => setIsTopUpOpen(true)} className="shrink-0">
              Settle balance
            </Button>
          </div>
        )}
        <Outlet context={{ actorData, role: "actor", selectedSiteId, setSelectedSiteId }} />
          </main>
        </div>

        <FloatingCommunicationDock actorData={actorData} />

        {/* --- MOBILE BOTTOM NAV --- */}
        <nav aria-label="Primary workspace navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe">
          <div className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          <div className="bg-background/80 backdrop-blur-xl border-t border-border/60 pt-1">
            <div className="flex justify-around items-center h-16 px-1">
              {mobilePrimaryItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "group flex min-h-11 flex-col items-center justify-center w-full h-full space-y-1 relative active:scale-95 transition-transform duration-200 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute -top-1 w-8 h-1 rounded-b-full bg-primary shadow-[0_0_10px_rgba(0,0,0,0.2)] shadow-primary/50" />
                      )}
                      <div
                        className={cn(
                          "p-1.5 rounded-xl transition-colors",
                          isActive ? "bg-primary/10" : "group-hover:bg-muted"
                        )}
                      >
                        <item.icon
                          className={cn("h-5 w-5", isActive && "fill-current")}
                          strokeWidth={isActive ? 2.5 : 2}
                        />
                      </div>
                      <span className="text-[10px] font-semibold tracking-tight">
                        {item.name}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}

              <Sheet>
                <SheetTrigger asChild>
                  <button type="button" aria-label="Open workspace menu" className="flex min-h-11 flex-col items-center justify-center w-full h-full space-y-1 text-muted-foreground active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset">
                    <div className="p-1.5 rounded-xl hover:bg-muted">
                      <Menu className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-semibold tracking-tight">
                      Menu
                    </span>
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-full sm:w-[400px] border-l border-border/40 p-0 flex flex-col bg-background/95 backdrop-blur-2xl"
                >
                  <SheetHeader className="px-6 pt-8 pb-4 text-left border-b border-border/40 flex flex-row items-center justify-between">
                    <SheetTitle className="text-2xl font-bold">Menu</SheetTitle>
                    <ThemeToggle />
                  </SheetHeader>
                  <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
                    <div className="flex items-center gap-4 px-2">
                      <Avatar className="h-12 w-12 border-2 border-primary/20">
                        <AvatarImage
                          src={actorData.HeadshotURL}
                          className="object-cover"
                        />
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-lg">
                          {actorData.ActorName}
                        </p>
                        <p
                          className="text-xs text-muted-foreground cursor-pointer hover:underline"
                          onClick={handleSwitchToClient}
                        >
                          Switch to Client Mode
                        </p>
                      </div>
                    </div>
                    {/* Mobile App Switcher */}
                    {isApprovedMarketplace && (
                       <div className="px-2">
                         <div className="flex bg-muted/50 p-1 rounded-xl border">
                           <button onClick={() => setAppMode("builder")} className={cn("flex-1 text-xs font-bold py-2 rounded-lg transition-all", appMode === "builder" ? "bg-background shadow-sm" : "text-muted-foreground")}>
                             Store Builder
                           </button>
                           <button onClick={() => setAppMode("marketplace")} className={cn("flex-1 text-xs font-bold py-2 rounded-lg transition-all", appMode === "marketplace" ? "bg-background shadow-sm" : "text-muted-foreground")}>
                             Agency Hub
                           </button>
                         </div>
                       </div>
                    )}
                    {NAV_GROUPS.map((group, idx) => {
                      if (group.marketplaceOnly && !isApprovedMarketplace)
                        return null;
                      if (group.app !== "both" && group.app !== appMode)
                        return null;
                      return (
                        <div key={idx}>
                          <h4 className="px-2 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                            {group.label}
                          </h4>
                          <div className="grid gap-1">
                            {group.items.map((item) => {
                              const isServicesTab = item.to === "/dashboard/services";
                              const isServicesActive = isServicesTab && location.pathname.startsWith("/dashboard/services");
                              return <div key={item.name}>
                                <SheetClose
                                  onClick={() => navigate(item.to)}
                                  className={cn(
                                    "flex items-center gap-4 p-3 rounded-2xl hover:bg-muted/50 active:bg-muted transition-all w-full text-left",
                                    isServicesActive && "bg-primary/10 text-primary"
                                  )}
                                >
                                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <item.icon className="h-5 w-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-base truncate">
                                      {item.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground line-clamp-1">
                                      {item.description || "View section"}
                                    </div>
                                  </div>
                                  <ChevronRight
                                    size={16}
                                    className="text-muted-foreground/50 shrink-0"
                                  />
                                </SheetClose>
                                {isServicesTab && isServicesActive && <div className="ml-14 mt-1 mb-2 space-y-1 border-l-2 border-primary/20 pl-3">
                                  {serviceSubmenuItems.map((service) => <SheetClose key={service.to} onClick={() => navigate(service.to)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground w-full text-left"><service.icon className="h-4 w-4" />{service.name}</SheetClose>)}
                                </div>}
                              </div>;
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-6 border-t border-border/40 bg-muted/20">
                    <SheetClose asChild>
                      <Button
                        variant="destructive"
                        size="lg"
                        onClick={handleLogout}
                        className="w-full font-bold shadow-lg shadow-destructive/20"
                      >
                        Log Out
                      </Button>
                    </SheetClose>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </nav>
      </SubscriptionProvider>
    </div>
  );
};

export default ActorDashboardLayout;
