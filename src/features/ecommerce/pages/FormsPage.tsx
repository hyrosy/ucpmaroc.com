import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout"; "@/features/talent-marketplace";
import { FormManager } from "@/features/portfolio-builder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Settings, Plus, Edit, Trash2, Copy, ShoppingCart, MessageSquare, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/supabaseClient";
import SiteFilter from "@/components/dashboard/SiteFilter";

export default function FormsPage() {
  const { actorData, selectedSiteId, setSelectedSiteId } = useOutletContext<ActorDashboardContextType>();
  const [isFormManagerOpen, setIsFormManagerOpen] = useState(false);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [portfoliosLoaded, setPortfoliosLoaded] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [formToEdit, setFormToEdit] = useState<any | null>(null);

  const fetchForms = useCallback(async () => {
    if (!actorData?.id || !portfoliosLoaded) return;
    setIsLoading(true);

    if (portfolios.length === 0) {
      setForms([]);
      setIsLoading(false);
      return;
    }

    let query = supabase
      .from("forms")
      .select("*")
      .order("created_at", { ascending: false });

    if (selectedSiteId !== "all") {
      query = query.eq("portfolio_id", selectedSiteId);
    } else {
      query = query.in("portfolio_id", portfolios.map((p) => p.id));
    }

    if (selectedType !== "all") {
      query = query.eq("type", selectedType);
    }

    const { data, error } = await query;
    if (!error && data) setForms(data);
    setIsLoading(false);
  }, [actorData?.id, selectedSiteId, portfolios, portfoliosLoaded, selectedType]);

  useEffect(() => {
    if (actorData?.id) {
      supabase.from("portfolios").select("id, site_name, public_slug").eq("actor_id", actorData.id)
        .then(({ data }) => {
          if (data) setPortfolios(data);
          setPortfoliosLoaded(true);
        });
    }
  }, [actorData?.id]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this form? Sections using it will fallback to a default configuration.")) return;
    await supabase.from("forms").delete().eq("id", id);
    fetchForms();
  };

  const handleDuplicate = async (form: any) => {
    const newForm = { ...form };
    delete newForm.id;
    delete newForm.created_at;
    newForm.name = `${newForm.name} (Copy)`;

    const { error } = await supabase.from("forms").insert([newForm]);
    if (!error) fetchForms();
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forms & Checkout</h1>
          <p className="text-muted-foreground mt-1">Manage your lead capture and checkout fields.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[150px] bg-background">
              <SelectValue placeholder="Filter by Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Forms</SelectItem>
              <SelectItem value="checkout">Checkout</SelectItem>
              <SelectItem value="contact">Contact / Lead</SelectItem>
            </SelectContent>
          </Select>
          <SiteFilter
            sites={portfolios.map(p => ({ id: p.id, site_name: p.site_name || p.public_slug }))}
            selectedSiteId={selectedSiteId}
            onChange={setSelectedSiteId}
          />
          {selectedSiteId !== "all" && (
            <Button onClick={() => { setFormToEdit(null); setIsFormManagerOpen(true); }} className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Create Form
            </Button>
          )}
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : forms.length === 0 ? (
        <div className="text-center py-24 border border-dashed rounded-xl bg-muted/10">
          <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">No Forms Found</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            {selectedSiteId === "all" 
              ? "Select a specific site from the dropdown above to create your first form."
              : "Build custom checkout and lead capture forms to use on this site."}
          </p>
          {selectedSiteId !== "all" && (
            <Button onClick={() => { setFormToEdit(null); setIsFormManagerOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Create Form
            </Button>
          )}
        </div>
      ) : (
        <Card className="rounded-xl shadow-sm border-border overflow-hidden animate-in fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Form Name</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Store / Site</th>
                  <th className="px-6 py-4 font-medium">Fields</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {forms.map((form) => {
                  const port = portfolios.find(p => p.id === form.portfolio_id);
                  return (
                    <tr key={form.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4 font-bold">{form.name}</td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className={form.type === "checkout" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}>
                          {form.type === "checkout" ? <ShoppingCart className="w-3 h-3 mr-1"/> : <MessageSquare className="w-3 h-3 mr-1"/>}
                          {form.type === "checkout" ? "Checkout" : "Contact"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{port?.site_name || port?.public_slug || "Orphaned"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{form.fields?.length || 0} Fields</td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" aria-label={`Duplicate ${form.name}`} onClick={() => handleDuplicate(form)} title="Duplicate"><Copy className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" aria-label={`Edit ${form.name}`} onClick={() => { setFormToEdit(form); setIsFormManagerOpen(true); }} title="Edit in Manager"><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" aria-label={`Delete ${form.name}`} className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(form.id)}><Trash2 className="w-4 h-4" /></Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {actorData?.id && (
        <FormManager 
          isOpen={isFormManagerOpen} 
          onClose={() => { setIsFormManagerOpen(false); setFormToEdit(null); }} 
          actorId={actorData.id} 
          portfolioId={selectedSiteId} 
          onFormsChange={fetchForms} 
          initialForm={formToEdit}
        />
      )}
    </div>
  );
}