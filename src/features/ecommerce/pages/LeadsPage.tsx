import React, { useEffect, useState } from "react";
import { supabase } from "@/supabaseClient";
import { useOutletContext } from "react-router-dom";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout"; "@/features/talent-marketplace";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Mail,
  User,
  MessageSquare,
  CheckCircle2,
  Reply,
  Trash2,
  ListPlus,
  Sparkles,
  Phone,
  Tag as TagIcon,
  X,
  Filter,
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
import { Label } from "@/components/ui/label";
import SiteFilter from "@/components/dashboard/SiteFilter";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: "new" | "contacted" | "archived" | string;
  source: string;
  metadata?: Record<string, string>;
  portfolio_id?: string;
}

const LeadsPage = () => {
  const { actorData, selectedSiteId, setSelectedSiteId } = useOutletContext<ActorDashboardContextType>();
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");

  // Sheet & Tag State
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [globalTags, setGlobalTags] = useState<string[]>([]);

  const fetchData = async () => {
    if (!actorData.id) return;
    setLoading(true);

    const { data: mySites } = await supabase
      .from("portfolios")
      .select("id, site_name")
      .eq("actor_id", actorData.id);
    if (mySites) setSites(mySites);

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("actor_id", actorData.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAllLeads(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [actorData.id]);

  // 🚀 GENERATE GLOBAL TAGS FROM ALL LEADS
  useEffect(() => {
    const tags = new Set<string>();
    allLeads.forEach((lead) => {
      const leadTags = getCustomTags(lead);
      leadTags.forEach((t) => tags.add(t));
    });
    setGlobalTags(Array.from(tags).sort());
  }, [allLeads]);

  // 🚀 AAA+ MULTI-FILTERING
  useEffect(() => {
    let result = allLeads;
    if (selectedSiteId !== "all") {
      result = result.filter((l) => l.portfolio_id === selectedSiteId);
    }
    if (selectedSource !== "all") {
      result = result.filter((l) =>
        selectedSource === "pricing"
          ? l.source === "pricing_form"
          : l.source !== "pricing_form"
      );
    }
    if (selectedStatus !== "all") {
      result = result.filter((l) => l.status === selectedStatus);
    }
    if (selectedTagFilter !== "all") {
      result = result.filter((l) =>
        getCustomTags(l).includes(selectedTagFilter)
      );
    }
    setFilteredLeads(result);
  }, [
    selectedSiteId,
    selectedSource,
    selectedStatus,
    selectedTagFilter,
    allLeads,
  ]);

  // 🚀 ULTRA-SMART DATA EXTRACTORS
  const getSmartName = (lead: Lead) => {
    if (lead.name && lead.name !== "Anonymous") return lead.name;
    const meta = lead.metadata || {};

    // Look for Split Names (First / Last)
    const firstKey = Object.keys(meta).find(
      (k) =>
        k.toLowerCase().trim() === "first" ||
        k.toLowerCase().trim() === "first name"
    );
    const lastKey = Object.keys(meta).find(
      (k) =>
        k.toLowerCase().trim() === "last" ||
        k.toLowerCase().trim() === "last name"
    );

    if (firstKey || lastKey) {
      return `${firstKey ? meta[firstKey] : ""} ${
        lastKey ? meta[lastKey] : ""
      }`.trim();
    }
    // Fallback to anything containing "name"
    const nameKey = Object.keys(meta).find((k) =>
      k.toLowerCase().includes("name")
    );
    return nameKey ? meta[nameKey] : "Unknown Lead";
  };

  const getSmartEmail = (lead: Lead) => {
    // 1. Check the main database column
    if (
      lead.email &&
      lead.email !== "no-email@provided.com" &&
      lead.email.trim() !== ""
    ) {
      return lead.email;
    }

    // 2. Check the metadata if they renamed the field ID
    const meta = lead.metadata || {};
    const emailKey = Object.keys(meta).find(
      (k) =>
        k.toLowerCase().includes("email") || k.toLowerCase().includes("mail")
    );

    if (emailKey && meta[emailKey] && meta[emailKey].trim() !== "") {
      return meta[emailKey];
    }

    // 3. Clean fallback if the form literally didn't ask for an email
    return "—";
  };

  const getSmartPhone = (lead: Lead) => {
    if (lead.phone && lead.phone !== "null") return lead.phone;
    const meta = lead.metadata || {};
    const phoneKey = Object.keys(meta).find(
      (k) =>
        k.toLowerCase().includes("phone") ||
        k.toLowerCase().includes("tel") ||
        k.toLowerCase().includes("mobile") ||
        k.toLowerCase().includes("whatsapp")
    );
    return phoneKey ? meta[phoneKey] : null;
  };

  const getSmartMessage = (lead: Lead) => {
    if (lead.message && lead.message.trim() !== "") return lead.message;
    const meta = lead.metadata || {};
    const msgKey = Object.keys(meta).find(
      (k) =>
        k.toLowerCase() === "message" ||
        k.toLowerCase().includes("inquiry") ||
        k.toLowerCase().includes("details")
    );
    return msgKey ? meta[msgKey] : "No Message Provided";
  };

  // Helper to prevent the smart fields from duplicating in the "Additional Details" block
  const getSmartKeysUsed = (lead: Lead) => {
    const meta = lead.metadata || {};
    const used = new Set<string>();
    Object.keys(meta).forEach((k) => {
      const lower = k.toLowerCase().trim();
      if (
        lower === "first" ||
        lower === "last" ||
        lower === "first name" ||
        lower === "last name"
      )
        used.add(k);
      if (lower.includes("name") && lead.name === "Anonymous") used.add(k);
      if (
        (lower.includes("email") || lower.includes("mail")) &&
        lead.email === "no-email@provided.com"
      )
        used.add(k);
      if (
        (lower.includes("phone") || lower.includes("tel")) &&
        (!lead.phone || lead.phone === "null")
      )
        used.add(k);
      if (
        lower === "message" ||
        lower.includes("inquiry") ||
        lower.includes("details")
      )
        used.add(k);
    });
    return used;
  };

  // --- ACTIONS ---
  const handleViewDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setIsSheetOpen(true);
  };

  const updateStatus = async (leadId: string, newStatus: string) => {
    const updater = (prev: Lead[]) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, status: newStatus as any } : l
      );
    setAllLeads(updater);
    if (selectedLead?.id === leadId)
      setSelectedLead({ ...selectedLead, status: newStatus as any });
    await supabase.from("leads").update({ status: newStatus }).eq("id", leadId);
  };

  const handleDelete = async (leadId: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    setAllLeads((prev) => prev.filter((l) => l.id !== leadId));
    if (selectedLead?.id === leadId) setIsSheetOpen(false);
    await supabase.from("leads").delete().eq("id", leadId);
  };

  // 🚀 CUSTOM TAG MANAGEMENT
  const getCustomTags = (lead: Lead): string[] => {
    if (!lead?.metadata?.custom_tags) return [];
    try {
      return JSON.parse(lead.metadata.custom_tags);
    } catch {
      return [];
    }
  };

  const addSpecificTag = async (newTag: string) => {
    if (!selectedLead) return;
    const currentTags = getCustomTags(selectedLead);
    const tagUpper = newTag.trim().toUpperCase();

    if (currentTags.includes(tagUpper)) return;

    const updatedTags = [...currentTags, tagUpper];
    const newMetadata = {
      ...selectedLead.metadata,
      custom_tags: JSON.stringify(updatedTags),
    };

    const updatedLead = { ...selectedLead, metadata: newMetadata };
    setSelectedLead(updatedLead);
    setAllLeads((prev) =>
      prev.map((l) => (l.id === selectedLead.id ? updatedLead : l))
    );
    setTagInput("");

    await supabase
      .from("leads")
      .update({ metadata: newMetadata })
      .eq("id", selectedLead.id);
  };

  const handleAddTag = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      await addSpecificTag(tagInput);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!selectedLead) return;
    const currentTags = getCustomTags(selectedLead);
    const updatedTags = currentTags.filter((t) => t !== tagToRemove);
    const newMetadata = {
      ...selectedLead.metadata,
      custom_tags: JSON.stringify(updatedTags),
    };

    const updatedLead = { ...selectedLead, metadata: newMetadata };
    setSelectedLead(updatedLead);
    setAllLeads((prev) =>
      prev.map((l) => (l.id === selectedLead.id ? updatedLead : l))
    );

    await supabase
      .from("leads")
      .update({ metadata: newMetadata })
      .eq("id", selectedLead.id);
  };

  const handleGlobalTagDelete = async (tagToDelete: string) => {
    if (
      !confirm(
        `Are you sure you want to completely delete "${tagToDelete}" from ALL leads?`
      )
    )
      return;

    const leadsWithTag = allLeads.filter((l) =>
      getCustomTags(l).includes(tagToDelete)
    );

    // Optimistic update
    const updatedLeads = allLeads.map((lead) => {
      const tags = getCustomTags(lead);
      if (tags.includes(tagToDelete)) {
        return {
          ...lead,
          metadata: {
            ...lead.metadata,
            custom_tags: JSON.stringify(tags.filter((t) => t !== tagToDelete)),
          },
        };
      }
      return lead;
    });

    setAllLeads(updatedLeads);
    if (selectedLead && getCustomTags(selectedLead).includes(tagToDelete)) {
      setSelectedLead({
        ...selectedLead,
        metadata: {
          ...selectedLead.metadata,
          custom_tags: JSON.stringify(
            getCustomTags(selectedLead).filter((t) => t !== tagToDelete)
          ),
        },
      });
    }

    // DB Update
    for (const lead of leadsWithTag) {
      const newTags = getCustomTags(lead).filter((t) => t !== tagToDelete);
      await supabase
        .from("leads")
        .update({
          metadata: { ...lead.metadata, custom_tags: JSON.stringify(newTags) },
        })
        .eq("id", lead.id);
    }
  };

  const getSiteName = (id?: string) =>
    sites.find((s) => s.id === id)?.site_name || "Portfolio";

  if (loading)
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );

  const usedKeys = selectedLead
    ? getSmartKeysUsed(selectedLead)
    : new Set<string>();
  const additionalDetails = Object.entries(selectedLead?.metadata || {}).filter(
    ([key]) =>
      key !== "Plan Name" &&
      key !== "Plan Price" &&
      key !== "custom_tags" &&
      !usedKeys.has(key)
  );

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-8xl mx-auto">
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Leads & Inquiries
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage messages and booking requests from your sites.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 rounded-xl border">
          <Filter size={16} className="text-muted-foreground ml-2" />

          <SiteFilter
            sites={sites}
            selectedSiteId={selectedSiteId}
            onChange={setSelectedSiteId}
          />

          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className="w-[140px] bg-background h-9 border-muted-foreground/20 text-xs font-medium">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="pricing">Pricing Forms</SelectItem>
              <SelectItem value="standard">Contact Forms</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[130px] bg-background h-9 border-muted-foreground/20 text-xs font-medium">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          {globalTags.length > 0 && (
            <Select
              value={selectedTagFilter}
              onValueChange={setSelectedTagFilter}
            >
              <SelectTrigger className="w-[130px] bg-background h-9 border-muted-foreground/20 text-xs font-medium">
                <SelectValue placeholder="Filter by Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {globalTags.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="outline"
            onClick={fetchData}
            size="sm"
            className="h-9 text-xs"
          >
            Refresh
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-muted/60 overflow-hidden">
        <CardContent className="p-0">
          {filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <div className="bg-muted p-4 rounded-full mb-3">
                <Mail className="w-8 h-8 opacity-50" />
              </div>
              <p>No matching messages found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead>Intent</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Tags & Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => {
                    const isPricing = lead.source === "pricing_form";
                    const customTags = getCustomTags(lead);

                    return (
                      <TableRow
                        key={lead.id}
                        className={cn(
                          "cursor-pointer transition-colors group",
                          isPricing
                            ? "bg-amber-500/5 hover:bg-amber-500/10"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => handleViewDetails(lead)}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {isPricing ? (
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-black font-bold gap-1 shadow-sm">
                              <Sparkles size={12} /> Pricing
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="font-normal text-muted-foreground"
                            >
                              Contact Form
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-foreground">
                            {getSmartName(lead)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getSmartEmail(lead)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium truncate max-w-[200px] text-foreground">
                            {lead.subject || "No Subject"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 items-center max-w-[200px]">
                            {lead.status === "new" && (
                              <Badge className="bg-blue-500 hover:bg-blue-600 shadow-sm text-[10px]">
                                New
                              </Badge>
                            )}
                            {lead.status === "contacted" && (
                              <Badge
                                variant="outline"
                                className="text-green-500 border-green-500/50 bg-green-500/10 text-[10px]"
                              >
                                Contacted
                              </Badge>
                            )}
                            {lead.status === "archived" && (
                              <Badge
                                variant="secondary"
                                className="opacity-50 text-[10px]"
                              >
                                Archived
                              </Badge>
                            )}

                            {customTags.slice(0, 2).map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-[9px] px-1.5 py-0 h-5 border-primary/30 text-primary bg-primary/5"
                              >
                                {tag}
                              </Badge>
                            ))}
                            {customTags.length > 2 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{customTags.length - 2}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`View ${getSmartName(lead)} inquiry`}
                            className="h-8 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:w-[540px] overflow-y-auto sm:max-w-md border-l p-0 flex flex-col">
          {selectedLead && (
            <>
              {/* SHEET HEADER */}
              <div className="p-6 border-b bg-muted/10">
                <SheetHeader className="space-y-3 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="secondary"
                      className="font-mono text-[10px]"
                    >
                      {new Date(selectedLead.created_at).toLocaleString()}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {getSiteName(selectedLead.portfolio_id)}
                    </Badge>
                  </div>
                  <SheetTitle className="text-2xl font-bold leading-tight">
                    {selectedLead.subject || "New Inquiry"}
                  </SheetTitle>
                </SheetHeader>
              </div>

              {/* SHEET BODY */}
              <div className="p-6 space-y-8 flex-grow">
                {/* 🚀 HIGH INTENT / PRICING BLOCK */}
                {selectedLead.source === "pricing_form" &&
                  selectedLead.metadata?.["Plan Name"] && (
                    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 p-5 rounded-xl space-y-2 relative overflow-hidden">
                      <Sparkles className="absolute -bottom-4 -right-4 w-24 h-24 text-amber-500/10 rotate-12" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-2 relative z-10">
                        <Sparkles size={14} /> Requested Service
                      </h3>
                      <div className="flex items-end justify-between relative z-10">
                        <span className="text-2xl font-black text-foreground">
                          {selectedLead.metadata["Plan Name"]}
                        </span>
                        <span className="text-lg font-mono font-bold text-amber-600">
                          {selectedLead.metadata["Plan Price"]}
                        </span>
                      </div>
                    </div>
                  )}

                {/* 1. SENDER INFO */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b pb-2">
                    <User size={14} /> Sender Details
                  </h3>
                  <div className="grid grid-cols-1 gap-3 pt-2">
                    <div className="bg-muted/30 p-3 rounded-lg border flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {getSmartName(selectedLead).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Name
                          </Label>
                          <div className="font-medium text-sm">
                            {getSmartName(selectedLead)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/30 p-3 rounded-lg border flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-full bg-muted flex shrink-0 items-center justify-center text-muted-foreground">
                          <Mail size={14} />
                        </div>
                        <div className="min-w-0">
                          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Email
                          </Label>
                          <div className="font-medium text-sm truncate">
                            {getSmartEmail(selectedLead)}
                          </div>
                        </div>
                      </div>
                      {getSmartEmail(selectedLead) !== "No Email Provided" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-2 h-8 shrink-0"
                          onClick={() =>
                            window.open(`mailto:${getSmartEmail(selectedLead)}`)
                          }
                        >
                          <Reply size={14} /> Reply
                        </Button>
                      )}
                    </div>

                    {getSmartPhone(selectedLead) && (
                      <div className="bg-muted/30 p-3 rounded-lg border flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                          <Phone size={14} />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Phone
                          </Label>
                          <div className="font-medium text-sm">
                            {getSmartPhone(selectedLead)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. DYNAMIC METADATA (Custom Form Fields) */}
                {additionalDetails.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b pb-2">
                      <ListPlus size={14} /> Additional Details
                    </h3>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {additionalDetails.map(([key, value], idx) => (
                        <div
                          key={idx}
                          className="bg-muted/20 p-3 rounded-lg border space-y-1 col-span-2 sm:col-span-1"
                        >
                          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            {key}
                          </Label>
                          <div className="font-medium text-sm break-words">
                            {value || "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. CORE MESSAGE */}
                {getSmartMessage(selectedLead) !== "No Message Provided" && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b pb-2">
                      <MessageSquare size={14} /> Message
                    </h3>
                    <div className="bg-muted/30 p-4 rounded-xl border min-h-[120px] whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {getSmartMessage(selectedLead)}
                    </div>
                  </div>
                )}

                {/* 🚀 4. CUSTOM TAGS SYSTEM */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b pb-2">
                    <TagIcon size={14} /> Custom Tags
                  </h3>

                  {/* Current Active Tags */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {getCustomTags(selectedLead).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="px-2 py-1 gap-1 text-[11px] bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-destructive transition-colors ml-1 rounded-full p-0.5 hover:bg-primary/10"
                        >
                          <X size={10} />
                        </button>
                      </Badge>
                    ))}
                  </div>

                  {/* Add Tag Input */}
                  <div className="pt-2 space-y-4">
                    <Input
                      placeholder="Type a new tag & press Enter..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      className="h-9 text-sm bg-muted/30 border-dashed border-muted-foreground/30 focus-visible:border-primary"
                    />

                    {/* Suggested Global Tags */}
                    {globalTags.filter(
                      (t) => !getCustomTags(selectedLead!).includes(t)
                    ).length > 0 && (
                      <div className="space-y-2 pt-3 border-t border-muted-foreground/10">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Suggested Tags
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                          {globalTags
                            .filter(
                              (t) => !getCustomTags(selectedLead!).includes(t)
                            )
                            .map((tag) => (
                              <div
                                key={tag}
                                className="group flex items-center bg-muted/30 rounded-md border border-muted-foreground/20 hover:border-primary/50 transition-colors"
                              >
                                <button
                                  onClick={() => addSpecificTag(tag)}
                                  className="text-[10px] px-2 py-1 text-muted-foreground hover:text-primary transition-colors"
                                >
                                  + {tag}
                                </button>
                                <button
                                  onClick={() => handleGlobalTagDelete(tag)}
                                  className="pr-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                                  title="Permanently delete from all leads"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SHEET FOOTER - STICKY ACTIONS */}
              <div className="p-6 border-t bg-muted/10 mt-auto flex items-center gap-3">
                <div className="flex-grow">
                  <Select
                    value={selectedLead.status}
                    onValueChange={(val) => updateStatus(selectedLead.id, val)}
                  >
                    <SelectTrigger className="bg-background h-10 font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">🔵 Mark as New</SelectItem>
                      <SelectItem value="contacted">
                        🟢 Mark as Contacted
                      </SelectItem>
                      <SelectItem value="archived">⚪ Archive Lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  className="text-destructive border-destructive/20 hover:bg-destructive hover:text-destructive-foreground h-10 w-10 shrink-0"
                  onClick={() => handleDelete(selectedLead.id)}
                  title="Delete Lead"
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default LeadsPage;
