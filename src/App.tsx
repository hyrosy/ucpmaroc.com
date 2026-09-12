import React, { useEffect, useState, Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import emailjs from "@emailjs/browser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
// --- LAYOUTS & COMPONENTS ---
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import PlatformLoader from "./components/PlatformLoader";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
// --- LAYOUT IMPORTS ---
const AdminDashboardLayout = lazy(() => import("./layouts/AdminDashboardLayout"));
const ActorDashboardLayout = lazy(() => import("./layouts/ActorDashboardLayout"));
// --- LAZY LOADED PORTFOLIO ARCHITECTURE ---
import PortfolioLayout from "@/features/portfolio-builder/layouts/PortfolioLayout";
import PortfolioHome from "@/features/portfolio-builder/pages/PortfolioHome";
import DynamicPage from "@/features/portfolio-builder/pages/DynamicPage";

// --- LAZY LOADED MAIN PAGES ---
const HomePage = lazy(() => import("./pages/HomePage"));
const TalentLandingPage = lazy(() => import("./pages/TalentLandingPage"));
const ClientLandingPage = lazy(() => import("./pages/ClientLandingPage"));

// --- LAZY LOADED FEATURE PAGES ---
const FeaturePortfolioBuilder = lazy(() => import("./pages/features/FeaturePortfolioBuilder"));
const FeatureEcommerce = lazy(() => import("./pages/features/FeatureEcommerce"));
const FeatureThemeStudio = lazy(() => import("./pages/features/FeatureThemeStudio"));
const FeatureWallet = lazy(() => import("./pages/features/FeatureWallet"));

// --- STANDARD IMPORTS ---
const PrivacyPolicyPage = lazy(() => import("./components/PrivacyPolicy.tsx"));
const ContactUsPage = lazy(() => import("./pages/ContactUsPage"));
const TermsofService = lazy(() => import("./components/TermsofService.tsx"));
const TermsandConditions = lazy(() => import("./components/TermsandConditions.tsx"));
const VoiceOverLandingPage = lazy(() => import("./pages/VoiceOverLandingPage"));
const AdminDashboardPage = lazy(() => import("@/features/admin-core/pages/AdminDashboardPage"));
const AdminOrderDetailPage = lazy(() => import("@/features/admin-core/pages/AdminOrderDetailPage"));
const AdminActorListPage = lazy(() => import("@/features/admin-core/pages/AdminActorListPage"));
const AdminClientListPage = lazy(() => import("@/features/admin-core/pages/AdminClientListPage"));
const AdminThemesPage = lazy(() => import("@/features/admin-core/pages/AdminThemesPage"));
const AdminPayoutsPage = lazy(() => import("@/features/admin-core/pages/AdminPayoutsPage"));
const AdminDomainListPage = lazy(() => import("@/features/admin-core/pages/AdminDomainListPage"));
const AdminDomainOrderDetailPage = lazy(() => import("@/features/admin-core/pages/AdminDomainOrderDetailPage"));
const AdminMarketplaceSettingsPage = lazy(() => import("@/features/admin-core/pages/AdminMarketplaceSettingsPage"));

// --- DASHBOARD IMPORTS ---
const ActorProfilePage = lazy(() => import("@/features/talent-marketplace/pages/ActorProfilePage"));
const FavoriteActorsPage = lazy(() => import("@/features/talent-marketplace/pages/FavoriteActorsPage"));
const DashboardLibrary = lazy(() => import("@/features/talent-marketplace/pages/DashboardLibrary"));
const DashboardDemos = lazy(() => import("@/features/talent-marketplace/pages/DashboardDemos"));
const DashboardOrders = lazy(() => import("@/features/talent-marketplace/pages/DashboardOrders"));
const ActorEarningsPage = lazy(() => import("@/features/talent-marketplace/payouts/pages/ActorEarningsPage"));
const ActorPayoutSettingsPage = lazy(() => import("@/features/talent-marketplace/payouts/pages/ActorPayoutSettingsPage"));
const MyShortlistPage = lazy(() => import("@/features/talent-marketplace/pages/MyShortlistPage"));
const DashboardProfile = lazy(() => import("@/features/talent-marketplace/pages/DashboardProfile"));
const ServicesHubPage = lazy(() => import("@/features/talent-marketplace/pages/services/ServicesHubPage"));
const ServiceWorkspacePage = lazy(() => import("@/features/talent-marketplace/pages/services/ServiceWorkspacePage"));
const VoiceOverServicePage = lazy(() => import("@/features/talent-marketplace/pages/services/VoiceOverServicePage"));
const ScriptwritingServicePage = lazy(() => import("@/features/talent-marketplace/pages/services/ScriptwritingServicePage"));
const VideoEditingServicePage = lazy(() => import("@/features/talent-marketplace/pages/services/VideoEditingServicePage"));
const DeliveryServicePage = lazy(() => import("@/features/talent-marketplace/pages/services/DeliveryServicePage"));
const ClientDashboardPage = lazy(() => import("@/features/talent-marketplace/pages/ClientDashboardPage"));
const ClientOrderPage = lazy(() => import("@/features/talent-marketplace/pages/ClientOrderPage"));
const PortfolioPage = lazy(() => import("@/features/talent-marketplace/pages/PortfolioPage"));
const ServiceDetailsPage = lazy(() => import("@/features/talent-marketplace/pages/ServiceDetailsPage"));
const ActorLoginPage = lazy(() => import("@/features/auth/pages/ActorLoginPage"));
const ActorSignUpPage = lazy(() => import("@/features/auth/pages/ActorSignUpPage"));
const ClientAuthPage = lazy(() => import("@/features/auth/pages/ClientAuthPage"));
const CreateProfilePromptPage = lazy(() => import("@/features/auth/pages/CreateProfilePromptPage"));
const MessagesPage = lazy(() => import("@/features/messaging/pages/MessagesPage"));
const AdminChatSheet = lazy(() => import("@/features/messaging/components/AdminChatSheet").then((module) => ({ default: module.AdminChatSheet || module.default })));
const DomainMarketplace = lazy(() => import("@/features/domain-marketplace/pages/DomainMarketplace"));
const DomainCheckout = lazy(() => import("@/features/domain-marketplace/pages/DomainCheckout"));
const DomainThankYouPage = lazy(() => import("@/features/domain-marketplace/pages/DomainThankYouPage"));
const DomainOrderPage = lazy(() => import("@/features/domain-marketplace/pages/DomainOrderPage"));
const AnalyticsPage = lazy(() => import("@/features/ecommerce/pages/AnalyticsPage"));
const OrdersPage = lazy(() => import("@/features/ecommerce/pages/OrdersPage"));
const StoreInboxPage = lazy(() => import("@/features/ecommerce/pages/store-inbox/StoreInboxPage"));
const StoreBotSettingsPage = lazy(() => import("@/features/ecommerce/pages/store-settings/StoreBotSettingsPage"));
const LeadsPage = lazy(() => import("@/features/ecommerce/pages/LeadsPage"));
const FormsPage = lazy(() => import("@/features/ecommerce/pages/FormsPage"));
const ProOrderDetailPage = lazy(() => import("@/features/ecommerce/pages/ProOrderDetailPage"));
const PaymentsPage = lazy(() => import("@/features/ecommerce/pages/PaymentsPage"));
const StripeCallbackPage = lazy(() => import("@/features/ecommerce/pages/StripeCallbackPage"));
const SettingsPage = lazy(() => import("@/features/portfolio-builder/pages/SettingsPage"));
const BillingPage = lazy(() => import("@/features/portfolio-builder/pages/BillingPage"));
const CustomersPage = lazy(() => import("@/features/ecommerce/pages/CustomersPage"));
const ReviewsPage = lazy(() => import("@/features/ecommerce/pages/ReviewsPage.tsx"));
const CustomerLoginPage = lazy(() => import("@/features/ecommerce/pages/CustomerLoginPage"));
const CustomerDashboardLayout = lazy(() => import("@/layouts/CustomerDashboardLayout"));
const CustomerDashboardOverview = lazy(() => import("@/features/ecommerce/pages/CustomerDashboardOverview"));
const CustomerOrdersPage = lazy(() => import("@/features/ecommerce/pages/CustomerOrdersPage"));
const CustomerOrderDetailPage = lazy(() => import("@/features/ecommerce/pages/CustomerOrderDetailPage"));
const CustomerMessagesPage = lazy(() => import("@/features/ecommerce/pages/CustomerMessagesPage"));

// --- E-COMMERCE PUBLIC PAGES ---
const ProductsPage = lazy(() => import("@/features/ecommerce/pages/ProductsPage"));
const CollectionsPage = lazy(() => import("@/features/ecommerce/pages/CollectionsPage"));
const ShippingRatesPage = lazy(() => import("@/features/ecommerce/pages/ShippingRatesPage"));
const CouponsPage = lazy(() => import("@/features/ecommerce/pages/CouponsPage"));
const MarketsPage = lazy(() => import("@/features/ecommerce/pages/MarketsPage"));
const PublicShopPage = lazy(() => import("@/features/ecommerce/pages/PublicShopPage"));
const PublicProductPage = lazy(() => import("@/features/ecommerce/pages/PublicProductPage"));
const PublicCheckoutPage = lazy(() => import("@/features/ecommerce/checkout/PublicCheckoutPage"));
const PublicThankYouPage = lazy(() => import("@/features/ecommerce/checkout/PublicThankYouPage"));
const CheckoutLayout = lazy(() => import("./themes/modern/CheckoutLayout.tsx"));
const ThankYouLayout = lazy(() => import("./themes/modern/ThankYouLayout.tsx"));
const BuilderPreview = lazy(() => import("@/features/portfolio-builder/pages/BuilderPreview"));
const PortfolioBuilderPage = lazy(() => import("@/features/portfolio-builder/pages/PortfolioBuilderPage"));
const ThemeStudioPage = lazy(() => import("@/features/theme-studio/pages/ThemeStudioPage"));
const DeveloperHubPage = lazy(() => import("@/features/theme-studio/pages/DeveloperHubPage"));
const StudioPreview = lazy(() => import("@/features/theme-studio/pages/StudioPreview"));

// Define main domains globally
const MAIN_DOMAINS = [
  "ucpmaroc.com",
  "www.ucpmaroc.com",
  "localhost",
  "127.0.0.1",
  "symmetrical-acorn-697wxxq4r74j3jpj-5173.app.github.dev",
  "psychic-cod-r74vrp5xx9gq2ppr7-5173.app.github.dev",
  "laughing-succotash-wrxrgrqvpj75hv99q-5173.app.github.dev",
];

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

// --- MAIN WRAPPER LAYOUT COMPONENT ---
const Layout = ({
  children,
  isCustomDomain,
}: {
  children: React.ReactNode;
  isCustomDomain: boolean;
}) => {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1024 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const hideFooterPaths = [
    "/dashboard",
    "/messages",
    "/client-dashboard",
    "/admin",
    "/pro",
    "/builder-preview",
    "/studio-preview",
    "/actor-login",
    "/actor-signup",
    "/client-auth",
    "/create-profile",
  ];

  const alwaysHideNavbarPaths = [
    "/pro", 
    "/builder-preview",
    "/studio-preview", 
    "/dashboard", 
    "/admin"
  ]; 

  const desktopHideNavbarPaths = [
    "/actor-login", 
    "/actor-signup", 
    "/client-auth", 
    "/create-profile"
  ];

  const shouldHideFooter =
    isCustomDomain ||
    hideFooterPaths.some((path) => location.pathname.startsWith(path));
  const shouldHideNavbar =
    isCustomDomain ||
    alwaysHideNavbarPaths.some((path) => location.pathname.startsWith(path)) ||
    (!isMobile && desktopHideNavbarPaths.some((path) => location.pathname.startsWith(path)));

  return (
    <>
      {!shouldHideNavbar && <Navbar />}
      <main className={`flex-grow ${shouldHideNavbar ? "" : "pt-0"}`}>
        {children}
      </main>
      {!shouldHideFooter && <Footer />}
    </>
  );
};

function App() {
  useEffect(() => {
    emailjs.init("LOZrhOD88Fa4aQQlz");
  }, []);

  const currentHostname = window.location.hostname;
  const isLocalIp = /^[0-9\.]+$/.test(currentHostname); // Prevents mobile test IPs (192.168.x.x) from being treated as custom domains
  const isCustomDomain = !MAIN_DOMAINS.some((domain) =>
    currentHostname.includes(domain)
  ) && !isLocalIp;

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ScrollToTop />
        <main className="flex-grow">
          <Layout isCustomDomain={isCustomDomain}>
            <Suspense
              fallback={<PlatformLoader />}
            >
              <Routes>
                {/* 🚀 ROUTE SPLIT A: CUSTOM DOMAIN VISITORS */}
                {isCustomDomain ? (
                  <Route
                    path="/"
                    element={<PortfolioLayout customDomain={currentHostname} />}
                  >
                    <Route index element={<PortfolioHome />} />
                    <Route path="shop" element={<PublicShopPage />} />
                    <Route
                      path="product/:productSlug"
                      element={<PublicProductPage />}
                    />
                    <Route path="checkout" element={<CheckoutLayout />}>
                      <Route index element={<PublicCheckoutPage />} />
                    </Route>
                    <Route path="thank-you" element={<ThankYouLayout />}>
                      <Route index element={<PublicThankYouPage />} />
                    </Route>
                    <Route path="login" element={<CustomerLoginPage />} />
                    <Route path="dashboard" element={<CustomerDashboardLayout />}>
                      <Route index element={<CustomerDashboardOverview />} />
                      <Route path="orders" element={<CustomerOrdersPage />} />
                      <Route path="orders/:id" element={<CustomerOrderDetailPage />} />
                      <Route path="messages" element={<CustomerMessagesPage />} />
                    </Route>
                    <Route path=":pageSlug" element={<DynamicPage />} />
                  </Route>
                ) : (
                  /* 🚀 ROUTE SPLIT B: MAIN PLATFORM VISITORS */
                  <>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/for-talents" element={<TalentLandingPage />} />
                    <Route path="/for-clients" element={<ClientLandingPage />} />
                    
                    {/* 🚀 FEATURE DEEP DIVES */}
                    <Route path="/features/portfolio-builder" element={<FeaturePortfolioBuilder />} />
                    <Route path="/features/ecommerce" element={<FeatureEcommerce />} />
                    <Route path="/features/theme-studio" element={<FeatureThemeStudio />} />
                    <Route path="/features/wallet" element={<FeatureWallet />} />

                    <Route
                      path="/my-favorites"
                      element={<FavoriteActorsPage />}
                    />
                    <Route
                      path="/Voiceover"
                      element={<VoiceOverLandingPage />}
                    />
                    <Route path="/market" element={<PortfolioPage />} />
                    <Route path="/market/service/:actorSlug/:serviceId" element={<ServiceDetailsPage />} />
                    <Route path="/portfolio" element={<Navigate to="/market" replace />} />
                    <Route
                      path="/privacy-policy"
                      element={<PrivacyPolicyPage />}
                    />
                    <Route
                      path="/terms-of-service"
                      element={<TermsofService />}
                    />
                    <Route
                      path="/terms-of-conditions"
                      element={<TermsandConditions />}
                    />
                    <Route path="/contact" element={<ContactUsPage />} />

                    <Route path="/pro/:slug" element={<PortfolioLayout />}>
                      <Route index element={<PortfolioHome />} />
                      <Route path="shop" element={<PublicShopPage />} />
                      <Route
                        path="product/:productSlug"
                        element={<PublicProductPage />}
                      />
                      <Route path="checkout" element={<CheckoutLayout />}>
                        <Route index element={<PublicCheckoutPage />} />
                      </Route>
                      <Route path="thank-you" element={<ThankYouLayout />}>
                        <Route index element={<PublicThankYouPage />} />
                      </Route>
                      <Route path="login" element={<CustomerLoginPage />} />
                      <Route path="dashboard" element={<CustomerDashboardLayout />}>
                        <Route index element={<CustomerDashboardOverview />} />
                        <Route path="orders" element={<CustomerOrdersPage />} />
                        <Route path="orders/:id" element={<CustomerOrderDetailPage />} />
                        <Route path="messages" element={<CustomerMessagesPage />} />
                      </Route>
                      <Route path=":pageSlug" element={<DynamicPage />} />
                    </Route>

                    <Route
                      path="/dashboard/payments/callback"
                      element={<StripeCallbackPage />}
                    />
                    <Route
                      path="/actor/:actorName"
                      element={<ActorProfilePage />}
                    />
                    <Route path="/actor-login" element={<ActorLoginPage />} />
                    <Route path="/actor-signup" element={<ActorSignUpPage />} />
                    <Route
                      path="/create-profile"
                      element={<CreateProfilePromptPage />}
                    />

                    <Route path="/client-auth" element={<ClientAuthPage />} />
                    <Route
                      path="/client-dashboard"
                      element={<ClientDashboardPage />}
                    />
                    <Route
                      path="/order/:orderId"
                      element={<ClientOrderPage />}
                    />
                    <Route path="/my-shortlist" element={<MyShortlistPage />} />
                    <Route path="/messages" element={<MessagesPage />} />
                    <Route
                      path="/messages/:conversationId"
                      element={<MessagesPage />}
                    />
                    <Route
                      path="/builder-preview"
                      element={<BuilderPreview />}
                    />
                    <Route path="/studio-preview" element={<StudioPreview />} />

                    {/* ACTOR DASHBOARD */}
                    <Route path="/dashboard" element={<ActorDashboardLayout />}>
                      <Route index element={<AnalyticsPage />} />
                      <Route path="profile" element={<DashboardProfile />} />
                      <Route path="messages" element={<MessagesPage />} />
                      <Route
                        path="messages/:conversationId"
                        element={<MessagesPage />}
                      />
                      <Route path="services" element={<ServicesHubPage />} />
                      <Route path="services/voice-over" element={<VoiceOverServicePage />} />
                      <Route path="services/scriptwriting" element={<ScriptwritingServicePage />} />
                      <Route path="services/video-editing" element={<VideoEditingServicePage />} />
                      <Route path="services/delivery" element={<DeliveryServicePage />} />
                      <Route path="services/:serviceId" element={<ServiceWorkspacePage />} />

                      <Route path="demos" element={<DashboardDemos />} />
                      <Route path="library" element={<DashboardLibrary />} />
                      <Route path="earnings" element={<ActorEarningsPage />} />
                      <Route
                        path="payout-settings"
                        element={<ActorPayoutSettingsPage />}
                      />
                      <Route
                        path="Portfolio"
                        element={<PortfolioBuilderPage />}
                      />
                      <Route path="job-orders" element={<DashboardOrders />} />

                      <Route path="orders" element={<OrdersPage />} />
                      <Route path="store-inbox" element={<StoreInboxPage />} />
                      <Route path="orders/:id" element={<ProOrderDetailPage />} />
                      <Route path="leads" element={<LeadsPage />} />
                      <Route path="store-bot" element={<StoreBotSettingsPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="billing" element={<BillingPage />} />
                      <Route path="products" element={<ProductsPage />} />
                      <Route path="collections" element={<CollectionsPage />} />
                      <Route path="shipping" element={<ShippingRatesPage />} />
                      <Route path="coupons" element={<CouponsPage />} />
                      <Route path="forms" element={<FormsPage />} />
                      <Route path="markets" element={<MarketsPage />} />
                      <Route path="payments" element={<PaymentsPage />} />
                      <Route path="customers" element={<CustomersPage />} />
                      <Route path="reviews" element={<ReviewsPage />} />
                      <Route path="studio" element={<ThemeStudioPage />} />
                      <Route
                        path="creator-hub"
                        element={<DeveloperHubPage />}
                      />
                    </Route>

                    {/* 🚀 3. THE NEW ADMIN DASHBOARD ROUTING */}
                    <Route
                      element={<ProtectedRoute allowedRoles={["admin"]} />}
                    >
                      <Route path="/admin" element={<AdminDashboardLayout />}>
                        <Route index element={<AdminDashboardPage />} />
                        <Route
                          path="order/:orderId"
                          element={<AdminOrderDetailPage />}
                        />
                        <Route path="actors" element={<AdminActorListPage />} />
                        <Route
                          path="clients"
                          element={<AdminClientListPage />}
                        />
                        <Route
                          path="domains"
                          element={<AdminDomainListPage />}
                        />
                        <Route
                          path="domains/order/:id"
                          element={<AdminDomainOrderDetailPage />}
                        />
                                                <Route
                          path="themes"
                          element={<AdminThemesPage />}
                        />

                        <Route path="payouts" element={<AdminPayoutsPage />} />
                        <Route
                          path="marketplace-settings"
                          element={<AdminMarketplaceSettingsPage />}
                        />
                      </Route>
                    </Route>

                    {/* MARKETPLACE ROUTES */}
                    <Route
                      path="/marketplace/domains"
                      element={<DomainMarketplace />}
                    />
                    <Route
                      path="/marketplace/domains/:id/checkout"
                      element={<DomainCheckout />}
                    />
                    <Route
                      path="/marketplace/order/:id/thank-you"
                      element={<DomainThankYouPage />}
                    />
                    <Route
                      path="/marketplace/order/:id/status"
                      element={<DomainOrderPage />}
                    />
                  </>
                )}
              </Routes>
            </Suspense>
          </Layout>
        </main>
        <Suspense fallback={null}>
          <AdminChatSheet />
        </Suspense>
        <Toaster theme="dark" position="bottom-right" />
      </Router>
    </QueryClientProvider>
  );
}

export default App;
