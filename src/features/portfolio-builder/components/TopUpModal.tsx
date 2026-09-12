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
  ArrowRight,
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
import { CREDIT_PACKS, CREDIT_UNIT_USD, MIN_CUSTOM_CREDIT_AMOUNT } from "@/config/plans";

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
        `Added ${pack.credits} credits to your wallet.`
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
        Securely Pay ${pack.costUsd.toFixed(2)}
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

  // Custom credit amount state
  const [customCredits, setCustomCredits] = useState<string>("");

  // Embedded Checkout State
  const [selectedPack, setSelectedPack] = useState<
    (typeof CREDIT_PACKS)[0] | null
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

  const handleSelectPack = async (pack: (typeof CREDIT_PACKS)[0]) => {
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
            amount: pack.costUsd,
            currency: "usd",
            metadata: {
              type: "top_up",
              actor_id: actorData.id,
              coins_amount: pack.credits,
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
    const credits = parseInt(customCredits);
    if (isNaN(credits) || credits < MIN_CUSTOM_CREDIT_AMOUNT) {
      notify("error", "Invalid Amount", `Minimum purchase is ${MIN_CUSTOM_CREDIT_AMOUNT} credits.`);
      return;
    }
    const customPack = {
      id: "custom",
      name: "Custom amount",
      credits: credits,
      costUsd: credits * CREDIT_UNIT_USD,
      bonus: "",
    };
    handleSelectPack(customPack);
  };

  const handleBankTransfer = () => {
    if (!actorData?.ActorName || !selectedPack) return;
    const userEmail = profile?.email || actorData.email || "No Email";
    const message = `Hello, I would like to purchase the "${
      selectedPack.name
    }" (${selectedPack.credits} credits) for $${selectedPack.costUsd.toFixed(
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
            amount: selectedPack.costUsd,
            coins_amount: selectedPack.credits,
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
      notify("success", "Credits added!", "Gift code redeemed.");
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

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full h-[100dvh] sm:h-[85vh] sm:max-w-[1000px] p-0 gap-0 bg-background border-none shadow-2xl sm:rounded-2xl flex flex-col overflow-hidden">
        {(tourStep === 3 || tourStep === 4) && (
          <div className="absolute inset-0 z-[50] bg-slate-950/80 backdrop-blur-sm pointer-events-none transition-all animate-in fade-in" />
        )}

        {tourStep === 5 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-background animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-3xl font-black mb-3 text-foreground">2,700 credits added</h2>
            <p className="text-base text-muted-foreground mb-8 max-w-md">
              Your welcome gift has been credited to your balance. Use these credits to unlock Pro features once your trial ends, or purchase new themes from the marketplace.
            </p>
            <Button 
              size="lg" 
              className="w-full max-w-xs font-bold text-base h-12"
              onClick={() => {
                 window.dispatchEvent(new CustomEvent('TOUR_STEP_CHANGED', { detail: 0 }));
                 handleOpenChange(false);
              }}
            >
              Continue
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
                aria-label="Back to credit packs"
                className="h-8 w-8 rounded-full bg-muted/50 hover:bg-muted transition-transform active:scale-90"
              >
                <ArrowLeft size={16} />
              </Button>
              <div className="font-bold text-lg">Complete Your Purchase</div>
            </div>

            {/* Split Layout */}
            <div className="flex flex-col lg:flex-row flex-grow overflow-y-auto overflow-x-hidden">
              {/* LEFT COLUMN: Order Summary */}
              <div className="w-full lg:w-[40%] p-6 lg:p-8 bg-muted/20 border-r border-border/50 flex flex-col shrink-0">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Coins size={26} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground leading-tight">
                      {selectedPack.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedPack.credits.toLocaleString()} credits
                    </p>
                  </div>
                </div>

                {selectedPack.bonus && (
                  <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-emerald-700 dark:text-emerald-400 w-fit">
                    <Gift size={16} />
                    <span className="text-sm font-semibold">Includes {selectedPack.bonus}</span>
                  </div>
                )}

                <div className="rounded-xl border border-border/60 bg-background p-4 space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Credits</span>
                    <span className="font-semibold text-foreground">{selectedPack.credits.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-border/60 pt-3 flex justify-between">
                    <span className="font-bold text-foreground">Total due</span>
                    <span className="text-xl font-black text-foreground">${selectedPack.costUsd.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-3 mt-auto">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Zap size={16} className="text-primary shrink-0" />
                    Instant delivery upon payment
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 size={16} className="text-primary shrink-0" />
                    Credits never expire
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <ShieldCheck size={16} className="text-primary shrink-0" />
                    Secured checkout
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: The Payment Gateway */}
              <div className="w-full lg:w-[60%] p-6 lg:p-8 bg-background flex flex-col">
                <div className="mb-6">
                  <h3 className="font-bold text-xl text-foreground">
                    Payment method
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Choose how you'd like to pay ${selectedPack.costUsd.toFixed(2)}.</p>
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
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
                          <div className="p-8 border border-border/60 bg-muted/20 rounded-2xl flex flex-col items-center text-center mb-6">
                            <div className="h-16 w-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                              <QrCode size={32} />
                          </div>
                            <h4 className="font-bold text-xl mb-2 text-foreground">
                              Pay with crypto
                            </h4>
                            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                              We accept USDC, USDT, BTC, and Solana. Instant
                              settlement, no borders.
                            </p>
                          </div>
                          <Button
                            className="w-full h-12 font-bold text-base shadow-sm transition-transform active:scale-[0.98] mt-auto"
                            onClick={handleGenerateCryptoInvoice}
                            disabled={isGeneratingCrypto}
                          >
                            {isGeneratingCrypto ? (
                              <Loader2 className="animate-spin mr-2" />
                            ) : (
                              <Bitcoin className="mr-2" size={18} />
                            )}
                            Generate crypto checkout
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
                      <div className="p-8 border border-border/60 bg-muted/20 rounded-2xl flex flex-col items-center text-center mb-6">
                        <div className="h-16 w-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                          <Landmark size={32} />
                        </div>
                        <h4 className="font-bold text-xl mb-2 text-foreground">
                          Manual transfer
                        </h4>
                        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                          Prefer to use Wise, Revolut, or a local bank? Message
                          us directly on WhatsApp.
                        </p>
                        <div className="text-xs font-semibold text-muted-foreground bg-background border border-border/60 px-3 py-2 rounded-lg">
                          Credits will be credited manually once the transfer
                          clears.
                        </div>
                      </div>
                      <Button
                        className="w-full h-12 font-bold text-base bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-sm transition-transform active:scale-[0.98]"
                        onClick={handleBankTransfer}
                      >
                        <MessageCircle
                          size={18}
                          className="mr-2 fill-current"
                        />{" "}
                        Continue on WhatsApp
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
            className="w-full h-full flex flex-col bg-background"
          >
            <div className={cn("p-4 md:p-8 shrink-0 bg-background border-b border-border/50 shadow-sm transition-all", tourStep === 3 ? "relative z-[60]" : "z-20")}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className={cn("space-y-1 transition-opacity duration-300", tourStep === 3 && "opacity-20 pointer-events-none")}>
                  <DialogTitle className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                    <Coins className="text-primary w-7 h-7" />{" "}
                    Add credits
                  </DialogTitle>
                  <DialogDescription className="text-base">
                    Top up your Platform Credits to purchase Pro upgrades and slots.
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
                {CREDIT_PACKS.map((pack) => {
                  return (
                    <div
                      key={pack.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Buy ${pack.name} for $${pack.costUsd.toFixed(2)}`}
                      className={cn(
                        "group relative flex flex-col rounded-2xl border-2 bg-card p-6 text-left transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        pack.popular ? "border-primary shadow-sm" : "border-border/60 hover:border-primary/40"
                      )}
                      onClick={() => handleSelectPack(pack)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleSelectPack(pack);
                        }
                      }}
                    >
                      {pack.popular && (
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground shadow-sm">
                          Most popular
                        </Badge>
                      )}
                      <div className="flex items-start justify-between mb-5">
                        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                          <Coins size={20} />
                        </div>
                        {pack.bonus && (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold">
                            {pack.bonus}
                          </Badge>
                        )}
                      </div>
                      <div className="text-2xl font-black text-foreground tracking-tight">
                        {pack.credits.toLocaleString()} <span className="text-sm font-semibold text-muted-foreground">credits</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{pack.name}</p>

                      <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between">
                        <span className="text-xl font-bold text-foreground">${pack.costUsd.toFixed(2)}</span>
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                          Select <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* --- CUSTOM CREDIT AMOUNT --- */}
                <div className="col-span-1 sm:col-span-2 lg:col-span-3 mt-4 border border-border/60 rounded-2xl p-6 bg-card flex flex-col sm:flex-row items-center justify-between gap-6 hover:border-primary/30 transition-colors">
                  <div className="space-y-1 text-center sm:text-left flex-1">
                    <h4 className="font-bold text-lg flex items-center justify-center sm:justify-start gap-2 text-foreground">
                      <Coins size={18} className="text-primary" /> Need a
                      specific amount?
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Enter exactly how many credits you need (${CREDIT_UNIT_USD.toFixed(2)} per credit).
                    </p>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative">
                      <Input
                        id="custom-credits"
                        aria-label="Custom credit amount"
                        type="number"
                        placeholder="e.g. 750"
                        min={MIN_CUSTOM_CREDIT_AMOUNT}
                        step="50"
                        value={customCredits}
                        onChange={(e) => setCustomCredits(e.target.value)}
                        className="h-11 w-full sm:w-32 text-base font-bold text-center pr-12 bg-background"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-xs">
                        credits
                      </span>
                    </div>
                    <Button
                      className="h-11 px-6 font-bold"
                      disabled={!customCredits || parseInt(customCredits) < MIN_CUSTOM_CREDIT_AMOUNT}
                      onClick={handleCustomPackSubmit}
                    >
                      Buy for $
                      {customCredits && parseInt(customCredits) >= MIN_CUSTOM_CREDIT_AMOUNT
                        ? (parseInt(customCredits) * CREDIT_UNIT_USD).toFixed(2)
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
              <div className={cn("bg-card border border-border/60 p-8 rounded-2xl flex flex-col gap-6 mt-8 max-w-lg mx-auto text-center transition-all duration-300", (tourStep === 4 && activeTab === "redeem") && "relative z-[60] bg-background shadow-2xl ring-4 ring-primary/50 pointer-events-auto")}>
                <div className="h-14 w-14 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto">
                  <Gift size={26} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-xl text-foreground">
                    Redeem a gift code
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Enter your promotional code to instantly add free credits to
                    your wallet.
                  </p>
                </div>
                <Input
                  id="redeem-code"
                  aria-label="Gift code"
                  className={cn("text-center font-mono uppercase text-xl h-12 font-bold tracking-widest bg-background", tourStep === 4 && "ring-4 ring-primary")}
                  placeholder="XXXX-XXXX"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value)}
                />
                <Button
                  onClick={handleRedeemCode}
                  disabled={isRedeeming}
                  className={cn("w-full h-12 font-bold text-base transition-all", tourStep === 4 && redeemCode.toUpperCase() === "BISSMILAH" && "ring-4 ring-primary animate-pulse")}
                >
                  {isRedeeming ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Apply to balance"
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
              Type <strong>BISSMILAH</strong> in the box and hit Apply to get 2,700 credits instantly!
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
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
