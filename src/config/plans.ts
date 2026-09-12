// src/lib/plans.ts

export type PlanTier = "starter" | "ecommerce" | "pro";

// 1. Define the shape of the features explicitly
export interface PlanFeatures {
  siteSlots: any;
  maxBlocksPerSite: number;
  canConnectDomain: boolean;
  hasMegaMenu: boolean; // 🚀 ADD THIS FLAG
  // This is the fix: Allow specific array OR 'all'
  allowedThemes: string[] | "all";
  allowedSectionTypes: string[] | "all";
  modules: {
    shop: boolean;
    appointments: boolean;
    orders_leads: boolean;
  };
  storageLimitMB: number;
}

// 2. Apply this type to the Record
export const PLAN_LIMITS: Record<
  PlanTier,
  { label: string; features: PlanFeatures }
> = {
  starter: {
    label: "Starter",
    features: {
      maxBlocksPerSite: 8,
      canConnectDomain: false,
      hasMegaMenu: false,
      allowedThemes: ["modern", "minimal"],
      allowedSectionTypes: [
        "header",
        "hero",
        "about",
        "gallery",
        "contact",
        "footer",
      ],
      modules: {
        shop: false,
        appointments: false,
        orders_leads: false,
      },
      storageLimitMB: 100,
      siteSlots: undefined,
    },
  },
  ecommerce: {
    label: "eCommerce",
    features: {
      maxBlocksPerSite: 20,
      canConnectDomain: true,
      hasMegaMenu: true,
      allowedThemes: ["modern", "minimal", "storefront", "showcase"],
      allowedSectionTypes: [
        "header",
        "hero",
        "about",
        "gallery",
        "contact",
        "footer",
        "shop",
        "reviews",
      ],
      modules: {
        shop: true,
        appointments: false,
        orders_leads: true,
      },
      storageLimitMB: 500,
      siteSlots: undefined,
    },
  },
  pro: {
    label: "Pro",
    features: {
      maxBlocksPerSite: 999,
      canConnectDomain: true,
      hasMegaMenu: true,
      allowedThemes: "all", // Now valid because of the interface
      allowedSectionTypes: "all",
      modules: {
        shop: true,
        appointments: true,
        orders_leads: true,
      },
      storageLimitMB: 2000,
      siteSlots: undefined,
    },
  },
};

// ============================================================================
// BILLING / MONETIZATION CONFIG
// ----------------------------------------------------------------------------
// Single source of truth for every "sellable unit" on the platform (site plan
// pricing, Platform Credit packs, and future usage credits), so pricing UI
// never duplicates numbers across pages.
//
// Compliance: "Platform Credits" are a specific digital good (not a generic
// stored-value balance), so revenue is recognized at purchase rather than
// deferred like a gift-card liability. Credits must stay non-transferable,
// non-cashable, and spendable only on this platform's own services.
//
// TECH DEBT TICKET: DB columns/RPCs still use `coins`/`wallet_balance` naming
// to avoid a risky migration. Frontend must say "Platform Credits" everywhere.
// Plan to rename the DB columns to `credits`/`credit_balance` later.
// ============================================================================

export type BillingDurationMonths = 1 | 3 | 6 | 12;

export interface SitePlanPricing {
  stripePriceId: string;
  /** USD cost per month, billed for the full duration up front. */
  monthlyUsd: number;
  /** Equivalent cost in Platform Credits ($0.02 per credit, see CREDIT_UNIT_USD). */
  creditCost: number;
  /** Marketing label, e.g. "17% OFF", shown next to the price. */
  label: string | null;
}

export interface SitePlan {
  id: "starter" | "ecommerce" | "pro";
  tier: 1 | 2 | 3;
  name: string;
  description: string;
  popular?: boolean;
  features: string[];
  pricing: Record<BillingDurationMonths, SitePlanPricing>;
}

/** Recurring subscription plans for a single website (Stripe Billing). */
export const SITE_PLANS: SitePlan[] = [
  {
    id: "starter",
    tier: 1,
    name: "Starter",
    description: "Perfect for personal portfolios.",
    features: ["100MB Storage", "Standard Support", "UCP Branding"],
    pricing: {
      1: { stripePriceId: "price_starter_1m", monthlyUsd: 3.0, creditCost: 150, label: null },
      3: { stripePriceId: "price_starter_3m", monthlyUsd: 8.55, creditCost: 425, label: "5% OFF" },
      6: { stripePriceId: "price_starter_6m", monthlyUsd: 16.2, creditCost: 800, label: "10% OFF" },
      12: { stripePriceId: "price_STARTER_YEARLY", monthlyUsd: 30.0, creditCost: 1500, label: "17% OFF" },
    },
  },
  {
    id: "ecommerce",
    tier: 2,
    name: "eCommerce",
    popular: true,
    description: "For selling digital products.",
    features: ["500MB Storage", "Custom Domain", "Online Shop", "Leads Dashboard"],
    pricing: {
      1: { stripePriceId: "price_ECOMMERCE_1M", monthlyUsd: 9.0, creditCost: 450, label: null },
      3: { stripePriceId: "price_ECOMMERCE_3M", monthlyUsd: 25.0, creditCost: 1250, label: "5% OFF" },
      6: { stripePriceId: "price_ECOMMERCE_6M", monthlyUsd: 48.0, creditCost: 2400, label: "11% OFF" },
      12: { stripePriceId: "price_ECOMMERCE_1Y", monthlyUsd: 90.0, creditCost: 4500, label: "17% OFF" },
    },
  },
  {
    id: "pro",
    tier: 3,
    name: "Pro",
    description: "Ultimate power and storage.",
    features: ["2GB Storage", "Priority Support", "Bookings / Appointments", "White Label"],
    pricing: {
      1: { stripePriceId: "price_PRO_1M", monthlyUsd: 19.0, creditCost: 950, label: null },
      3: { stripePriceId: "price_PRO_3M", monthlyUsd: 54.0, creditCost: 2700, label: "5% OFF" },
      6: { stripePriceId: "price_PRO_6M", monthlyUsd: 102.0, creditCost: 5100, label: "10% OFF" },
      12: { stripePriceId: "price_PRO_1Y", monthlyUsd: 190.0, creditCost: 9500, label: "25% OFF" },
    },
  },
];

/** Cost of one extra website slot, in Platform Credits. */
export const SITE_SLOT_COST_CREDITS = 500;

export interface CreditPack {
  id: string;
  name: string;
  /** Platform Credits granted (1 credit = CREDIT_UNIT_USD). */
  credits: number;
  costUsd: number;
  bonus: string;
  popular?: boolean;
}

/** $ per Platform Credit. Keep in sync with the `purchase_subscription_with_wallet` /
 * `buy_portfolio_slot` RPCs, which operate in the same unit (DB column: coins). */
export const CREDIT_UNIT_USD = 0.02;

/** Fixed top-up packs sold for Platform Credits (Stripe card, bank transfer, or crypto —
 * all three rails are equally first-class; most users fund via bank/crypto, not cards). */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "handful", name: "Starter Pack", credits: 250, costUsd: 5, bonus: "" },
  { id: "bag", name: "Popular Pack", credits: 550, costUsd: 10, bonus: "+50 free", popular: true },
  { id: "chest", name: "Growth Pack", credits: 1200, costUsd: 20, bonus: "+200 free" },
  { id: "handful_lg", name: "Business Pack", credits: 1500, costUsd: 26, bonus: "+200 free" },
  { id: "bag_lg", name: "Scale Pack", credits: 3000, costUsd: 54, bonus: "+300 free", popular: true },
  { id: "chest_lg", name: "Enterprise Pack", credits: 8000, costUsd: 153, bonus: "+350 free" },
];

export const MIN_CUSTOM_CREDIT_AMOUNT = 50;

// --- Usage-based credits (not yet wired to a checkout flow) -----------------------------
// Planned for Bot+ / AI usage and the future "AI order confirmation" service. Modeled the
// same way AWS meters compute: a credit is consumed per unit of work, drawn from the same
// Platform Credit balance, at a fixed conversion rate defined per product below.
//
// IMPORTANT when implementing the deduction logic: use an atomic decrement or
// `SELECT ... FOR UPDATE` row lock on the actor's balance row so two concurrent AI actions
// can't both read the same balance and overdraw the account past zero.

export interface UsageCreditProduct {
  id: string;
  name: string;
  /** What one credit represents, e.g. "1 AI agent action" or "1 minute of voice". */
  unitLabel: string;
  /** Platform Credits charged per unit consumed. */
  creditCostPerUnit: number;
}

export const USAGE_CREDIT_PRODUCTS: UsageCreditProduct[] = [
  {
    id: "bot_plus_action",
    name: "Bot+ AI action",
    unitLabel: "1 AI agent action",
    creditCostPerUnit: 2,
  },
  {
    id: "ai_order_confirmation",
    name: "AI order confirmation",
    unitLabel: "1 confirmed order",
    creditCostPerUnit: 10,
  },
];

// --- One-time / recurring add-ons (a la carte features) ---------------------------------

export interface BillingAddon {
  id: string;
  name: string;
  description: string;
  creditCost: number;
  recurring: boolean;
}

export const BILLING_ADDONS: BillingAddon[] = [
  {
    id: "extra_site_slot",
    name: "Extra website slot",
    description: "Own one additional website slot permanently.",
    creditCost: SITE_SLOT_COST_CREDITS,
    recurring: false,
  },
];
