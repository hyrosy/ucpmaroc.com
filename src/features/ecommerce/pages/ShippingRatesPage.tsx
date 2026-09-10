import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Truck, Edit, Trash2, ArrowLeft, Copy, ChevronDown, ChevronUp, Globe } from "lucide-react";
import SiteFilter from "@/components/dashboard/SiteFilter";
import { SHIPPING_REGIONS, ALL_COUNTRIES_LIST } from "@/lib/countries";


export default function ShippingRatesPage() {
  const { actorData, selectedSiteId, setSelectedSiteId } = useOutletContext<ActorDashboardContextType>();
  const actorId = actorData?.id;

  const [rates, setRates] = useState<any[]>([]);
  const [portfolios, setPortfolios] = useState<{ id: string; public_slug: string; site_name?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [view, setView] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [destinationType, setDestinationType] = useState<"all" | "specific">("all");
  const [expandedRegions, setExpandedRegions] = useState<string[]>([]);

  const fetchRates = useCallback(async () => {
    if (!actorId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("pro_shipping_rates")
      .select("*")
      .eq("actor_id", actorId)
      .order("created_at", { ascending: false });

    if (!error && data) setRates(data);
    setIsLoading(false);
  }, [actorId]);

  useEffect(() => {
    fetchRates();
    if (actorId) {
      supabase
        .from("portfolios")
        .select("id, public_slug, site_name, theme_config")
        .eq("actor_id", actorId)
        .then(({ data }) => {
          if (data) setPortfolios(data);
        });
    }
  }, [fetchRates, actorId]);

  const initForm = (rate?: any) => {
    setEditingId(rate?.id || null);
    setFormData({
      name: rate?.name || "",
      type: rate?.type || "flat",
      rate_dollars: rate ? (rate.rate_cents / 100).toFixed(2) : "",
      min_order_amount_dollars: rate?.min_order_amount_cents ? (rate.min_order_amount_cents / 100).toFixed(2) : "",
      min_weight: rate?.min_weight || "",
      max_weight: rate?.max_weight || "",
      portfolio_id: rate?.portfolio_id || "",
      countries: rate?.countries || [],
    });
    setDestinationType(rate?.countries && rate.countries.length > 0 ? "specific" : "all");
    setView("form");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this shipping rate?")) return;
    const { error } = await supabase.from("pro_shipping_rates").delete().eq("id", id);
    if (!error) fetchRates();
  };

  const handleSave = async () => {
    if (!formData.name) return alert("Name is required.");
    setIsSaving(true);

    const payload = {
      actor_id: actorId,
      portfolio_id: formData.portfolio_id || null,
      name: formData.name,
      type: formData.type || "flat",
      rate_cents: Math.round(parseFloat(formData.rate_dollars || 0) * 100),
      min_order_amount_cents: formData.min_order_amount_dollars ? Math.round(parseFloat(formData.min_order_amount_dollars) * 100) : null,
      min_weight: parseFloat(formData.min_weight) || null,
      max_weight: parseFloat(formData.max_weight) || null,
      countries: destinationType === "specific" ? (formData.countries || []) : [],
    };

    let error;
    if (editingId) {
      const { error: updateErr } = await supabase.from("pro_shipping_rates").update(payload).eq("id", editingId);
      error = updateErr;
    } else {
      const { error: insertErr } = await supabase.from("pro_shipping_rates").insert([payload]);
      error = insertErr;
    }

    if (error) {
      alert("Failed to save shipping rate: " + error.message);
    } else {
      setView("list");
      fetchRates();
    }
    setIsSaving(false);
  };

  const handleDuplicate = async (rate: any) => {
    const payload = {
      ...rate,
      id: undefined,
      created_at: undefined,
      updated_at: undefined,
      name: `${rate.name} (Copy)`
    };
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
    const { error } = await supabase.from("pro_shipping_rates").insert([payload]);
    if (error) {
      alert("Failed to duplicate shipping rate: " + error.message);
    } else {
      fetchRates();
    }
  };

  const handleCountryToggle = (country: string, checked: boolean) => {
    const current = formData.countries || [];
    if (checked) {
      setFormData({ ...formData, countries: [...current, country] });
    } else {
      setFormData({ ...formData, countries: current.filter((c: string) => c !== country) });
    }
  };

  const toggleRegionExpansion = (code: string) => {
    setExpandedRegions(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const handleRegionToggle = (region: any, checked: boolean) => {
    let current = [...(formData.countries || [])];
    if (checked) {
       region.countries.forEach((c: string) => {
         if (!current.includes(c)) current.push(c);
       });
    } else {
       current = current.filter(c => !region.countries.includes(c));
    }
    setFormData({ ...formData, countries: current });
  };

  const formatCountries = (countries?: string[]) => {
    if (!countries || countries.length === 0) return "Global (Rest of World)";
    
    const regionsCovered = SHIPPING_REGIONS.filter(r => r.countries.every(c => countries.includes(c)));
    if (regionsCovered.length > 0) {
      let display = `All ${regionsCovered.map(r => r.code).join(", ")}`;
      const coveredCountries = regionsCovered.flatMap(r => r.countries);
      const loose = countries.filter(c => !coveredCountries.includes(c));
      if (loose.length > 0) display += ` + ${loose.length} more`;
      return display;
    }
    
    if (countries.length <= 2) return countries.join(", ");
    return `${countries[0]}, ${countries[1]} +${countries.length - 2} more`;
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipping Rates</h1>
          <p className="text-muted-foreground mt-1">Configure Flat Rate, Weight-based, or Free Shipping thresholds.</p>
        </div>
        {view === "list" && (
          <div className="flex items-center gap-3 flex-wrap">
            <SiteFilter
              sites={portfolios.map(p => ({ id: p.id, site_name: p.site_name || p.public_slug }))}
              selectedSiteId={selectedSiteId}
              onChange={setSelectedSiteId}
            />
            <Button variant="outline" asChild className="shadow-sm">
              <Link to="/dashboard/markets">
                <Globe className="w-4 h-4 mr-2" /> Manage Markets
              </Link>
            </Button>
            <Button onClick={() => initForm()} className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Add Rate
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : view === "form" ? (
        <div className="animate-in fade-in duration-300 max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" onClick={() => setView("list")} className="-ml-4 text-muted-foreground"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Rate</Button>
          </div>

          <Card className="shadow-sm">
            <CardHeader><CardTitle>Rate Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Store / Website</Label>
                <select className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:ring-2" value={formData.portfolio_id || ""} onChange={(e) => setFormData({ ...formData, portfolio_id: e.target.value })}>
                  <option value="">Global (All Sites)</option>
                  {portfolios.map((p) => <option key={p.id} value={p.id}>{p.site_name || p.public_slug}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Rate Name <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. Standard Shipping" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Calculation Type</Label>
                <select className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:ring-2" value={formData.type || "flat"} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                  <option value="flat">Flat Rate</option>
                  <option value="weight">Weight Based</option>
                  <option value="free_over">Free Shipping over X Amount</option>
                </select>
              </div>
              
              {formData.type !== 'free_over' && (
                <div className="space-y-2 animate-in fade-in">
                  <Label>Shipping Cost ($)</Label>
                  <Input type="number" step="0.01" placeholder="e.g. 5.99" value={formData.rate_dollars} onChange={(e) => setFormData({ ...formData, rate_dollars: e.target.value })} />
                </div>
              )}

              {formData.type === 'free_over' && (
                <div className="space-y-2 animate-in fade-in bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                  <Label className="text-green-700">Minimum Order Amount ($) to qualify for Free Shipping</Label>
                  <Input type="number" step="0.01" placeholder="e.g. 50.00" value={formData.min_order_amount_dollars} onChange={(e) => setFormData({ ...formData, min_order_amount_dollars: e.target.value })} />
                </div>
              )}

              {formData.type === 'weight' && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in bg-muted/30 p-3 rounded-lg border border-border">
                  <div className="space-y-2">
                    <Label>Min Weight (kg)</Label>
                    <Input type="number" step="0.1" value={formData.min_weight} onChange={(e) => setFormData({ ...formData, min_weight: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Weight (kg)</Label>
                    <Input type="number" step="0.1" value={formData.max_weight} onChange={(e) => setFormData({ ...formData, max_weight: e.target.value })} />
                  </div>
                </div>
              )}

              <div className="space-y-4 pt-4 border-t">
                <Label className="text-base font-semibold">Shipping Destination</Label>
                <RadioGroup value={destinationType} onValueChange={(v: "all" | "specific") => setDestinationType(v)} className="flex flex-col gap-3">
                  <Label htmlFor="dest-all" className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${destinationType === "all" ? "bg-primary/5 border-primary" : "hover:bg-muted"}`}>
                    <RadioGroupItem value="all" id="dest-all" />
                    <div>
                      <div className="font-semibold">Global (Rest of World)</div>
                      <div className="text-xs text-muted-foreground font-normal">This rate applies to all countries (or any country not covered by a specific rate).</div>
                    </div>
                  </Label>
                  <Label htmlFor="dest-specific" className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${destinationType === "specific" ? "bg-primary/5 border-primary" : "hover:bg-muted"}`}>
                    <RadioGroupItem value="specific" id="dest-specific" />
                    <div>
                      <div className="font-semibold">Specific Countries</div>
                      <div className="text-xs text-muted-foreground font-normal">This rate only applies to selected destinations.</div>
                    </div>
                  </Label>
                </RadioGroup>

                {destinationType === "specific" && (
                  <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                    {(() => {
                      const activeSite = portfolios.find((p) => p.id === formData.portfolio_id);
                      const siteAllowedCountries = activeSite?.theme_config?.allowedCountries || ALL_COUNTRIES_LIST;
                      const filteredRegions = SHIPPING_REGIONS.map(region => ({
                        ...region,
                        countries: region.countries.filter(c => siteAllowedCountries.includes(c))
                      })).filter(r => r.countries.length > 0);

                      return filteredRegions.map((region) => {
                      const isExpanded = expandedRegions.includes(region.code);
                      const visibleCountries = isExpanded ? region.countries : region.countries.slice(0, 10);
                      const isAllSelected = region.countries.every(c => (formData.countries || []).includes(c));

                      return (
                        <div key={region.code} className="p-3 border rounded-lg bg-muted/20">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                              <Checkbox id={`region-${region.code}`} checked={isAllSelected} onCheckedChange={(c) => handleRegionToggle(region, c as boolean)}/>
                              <Label htmlFor={`region-${region.code}`} className="font-bold text-sm cursor-pointer">{region.name}</Label>
                            </div>
                            {region.countries.length > 10 && (
                              <Button type="button" variant="ghost" size="sm" onClick={() => toggleRegionExpansion(region.code)} className="h-6 text-xs text-muted-foreground">
                                {isExpanded ? <><ChevronUp className="w-3 h-3 mr-1"/> Show Less</> : <><ChevronDown className="w-3 h-3 mr-1"/> Show All ({region.countries.length})</>}
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                            {visibleCountries.map((country: string) => (
                              <div key={country} className="flex items-center space-x-2">
                                <Checkbox id={`country-${country}`} checked={(formData.countries || []).includes(country)} onCheckedChange={(c) => handleCountryToggle(country, c as boolean)}/>
                                <label htmlFor={`country-${country}`} className="text-xs font-medium leading-none cursor-pointer truncate" title={country}>{country}</label>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })})()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : rates.length === 0 ? (
        <div className="text-center py-24 border border-dashed rounded-xl bg-muted/10">
          <Truck className="w-8 h-8 text-primary mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">No Shipping Rates</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Create rules for how much customers are charged for shipping at checkout.</p>
          <Button onClick={() => initForm()}><Plus className="w-4 h-4 mr-2" /> Add Rate</Button>
        </div>
      ) : (
        <Card className="rounded-xl shadow-sm border-border overflow-hidden animate-in fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Destinations</th>
                  <th className="px-6 py-4 font-medium">Store</th>
                  <th className="px-6 py-4 font-medium">Condition</th>
                  <th className="px-6 py-4 font-medium">Rate</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rates.filter((r) => selectedSiteId === "all" || r.portfolio_id === selectedSiteId).map((rate) => {
                  const port = portfolios.find(p => p.id === rate.portfolio_id);
                  return (
                  <tr key={rate.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 font-bold">{rate.name}</td>
                    <td className="px-6 py-4 text-sm">{formatCountries(rate.countries)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{port?.site_name || "Global"}</td>
                    <td className="px-6 py-4">
                      {rate.type === 'flat' && "Flat Rate"}
                      {rate.type === 'free_over' && `Orders > $${(rate.min_order_amount_cents / 100).toFixed(2)}`}
                      {rate.type === 'weight' && `${rate.min_weight || 0}kg - ${rate.max_weight || '∞'}kg`}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-primary">
                      {rate.type === 'free_over' ? "Free" : `$${(rate.rate_cents / 100).toFixed(2)}`}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" aria-label={`Duplicate ${rate.name}`} onClick={() => handleDuplicate(rate)} title="Duplicate"><Copy className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" aria-label={`Edit ${rate.name}`} onClick={() => initForm(rate)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" aria-label={`Delete ${rate.name}`} className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(rate.id)}><Trash2 className="w-4 h-4" /></Button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}