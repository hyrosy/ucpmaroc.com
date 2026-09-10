import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Import Layouts
import ModernShopLayout from "@/themes/modern/ShopLayout";
import CartDrawerContainer from "@/features/ecommerce/components/CartDrawerContainer";
import { useCartStore } from "../store/useCartStore";

// Ensure this matches App.tsx
const MAIN_DOMAINS = [
  "ucpmaroc.com",
  "www.ucpmaroc.com",
  "localhost",
  "127.0.0.1",
  "symmetrical-acorn-697wxxq4r74j3jpj-5173.app.github.dev",
  "psychic-cod-r74vrp5xx9gq2ppr7-5173.app.github.dev",
  "laughing-succotash-wrxrgrqvpj75hv99q-5173.app.github.dev",
];


export default function PublicShopPage() {
  const { slug } = useParams<{ slug?: string }>();
  const { portfolio } = useOutletContext<{ portfolio?: any }>();
  const navigate = useNavigate();

  const [theme, setTheme] = useState<string>("modern");
  const [resolvedPublicSlug, setResolvedPublicSlug] = useState<string>("");
  const [products, setProducts] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [themeConfig, setThemeConfig] = useState<any>({});

  // Filter State
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchShopData = async () => {
      setLoading(true);

      const currentPortfolioId = portfolio?.id || null;
      const currentActorId = portfolio?.actor_id || null;
      const currentTheme = portfolio?.theme_config?.templateId || "modern";
      const currentPublicSlug = portfolio?.public_slug || slug || "";
      const currentThemeConfig = portfolio?.theme_config || {};

      if (!currentActorId) {
        setError("Store not found.");
        setLoading(false);
        return;
      }

      setTheme(currentTheme);
      setResolvedPublicSlug(currentPublicSlug);
      setPortfolioId(currentPortfolioId);
      setThemeConfig(currentThemeConfig);
      
      // 🚀 FORCE CONTEXT SWITCH IMMEDIATELY
      if (currentPortfolioId) {
        useCartStore.getState().validateStoreContext(currentPortfolioId);
      }

      // 2. Fetch Products & Collections (WITH STORE SEPARATION LOGIC)
      let productsQuery = supabase
        .from("pro_products")
        .select(`*, pro_collections(title, slug)`)
        .eq("actor_id", currentActorId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      // ✅ SMART FILTER: Only fetch products assigned to this specific store OR global (null) products!
      if (currentPortfolioId) {
        productsQuery = productsQuery.or(
          `portfolio_id.eq.${currentPortfolioId},portfolio_id.is.null`
        );
      }

      let collectionsQuery = supabase
        .from("pro_collections")
        .select("*")
        .eq("actor_id", currentActorId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (currentPortfolioId) {
        collectionsQuery = collectionsQuery.or(
          `portfolio_id.eq.${currentPortfolioId},portfolio_id.is.null`
        );
      }

      const [productsRes, collectionsRes] = await Promise.all([
        productsQuery,
        collectionsQuery,
      ]);

      if (productsRes.error || collectionsRes.error) {
        setError("We could not load this store right now.");
        setLoading(false);
        return;
      }
      if (productsRes.data) setProducts(productsRes.data);
      if (collectionsRes.data) setCollections(collectionsRes.data);

      setLoading(false);
    };

    fetchShopData();
  }, [portfolio, slug]);

  // Derived state: Filter products based on search query AND active collection
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCollection = activeCollection
        ? product.collection_id === activeCollection
        : true;
      const matchesSearch =
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCollection && matchesSearch;
    });
  }, [products, activeCollection, searchQuery]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
        <h2 className="text-2xl font-bold mb-4">{error}</h2>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );

  // Helper for the layout props to keep URLs clean based on environment
  function isCustomDomain() {
    return !MAIN_DOMAINS.some((domain) =>
      window.location.hostname.includes(domain)
    );
  }

  const layoutProps = {
    username: isCustomDomain() ? "" : `pro/${resolvedPublicSlug}`,
    products,
    collections,
    activeCollection,
    setActiveCollection,
    searchQuery,
    setSearchQuery,
    filteredProducts,
    themeConfig,
  };

  // ROUTER: Inject the exact layout based on the actor's active theme
  return (
    <>
      <CartDrawerContainer theme={theme} username={layoutProps.username} storeId={portfolioId} />
      <ModernShopLayout {...layoutProps} />
    </>
  );
}
