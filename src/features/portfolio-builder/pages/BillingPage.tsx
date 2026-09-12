import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/supabaseClient";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  Coins,
  CreditCard,
  ArrowDownRight,
  Gift,
  RotateCcw,
  Zap,
  Plus,
  Trash2,
  Star,
  Globe,
  Receipt,
  LayoutDashboard,
  Wallet,
  ExternalLink,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NotificationContainer,
  Notification,
} from "@/components/ui/NotificationToast";
import { TopUpModal } from "@/features/portfolio-builder";
import { SITE_PLANS } from "@/config/plans";

// --- STRIPE (for adding a new saved card) ---
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

interface PaymentMethod {
  id: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
}

const TXN_TYPE_META: Record<string, { label: string; icon: any; tone: string }> = {
  purchase: { label: "Purchase", icon: ArrowDownRight, tone: "text-foreground" },
  redeem_code: { label: "Redeemed code", icon: Gift, tone: "text-emerald-600" },
  chargeback: { label: "Chargeback", icon: RotateCcw, tone: "text-destructive" },
  usage: { label: "Usage", icon: Zap, tone: "text-foreground" },
};

const AddCardForm = ({ onSuccess, notify }: { onSuccess: () => void; notify: (t: "success" | "error", title: string, msg?: string) => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setIsSaving(true);
    const { error } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });
    if (error) {
      notify("error", "Could not save card", error.message);
      setIsSaving(false);
      return;
    }
    notify("success", "Card added");
    onSuccess();
    setIsSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <Button type="submit" disabled={!stripe || isSaving} className="w-full h-11 font-bold">
        {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
        Save card
      </Button>
    </form>
  );
};

export default function BillingPage() {
  const { actorData } = useOutletContext<ActorDashboardContextType>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  const walletBalance = actorData.wallet_balance ?? 0;

  const [loading, setLoading] = useState(true);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, any>>({});
  const [transactions, setTransactions] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [cardSetupSecret, setCardSetupSecret] = useState<string | null>(null);
  const [busyMethodId, setBusyMethodId] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notify = (type: "success" | "error" | "info", title: string, message?: string) => {
    const id = Math.random().toString(36).substring(7);
    setNotifications((prev) => [...prev, { id, type, title, message }]);
  };
  const removeNotification = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  const fetchBillingData = useCallback(async () => {
    if (!actorData?.id) return;
    setLoading(true);

    const { data: sites } = await supabase
      .from("portfolios")
      .select("*")
      .eq("actor_id", actorData.id)
      .order("created_at", { ascending: false });
    if (sites) setPortfolios(sites);

    const { data: subs } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("actor_id", actorData.id);
    if (subs) {
      const subMap: Record<string, any> = {};
      subs.forEach((s) => {
        if (s.status === "active" && new Date(s.current_period_end) > new Date()) {
          subMap[s.portfolio_id] = s;
        } else if (!subMap[s.portfolio_id]) {
          subMap[s.portfolio_id] = s;
        }
      });
      setSubscriptions(subMap);
    }

    const { data: txs } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("actor_id", actorData.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (txs) setTransactions(txs);

    setLoading(false);
  }, [actorData?.id]);

  const fetchPaymentMethods = useCallback(async () => {
    if (!actorData?.id) return;
    setMethodsLoading(true);
    const { data, error } = await supabase.functions.invoke("stripe-billing", {
      body: { action: "list_payment_methods", actorId: actorData.id },
    });
    if (!error && data?.paymentMethods) setPaymentMethods(data.paymentMethods);
    setMethodsLoading(false);
  }, [actorData?.id]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  useEffect(() => {
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  const handleOpenAddCard = async () => {
    setIsAddCardOpen(true);
    setCardSetupSecret(null);
    const { data, error } = await supabase.functions.invoke("stripe-billing", {
      body: { action: "create_setup_intent", actorId: actorData.id },
    });
    if (error || !data?.clientSecret) {
      notify("error", "Could not start card setup", error?.message);
      setIsAddCardOpen(false);
      return;
    }
    setCardSetupSecret(data.clientSecret);
  };

  const handleRemoveCard = async (paymentMethodId: string) => {
    setBusyMethodId(paymentMethodId);
    const { error } = await supabase.functions.invoke("stripe-billing", {
      body: { action: "detach_payment_method", actorId: actorData.id, paymentMethodId },
    });
    if (error) notify("error", "Could not remove card", error.message);
    else {
      notify("success", "Card removed");
      fetchPaymentMethods();
    }
    setBusyMethodId(null);
  };

  const handleSetDefaultCard = async (paymentMethodId: string) => {
    setBusyMethodId(paymentMethodId);
    const { error } = await supabase.functions.invoke("stripe-billing", {
      body: { action: "set_default_payment_method", actorId: actorData.id, paymentMethodId },
    });
    if (error) notify("error", "Could not set default card", error.message);
    else {
      notify("success", "Default card updated");
      fetchPaymentMethods();
    }
    setBusyMethodId(null);
  };

  if (loading)
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  const activeSitesCount = portfolios.filter((site) => {
    const sub = subscriptions[site.id];
    return sub && sub.status === "active" && new Date(sub.current_period_end) > new Date();
  }).length;

  return (
    <div className="w-full max-w-8xl md:p-4">
      <NotificationContainer notifications={notifications} removeNotification={removeNotification} />
      <TopUpModal
        isOpen={isTopUpOpen}
        onOpenChange={setIsTopUpOpen}
        actorData={actorData}
        profile={actorData}
        onSuccess={fetchBillingData}
        notify={notify}
      />

      <div className="px-4 py-6 md:py-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Billing</h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Manage your Platform Credits, active services, usage, and payment methods.
            </p>
          </div>
          <Button onClick={() => setIsTopUpOpen(true)} className="font-semibold shrink-0">
            <Plus size={16} className="mr-1.5" /> Top up credits
          </Button>
        </div>

        {actorData.is_suspended && (
          <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle size={16} className="shrink-0" />
              {actorData.suspended_reason || "Your account is suspended due to a negative balance."}
            </div>
            <Button size="sm" variant="destructive" onClick={() => setIsTopUpOpen(true)} className="shrink-0">
              Settle balance
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4">
            <div>
              <span className="text-xs text-muted-foreground font-medium">Platform Credits</span>
              <div className={cn("text-xl font-bold mt-0.5", walletBalance < 0 ? "text-destructive" : "text-foreground")}>
                {walletBalance.toLocaleString()}
              </div>
            </div>
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", walletBalance < 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
              <Coins size={18} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4">
            <div>
              <span className="text-xs text-muted-foreground font-medium">Active services</span>
              <div className="text-xl font-bold text-foreground mt-0.5">{activeSitesCount} / {portfolios.length}</div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Globe size={18} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4">
            <div>
              <span className="text-xs text-muted-foreground font-medium">Saved payment methods</span>
              <div className="text-xl font-bold text-foreground mt-0.5">{paymentMethods.length}</div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <CreditCard size={18} />
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setSearchParams({ tab: val })} className="w-full">
        <div className="sticky top-[60px] md:top-14 z-40 bg-background/95 backdrop-blur-xl border-b border-border/60 px-4 md:px-8 transition-all">
          <TabsList className="h-auto bg-transparent p-0 gap-6 justify-start rounded-none overflow-x-auto no-scrollbar">
            <TabsTrigger value="overview" className="h-11 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-semibold text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap">
              <LayoutDashboard size={16} className="mr-2" /> Overview
            </TabsTrigger>
            <TabsTrigger value="services" className="h-11 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-semibold text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap">
              <Globe size={16} className="mr-2" /> Active services
            </TabsTrigger>
            <TabsTrigger value="usage" className="h-11 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-semibold text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap">
              <Receipt size={16} className="mr-2" /> Usage & activity
            </TabsTrigger>
            <TabsTrigger value="payment-methods" className="h-11 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-semibold text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap">
              <Wallet size={16} className="mr-2" /> Payment methods
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="px-4 md:px-8 py-6">
          {/* --- OVERVIEW --- */}
          <TabsContent value="overview" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="rounded-xl shadow-sm border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent activity</CardTitle>
                <CardDescription>Your last 5 credit transactions.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {transactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">No transactions yet.</div>
                ) : (
                  <div className="divide-y">
                    {transactions.slice(0, 5).map((tx) => {
                      const meta = TXN_TYPE_META[tx.type] || TXN_TYPE_META.purchase;
                      const Icon = meta.icon;
                      return (
                        <div key={tx.id} className="flex items-center justify-between gap-3 p-4">
                          <div className="flex items-center gap-3">
                            <div className={cn("h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0", meta.tone)}>
                              <Icon size={14} />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-foreground">{tx.description || meta.label}</div>
                              <div className="text-[11px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</div>
                            </div>
                          </div>
                          <div className={cn("font-semibold text-sm whitespace-nowrap", tx.amount > 0 ? "text-emerald-600" : "text-foreground")}>
                            {tx.amount > 0 ? "+" : ""}{tx.amount}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- ACTIVE SERVICES --- */}
          <TabsContent value="services" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="rounded-xl shadow-sm border-border/60 overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Active services</CardTitle>
                <CardDescription>All subscriptions across your websites.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {portfolios.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">No websites yet.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Site</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Renews / expires</TableHead>
                        <TableHead>Payment method</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {portfolios.map((site) => {
                        const sub = subscriptions[site.id];
                        const isPro = sub && sub.status === "active" && new Date(sub.current_period_end) > new Date();
                        const plan = SITE_PLANS.find((p) => p.id === sub?.plan_id);
                        return (
                          <TableRow key={site.id}>
                            <TableCell className="font-medium">{site.site_name || "Untitled"}</TableCell>
                            <TableCell>{isPro ? plan?.name || "Pro" : "Trial / Free"}</TableCell>
                            <TableCell>
                              <Badge variant={isPro ? "default" : "outline"} className="text-[10px]">
                                {isPro ? "Active" : "Not subscribed"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {isPro ? new Date(sub.current_period_end).toLocaleDateString() : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground capitalize">
                              {sub?.payment_method || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" asChild>
                                <a href={`/dashboard/settings?tab=websites`}>Manage</a>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- USAGE & ACTIVITY --- */}
          <TabsContent value="usage" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="rounded-xl shadow-sm border-border/60 overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Transaction history</CardTitle>
                <CardDescription>Purchases, redemptions, usage, and chargebacks.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {transactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">No transactions yet.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="hidden sm:table-cell">Date</TableHead>
                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => {
                        const meta = TXN_TYPE_META[tx.type] || TXN_TYPE_META.purchase;
                        const Icon = meta.icon;
                        return (
                          <TableRow key={tx.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Icon size={14} className={meta.tone} />
                                <span className="text-sm font-medium">{meta.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{tx.description}</TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                              {new Date(tx.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="outline" className="text-[10px] capitalize">{tx.status || "completed"}</Badge>
                            </TableCell>
                            <TableCell className={cn("text-right font-semibold whitespace-nowrap", tx.amount > 0 ? "text-emerald-600" : "text-foreground")}>
                              {tx.amount > 0 ? "+" : ""}{tx.amount}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- PAYMENT METHODS --- */}
          <TabsContent value="payment-methods" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="rounded-xl shadow-sm border-border/60">
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Saved cards</CardTitle>
                  <CardDescription>Used for subscriptions and credit top-ups.</CardDescription>
                </div>
                <Button size="sm" onClick={handleOpenAddCard} className="font-semibold shrink-0">
                  <Plus size={14} className="mr-1.5" /> Add card
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {methodsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : paymentMethods.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">No saved cards yet.</div>
                ) : (
                  paymentMethods.map((pm) => (
                    <div key={pm.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                          <CreditCard size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground capitalize flex items-center gap-2">
                            {pm.brand} •••• {pm.last4}
                            {pm.isDefault && <Badge variant="outline" className="text-[9px]">Default</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">Expires {pm.expMonth}/{pm.expYear}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!pm.isDefault && (
                          <Button size="sm" variant="ghost" disabled={busyMethodId === pm.id} onClick={() => handleSetDefaultCard(pm.id)}>
                            <Star size={14} className="mr-1.5" /> Make default
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" disabled={busyMethodId === pm.id} onClick={() => handleRemoveCard(pm.id)} aria-label={`Remove card ending in ${pm.last4}`}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                <a href="#" onClick={async (e) => {
                  e.preventDefault();
                  const { data, error } = await supabase.functions.invoke("create-portal-session", {
                    body: { actorId: actorData.id, returnUrl: window.location.href },
                  });
                  if (error || !data?.url) notify("error", "Could not open billing portal", error?.message);
                  else window.location.href = data.url;
                }} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground pt-2">
                  Manage invoices & receipts in Stripe <ExternalLink size={12} />
                </a>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
        <DialogContent className="w-[90vw] rounded-2xl sm:max-w-md">
          <DialogTitle>Add a payment method</DialogTitle>
          <DialogDescription>Your card is securely stored by Stripe.</DialogDescription>
          {!cardSetupSecret ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
            <Elements stripe={stripePromise} options={{ clientSecret: cardSetupSecret }}>
              <AddCardForm
                notify={notify}
                onSuccess={() => {
                  setIsAddCardOpen(false);
                  fetchPaymentMethods();
                }}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
