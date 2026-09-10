// src/pages/dashboard/BuilderPreview.tsx
import React, { useState, useEffect, Suspense } from "react";
import { PortfolioSection } from "@/features/portfolio-builder/types/portfolio";
import {
  THEME_REGISTRY,
  DEFAULT_THEME,
  resolveThemeComponent,
} from "@/themes/registry";
import { cn } from "@/lib/utils";
import { Loader2, AlertTriangle, ShoppingCart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabaseClient";
import ModernShopLayout from "@/themes/modern/ShopLayout";
import ModernProductLayout from "@/themes/modern/ProductLayout";
import ModernLoginLayout from "@/themes/modern/LoginLayout";
import CartDrawerContainer from "@/features/ecommerce/components/CartDrawerContainer";
import { useCartStore } from "@/features/ecommerce/store/useCartStore";

// 🚀 AAA+ UPGRADE: We are using the native executor hook, NO BABEL REQUIRED!
import { usePrecompiledTheme } from "@/features/portfolio-builder";

// --- Helper to convert section type (e.g., 'video_slider') to Component Name ('VideoSlider') ---
function formatSectionTypeToComponentName(type: string): string {
  if (type === 'lead_form') return 'LeadForm';
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

// --- Helper to convert HEX to HSL for Tailwind ---
function hexToHSLString(hex: string): string {
  hex = hex.replace(/^#/, "");
  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;

  let max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(
    l * 100
  )}%`;
}

// 🚀 THEME DICTIONARY: Themes control their own Light & Dark mode identity!
const THEME_PALETTES: Record<string, any> = {
  modern: {
    light: {
      background: "0 0% 100%", // White
      foreground: "240 10% 3.9%", // Almost black
      card: "0 0% 100%",
      cardForeground: "240 10% 3.9%",
      popover: "0 0% 100%",
      popoverForeground: "240 10% 3.9%",
      secondary: "240 4.8% 95.9%",
      secondaryForeground: "240 5.9% 10%",
      muted: "240 4.8% 95.9%", // Light gray
      mutedForeground: "240 3.8% 46.1%",
      accent: "240 4.8% 95.9%",
      accentForeground: "240 5.9% 10%",
      border: "240 5.9% 90%", // Soft border
      input: "240 5.9% 90%",
      ring: "240 5.9% 10%",
    },
    dark: {
      background: "0 0% 4%", // Neutral 950
      foreground: "0 0% 98%", // White
      card: "0 0% 9%", // Neutral 900
      cardForeground: "0 0% 98%",
      popover: "0 0% 9%",
      popoverForeground: "0 0% 98%",
      secondary: "240 3.7% 15.9%",
      secondaryForeground: "0 0% 98%",
      muted: "0 0% 15%", // Neutral 800
      mutedForeground: "240 5% 64.9%", // Neutral 400
      accent: "240 3.7% 15.9%",
      accentForeground: "0 0% 98%",
      border: "240 3.7% 15.9%", // White/10
      input: "240 3.7% 15.9%",
      ring: "240 4.9% 83.9%",
    }
  },
  cinematic: {
    light: {
      background: "222.2 84% 4.9%",
      foreground: "210 40% 98%",
      card: "222.2 84% 4.9%",
      cardForeground: "210 40% 98%",
      popover: "222.2 84% 4.9%",
      popoverForeground: "210 40% 98%",
      secondary: "217.2 32.6% 17.5%",
      secondaryForeground: "210 40% 98%",
      muted: "217.2 32.6% 17.5%",
      mutedForeground: "215 20.2% 65.1%",
      accent: "217.2 32.6% 17.5%",
      accentForeground: "210 40% 98%",
      border: "217.2 32.6% 17.5%",
      input: "217.2 32.6% 17.5%",
      ring: "212.7 26.8% 83.9%",
    },
    dark: {
      background: "222.2 84% 4.9%",
      foreground: "210 40% 98%",
      card: "222.2 84% 4.9%",
      cardForeground: "210 40% 98%",
      popover: "222.2 84% 4.9%",
      popoverForeground: "210 40% 98%",
      secondary: "217.2 32.6% 17.5%",
      secondaryForeground: "210 40% 98%",
      muted: "217.2 32.6% 17.5%",
      mutedForeground: "215 20.2% 65.1%",
      accent: "217.2 32.6% 17.5%",
      accentForeground: "210 40% 98%",
      border: "217.2 32.6% 17.5%",
      input: "217.2 32.6% 17.5%",
      ring: "212.7 26.8% 83.9%",
    }
  }
};

export default function BuilderPreview() {
  const [sections, setSections] = useState<PortfolioSection[]>([]);
  const [themeConfig, setThemeConfig] = useState<any>({});
  const [actorId, setActorId] = useState<string>("preview-mode");
  const [portfolioId, setPortfolioId] = useState<string>("preview-mode");
  const [previewMode, setPreviewMode] = useState<string>("page");

  // 1. Establish the postMessage Bridge
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "UPDATE_PREVIEW") {
        setSections(event.data.payload.sections);
        setThemeConfig(event.data.payload.themeConfig);
        if (event.data.payload.actorId) setActorId(event.data.payload.actorId);
        if (event.data.payload.portfolioId) setPortfolioId(event.data.payload.portfolioId);
        if (event.data.payload.previewMode) setPreviewMode(event.data.payload.previewMode);
      } else if (event.data?.type === "SCROLL_TO_SECTION") {
        const el = document.getElementById(event.data.payload);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    window.parent.postMessage({ type: "PREVIEW_READY" }, "*");

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // 2. Setup Theme Variables
  const themeId = themeConfig.templateId || "modern";
  
  // 🚀 NEW: Is this a custom marketplace theme?
  const isCustomTheme = !!themeId && !THEME_REGISTRY[themeId];

  // 🚀 AAA+ UPGRADE: Fetch ONLY the lightweight compiled bundle!
  const { data: customThemeData, isLoading: isLoadingTheme, error: fetchError } = useQuery({
    queryKey: ['customThemeCompiled', themeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_themes')
        .select('compiled_bundle') // We do not need the heavy 'files' array here
        .eq('id', themeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isCustomTheme,
    staleTime: 1000 * 60 * 5, // Cache for 5 mins so changing colors is instant
  });

  // 🚀 AAA+ UPGRADE: Execute natively using the new hook
  const { compiledComponents } = usePrecompiledTheme(customThemeData?.compiled_bundle);

  // 🚀 E-COMMERCE DUMMY DATA FOR PREVIEW MODES
  useEffect(() => {
    if (previewMode === 'cart') {
      const cart = useCartStore.getState();
      cart.openCart();
      if (cart.items.length === 0) {
        cart.addItem({
          id: "dummy-cart",
          title: "Premium Sample Product",
          price: 49.99,
          quantity: 1,
          variant: "Default",
          image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80"
        });
      }
    } else {
      useCartStore.getState().closeCart();
    }
  }, [previewMode]);

  const dummyProducts = [
    { id: "1", title: "Premium Headphones", price: 299.00, description: "High-quality noise-canceling headphones.", images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80"], pro_collections: { title: "Tech" }, track_inventory: true, stock_count: 10, options: [] },
    { id: "2", title: "Classic Watch", price: 199.00, description: "Elegant timepiece for everyday wear.", images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80"], pro_collections: { title: "Accessories" }, track_inventory: true, stock_count: 5, options: [] },
    { id: "3", title: "Leather Wallet", price: 89.00, description: "Handcrafted genuine leather wallet.", images: ["https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&q=80"], pro_collections: { title: "Accessories" }, track_inventory: false, stock_count: 0, options: [] }
  ];

  const dummyShopProps = {
    username: "preview", collections: [{ id: "c1", title: "Tech" }, { id: "c2", title: "Accessories" }], activeCollection: null, setActiveCollection: () => {}, searchQuery: "", setSearchQuery: () => {}, filteredProducts: dummyProducts, themeConfig
  };

  const dummyProductProps = {
    username: "preview",
    product: {
      ...dummyProducts[0],
      compare_at_price: 349.00,
      options: [{ name: "Color", values: [{ label: "Black" }, { label: "Silver" }] }],
      reviews: [{ id: 1, reviewer_name: "Jane Doe", rating: 5, title: "Love them!", content: "Best audio quality I've ever experienced.", is_published: true, created_at: new Date().toISOString() }]
    },
    currentPrice: 299.00, quantity: 1, setQuantity: () => {}, selectedVariants: { Color: { label: "Black" } }, setSelectedVariants: () => {}, activeImgIndex: 0, setActiveImgIndex: () => {}, step: "details" as const, setStep: () => {}, clientInfo: { name: "", phone: "", address: "" }, setClientInfo: () => {}, isSubmitting: false, handleMainAction: () => {}, handleConfirmOrder: () => {}, themeConfig
  };

  const dummyLoginProps = {
    portfolio: { site_name: "My Awesome Store" }, email: "", setEmail: () => {}, otp: "", setOtp: () => {}, step: "email", isLoading: false, error: null, handleSendCode: (e: any) => e.preventDefault(), handleVerifyCode: (e: any) => e.preventDefault(), navigate: () => {}, shopUrl: "#"
  };

  const ActiveTheme = THEME_REGISTRY[themeId] || DEFAULT_THEME;
  const primaryHsl = themeConfig.primaryColor
    ? hexToHSLString(themeConfig.primaryColor)
    : "259 94% 51%";
  const activeFont = themeConfig.font || "Inter";
  const fontUrl = `https://fonts.googleapis.com/css2?family=${activeFont.replace(
    / /g,
    "+"
  )}:wght@300;400;500;600;700;800;900&display=swap`;
  const activeRadius =
    themeConfig.radius !== undefined ? themeConfig.radius : 0.5;

  // 🚀 Fetch the active palette, and default to Dark mode if no preference is set yet
  const palette = THEME_PALETTES[themeId] || THEME_PALETTES.modern;
  const colorMode = themeConfig.colorMode || "dark";
  const activePalette = colorMode === "light" ? palette.light : palette.dark;

  return (
    <>
      <style>
        {`
          @import url('${fontUrl}');
          
          :root, .builder-preview-wrapper {
            --primary: ${primaryHsl};
            --radius: ${activeRadius}rem;
            
            --background: ${activePalette.background};
            --foreground: ${activePalette.foreground};
            --card: ${activePalette.card};
            --card-foreground: ${activePalette.cardForeground};
            --popover: ${activePalette.popover};
            --popover-foreground: ${activePalette.popoverForeground};
            --secondary: ${activePalette.secondary};
            --secondary-foreground: ${activePalette.secondaryForeground};
            --muted: ${activePalette.muted};
            --muted-foreground: ${activePalette.mutedForeground};
            --accent: ${activePalette.accent};
            --accent-foreground: ${activePalette.accentForeground};
            --border: ${activePalette.border};
            --input: ${activePalette.input};
            --ring: ${activePalette.ring};
          }

          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: rgba(156, 163, 175, 0.3);
            border-radius: 10px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(156, 163, 175, 0.5);
          }

          html, body {
            margin: 0;
            padding: 0;
            background-color: var(--background);
            color: var(--foreground);
          }

          .builder-preview-wrapper {
            font-family: '${activeFont}', sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }
          
          .builder-preview-wrapper button, 
          .builder-preview-wrapper input, 
          .builder-preview-wrapper textarea,
          .builder-preview-wrapper select {
            font-family: inherit;
          }
        `}
      </style>

      <div
        className={cn(
          "builder-preview-wrapper selection:bg-primary/30 selection:text-primary",
          colorMode === "dark" ? "dark" : ""
        )}
        data-btn-style={themeConfig.buttonStyle || "solid"}
      >
        {/* Loading / Error States for Custom Themes */}
        {isCustomTheme && isLoadingTheme && (
           <div className="flex items-center justify-center p-12 h-full flex-grow text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading Custom Theme...
           </div>
        )}
        
        {fetchError && (
           <div className="m-4 bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg flex items-start gap-3">
              <AlertTriangle className="shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-bold text-sm">Theme Fetch Error</h4>
                <p className="text-xs font-mono mt-1 whitespace-pre-wrap">{fetchError.message}</p>
              </div>
           </div>
        )}

        {!isLoadingTheme && !fetchError && (
          <>
            <CartDrawerContainer theme={themeId} username="preview" isPreview={true} storeId={portfolioId} />
            
            {previewMode === 'shop' && <ModernShopLayout {...dummyShopProps as any} />}
            {previewMode === 'product' && <ModernProductLayout {...dummyProductProps as any} />}
            {previewMode === 'portal' && <ModernLoginLayout {...dummyLoginProps as any} />}
            {previewMode === 'checkout' && (
              <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
                 <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4"><ShoppingCart size={32} /></div>
                 <h2 className="text-2xl font-bold mb-2">Checkout Layout Preview</h2>
                 <p className="text-muted-foreground text-sm max-w-md text-center">Your checkout flow uses the <strong>{themeConfig.store_checkout_layout || 'One-Page'}</strong> layout. Fully functional preview coming soon.</p>
              </div>
            )}
            
            {(previewMode === 'page' || previewMode === 'cart' || previewMode === 'general') && sections
              .filter((s) => s.isVisible)
              .map((section) => {
            
            // 🚀 SMART RENDERER: Pick from Natively Compiled Components OR Local Registry
            let Component = null;
            if (isCustomTheme && compiledComponents) {
               const compName = formatSectionTypeToComponentName(section.type);
               Component = compiledComponents[compName] || compiledComponents[section.type]; 
               
               // Fallback check to 'modern' registry if the developer missed a section block
               if (!Component && THEME_REGISTRY['modern']) {
                  Component = resolveThemeComponent(THEME_REGISTRY['modern'], section.type);
               }
            } else {
               Component = resolveThemeComponent(ActiveTheme, section.type);
            }

            if (!Component) return null;

            const sectionProps = {
              data: section.data,
              settings: section.settings || {},
              id: section.id,
              allSections: sections,
              isPreview: true,
              actorId: actorId,
              portfolioId: portfolioId,
            };

            const isHeader = section.type === "header";

            return (
              <div
                id={section.id}
                key={section.id}
                className={cn(
                  isHeader ? "sticky top-0 z-50 w-full" : "relative z-0 w-full",
                  "group hover:ring-2 hover:ring-primary/40 hover:ring-inset transition-all duration-200"
                )}
                onClickCapture={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest("a") || target.tagName === "BUTTON") {
                    e.preventDefault();
                  }
                }}
              >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 z-[100]">
                  <button
                    type="button"
                    aria-label={`Edit ${section.type.replace("_", " ")} section`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.parent.postMessage(
                        { type: "EDIT_SECTION", payload: section.id },
                        "*"
                      );
                    }}
                    className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded shadow-lg flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                  >
                    Edit {section.type.replace("_", " ")}
                  </button>
                </div>

                <Suspense
                  fallback={
                    <div className="py-12 flex justify-center">
                      <Loader2 className="animate-spin text-muted-foreground" />
                    </div>
                  }
                >
                  <Component {...sectionProps} />
                </Suspense>
              </div>
            );
          })}
          </>
        )}
      </div>
    </>
  );
}