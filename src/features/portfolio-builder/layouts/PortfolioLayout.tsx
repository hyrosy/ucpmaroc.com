import { Suspense, useEffect, useMemo, type CSSProperties } from "react";
import { Outlet, useParams, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CustomLoader } from "@/features/portfolio-builder/pages/PortfolioHome";

import { usePortfolio } from "@/features/portfolio-builder";
import { trackEvent } from "@/lib/analytics";
import {
  THEME_REGISTRY,
  DEFAULT_THEME,
  resolveThemeComponent,
} from "@/themes/registry";

import CartDrawerContainer from "@/features/ecommerce/components/CartDrawerContainer";
import { useBuilderStore } from "@/store/useBuilderStore";
import { cn } from "@/lib/utils";
import StorefrontChatWidget from "@/features/ecommerce/components/store-chat/StorefrontChatWidget";
import { MessageCircle } from "lucide-react";

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
// 🚀 THEME DICTIONARY
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

const EMPTY_BUILDER_SECTIONS: never[] = [];
const EMPTY_BUILDER_THEME: Record<string, never> = {};


interface PortfolioLayoutProps {
  customDomain?: string;
}

export default function PortfolioLayout({
  customDomain,
}: PortfolioLayoutProps) {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();

  // 🚀 1. DETECT IF WE ARE IN THE BUILDER
  // If the URL is exactly "/builder-preview", we are inside the iframe!
  const isBuilderPreview = location.pathname === "/builder-preview";

  // 🚀 2. FETCH DATA (Only if we are NOT in the builder)
  const { data, isLoading, isError } = usePortfolio({
    slug: isBuilderPreview ? undefined : slug,
    customDomain: isBuilderPreview ? undefined : customDomain,
  });

  // 🚀 3. GET ZUSTAND STORE DATA (Only matters if we ARE in the builder)
  const builderSections = useBuilderStore((state) =>
    isBuilderPreview ? state.sections : EMPTY_BUILDER_SECTIONS
  );
  const builderThemeConfig = useBuilderStore((state) =>
    isBuilderPreview ? state.themeConfig : EMPTY_BUILDER_THEME
  );

  // --- ANALYTICS TRACKING (Only run on live site) ---
  useEffect(() => {
    if (!isBuilderPreview && data?.portfolio && data.portfolio.actor_id) {
      const sessionKey = `viewed_${
        data.portfolio.id
      }_${new Date().toDateString()}`;
      if (!sessionStorage.getItem(sessionKey)) {
        trackEvent(data.portfolio.actor_id, "page_view", {
          portfolio_id: data.portfolio.id,
        });
        sessionStorage.setItem(sessionKey, "true");
      }
    }
  }, [data, isBuilderPreview]);

  // --- DETERMINE SOURCE OF TRUTH (Database vs Zustand) ---
  const activeData = useMemo(() => {
    if (isBuilderPreview) {
      return {
        portfolio: {
          sections: builderSections,
          theme_config: builderThemeConfig,
          id: "preview-id",
          actor_id: "preview-actor-id",
          site_name: "Live Preview",
        },
        actorProfile: { ActorName: "Preview Mode" },
      };
    }
    return data;
  }, [isBuilderPreview, builderSections, builderThemeConfig, data]);

  // --- LOADING & ERROR STATES (Only for live site) ---
  if (!isBuilderPreview && isLoading) {
    return (
      <div
        className="min-h-screen w-full bg-neutral-950 text-white"
        style={
          {
            "--primary": "0 0% 70%",
            "--ring": "0 0% 70%",
          } as CSSProperties
        }
      >
        <CustomLoader themeConfig={{ loaderStyle: "spinner" }} type="page" />
      </div>
    );
  }

  if (!isBuilderPreview && (isError || !activeData?.portfolio)) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center text-center p-4 bg-background text-foreground">
        <h1 className="text-3xl font-bold mb-2">Portfolio Not Found</h1>
        <p className="text-muted-foreground">
          This page does not exist or has not been published yet.
        </p>
      </div>
    );
  }

  const { portfolio, actorProfile } = activeData || {};
  const sections = portfolio?.sections || [];
  const themeConfig = portfolio?.theme_config || {};

  // --- THEME & COMPONENT RESOLUTION ---
  const themeId = themeConfig.templateId || "modern";
  const ActiveTheme = THEME_REGISTRY[themeId] || DEFAULT_THEME;

  const headerSection = sections.find((s: any) => s.type === "header");
  const HeaderComponent = headerSection
    ? resolveThemeComponent(ActiveTheme, "header")
    : null;

  const seoTitle =
    portfolio?.site_name || actorProfile?.ActorName || "Portfolio";

  // --- CSS INJECTION LOGIC ---
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
  const palette = THEME_PALETTES[themeId] || THEME_PALETTES.modern;
  const colorMode = themeConfig.colorMode || "dark";
  const activePalette = colorMode === "light" ? palette.light : palette.dark;


  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
      </Helmet>

      {/* 🚀 THE STYLING ENGINE */}
      <style>
        {`
          @import url('${fontUrl}');
          
          :root, .portfolio-canvas-wrapper {
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
  




          .portfolio-canvas-wrapper {
            font-family: '${activeFont}', sans-serif;
            /* Force the background color of the wrapper to match the theme */
            background-color: var(--background);
            color: var(--foreground);
          }
          
          .portfolio-canvas-wrapper button, 
          .portfolio-canvas-wrapper input, 
          .portfolio-canvas-wrapper textarea,
          .portfolio-canvas-wrapper select {
            font-family: inherit;
          }
        `}
      </style>

      {/* 🚀 MASTER WRAPPER (This div contains the injected styles) */}
      <Suspense fallback={<CustomLoader themeConfig={themeConfig} type="page" />}>
        <div
          className={cn(
            "portfolio-canvas-wrapper min-h-screen flex flex-col selection:bg-primary/30 selection:text-primary",
            colorMode === "dark" ? "dark" : ""
          )}
        >
        {HeaderComponent && headerSection?.isVisible && (
          <div className="relative z-50">
            <HeaderComponent
              data={headerSection.data}
              allSections={sections}
              id={headerSection.id}
              actorId={portfolio?.actor_id}
              portfolioId={portfolio?.id}
              isPreview={isBuilderPreview}
            />
          </div>
        )}

        <main className="flex-grow relative z-0 flex flex-col min-h-[calc(100vh-80px)]">
          {/* Outlet injects PortfolioHome, DynamicPage, etc. */}
          <Outlet
            context={{ portfolio, actorProfile, isPreview: isBuilderPreview }}
          />
        </main>

        {/* Global Cart (Hidden in builder preview to avoid clutter) */}
        {!isBuilderPreview && (
          <CartDrawerContainer
            theme={themeId}
            username={slug}
            isPreview={false}
          />
        )}

        {/* 🚀 Global Store Chat Widget */}
        {!isBuilderPreview && themeConfig?.store_chat_enabled && themeConfig?.store_chat_mode === 'internal' && (
          <StorefrontChatWidget 
            portfolioId={portfolio?.id} 
            storeName={portfolio?.site_name} 
            aiEnabled={themeConfig?.store_chat_ai_assistant} 
            iconType={themeConfig?.store_chat_icon_type}
            customIconUrl={themeConfig?.store_chat_custom_icon_url}
            welcomeMessage={themeConfig?.store_chat_welcome_message}
            suggestedQuestions={themeConfig?.store_chat_suggested_questions}
          />
        )}

        {/* 🚀 WhatsApp Mode Widget */}
        {!isBuilderPreview && themeConfig?.store_chat_enabled && themeConfig?.store_chat_mode === 'whatsapp' && themeConfig?.store_chat_whatsapp_number && (
          <a
            href={`https://wa.me/${themeConfig.store_chat_whatsapp_number.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(themeConfig.store_chat_welcome_message || 'Hello!')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center bg-transparent text-[#25D366] drop-shadow-2xl hover:scale-110 transition-transform"
          >
            <MessageCircle size={56} className="fill-current" strokeWidth={1} />
          </a>
        )}
        </div>
      </Suspense>
    </>
  );
}
