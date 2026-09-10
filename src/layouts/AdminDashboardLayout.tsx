import React, { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";
import { Outlet, NavLink, useNavigate, Link } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Users,
  ShieldCheck,
  LogOut,
  Menu,
  DollarSign,
  ChevronRight,
  Globe,
  Briefcase,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Palette,
  Layers3,
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
import ThemeToggle from "../components/ThemeToggle";
import PlatformLoader from "../components/PlatformLoader";

// --- NAVIGATION STRUCTURE ---
const NAV_GROUPS = [
  {
    label: "Platform",
    items: [{ to: "/admin", name: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Management",
    items: [
      { to: "/admin/actors", name: "Users & Vendors", icon: Users },
      { to: "/admin/clients", name: "Clients", icon: Briefcase },
      { to: "/admin/payouts", name: "Financial Payouts", icon: DollarSign },
      { to: "/admin/marketplace-settings", name: "Marketplace Settings", icon: Layers3 },
      { to: "/admin/domains", name: "Custom Domains", icon: Globe },
      { to: "/admin/themes", name: "Themes", icon: Palette },

    ],
  },
];

const AdminDashboardLayout = () => {
  const [adminData, setAdminData] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAdminData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/actor-login");
        return;
      }
      setAdminData({ id: user.id, email: user.email || "Admin" });
      setLoading(false);
    };
    fetchAdminData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/actor-login");
  };

  if (loading) return <PlatformLoader message="Loading Admin Panel..." />;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* --- TOPBAR --- */}
      <header className="flex h-14 border-b border-border/40 bg-background/95 backdrop-blur fixed top-0 w-full z-50 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex text-muted-foreground hover:text-foreground"
          >
            {isCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </Button>
          <div className="font-bold tracking-tight text-sm flex items-center gap-2">
            <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded-md text-xs border border-red-500/20">
              <ShieldCheck size={12} className="inline mr-1 mb-0.5" /> ADMIN
            </span>
            Control Panel
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="h-6 w-px bg-border mx-2" />
          <div className="flex items-center gap-3 ml-2">
            <span className="text-sm font-semibold text-foreground hidden lg:block">
              {adminData?.email}
            </span>
            <Avatar className="h-8 w-8 border border-border">
              <AvatarFallback className="text-xs bg-red-500/10 text-red-500">
                AD
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* --- BODY --- */}
      <div className="flex flex-1 pt-14">
        {/* --- SIDEBAR --- */}
        <aside
          className={cn(
            "hidden md:flex flex-col fixed left-0 h-[calc(100vh-3.5rem)] border-r border-border/40 bg-background/80 backdrop-blur-xl z-40 transition-all duration-300 ease-in-out",
            isCollapsed ? "w-[72px]" : "w-[260px]"
          )}
        >
          <nav className="flex-1 overflow-y-auto py-6 space-y-6 custom-scrollbar">
            {NAV_GROUPS.map((group, idx) => (
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
                  {group.items.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.to}
                      end={item.to === "/admin"}
                      title={isCollapsed ? item.name : undefined}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center rounded-lg transition-all duration-200 outline-none select-none relative",
                          isCollapsed
                            ? "justify-center h-10 w-10 mx-auto"
                            : "gap-3 px-3 py-2 w-full",
                          isActive
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
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
                            className={cn("ml-auto transition-all opacity-0")}
                          />
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="p-3 border-t border-border/40">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className={cn(
                "w-full text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all",
                isCollapsed
                  ? "justify-center px-0 h-10 w-10 mx-auto"
                  : "justify-start px-3 h-9"
              )}
              title={isCollapsed ? "Log Out" : undefined}
            >
              <LogOut
                className={cn(
                  "shrink-0",
                  isCollapsed ? "h-5 w-5" : "mr-2 h-4 w-4"
                )}
              />
              {!isCollapsed && <span className="text-sm">Log Out</span>}
            </Button>
          </div>
        </aside>

        {/* --- MAIN CONTENT --- */}
        <main
          className={cn(
            "flex-1 min-w-0 min-h-[calc(100vh-3.5rem)] flex flex-col transition-all duration-300 ease-in-out bg-background",
            isCollapsed ? "md:ml-[72px]" : "md:ml-[260px]",
            "app-bottom-safe pb-20 md:pb-8"
          )}
        >
          <Outlet />
        </main>
      </div>

      {/* --- MOBILE NAV --- */}
      <nav aria-label="Primary admin navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/60 pb-safe">
        <div className="flex justify-around items-center h-16 px-1">
          {NAV_GROUPS[0].items.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "group flex min-h-11 flex-col items-center justify-center w-full h-full space-y-1 relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-inset",
                  isActive ? "text-red-500" : "text-muted-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={cn(
                      "p-1.5 rounded-xl",
                      isActive ? "bg-red-500/10" : "group-hover:bg-muted"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
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
              <button type="button" aria-label="Open admin menu" className="flex min-h-11 flex-col items-center justify-center w-full h-full space-y-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-inset">
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
              className="w-full sm:w-[400px] p-0 flex flex-col bg-background/95 backdrop-blur-2xl border-l"
            >
              <SheetHeader className="px-6 pt-8 pb-4 text-left border-b border-border/40 flex flex-row items-center justify-between">
                <SheetTitle className="text-2xl font-bold text-red-500">
                  Admin Menu
                </SheetTitle>
                <ThemeToggle />
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
                {NAV_GROUPS.map((group, idx) => (
                  <div key={idx}>
                    <h4 className="px-2 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      {group.label}
                    </h4>
                    <div className="grid gap-1">
                      {group.items.map((item) => (
                        <SheetClose asChild key={item.name}>
                          <Link
                            to={item.to}
                            className="flex items-center gap-4 p-3 rounded-2xl hover:bg-muted/50 transition-all"
                          >
                            <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                              <item.icon className="h-5 w-5" />
                            </div>
                            <div className="font-semibold text-base">
                              {item.name}
                            </div>
                          </Link>
                        </SheetClose>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border/40 bg-muted/20 p-4">
                <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Log out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
};

export default AdminDashboardLayout;
