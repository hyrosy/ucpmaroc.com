import React, { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/supabaseClient";
import { useOutletContext, useNavigate } from "react-router-dom";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Package,
  Phone,
  ShoppingBag,
  User,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Tag,
  Search,
  Download,
  RotateCcw,
  PlayCircle,
  X as CloseIcon,
  Trash2,
  Mail,
  Send,
  MessageSquare,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SiteFilter from "@/components/dashboard/SiteFilter";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import DashboardState from "@/components/dashboard/DashboardState";
import { cn } from "@/lib/utils";

// --- UNIVERSAL STATUS MAP ---
const STATUS_MAP = {
  pending: {
    label: "Pending",
    icon: Clock,
    color:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  in_progress: {
    label: "In Progress",
    icon: PlayCircle,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    color:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
  refunded: {
    label: "Refunded",
    icon: RotateCcw,
    color: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
  },
};

type OrderStatus = keyof typeof STATUS_MAP;

interface ProOrder {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  product_name: string;
  product_price: string;
  quantity: number;
  variants: Record<string, any>;
  status: OrderStatus;
  notes: string | null;
  portfolio_id?: string;
  items?: any[];
}

const OrdersPage = () => {
  const { actorData, selectedSiteId, setSelectedSiteId } = useOutletContext<ActorDashboardContextType>();
  const [allOrders, setAllOrders] = useState<ProOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [sites, setSites] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  // Bulk Selection
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set()
  );
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const navigate = useNavigate(); // ADD THIS IMPORT

  const fetchData = async () => {
    if (!actorData.id) return;
    setLoading(true);

    const { data: mySites } = await supabase
      .from("portfolios")
      .select("id, site_name")
      .eq("actor_id", actorData.id);
    if (mySites) setSites(mySites);

    const { data, error } = await supabase
      .from("pro_orders")
      .select("*")
      .eq("actor_id", actorData.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const normalizedData = data.map((o: any) => ({
        ...o,
        status: o.status === "processing" ? "in_progress" : o.status,
      }));
      setAllOrders(normalizedData);
    }
    setLoading(false);
    setSelectedOrderIds(new Set());
  };

  useEffect(() => {
    fetchData();
  }, [actorData.id]);

  // --- FILTERING LOGIC ---
  const filteredOrders = useMemo(() => {
    return allOrders.filter((order) => {
      if (selectedSiteId !== "all" && order.portfolio_id !== selectedSiteId)
        return false;
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const shortId = order.id.substring(0, 6).toLowerCase();
        if (
          !order.customer_name?.toLowerCase().includes(q) &&
          !order.customer_phone?.toLowerCase().includes(q) &&
          !shortId.includes(q) &&
          !order.product_name?.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [allOrders, selectedSiteId, statusFilter, searchQuery]);

  // --- METRICS CALCULATION ---
  const siteOrders = useMemo(() => {
    return allOrders.filter((order) => selectedSiteId === "all" || order.portfolio_id === selectedSiteId);
  }, [allOrders, selectedSiteId]);

  const metrics = useMemo(() => {
    let revenue = 0;
    let pending = 0;
    siteOrders.forEach((order) => {
      if (order.status === "pending") pending++;
      if (order.status !== "cancelled" && order.status !== "refunded") {
        const amount = parseFloat(
          order.product_price?.replace(/[^0-9.]/g, "") || "0"
        );
        revenue += isNaN(amount) ? 0 : amount;
      }
    });
    return { revenue, total: siteOrders.length, pending };
  }, [siteOrders]);

  // --- ACTIONS ---
  const handleRowClick = (order: ProOrder) => {
    if (selectedOrderIds.size > 0) {
      toggleOrderSelection(order.id);
      return;
    }
    navigate(`/dashboard/orders/${order.id}`);
  };

  const handleBulkUpdateStatus = async (newStatus: OrderStatus) => {
    if (selectedOrderIds.size === 0) return;
    setIsBulkUpdating(true);
    const idsToUpdate = Array.from(selectedOrderIds);

    setAllOrders((prev) =>
      prev.map((o) =>
        idsToUpdate.includes(o.id) ? { ...o, status: newStatus } : o
      )
    );
    await supabase
      .from("pro_orders")
      .update({ status: newStatus })
      .in("id", idsToUpdate);
    setIsBulkUpdating(false);
    setSelectedOrderIds(new Set());
  };

  // 🚀 BULK DELETE LOGIC
  const handleBulkDelete = async () => {
    if (selectedOrderIds.size === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete ${selectedOrderIds.size} orders? This cannot be undone.`
      )
    )
      return;

    setIsBulkUpdating(true);
    const idsToDelete = Array.from(selectedOrderIds);

    const { error } = await supabase
      .from("pro_orders")
      .delete()
      .in("id", idsToDelete);
    if (!error) {
      setAllOrders((prev) => prev.filter((o) => !idsToDelete.includes(o.id)));
      setSelectedOrderIds(new Set());
    } else {
      alert("Failed to delete orders.");
    }
    setIsBulkUpdating(false);
  };

  const toggleOrderSelection = (id: string) => {
    const next = new Set(selectedOrderIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOrderIds(next);
  };

  const toggleAllSelection = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const getSiteName = (id?: string) => {
    if (!id) return "Unknown Site";
    return sites.find((s) => s.id === id)?.site_name || "Portfolio";
  };

  // --- HELPERS FOR PARSING & EXTRACTION ---
  const formatOrderId = (id: string) =>
    `#ORD-${id.substring(0, 6).toUpperCase()}`;

  const parseVariants = (variants: Record<string, any>, items?: any[]) => {
    if (items && items.length > 0) {
      return items.map((item: any) => `${item.quantity}x ${item.title}${item.variant && item.variant !== 'default' ? ` (${item.variant})` : ''}`).join(' • ');
    }
    if (!variants || Object.keys(variants).length === 0) return null;
    return Object.entries(variants)
      .map(([key, val]) => `${key}: ${val?.label || val}`)
      .join(" • ");
  };

  const parseFormNotes = (notes: string | null) => {
    if (!notes) return [];
    return notes
      .split("\n")
      .filter((line) => line.includes(":") && !line.trim().startsWith("Cart Items:") && !line.trim().startsWith("Form Details:"))
      .map((line) => {
        const [key, ...rest] = line.split(":");
        return { key: key.trim(), value: rest.join(":").trim() };
      });
  };

  // 🚀 INTELLIGENT EXTRACTION: Pulls Core info from notes, ignores duplicates
  const extractOrderDetails = (order: ProOrder) => {
    const parsedNotes = parseFormNotes(order.notes);
    const coreExtra: any = {};
    const customData: { key: string; value: string }[] = [];

    // All known core variations to prevent duplication
    const redundantKeys = [
      "checkout_name",
      "name",
      "full name",
      "checkout_email",
      "email",
      "email address",
      "checkout_phone",
      "phone",
      "phone number",
      "checkout_address",
      "address",
      "shipping address",
      "street address",
      "checkout_city",
      "city",
      "checkout_zip",
      "zip",
      "zip code",
      "postal code",
      "zip / postal code",
      "checkout_country",
      "country",
      "payment method",
      "bank name",
      "account holder",
      "iban",
      "iban/account no",
      "payment intent",
    ];

    parsedNotes.forEach((item) => {
      const k = item.key.toLowerCase();
      if (k === "checkout_email" || k === "email" || k === "email address")
        coreExtra.email = item.value;
      else if (k === "checkout_city" || k === "city")
        coreExtra.city = item.value;
      else if (
        k === "checkout_zip" ||
        k === "zip" ||
        k === "zip code" ||
        k === "zip / postal code"
      )
        coreExtra.zip = item.value;
      else if (k === "checkout_country" || k === "country")
        coreExtra.country = item.value;
      else if (k === "payment method")
        coreExtra.paymentMethod = item.value;
      else if (k === "bank name")
        coreExtra.bankName = item.value;
      else if (k === "account holder")
        coreExtra.bankHolder = item.value;
      else if (k === "iban" || k === "iban/account no")
        coreExtra.bankIban = item.value;
      else if (k === "payment intent")
        coreExtra.paymentIntent = item.value;
      else if (!redundantKeys.includes(k) && !k.startsWith("field_")) {
        customData.push(item);
      }
    });

    return { coreExtra, customData };
  };

  // 🚀 CSV EXPORT (Zero Duplicates, Flawless Formatting)
  const exportToCSV = () => {
    if (filteredOrders.length === 0) return;

    const allExtracted = filteredOrders.map((o) => ({
      order: o,
      ...extractOrderDetails(o),
    }));

    // Dynamically find all unique custom keys to generate column headers
    const customKeys = new Set<string>();
    allExtracted.forEach((item) =>
      item.customData.forEach((c) => customKeys.add(c.key))
    );
    const customHeaders = Array.from(customKeys);

    const headers = [
      "Order ID",
      "Date",
      "Status",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Shipping Address",
      "City",
      "Zip",
      "Country",
      "Product",
      "Variants",
      "Quantity",
      "Total",
      ...customHeaders,
    ];

    const csvContent = [
      headers.join(","),
      ...allExtracted.map(({ order: o, coreExtra, customData }) => {
        const customMap = new Map(customData.map((c) => [c.key, c.value]));
        const customValues = customHeaders.map(
          (key) => `"${(customMap.get(key) || "").replace(/"/g, '""')}"`
        );

        return [
          formatOrderId(o.id),
          new Date(o.created_at).toLocaleDateString(),
          o.status,
          `"${(o.customer_name || "").replace(/"/g, '""')}"`,
          `"${(coreExtra.email || "").replace(/"/g, '""')}"`,
          `"${(o.customer_phone || "").replace(/"/g, '""')}"`,
          `"${(o.customer_address || "").replace(/"/g, '""')}"`,
          `"${(coreExtra.city || "").replace(/"/g, '""')}"`,
          `"${(coreExtra.zip || "").replace(/"/g, '""')}"`,
          `"${(coreExtra.country || "").replace(/"/g, '""')}"`,
          `"${(o.product_name || "").replace(/"/g, '""')}"`,
          `"${(parseVariants(o.variants, o.items) || "").replace(/"/g, '""')}"`,
          o.quantity,
          `"${(o.product_price || "").replace(/"/g, '""')}"`,
          ...customValues,
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `orders_export_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    link.click();
  };

  if (loading) {
    return <DashboardState variant="loading" title="Loading orders" description="Preparing your fulfillment workspace." className="mx-4 my-8 md:mx-auto md:max-w-7xl" />;
  }

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-7xl mx-auto">
      {/* HEADER */}
      <DashboardPageHeader
        title="Direct orders"
        description="Manage and fulfill your shop sales."
        actions={<div className="flex items-center gap-3 flex-wrap">
          <SiteFilter
            sites={sites}
            selectedSiteId={selectedSiteId}
            onChange={setSelectedSiteId}
          />
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="h-10 rounded-xl bg-background shadow-sm border-border"
          >
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button
            variant="default"
            onClick={fetchData}
            className="h-10 rounded-xl shadow-sm"
          >
            Refresh
          </Button>
        </div>}
      />

      {/* 🚀 METRICS DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-border shadow-sm bg-background overflow-hidden relative">
          <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              Gross Volume
            </CardTitle>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">
              $
              {metrics.revenue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Excluding cancelled/refunded
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border shadow-sm bg-background overflow-hidden relative">
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              Total Orders
            </CardTitle>
            <ShoppingBag className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">
              {metrics.total}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              All time orders
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border shadow-sm bg-background overflow-hidden relative">
          <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/10 rounded-bl-full -mr-4 -mt-4" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              Action Needed
            </CardTitle>
            <Clock className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">
              {metrics.pending}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Pending fulfillment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 🚀 UPGRADED SEARCH & FILTER BAR */}
      <div className="flex flex-col lg:flex-row justify-between gap-2 lg:gap-4 items-start lg:items-center bg-background p-2 rounded-2xl border border-border shadow-sm">
        <div className="relative w-full lg:w-80 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search orders, names, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 border-none shadow-none focus-visible:ring-0 bg-transparent text-sm"
          />
        </div>

        <div className="h-px w-full bg-border lg:hidden" />

        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto px-2 py-1 scrollbar-none snap-x">
          <Button
            variant={statusFilter === "all" ? "default" : "ghost"}
            className={cn(
              "rounded-full h-8 text-xs snap-start px-4",
              statusFilter !== "all" && "text-muted-foreground"
            )}
            onClick={() => setStatusFilter("all")}
          >
            All
          </Button>
          {Object.entries(STATUS_MAP).map(([key, info]) => {
            const count = siteOrders.filter((o) => o.status === key).length;
            return (
              <Button
                key={key}
                variant={statusFilter === key ? "secondary" : "ghost"}
                className={cn(
                  "rounded-full h-8 text-xs snap-start gap-1.5 whitespace-nowrap",
                  statusFilter !== key &&
                    "text-muted-foreground hover:bg-muted/50"
                )}
                onClick={() => setStatusFilter(key as OrderStatus)}
              >
                <info.icon className="w-3 h-3" /> {info.label}
                <span
                  className={cn(
                    "ml-1 opacity-60 text-[10px]",
                    statusFilter === key && "font-bold"
                  )}
                >
                  ({count})
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* 🚀 BULK ACTIONS FLOATING BAR */}
      {selectedOrderIds.size > 0 && (
        <div className="bg-foreground text-background px-4 py-3 sm:px-6 sm:py-4 rounded-2xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-in slide-in-from-bottom-4 fade-in shadow-2xl sticky bottom-6 z-50 transition-all duration-300 border border-border">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setSelectedOrderIds(new Set())}
              className="h-8 w-8 text-background/60 hover:text-background hover:bg-background/20 rounded-full"
            >
              <CloseIcon className="w-4 h-4" />
            </Button>
            <div className="font-bold text-sm">
              {selectedOrderIds.size} order
              {selectedOrderIds.size > 1 ? "s" : ""} selected
            </div>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
            <span className="text-xs opacity-80 hidden sm:inline-block font-medium">
              Update status to:
            </span>
            <Select
              onValueChange={(val: OrderStatus) => handleBulkUpdateStatus(val)}
            >
              <SelectTrigger className="h-9 min-w-0 flex-1 w-auto bg-background/10 border-background/20 text-background focus:ring-0 font-semibold rounded-lg sm:w-[150px] sm:flex-none">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent className="z-[100000] rounded-xl shadow-2xl">
                {Object.entries(STATUS_MAP).map(([key, info]) => (
                  <SelectItem
                    key={key}
                    value={key}
                    className="font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <info.icon className="w-4 h-4 opacity-50" /> {info.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              className="h-9 px-3 rounded-lg flex items-center gap-1.5 ml-1"
            >
              <Trash2 className="w-4 h-4" />{" "}
              <span className="hidden sm:inline-block">Delete</span>
            </Button>
            {isBulkUpdating && (
              <Loader2 className="w-4 h-4 animate-spin ml-2 text-background/50" />
            )}
          </div>
        </div>
      )}

      {/* MAIN TABLE */}
      <Card className="rounded-2xl border-border shadow-sm bg-background overflow-hidden">
        <CardContent className="p-0">
          {filteredOrders.length === 0 ? (
            <DashboardState variant="empty" title="No orders found" description="Try adjusting your filters or search query." className="rounded-none border-0 bg-muted/20" />
          ) : (
            <>
            <div className="divide-y divide-border md:hidden">
              {filteredOrders.map((order) => {
                const StatusIcon = STATUS_MAP[order.status]?.icon || Clock;
                const isSelected = selectedOrderIds.has(order.id);
                return (
                  <article key={order.id} role="button" tabIndex={0} aria-label={`Open order ${formatOrderId(order.id)}`} className={cn("space-y-3 p-4 transition-colors active:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", isSelected && "bg-primary/5")} onClick={() => handleRowClick(order)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleRowClick(order); } }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Checkbox checked={isSelected} onClick={(event) => event.stopPropagation()} onCheckedChange={() => toggleOrderSelection(order.id)} aria-label={`Select order ${formatOrderId(order.id)}`} />
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-bold text-foreground">{formatOrderId(order.id)}</p>
                          <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("shrink-0 text-[11px]", STATUS_MAP[order.status]?.color)}><StatusIcon className="mr-1 h-3 w-3" />{STATUS_MAP[order.status]?.label}</Badge>
                    </div>
                    <div className="flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{order.customer_name || "Guest Checkout"}</p>
                        <p className="truncate text-sm text-muted-foreground">{order.product_name}</p>
                      </div>
                      <p className="shrink-0 font-mono font-bold text-foreground">{order.amount_cents ? `$${(order.amount_cents / 100).toFixed(2)}` : order.product_price}</p>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader className="bg-muted/30 border-b border-border">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="w-12 pl-6">
                      <Checkbox
                        checked={
                          selectedOrderIds.size === filteredOrders.length &&
                          filteredOrders.length > 0
                        }
                        onCheckedChange={toggleAllSelection}
                      />
                    </TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">
                      Order
                    </TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">
                      Customer
                    </TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">
                      Product
                    </TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">
                      Total
                    </TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const variantsStr = parseVariants(order.variants, order.items);
                    const StatusIcon = STATUS_MAP[order.status]?.icon || Clock;
                    const isSelected = selectedOrderIds.has(order.id);

                    return (
                      <TableRow // eslint-disable-line
                        key={order.id}
                        className={cn(
                          "cursor-pointer transition-colors border-b border-border/50 group",
                          isSelected
                            ? "bg-primary/5 hover:bg-primary/10"
                            : "hover:bg-muted/30"
                        )}
                        onClick={() => handleRowClick(order)}
                      >
                        <TableCell
                          className="w-12 pl-6"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() =>
                              toggleOrderSelection(order.id)
                            }
                          />
                        </TableCell>
                        <TableCell className="py-4 align-top">
                          <div className="font-mono font-bold text-foreground">
                            {formatOrderId(order.id)}
                          </div>
                          <div className="text-xs text-muted-foreground font-medium mt-1">
                            {new Date(order.created_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-4 align-top">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                              {(order.customer_name || "G")[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                                {order.customer_name || "Guest Checkout"}
                              </div>
                              <div className="text-sm text-muted-foreground font-medium">
                                {order.customer_phone || "No phone"}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="py-4 align-top">
                          <div className="font-bold text-foreground flex items-center gap-2">
                            {/* --- IMPROVEMENT: Show quantity only for single-item orders --- */}
                            {order.items && order.items.length === 1 ? (
                              <span className="text-muted-foreground font-mono bg-muted px-1.5 rounded">{order.items[0].quantity}x</span>
                            ) : !order.items || order.items.length <= 1 ? (
                              <span className="text-muted-foreground font-mono bg-muted px-1.5 rounded">
                                {order.quantity}x
                              </span>
                            ) : null}
                            {order.product_name}
                          </div>
                          {variantsStr && (
                            <div className="text-xs text-muted-foreground mt-2 font-medium bg-muted inline-block px-2 py-0.5 rounded-md">
                              {variantsStr}
                            </div>
                          )}
                        {order.items?.some((i: any) => i.requiresShipping === false) && (
                          <Badge variant="outline" className="mt-2 text-[9px] uppercase tracking-widest bg-blue-500/10 text-blue-500 border-blue-500/30 ml-2">
                            Digital / Service
                          </Badge>
                        )}
                        </TableCell>

                        <TableCell className="py-4 align-top">
                          <div className="font-bold text-foreground font-mono px-2 py-1 rounded-md inline-block">
                            {/* --- IMPROVEMENT: Read from amount_cents if available --- */}
                            {order.amount_cents
                              ? `$${(order.amount_cents / 100).toFixed(2)}`
                              : order.product_price}
                          </div>
                        </TableCell>

                        <TableCell className="py-4 align-top">
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-bold px-3 py-1 shadow-sm",
                              STATUS_MAP[order.status]?.color
                            )}
                          >
                            <StatusIcon className="w-3 h-3 mr-1.5" />{" "}
                            {STATUS_MAP[order.status]?.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrdersPage;
