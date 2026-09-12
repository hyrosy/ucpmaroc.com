import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/supabaseClient";
import {
  useOutletContext,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Globe,
  User,
  Plus,
  ExternalLink,
  Check,
  CreditCard,
  ArrowUpRight,
  Coins,
  AlertTriangle,
  Trash2,
  Box,
  X,
  Clock,
  Sparkles,
  MoreVertical,
  Pencil,
  Receipt,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  NotificationContainer,
  Notification,
} from "@/components/ui/NotificationToast";
import { useSubscription } from "@/context/SubscriptionContext";
import { TopUpModal } from "@/features/portfolio-builder";
import { CreateSiteModal } from "@/features/ecommerce/components/CreateSiteModal";
type PlanDuration = 1 | 3 | 6 | 12;

const SLOT_COST = 500;

const PLANS = [
  {
    id: "starter",
    tier: 1,
    name: "Starter",
    description: "Perfect for personal portfolios.",
    features: ["100MB Storage", "Standard Support", "UCP Branding"],
    pricing: {
      1: {
        stripePriceId: "price_starter_1m",
        stripeCost: 3.0,
        coinCost: 150,
        label: null,
      },
      3: {
        stripePriceId: "price_starter_3m",
        stripeCost: 8.55,
        coinCost: 425,
        label: "5% OFF",
      },
      6: {
        stripePriceId: "price_starter_6m",
        stripeCost: 16.2,
        coinCost: 800,
        label: "10% OFF",
      },
      12: {
        stripePriceId: "price_STARTER_YEARLY",
        stripeCost: 30.0,
        coinCost: 1500,
        label: "17% OFF",
      },
    },
  },
  {
    id: "ecommerce",
    tier: 2,
    name: "eCommerce",
    popular: true,
    description: "For selling digital products.",
    features: [
      "500MB Storage",
      "Custom Domain",
      "Online Shop",
      "Leads Dashboard",
    ],
    pricing: {
      1: {
        stripePriceId: "price_ECOMMERCE_1M",
        stripeCost: 9.0,
        coinCost: 450,
        label: null,
      },
      3: {
        stripePriceId: "price_ECOMMERCE_3M",
        stripeCost: 25.0,
        coinCost: 1250,
        label: "5% OFF",
      },
      6: {
        stripePriceId: "price_ECOMMERCE_6M",
        stripeCost: 48.0,
        coinCost: 2400,
        label: "11% OFF",
      },
      12: {
        stripePriceId: "price_ECOMMERCE_1Y",
        stripeCost: 90.0,
        coinCost: 4500,
        label: "17% OFF",
      },
    },
  },
  {
    id: "pro",
    tier: 3,
    name: "Pro",
    description: "Ultimate power and storage.",
    features: [
      "2GB Storage",
      "Priority Support",
      "Bookings / Appointments",
      "White Label",
    ],
    pricing: {
      1: {
        stripePriceId: "price_PRO_1M",
        stripeCost: 19.0,
        coinCost: 950,
        label: null,
      },
      3: {
        stripePriceId: "price_PRO_3M",
        stripeCost: 54.0,
        coinCost: 2700,
        label: "5% OFF",
      },
      6: {
        stripePriceId: "price_PRO_6M",
        stripeCost: 102.0,
        coinCost: 5100,
        label: "10% OFF",
      },
      12: {
        stripePriceId: "price_PRO_1Y",
        stripeCost: 190.0,
        coinCost: 9500,
        label: "25% OFF",
      },
    },
  },
];


const SettingsPage = () => {
  const { actorData } = useOutletContext<ActorDashboardContextType>();
  const walletBalance = actorData.wallet_balance || 0;

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeTab = searchParams.get("tab") || "websites";

  const {
    plan: currentPlanId,
    siteSlots,
    refreshSubscription,
    isLoading: isSubLoading,
  } = useSubscription();

  const [loading, setLoading] = useState(true);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>({});
  const [subscriptions, setSubscriptions] = useState<Record<string, any>>({});
  const [transactions, setTransactions] = useState<any[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(
    null
  );

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [billingDuration, setBillingDuration] = useState<PlanDuration>(1);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const [hasShownExpiredPrompt, setHasShownExpiredPrompt] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    action: () => void;
    confirmText?: string;
    isDestructive?: boolean;
  } | null>(null);

  const notify = (
    type: "success" | "error" | "info",
    title: string,
    message?: string
  ) => {
    const id = Math.random().toString(36).substring(7);
    setNotifications((prev) => [...prev, { id, type, title, message }]);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const openConfirmation = (
    title: string,
    message: React.ReactNode,
    action: () => void,
    confirmText = "Confirm",
    isDestructive = false
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      action,
      confirmText,
      isDestructive,
    });
  };

  const fetchData = async () => {
    if (!actorData?.id) return;
    setLoading(true);

    const { data: sites } = await supabase
      .from("portfolios")
      .select("*")
      .eq("actor_id", actorData.id)
      .order("created_at", { ascending: false });
    if (sites) setPortfolios(sites);

    const { data: actor } = await supabase
      .from("actors")
      .select("*")
      .eq("id", actorData.id)
      .single();
    if (actor) setProfile(actor);

    const { data: subs } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("actor_id", actorData.id);
    if (subs) {
      const subMap: Record<string, any> = {};
      // Prioritize active subscriptions so an old expired sub doesn't overwrite an active one
      subs.forEach((s) => {
        if (s.status === "active" && new Date(s.current_period_end) > new Date()) {
          subMap[s.portfolio_id] = s;
        } else if (!subMap[s.portfolio_id]) {
          subMap[s.portfolio_id] = s;
        }
      });
      setSubscriptions(subMap);
    }

    // 🚀 NEW: Auto-unpublish expired trials AND expired plans
    if (sites && subs) {
      let needsRefetch = false;
      let promptSiteId = null;

      const updatedSites = sites.map((site) => {
        const sub = subs.find((s: any) => s.portfolio_id === site.id && s.status === "active" && new Date(s.current_period_end) > new Date());
        const isPro = !!sub;
        const isTrialEnded = !isPro && new Date().getTime() > new Date(site.created_at).getTime() + 14 * 24 * 60 * 60 * 1000;
        
        if (isTrialEnded) {
          if (!promptSiteId) promptSiteId = site.id;
          if (site.is_published) {
            supabase.from("portfolios").update({ is_published: false }).eq("id", site.id).then();
            needsRefetch = true;
            return { ...site, is_published: false };
          }
        }
        return site;
      });
      if (needsRefetch) setPortfolios(updatedSites);

      if (promptSiteId && !hasShownExpiredPrompt) {
        setSelectedPortfolioId(promptSiteId);
        setIsUpgradeOpen(true);
        setHasShownExpiredPrompt(true);
      }
    }

    const { data: txs } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("actor_id", actorData.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (txs) setTransactions(txs);

    setLoading(false);
  };

  const prevBalanceRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      actorData.wallet_balance !== undefined &&
      prevBalanceRef.current !== undefined
    ) {
      if (actorData.wallet_balance > prevBalanceRef.current) {
        setIsTopUpOpen(false);
        notify(
          "success",
          "Top-Up Successful! 🎉",
          `Your balance is now ${actorData.wallet_balance.toLocaleString()} Coins.`
        );
        fetchData();
      }
    }
    prevBalanceRef.current = actorData.wallet_balance;
  }, [actorData.wallet_balance]);

  useEffect(() => {
    fetchData();
  }, [actorData.id]);

  useEffect(() => {
    if (searchParams.get("upgrade") === "true") {
      const pid = searchParams.get("portfolioId");
      if (pid) {
        setSelectedPortfolioId(pid);
      }
      setIsUpgradeOpen(true);
      
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete("upgrade");
      newSearchParams.delete("portfolioId");
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const calculateProration = (targetPlanId: string) => {
    const targetPlan = PLANS.find((p) => p.id === targetPlanId);
    if (!targetPlan)
      return { cost: 0, originalPrice: 0, isUpgrade: true, isDowngrade: false, unusedValue: 0, activeDuration: 0 };

    if (!selectedPortfolioId || !subscriptions[selectedPortfolioId]) {
      return {
        cost: targetPlan.pricing[billingDuration].coinCost,
        originalPrice: targetPlan.pricing[billingDuration].coinCost,
        isUpgrade: true,
        isDowngrade: false,
        unusedValue: 0,
        activeDuration: 0,
      };
    }

    const currentSub = subscriptions[selectedPortfolioId];
    if (currentSub.payment_method === "stripe")
      return {
        cost: 0,
        originalPrice: 0,
        isUpgrade: true,
        isDowngrade: false,
        unusedValue: 0,
        isStripe: true,
        activeDuration: 0,
      };

    const currentPlan = PLANS.find((p) => p.id === currentSub.plan_id);
    if (!currentPlan)
      return {
        cost: targetPlan.pricing[billingDuration].coinCost,
        originalPrice: targetPlan.pricing[billingDuration].coinCost,
        isUpgrade: true,
        isDowngrade: false,
        unusedValue: 0,
        activeDuration: 0,
      };

    const start = new Date(currentSub.current_period_start).getTime();
    const end = new Date(currentSub.current_period_end).getTime();
    const now = new Date().getTime();
    const daysDuration = Math.round((end - start) / (1000 * 60 * 60 * 24));

    let activeDuration: PlanDuration = 1;
    if (daysDuration > 300) activeDuration = 12;
    else if (daysDuration > 150) activeDuration = 6;
    else if (daysDuration > 75) activeDuration = 3;

    const isHigherTier = targetPlan.tier > currentPlan.tier;
    const isSameTier = targetPlan.tier === currentPlan.tier;
    const isLongerDuration = billingDuration > activeDuration;

    const isUpgrade = isHigherTier || (isSameTier && isLongerDuration);
    const isDowngrade =
      !isUpgrade && !(isSameTier && billingDuration === activeDuration);

    if (now > end)
      return {
        cost: targetPlan.pricing[billingDuration].coinCost,
        isUpgrade: true,
        unusedValue: 0,
        activeDuration,
      };

    const totalDurationMs = end - start;
    const remainingDurationMs = end - now;
    const percentageRemaining = Math.max(
      0,
      remainingDurationMs / totalDurationMs
    );

    const originalPaidCost = currentPlan.pricing[activeDuration]?.coinCost || 0;
    const unusedValue = Math.floor(originalPaidCost * percentageRemaining);
    let finalCost = targetPlan.pricing[billingDuration].coinCost;

    if (isUpgrade) finalCost = Math.max(0, finalCost - unusedValue);

    return {
      cost: finalCost,
      originalPrice: targetPlan.pricing[billingDuration].coinCost,
      unusedValue,
      isUpgrade,
      isDowngrade,
      activeDuration,
    };
  };

  const handleBuySlot = () => {
    if (walletBalance < SLOT_COST) {
      openConfirmation(
        "Insufficient Balance",
        <p>
          You need <strong>{SLOT_COST} Coins</strong> to buy a slot. You have{" "}
          {walletBalance}.
        </p>,
        () => {
          setConfirmDialog(null);
          setIsTopUpOpen(true);
        },
        "Top Up Now"
      );
      return;
    }
    openConfirmation(
      "Buy Portfolio Slot",
      <div className="space-y-2">
        <p>
          Purchase <strong>1 Additional Website Slot</strong> for{" "}
          <strong>{SLOT_COST} Coins</strong>?
        </p>
        <p className="text-xs text-muted-foreground">
          This is a one-time purchase. You will own this slot forever.
        </p>
      </div>,
      async () => {
        setConfirmDialog(null);
        const { data, error } = await supabase.rpc("buy_portfolio_slot", {
          p_actor_id: actorData.id,
          p_cost: SLOT_COST,
        });
        if (error || (data && !data.success))
          notify("error", "Purchase Failed", data?.message || error?.message);
        else {
          notify(
            "success",
            "Slot Purchased",
            "You can now create another website."
          );
          await refreshSubscription();
          await fetchData();
        }
      },
      "Pay 500 Coins"
    );
  };

  // 🚀 NEW: Function to Cancel a Scheduled Downgrade
  const handleCancelDowngrade = async () => {
    if (!selectedPortfolioId || !actorData?.id) return;
    openConfirmation(
      "Cancel Downgrade",
      <p>
        Are you sure you want to cancel the scheduled downgrade and keep your
        current active plan?
      </p>,
      async () => {
        setConfirmDialog(null);
        setProcessingPlan("canceling");
        const sub = subscriptions[selectedPortfolioId];
        const { error } = await supabase
          .from("subscriptions")
          .update({
            cancel_at_period_end: false,
            metadata: { ...sub?.metadata, next_plan_id: null },
          })
          .eq("portfolio_id", selectedPortfolioId);

        if (error) notify("error", "Action Failed", error.message);
        else {
          notify(
            "success",
            "Downgrade Cancelled",
            "Your current plan will automatically renew at the end of the cycle."
          );
          fetchData();
          refreshSubscription();
        }
        setProcessingPlan(null);
      },
      "Cancel Downgrade"
    );
  };

  const handleBuyWithWallet = async (plan: (typeof PLANS)[0]) => {
    if (!selectedPortfolioId || !actorData?.id) return;
    const calc = calculateProration(plan.id);

    if (calc.isDowngrade) {
      const sub = subscriptions[selectedPortfolioId];
      const endDate = sub
        ? new Date(sub.current_period_end).toLocaleDateString()
        : "cycle end";
      openConfirmation(
        `Downgrade to ${plan.name}`,
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Changes will take effect at the end of your current billing cycle (
            <strong>{endDate}</strong>).
          </p>
          <p>
            You will retain your current features until then. No coins will be
            charged today.
          </p>
        </div>,
        async () => {
          setProcessingPlan(plan.id);
          const { error } = await supabase
            .from("subscriptions")
            .update({
              cancel_at_period_end: true,
              metadata: { ...sub?.metadata, next_plan_id: plan.id },
            })
            .eq("portfolio_id", selectedPortfolioId);
          if (error) notify("error", "Downgrade Failed", error.message);
          else {
            notify(
              "success",
              "Downgrade Scheduled",
              `Your plan will switch to ${plan.name} after ${endDate}`
            );
            fetchData();
            refreshSubscription();
            setIsUpgradeOpen(false);
          }
          setProcessingPlan(null);
          setConfirmDialog(null);
        },
        "Schedule Downgrade"
      );
      return;
    }

    const costToPay = calc.cost || 0;
    if (walletBalance < costToPay) {
      openConfirmation(
        "Insufficient Balance",
        <p className="text-sm text-muted-foreground">
          You need <strong>{costToPay} Coins</strong> but have{" "}
          <strong>{walletBalance}</strong>.
        </p>,
        () => {
          setIsUpgradeOpen(false);
          setIsTopUpOpen(true);
          setConfirmDialog(null);
        },
        "Go to Shop"
      );
      return;
    }

    const isFirstTime = !subscriptions[selectedPortfolioId];

    let message = (
      <p className="text-sm text-muted-foreground">
        Spend <strong>{costToPay} Coins</strong> for{" "}
        <strong>{billingDuration} month(s)</strong> access?
      </p>
    );
    if (calc.unusedValue > 0) {
      message = (
        <div className="text-sm space-y-2 bg-muted/50 p-3 rounded-md">
          <div className="flex justify-between">
            <span>New Plan Cost ({billingDuration}m):</span>
            <span>{calc.originalPrice}</span>
          </div>
          <div className="flex justify-between text-green-600">
            <span>Unused Credit:</span>
            <span>-{calc.unusedValue}</span>
          </div>
          <div className="border-t pt-2 mt-2 flex justify-between font-bold">
            <span>Pay Now:</span>
            <span>{costToPay} Coins</span>
          </div>
        </div>
      );
    } else if (isFirstTime) {
      message = (
        <div className="text-sm space-y-3 bg-primary/5 p-4 rounded-xl border border-primary/20">
          <p className="text-foreground font-medium flex items-center gap-2">
            <Sparkles className="text-primary h-5 w-5" /> You're about to supercharge your portfolio!
          </p>
          <p className="text-muted-foreground">
            Activate the <strong>{plan.name}</strong> plan for <strong>{billingDuration} month(s)</strong> to unlock premium features and grow your digital presence.
          </p>
          <div className="border-t border-primary/10 pt-3 flex justify-between font-black text-lg text-primary">
            <span>Total Cost:</span>
            <span className="flex items-center gap-1.5"><Coins size={18} className="fill-primary" /> {costToPay} Coins</span>
          </div>
        </div>
      );
    }

    openConfirmation(
      `Confirm ${calc.isUpgrade ? "Upgrade" : "Purchase"}`,
      message,
      async () => {
        setConfirmDialog(null);
        setProcessingPlan(plan.id);
        const { data, error } = await supabase.rpc(
          "purchase_subscription_with_wallet",
          {
            p_actor_id: actorData.id,
            p_portfolio_id: selectedPortfolioId,
            p_plan_id: plan.id,
            p_amount: costToPay,
            p_duration_months: billingDuration,
          }
        );
        if (error || (data && !data.success))
          notify(
            "error",
            "Transaction Failed",
            data?.message || error?.message || "Unknown error"
          );
        else {
          notify(
            "success",
            "Plan Activated!",
            `You have successfully subscribed to ${plan.name}.`
          );
          fetchData();
          refreshSubscription();
          setIsUpgradeOpen(false);
        }
        setProcessingPlan(null);
      },
      "Confirm Payment"
    );
  };

  const handleSiteCreated = async (portfolioId: string) => {
    setIsCreateOpen(false);
    notify("success", "Website Created", "Your new site is ready.");
    fetchData();
    refreshSubscription();
  };

  const handleDeleteSite = async () => {
    if (!selectedPortfolioId) return;
    const site = portfolios.find((p) => p.id === selectedPortfolioId);
    if (deleteConfirmationName !== site?.site_name)
      return notify(
        "error",
        "Name Mismatch",
        "Website name does not match. Please type it exactly."
      );

    setIsDeleting(true);
    const { error } = await supabase
      .from("portfolios")
      .delete()
      .eq("id", selectedPortfolioId);
    if (error) notify("error", "Deletion Failed", error.message);
    else {
      notify(
        "success",
        "Website Deleted",
        "The website and its data have been removed."
      );
      setIsDeleteOpen(false);
      setDeleteConfirmationName("");
      fetchData();
      refreshSubscription();
    }
    setIsDeleting(false);
  };


  const handleDirectStripe = async (plan: (typeof PLANS)[0]) => {
    if (!actorData?.id || !selectedPortfolioId) return;
    const details = plan.pricing[billingDuration as PlanDuration];
    if (!details.stripePriceId)
      return notify(
        "error",
        "Unavailable",
        "This plan duration is not available via card yet."
      );

    setIsRedirecting(true);
    const { data, error } = await supabase.functions.invoke(
      "create-checkout-session",
      {
        body: {
          mode: "subscription",
          priceId: details.stripePriceId,
          metadata: {
            type: "subscription",
            actor_id: actorData.id,
            portfolio_id: selectedPortfolioId,
            plan_id: plan.id,
            interval: billingDuration === 12 ? "yearly" : "monthly",
            duration_months: billingDuration,
          },
          successUrl:
            window.location.origin + "/dashboard/settings?success=true",
          cancelUrl:
            window.location.origin + "/dashboard/settings?canceled=true",
        },
      }
    );
    if (error || !data?.url) {
      notify("error", "Checkout Error", "Could not start payment session.");
      setIsRedirecting(false);
    } else window.location.href = data.url;
  };

  const handleManageStripeSub = async () => {
    if (!actorData?.id) return;
    setIsRedirecting(true);
    const { data, error } = await supabase.functions.invoke(
      "create-portal-session",
      {
        body: {
          returnUrl: window.location.origin + "/dashboard/settings?tab=billing",
        },
      }
    );
    if (error || !data?.url) {
      notify("error", "Portal Error", "Could not load billing portal.");
      setIsRedirecting(false);
    } else window.location.href = data.url;
  };

  const openDeleteDialog = (portfolioId: string) => {
    setSelectedPortfolioId(portfolioId);
    setDeleteConfirmationName("");
    setIsDeleteOpen(true);
  };

  const isSelectedExpired = selectedPortfolioId ? (() => {
    const site = portfolios.find((p) => p.id === selectedPortfolioId);
    if (!site) return false;
    const sub = subscriptions[site.id];
    const isPro = sub && sub.status === "active" && new Date(sub.current_period_end) > new Date();
    return !isPro && new Date().getTime() > new Date(site.created_at).getTime() + 14 * 24 * 60 * 60 * 1000;
  })() : false;

  if (loading)
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  return (
    <div className="w-full max-w-8xl md:p-4">
      <NotificationContainer
        notifications={notifications}
        removeNotification={removeNotification}
      />
      <TopUpModal
        isOpen={isTopUpOpen}
        onOpenChange={setIsTopUpOpen}
        actorData={actorData}
        profile={profile}
        onSuccess={fetchData}
        notify={notify}
      />

      {/* --- HEADER SECTION --- */}
      <div className="px-4 py-6 md:py-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Settings
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Manage your sites, subscriptions, and billing.
            </p>
          </div>
          <Button onClick={() => (siteSlots.remaining > 0 ? setIsCreateOpen(true) : handleBuySlot())} className="font-semibold shrink-0">
            <Plus size={16} className="mr-1.5" /> New website
          </Button>
        </div>

        {/* --- STATS WIDGETS --- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4">
            <div>
              <span className="text-xs text-muted-foreground font-medium">Websites</span>
              <div className="text-xl font-bold text-foreground mt-0.5">{portfolios.length}</div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Globe size={18} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4">
            <div>
              <span className="text-xs text-muted-foreground font-medium">Site slots</span>
              <div className="text-xl font-bold text-foreground mt-0.5">
                {isSubLoading ? "..." : `${siteSlots.used}/${siteSlots.total}`}
              </div>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={handleBuySlot}>
              <Plus size={14} className="mr-1" /> Add
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4">
            <div>
              <span className="text-xs text-muted-foreground font-medium">Platform Credits</span>
              <div className={cn("text-xl font-bold mt-0.5", walletBalance < 0 ? "text-destructive" : "text-foreground")}>{walletBalance.toLocaleString()}</div>
            </div>
            <Button size="sm" onClick={() => setIsTopUpOpen(true)} className="shrink-0 font-semibold">
              <Plus size={14} className="mr-1" /> Top up
            </Button>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setSearchParams({ tab: val })}
        className="w-full"
      >
        {/* --- STICKY SUB NAVIGATION --- */}
        <div className="sticky top-[60px] md:top-14 z-40 bg-background/95 backdrop-blur-xl border-b border-border/60 px-4 md:px-8 transition-all">
          <TabsList className="h-auto bg-transparent p-0 gap-6 justify-start rounded-none">
            <TabsTrigger
              value="websites"
              className="h-11 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-semibold text-muted-foreground data-[state=active]:text-foreground"
            >
              <Globe size={16} className="mr-2" /> Sites
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="h-11 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-semibold text-muted-foreground data-[state=active]:text-foreground"
            >
              <Receipt size={16} className="mr-2" /> Billing
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="px-4 md:px-8 py-6">
          {/* --- TAB 1: WEBSITES --- */}
          <TabsContent
            value="websites"
            className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0"
          >
            {portfolios.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/60 bg-muted/10 py-20 text-center">
                <div className="h-14 w-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Globe size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">No websites yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">Create your first website to get started.</p>
                </div>
                <Button onClick={() => (siteSlots.remaining > 0 ? setIsCreateOpen(true) : handleBuySlot())} className="font-semibold">
                  <Plus size={16} className="mr-1.5" /> New website
                </Button>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {portfolios.map((site) => {
                const sub = subscriptions[site.id];
                const currentPlanObj =
                  PLANS.find((p) => p.id === sub?.plan_id) || PLANS[0];
                const isPro =
                  sub &&
                  sub.status === "active" &&
                  new Date(sub.current_period_end) > new Date();
                const isDowngradingSoon =
                  sub?.cancel_at_period_end === true &&
                  sub?.metadata?.next_plan_id;
                
                const isTrialEnded = !isPro && new Date().getTime() > new Date(site.created_at).getTime() + 14 * 24 * 60 * 60 * 1000;
                const trialDaysLeft = !isPro && !isTrialEnded ? Math.max(0, Math.ceil((new Date(site.created_at).getTime() + 14 * 24 * 60 * 60 * 1000 - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;
                const subDaysLeft = isPro && sub ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;

                let badgeColor = "bg-primary";
                if (sub?.plan_id === "starter") badgeColor = "bg-blue-500";
                if (sub?.plan_id === "ecommerce") badgeColor = "bg-indigo-600";
                if (sub?.plan_id === "pro") badgeColor = "bg-purple-600";

                return (
                  <Card
                    key={site.id}
                    className="group flex flex-col overflow-hidden rounded-3xl border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 bg-card/50 transition-all active:scale-[0.99] md:hover:scale-[1.02]"
                  >
                    <CardHeader className="pb-3 p-5">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant={
                              site.is_published ? "default" : "secondary"
                            }
                            className="rounded-full px-2.5 h-5 text-[9px] font-bold uppercase tracking-wider"
                          >
                            {site.is_published ? "Live" : "Draft"}
                          </Badge>
                          {isPro ? (
                            <div className="flex gap-1">
                              <Badge
                                className={cn(
                                  "border-0 text-white rounded-full px-2.5 h-5 text-[9px] font-bold uppercase tracking-wider shadow-sm",
                                  badgeColor
                                )}
                              >
                                {currentPlanObj.name} ({subDaysLeft}d left)
                              </Badge>
                              {/* 🚀 DOWNGRADING SOON BADGE ADDED HERE */}
                              {isDowngradingSoon && (
                                <Badge
                                  variant="outline"
                                  className="rounded-full px-2.5 h-5 text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border-amber-500"
                                >
                                  Downgrading Soon
                                </Badge>
                              )}
                            </div>
                          ) : isTrialEnded ? (
                            <Badge
                              variant="outline"
                              className="border-red-500 text-red-600 bg-red-50 rounded-full px-2.5 h-5 text-[9px] font-bold uppercase tracking-wider"
                            >
                              Expired
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-500 text-amber-600 bg-amber-50 rounded-full px-2.5 h-5 text-[9px] font-bold uppercase tracking-wider"
                            >
                            Trial ({trialDaysLeft}d)
                            </Badge>
                          )}
                        </div>
                        <div className="h-8 w-8 flex items-center justify-center -mr-2 -mt-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                aria-label={`More actions for ${site.site_name || "website"}`}
                              >
                                <MoreVertical size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem asChild>
                                <a href={`/pro/${site.public_slug}`} target="_blank" rel="noreferrer" className="cursor-pointer">
                                  <ExternalLink size={14} className="mr-2" /> Preview
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <a href={`/dashboard/portfolio?id=${site.id}`} className="cursor-pointer">
                                  <Pencil size={14} className="mr-2" /> Edit site
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openDeleteDialog(site.id)}
                                className="cursor-pointer text-destructive focus:text-destructive"
                              >
                                <Trash2 size={14} className="mr-2" /> Delete site
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <CardTitle className="truncate text-lg font-bold leading-tight">
                        {site.site_name || "Untitled"}
                      </CardTitle>
                      <CardDescription className="truncate text-xs font-medium opacity-80 mt-1">
                        {site.custom_domain || `${site.public_slug}.ucp.com`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-5 py-2 flex-grow">
                      {isPro ? (
                        <div className="text-[11px] font-medium text-foreground/70 bg-muted/50 p-3 rounded-lg flex justify-between items-center border border-border/50">
                          <span>
                            Renews {new Date(sub.current_period_end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} ({subDaysLeft}d left)
                          </span>
                          <span className="uppercase text-[9px] bg-background px-1.5 py-0.5 rounded border">
                            {sub.payment_method}
                          </span>
                        </div>
                      ) : isTrialEnded ? (
                        <div className="text-xs text-red-800 bg-red-50 p-3 rounded-xl border border-red-100 flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={14} className="shrink-0" />
                            <span className="font-semibold">{sub ? "Plan Expired" : "Trial Expired"}</span>
                          </div>
                          <p className="opacity-80">Please select a plan to publish this site again.</p>
                        </div>
                      ) : (
                        <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-100 flex items-start gap-2">
                          <Clock size={14} className="shrink-0 mt-0.5" />
                          <div className="flex flex-col">
                            <span className="font-semibold">Trial Active ({trialDaysLeft} days left)</span>
                            <span className="text-[10px] opacity-80">Ends {new Date(new Date(site.created_at).getTime() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="p-4 pt-2">
                      {/* 🚀 If it's a Stripe subscription, direct them to Manage */}
                      {isPro && sub?.payment_method === "stripe" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full font-bold h-10 rounded-xl shadow-sm"
                          onClick={handleManageStripeSub}
                          disabled={isRedirecting}
                        >
                          {isRedirecting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            "Manage"
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className={cn(
                            "w-full font-bold h-10 rounded-xl shadow-sm transition-all",
                            isPro
                              ? "bg-amber-500 hover:bg-amber-600 text-white"
                              : "bg-primary text-primary-foreground"
                          )}
                          onClick={() => {
                            setSelectedPortfolioId(site.id);
                            setIsUpgradeOpen(true);
                          }}
                        >
                          {isPro ? "Manage Plan" : isTrialEnded ? "Select Plan to Continue" : "Upgrade"}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
            )}
          </TabsContent>

          {/* --- TAB 2: BILLING --- */}
          <TabsContent
            value="billing"
            className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center gap-3">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", walletBalance < 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                  <Coins size={18} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Platform Credits</div>
                  <div className={cn("text-lg font-bold", walletBalance < 0 ? "text-destructive" : "text-foreground")}>{walletBalance.toLocaleString()}</div>
                </div>
              </div>
              <Button onClick={() => setIsTopUpOpen(true)} className="font-semibold shrink-0">
                <Plus size={14} className="mr-1.5" /> Top up
              </Button>
            </div>

            <Card className="rounded-xl shadow-sm border-border/60 overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Transaction history</CardTitle>
                <CardDescription>Your last 10 credit transactions.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {transactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No transactions yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="hidden sm:table-cell">Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                                  tx.amount > 0
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {tx.amount > 0 ? (
                                  <ArrowUpRight size={14} />
                                ) : (
                                  <CreditCard size={14} />
                                )}
                              </div>
                              <div>
                                <div className="font-medium text-sm">{tx.description}</div>
                                <div className="text-[11px] text-muted-foreground sm:hidden">
                                  {new Date(tx.created_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold whitespace-nowrap",
                              tx.amount > 0 ? "text-emerald-600" : "text-foreground"
                            )}
                          >
                            {tx.amount > 0 ? "+" : ""}
                            {tx.amount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      {/* --- CONFIRMATION DIALOG --- */}
      <Dialog
        open={!!confirmDialog}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <DialogContent className="w-[90vw] rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title}</DialogTitle>
            <DialogDescription className="py-2 text-foreground">
              {confirmDialog?.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="h-10"
              onClick={() => setConfirmDialog(null)}
            >
              Cancel
            </Button>
            <Button
              variant={confirmDialog?.isDestructive ? "destructive" : "default"}
              className="h-10"
              onClick={confirmDialog?.action}
            >
              {confirmDialog?.confirmText || "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DELETE MODAL --- */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="w-[90vw] rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Delete Website
            </DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-3 bg-red-50 text-red-900 rounded-lg text-sm border border-red-100">
              Confirm deletion of{" "}
              <strong>
                {
                  portfolios.find((p) => p.id === selectedPortfolioId)
                    ?.site_name
                }
              </strong>
              .
            </div>
            <Input
              value={deleteConfirmationName}
              onChange={(e) => setDeleteConfirmationName(e.target.value)}
              placeholder="Type website name"
              className="h-11"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              className="h-11"
              onClick={() => setIsDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-11"
              onClick={handleDeleteSite}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- UPGRADE MODAL --- */}
      <Dialog open={isUpgradeOpen} onOpenChange={setIsUpgradeOpen}>
        <DialogContent className="w-full h-[100dvh] sm:h-[90vh] sm:max-w-[1000px] p-0 flex flex-col bg-background sm:rounded-2xl border-none">
          <div className="p-4 sm:p-5 border-b shrink-0 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold">
                {isSelectedExpired ? "Select a plan to continue" : "Manage plan"}
              </DialogTitle>
              <DialogDescription className="text-xs truncate">
                {isSelectedExpired
                  ? "Your plan or trial has expired. Select a plan to keep your site active."
                  : `Choose the best plan for ${portfolios.find((p) => p.id === selectedPortfolioId)?.site_name || "your website"}.`}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsUpgradeOpen(false)}
              className="shrink-0"
              aria-label="Close plan selector"
            >
              <X size={20} />
            </Button>
          </div>
          <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
            <div className="flex flex-col items-start sm:items-center gap-2 mb-6">
              <div className="flex justify-start sm:justify-center overflow-x-auto no-scrollbar pb-1 w-full">
                <div className="bg-muted/50 p-1.5 rounded-2xl flex gap-1 border shrink-0 mx-auto">
                  {[1, 3, 6, 12].map((duration) => {
                    const isActive = billingDuration === duration;
                    const bestLabel = PLANS.reduce<string | null>((best, p) => {
                      const l = p.pricing[duration as PlanDuration]?.label;
                      return l && (!best || parseInt(l) > parseInt(best)) ? l : best;
                    }, null);
                    return (
                      <button
                        key={duration}
                        onClick={() =>
                          setBillingDuration(duration as PlanDuration)
                        }
                        className={cn(
                          "px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap border border-transparent",
                          isActive
                            ? "bg-background shadow-sm text-foreground border-border/50"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {duration === 1 ? "Monthly" : `${duration} Months`}
                        {bestLabel && (
                          <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0 h-4">
                            {bestLabel}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-12">
              {PLANS.map((plan) => {
                const details = plan.pricing[billingDuration as PlanDuration];
                const proration = calculateProration(plan.id);

                const sub = subscriptions[selectedPortfolioId || ""];
                const isCurrentPlanId = sub?.plan_id === plan.id;
                const isExactlyCurrent =
                  isCurrentPlanId &&
                  billingDuration === proration.activeDuration;

                // 🚀 NEW: Robust State Detection for Down/Up-grades
                const isDowngradeScheduledToThis =
                  sub?.cancel_at_period_end === true &&
                  sub?.metadata?.next_plan_id === plan.id;
                const isCurrentPlanPendingDowngrade =
                  isExactlyCurrent &&
                  sub?.cancel_at_period_end === true &&
                  sub?.metadata?.next_plan_id;
                const isStripe =
                  sub?.payment_method === "stripe" && sub?.status === "active";

                return (
                  <Card
                    key={plan.id}
                    className={cn(
                      "relative flex flex-col overflow-hidden",
                      isExactlyCurrent ? "border-primary bg-primary/5 border-2" : plan.popular ? "border-primary border-2" : "border-border/60"
                    )}
                  >
                    {plan.popular && !isExactlyCurrent && (
                      <div className="absolute top-0 inset-x-0 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider text-center py-1">
                        Most popular
                      </div>
                    )}
                    <CardHeader className={cn("pb-3 p-5", plan.popular && !isExactlyCurrent && "pt-8")}>
                      <CardTitle className="flex items-center justify-between text-base">
                        {plan.name} {isExactlyCurrent && <Badge>Current</Badge>}
                      </CardTitle>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-bold text-foreground">
                          ${details.stripeCost}
                          <span className="text-sm text-muted-foreground font-medium">/mo</span>
                        </span>
                        {details.label && (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            {details.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                    </CardHeader>
                    <CardContent className="flex-grow p-5 pt-0 space-y-4">
                      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                        <span className="text-xs font-medium text-muted-foreground">Or pay with coins</span>
                        <span className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                          <Coins size={14} className="text-amber-500" />
                          {proration.isUpgrade && proration.unusedValue > 0
                            ? proration.cost
                            : details.coinCost}
                        </span>
                      </div>
                      {proration.unusedValue > 0 && !isExactlyCurrent && (
                        <p className="text-[11px] text-muted-foreground -mt-2">
                          Includes a {proration.unusedValue.toLocaleString()} coin credit from your current plan.
                        </p>
                      )}
                      <ul className="space-y-2">
                        {plan.features.map((f) => (
                          <li
                            key={f}
                            className="flex items-center gap-3 text-xs font-medium text-muted-foreground"
                          >
                            <Check size={14} className="text-primary shrink-0" /> {f}
                          </li>
                        ))}
                      </ul>
                    </CardContent>

                    {/* 🚀 THE UPGRADED CARD FOOTER LOGIC */}
                    <CardFooter className="p-5 pt-0 flex flex-col gap-3">
                      {isStripe ? (
                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={handleManageStripeSub}
                        >
                          Manage in Stripe
                        </Button>
                      ) : isDowngradeScheduledToThis ? (
                        <div className="flex flex-col gap-2 w-full">
                          <div className="text-xs font-bold text-center text-amber-600 bg-amber-50 py-2 rounded-lg border border-amber-200">
                            Downgrade Scheduled
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelDowngrade}
                            disabled={processingPlan === "canceling"}
                          >
                            {processingPlan === "canceling" ? (
                              <Loader2 className="animate-spin w-4 h-4 mr-2" />
                            ) : (
                              "Cancel Downgrade"
                            )}
                          </Button>
                        </div>
                      ) : isExactlyCurrent ? (
                        <Button variant="secondary" className="w-full" disabled>
                          {isCurrentPlanPendingDowngrade
                            ? "Ends at billing cycle"
                            : "Current Plan"}
                        </Button>
                      ) : (
                        <>
                          <Button
                            className={cn(
                              "w-full font-bold h-11",
                              proration.isDowngrade
                                ? "bg-muted text-foreground hover:bg-muted/80 border border-border"
                                : "bg-primary text-primary-foreground"
                            )}
                            onClick={() => handleBuyWithWallet(plan)}
                            disabled={!!processingPlan}
                          >
                            {processingPlan === plan.id ? (
                              <Loader2 className="animate-spin" />
                            ) : proration.isDowngrade ? (
                              "Schedule Downgrade"
                            ) : (
                              `Upgrade with Coins`
                            )}
                          </Button>
                          {!proration.isDowngrade && (
                            <Button
                              variant="ghost"
                              className="w-full h-8 text-xs"
                              onClick={() => handleDirectStripe(plan)}
                            >
                              Pay with Card
                            </Button>
                          )}
                        </>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateSiteModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        actorId={actorData.id}
        onSuccess={handleSiteCreated}
        siteCount={portfolios.length}
      />
    </div>
  );
};

export default SettingsPage;