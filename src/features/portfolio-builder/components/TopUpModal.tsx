import React, { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Coins,
  Star,
  MessageCircle,
  Loader2,
  ArrowLeft,
  Lock,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Landmark,
  Bitcoin,
  QrCode,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- STRIPE IMPORTS ---
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ""
);

const COIN_PACKS = [
  {
    id: "handful",
    name: "Handful of Coins",
    coins: 250,
    cost: 5,
    bonus: "",
    rarity: 3,
  },
  {
    id: "bag",
    name: "Bag of Coins",
    coins: 550,
    cost: 10,
    bonus: "+50 Free!",
    popular: true,
    rarity: 4,
  },
  {
    id: "chest",
    name: "Chest of Coins",
    coins: 1200,
    cost: 20,
    bonus: "+200 Free!",
    rarity: 5,
  },
  {
    id: "handful_lg",
    name: "Sack of Coins",
    coins: 1500,
    cost: 26,
    bonus: "+200 Free!",
    rarity: 4,
  },
  {
    id: "bag_lg",
    name: "Treasury",
    coins: 3000,
    cost: 54,
    bonus: "+300 Free!",
    popular: true,
    rarity: 5,
  },
  {
    id: "chest_lg",
    name: "Vault of Coins",
    coins: 8000,
    cost: 153,
    bonus: "+350 Free!",
    rarity: 5,
  },
];

const COIN_PRICE_USD = 0.02;

interface TopUpModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  actorData: any;
  profile: any;
  onSuccess: () => void;
  notify: (
    type: "success" | "error" | "info",
    title: string,
    msg?: string
  ) => void;
}

// --- THE EMBEDDED STRIPE FORM ---
const EmbeddedStripeForm = ({ pack, onComplete, notify }: any) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url:
          window.location.origin +
          "/dashboard/settings?tab=billing&topup=success",
      },
      redirect: "if_required",
    });

    if (error) {
      notify("error", "Payment Failed", error.message);
      setIsProcessing(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      notify(
        "success",
        "Payment Successful!",
        `Added ${pack.coins} Coins to your wallet.`
      );
      onComplete();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col h-full animate-in fade-in duration-500"
    >
      <div className="mb-6 flex-grow">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full h-12 font-bold text-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg mt-auto transition-transform active:scale-[0.98]"
      >
        {isProcessing ? (
          <Loader2 className="animate-spin mr-2" />
        ) : (
          <Lock size={18} className="mr-2" />
        )}
        Securely Pay ${pack.cost.toFixed(2)}
      </Button>
    </form>
  );
};

export default function TopUpModal({
  isOpen,
  onOpenChange,
  actorData,
  profile,
  onSuccess,
  notify,
}: TopUpModalProps) {
  const [redeemCode, setRedeemCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const [tourStep, setTourStep] = useState(0);
  const [activeTab, setActiveTab] = useState("packs");

  useEffect(() => {
    const handleTour = (e: any) => setTourStep(e.detail);
    window.addEventListener("TOUR_STEP_CHANGED", handleTour);
    return () => window.removeEventListener("TOUR_STEP_CHANGED", handleTour);
  }, []);

  // Custom Coin State
  const [customCoins, setCustomCoins] = useState<string>("");

  // Embedded Checkout State
  const [selectedPack, setSelectedPack] = useState<
    (typeof COIN_PACKS)[0] | null
  >(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Payment Method State
  const [paymentMethod, setPaymentMethod] = useState<
    "card" | "crypto" | "bank"
  >("card");
  const [isGeneratingCrypto, setIsGeneratingCrypto] = useState(false);
  const [cryptoInvoiceUrl, setCryptoInvoiceUrl] = useState<string | null>(null); // 🚀 ADD THIS LINE
  // Detect Dark Mode for Stripe Elements
  useEffect(() => {
    const checkDark = () => document.documentElement.classList.contains("dark");
    setIsDark(checkDark());

    const observer = new MutationObserver(() => setIsDark(checkDark()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const handleSelectPack = async (pack: (typeof COIN_PACKS)[0]) => {
    setSelectedPack(pack);
    setPaymentMethod("card");
    setIsInitializing(true);
    setClientSecret(null);
    setCryptoInvoiceUrl(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-payment-intent",
        {
          body: {
            amount: pack.cost,
            currency: "usd",
            metadata: {
              type: "top_up",
              actor_id: actorData.id,
              coins_amount: pack.coins,
            },
          },
        }
      );

      if (error) throw error;
      if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
      } else {
        throw new Error("Failed to initialize payment.");
      }
    } catch (err: any) {
      notify("error", "Error", err.message);
      setSelectedPack(null);
      setCryptoInvoiceUrl(null);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleCustomPackSubmit = () => {
    const coins = parseInt(customCoins);
    if (isNaN(coins) || coins < 50) {
      notify("error", "Invalid Amount", "Minimum purchase is 50 coins.");
      return;
    }
    const customPack = {
      id: "custom",
      name: "Custom Coin Allocation",
      coins: coins,
      cost: coins * COIN_PRICE_USD,
      bonus: "",
      rarity: 3,
    };
    handleSelectPack(customPack);
  };

  const handleBankTransfer = () => {
    if (!actorData?.ActorName || !selectedPack) return;
    const userEmail = profile?.email || actorData.email || "No Email";
    const message = `Hello, I would like to purchase the "${
      selectedPack.name
    }" (${selectedPack.coins} Coins) for $${selectedPack.cost.toFixed(
      2
    )} via Wise / Local Bank Transfer.\n\nMy Details:\nName: ${
      actorData.ActorName
    }\nEmail: ${userEmail}\nWorkspace ID: ${
      actorData.id
    }\n\nPlease provide the transfer details so I can complete my top-up.`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/212695121176?text=${encodedMessage}`, "_blank");
  };

  const handleGenerateCryptoInvoice = async () => {
    if (!selectedPack || !actorData?.id) return;
    setIsGeneratingCrypto(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-crypto-invoice",
        {
          body: {
            amount: selectedPack.cost,
            coins_amount: selectedPack.coins,
            actor_id: actorData.id,
          },
        }
      );

      if (error) throw error;

      if (data?.invoiceUrl) {
        // 1. Mercilessly force HTTPS
        let finalUrl = data.invoiceUrl;
        if (finalUrl.includes("http://")) {
          finalUrl = finalUrl.replace("http://", "https://");
        }

        // 2. Log it to prove it worked!
        console.log("🔗 Original API URL:", data.invoiceUrl);
        console.log("🔒 Secured iframe URL:", finalUrl);

        // 3. Set the state
        setCryptoInvoiceUrl(finalUrl);
      } else {
        throw new Error("Failed to generate invoice URL.");
      }
    } catch (err: any) {
      notify(
        "error",
        "Gateway Error",
        err.message || "Could not generate crypto invoice."
      );
    } finally {
      setIsGeneratingCrypto(false);
    }
  };
  const handleRedeemCode = async () => {
    if (!redeemCode.trim() || !actorData?.id) return;
    setIsRedeeming(true);
    const { data, error } = await supabase.rpc("redeem_gift_code", {
      p_actor_id: actorData.id,
      p_code: redeemCode.trim(),
    });
    if (error || (data && !data.success)) {
      notify("error", "Redeem Failed", data?.message || error?.message);
    } else {
      notify("success", "Coins Added!", "Gift code redeemed.");
      setRedeemCode("");
      onSuccess();
      if (tourStep === 4) {
        window.dispatchEvent(new CustomEvent("TOUR_STEP_CHANGED", { detail: 5 }));
      }
    }
    setIsRedeeming(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedPack(null);
      setClientSecret(null);
      setCryptoInvoiceUrl(null);
      setActiveTab("packs");
      if (tourStep === 3 || tourStep === 4) {
        window.dispatchEvent(new CustomEvent("TOUR_STEP_CHANGED", { detail: 0 }));
      }
    }
    onOpenChange(open);
  };

  const getPackStyling = (rarity: number) => {
    if (rarity === 3)
      return {
        bg: "from-blue-900 to-slate-900",
        border: "border-blue-500/30",
        glow: "bg-blue-500/20",
        text: "text-blue-50",
        star: "text-blue-300",
      };
    if (rarity === 4)
      return {
        bg: "from-purple-900 to-slate-900",
        border: "border-purple-500/30",
        glow: "bg-purple-500/20",
        text: "text-purple-50",
        star: "text-purple-300",
      };
    if (rarity === 5)
      return {
        bg: "from-amber-700 to-slate-900",
        border: "border-amber-500/40",
        glow: "bg-amber-500/30",
        text: "text-amber-50",
        star: "text-yellow-400",
      };
    return {
      bg: "from-slate-800 to-slate-950",
      border: "border-slate-700",
      glow: "bg-slate-500/10",
      text: "text-slate-100",
      star: "text-slate-400",
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full h-[100dvh] sm:h-[85vh] sm:max-w-[1000px] p-0 gap-0 bg-zinc-50 dark:bg-zinc-950 border-none shadow-2xl sm:rounded-2xl flex flex-col overflow-hidden">
        {(tourStep === 3 || tourStep === 4) && (
          <div className="absolute inset-0 z-[50] bg-slate-950/80 backdrop-blur-sm pointer-events-none transition-all animate-in fade-in" />
        )}

        {tourStep === 5 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-indigo-900 to-purple-900 text-white animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_60px_rgba(245,158,11,0.6)]">
              <Coins size={48} className="text-white" />
            </div>
            <h2 className="text-4xl font-black mb-4 text-white">2,700 Coins Claimed!</h2>
            <p className="text-xl text-white/80 mb-8 max-w-md">
              Mashallah! You've successfully redeemed your welcome gift. You can use these coins to unlock Pro features once your trial ends, or buy new themes from the marketplace.
            </p>
            <Button 
              size="lg" 
              className="w-full max-w-xs bg-amber-500 hover:bg-amber-600 text-white font-bold text-xl h-14"
              onClick={() => {
                 window.dispatchEvent(new CustomEvent('TOUR_STEP_CHANGED', { detail: 0 }));
                 handleOpenChange(false);
              }}
            >
              Awesome, Thanks!
            </Button>
          </div>
        ) : selectedPack ? (
          /* ========================================== */
          /* TWO-COLUMN CHECKOUT VIEW                     */
          /* ========================================== */
          <div className="flex-grow flex flex-col h-full bg-background animate-in fade-in zoom-in-95 duration-300">
            {/* Header w/ Back Button */}
            <div className="p-4 border-b border-border/50 flex items-center gap-3 bg-card z-10 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedPack(null)}
                aria-label="Back to coin packs"
                className="h-8 w-8 rounded-full bg-muted/50 hover:bg-muted transition-transform active:scale-90"
              >
                <ArrowLeft size={16} />
              </Button>
              <div className="font-bold text-lg">Complete Your Purchase</div>
            </div>

            {/* Split Layout */}
            <div className="flex flex-col lg:flex-row flex-grow overflow-y-auto overflow-x-hidden">
              {/* LEFT COLUMN: The Hype / Summary */}
              <div className="w-full lg:w-[45%] p-6 lg:p-8 bg-zinc-100/50 dark:bg-zinc-900/30 border-r border-border/50 flex flex-col items-center lg:items-start text-center lg:text-left shrink-0">
                {/* The Pack Card Preview */}
                <div
                  className={cn(
                    "w-full max-w-[280px] aspect-[4/3] rounded-3xl border flex flex-col shadow-2xl mb-8 relative overflow-hidden",
                    getPackStyling(selectedPack.rarity).border,
                    "bg-gradient-to-br",
                    getPackStyling(selectedPack.rarity).bg
                  )}
                >
                  <div className="p-5 flex justify-between relative z-10 pointer-events-none">
                    <div className="flex gap-1">
                      {[...Array(selectedPack.rarity)].map((_, i) => (
                        <Star
                          key={i}
                          size={16}
                          className={cn(
                            "fill-current",
                            getPackStyling(selectedPack.rarity).star
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex-grow flex flex-col items-center justify-center relative pointer-events-none">
                    <div
                      className={cn(
                        "absolute inset-0 blur-3xl rounded-full opacity-70",
                        getPackStyling(selectedPack.rarity).glow
                      )}
                    />
                    <Coins
                      size={72}
                      className={cn(
                        "relative z-10 drop-shadow-2xl mb-2",
                        getPackStyling(selectedPack.rarity).text
                      )}
                    />
                    <h3
                      className={cn(
                        "font-black text-4xl tracking-tight relative z-10",
                        getPackStyling(selectedPack.rarity).text
                      )}
                    >
                      {selectedPack.coins.toLocaleString()}
                    </h3>
                    <p
                      className={cn(
                        "text-xs font-bold uppercase tracking-widest mt-1 opacity-80",
                        getPackStyling(selectedPack.rarity).text
                      )}
                    >
                      UCP Coins
                    </p>
                  </div>
                </div>

                <h2 className="text-2xl font-black text-foreground mb-2">
                  {selectedPack.name}
                </h2>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  You are purchasing virtual coins to be credited instantly to
                  your workspace balance.
                </p>

                <div className="w-full space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border/50 shadow-sm">
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
                      <Zap size={18} />
                    </div>
                    <div className="text-sm font-semibold">
                      Instant Delivery upon payment
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border/50 shadow-sm">
                    <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <CheckCircle2 size={18} />
                    </div>
                    <div className="text-sm font-semibold">
                      Coins never expire
                    </div>
                  </div>
                </div>

                {selectedPack.bonus && (
                  <div className="mt-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-500 w-full flex items-center gap-3">
                    <Star size={24} className="fill-amber-500 shrink-0" />
                    <div className="text-sm font-bold">
                      Includes {selectedPack.bonus}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: The Payment Gateway */}
              <div className="w-full lg:w-[55%] p-6 lg:p-8 bg-background flex flex-col">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="font-bold text-xl text-foreground">
                    Payment Method
                  </h3>
                  <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                    ${selectedPack.cost.toFixed(2)}
                  </div>
                </div>

                <Tabs
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as any)}
                  className="w-full flex-grow flex flex-col"
                >
                  <TabsList className="grid grid-cols-3 w-full h-12 mb-6 bg-muted/50 p-1 rounded-xl border border-border/50">
                    <TabsTrigger
                      value="card"
                      className="font-bold text-xs sm:text-sm rounded-lg"
                    >
                      <Lock size={14} className="mr-1.5 hidden sm:block" /> Card
                    </TabsTrigger>
                    <TabsTrigger
                      value="crypto"
                      className="font-bold text-xs sm:text-sm rounded-lg"
                    >
                      <Bitcoin size={16} className="mr-1.5 hidden sm:block" />{" "}
                      Crypto
                    </TabsTrigger>
                    <TabsTrigger
                      value="bank"
                      className="font-bold text-xs sm:text-sm rounded-lg"
                    >
                      <MessageCircle
                        size={14}
                        className="mr-1.5 hidden sm:block"
                      />{" "}
                      WhatsApp
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex-grow relative">
                    {/* --- STRIPE TAB --- */}
                    <TabsContent value="card" className="mt-0 h-full">
                      {isInitializing || !clientSecret ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] space-y-4 animate-in fade-in">
                          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                          <p className="text-muted-foreground font-medium text-sm">
                            Securing payment channel...
                          </p>
                        </div>
                      ) : (
                        // 🚀 DYNAMIC DARK MODE PASSED TO STRIPE ELEMENTS
                        <Elements
                          stripe={stripePromise}
                          options={{
                            clientSecret,
                            appearance: { theme: isDark ? "night" : "stripe" },
                          }}
                        >
                          <EmbeddedStripeForm
                            pack={selectedPack}
                            notify={notify}
                            onComplete={() => {
                              onSuccess();
                              handleOpenChange(false);
                            }}
                          />
                        </Elements>
                      )}
                    </TabsContent>

                    {/* --- CRYPTO TAB (NOWPayments / BTCPay) --- */}
                    {/* --- CRYPTO TAB (NOWPayments) --- */}
                    <TabsContent
                      value="crypto"
                      className="mt-0 h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300"
                    >
                      {cryptoInvoiceUrl ? (
                        // 🚀 THE EMBEDDED IFRAME
                        <div className="flex-grow w-full rounded-2xl overflow-hidden border border-border/50 bg-white relative animate-in zoom-in-95 min-h-[400px]">
                          <iframe
                            src={cryptoInvoiceUrl}
                            title="Crypto payment checkout"
                            className="absolute inset-0 w-full h-full border-none"
                            allow="clipboard-read; clipboard-write"
                          />
                        </div>
                      ) : (
                        // THE STANDARD GENERATE UI
                        <>
                          <div className="p-8 border-2 border-amber-500/20 bg-amber-500/5 rounded-3xl flex flex-col items-center text-center mb-6">
                            <div className="h-20 w-20 bg-gradient-to-br from-amber-400 to-orange-600 text-white rounded-full flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20">
                              <QrCode size={36} />
                            </div>
                            <h4 className="font-black text-2xl mb-3 text-foreground">
                              Pay with Web3
                            </h4>
                            <p className="text-base text-muted-foreground mb-8 max-w-sm">
                              We accept USDC, USDT, BTC, and Solana. Instant
                              settlement, no borders.
                            </p>
                          </div>
                          <Button
                            className="w-full h-12 font-bold text-lg bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/20 transition-transform active:scale-[0.98] mt-auto"
                            onClick={handleGenerateCryptoInvoice}
                            disabled={isGeneratingCrypto}
                          >
                            {isGeneratingCrypto ? (
                              <Loader2 className="animate-spin mr-2" />
                            ) : (
                              <Bitcoin className="mr-2" />
                            )}
                            Generate Crypto Checkout
                          </Button>
                        </>
                      )}
                    </TabsContent>

                    {/* --- WISE / BANK TRANSFER TAB --- */}
                    {/* Removed h-full and flex-grow to eliminate scrolling gaps */}
                    <TabsContent
                      value="bank"
                      className="mt-0 animate-in fade-in slide-in-from-right-4 duration-300"
                    >
                      <div className="p-8 border-2 border-emerald-500/20 bg-emerald-500/5 rounded-3xl flex flex-col items-center text-center mb-6">
                        <div className="h-20 w-20 bg-gradient-to-br from-emerald-400 to-teal-600 text-white rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
                          <Landmark size={36} />
                        </div>
                        <h4 className="font-black text-2xl mb-3 text-foreground">
                          Manual Transfer
                        </h4>
                        <p className="text-base text-muted-foreground mb-6 max-w-sm">
                          Prefer to use Wise, Revolut, or a local bank? Message
                          us directly on WhatsApp.
                        </p>
                        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-xl">
                          Coins will be credited manually once the transfer
                          clears.
                        </div>
                      </div>
                      <Button
                        className="w-full h-12 font-bold text-lg bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-xl shadow-[#25D366]/20 transition-transform active:scale-[0.98]"
                        onClick={handleBankTransfer}
                      >
                        <MessageCircle
                          size={20}
                          className="mr-2 fill-current"
                        />{" "}
                        Buy via WhatsApp
                      </Button>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================== */
          /* DEFAULT PACK SELECTION VIEW                  */
          /* ========================================== */
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v);
              if (tourStep === 3 && v === "redeem") {
                window.dispatchEvent(new CustomEvent("TOUR_STEP_CHANGED", { detail: 4 }));
              }
            }}
            className="w-full h-full flex flex-col bg-zinc-50 dark:bg-zinc-950"
          >
            <div className={cn("p-4 md:p-8 shrink-0 bg-background border-b border-border/50 shadow-sm transition-all", tourStep === 3 ? "relative z-[60]" : "z-20")}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className={cn("space-y-1 transition-opacity duration-300", tourStep === 3 && "opacity-20 pointer-events-none")}>
                  <DialogTitle className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                    <Coins className="text-amber-500 fill-amber-500 w-8 h-8" />{" "}
                    Coin Shop
                  </DialogTitle>
                  <DialogDescription className="text-base">
                    Top up your balance to purchase Pro upgrades and slots.
                  </DialogDescription>
                </div>
                <TabsList className={cn("bg-muted/50 p-1 w-full md:w-fit grid grid-cols-2 md:flex rounded-xl border border-border/50 transition-all", tourStep === 3 && "ring-4 ring-primary bg-background shadow-2xl scale-105 pointer-events-auto")}>
                  <TabsTrigger value="packs" className="rounded-lg font-bold">
                    Packs
                  </TabsTrigger>
                  <TabsTrigger value="redeem" className={cn("rounded-lg font-bold transition-all", tourStep === 3 && "ring-4 ring-primary animate-pulse z-10")}>
                    Redeem Code
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent
              value="packs"
              className="mt-0 flex-grow overflow-y-auto px-4 py-6 md:p-8 custom-scrollbar"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-12 sm:pb-0 max-w-6xl mx-auto">
                {COIN_PACKS.map((pack) => {
                  const style = getPackStyling(pack.rarity);
                  return (
                    <div
                      key={pack.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Buy ${pack.name} for $${pack.cost.toFixed(2)}`}
                      className={cn(
                        "relative rounded-3xl border dark:border-white/10 overflow-hidden transition-all duration-300 active:scale-[0.98] sm:hover:scale-[1.02] flex flex-col shadow-xl cursor-pointer group hover:shadow-2xl hover:shadow-indigo-500/10",
                        style.bg
                      )}
                      onClick={() => handleSelectPack(pack)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleSelectPack(pack);
                        }
                      }}
                    >
                      <div className="p-4 flex justify-between relative z-10 pointer-events-none">
                        <div className="flex gap-1">
                          {[...Array(pack.rarity)].map((_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className={cn("fill-current", style.star)}
                            />
                          ))}
                        </div>
                        {pack.bonus && (
                          <Badge className="bg-white text-black text-[10px] font-black uppercase tracking-wider h-6 px-2 shadow-sm border-none">
                            BONUS
                          </Badge>
                        )}
                      </div>
                      <div className="flex-grow flex flex-col items-center justify-center py-4 relative pointer-events-none">
                        <div
                          className={cn(
                            "absolute inset-0 blur-3xl rounded-full opacity-40 transition-opacity duration-500 group-hover:opacity-80",
                            style.glow
                          )}
                        />
                        <Coins
                          size={56}
                          className={cn(
                            "relative z-10 drop-shadow-2xl transform transition-transform duration-500 group-hover:scale-110 mb-2",
                            style.text
                          )}
                        />
                        <h3
                          className={cn(
                            "font-black text-3xl tracking-tight relative z-10",
                            style.text
                          )}
                        >
                          {pack.coins.toLocaleString()}
                        </h3>
                      </div>
                      <div className="p-4 bg-black/30 backdrop-blur-xl border-t border-white/5 relative z-10">
                        <Button className="w-full bg-white/10 hover:bg-white/20 text-white font-bold h-11 border border-white/10 transition-colors pointer-events-none">
                          ${pack.cost.toFixed(2)}
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* --- CUSTOM COIN GENERATOR --- */}
                <div className="col-span-1 sm:col-span-2 lg:col-span-3 mt-4 border-2 border-dashed border-border/50 rounded-3xl p-6 bg-card dark:bg-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm hover:border-primary/30 transition-colors">
                  <div className="space-y-2 text-center sm:text-left flex-1">
                    <h4 className="font-black text-xl flex items-center justify-center sm:justify-start gap-2 text-foreground">
                      <Coins className="text-primary fill-primary/20" /> Need a
                      specific amount?
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Type exactly how many coins you need. ($0.02 per coin)
                    </p>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative">
                      <Input
                        id="custom-coins"
                        aria-label="Custom coin amount"
                        type="number"
                        placeholder="e.g. 750"
                        min="50"
                        step="50"
                        value={customCoins}
                        onChange={(e) => setCustomCoins(e.target.value)}
                        className="h-12 w-full sm:w-32 text-lg font-black text-center pr-12 bg-background border-2"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">
                        UCP
                      </span>
                    </div>
                    <Button
                      className="h-12 px-6 font-bold text-base shadow-lg"
                      disabled={!customCoins || parseInt(customCoins) < 50}
                      onClick={handleCustomPackSubmit}
                    >
                      Buy for $
                      {customCoins && parseInt(customCoins) >= 50
                        ? (parseInt(customCoins) * COIN_PRICE_USD).toFixed(2)
                        : "0.00"}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="redeem"
              className="mt-0 flex-grow overflow-y-auto px-4 pb-8"
            >
              <div className={cn("bg-card dark:bg-zinc-900 border border-border/50 p-8 rounded-3xl shadow-sm flex flex-col gap-6 mt-8 max-w-lg mx-auto text-center transition-all duration-300", (tourStep === 4 && activeTab === "redeem") && "relative z-[60] bg-background shadow-2xl ring-4 ring-primary/50 pointer-events-auto")}>
                <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2">
                  <Star size={32} className="fill-primary/20" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-black text-2xl text-foreground">
                    Redeem Gift Code
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Enter your promotional code to instantly add free coins to
                    your wallet.
                  </p>
                </div>
                <Input
                  id="redeem-code"
                  aria-label="Gift code"
                  className={cn("text-center font-mono uppercase text-2xl h-14 font-bold tracking-widest bg-background border-2 transition-all", tourStep === 4 && "ring-4 ring-primary")}
                  placeholder="XXXX-XXXX"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value)}
                />
                <Button
                  onClick={handleRedeemCode}
                  disabled={isRedeeming}
                  className={cn("w-full h-14 font-bold text-lg shadow-lg transition-all", tourStep === 4 && redeemCode.toUpperCase() === "BISSMILAH" && "ring-4 ring-primary animate-pulse")}
                >
                  {isRedeeming ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    "Apply to Balance"
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {!selectedPack && tourStep === 3 && (
          <div className="absolute top-20 right-4 sm:right-8 bg-card border-2 border-primary rounded-2xl p-4 max-w-[280px] shadow-2xl z-[100] animate-in slide-in-from-right pointer-events-auto">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <Gift size={20} />
              <h3 className="text-lg font-bold">Redeem Tab</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Click on the <strong>Redeem Code</strong> tab to enter your special welcome code.
            </p>
          </div>
        )}

        {!selectedPack && tourStep === 4 && activeTab === "redeem" && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-card border-2 border-primary rounded-2xl p-4 w-[90%] max-w-[320px] shadow-2xl z-[100] animate-in slide-in-from-bottom pointer-events-auto">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <Star size={20} />
              <h3 className="text-lg font-bold">Enter Code</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Type <strong>BISSMILAH</strong> in the box and hit Apply to get 2,700 coins instantly!
            </p>
          </div>
        )}

        {!selectedPack && (
          <div className="sm:hidden p-4 bg-background border-t border-border/50 shrink-0">
            <Button
              variant="outline"
              className="w-full h-12 font-bold"
              onClick={() => handleOpenChange(false)}
            >
              Close Shop
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
