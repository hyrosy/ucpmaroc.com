// src/pages/dashboard/PortfolioBuilderPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import {
  useOutletContext,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useBuilderStore } from "@/store/useBuilderStore";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  GripVertical,
  Eye,
  ArrowLeft,
  EyeOff,
  ExternalLink,
  Loader2,
  Plus,
  Palette,
  Layers,
  Smartphone,
  Settings,
  Globe,
  CheckCircle2,
  Pencil,
  Check,
  X,
  Lock,
  RefreshCw,
  ShoppingCart,
  Zap,
  Circle,
  LayoutTemplate,
  PaintBucket,
  Square,
  Type,
  Component as ComponentIcon,
  Code,
  Undo2,
  Redo2,
  Cloud,
  CloudOff,
  Monitor,
  Tablet,
  Trash2,
  Coins,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  MonitorPlay,
  PanelTop,
  Star,
  Image as ImageIcon,
  Images,
  Video,
  Mail,
  ClipboardList,
  MapPin,
  Users,
  User,
  CreditCard,
  BarChart,
  MessageSquare,
  Briefcase,
  Store,
  Gift,
  ChevronRight,
  Package,
  Bot,
} from "lucide-react";
import {
  type PortfolioSection,
  DEFAULT_PORTFOLIO_SECTIONS,
  type SectionType,
} from "@/features/portfolio-builder/types/portfolio";
import SectionEditor from "@/features/portfolio-builder/components/SectionEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/context/SubscriptionContext";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { CreateSiteModal } from "@/features/ecommerce/components/CreateSiteModal";


// --- AVAILABLE BLOCKS LIST ---
const AVAILABLE_BLOCKS: {
  type: SectionType;
  label: string;
  module?: "shop" | "appointments";
  icon: any;
}[] = [
  { type: "header", label: "Header", icon: PanelTop },
  { type: "hero", label: "Hero", icon: Star },
  { type: "about", label: "About", icon: User },
  { type: "shop", label: "Quick Shop", module: "shop", icon: ShoppingBag },
  { type: "dynamic_store", label: "E-commerce", module: "shop", icon: Store },
  { type: "gallery", label: "Gallery", icon: ImageIcon },
  { type: "image_slider", label: "Image Slider", icon: Images },
  { type: "video_slider", label: "Video Slider", icon: Video },
  { type: "contact", label: "Contact Form", icon: Mail },
  { type: "lead_form", label: "Lead Form", icon: ClipboardList },
  { type: "map", label: "Map", icon: MapPin },
  { type: "team", label: "Team", icon: Users },
  { type: "pricing", label: "Pricing", icon: CreditCard },
  { type: "stats", label: "Statistics", icon: BarChart },
  { type: "reviews", label: "Reviews", icon: MessageSquare },
  { type: "services_showcase", label: "Services", icon: Briefcase },
  { type: "html", label: "Custom HTML", icon: Code },
];

const LOCAL_FONT_OPTIONS = [
  { id: "Inter", name: "Inter (Clean & Modern)" },
  { id: "Playfair Display", name: "Playfair (Elegant Serif)" },
  { id: "Montserrat", name: "Montserrat (Geometric Sans)" },
  { id: "Merriweather", name: "Merriweather (Classic Serif)" },
  { id: "Poppins", name: "Poppins (Friendly Sans)" },
  { id: "Oswald", name: "Oswald (Bold & Condensed)" },
  { id: "Outfit", name: "Outfit (Tech & Startup)" },
  { id: "Space Mono", name: "Space Mono (Developer)" },
];

const VISUAL_THEMES = [
  {
    id: "modern",
    name: "Modern Minimal",
    description: "Clean whitespace, classic layout.",
    previewColor: "#f3f4f6",
    sitePrice: 0,
    globalPrice: 0,
  },
  {
    id: "modern_bright",
    name: "Modern Bright",
    description: "Clean whitespace, classic layout.",
    previewColor: "#f3f4f6",
    sitePrice: 0,
    globalPrice: 0,
  },
  {
    id: "cinematic",
    name: "Cinematic Dark",
    description: "Immersive dark mode, dramatic transitions.",
    previewColor: "#1e293b",
    sitePrice: 200,
    globalPrice: 500,
  },
  {
    id: "cupertino",
    name: "Cupertino",
    description: "Apple-inspired. Bento grids, glassmorphism.",
    previewColor: "#3b82f6",
    sitePrice: 300,
    globalPrice: 800,
  },
];

// --- 🚀 UPGRADED AAA+ IFRAME PREVIEW COMPONENT ---
const IframePreview = ({
  sections,
  theme,
  actorId,
  onEditSection,
  updateSection,
  activePageId,
  globalSections,
  customPages,
  publicSlug,
  editingSectionId,
  portfolioId,
  activeTab,
  editingStorePage,
}: {
  sections: PortfolioSection[];
  theme: any;
  actorId: string;
  onEditSection: (section: PortfolioSection) => void;
  updateSection: (id: string, updates: Partial<PortfolioSection>) => void;
  activePageId: string;
  globalSections: PortfolioSection[];
  customPages: any[];
  publicSlug: string;
  editingSectionId?: string | null;
  activeTab: string;
  editingStorePage: string | null;
  portfolioId?: string | null;
}) => {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">(
    "desktop"
  );
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  const [isIframeLoading, setIsIframeLoading] = useState(true);

  // 🚀 MATH-PERFECT SCALING ENGINE
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setDims({
          w: entries[0].contentRect.width,
          h: entries[0].contentRect.height,
        });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const sendDataToIframe = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      const previewSections = sections.map((s) =>
        s.type === "header"
          ? { ...s, data: { ...s.data, customPages, publicSlug } }
          : s
      );

      const header = globalSections.find((s) => s.type === "header");
      const finalSections =
        activePageId !== "home" && header && header.isVisible
          ? [
              {
                ...header,
                data: { ...header.data, customPages, publicSlug },
              },
              ...previewSections,
            ]
          : previewSections;
          
      let previewMode = 'page';
      if ((activeTab === 'store' || activeTab === 'preview') && editingStorePage) {
        previewMode = editingStorePage.toLowerCase();
      }

      iframeRef.current.contentWindow.postMessage(
        {
          type: "UPDATE_PREVIEW",
          payload: { sections: finalSections, themeConfig: theme, actorId, portfolioId, previewMode },
        },
        "*"
      );
    }
  }, [
    sections,
    theme,
    actorId,
    activePageId,
    globalSections,
    customPages,
    publicSlug,
    portfolioId,
    activeTab,
    editingStorePage
  ]);

  useEffect(() => {
    sendDataToIframe();
  }, [sendDataToIframe]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PREVIEW_READY") {
        setIsPreviewReady(true);
        sendDataToIframe();
      } else if (event.data?.type === "EDIT_SECTION") {
        const clickedSection = sections.find(
          (s) => s.id === event.data.payload
        );
        if (clickedSection) onEditSection(clickedSection);
      } else if (event.data?.type === "INLINE_EDIT") {
        const { sectionId, fieldKey, value } = event.data.payload;
        updateSection(sectionId, { data: { [fieldKey]: value } });
      } else if (event.data?.type === "UCP_ADD_TO_CART") {
        const { productId, quantity } = event.data.payload;
        alert(`🛒 SDK Action: Adding ${quantity}x of Product ID "${productId}" to cart! (Preview Mode)`);
      } else if (event.data?.type === "UCP_CHECKOUT") {
        const { planId } = event.data.payload;
        alert(`💳 SDK Action: Initiating checkout for Plan ID "${planId}"! (Preview Mode)`);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sendDataToIframe, sections, onEditSection, updateSection]);

  // 🚀 SCROLL TO ACTIVE SECTION WHEN EDITING
  useEffect(() => {
    if (editingSectionId && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "SCROLL_TO_SECTION", payload: editingSectionId },
        "*"
      );
    }
  }, [editingSectionId]);

  // 🚀 CALCULATE PERFECT SCALING AND HEIGHT
  const DESKTOP_W = 1280;
  const VIEWPORT_WIDTHS = { tablet: 768, mobile: 375 } as const;

  let scale = 1;
  let width = "100%";
  let height = "100%";

  if (viewport === "desktop") {
    const availableW = Math.max(dims.w - 32, 320);
    const availableH = Math.max(dims.h - 32, 320);
    scale = Math.min(1, availableW / DESKTOP_W);
    width = `${DESKTOP_W}px`;
    height = `${availableH / scale}px`;
  } else {
    const targetWidth = VIEWPORT_WIDTHS[viewport];
    const availableW = Math.max(dims.w - 32, 320);
    const availableH = Math.max(dims.h - 32, 320);
    scale = Math.min(1, availableW / targetWidth);
    width = `${targetWidth}px`;
    height = `${availableH / scale}px`;
  }

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden bg-transparent">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <span>Live Canvas</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em]">
            {viewport}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewport === "desktop" ? "secondary" : "ghost"}
            size="icon"
            className={cn(
              "h-9 w-9 rounded-full",
              viewport === "desktop" && "shadow-sm"
            )}
            onClick={() => setViewport("desktop")}
            title="Desktop preview"
          >
            <Monitor size={16} />
          </Button>
          <Button
            variant={viewport === "tablet" ? "secondary" : "ghost"}
            size="icon"
            className={cn(
              "h-9 w-9 rounded-full",
              viewport === "tablet" && "shadow-sm"
            )}
            onClick={() => setViewport("tablet")}
            title="Tablet preview"
          >
            <Tablet size={16} />
          </Button>
          <Button
            variant={viewport === "mobile" ? "secondary" : "ghost"}
            size="icon"
            className={cn(
              "h-9 w-9 rounded-full",
              viewport === "mobile" && "shadow-sm"
            )}
            onClick={() => setViewport("mobile")}
            title="Mobile preview"
          >
            <Smartphone size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
            onClick={sendDataToIframe}
            title="Refresh preview"
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          "relative flex-grow flex justify-center overflow-hidden rounded-3xl transition-colors duration-300",
          viewport === "desktop"
            ? "bg-slate-950/5 items-start p-4"
            : "bg-slate-950/5 items-center p-4 sm:p-8"
        )}
      >
        <div
          className="relative bg-background transition-all duration-300 overflow-hidden flex flex-col shrink-0 rounded-3xl"
          style={{
            width,
            height,
            transform: `scale(${scale})`,
            transformOrigin: viewport === "desktop" ? "top center" : "center center",
            border: "1px solid var(--border)",
            boxShadow:
              viewport === "desktop"
                ? "0 25px 50px -12px rgba(15, 23, 42, 0.12)"
                : "0 25px 50px -20px rgba(15, 23, 42, 0.14)",
          }}
        >
          <iframe
            ref={iframeRef}
            src="/builder-preview"
            className="flex-grow w-full h-full border-0 bg-transparent"
            title="Live Preview Canvas"
            onLoad={() => {
              setIsIframeLoading(false);
              sendDataToIframe();
            }}
            allowTransparency={true}
          />

          {(isIframeLoading || !isPreviewReady) && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/50 text-sm text-white backdrop-blur-sm">
              <div className="rounded-full bg-slate-900/90 px-4 py-2 shadow-lg shadow-slate-950/20">
                {isIframeLoading
                  ? "Loading preview…"
                  : "Waiting for preview to initialize..."}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PortfolioBuilderPage = () => {
  const { actorData } = useOutletContext<ActorDashboardContextType>();
  const { plan, limits, siteSlots, isLoading: isSubLoading } = useSubscription();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activePortfolioIdParam = searchParams.get("id");
  const [isBrowsingThemes, setIsBrowsingThemes] = useState(false);

  const {
    sections,
    themeConfig,
    hasUnsavedChanges,
    past,
    future,
    setInitialState,
    addSection,
    removeSection,
    updateSection,
    reorderSections,
    updateThemeConfig,
    markSaved,
    undo,
    redo,
  } = useBuilderStore();

  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(
    activePortfolioIdParam
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [editingSection, setEditingSection] = useState<PortfolioSection | null>(
    null
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [tempLabel, setTempLabel] = useState("");

  // Create Site / Onboarding State
  const [activeBuilderTab, setActiveBuilderTab] = useState("content");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [siteIdentity, setSiteIdentity] = useState({
    name: "",
    slug: "",
    customDomain: "",
  });
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);
  const [domainStatus, setDomainStatus] = useState<any>(null);
  const [isCheckingDomain, setIsCheckingDomain] = useState(false);
  const [activeDomain, setActiveDomain] = useState("");

  // Page Tracker
  const [activePageId, setActivePageId] = useState<string | "home">("home");
  const [lastLoadedKey, setLastLoadedKey] = useState<string | null>(null);
  const [isPageModalOpen, setIsPageModalOpen] = useState(false);
  const [editingStorePage, setEditingStorePage] = useState<string | null>(null);
  const [newPageName, setNewPageName] = useState("");
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [isDeletingPage, setIsDeletingPage] = useState(false);
  const [isPurchasingTheme, setIsPurchasingTheme] = useState<string | null>(
    null
  );

  // Guide / Welcome Tour State
  const [showWelcomePrompt, setShowWelcomePrompt] = useState(false);
  const [tourStep, setTourStep] = useState(0); // 0 = off, 1 = blocks limit, 2 = topbar, 3 = tab, 4 = input, 5 = success

  useEffect(() => {
    const handleTour = (e: any) => setTourStep(e.detail);
    window.addEventListener("TOUR_STEP_CHANGED", handleTour);
    return () => window.removeEventListener("TOUR_STEP_CHANGED", handleTour);
  }, []);

  const updateTourStep = (step: number) => {
    setTourStep(step);
    window.dispatchEvent(new CustomEvent("TOUR_STEP_CHANGED", { detail: step }));
  };

  // 🚀 NEW: FETCH APPROVED MARKETPLACE THEMES
  const { data: marketplaceThemesData = [], isLoading: isLoadingMarketplace } = useQuery({
    queryKey: ["approvedMarketplaceThemes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_themes")
        .select("id, name, description, preview_color, site_price, global_price")
        .eq("status", "approved");
      
      if (error) throw error;
      
      return data.map((t) => ({
        id: t.id,
        name: t.name || "Custom Theme",
        description: t.description || "A custom marketplace theme.",
        previewColor: t.preview_color || "#6366f1",
        sitePrice: t.site_price || 0,
        globalPrice: t.global_price || 0,
        isCustom: true,
      }));
    },
  });

  // 🚀 MERGE THEMES
  const ALL_THEMES = [...VISUAL_THEMES, ...marketplaceThemesData];

  const { data: actorWalletData, refetch: fetchActorWallet } = useQuery({
    queryKey: ["actorWallet", actorData?.id],
    queryFn: async () => {
      if (!actorData?.id) return null;
      const { data, error } = await supabase
        .from("actors")
        .select("purchased_themes")
        .eq("id", actorData.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!actorData?.id,
  });

  const globalOwnedThemes = [...(actorWalletData?.purchased_themes || ["modern"]), "modern_bright"];
  const walletBalance = actorData.wallet_balance || 0;

  const { data: fetchedSiteList, refetch: fetchSiteList } = useQuery({
    queryKey: ["siteList", actorData?.id],
    queryFn: async () => {
      if (!actorData?.id) return [];
      const { data, error } = await supabase
        .from("portfolios")
        .select("id, site_name")
        .eq("actor_id", actorData.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!actorData?.id,
  });

  const siteList = fetchedSiteList || [];

  const { data: customPagesData, refetch: fetchCustomPages } = useQuery({
    queryKey: ["pro_pages", activePortfolioId],
    queryFn: async () => {
      if (!activePortfolioId) return [];
      const { data } = await supabase
        .from("pro_pages")
        .select("*")
        .eq("portfolio_id", activePortfolioId)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!activePortfolioId,
    refetchOnWindowFocus: false,
  });

  const customPages = customPagesData || [];

  const {
    data: fetchedPortfolio,
    isLoading: isPortfolioLoading,
    refetch: fetchPortfolio,
  } = useQuery({
    queryKey: ["portfolio", actorData?.id, activePortfolioIdParam],
    queryFn: async () => {
      if (!actorData?.id) return null;
      let query = supabase.from("portfolios").select("*");
      if (activePortfolioIdParam)
        query = query.eq("id", activePortfolioIdParam);
      else
        query = query
          .eq("actor_id", actorData.id)
          .order("created_at", { ascending: false })
          .limit(1);
      const { data, error } = await query.single();
      if (error && error.code !== "PGRST116") throw error;
      return data || null;
    },
    enabled: !!actorData?.id,
    refetchOnWindowFocus: false,
  });

  const siteOwnedThemes = fetchedPortfolio?.purchased_themes || [];
  const hasThemeAccess = (themeId: string) =>
    globalOwnedThemes.includes(themeId) || siteOwnedThemes.includes(themeId);

  useEffect(() => {
    if (isPortfolioLoading || isSubLoading) return;

    if (fetchedPortfolio) {
      const isPortfolioSwitch = activePortfolioId !== fetchedPortfolio.id;
      
      if (isPortfolioSwitch) {
        setActivePortfolioId(fetchedPortfolio.id);
        setActivePageId("home");
        setEditingSection(null);
        setEditingStorePage(null);
      }

      setIsPublished(prev => prev !== fetchedPortfolio.is_published ? fetchedPortfolio.is_published : prev);
      
      setSiteIdentity(prev => {
        const newName = fetchedPortfolio.site_name || "";
        const newSlug = fetchedPortfolio.public_slug || "";
        const newDomain = fetchedPortfolio.custom_domain || "";
        if (prev.name === newName && prev.slug === newSlug && prev.customDomain === newDomain) return prev;
        return { name: newName, slug: newSlug, customDomain: newDomain };
      });

      const currentDomain = fetchedPortfolio.custom_domain || "";
      setActiveDomain(prev => prev !== currentDomain ? currentDomain : prev);
      if (!currentDomain) setDomainStatus(null);

      const pageToLoad = isPortfolioSwitch ? "home" : activePageId;
      const loadKey = `${fetchedPortfolio.id}-${pageToLoad}`;

      if (loadKey !== lastLoadedKey) {
        if (pageToLoad === "home") {
          setInitialState(fetchedPortfolio.sections || [], {
            ...fetchedPortfolio.theme_config,
            radius: fetchedPortfolio.theme_config?.radius ?? 0.5,
            buttonStyle: fetchedPortfolio.theme_config?.buttonStyle ?? "solid",
          });
        } else {
          const page = customPagesData?.find((p) => p.id === pageToLoad);
          setInitialState(page?.sections || [], {
            ...fetchedPortfolio.theme_config,
            radius: fetchedPortfolio.theme_config?.radius ?? 0.5,
            buttonStyle: fetchedPortfolio.theme_config?.buttonStyle ?? "solid",
          });
        }
        setLastLoadedKey(loadKey);
      }

    } else {
      setActivePortfolioId(null); 
      if (lastLoadedKey !== "empty-home") {
        setInitialState(DEFAULT_PORTFOLIO_SECTIONS, { templateId: "modern", primaryColor: "violet", font: "sans", radius: 0.5, buttonStyle: "solid" });
        setLastLoadedKey("empty-home");
      }
      
      if (!isSubLoading && fetchedSiteList && fetchedSiteList.length === 0) {
        setShowOnboarding(true);
      }
    }
  }, [fetchedPortfolio, isPortfolioLoading, isSubLoading, activePageId, lastLoadedKey, customPagesData, fetchedSiteList, activePortfolioId]);

  const isLoading = isPortfolioLoading;

  // 🚀 FETCH ACTIVE SUBSCRIPTION TO CHECK TRIAL EXPIRY
  const { data: activeSub, isLoading: isActiveSubLoading } = useQuery({
    queryKey: ["activeSubscription", activePortfolioId],
    queryFn: async () => {
      if (!activePortfolioId) return null;
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("portfolio_id", activePortfolioId)
        .maybeSingle();
      return data;
    },
    enabled: !!activePortfolioId,
  });

  const hasActiveSub = activeSub && activeSub.status === "active" && new Date(activeSub.current_period_end) > new Date();
  const isTrialEnded = !isActiveSubLoading && !hasActiveSub && fetchedPortfolio && new Date().getTime() > new Date(fetchedPortfolio.created_at).getTime() + 14 * 24 * 60 * 60 * 1000;
  const trialDaysLeft = !isActiveSubLoading && !hasActiveSub && !isTrialEnded && fetchedPortfolio ? Math.max(0, Math.ceil((new Date(fetchedPortfolio.created_at).getTime() + 14 * 24 * 60 * 60 * 1000 - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const subDaysLeft = hasActiveSub && activeSub ? Math.max(0, Math.ceil((new Date(activeSub.current_period_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;

  // 🚀 NEW: SHOW WELCOME PROMPT TO ANY EXISTING USER WITH 0 BALANCE WHO HASN'T SEEN IT YET
  useEffect(() => {
    if (walletBalance === 0 && fetchedPortfolio && !isLoading) {
      const hasSeenGuide = localStorage.getItem(`hasSeenWelcomeGuide_${actorData?.id}`);
      if (!hasSeenGuide) {
        setShowWelcomePrompt(true);
        localStorage.setItem(`hasSeenWelcomeGuide_${actorData?.id}`, "true");
      }
    }
  }, [walletBalance, fetchedPortfolio, isLoading, actorData?.id]);

  const handleTogglePublish = async (checked: boolean) => {
    if (!activePortfolioId) return;
    if (checked && isTrialEnded) return alert("Your 14-Day Pro Trial has expired. Please upgrade to publish your site again.");
    setIsPublished(checked);
    const { error } = await supabase
      .from("portfolios")
      .update({ is_published: checked, updated_at: new Date().toISOString() })
      .eq("id", activePortfolioId);
    if (error) setIsPublished(!checked);
  };

  useEffect(() => {
    if (isActiveSubLoading) return; // Prevent race condition mutations
    if (isTrialEnded && isPublished) {
      supabase.from("portfolios").update({ is_published: false }).eq("id", activePortfolioId).then();
      setIsPublished(false);
    }
  }, [isTrialEnded, isPublished, activePortfolioId, isActiveSubLoading]);

  useEffect(() => {
    if (!hasUnsavedChanges || isLoading || !activePortfolioId) return;
    const autoSaveTimer = setTimeout(async () => {
      setIsSaving(true);
      if (activePageId === "home") {
        await supabase
          .from("portfolios")
          .update({
            sections: sections,
            theme_config: themeConfig,
            updated_at: new Date().toISOString(),
          })
          .eq("id", activePortfolioId);
          
        fetchPortfolio();
      } else {
        await supabase
          .from("pro_pages")
          .update({ sections: sections })
          .eq("id", activePageId);
        await supabase
          .from("portfolios")
          .update({ theme_config: themeConfig })
          .eq("id", activePortfolioId);
          
        fetchCustomPages();
        fetchPortfolio();
      }
      markSaved();
      setIsSaving(false);
    }, 1500);
    return () => clearTimeout(autoSaveTimer);
  }, [
    sections,
    themeConfig,
    hasUnsavedChanges,
    isLoading,
    activePortfolioId,
    activePageId,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const { data: polledDomainStatus, refetch: checkDomainStatus } = useQuery({
    queryKey: ["domainStatus", activeDomain],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("manage-domains", {
        body: { action: "check", domain: activeDomain },
      });
      return data;
    },
    enabled: !!activeDomain && isSettingsOpen,
    refetchInterval: (query) => {
      const status = query.state.data;
      if (status?.verified && status?.configured) return false;
      return 10000;
    },
  });

  useEffect(() => {
    if (polledDomainStatus) setDomainStatus(polledDomainStatus);
  }, [polledDomainStatus]);

  const handleSaveIdentity = async () => {
    if (!activePortfolioId) return;
    if (siteIdentity.customDomain && !limits?.canConnectDomain)
      return alert("Please upgrade to connect a domain.");
    setIsSavingIdentity(true);
    const cleanSlug = siteIdentity.slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-");
    const cleanDomain = siteIdentity.customDomain
      .trim()
      .replace(/^https?:\/\//, "");
    const { error } = await supabase
      .from("portfolios")
      .update({
        site_name: siteIdentity.name,
        public_slug: cleanSlug,
        custom_domain: cleanDomain || null,
      })
      .eq("id", activePortfolioId);

    if (error) alert("Error saving settings. The URL might be taken.");
    else {
      setSiteIdentity((prev) => ({
        ...prev,
        slug: cleanSlug,
        customDomain: cleanDomain,
      }));
      setActiveDomain(cleanDomain);
      setIsSettingsOpen(false);
    }
    setIsSavingIdentity(false);
  };

  const handleAddDomain = async () => {
    if (!siteIdentity.customDomain) return;
    const cleanDomain = siteIdentity.customDomain
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .toLowerCase();
    setIsCheckingDomain(true);
    const { data, error } = await supabase.functions.invoke("manage-domains", {
      body: {
        action: "add",
        domain: cleanDomain,
        portfolioId: activePortfolioId,
      },
    });
    if (error || data?.error)
      alert(`Could not add domain:\n${data?.error || error?.message}`);
    else {
      setSiteIdentity((prev) => ({ ...prev, customDomain: cleanDomain }));
      setActiveDomain(cleanDomain);
    }
    setIsCheckingDomain(false);
  };

  const handleRemoveDomain = async () => {
    if (!confirm("Remove this custom domain?")) return;
    setIsCheckingDomain(true);
    await supabase.functions.invoke("manage-domains", {
      body: {
        action: "remove",
        domain: activeDomain,
        portfolioId: activePortfolioId,
      },
    });
    setActiveDomain("");
    setSiteIdentity((prev) => ({ ...prev, customDomain: "" }));
    setDomainStatus(null);
    setIsCheckingDomain(false);
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination || result.source.index === result.destination.index)
      return;
    const items = Array.from(sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    reorderSections(items);
  };

  const handleAddSectionAction = (type: SectionType) => {
    if (sections.length >= (limits?.maxBlocksPerSite || 10))
      return alert(
        `Plan Limit Reached! You can only add ${limits?.maxBlocksPerSite} sections.`
      );
    addSection({
      id: `${type}_${crypto.randomUUID()}`,
      type: type,
      isVisible: true,
      data: {
        title:
          AVAILABLE_BLOCKS.find((b) => b.type === type)?.label || "New Section",
      },
    });
  };

  const handleManualSave = async () => {
    if (!activePortfolioId) return;
    setIsSaving(true);
    if (activePageId === "home") {
      await supabase
        .from("portfolios")
        .update({
          sections: sections,
          theme_config: themeConfig,
          is_published: isPublished,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activePortfolioId);
        
      fetchPortfolio();
    } else {
      await supabase
        .from("pro_pages")
        .update({ sections: sections })
        .eq("id", activePageId);
      await supabase
        .from("portfolios")
        .update({ theme_config: themeConfig })
        .eq("id", activePortfolioId);
        
      fetchCustomPages();
      fetchPortfolio();
    }
    markSaved();
    setIsSaving(false);
  };

  const handlePurchaseTheme = async (
    themeId: string,
    price: number,
    themeName: string,
    scope: "site" | "global"
  ) => {
    if (!actorData?.id || !activePortfolioId) return;
    if (walletBalance < price)
      return alert(
        `You need ${price} Coins, but you only have ${walletBalance}. Please top up!`
      );
    const scopeText =
      scope === "global" ? "all your sites forever" : "this specific site only";
    if (!confirm(`Unlock ${themeName} for ${scopeText} for ${price} Coins?`))
      return;
    setIsPurchasingTheme(`${themeId}-${scope}`);
    const { data, error } = await supabase.rpc("purchase_theme", {
      p_actor_id: actorData.id,
      p_theme_id: themeId,
      p_cost: price,
      p_scope: scope,
      p_portfolio_id: activePortfolioId,
    });
    setIsPurchasingTheme(null);
    if (error || (data && !data.success))
      alert(data?.message || error?.message || "Failed to purchase theme.");
    else {
      fetchActorWallet();
      fetchPortfolio();
    }
  };

  const handleSiteCreated = async (portfolioId: string, isFirstSite: boolean) => {
      setIsCreateOpen(false);
      setShowOnboarding(false);
      await fetchSiteList();
      navigate(`/dashboard/portfolio?id=${portfolioId}`);

      if (isFirstSite && walletBalance === 0) {
        setShowWelcomePrompt(true);
        localStorage.setItem(`hasSeenWelcomeGuide_${actorData?.id}`, "true");
      }
  };

  const handleCreatePage = async () => {
    if (!activePortfolioId) return;
    if (!newPageName.trim()) return alert("Please enter a page name.");
    
    setIsCreatingPage(true);
    
    const cleanSlug = newPageName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "page";

    const { data, error } = await supabase
      .from("pro_pages")
      .insert({
        portfolio_id: activePortfolioId,
        title: newPageName.trim(),
        slug: cleanSlug,
        sections: [],
      })
      .select()
      .single();
      
    setIsCreatingPage(false);
    
    if (error) {
      if (error.code === "23505")
        alert(
          "A page with this name/URL already exists. Please choose a different name."
        );
      else alert("Failed to create page. Please try again.");
      return;
    }
    
    setIsPageModalOpen(false);
    setNewPageName("");
    
    setInitialState([], themeConfig);
    
    await fetchCustomPages();
    setActivePageId(data.id);
  };

  const handleDeletePage = async () => {
    if (activePageId === "home") return;
    if (
      !confirm(
        "Are you sure you want to delete this page? This cannot be undone."
      )
    )
      return;
    setIsDeletingPage(true);
    const { error } = await supabase
      .from("pro_pages")
      .delete()
      .eq("id", activePageId);
    setIsDeletingPage(false);
    if (error) return alert("Failed to delete page.");
    setActivePageId("home");
    await fetchCustomPages();
  };

  const saveLabel = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!renamingId) return;
    updateSection(renamingId, { data: { _label: tempLabel } });
    setRenamingId(null);
  };

  const activeCustomPage = customPages.find((p) => p.id === activePageId);
  const liveUrl =
    activePageId === "home"
      ? `/pro/${siteIdentity.slug || "portfolio"}`
      : `/pro/${siteIdentity.slug || "portfolio"}/${
          activeCustomPage?.slug || ""
        }`;

  const STORE_PAGES = [
    { id: 'General', title: 'General Settings', description: 'Store-wide configurations', icon: Settings },
    { id: 'Shop', title: 'Shop Page', description: 'Product grid & filters', icon: Store },
    { id: 'Product', title: 'Product Page', description: 'Details, reviews & related', icon: Package },
    { id: 'Cart', title: 'Cart Drawer', description: 'Global sliding cart', icon: ShoppingCart },
    { id: 'Checkout', title: 'Checkout Page', description: 'Payment & shipping flow', icon: CreditCard },
    { id: 'Portal', title: 'Customer Portal', description: 'Login & order history', icon: User },
  ];

  if (isLoading || isSubLoading)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  // EMPTY STATE IF NO PORTFOLIO EXISTS (AND ONBOARDING WAS CLOSED)
  if (!activePortfolioId && !showOnboarding) {
    return (
      <div className="p-4 md:p-8 flex flex-col items-center justify-center min-h-[70vh] w-full text-center">
        <div className="bg-primary/10 p-6 rounded-full mb-6 text-primary border border-primary/20">
          <Globe className="w-16 h-16" />
        </div>
        <h2 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">
          No Websites Found
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          You haven't created any websites yet. Click the button below to launch
          the builder and create your first portfolio.
        </p>
        <Button
          size="lg"
          className="h-12 px-8 font-bold rounded-xl"
          onClick={() => setShowOnboarding(true)}
        >
          <Plus className="w-5 h-5 mr-2" /> Create Your First Site
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-8xl mx-auto h-[calc(100dvh-4rem)] flex flex-col">
      {/* Header / Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 bg-card p-3 md:px-5 rounded-2xl border border-border shadow-sm mb-2">
        <div className="flex items-end gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
              Editing Site
            </span>
            <Select
              value={activePortfolioId || ""}
              onValueChange={(val) =>
                val === "new"
                  ? setIsCreateOpen(true)
                  : navigate(`/dashboard/portfolio?id=${val}`)
              }
            >
              <SelectTrigger className="h-8 border-0 p-0 shadow-none text-xl md:text-2xl font-black tracking-tight bg-transparent focus:ring-0 w-auto min-w-[200px] justify-start gap-2 hover:opacity-80 transition-opacity">
                <SelectValue placeholder="Select Site">
                  {siteList.find((s) => s.id === activePortfolioId)
                    ?.site_name ||
                    siteIdentity.name ||
                    "Untitled Site"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {siteList.map((site) => (
                  <SelectItem
                    key={site.id}
                    value={site.id}
                    className="font-medium cursor-pointer"
                  >
                    {site.site_name || "Untitled Site"}
                  </SelectItem>
                ))}
                <SelectItem
                  value="new"
                  className="text-muted-foreground italic border-t mt-1 pt-2"
                >
                  + Create New Site...
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {activePortfolioId && (
            <div className="flex flex-col gap-1 border-l border-border pl-4">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                Editing Page
              </span>
              <div className="flex items-center gap-2">
<Select
                  value={activePageId}
                  onValueChange={(val) => {
                    setEditingSection(null); // 🚀 FIX: Close the editor before switching pages
                    if (val === "new") setIsPageModalOpen(true);
                    else setActivePageId(val); 
                  }}
                >                  <SelectTrigger className="h-8 border-0 p-0 shadow-none text-lg md:text-xl font-bold tracking-tight bg-transparent focus:ring-0 w-auto min-w-[150px] justify-start gap-2 hover:opacity-80 transition-opacity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home" className="font-medium">
                      Home Page
                    </SelectItem>
                    {customPages.map((page) => (
                      <SelectItem
                        key={page.id}
                        value={page.id}
                        className="font-medium"
                      >
                        {page.title} (/{page.slug})
                      </SelectItem>
                    ))}
                    <SelectItem
                      value="new"
                      className="text-primary italic border-t mt-1 pt-2"
                    >
                      + Add New Page...
                    </SelectItem>
                  </SelectContent>
                </Select>

                {activePageId !== "home" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDeletePage}
                    disabled={isDeletingPage}
                    className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                    title="Delete Page"
                  >
                    {isDeletingPage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1 border-r pr-3 mr-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={undo}
              disabled={past.length === 0}
              title="Undo (Cmd+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={redo}
              disabled={future.length === 0}
              title="Redo (Cmd+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsSettingsOpen(true);
            }}
            className="gap-2 transition-all"
          >
            <Settings className="w-4 h-4" />{" "}
            <span className="hidden sm:inline">Site Settings</span>
          </Button>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border">
            <span className="text-xs font-medium uppercase text-muted-foreground hidden lg:inline-block">
              Plan
            </span>
            <Badge variant="secondary" className="uppercase text-[10px]">
            {hasActiveSub
              ? `${(plan === "ecommerce" ? "eCommerce" : plan === "pro" ? "Pro" : plan || "Starter")} (${subDaysLeft}d left)`
              : isTrialEnded
              ? "Expired"
              : `Trial (${trialDaysLeft}d left)`}
            </Badge>
            {plan !== "pro" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                onClick={() => navigate(`/dashboard/settings?upgrade=true&portfolioId=${activePortfolioId}`)}
              >
                <Zap className="w-3 h-3 mr-1" /> <span className="hidden sm:inline-block">Upgrade</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border">
            <span className="text-xs font-medium uppercase text-muted-foreground hidden sm:inline-block">
              Published
            </span>
            <Switch
              checked={isPublished}
              onCheckedChange={handleTogglePublish}
              disabled={isTrialEnded}
            />
            {isTrialEnded && (
              <span className="text-[10px] text-red-500 font-bold ml-1">Trial Expired</span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            {isPublished && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="px-2 sm:px-4"
              >
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="View Live Page"
                >
                  <ExternalLink className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">View Live</span>
                </a>
              </Button>
            )}

            <Button
              onClick={handleManualSave}
              disabled={isSaving}
              size="sm"
              variant={hasUnsavedChanges ? "secondary" : "outline"}
              className={cn(
                "min-w-[120px] transition-all",
                hasUnsavedChanges
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "text-muted-foreground"
              )}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : hasUnsavedChanges ? (
                <CloudOff className="w-4 h-4 mr-2" />
              ) : (
                <Cloud className="w-4 h-4 mr-2" />
              )}
              {isSaving ? "Saving..." : hasUnsavedChanges ? "Save Draft" : "Saved"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 flex-grow overflow-hidden min-h-0 relative pb-2">
        <div className="lg:col-span-1 flex flex-col h-full min-h-0 overflow-hidden pr-1">
          <Tabs 
            value={activeBuilderTab} 
            onValueChange={(val) => {
              setActiveBuilderTab(val);
              if (val === 'content' || val === 'design') {
                setEditingStorePage(null);
              }
            }} 
            className="flex flex-col h-full min-h-0"
          >
            <TabsList className="w-full grid grid-cols-4 lg:grid-cols-3 gap-2 shrink-0 rounded-3xl bg-muted/40 p-2 h-12 mb-4">
              <TabsTrigger
                value="content"
                className="h-full rounded-2xl border border-transparent bg-muted/80 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <Layers className="w-4 h-4 mr-2 hidden sm:inline" /> Content
              </TabsTrigger>
              <TabsTrigger
                value="design"
                className="h-full rounded-2xl border border-transparent bg-muted/80 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <Palette className="w-4 h-4 mr-2 hidden sm:inline" /> Design
              </TabsTrigger>
              <TabsTrigger
                value="store"
                className="h-full rounded-2xl border border-transparent bg-muted/80 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <Store className="w-4 h-4 mr-2 hidden sm:inline" /> Store
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="lg:hidden h-full rounded-2xl border border-transparent bg-muted/80 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <Smartphone className="w-4 h-4 mr-2" /> Preview
              </TabsTrigger>
            </TabsList>

            {/* CONTENT TAB */}
            <TabsContent
              value="content"
              className="flex-grow flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden"
            >
              {editingSection ? (() => {
                const liveSection = sections.find((s) => s.id === editingSection.id) || editingSection;
                return (
                <div className="flex flex-col h-full w-full animate-in slide-in-from-right-4 duration-200">
                  <div className="pb-3 mb-2 border-b flex items-center justify-between shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingSection(null)}
                      className="h-8 px-3 rounded-full"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                    </Button>
                    <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground mr-2 truncate">
                      {liveSection.data._label ||
                        liveSection.type.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex-grow overflow-y-auto custom-scrollbar p-0 pb-12">
                    <SectionEditor
                      sections={sections}
                      section={liveSection}
                      isOpen={true}
                      onClose={() => setEditingSection(null)}
                      actorId={actorData?.id || ""}
                      themeId={themeConfig.templateId || "modern"}
                      isInline={true}
                      pages={customPages}
                      portfolioId={activePortfolioId || ""}
                    />
                  </div>
                </div>
                );
              })() : (
                  <div className="flex-grow overflow-y-auto min-h-[400px] lg:min-h-0 custom-scrollbar animate-in slide-in-from-left-4 duration-200 p-4 pt-2">
                    <div className={cn("mb-4 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center bg-card/95 sticky top-0 z-20 rounded-3xl border border-border/50 p-4 shadow-sm transition-all", tourStep === 1 && "relative z-[9999] ring-4 ring-primary shadow-2xl bg-card")}>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                          <span>Page sections</span>
                          <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em]">
                            {sections.length} / {limits?.maxBlocksPerSite || 10}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground max-w-xl">
                          Drag to reorder your sections, then click a block to edit content and visibility.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              className="h-10 px-4 rounded-full tracking-wide shadow-sm transition-all hover:scale-105"
                            >
                              <Plus className="w-4 h-4 mr-2" /> Add Block
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            className="w-72 max-h-[400px] overflow-y-auto rounded-2xl p-3 shadow-xl [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 [&::-webkit-scrollbar-thumb]:rounded-full"
                            align="end"
                            sideOffset={10}
                          >
                          <div className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-3 px-1">
                            Block Library
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {AVAILABLE_BLOCKS.map((block) => {
                              const isLocked = block.module && !limits?.modules?.[block.module]; // 🚀 FIX: Added ?. before brackets
                              const Icon = block.icon;
                              return (
                                <DropdownMenuItem
                                  key={block.type}
                                  disabled={isLocked}
                                  onClick={() =>
                                    !isLocked &&
                                    handleAddSectionAction(block.type)
                                  }
                                  className={cn(
                                    "flex flex-col items-center justify-center gap-2 p-3 h-20 cursor-pointer rounded-xl text-center transition-all bg-muted/30 border border-border/50",
                                    isLocked
                                      ? "opacity-50 cursor-not-allowed"
                                      : "hover:bg-primary/5 hover:text-primary hover:border-primary/30"
                                  )}
                                >
                                  <Icon className="w-6 h-6 mb-0.5 opacity-80" />
                                  <span className="text-[9px] font-bold leading-tight tracking-wide">
                                    {block.label}
                                  </span>
                                  {isLocked && (
                                    <Lock className="absolute top-1.5 right-1.5 h-3 w-3 text-amber-500" />
                                  )}
                                </DropdownMenuItem>
                              );
                            })}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                      </div>

                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId="sections">
                        {(provided) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-3 pb-24"
                          >
                            {sections.length === 0 && (
                              <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-border rounded-2xl bg-muted/20 text-muted-foreground mt-4">
                                <Layers className="w-10 h-10 mb-3 opacity-20" />
                                <p className="font-semibold text-sm text-foreground mb-1">No sections added</p>
                                <p className="text-xs max-w-[200px] mx-auto">Click "Add Block" to start building your page.</p>
                              </div>
                            )}

                            {sections.map((section, index) => (
                              <Draggable
                                key={section.id}
                                draggableId={section.id}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <Card
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={cn(
                                      "transition-all cursor-pointer group active:scale-[0.99] hover:shadow-md",
                                      section.isVisible
                                        ? "border border-border/70 bg-card hover:bg-muted/30 shadow-sm"
                                        : "border border-amber-300/30 bg-amber-50/60 opacity-90 hover:opacity-100",
                                      snapshot.isDragging &&
                                        "shadow-2xl scale-105 opacity-100 z-50 ring-1 ring-primary/50 bg-background"
                                    )}
                                    onClick={() => {
                                      if (!renamingId)
                                        setEditingSection(section);
                                    }}
                                  >
                                    <CardContent className="p-4 flex items-start gap-3">
                                      <div
                                        {...provided.dragHandleProps}
                                        className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground p-2 rounded-full transition-colors"
                                      >
                                        <GripVertical size={20} />
                                      </div>
                                      {renamingId === section.id ? (
                                        <div
                                          className="flex-grow flex items-center gap-2"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Input
                                            value={tempLabel}
                                            onChange={(e) =>
                                              setTempLabel(e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter")
                                                saveLabel(e);
                                            }}
                                            autoFocus
                                            className="h-10 text-sm border-primary/50"
                                          />
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-9 w-9 text-green-500 hover:bg-green-500/10"
                                            onClick={saveLabel}
                                          >
                                            <Check size={16} />
                                          </Button>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-9 w-9 text-muted-foreground"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setRenamingId(null);
                                            }}
                                          >
                                            <X size={16} />
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                              <p className="font-semibold text-sm capitalize truncate text-foreground">
                                                {section.data._label ||
                                                  section.type.replace(/_/g, " ")}
                                              </p>
                                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
                                                <span>
                                                  {section.type.replace(/_/g, " ")}
                                                </span>
                                                <span
                                                  className={cn(
                                                    "rounded-full px-2 py-0.5",
                                                    section.isVisible
                                                      ? "bg-emerald-500/10 text-emerald-700"
                                                      : "bg-amber-500/10 text-amber-700"
                                                  )}
                                                >
                                                  {section.isVisible ? "Visible" : "Hidden"}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setRenamingId(section.id);
                                                  setTempLabel(
                                                    section.data._label ||
                                                      section.type.replace(/_/g, " ")
                                                  );
                                                }}
                                              >
                                                <Pencil size={16} />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  updateSection(section.id, {
                                                    isVisible: !section.isVisible,
                                                  });
                                                }}
                                              >
                                                {section.isVisible ? (
                                                  <Eye size={18} />
                                                ) : (
                                                  <EyeOff size={18} />
                                                )}
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                                title="Remove section"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (confirm("Remove section?"))
                                                    removeSection(section.id);
                                                }}
                                              >
                                                <Trash2 className="w-5 h-5" />
                                              </Button>
                                            </div>
                                          </div>
                                          {section.data.title &&
                                            section.data.title !==
                                              section.data._label && (
                                              <p className="text-xs text-muted-foreground truncate mt-2">
                                                {section.data.title}
                                              </p>
                                            )}
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </div>
                )}
            </TabsContent>

            {/* DESIGN TAB */}
            <TabsContent
              value="design"
              className="flex-grow flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden"
            >
              {isBrowsingThemes ? (
                <div className="flex flex-col h-full w-full animate-in slide-in-from-right-4 duration-200">
                  <div className="pb-3 mb-2 border-b flex items-center justify-between shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsBrowsingThemes(false)}
                      className="h-8 px-3 rounded-full"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                    </Button>
                    <span className="font-bold text-xs uppercase tracking-wider text-primary mr-2 flex items-center">
                      <ShoppingBag size={12} className="mr-1" /> Theme Store
                    </span>
                  </div>
                  <div className="flex-grow overflow-y-auto pb-12 space-y-4 custom-scrollbar">
                    {isLoadingMarketplace ? (
                      <div className="flex justify-center p-8">
                        <Loader2 className="animate-spin text-muted-foreground w-6 h-6" />
                      </div>
                    ) : (
                      ALL_THEMES.map((theme) => {
                        const isOwned = hasThemeAccess(theme.id);
                        const isPreviewing = themeConfig.templateId === theme.id;
                        return (
                          <Card
                            key={theme.id}
                            className={cn(
                              "overflow-hidden border-2 transition-all rounded-2xl",
                              isPreviewing
                                ? "border-primary shadow-md"
                                : "hover:border-primary/30"
                            )}
                          >
                            <div
                              className="h-32 w-full relative"
                              style={{ backgroundColor: theme.previewColor }}
                            >
                              {isOwned && (
                                <Badge className="absolute top-3 right-3 bg-green-500 border-none">
                                  Owned
                                </Badge>
                              )}
                            </div>
                            <CardContent className="p-5">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h4 className="font-bold text-lg leading-tight">
                                    {theme.name}
                                  </h4>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {theme.description}
                                  </p>
                                </div>
                                {!isOwned && (
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-1 font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 text-[10px] whitespace-nowrap">
                                      <Coins size={10} /> {theme.sitePrice} / Site
                                    </div>
                                    <div className="flex items-center gap-1 font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 text-[10px] whitespace-nowrap">
                                      <Coins size={10} /> {theme.globalPrice} /
                                      Global
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-2 mt-4">
                                <Button
                                  variant={
                                    isPreviewing && isOwned
                                      ? "default"
                                      : isOwned
                                      ? "outline"
                                      : isPreviewing
                                      ? "secondary"
                                      : "outline"
                                  }
                                  className={cn(
                                    "w-full transition-all rounded-xl",
                                    isPreviewing &&
                                      isOwned &&
                                      "bg-green-600 hover:bg-green-700 text-white"
                                  )}
                                  onClick={() =>
                                    updateThemeConfig({ templateId: theme.id })
                                  }
                                  disabled={isPreviewing && isOwned}
                                >
                                  {isPreviewing && isOwned ? (
                                    <>
                                      <CheckCircle2 size={16} className="mr-2" />{" "}
                                      Active Theme
                                    </>
                                  ) : isOwned ? (
                                    <>
                                      <LayoutTemplate
                                        size={16}
                                        className="mr-2"
                                      />{" "}
                                      Activate Theme
                                    </>
                                  ) : isPreviewing ? (
                                    <>
                                      <Eye size={16} className="mr-2" />{" "}
                                      Previewing...
                                    </>
                                  ) : (
                                    <>
                                      <Eye
                                        size={16}
                                        className="mr-2 text-muted-foreground"
                                      />{" "}
                                      Preview in Canvas
                                    </>
                                  )}
                                </Button>
                                {!isOwned && (
                                  <div className="flex gap-2 w-full mt-2 border-t pt-3">
                                    <Button
                                      className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm flex-1 text-xs h-10 font-bold"
                                      onClick={() =>
                                        handlePurchaseTheme(
                                          theme.id,
                                          theme.sitePrice,
                                          theme.name,
                                          "site"
                                        )
                                      }
                                      disabled={!!isPurchasingTheme}
                                    >
                                      {isPurchasingTheme ===
                                      `${theme.id}-site` ? (
                                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                      ) : null}{" "}
                                      1 Site ({theme.sitePrice})
                                    </Button>
                                    <Button
                                      className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-sm flex-1 text-xs h-10 font-bold"
                                      onClick={() =>
                                        handlePurchaseTheme(
                                          theme.id,
                                          theme.globalPrice,
                                          theme.name,
                                          "global"
                                        )
                                      }
                                      disabled={!!isPurchasingTheme}
                                    >
                                      {isPurchasingTheme ===
                                      `${theme.id}-global` ? (
                                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                      ) : null}{" "}
                                      All Sites ({theme.globalPrice})
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-grow overflow-y-auto pb-12 space-y-8 custom-scrollbar animate-in slide-in-from-left-4 duration-200">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Active Theme
                      </Label>
                    </div>
                    <div className="border border-border bg-background rounded-2xl p-4 flex flex-col gap-4 relative overflow-hidden shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center shrink-0">
                          <LayoutTemplate className="text-primary" />
                        </div>
                        <div className="flex-grow">
                          <h4 className="font-bold text-sm">
                            {ALL_THEMES.find(
                              (t) => t.id === themeConfig.templateId
                            )?.name || "Modern Minimal"}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Currently applied to your site.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setIsBrowsingThemes(true)}
                          className="rounded-full shrink-0"
                        >
                          Change
                        </Button>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-border/50">
                        <div className="space-y-0.5">
                           <Label className="text-sm font-bold">Color Mode</Label>
                           <p className="text-[10px] text-muted-foreground">Toggle between Light and Dark mode.</p>
                        </div>
                        <ToggleGroup
                          type="single"
                          value={themeConfig.colorMode || "dark"}
                          onValueChange={(val) => val && updateThemeConfig({ colorMode: val })}
                          className="bg-muted/50 p-1 rounded-xl border"
                        >
                           <ToggleGroupItem value="light" className="h-8 px-4 text-xs font-bold rounded-lg data-[state=on]:bg-background data-[state=on]:text-foreground text-muted-foreground transition-all">Light</ToggleGroupItem>
                           <ToggleGroupItem value="dark" className="h-8 px-4 text-xs font-bold rounded-lg data-[state=on]:bg-background data-[state=on]:text-foreground text-muted-foreground transition-all">Dark</ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                    </div>
                    {!hasThemeAccess(themeConfig.templateId) &&
                      (() => {
                        const activePremiumTheme = ALL_THEMES.find(
                          (t) => t.id === themeConfig.templateId
                        );
                        if (!activePremiumTheme) return null;
                        return (
                          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col gap-3 animate-in fade-in mt-4">
                            <div className="flex items-center gap-2 text-amber-800 text-sm font-bold">
                              <Eye size={16} className="text-amber-600" />{" "}
                              Previewing Premium Theme
                            </div>
                            <p className="text-xs text-amber-700/80 leading-relaxed">
                              You must unlock this theme to save your changes to
                              the live site.
                            </p>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                              <Button
                                size="sm"
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] h-9 rounded-xl"
                                onClick={() =>
                                  handlePurchaseTheme(
                                    activePremiumTheme.id,
                                    activePremiumTheme.sitePrice,
                                    activePremiumTheme.name,
                                    "site"
                                  )
                                }
                                disabled={!!isPurchasingTheme}
                              >
                                {isPurchasingTheme ===
                                `${activePremiumTheme.id}-site` ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : null}{" "}
                                This Site ({activePremiumTheme.sitePrice})
                              </Button>
                              <Button
                                size="sm"
                                className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-[10px] h-9 rounded-xl"
                                onClick={() =>
                                  handlePurchaseTheme(
                                    activePremiumTheme.id,
                                    activePremiumTheme.globalPrice,
                                    activePremiumTheme.name,
                                    "global"
                                  )
                                }
                                disabled={!!isPurchasingTheme}
                              >
                                {isPurchasingTheme ===
                                `${activePremiumTheme.id}-global` ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : null}{" "}
                                All Sites ({activePremiumTheme.globalPrice})
                              </Button>
                            </div>
                          </div>
                        );
                      })()}
                    <div className="pt-6 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <PaintBucket size={14} /> Brand Color
                      </div>
                      <div className="flex items-center gap-4 bg-background p-4 rounded-2xl border shadow-sm">
                        <div
                          className="relative w-12 h-12 rounded-full overflow-hidden border-2 shadow-sm shrink-0 cursor-pointer"
                          style={{
                            borderColor: themeConfig.primaryColor || "#8b5cf6",
                          }}
                        >
                          <input
                            type="color"
                            value={themeConfig.primaryColor || "#8b5cf6"}
                            onChange={(e) =>
                              updateThemeConfig({
                                primaryColor: e.target.value,
                              })
                            }
                            className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer"
                          />
                        </div>
                        <div className="flex-grow">
                          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1 block">
                            Hex Code
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground font-bold">
                              #
                            </span>
                            <Input
                              value={(
                                themeConfig.primaryColor || "8b5cf6"
                              ).replace("#", "")}
                              onChange={(e) =>
                                updateThemeConfig({
                                  primaryColor: `#${e.target.value}`,
                                })
                              }
                              className="pl-7 font-mono uppercase font-bold h-10 rounded-xl bg-muted/50 border-transparent focus-visible:border-primary"
                              maxLength={7}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pt-6 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <Type size={14} /> Typography
                      </div>
                      <Select
                        value={themeConfig.font}
                        onValueChange={(val) =>
                          updateThemeConfig({ font: val })
                        }
                      >
                        <SelectTrigger className="h-12 bg-background rounded-2xl shadow-sm border border-border">
                          <SelectValue placeholder="Select a font" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {LOCAL_FONT_OPTIONS.map((font) => (
                            <SelectItem
                              key={font.id}
                              value={font.id}
                              className="py-2.5 font-medium"
                            >
                              {font.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-5 pt-8 border-t">
                      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <ComponentIcon size={14} /> Interface
                      </div>
                      <div className="space-y-4 bg-background p-4 rounded-2xl border shadow-sm">
                        <div className="flex justify-between text-xs font-bold text-foreground">
                          <span className="flex items-center gap-1.5">
                            <Square
                              size={14}
                              className="text-muted-foreground"
                            />{" "}
                            Sharp
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Circle
                              size={14}
                              className="text-muted-foreground"
                            />{" "}
                            Round
                          </span>
                        </div>
                        <Slider
                          defaultValue={[0.5]}
                          max={1}
                          step={0.1}
                          value={[
                            themeConfig.radius !== undefined
                              ? themeConfig.radius
                              : 0.5,
                          ]}
                          onValueChange={(val) =>
                            updateThemeConfig({ radius: val[0] })
                          }
                          className="py-2"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
                          Button Style
                        </Label>
                        <ToggleGroup
                          type="single"
                          value={themeConfig.buttonStyle || "solid"}
                          onValueChange={(val) =>
                            val && updateThemeConfig({ buttonStyle: val })
                          }
                          className="justify-start gap-2 bg-background p-1.5 rounded-2xl border shadow-sm w-max"
                        >
                          <ToggleGroupItem
                            value="solid"
                            className="rounded-xl px-5 py-2 h-10 font-bold data-[state=on]:bg-primary data-[state=on]:text-white transition-all"
                          >
                            Solid
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="outline"
                            className="rounded-xl px-5 py-2 h-10 font-bold border-transparent data-[state=on]:border-primary data-[state=on]:bg-primary/5 data-[state=on]:text-primary transition-all"
                          >
                            Outline
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="shadow"
                            className="rounded-xl px-5 py-2 h-10 font-bold shadow-sm data-[state=on]:ring-2 ring-primary data-[state=on]:shadow-md transition-all"
                          >
                            Retro
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                    </div>

                    {/* 🚀 NEW: LOADING SCREEN CONFIGURATION */}
                    <div className="space-y-5 pt-8 border-t">
                      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <Loader2 size={14} className="animate-spin" /> Loading Screen
                      </div>
                      <div className="space-y-4 bg-background p-4 rounded-2xl border shadow-sm">
                        <div className="space-y-3">
                          <Label className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Loader Style</Label>
                          <Select value={themeConfig.loaderStyle || "skeleton"} onValueChange={(val) => updateThemeConfig({ loaderStyle: val })}>
                            <SelectTrigger className="h-12 bg-background rounded-2xl shadow-sm border border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="skeleton" className="py-2.5 font-medium">Skeleton (Native & Clean)</SelectItem>
                              <SelectItem value="spinner" className="py-2.5 font-medium">Classic Spinner</SelectItem>
                              <SelectItem value="pulse" className="py-2.5 font-medium">Brand Pulse (Modern)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {(themeConfig.loaderStyle === "spinner" || themeConfig.loaderStyle === "pulse") && (
                          <div className="space-y-2 pt-2 border-t border-border">
                            <Label className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Custom Loading Text (Optional)</Label>
                            <Input placeholder="e.g. Loading amazing things..." value={themeConfig.loaderText || ""} onChange={(e) => updateThemeConfig({ loaderText: e.target.value })} className="h-10 rounded-xl bg-muted/50 border-transparent focus-visible:border-primary" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* STORE TAB */}
            <TabsContent
              value="store"
              className="flex-grow flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden"
            >
              {editingStorePage ? (
                <div className="flex flex-col h-full w-full animate-in slide-in-from-right-4 duration-200">
                  <div className="pb-3 mb-2 border-b flex items-center justify-between shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingStorePage(null)}
                      className="h-8 px-3 rounded-full"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                    </Button>
                    <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground mr-2 truncate">
                    {STORE_PAGES.find(p => p.id === editingStorePage)?.title || "Settings"}
                    </span>
                  </div>
                  <div className="flex-grow overflow-y-auto custom-scrollbar p-0 pb-12 space-y-6 animate-in fade-in">
                   {editingStorePage === 'General' && (
                     <div className="p-4 border rounded-xl bg-muted/10 space-y-4">
                        <div className="flex justify-between items-center">
                           <div className="space-y-0.5">
                             <Label className="font-bold">Enable Store Functionality</Label>
                             <p className="text-[10px] text-muted-foreground">Globally toggle e-commerce features on or off.</p>
                           </div>
                           <Switch 
                             checked={themeConfig.store_enabled !== false} 
                             onCheckedChange={(c) => updateThemeConfig({ store_enabled: c })}
                           />
                        </div>
                     </div>
                   )}
                   {editingStorePage === 'Product' && (
                       <div className="p-4 border rounded-xl bg-muted/10 space-y-4">
                          <div className="flex justify-between items-center">
                           <div className="space-y-0.5">
                             <Label className="font-bold">Show Product Reviews</Label>
                             <p className="text-[10px] text-muted-foreground">Allow logged in customers to leave reviews directly on the product page.</p>
                           </div>
                             <Switch 
                               checked={themeConfig.store_product_reviews !== false} 
                               onCheckedChange={(c) => updateThemeConfig({ store_product_reviews: c })}
                             />
                          </div>
                          
                          <div className="flex justify-between items-center pt-4 border-t border-border/50">
                           <div className="space-y-0.5">
                             <Label className="font-bold">Show Related Products</Label>
                             <p className="text-[10px] text-muted-foreground">Display a grid of other items at the bottom of the product page.</p>
                           </div>
                             <Switch 
                               checked={themeConfig.store_related_products !== false} 
                               onCheckedChange={(c) => updateThemeConfig({ store_related_products: c })}
                             />
                          </div>
                       </div>
                     )}
                   {editingStorePage === 'Shop' && (
                       <div className="p-4 border rounded-xl bg-muted/10 space-y-4">
                          <div className="flex justify-between items-center">
                           <div className="space-y-0.5">
                             <Label className="font-bold">Show Sidebar Filters</Label>
                             <p className="text-[10px] text-muted-foreground">Allow customers to filter products by category or price.</p>
                           </div>
                             <Switch 
                               checked={themeConfig.store_shop_filters !== false} 
                               onCheckedChange={(c) => updateThemeConfig({ store_shop_filters: c })}
                             />
                          </div>
                       </div>
                     )}
                                        {editingStorePage === 'Cart' && (
                     <div className="p-4 border rounded-xl bg-muted/10 space-y-4">
                        <div className="flex justify-between items-center">
                           <div className="space-y-0.5">
                             <Label className="font-bold">Order Notes Field</Label>
                             <p className="text-[10px] text-muted-foreground">Allow customers to leave special instructions in the cart.</p>
                           </div>
                           <Switch 
                             checked={themeConfig.store_cart_notes === true} 
                             onCheckedChange={(c) => updateThemeConfig({ store_cart_notes: c })}
                           />
                        </div>
                     </div>
                   )}
                   {editingStorePage === 'Checkout' && (
                     <div className="p-4 border rounded-xl bg-muted/10 space-y-4">
                        <div className="space-y-3">
                           <div className="space-y-0.5">
                             <Label className="font-bold">Checkout Layout</Label>
                             <p className="text-[10px] text-muted-foreground">Select the preferred design for the checkout process.</p>
                           </div>
                           <Select
                             value={themeConfig.store_checkout_layout || "one-page"}
                             onValueChange={(val) => updateThemeConfig({ store_checkout_layout: val })}
                           >
                             <SelectTrigger className="w-full bg-background font-medium">
                               <SelectValue placeholder="Select layout" />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="one-page">One-Page Checkout (Default)</SelectItem>
                               <SelectItem value="two-column">Two-Column (Shopify Style)</SelectItem>
                               <SelectItem value="multi-step">Multi-Step Accordion</SelectItem>
                             </SelectContent>
                           </Select>
                           <p className="text-[10px] text-amber-500 font-medium pt-1">
                             Note: Advanced layouts will be fully supported in a future update. Currently defaults to One-Page.
                           </p>
                        </div>
                     </div>
                   )}
                   {editingStorePage === 'Portal' && (
                     <div className="p-4 border rounded-xl bg-muted/10 space-y-4">
                        <div className="flex justify-between items-center">
                           <div className="space-y-0.5">
                             <Label className="font-bold">Customer Portal</Label>
                             <p className="text-[10px] text-muted-foreground">Allow customers to log in and view their order history.</p>
                           </div>
                           <Switch 
                             checked={themeConfig.store_portal_enabled !== false} 
                             onCheckedChange={(c) => updateThemeConfig({ store_portal_enabled: c })}
                           />
                        </div>
                     </div>
                   )}

                  </div>
                </div>
              ) : (
                <div className="flex-grow overflow-y-auto min-h-[400px] lg:min-h-0 custom-scrollbar animate-in slide-in-from-left-4 duration-200 p-4 pt-2">
                  <div className="mb-4 space-y-2">
                  <h3 className="font-bold text-lg">Store Settings</h3>
                  <p className="text-xs text-muted-foreground">Manage layouts and features for your e-commerce funnels.</p>
                  </div>
                  <div className="space-y-3">
                  {STORE_PAGES.map(page => (
                     <Card key={page.id} className="cursor-pointer hover:bg-muted/30 hover:border-primary/50 transition-colors" onClick={() => setEditingStorePage(page.id)}>
                         <CardContent className="p-4 flex items-center justify-between">
                           <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                             <page.icon size={18}/>
                             </div>
                           <div>
                             <div className="font-bold text-sm">{page.title}</div>
                             <div className="text-[10px] text-muted-foreground">{page.description}</div>
                           </div>
                           </div>
                           <ChevronRight size={16} className="text-muted-foreground"/>
                         </CardContent>
                       </Card>
                    ))}

                  <div className="mt-6 pt-4 border-t border-border/50">
                    <h3 className="font-bold text-lg mb-2">Live Chat & Bots</h3>
                    <p className="text-xs text-muted-foreground mb-3">Configure your storefront live chat widget.</p>
                    <Button variant="outline" className="w-full justify-between h-auto py-3 px-4 rounded-xl border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors" onClick={() => window.open(`/dashboard/store-bot?portfolioId=${activePortfolioId}`, '_blank')}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          <Bot size={16} />
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-sm">Bot Settings</div>
                          <div className="text-[10px] text-muted-foreground">Manage WhatsApp & Platform Inbox</div>
                        </div>
                      </div>
                      <ExternalLink size={16} className="text-muted-foreground" />
                    </Button>
                  </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* PREVIEW TAB (MOBILE DEVICES ONLY) */}
            <TabsContent
              value="preview"
              className="lg:hidden flex-grow flex flex-col mt-0 h-full min-h-0 data-[state=inactive]:hidden"
            >
              <IframePreview
                sections={sections}
                theme={themeConfig}
                actorId={actorData?.id || ""}
              portfolioId={activePortfolioId}
                onEditSection={setEditingSection}
                updateSection={updateSection}
                activePageId={activePageId}
                globalSections={fetchedPortfolio?.sections || []}
                customPages={customPages}
                publicSlug={siteIdentity.slug}
                editingSectionId={editingSection?.id}
                activeTab={activeBuilderTab}
                editingStorePage={editingStorePage}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT COLUMN: Desktop Live Preview Canvas */}
        <div className="lg:col-span-2 hidden lg:flex flex-col h-full min-h-0 relative">
          <IframePreview
            sections={sections}
            theme={themeConfig}
            actorId={actorData?.id || ""}
            portfolioId={activePortfolioId}
            onEditSection={setEditingSection}
            updateSection={updateSection}
            activePageId={activePageId}
            globalSections={fetchedPortfolio?.sections || []}
            customPages={customPages}
            publicSlug={siteIdentity.slug}
            editingSectionId={editingSection?.id}
            activeTab={activeBuilderTab}
            editingStorePage={editingStorePage}
          />
        </div>
      </div>

      {/* --- CREATE NEW PAGE MODAL --- */}
      <Dialog open={isPageModalOpen} onOpenChange={setIsPageModalOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-background border-border">
          <div className="p-6 bg-muted/30 border-b border-border">
            <DialogTitle className="text-2xl font-bold text-foreground">Create New Page</DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">
              Add a new custom page to your website.
            </DialogDescription>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Page Name</Label>
              <Input
                placeholder="e.g. Tour Dates"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreatePage();
                }}
                autoFocus
                className="h-12 text-base font-medium bg-muted/50"
              />
              {newPageName && (
                <p className="text-xs text-muted-foreground mt-2">
                  URL will be:{" "}
                  <span className="font-mono text-primary">
                    /pro/{siteIdentity.slug || "username"}/
                    {newPageName
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, "-")
                      .replace(/-+/g, "-")
                      .replace(/^-|-$/g, "")}
                  </span>
                </p>
              )}
            </div>
          </div>
          <div className="p-6 border-t border-border bg-muted/10 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsPageModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePage} disabled={isCreatingPage} className="font-bold">
              {isCreatingPage && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}{" "}
              Create Page
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- SITE SETTINGS MODAL --- */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-background border-border">
          <div className="p-6 bg-muted/30 border-b border-border">
            <DialogTitle className="text-2xl font-bold text-foreground">Site Settings</DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">
              Manage your site identity, URL, and custom domain.
            </DialogDescription>
          </div>
          <Tabs defaultValue="general" className="w-full">
            <div className="px-6 pt-4">
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 rounded-xl p-1">
                <TabsTrigger value="general" className="rounded-lg">General</TabsTrigger>
                <TabsTrigger value="domains" className="rounded-lg">Domains</TabsTrigger>
              </TabsList>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <TabsContent value="general" className="space-y-6 mt-0">
              <div className="space-y-2">
                <Label>Site Name</Label>
                <Input
                  value={siteIdentity.name}
                  onChange={(e) =>
                    setSiteIdentity((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g. My Portfolio"
                />
              </div>
              <div className="space-y-2">
                <Label>Portfolio URL</Label>
                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground bg-muted h-10 px-3 flex items-center rounded-l-md border border-r-0 border-input shrink-0">
                    {window.location.host}/pro/
                  </span>
                  <Input
                    value={siteIdentity.slug}
                    onChange={(e) =>
                      setSiteIdentity((prev) => ({
                        ...prev,
                        slug: e.target.value,
                      }))
                    }
                    className="rounded-l-none"
                    placeholder="username"
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="domains" className="space-y-6 mt-0">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Custom Domain</Label>
                  {!limits?.canConnectDomain && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <Lock size={10} /> Pro Feature
                    </span>
                  )}
                </div>
                {!activeDomain ? (
                  <div className="flex gap-2">
                    <div className="relative flex-grow">
                      <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={siteIdentity.customDomain}
                        onChange={(e) =>
                          setSiteIdentity((prev) => ({
                            ...prev,
                            customDomain: e.target.value,
                          }))
                        }
                        className="pl-9"
                        placeholder={
                          limits?.canConnectDomain
                            ? "example.com"
                            : "Upgrade to connect"
                        }
                        disabled={!limits?.canConnectDomain}
                      />
                    </div>
                    <Button
                      onClick={handleAddDomain}
                      disabled={
                        !siteIdentity.customDomain ||
                        isCheckingDomain ||
                        !limits?.canConnectDomain
                      }
                    >
                      {isCheckingDomain ? (
                        <Loader2 className="animate-spin h-4 w-4" />
                      ) : (
                        "Connect"
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="bg-muted/30 border rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {domainStatus?.verified && domainStatus?.configured ? (
                          <CheckCircle2 className="text-green-500 h-5 w-5" />
                        ) : (
                          <Loader2 className="text-amber-500 h-5 w-5 animate-spin" />
                        )}
                        <span className="font-bold text-lg">
                          {activeDomain}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 h-8"
                        onClick={handleRemoveDomain}
                      >
                        Disconnect
                      </Button>
                    </div>
                    {(!domainStatus?.verified || !domainStatus?.configured) && (
                      <div className="space-y-3 text-sm">
                        <div className="p-3 bg-background border rounded-lg space-y-3">
                          <div className="flex items-start gap-2">
                            <div className="p-1 bg-blue-100 text-blue-600 rounded mt-0.5">
                              <Zap size={12} fill="currentColor" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-semibold text-xs uppercase text-muted-foreground">
                                Configuration Required
                              </p>
                              {!domainStatus?.verified ? (
                                <p className="text-amber-600 font-bold text-xs">
                                  Domain Ownership Not Verified
                                </p>
                              ) : (
                                <p className="text-amber-600 font-bold text-xs">
                                  Ownership Verified •{" "}
                                  <span className="underline">
                                    Waiting for DNS Record
                                  </span>
                                </p>
                              )}
                              <p className="text-muted-foreground text-xs">
                                Log in to your domain provider and add these{" "}
                                <strong>2 records</strong>:
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-[0.5fr_1fr_2fr] gap-2 font-mono text-xs items-center bg-muted/50 p-2 rounded border border-border/50">
                            <div className="bg-background border border-border px-1.5 py-0.5 rounded text-center font-bold text-foreground">
                              A
                            </div>
                            <div className="text-muted-foreground">@</div>
                            <div
                              className="text-right select-all cursor-pointer font-medium hover:text-primary transition-colors"
                              onClick={() =>
                                navigator.clipboard.writeText("76.76.21.21")
                              }
                              title="Click to copy"
                            >
                              76.76.21.21
                            </div>
                          </div>
                          <div className="grid grid-cols-[0.5fr_1fr_2fr] gap-2 font-mono text-xs items-center bg-muted/50 p-2 rounded border border-border/50">
                            <div className="bg-background border border-border px-1.5 py-0.5 rounded text-center font-bold text-foreground">
                              CNAME
                            </div>
                            <div className="text-muted-foreground">www</div>
                            <div
                              className="text-right select-all cursor-pointer font-medium hover:text-primary transition-colors"
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  "cname.vercel-dns.com"
                                )
                              }
                              title="Click to copy"
                            >
                              cname.vercel-dns.com
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => checkDomainStatus()}
                          disabled={isCheckingDomain}
                        >
                          {isCheckingDomain ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}{" "}
                          Refresh Status
                        </Button>
                      </div>
                    )}
                    {domainStatus?.verified && domainStatus?.configured && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                          <CheckCircle2 size={16} />
                          <span className="font-medium">
                            Domain Active & SSL Secured
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground px-1">
                          Your site is live at{" "}
                          <a
                            href={`https://${activeDomain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline font-bold text-primary"
                          >
                            https://{activeDomain}
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {!limits?.canConnectDomain && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 mt-2"
                    onClick={() => navigate("/dashboard/settings")}
                  >
                    Upgrade Plan to Connect Domain
                  </Button>
                )}
              </div>
            </TabsContent>
            </div>
          </Tabs>
          <div className="p-6 border-t border-border bg-muted/10 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveIdentity} disabled={isSavingIdentity} className="font-bold">
              {isSavingIdentity && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}{" "}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CreateSiteModal
        isOpen={isCreateOpen || showOnboarding}
        onClose={() => {
          setIsCreateOpen(false);
          setShowOnboarding(false);
        }}
        actorId={actorData.id}
        onSuccess={handleSiteCreated}
        siteCount={siteList.length}
      />

      {/* --- WELCOME PROMPT MODAL --- */}
      <Dialog open={showWelcomePrompt} onOpenChange={setShowWelcomePrompt}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-primary flex items-center gap-2">
              <Sparkles className="w-6 h-6" /> Congratulations!
            </DialogTitle>
            <DialogDescription className="text-base text-foreground mt-2">
            Welcome to your new portfolio website!
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-muted-foreground">
            <p className="mb-2">
                Your new website is currently on a <strong>14-Day Pro Plan Trial</strong>! To help you keep your premium features once the trial ends, we're gifting you <strong>2700 Welcome Coins</strong> using the code <strong>BISSMILAH</strong>.
            </p>
            <p>
                Would you like a quick interactive guide to learn about your site and claim your free coins?
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="ghost" onClick={() => setShowWelcomePrompt(false)}>Skip for now</Button>
              <Button onClick={() => { setShowWelcomePrompt(false); updateTourStep(1); }}>
              Start Quick Tour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- CLAIM COINS FLOATING WIDGET --- */}
      {walletBalance === 0 && tourStep === 0 && !showWelcomePrompt && (
        <div className="fixed bottom-6 right-6 lg:right-10 z-[90] animate-in fade-in slide-in-from-bottom-8 duration-500">
          <Button
            size="lg"
            className="rounded-full shadow-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold gap-2 h-12 sm:h-14 px-5 sm:px-6 border-2 border-amber-400/50 hover:scale-105 transition-all"
            onClick={() => updateTourStep(1)}
          >
            <Gift className="w-5 h-5 animate-pulse" />
            <span className="hidden sm:inline-block">Claim 2,700 Free Coins</span>
            <span className="sm:hidden">Claim Gift</span>
          </Button>
        </div>
      )}

      {/* --- GUIDED TOUR OVERLAY --- */}
      {(tourStep === 1 || tourStep === 2) && (
        <div className="fixed inset-0 z-[9998] bg-slate-950/80 backdrop-blur-sm pointer-events-none transition-all animate-in fade-in flex items-center justify-center">
          {tourStep === 1 && (
            <div className="bg-card border-2 border-primary rounded-2xl p-6 max-w-sm shadow-2xl z-[9999] animate-in zoom-in-95 pointer-events-auto">
              <div className="flex items-center gap-2 mb-3 text-primary">
                <Layers className="w-6 h-6" />
                <h3 className="text-xl font-bold">Pro Trial Activated</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Your site is currently on a <strong>14-Day Pro Trial</strong>, giving you access to premium blocks, custom domains, and more. After your trial ends, you can use your Welcome Coins to upgrade!
              </p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-bold">Step 1 of 4</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => updateTourStep(0)}>Skip Tour</Button>
                  <Button size="sm" onClick={() => updateTourStep(2)}>Next</Button>
                </div>
              </div>
            </div>
          )}
          {tourStep === 2 && (
            <div className="absolute top-20 right-4 sm:right-8 bg-card border-2 border-primary rounded-2xl p-6 max-w-sm shadow-2xl z-[9999] animate-in slide-in-from-right-8 pointer-events-auto">
              <div className="flex items-center gap-2 mb-3 text-amber-500">
                <Coins className="w-6 h-6" />
                <h3 className="text-xl font-bold">Open the Coin Shop</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Let's claim your 2700 free coins! Click the pulsing <strong>+</strong> button on your wallet balance at the top right of your screen.
              </p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-bold">Step 2 of 4</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => updateTourStep(0)}>End Tour</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PortfolioBuilderPage;