import React, { useState, useEffect, useCallback, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Image as ImageIcon,
  X,
  UploadCloud,
  Layers,
} from "lucide-react";
import SiteFilter from "@/components/dashboard/SiteFilter";

interface Collection {
  id: string;
  title: string;
  slug: string;
  description: string;
  image: string;
  status: string;
  portfolio_id?: string | null;
}

export default function CollectionsPage() {
  const { actorData, selectedSiteId, setSelectedSiteId } = useOutletContext<ActorDashboardContextType>();
  const actorId = actorData?.id;

  const [collections, setCollections] = useState<Collection[]>([]);
  const [portfolios, setPortfolios] = useState<{ id: string; public_slug: string; site_name?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [view, setView] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Collection>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  };

  const fetchCollections = useCallback(async () => {
    if (!actorId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("pro_collections")
      .select("*")
      .eq("actor_id", actorId)
      .order("created_at", { ascending: false });

    if (!error && data) setCollections(data);
    setIsLoading(false);
  }, [actorId]);

  useEffect(() => {
    fetchCollections();
    if (actorId) {
      supabase
        .from("portfolios")
        .select("id, public_slug, site_name")
        .eq("actor_id", actorId)
        .then(({ data }) => {
          if (data) setPortfolios(data);
        });
    }
  }, [fetchCollections]);

  const initForm = (col?: Collection) => {
    setEditingId(col?.id || null);
    setFormData({
      title: col?.title || "",
      description: col?.description || "",
      image: col?.image || "",
      status: col?.status || "active",
      slug: col?.slug || "",
      portfolio_id: col?.portfolio_id || (selectedSiteId !== "all" ? selectedSiteId : ""),
    });
    setView("form");
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure? Products in this collection will not be deleted, but will be removed from the collection."
      )
    )
      return;

    const { error } = await supabase
      .from("pro_collections")
      .delete()
      .eq("id", id);
    if (!error) fetchCollections();
  };

  const handleSave = async () => {
    if (!formData.title) {
      alert("Title is required.");
      return;
    }

    if (!formData.portfolio_id) {
      alert("Please select a Store / Website for this collection.");
      return;
    }

    setIsSaving(true);

    const payload = {
      actor_id: actorId,
      title: formData.title,
      description: formData.description,
      image: formData.image || null,
      status: formData.status,
      slug: formData.slug || generateSlug(formData.title),
      portfolio_id: formData.portfolio_id,
    };

    let error;
    if (editingId) {
      const { error: updateErr } = await supabase
        .from("pro_collections")
        .update(payload)
        .eq("id", editingId);
      error = updateErr;
    } else {
      const { error: insertErr } = await supabase
        .from("pro_collections")
        .insert([payload]);
      error = insertErr;
    }

    if (error) {
      console.error("Error saving collection:", error);
      alert("Failed to save collection. Make sure the URL Slug is unique.");
    } else {
      setView("list");
      fetchCollections();
    }
    setIsSaving(false);
  };

  // --- SINGLE IMAGE UPLOAD HANDLER ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !actorId) return;

    setIsUploading(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${actorId}/collections/${fileName}`;

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
      setFormData({ ...formData, image: publicUrl });
    } else {
      alert("Failed to upload image.");
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!actorId) return null;

  return (
    <div className="p-4 md:p-8 max-w-8xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Collections</h1>
          <p className="text-muted-foreground mt-1">
            Group your products into categories for easier browsing.
          </p>
        </div>
        {view === "list" && (
          <div className="flex items-center gap-3 flex-wrap">
            <SiteFilter
              sites={portfolios.map(p => ({ id: p.id, site_name: p.site_name || p.public_slug }))}
              selectedSiteId={selectedSiteId}
              onChange={setSelectedSiteId}
            />
            <Button onClick={() => initForm()} className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Create Collection
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
              onClick={() => setView("list")}
              className="-ml-4 text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setView("list")}
                disabled={isSaving}
              >
                Discard
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{" "}
                Save Collection
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
            {/* LEFT COLUMN: Main Details */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <Label>
                      Store / Website <span className="text-destructive">*</span>
                    </Label>
                    <select
                      className="flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm focus:ring-2"
                      value={formData.portfolio_id || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, portfolio_id: e.target.value })
                      }
                    >
                      <option value="" disabled>
                        -- Select a Store / Website --
                      </option>
                      {portfolios.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.site_name || p.public_slug}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Summer Collection, E-Books, Accessories"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="Describe what makes this collection special..."
                      className="min-h-[150px]"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Collection Image</CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  {formData.image ? (
                    <div className="relative aspect-video rounded-md overflow-hidden border group w-full max-w-md bg-muted">
                      <img
                        src={formData.image}
                        className="w-full h-full object-cover"
                        alt="Collection Banner"
                      />
                      <button
                        onClick={() => setFormData({ ...formData, image: "" })}
                        className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                          <p className="text-sm font-medium">
                            Uploading image...
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="bg-primary/10 p-3 rounded-full mb-3">
                            <UploadCloud className="w-6 h-6 text-primary" />
                          </div>
                          <p className="text-sm font-medium mb-1">
                            Click to upload banner image
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Used for collection headers and thumbnails.
                          </p>
                        </>
                      )}
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN: Organization */}
            <div className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Visibility</CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <select
                    className="w-full h-10 px-3 border rounded-md bg-background focus:ring-2"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                  >
                    <option value="active">Active (Visible)</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">
                    Search Engine Optimization
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  <div className="space-y-2">
                    <Label>URL Slug</Label>
                    <Input
                      placeholder="e.g. summer-collection"
                      value={formData.slug || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          slug: generateSlug(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground break-all">
                      Link: /shop/collections/
                      <strong>{formData.slug || "collection-name"}</strong>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-24 border border-dashed rounded-xl bg-muted/10">
          <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">
            Create your first collection
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Group your products by season, type, or theme to make shopping
            easier for your customers.
          </p>
          <Button onClick={() => initForm()}>
            <Plus className="w-4 h-4 mr-2" /> Create Collection
          </Button>
        </div>
      ) : (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden animate-in fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Collection</th>
                  <th className="px-6 py-4 font-medium">Store</th>
                  <th className="px-6 py-4 font-medium">URL Slug</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {collections.filter((c) => selectedSiteId === "all" || c.portfolio_id === selectedSiteId).map((col) => {
                  const port = portfolios.find(p => p.id === col.portfolio_id);
                  return (
                    <tr
                      key={col.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      <td className="px-6 py-4 flex items-center gap-4">
                        <div className="w-16 h-12 rounded-md border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {col.image ? (
                            <img
                              src={col.image}
                              alt={col.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-muted-foreground opacity-30" />
                          )}
                        </div>
                        <div className="font-semibold text-base">{col.title}</div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-sm">
                        {port?.site_name || port?.public_slug || "Orphaned"}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        /{col.slug}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                        variant={
                          col.status === "active" ? "default" : "secondary"
                        }
                        className={
                          col.status === "active"
                            ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 shadow-none"
                            : ""
                        }
                      >
                        {col.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${col.title}`}
                          onClick={() => initForm(col)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${col.title}`}
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(col.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
