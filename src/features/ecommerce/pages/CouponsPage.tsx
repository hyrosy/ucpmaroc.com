import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Tag, Edit, Trash2, ArrowLeft, Calendar, Clock, Package, Layers, Type, Copy } from "lucide-react";
import SiteFilter from "@/components/dashboard/SiteFilter";

export default function CouponsPage() {
  const { actorData, selectedSiteId, setSelectedSiteId } = useOutletContext<ActorDashboardContextType>();
  const actorId = actorData?.id;

  const [coupons, setCoupons] = useState<any[]>([]);
  const [portfolios, setPortfolios] = useState<{ id: string; public_slug: string; site_name?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Advanced Targeting Data
  const [products, setProducts] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [productTypes, setProductTypes] = useState<string[]>([]);

  const [view, setView] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  const fetchCoupons = useCallback(async () => {
    if (!actorId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("pro_coupons")
      .select("*")
      .eq("actor_id", actorId)
      .order("created_at", { ascending: false });

    if (!error && data) setCoupons(data);
    setIsLoading(false);
  }, [actorId]);

  useEffect(() => {
    fetchCoupons();
    if (actorId) {
      supabase
        .from("portfolios")
        .select("id, public_slug, site_name")
        .eq("actor_id", actorId)
        .then(({ data }) => {
          if (data) setPortfolios(data);
        });
        
      // Fetch targeting dependencies
      Promise.all([
        supabase.from("pro_products").select("id, title, product_type, portfolio_id").eq("actor_id", actorId),
        supabase.from("pro_collections").select("id, title, portfolio_id").eq("actor_id", actorId)
      ]).then(([prodRes, colRes]) => {
        if (prodRes.data) {
          setProducts(prodRes.data);
          const types = Array.from(new Set(prodRes.data.map(p => p.product_type).filter(Boolean)));
          setProductTypes(types as string[]);
        }
        if (colRes.data) setCollections(colRes.data);
      });
    }
  }, [fetchCoupons, actorId]);

  const initForm = (coupon?: any) => {
    setEditingId(coupon?.id || null);
    setFormData({
      code: coupon?.code || "",
      type: coupon?.type || "percentage",
      value_input: coupon?.type === "fixed" ? (coupon.value_amount / 100).toFixed(2) : coupon?.value_amount || "",
      min_order_amount_dollars: coupon?.min_order_amount_cents ? (coupon.min_order_amount_cents / 100).toFixed(2) : "",
      usage_limit: coupon?.usage_limit || "",
      is_active: coupon?.is_active ?? true,
      portfolio_id: coupon?.portfolio_id || "",
      start_date: coupon?.start_date ? new Date(coupon.start_date).toISOString().slice(0, 16) : "",
      end_date: coupon?.end_date ? new Date(coupon.end_date).toISOString().slice(0, 16) : "",
      applies_to: coupon?.applies_to || "all",
      target_ids: coupon?.target_ids || [],
    });
    setView("form");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this coupon?")) return;
    const { error } = await supabase.from("pro_coupons").delete().eq("id", id);
    if (!error) fetchCoupons();
  };

  const handleSave = async () => {
    if (!formData.code) return alert("Code is required.");
    setIsSaving(true);

    const payload = {
      actor_id: actorId,
      portfolio_id: formData.portfolio_id || null,
      code: formData.code.toUpperCase().replace(/\s+/g, ""),
      type: formData.type || "percentage",
      value_amount: formData.type === "fixed" ? Math.round(parseFloat(formData.value_input || 0) * 100) : parseFloat(formData.value_input || 0),
      min_order_amount_cents: formData.min_order_amount_dollars ? Math.round(parseFloat(formData.min_order_amount_dollars) * 100) : null,
      usage_limit: parseInt(formData.usage_limit) || null,
      is_active: formData.is_active ?? true,
      start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
      end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
      applies_to: formData.applies_to || "all",
      target_ids: formData.applies_to === "all" ? [] : (formData.target_ids || []),
    };

    let error;
    if (editingId) {
      const { error: updateErr } = await supabase.from("pro_coupons").update(payload).eq("id", editingId);
      error = updateErr;
    } else {
      const { error: insertErr } = await supabase.from("pro_coupons").insert([payload]);
      error = insertErr;
    }

    if (error) {
      alert(error.code === '23505' ? "This coupon code already exists." : "Failed to save coupon: " + error.message);
    } else {
      setView("list");
      fetchCoupons();
    }
    setIsSaving(false);
  };

  const handleDuplicate = async (coupon: any) => {
    const payload = {
      ...coupon,
      id: undefined,
      created_at: undefined,
      updated_at: undefined,
      times_used: 0,
      code: `${coupon.code}_COPY_${Math.floor(Math.random() * 1000)}`
    };
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
    const { error } = await supabase.from("pro_coupons").insert([payload]);
    if (error) {
      alert("Failed to duplicate coupon: " + error.message);
    } else {
      fetchCoupons();
    }
  };

  const handleTargetToggle = (id: string, checked: boolean) => {
    const current = formData.target_ids || [];
    if (checked) {
      setFormData({ ...formData, target_ids: [...current, id] });
    } else {
      setFormData({ ...formData, target_ids: current.filter((t: string) => t !== id) });
    }
  };

  const filteredProducts = products.filter(p => !formData.portfolio_id || p.portfolio_id === formData.portfolio_id || !p.portfolio_id);
  const filteredProductTypes = Array.from(new Set(filteredProducts.map(p => p.product_type).filter(Boolean))) as string[];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Coupons & Promos</h1>
          <p className="text-muted-foreground mt-1">Create discount codes for your customers.</p>
        </div>
        {view === "list" && (
          <div className="flex items-center gap-3 flex-wrap">
            <SiteFilter
              sites={portfolios.map(p => ({ id: p.id, site_name: p.site_name || p.public_slug }))}
              selectedSiteId={selectedSiteId}
              onChange={setSelectedSiteId}
            />
            <Button onClick={() => initForm()} className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Create Coupon
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : view === "form" ? (
        <div className="animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" onClick={() => setView("list")} className="-ml-4 text-muted-foreground"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setView("list")} disabled={isSaving}>Discard</Button>
              <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Coupon</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
            {/* LEFT COLUMN: Main Details */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Coupon Details</CardTitle>
                    <div className="flex items-center gap-2">
                      <Label>Active</Label>
                      <Switch checked={formData.is_active} onCheckedChange={(c) => setFormData({ ...formData, is_active: c })} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Store / Website</Label>
                    <select className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:ring-2" value={formData.portfolio_id || ""} onChange={(e) => setFormData({ ...formData, portfolio_id: e.target.value })}>
                      <option value="">Global (All Sites)</option>
                      {portfolios.map((p) => <option key={p.id} value={p.id}>{p.site_name || p.public_slug}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Discount Code <span className="text-destructive">*</span></Label>
                    <Input placeholder="e.g. SUMMER20" className="uppercase font-mono font-bold" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '') })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Discount Type</Label>
                    <select className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:ring-2" value={formData.type || "percentage"} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount ($)</option>
                      <option value="free_shipping">Free Shipping</option>
                    </select>
                  </div>
                  
                  {formData.type !== 'free_shipping' && (
                    <div className="space-y-2 animate-in fade-in">
                      <Label>Discount Value ({formData.type === 'percentage' ? '%' : '$'})</Label>
                      <Input type="number" step={formData.type === 'percentage' ? "1" : "0.01"} placeholder={formData.type === 'percentage' ? "20" : "15.00"} value={formData.value_input} onChange={(e) => setFormData({ ...formData, value_input: e.target.value })} />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>Minimum Order Amount ($)</Label>
                      <Input type="number" step="0.01" placeholder="Optional" value={formData.min_order_amount_dollars} onChange={(e) => setFormData({ ...formData, min_order_amount_dollars: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Total Usage Limit (Across all users)</Label>
                      <Input type="number" placeholder="Optional" value={formData.usage_limit} onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })} />
                      <p className="text-[10px] text-muted-foreground leading-tight">Maximum number of times this code can be used in total.</p>
                    </div>
                  </div>
                  
                  {/* ACTIVE DATES */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5"><Calendar size={14} className="text-muted-foreground"/> Start Date</Label>
                      <Input type="datetime-local" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5"><Clock size={14} className="text-muted-foreground"/> End Date</Label>
                      <Input type="datetime-local" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN: Applies To */}
            <div className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Applies To</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.type === 'free_shipping' ? (
                    <p className="text-sm text-muted-foreground">Free shipping applies to the entire order.</p>
                  ) : (
                    <>
                      <RadioGroup 
                        value={formData.applies_to || "all"} 
                        onValueChange={(v) => setFormData({ ...formData, applies_to: v, target_ids: [] })}
                        className="flex flex-col gap-3"
                      >
                        <Label htmlFor="applies-all" className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${formData.applies_to === "all" || !formData.applies_to ? "bg-primary/5 border-primary" : "hover:bg-muted"}`}>
                          <RadioGroupItem value="all" id="applies-all" className="sr-only"/>
                          <div className="w-full text-center font-medium text-sm">All Products</div>
                        </Label>
                        <Label htmlFor="applies-products" className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${formData.applies_to === "products" ? "bg-primary/5 border-primary" : "hover:bg-muted"}`}>
                          <RadioGroupItem value="products" id="applies-products" className="sr-only"/>
                          <div className="w-full text-center font-medium text-sm flex items-center justify-center gap-2"><Package size={14}/> Specific Products</div>
                        </Label>
                        <Label htmlFor="applies-collections" className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${formData.applies_to === "collections" ? "bg-primary/5 border-primary" : "hover:bg-muted"}`}>
                          <RadioGroupItem value="collections" id="applies-collections" className="sr-only"/>
                          <div className="w-full text-center font-medium text-sm flex items-center justify-center gap-2"><Layers size={14}/> Specific Collections</div>
                        </Label>
                        <Label htmlFor="applies-types" className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${formData.applies_to === "types" ? "bg-primary/5 border-primary" : "hover:bg-muted"}`}>
                          <RadioGroupItem value="types" id="applies-types" className="sr-only"/>
                          <div className="w-full text-center font-medium text-sm flex items-center justify-center gap-2"><Type size={14}/> Product Tags</div>
                        </Label>
                      </RadioGroup>

                      {formData.applies_to && formData.applies_to !== "all" && (
                        <div className="flex flex-col gap-3 p-4 bg-muted/30 border rounded-lg animate-in fade-in slide-in-from-top-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                          {formData.applies_to === "products" && filteredProducts.map((item) => (
                        <div key={item.id} className="flex items-center space-x-2">
                          <Checkbox id={`target-${item.id}`} checked={(formData.target_ids || []).includes(item.id)} onCheckedChange={(c) => handleTargetToggle(item.id, c as boolean)}/>
                          <label htmlFor={`target-${item.id}`} className="text-sm font-medium leading-none cursor-pointer truncate">{item.title}</label>
                        </div>
                      ))}
                      {formData.applies_to === "collections" && collections.filter(c => !formData.portfolio_id || c.portfolio_id === formData.portfolio_id || !c.portfolio_id).map((item) => (
                        <div key={item.id} className="flex items-center space-x-2">
                          <Checkbox id={`target-${item.id}`} checked={(formData.target_ids || []).includes(item.id)} onCheckedChange={(c) => handleTargetToggle(item.id, c as boolean)}/>
                          <label htmlFor={`target-${item.id}`} className="text-sm font-medium leading-none cursor-pointer truncate">{item.title}</label>
                        </div>
                      ))}
                          {formData.applies_to === "types" && filteredProductTypes.map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox id={`target-${type}`} checked={(formData.target_ids || []).includes(type)} onCheckedChange={(c) => handleTargetToggle(type, c as boolean)}/>
                          <label htmlFor={`target-${type}`} className="text-sm font-medium leading-none cursor-pointer truncate capitalize">{type}</label>
                        </div>
                      ))}
                      
                          {((formData.applies_to === "products" && filteredProducts.length === 0) || 
                        (formData.applies_to === "collections" && collections.length === 0) || 
                            (formData.applies_to === "types" && filteredProductTypes.length === 0)) && (
                              <div className="text-center py-4 text-sm text-muted-foreground">No items available to select.</div>
                        )}
                    </div>
                  )}
                    </>
              )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-24 border border-dashed rounded-xl bg-muted/10">
          <Tag className="w-8 h-8 text-primary mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">No Coupons Created</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Boost your sales by offering percentage or fixed discounts to your customers.</p>
          <Button onClick={() => initForm()}><Plus className="w-4 h-4 mr-2" /> Create Coupon</Button>
        </div>
      ) : (
        <Card className="rounded-xl shadow-sm border-border overflow-hidden animate-in fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Code</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Store</th>
                  <th className="px-6 py-4 font-medium">Discount</th>
                  <th className="px-6 py-4 font-medium">Applies To</th>
                  <th className="px-6 py-4 font-medium">Valid Until</th>
                  <th className="px-6 py-4 font-medium">Usage</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {coupons.filter((c) => selectedSiteId === "all" || c.portfolio_id === selectedSiteId).map((coupon) => {
                  const port = portfolios.find(p => p.id === coupon.portfolio_id);
                  return (
                  <tr key={coupon.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 font-mono font-bold">{coupon.code}</td>
                    <td className="px-6 py-4">
                      <Badge variant={coupon.is_active ? "default" : "secondary"} className={coupon.is_active ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" : ""}>
                        {coupon.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{port?.site_name || "Global"}</td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      {coupon.type === 'percentage' && `${coupon.value_amount}% Off`}
                      {coupon.type === 'fixed' && `$${(coupon.value_amount / 100).toFixed(2)} Off`}
                      {coupon.type === 'free_shipping' && `Free Shipping`}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs font-medium">
                      {coupon.type === 'free_shipping' ? "Entire Order" : 
                        coupon.applies_to === 'all' || !coupon.applies_to ? "All Products" :
                        coupon.applies_to === 'products' ? `${coupon.target_ids?.length || 0} Products` :
                        coupon.applies_to === 'collections' ? `${coupon.target_ids?.length || 0} Collections` :
                        `${coupon.target_ids?.length || 0} Tags`
                      }
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs font-medium">
                      {coupon.end_date ? new Date(coupon.end_date).toLocaleDateString() : "No Expiry"}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {coupon.times_used} {coupon.usage_limit ? `/ ${coupon.usage_limit}` : 'uses'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" aria-label={`Duplicate ${coupon.code}`} onClick={() => handleDuplicate(coupon)} title="Duplicate"><Copy className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" aria-label={`Edit ${coupon.code}`} onClick={() => initForm(coupon)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" aria-label={`Delete ${coupon.code}`} className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(coupon.id)}><Trash2 className="w-4 h-4" /></Button>
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