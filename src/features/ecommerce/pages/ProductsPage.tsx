import React, { useState, useEffect, useCallback, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Loader2,
  Plus,
  Package,
  Edit,
  Trash2,
  Video,
  ArrowLeft,
  Image as ImageIcon,
  X,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Settings,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  FileText,
  FileDown,
  GripVertical,
  ListPlus,
  Truck,
} from "lucide-react";
import SiteFilter from "@/components/dashboard/SiteFilter";
import { FormManager } from "@/features/portfolio-builder";
import { cn } from "@/lib/utils";

// --- INTERFACES ---
interface ProductOptionValue {
  label: string;
  price?: number | "";
  visual_value?: string;
}

interface ProductOption {
  name: string;
  values: ProductOptionValue[];
  visual_type?: 'none' | 'color' | 'image';
  visual_shape?: 'round' | 'square';
  visual_show_label?: boolean;
}

interface Product {
  id: string;
  title: string;
  description: string;
  product_type: string;
  status: string;
  price: number;
  compare_at_price?: number;
  track_inventory: boolean;
  stock_count: number;
  sku: string;
  images: string[];
  options: ProductOption[];
  requires_shipping: boolean;
  weight: number;
  category?: string;
  action_type?: string;
  checkout_url?: string;
  whatsapp_number?: string;
  collection_id?: string;
  portfolio_id?: string | null;
  form_id?: string | null;
  slug?: string;
  short_description?: string;
  dimensions?: { length: number; width: number; height: number; unit: string };
  digital_files?: { url: string; name: string }[];
  digital_message?: string;
  accordions?: { title: string; content: string }[];
  delivery_type?: 'physical' | 'digital' | 'service';
  seo_title?: string;
  seo_description?: string;
  related_type?: 'auto' | 'collection' | 'manual';
  related_collection_id?: string | null;
  related_products?: string[];
}

export default function ProductsPage() {
  const { actorData, selectedSiteId, setSelectedSiteId } = useOutletContext<ActorDashboardContextType>();
  const actorId = actorData?.id;

  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<
    { id: string; title: string; portfolio_id?: string | null }[]
  >([]);
  const [savedForms, setSavedForms] = useState<any[]>([]);
  const [globalCartForms, setGlobalCartForms] = useState<Record<string, string | null>>({});
  const [portfolios, setPortfolios] = useState<{ id: string; public_slug: string; site_name?: string }[]>([]);
  const [localDirectForm, setLocalDirectForm] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFormManagerOpen, setIsFormManagerOpen] = useState(false);

  const [view, setView] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Product>>({});
  const [initialDataString, setInitialDataString] = useState<string>("{}");
  const [optionInputs, setOptionInputs] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const digitalFileInputRef = useRef<HTMLInputElement>(null);
  const variantFileInputRef = useRef<HTMLInputElement>(null);
  const [activeVariantUpload, setActiveVariantUpload] = useState<{gIdx: number, vIdx: number} | null>(null);
  const descriptionFileInputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // --- DERIVE EXISTING PRODUCT TYPES FOR SMART AUTOCOMPLETE ---
  const existingTypes = Array.from(
    new Set(products.map((p) => p.product_type).filter(Boolean))
  );

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  };

  const fetchProducts = useCallback(async () => {
    if (!actorId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("pro_products")
      .select("*")
      .eq("actor_id", actorId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProducts(data);
      const cartForms: Record<string, string | null> = {};
      data.forEach(p => {
        if (p.action_type === "cart" && p.form_id) {
          const siteKey = p.portfolio_id || "global";
          if (!cartForms[siteKey]) cartForms[siteKey] = p.form_id;
        }
      });
      setGlobalCartForms(cartForms);
    }

    setIsLoading(false);
  }, [actorId]);

  const fetchForms = useCallback(() => {
    if (portfolios.length === 0) return;
    supabase
      .from("forms")
      .select("id, name, type, portfolio_id")
      .eq("type", "checkout")
      .in("portfolio_id", portfolios.map((p) => p.id))
      .then(({ data }) => {
        if (data) setSavedForms(data);
      });
  }, [portfolios]);

  useEffect(() => {
    fetchProducts();

    // Fetch Collections for the dropdown
    if (actorId) {
      supabase
        .from("pro_collections")
        .select("id, title, portfolio_id")
        .eq("actor_id", actorId)
        .then(({ data }) => {
          if (data) setCollections(data);
        });

        supabase
          .from("portfolios")
          .select("id, public_slug, site_name")
          .eq("actor_id", actorId)
          .then(({ data }) => {
            if (data) setPortfolios(data);
          });
    }
  }, [fetchProducts, actorId]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const initForm = (prod?: Product) => {
    setEditingId(prod?.id || null);
    
    const initialActionType = prod?.action_type || "cart";
    const initialPortfolioId = prod?.portfolio_id || (selectedSiteId !== "all" ? selectedSiteId : "");
    let initialFormId = prod?.form_id || "";
    if (!prod && initialActionType === "cart") {
      const siteKey = initialPortfolioId || "global";
      initialFormId = globalCartForms[siteKey] || "";
    }

    const initialData = {
      title: prod?.title || "",
      description: prod?.description || "",
      price: prod?.price || 0,
      compare_at_price: prod?.compare_at_price || 0,
      product_type: prod?.product_type || "",
      status: prod?.status || "active",
      images: prod?.images && prod.images.length > 0 ? prod.images : [],
      track_inventory: prod?.track_inventory ?? true,
      stock_count: prod?.stock_count ?? 0,
      sku: prod?.sku || "",
      options: prod?.options && prod.options.length > 0 ? prod.options : [],
      requires_shipping: prod?.requires_shipping ?? true,
      weight: prod?.weight ?? 0,
      category: prod?.category || "",
      action_type: initialActionType,
      checkout_url: prod?.checkout_url || "",
      whatsapp_number: prod?.whatsapp_number || "",
      collection_id: prod?.collection_id || "",
      portfolio_id: initialPortfolioId,
      form_id: initialFormId,
      slug: prod?.slug || "",
      short_description: prod?.short_description || "",
      dimensions: prod?.dimensions || { length: 0, width: 0, height: 0, unit: "cm" },
      digital_files: prod?.digital_files || [],
      digital_message: prod?.digital_message || "",
      accordions: prod?.accordions || [],
      delivery_type: prod?.delivery_type || (prod?.requires_shipping ? "physical" : "digital"),
      seo_title: prod?.seo_title || "",
      seo_description: prod?.seo_description || "",
      related_type: prod?.related_type || 'auto',
      related_collection_id: prod?.related_collection_id || null,
      related_products: prod?.related_products || [],
    };
    setFormData(initialData);
    setInitialDataString(JSON.stringify(initialData));
    setOptionInputs({});
    setLocalDirectForm(initialActionType === "form_order" ? initialFormId : "");
    setView("form");
  };

  const isDirty = view === "form" && JSON.stringify(formData) !== initialDataString;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this product?"))
      return;
    const { error } = await supabase.from("pro_products").delete().eq("id", id);
    if (!error) fetchProducts();
  };

  const handleDuplicate = async (product: Product) => {
    if (!actorId) return;
    const payload = {
      actor_id: actorId,
      title: `${product.title} (Copy)`,
      description: product.description,
      product_type: product.product_type,
      status: "draft",
      price: product.price,
      compare_at_price: product.compare_at_price,
      track_inventory: product.track_inventory,
      stock_count: product.stock_count,
      sku: product.sku,
      images: product.images,
      options: product.options,
      requires_shipping: product.requires_shipping,
      weight: product.weight,
      category: product.category,
      action_type: product.action_type,
      checkout_url: product.checkout_url,
      whatsapp_number: product.whatsapp_number,
      collection_id: product.collection_id || null,
      portfolio_id: product.portfolio_id || null,
      form_id: product.form_id || null,
      slug: generateSlug(`${product.title} Copy ${Math.floor(Math.random() * 10000)}`),
      short_description: product.short_description,
      dimensions: product.dimensions,
      digital_files: product.digital_files,
      digital_message: product.digital_message,
      accordions: product.accordions,
      delivery_type: product.delivery_type,
      seo_title: product.seo_title,
      seo_description: product.seo_description,
      related_type: product.related_type || 'auto',
      related_collection_id: product.related_collection_id || null,
      related_products: product.related_products || [],
    };

    const { error } = await supabase.from("pro_products").insert([payload]);
    if (error) {
      console.error("Error duplicating product:", error);
      alert("Failed to duplicate product.");
    } else {
      fetchProducts();
    }
  };

  const handleToggleStatus = async (product: Product) => {
    const newStatus = product.status === "active" ? "draft" : "active";
    const { error } = await supabase
      .from("pro_products")
      .update({ status: newStatus })
      .eq("id", product.id);

    if (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status.");
    } else {
      setProducts(products.map(p => p.id === product.id ? { ...p, status: newStatus } : p));
    }
  };

  const handleSave = async () => {
    if (!formData.title || formData.price === undefined) {
      alert("Title and Price are required.");
      return;
    }

    if (!formData.portfolio_id) {
      alert("Please select a Store / Website for this product.");
      return;
    }

    setIsSaving(true);

    const payload = {
      actor_id: actorId,
      title: formData.title,
      description: formData.description,
      product_type: formData.product_type || "Physical",
      status: formData.status,
      price: formData.price,
      compare_at_price: formData.compare_at_price || null,
      track_inventory: formData.delivery_type === 'digital' ? false : formData.track_inventory,
      stock_count: formData.stock_count,
      sku: formData.sku,
      images: formData.images || [],
      options: formData.options || [],
      requires_shipping: formData.delivery_type === 'physical',
      weight: formData.delivery_type === 'physical' ? formData.weight : 0,
      category: formData.category,
      action_type: formData.action_type,
      checkout_url: formData.checkout_url,
      whatsapp_number: formData.whatsapp_number,
      collection_id: formData.collection_id || null, // Null if empty so FK doesn't break
      portfolio_id: formData.portfolio_id || null,
      form_id: (formData.action_type === "cart" || formData.action_type === "form_order") ? (formData.form_id || null) : null,
      slug: formData.slug || generateSlug(formData.title),
      short_description: formData.short_description || null,
      dimensions: formData.delivery_type === 'physical' ? formData.dimensions : null,
      digital_files: formData.delivery_type === 'digital' ? formData.digital_files : null,
      digital_message: formData.delivery_type === 'digital' ? formData.digital_message : null,
      accordions: formData.accordions || [],
      delivery_type: formData.delivery_type || 'physical',
      seo_title: formData.seo_title || null,
      seo_description: formData.seo_description || null,
      related_type: formData.related_type || 'auto',
      related_collection_id: formData.related_collection_id || null,
      related_products: formData.related_products || [],
    };

    let error;
    if (editingId) {
      const { error: updateErr } = await supabase
        .from("pro_products")
        .update(payload)
        .eq("id", editingId);
      error = updateErr;
    } else {
      const { error: insertErr } = await supabase
        .from("pro_products")
        .insert([payload]);
      error = insertErr;
    }

    // Always sync the form_id across all cart items for this portfolio, even if it's being reset to null
    if (!error && payload.action_type === "cart") {
      let query = supabase.from("pro_products")
        .update({ form_id: payload.form_id })
        .eq("actor_id", actorId)
        .eq("action_type", "cart");
      if (payload.portfolio_id) query = query.eq("portfolio_id", payload.portfolio_id);
      else query = query.is("portfolio_id", null);
      await query;
    }

    if (error) {
      console.error("Error saving product:", error);
      alert(`Failed to save product.\n\nError: ${error.message}\n\n(If it mentions a missing column like 'form_id' or 'portfolio_id', make sure to add them to your pro_products table in Supabase!)`);
    } else {
      setView("list");
      fetchProducts();
    }
    setIsSaving(false);
  };

  // --- IMAGE UPLOAD HANDLER ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !actorId) return;
    setIsUploading(true);

    const newImages = [...(formData.images || [])];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${actorId}/products/${fileName}`;

      const { error } = await supabase.storage
        .from("portfolio-assets")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });

      if (!error) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("portfolio-assets").getPublicUrl(filePath);
        newImages.push(publicUrl);
      }
    }

    setFormData({ ...formData, images: newImages });
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- DIGITAL FILE UPLOAD HANDLER ---
  const handleDigitalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !actorId) return;
    setIsUploading(true);

    const newFiles = [...(formData.digital_files || [])];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${actorId}/digital-products/${fileName}`;

      const { error } = await supabase.storage
        .from("portfolio-assets") // Or a private bucket if preferred
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (!error) {
        const { data } = supabase.storage.from("portfolio-assets").getPublicUrl(filePath);
        newFiles.push({ url: data.publicUrl, name: file.name });
      }
    }

    setFormData({ ...formData, digital_files: newFiles });
    setIsUploading(false);
    if (digitalFileInputRef.current) digitalFileInputRef.current.value = "";
  };

  // --- DESCRIPTION IMAGE UPLOAD HANDLER ---
  const handleDescriptionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !actorId) return;
    setIsUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${actorId}/products/desc/${fileName}`;

    const { error } = await supabase.storage.from("portfolio-assets").upload(filePath, file, { cacheControl: "3600", upsert: true });

    if (!error) {
      const { data } = supabase.storage.from("portfolio-assets").getPublicUrl(filePath);
      const imgHtml = `\n<img src="${data.publicUrl}" alt="Product image" style="max-width: 100%; border-radius: 12px; margin: 24px 0;" />\n`;
      setFormData(prev => ({ ...prev, description: (prev.description || "") + imgHtml }));
    }
    setIsUploading(false);
    if (descriptionFileInputRef.current) descriptionFileInputRef.current.value = "";
  };

  const insertText = (startTag: string, endTag: string) => {
    const textarea = descRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.description || "";
    setFormData({ ...formData, description: text.substring(0, start) + startTag + text.substring(start, end) + endTag + text.substring(end, text.length) });
  };

  // --- VARIANT IMAGE UPLOAD HANDLER ---
  const handleVariantUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !actorId || !activeVariantUpload) return;
    setIsUploading(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${actorId}/products/variants/${fileName}`;

    const { error } = await supabase.storage
      .from("portfolio-assets")
      .upload(filePath, file, { cacheControl: "3600", upsert: true });

    if (!error) {
      const { data } = supabase.storage.from("portfolio-assets").getPublicUrl(filePath);
      const newOptions = [...(formData.options || [])];
      newOptions[activeVariantUpload.gIdx].values[activeVariantUpload.vIdx].visual_value = data.publicUrl;
      setFormData({ ...formData, options: newOptions });
    }
    setIsUploading(false);
    setActiveVariantUpload(null);
    if (variantFileInputRef.current) variantFileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    const newImages = (formData.images || []).filter((_, i) => i !== index);
    setFormData({ ...formData, images: newImages });
  };

  // --- IMAGE RE-ORDERING ---
  const moveImageLeft = (index: number) => {
    if (index === 0) return;
    const newImages = [...(formData.images || [])];
    const temp = newImages[index];
    newImages[index] = newImages[index - 1];
    newImages[index - 1] = temp;
    setFormData({ ...formData, images: newImages });
  };

  const moveImageRight = (index: number) => {
    const newImages = [...(formData.images || [])];
    if (index === newImages.length - 1) return;
    const temp = newImages[index];
    newImages[index] = newImages[index + 1];
    newImages[index + 1] = temp;
    setFormData({ ...formData, images: newImages });
  };

  // --- DYNAMIC OPTION HANDLERS ---
  const addOptionGroup = () => {
    setFormData({
      ...formData,
      options: [...(formData.options || []), { name: "", values: [] }],
    });
  };

  const removeOptionGroup = (index: number) => {
    setFormData({
      ...formData,
      options: (formData.options || []).filter((_, i) => i !== index),
    });
  };

  const updateOptionName = (index: number, val: string) => {
    const newOptions = [...(formData.options || [])];
    newOptions[index].name = val;
    setFormData({ ...formData, options: newOptions });
  };

  const addOptionValue = (index: number) => {
    const val = optionInputs[index]?.trim();
    if (!val) return;

    const newOptions = [...(formData.options || [])];
    if (!newOptions[index].values.find((v) => v.label === val)) {
      newOptions[index].values.push({ label: val, price: "" });
    }

    setFormData({ ...formData, options: newOptions });
    setOptionInputs({ ...optionInputs, [index]: "" });
  };

  const updateOptionValuePrice = (
    groupIndex: number,
    valueIndex: number,
    price: string
  ) => {
    const newOptions = [...(formData.options || [])];
    newOptions[groupIndex].values[valueIndex].price = price
      ? parseFloat(price)
      : "";
    setFormData({ ...formData, options: newOptions });
  };

  const removeOptionValue = (groupIndex: number, valueIndex: number) => {
    const newOptions = [...(formData.options || [])];
    newOptions[groupIndex].values.splice(valueIndex, 1);
    setFormData({ ...formData, options: newOptions });
  };

  const handleOptionKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addOptionValue(index);
    }
  };

  const handleBack = () => {
    if (isDirty && !window.confirm("You have unsaved changes. Are you sure you want to discard them?")) {
      return;
    }
    setView("list");
  };

  // --- ACCORDION HANDLERS ---
  const addAccordion = () => {
    setFormData({ ...formData, accordions: [...(formData.accordions || []), { title: "", content: "" }] });
  };

  const updateAccordion = (index: number, key: "title" | "content", val: string) => {
    const newAccs = [...(formData.accordions || [])];
    newAccs[index][key] = val;
    setFormData({ ...formData, accordions: newAccs });
  };

  const removeAccordion = (index: number) => {
    const newAccs = [...(formData.accordions || [])];
    newAccs.splice(index, 1);
    setFormData({ ...formData, accordions: newAccs });
  };

  if (!actorId) return null;

  return (
    <div className="p-4 md:p-8 max-w-8xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage your inventory, variants, and collections.
          </p>
        </div>
        {view === "list" && (
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[140px] bg-background">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            <SiteFilter
              sites={portfolios.map(p => ({ id: p.id, site_name: p.site_name || p.public_slug }))}
              selectedSiteId={selectedSiteId}
              onChange={setSelectedSiteId}
            />
            <Button onClick={() => initForm()} className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Add Product
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : view === "form" ? (
        <div className="animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="-ml-4 text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isSaving}
              >
                Discard
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{" "}
                Save Product
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
            {/* LEFT COLUMN: Main Details */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* 1. PRODUCT TYPE & DELIVERY (MOVED TO TOP) */}
              <Card className="shadow-md border-primary/30 bg-primary/5">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg text-primary flex items-center gap-2"><Package className="w-5 h-5"/> Product Type</CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-6">
                  <RadioGroup 
                    value={formData.delivery_type || "physical"} 
                    onValueChange={(val) => setFormData({ ...formData, delivery_type: val as any, requires_shipping: val === "physical" })} 
                    className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                  >
                    <Label className={cn("flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer hover:bg-background transition-all bg-background/50", formData.delivery_type === 'physical' && "border-primary bg-background shadow-sm")}>
                      <RadioGroupItem value="physical" className="sr-only" />
                      <Package className={cn("w-8 h-8 mb-2 text-muted-foreground", formData.delivery_type === 'physical' && "text-primary")} />
                      <span className="font-bold">Physical</span>
                      <span className="text-[10px] text-muted-foreground mt-1 text-center">Shipped to customer</span>
                    </Label>
                    <Label className={cn("flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer hover:bg-background transition-all bg-background/50", formData.delivery_type === 'digital' && "border-primary bg-background shadow-sm")}>
                      <RadioGroupItem value="digital" className="sr-only" />
                      <FileDown className={cn("w-8 h-8 mb-2 text-muted-foreground", formData.delivery_type === 'digital' && "text-primary")} />
                      <span className="font-bold">Digital</span>
                      <span className="text-[10px] text-muted-foreground mt-1 text-center">Instant download file</span>
                    </Label>
                    <Label className={cn("flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer hover:bg-background transition-all bg-background/50", formData.delivery_type === 'service' && "border-primary bg-background shadow-sm")}>
                      <RadioGroupItem value="service" className="sr-only" />
                      <ListPlus className={cn("w-8 h-8 mb-2 text-muted-foreground", formData.delivery_type === 'service' && "text-primary")} />
                      <span className="font-bold">Service</span>
                      <span className="text-[10px] text-muted-foreground mt-1 text-center">No delivery required</span>
                    </Label>
                  </RadioGroup>

                  {formData.delivery_type === 'physical' && (
                    <div className="pt-6 border-t border-primary/10 animate-in fade-in slide-in-from-top-2 space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Weight (kg)</Label>
                          <Input type="number" step="0.1" value={formData.weight || 0} onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })} className="bg-background" />
                          <p className="text-[10px] text-muted-foreground">Used to calculate shipping rates at checkout.</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Dimensions</Label>
                          <div className="flex items-center gap-2">
                            <Input type="number" placeholder="L" value={formData.dimensions?.length || ""} onChange={e => setFormData({...formData, dimensions: {...formData.dimensions, length: parseFloat(e.target.value)||0}})} className="bg-background px-2 text-center" />
                            <span className="text-muted-foreground text-xs">×</span>
                            <Input type="number" placeholder="W" value={formData.dimensions?.width || ""} onChange={e => setFormData({...formData, dimensions: {...formData.dimensions, width: parseFloat(e.target.value)||0}})} className="bg-background px-2 text-center" />
                            <span className="text-muted-foreground text-xs">×</span>
                            <Input type="number" placeholder="H" value={formData.dimensions?.height || ""} onChange={e => setFormData({...formData, dimensions: {...formData.dimensions, height: parseFloat(e.target.value)||0}})} className="bg-background px-2 text-center" />
                            <Select value={formData.dimensions?.unit || "cm"} onValueChange={v => setFormData({...formData, dimensions: {...formData.dimensions, unit: v}})}>
                              <SelectTrigger className="w-[70px] bg-background px-2"><SelectValue/></SelectTrigger>
                              <SelectContent><SelectItem value="cm">cm</SelectItem><SelectItem value="in">in</SelectItem></SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.delivery_type === 'digital' && (
                    <div className="pt-6 border-t border-primary/10 animate-in fade-in slide-in-from-top-2 space-y-6">
                      <div className="space-y-3">
                        <Label>Digital Files</Label>
                        <p className="text-[10px] text-muted-foreground -mt-1">These files will be automatically emailed to the customer upon successful payment.</p>
                        <div className="space-y-2">{(formData.digital_files || []).map((file: any, idx: number) => (<div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-background shadow-sm group"><div className="flex items-center gap-3 overflow-hidden"><div className="p-2 bg-primary/10 text-primary rounded"><FileText size={16}/></div><span className="font-medium text-sm truncate">{file.name}</span></div><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => {const newFiles = [...formData.digital_files]; newFiles.splice(idx, 1); setFormData({...formData, digital_files: newFiles});}}><Trash2 size={16}/></Button></div>))}</div>
                        <label htmlFor="digital-file-upload" className="border-2 border-dashed border-primary/30 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-primary/10 focus-within:ring-2 focus-within:ring-primary transition-colors bg-background">
                          {isUploading ? (<><Loader2 className="w-6 h-6 text-primary animate-spin mb-2" /><p className="text-xs font-medium">Uploading file...</p></>) : (<><UploadCloud className="w-6 h-6 text-primary mb-2 opacity-80" /><p className="text-xs font-bold text-primary">Add Digital File</p></>)}
                        </label>
                        <input id="digital-file-upload" type="file" ref={digitalFileInputRef} className="sr-only" multiple onChange={handleDigitalUpload} />
                      </div>
                      <div className="space-y-2 pt-2">
                        <Label>Delivery Message / Instructions</Label>
                        <Textarea placeholder="e.g. Thanks for your purchase! Here is the link to access your preset..." value={formData.digital_message || ""} onChange={e => setFormData({...formData, digital_message: e.target.value})} rows={3} className="resize-none bg-background" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 2. GENERAL DETAILS */}
              <Card className="shadow-sm">
                <CardHeader className="pb-4"><CardTitle className="text-lg">General Details</CardTitle></CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <Label>
                      Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Vintage Leather Jacket"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      className="text-lg font-bold h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Short Description (Below Price)</Label>
                    <Textarea
                      placeholder="A quick, catchy summary of the product..."
                      value={formData.short_description || ""}
                      onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Long Description (Rich Text)</Label>
                    <div className="border rounded-xl bg-background overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                      <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/30 border-b overflow-x-auto no-scrollbar">
                        <Button variant="ghost" size="sm" type="button" className="h-8 px-2.5 font-bold" onClick={() => insertText('<b>', '</b>')}>B</Button>
                        <Button variant="ghost" size="sm" type="button" className="h-8 px-2.5 italic" onClick={() => insertText('<i>', '</i>')}>I</Button>
                        <Button variant="ghost" size="sm" type="button" className="h-8 px-2.5 underline" onClick={() => insertText('<u>', '</u>')}>U</Button>
                        <div className="w-px h-4 bg-border mx-1" />
                        <Button variant="ghost" size="sm" type="button" className="h-8 px-2.5 font-serif font-bold text-[15px]" onClick={() => insertText('<h2>', '</h2>')}>H2</Button>
                        <Button variant="ghost" size="sm" type="button" className="h-8 px-2.5 font-serif font-bold text-[13px]" onClick={() => insertText('<h3>', '</h3>')}>H3</Button>
                        <div className="w-px h-4 bg-border mx-1" />
                        <Button variant="ghost" size="sm" type="button" className="h-8 px-2.5" onClick={() => insertText('<ul>\n  <li>', '</li>\n</ul>')}>List</Button>
                        <Button variant="ghost" size="sm" type="button" className="h-8 px-2.5" onClick={() => insertText('<a href="https://..." target="_blank" className="text-primary underline font-bold">', '</a>')}>Link</Button>
                        <Button variant="ghost" size="sm" type="button" className="h-8 px-2.5 text-primary hover:text-primary hover:bg-primary/10 ml-auto" onClick={() => descriptionFileInputRef.current?.click()}>
                          <ImageIcon size={14} className="mr-1.5" /> Inject Image
                        </Button>
                      </div>
                      <Textarea
                        ref={descRef}
                        className="min-h-[350px] border-0 focus-visible:ring-0 rounded-none resize-y p-5 leading-relaxed"
                        placeholder="Craft a beautiful, immersive story about your product..."
                        value={formData.description || ""}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">HTML is supported. Images uploaded here will be securely injected directly into your story.</p>
                    <input type="file" ref={descriptionFileInputRef} className="hidden" accept="image/*" onChange={handleDescriptionImageUpload} />
                  </div>
                </CardContent>
              </Card>

              {/* 3. MEDIA GALLERY */}
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Media Gallery</CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  {(formData.images?.length ?? 0) > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 mb-4">
                      {formData.images?.map((img, idx) => {
                        const isVideo = img.match(/\.(mp4|webm|mov)$/i);
                        return (
                        <div
                          key={idx}
                          className="relative aspect-square rounded-md overflow-hidden border group bg-black"
                        >
                          {isVideo ? (
                            <video src={img} className="w-full h-full object-cover opacity-90 group-hover:opacity-40 transition-opacity" muted autoPlay playsInline loop />
                          ) : (
                            <img src={img} className="w-full h-full object-cover opacity-90 group-hover:opacity-40 transition-opacity" alt={`Media ${idx}`} />
                          )}
                          {idx === 0 && <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">COVER</span>}
                          {/* Overlay Controls */}
                          <div className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {idx > 0 && (
                              <button type="button" onClick={() => moveImageLeft(idx)} className="bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white rounded p-1.5 transition-colors">
                                <ChevronLeft size={16} />
                              </button>
                            )}
                            <button type="button" onClick={() => removeImage(idx)} className="bg-red-500/80 hover:bg-red-500 backdrop-blur-sm text-white rounded p-1.5 transition-colors">
                              <X size={16} />
                            </button>
                            {idx < (formData.images?.length || 0) - 1 && (
                              <button type="button" onClick={() => moveImageRight(idx)} className="bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white rounded p-1.5 transition-colors">
                                <ChevronRight size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      )})}
                    </div>
                  )}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                        <p className="text-sm font-medium">
                          Uploading images...
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="bg-primary/10 p-3 rounded-full mb-3">
                          <UploadCloud className="w-6 h-6 text-primary" />
                        </div>
                        <p className="text-sm font-medium mb-1">Click to upload Images or Videos</p>
                        <p className="text-xs text-muted-foreground">Supported: JPG, PNG, WEBP, MP4, MOV</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept="image/*,video/mp4,video/webm,video/quicktime"
                    onChange={handleImageUpload}
                  />
                  <input
                    type="file"
                    ref={variantFileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleVariantUpload}
                  />
                </CardContent>
              </Card>

              {/* 4. VARIANTS */}
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Variants & Options</CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-6">
                  {formData.options?.length === 0 ? (
                    <Button variant="outline" onClick={addOptionGroup}>
                      <Plus className="w-4 h-4 mr-2" /> Add options like size or color
                    </Button>
                  ) : (
                    <div className="space-y-6">
                      {formData.options?.map((opt, groupIdx) => (
                        <div key={groupIdx} className="p-5 border rounded-lg bg-muted/10 space-y-4 relative">
                          <Button variant="ghost" size="icon" onClick={() => removeOptionGroup(groupIdx)} className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="w-4 h-4" /></Button>
                          <div className="space-y-2 max-w-sm">
                            <Label>Option name</Label>
                            <Input placeholder="e.g., Size, Color" value={opt.name} onChange={(e) => updateOptionName(groupIdx, e.target.value)} />
                          </div>
                          <div className="flex flex-wrap items-center gap-3 pt-1">
                              <div className="w-[140px]">
                                <Select value={opt.visual_type || "none"} onValueChange={(val) => {
                                    const newOptions = [...(formData.options || [])];
                                    newOptions[groupIdx].visual_type = val as any;
                                    if (!newOptions[groupIdx].visual_shape) newOptions[groupIdx].visual_shape = 'round';
                                    setFormData({ ...formData, options: newOptions });
                                }}>
                                    <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Display Type" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Text Buttons</SelectItem>
                                        <SelectItem value="color">Colors</SelectItem>
                                        <SelectItem value="image">Images</SelectItem>
                                    </SelectContent>
                                </Select>
                              </div>
                              {opt.visual_type && opt.visual_type !== "none" && (
                                  <>
                                      <div className="w-[120px]">
                                        <Select value={opt.visual_shape || "round"} onValueChange={(val) => {
                                            const newOptions = [...(formData.options || [])];
                                            newOptions[groupIdx].visual_shape = val as any;
                                            setFormData({ ...formData, options: newOptions });
                                        }}>
                                            <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Shape" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="round">Round</SelectItem>
                                                <SelectItem value="square">Square</SelectItem>
                                            </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="flex items-center gap-2 px-2 border-l border-border h-10">
                                          <Switch 
                                            id={`show-label-${groupIdx}`} 
                                            checked={opt.visual_show_label === true} 
                                            onCheckedChange={(val) => {
                                                const newOptions = [...(formData.options || [])];
                                                newOptions[groupIdx].visual_show_label = val;
                                                setFormData({ ...formData, options: newOptions });
                                            }} 
                                          />
                                          <Label htmlFor={`show-label-${groupIdx}`} className="text-xs text-muted-foreground whitespace-nowrap cursor-pointer">Show Text</Label>
                                      </div>
                                  </>
                              )}
                          </div>
                          <div className="space-y-3">
                            <Label>Option values</Label>
                            {opt.values.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {opt.values.map((val, valIdx) => (
                                  <div key={valIdx} className="flex items-center gap-2 bg-background border rounded-md p-2 w-max shadow-sm">
                                    {opt.visual_type === 'color' && (
                                        <input type="color" className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent shrink-0 p-0" value={val.visual_value || "#000000"} onChange={(e) => {
                                            const newOptions = [...(formData.options || [])];
                                            newOptions[groupIdx].values[valIdx].visual_value = e.target.value;
                                            setFormData({...formData, options: newOptions});
                                        }} title="Choose color" />
                                    )}
                                    {opt.visual_type === 'image' && (
                                        <div
                                            className="w-7 h-7 rounded border bg-muted flex items-center justify-center cursor-pointer shrink-0 overflow-hidden hover:opacity-80 transition-opacity"
                                            onClick={() => {
                                                setActiveVariantUpload({ gIdx: groupIdx, vIdx: valIdx });
                                                variantFileInputRef.current?.click();
                                            }}
                                            title="Upload variant image"
                                        >
                                            {val.visual_value ? <img src={val.visual_value} className="w-full h-full object-cover" /> : <ImageIcon size={12} className="text-muted-foreground" />}
                                        </div>
                                    )}
                                    <Badge variant="secondary" className="px-2 py-1 text-sm">{val.label}</Badge>
                                    <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground">$</span><Input type="number" placeholder="Price" className="w-16 h-7 text-xs bg-muted/30" value={val.price ?? ""} onChange={(e) => updateOptionValuePrice(groupIdx, valIdx, e.target.value)} /></div>
                                    <button className="text-muted-foreground hover:text-destructive ml-1 p-1 rounded-md hover:bg-destructive/10" onClick={() => removeOptionValue(groupIdx, valIdx)}><X size={14} /></button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2 max-w-sm">
                              <Input placeholder="Type a value and press Enter" value={optionInputs[groupIdx] || ""} onChange={(e) => setOptionInputs({ ...optionInputs, [groupIdx]: e.target.value })} onKeyDown={(e) => handleOptionKeyDown(e, groupIdx)} />
                              <Button type="button" variant="secondary" onClick={() => addOptionValue(groupIdx)}>Add</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={addOptionGroup}><Plus className="w-4 h-4 mr-2" /> Add another option</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 5. INVENTORY TRACKING */}
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Inventory Tracking</CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-6">
                  <div className="space-y-2">
                    <Label>SKU (Stock Keeping Unit)</Label>
                    <Input value={formData.sku || ""} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
                  </div>
                  {formData.delivery_type !== 'digital' && (
                    <div className="pt-4 border-t space-y-4 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium cursor-pointer" htmlFor="track_inv">Track quantity</Label>
                        <Switch id="track_inv" checked={formData.track_inventory} onCheckedChange={(c) => setFormData({ ...formData, track_inventory: c })} />
                      </div>
                      {formData.track_inventory && (
                        <div className="space-y-2 animate-in slide-in-from-top-2">
                          <Label>Available Stock</Label>
                          <Input type="number" className="max-w-[200px]" value={formData.stock_count} onChange={(e) => setFormData({ ...formData, stock_count: parseInt(e.target.value) || 0 })} />
                        </div>
                      )}
                    </div>
                  )}
                  {formData.delivery_type === 'digital' && (
                    <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground border">
                      Inventory tracking is disabled for Digital products (Unlimited stock).
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* 6. ACCORDIONS */}
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Product Accordions (FAQs, Info)</CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  <p className="text-[10px] text-muted-foreground">Add expandable sections below your product description for things like Shipping Policies, Size Guides, or Ingredients.</p>
                  <div className="space-y-4">
                    {(formData.accordions || []).map((acc: any, idx: number) => (
                       <div key={idx} className="p-4 border rounded-xl bg-muted/10 relative group space-y-3">
                          <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => removeAccordion(idx)}><X className="w-4 h-4" /></Button>
                          <div className="space-y-1.5 pr-6">
                            <Label className="text-[10px] uppercase text-muted-foreground">Tab Title</Label>
                            <Input placeholder="e.g. Refund Policy" value={acc.title} onChange={e => updateAccordion(idx, 'title', e.target.value)} className="h-9 font-bold bg-background" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase text-muted-foreground">Content</Label>
                            <Textarea placeholder="Details..." value={acc.content} onChange={e => updateAccordion(idx, 'content', e.target.value)} className="min-h-[80px] resize-y bg-background text-sm" />
                          </div>
                       </div>
                    ))}
                    <Button variant="outline" className="w-full border-dashed" onClick={addAccordion}><Plus size={14} className="mr-2"/> Add Accordion Tab</Button>
                  </div>
                </CardContent>
              </Card>
              
              {/* 7. SEARCH ENGINE OPTIMIZATION */}
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Search engine listing</CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-5">
                  <p className="text-[10px] text-muted-foreground -mt-1">Add a title and description to see how this product might appear in a search engine listing.</p>
                  
                  {/* Google Preview */}
                  <div className="mb-4 p-4 bg-muted/20 border rounded-xl overflow-hidden">
                    <h3 className="text-[18px] text-[#1a0dab] dark:text-[#8ab4f8] font-normal truncate cursor-pointer hover:underline">
                      {formData.seo_title || formData.title || "Product Title"}
                    </h3>
                    <div className="text-[13px] text-[#006621] dark:text-[#81c995] truncate mt-0.5 flex items-center gap-1 font-medium">
                      <span>https://{window.location.hostname}</span>
                      <span className="text-muted-foreground font-normal">› pro › {portfolios.find(p => p.id === formData.portfolio_id)?.public_slug || "store"} › product › {formData.slug || "product-slug"}</span>
                    </div>
                    <p className="text-[13px] text-[#545454] dark:text-[#bdc1c6] line-clamp-2 mt-1.5 leading-snug">
                      {formData.seo_description || formData.short_description || formData.description || "Add a description to see how this product might appear in search engine results."}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Page title</Label>
                    <Input placeholder="e.g. Vintage Leather Jacket | Free Shipping" value={formData.seo_title || ""} onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })} className="bg-background" />
                    <p className="text-[10px] text-muted-foreground">{formData.seo_title?.length || 0} of 70 characters used</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Meta description</Label>
                    <Textarea placeholder="Write a compelling description for search engines..." value={formData.seo_description || ""} onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })} className="resize-y min-h-[80px] bg-background" />
                    <p className="text-[10px] text-muted-foreground">{formData.seo_description?.length || 0} of 320 characters used</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN: Settings & Organization */}
            <div className="space-y-6 lg:sticky lg:top-24 lg:h-max">
              
              {/* 8. ORGANIZATION */}
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">
                    Product Organization
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  <div className="space-y-2">
                    <Label>Store / Website <span className="text-destructive">*</span></Label>
                    <Select value={formData.portfolio_id || "global"} onValueChange={(val) => {
                        let newFormId = formData.form_id;
                        if (formData.action_type === "cart") newFormId = globalCartForms[val === "global" ? "global" : val] || "";
                        setFormData({ ...formData, portfolio_id: val === "global" ? null : val, form_id: newFormId });
                    }}>
                      <SelectTrigger className="bg-background font-medium"><SelectValue placeholder="Select a Store" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global" className="text-muted-foreground font-bold">Global (Available on all sites)</SelectItem>
                        {portfolios.map((p) => <SelectItem key={p.id} value={p.id}>{p.site_name || p.public_slug}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status || "active"} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active (Visible)</SelectItem>
                        <SelectItem value="draft">Draft (Hidden)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Collection</Label>
                    <Select value={formData.collection_id || "none"} onValueChange={(val) => setFormData({ ...formData, collection_id: val === "none" ? null : val })}>
                      <SelectTrigger className="bg-background"><SelectValue placeholder="No Collection" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Collection</SelectItem>
                        {collections.filter((c) => !formData.portfolio_id || c.portfolio_id === formData.portfolio_id || !c.portfolio_id).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <Label>Product Tag</Label>
                    <Input
                      list="product-tags"
                      placeholder="e.g. Clothing, Spoon, Electronics"
                      value={formData.product_type || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          product_type: e.target.value,
                        })
                      }
                      className="bg-background"
                    />
                    <datalist id="product-tags">
                      {existingTypes
                        .filter((t) => !["Physical", "Digital", "Service"].includes(t))
                        .map((t) => <option key={t} value={t} />)}
                    </datalist>
                    <p className="text-[10px] text-muted-foreground">Add a tag to categorize this product.</p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label>URL Slug</Label>
                    <Input placeholder="e.g. awesome-tshirt" value={formData.slug || ""} onChange={(e) => setFormData({ ...formData, slug: generateSlug(e.target.value) })} className="bg-background"/>
                    <p className="text-[10px] text-muted-foreground break-all">
                      Link: /pro/product/<strong>{formData.slug || "product-name"}</strong>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 8. RELATED PRODUCTS */}
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Related Products</CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-5">
                  <RadioGroup 
                    value={formData.related_type || "auto"} 
                    onValueChange={(val: any) => setFormData({ ...formData, related_type: val, related_products: [] })} 
                    className="flex flex-col gap-3"
                  >
                    <Label className={cn("flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors", (!formData.related_type || formData.related_type === "auto") && "bg-primary/5 border-primary shadow-sm")}>
                      <RadioGroupItem value="auto" />
                      <div className="font-semibold text-sm">Auto (Same Collection)</div>
                    </Label>
                    <Label className={cn("flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors", formData.related_type === "collection" && "bg-primary/5 border-primary shadow-sm")}>
                      <RadioGroupItem value="collection" />
                      <div className="font-semibold text-sm">Specific Collection</div>
                    </Label>
                    <Label className={cn("flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors", formData.related_type === "manual" && "bg-primary/5 border-primary shadow-sm")}>
                      <RadioGroupItem value="manual" />
                      <div className="font-semibold text-sm">Manual Selection</div>
                    </Label>
                  </RadioGroup>

                  {formData.related_type === "collection" && (
                    <div className="animate-in fade-in slide-in-from-top-2 pt-2 border-t">
                      <Label>Select Target Collection</Label>
                      <Select value={formData.related_collection_id || ""} onValueChange={(val) => setFormData({ ...formData, related_collection_id: val })}>
                        <SelectTrigger className="mt-1.5 bg-background"><SelectValue placeholder="Select a collection..." /></SelectTrigger>
                        <SelectContent>
                          {collections.filter(c => !formData.portfolio_id || c.portfolio_id === formData.portfolio_id || !c.portfolio_id).map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.related_type === "manual" && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 pt-2 border-t">
                      <Label>Select Products</Label>
                      <div className="max-h-[250px] overflow-y-auto p-4 border rounded-xl bg-muted/10 space-y-3 custom-scrollbar">
                        {products.filter(p => p.id !== formData.id && (!formData.portfolio_id || p.portfolio_id === formData.portfolio_id)).map(p => (
                          <div key={p.id} className="flex items-center space-x-3 bg-background p-2 border rounded-md shadow-sm">
                            <input type="checkbox" id={`rel-${p.id}`} checked={(formData.related_products || []).includes(p.id)} onChange={(e) => { const current = formData.related_products || []; if (e.target.checked) setFormData({ ...formData, related_products: [...current, p.id] }); else setFormData({ ...formData, related_products: current.filter(id => id !== p.id) }); }} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                            <Label htmlFor={`rel-${p.id}`} className="text-sm cursor-pointer flex-1 flex items-center gap-3">
                              {p.images?.[0] ? <img src={p.images[0]} className="w-8 h-8 rounded bg-muted object-cover" /> : <div className="w-8 h-8 rounded bg-muted flex items-center justify-center"><Package size={12} className="opacity-50"/></div>}
                              {p.title}
                            </Label>
                          </div>
                        ))}
                        {products.length <= 1 && <p className="text-xs text-muted-foreground text-center">No other products available.</p>}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 9. ORGANIZATION */}
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Pricing</CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>
                      Price <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        className="pl-7 bg-background"
                        value={formData.price}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            price: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Compare at price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        className="pl-7 bg-background"
                        value={formData.compare_at_price}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            compare_at_price: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 10. CHECKOUT SETTINGS */}
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Checkout Settings</CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  <div className="space-y-2">
                    <Label>Action Type</Label>
                    <Select value={formData.action_type || "cart"} onValueChange={(val) => {
                        const newActionType = val;
                        let newFormId = formData.form_id;
                        if (newActionType === "cart") {
                          const siteKey = formData.portfolio_id || "global";
                          newFormId = globalCartForms[siteKey] || "";
                        } else if (newActionType === "form_order") {
                          newFormId = localDirectForm;
                        }
                        setFormData({
                          ...formData,
                          action_type: newActionType,
                          form_id: newFormId,
                        });
                    }}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cart">Standard Add to Cart</SelectItem>
                        <SelectItem value="whatsapp">Order via WhatsApp</SelectItem>
                        <SelectItem value="link">External Link</SelectItem>
                        <SelectItem value="form_order">Direct Order Form</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.action_type === "whatsapp" && (
                    <div className="space-y-2 pt-2">
                      <Label>WhatsApp Number</Label>
                      <Input
                        placeholder="+1234567890"
                        value={formData.whatsapp_number || ""}
                        className="bg-background"
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            whatsapp_number: e.target.value,
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Include country code.
                      </p>
                    </div>
                  )}

                  {formData.action_type === "form_order" && (
                    <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between">
                        <Label>Select Checkout Form</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] border-dashed"
                          onClick={() => setIsFormManagerOpen(true)}
                        >
                          <Settings className="w-3 h-3 mr-1" /> Manage Forms
                        </Button>
                      </div>
                      <select
                        className="flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm focus:ring-2"
                        value={formData.form_id || ""}
                        onChange={(e) => {
                          const newFormId = e.target.value;
                          setFormData({
                            ...formData,
                            form_id: newFormId,
                          });
                          setLocalDirectForm(newFormId);
                        }}
                      >
                        <option value="">-- Select a Checkout Form --</option>
                        {savedForms.filter(f => !formData.portfolio_id || f.portfolio_id === formData.portfolio_id).map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.action_type === "cart" && (
                    <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-amber-600 dark:text-amber-500 font-bold flex items-center gap-1.5"><AlertTriangle size={14} /> Global Cart Checkout Form</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] border-dashed"
                          onClick={() => setIsFormManagerOpen(true)}
                        >
                          <Settings className="w-3 h-3 mr-1" /> Manage Forms
                        </Button>
                      </div>
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
                        <select
                          className="flex h-10 w-full items-center justify-between rounded-md border border-amber-500/30 bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/50"
                          value={formData.form_id || ""}
                          onChange={(e) => {
                            const newFormId = e.target.value;
                          setFormData({
                            ...formData,
                            form_id: newFormId,
                          });
                          const siteKey = formData.portfolio_id || "global";
                          setGlobalCartForms(prev => ({ ...prev, [siteKey]: newFormId }));
                          }}
                        >
                          <option value="">-- Select a Global Cart Form --</option>
                          {savedForms.filter(f => !formData.portfolio_id || f.portfolio_id === formData.portfolio_id).map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {formData.action_type === "link" && (
                    <div className="space-y-2 pt-2">
                      <Label>External Checkout URL</Label>
                      <Input
                        placeholder="https://your-external-site.com"
                        value={formData.checkout_url || ""}
                        className="bg-background"
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            checkout_url: e.target.value,
                          })
                        }
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-24 border border-dashed rounded-xl bg-muted/10">
          <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">Add your first product</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Start building your store by adding physical items, digital
            downloads, or services.
          </p>
          <Button onClick={() => initForm()}>
            <Plus className="w-4 h-4 mr-2" /> Add Product
          </Button>
        </div>
      ) : (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden animate-in fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Product</th>
                  <th className="px-6 py-4 font-medium">Store</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Collection</th>
                  <th className="px-6 py-4 font-medium">Type & Tag</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.filter((p) => (selectedSiteId === "all" || p.portfolio_id === selectedSiteId) && (selectedStatus === "all" || p.status === selectedStatus)).map((product) => {
                  const productPortfolio = portfolios.find((p) => p.id === product.portfolio_id);
                  const siteSlug = productPortfolio ? productPortfolio.public_slug : (portfolios[0]?.public_slug || "portfolio");
                  const productUrl = `/pro/${siteSlug}/product/${product.slug || product.id}`;
                  const collection = collections.find((c) => c.id === product.collection_id);

                  return (
                  <tr
                    key={product.id}
                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => initForm(product)}
                  >
                    <td className="px-6 py-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-md border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {product.images?.[0] ? (
                          product.images[0].match(/\.(mp4|webm|mov)$/i) ? (
                            <video src={product.images[0]} className="w-full h-full object-cover" muted loop playsInline />
                          ) : (
                            <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                          )
                        ) : (
                          <ImageIcon className="w-5 h-5 text-muted-foreground opacity-30" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-base truncate max-w-[200px] flex items-center gap-2" title={product.title}>
                          {product.delivery_type === 'digital' && <FileDown size={14} className="text-blue-500 shrink-0"/>}
                          {product.delivery_type === 'service' && <ListPlus size={14} className="text-purple-500 shrink-0"/>}
                          {(!product.delivery_type || product.delivery_type === 'physical') && <Package size={14} className="text-emerald-500 shrink-0"/>}
                          {product.title}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="font-mono font-medium">${product.price.toFixed(2)}</span>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 uppercase tracking-wider bg-muted/50 ${product.track_inventory && product.stock_count <= 0 ? 'border-destructive text-destructive bg-destructive/10' : ''}`}>
                            {product.track_inventory ? `Qty: ${product.stock_count}` : 'Qty: ∞'}
                          </Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {productPortfolio?.site_name || productPortfolio?.public_slug || "Global"}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          product.status === "active" ? "default" : "secondary"
                        }
                        className={
                          product.status === "active"
                            ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 shadow-none"
                            : ""
                        }
                      >
                        {product.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {collection?.title || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant="outline" className={cn("uppercase tracking-widest text-[9px] font-bold shadow-sm", product.delivery_type === 'digital' ? "bg-blue-500/10 text-blue-600 border-blue-500/30" : product.delivery_type === 'service' ? "bg-purple-500/10 text-purple-600 border-purple-500/30" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30")}>
                          {product.delivery_type || 'physical'}
                        </Badge>
                        {product.product_type && (
                          <span className="text-[10px] text-muted-foreground font-medium">{product.product_type}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                        {product.action_type === 'whatsapp' ? 'WhatsApp' : product.action_type === 'form_order' ? 'Direct Form' : product.action_type === 'link' ? 'Ext. Link' : 'Cart'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          title="View Product Page"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a href={productUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleToggleStatus(product); }}
                          title={product.status === "active" ? "Set to Draft" : "Set to Active"}
                        >
                          {product.status === "active" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleDuplicate(product); }}
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); initForm(product); }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormManager
        isOpen={isFormManagerOpen}
        onClose={() => setIsFormManagerOpen(false)}
        actorId={actorId}
        portfolioId={formData.portfolio_id || portfolios[0]?.id || ""}
        onFormsChange={fetchForms}
      />
    </div>
  );
}
