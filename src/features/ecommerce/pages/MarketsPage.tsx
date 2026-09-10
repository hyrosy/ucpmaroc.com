import React, { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";
import { useOutletContext } from "react-router-dom";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Globe, ChevronDown, ChevronUp, Save, Map } from "lucide-react";
import { SHIPPING_REGIONS, ALL_COUNTRIES_LIST } from "@/lib/countries";
import { cn } from "@/lib/utils";

export default function MarketsPage() {
  const { actorData, selectedSiteId, setSelectedSiteId } = useOutletContext<ActorDashboardContextType>();
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState<string[]>([]);
  const [allowedCountries, setAllowedCountries] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const fetchSites = async () => {
      if (!actorData.id) return;
      const { data } = await supabase.from("portfolios").select("*").eq("actor_id", actorData.id);
      if (data && data.length > 0) {
        setPortfolios(data);
        
        let targetSiteId = selectedSiteId;
        if (!targetSiteId || targetSiteId === "all" || !data.some(p => p.id === targetSiteId)) {
           targetSiteId = data[0].id;
           setSelectedSiteId(targetSiteId);
        }
        const site = data.find(p => p.id === targetSiteId) || data[0];
        setAllowedCountries(site.theme_config?.allowedCountries || ALL_COUNTRIES_LIST);
      }
      setIsLoading(false);
    };
    fetchSites();
  }, [actorData.id]); // Intentional: Only run on mount

  const handleSiteChange = (siteId: string) => {
    setSelectedSiteId(siteId);
    const site = portfolios.find((p) => p.id === siteId);
    setAllowedCountries(site?.theme_config?.allowedCountries || ALL_COUNTRIES_LIST);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    const site = portfolios.find((p) => p.id === selectedSiteId);
    const newConfig = { ...site.theme_config, allowedCountries };

    const { error } = await supabase.from("portfolios").update({ theme_config: newConfig }).eq("id", selectedSiteId);
    if (error) {
      setSaveStatus({ type: "error", message: "Failed to save markets: " + error.message });
    } else {
      setSaveStatus({ type: "success", message: "Markets updated successfully!" });
      setPortfolios((prev) => prev.map((p) => (p.id === selectedSiteId ? { ...p, theme_config: newConfig } : p)));
    }
    setIsSaving(false);
  };

  const handleCountryToggle = (country: string, checked: boolean) => {
    if (checked) setAllowedCountries([...allowedCountries, country]);
    else setAllowedCountries(allowedCountries.filter((c) => c !== country));
  };

  const handleRegionToggle = (region: any, checked: boolean) => {
    let current = [...allowedCountries];
    if (checked) {
      region.countries.forEach((c: string) => { if (!current.includes(c)) current.push(c); });
    } else {
      current = current.filter((c) => !region.countries.includes(c));
    }
    setAllowedCountries(current);
  };

  const toggleRegionExpansion = (code: string) => {
    setExpandedRegions((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
  };

  if (isLoading) return <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Markets</h1>
          <p className="text-muted-foreground mt-1">Configure which countries your store sells and ships to.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="shadow-sm">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Markets
        </Button>
      </div>

      {saveStatus && (
        <div
          role="status"
          className={cn(
            "rounded-xl border px-4 py-3 text-sm font-medium",
            saveStatus.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {saveStatus.message}
        </div>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Map size={20} className="text-primary"/> Selling Regions</CardTitle>
          <CardDescription>Select the specific countries that will be available during checkout.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 max-w-sm">
            <Label>Select Website</Label>
            <select className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:ring-2" value={selectedSiteId === "all" ? "" : selectedSiteId} onChange={(e) => handleSiteChange(e.target.value)}>
              {portfolios.map((p) => <option key={p.id} value={p.id}>{p.site_name || p.public_slug}</option>)}
            </select>
          </div>

          <div className="space-y-4 pt-2">
            {SHIPPING_REGIONS.map((region) => {
              const isExpanded = expandedRegions.includes(region.code);
              const visibleCountries = isExpanded ? region.countries : region.countries.slice(0, 10);
              const isAllSelected = region.countries.every((c) => allowedCountries.includes(c));

              return (
                <div key={region.code} className="p-3 border rounded-lg bg-muted/20">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <Checkbox id={`region-${region.code}`} checked={isAllSelected} onCheckedChange={(c) => handleRegionToggle(region, c as boolean)} />
                      <Label htmlFor={`region-${region.code}`} className="font-bold text-sm cursor-pointer">{region.name}</Label>
                    </div>
                    {region.countries.length > 10 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => toggleRegionExpansion(region.code)} className="h-6 text-xs text-muted-foreground">
                        {isExpanded ? <><ChevronUp className="w-3 h-3 mr-1" /> Show Less</> : <><ChevronDown className="w-3 h-3 mr-1" /> Show All ({region.countries.length})</>}
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pl-6">
                    {visibleCountries.map((country: string) => (
                      <div key={country} className="flex items-center space-x-2">
                        <Checkbox id={`country-${country}`} checked={allowedCountries.includes(country)} onCheckedChange={(c) => handleCountryToggle(country, c as boolean)} />
                        <label htmlFor={`country-${country}`} className="text-xs font-medium leading-none cursor-pointer truncate" title={country}>{country}</label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
