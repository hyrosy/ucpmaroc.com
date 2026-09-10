import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/supabaseClient";
import { useOutletContext } from "react-router-dom";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";

// --- shadcn/ui Imports ---
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// ---

import {
  Save,
  Loader2,
  Star,
  Briefcase,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
} from "lucide-react";

// --- Interfaces ---
interface ActorProfile {
  id: string;
  ActorName: string;
  bio: string;
  Gender: string;
  slug: string;
  Language: string;
  Tags: string;
  HeadshotURL?: string;
  country?: string;
  marketplace_status?: string;
  bank_name?: string | null;
  bank_holder_name?: string | null;
  bank_iban?: string | null;
  bank_account_number?: string | null;
  direct_payment_enabled?: boolean;
  direct_payment_requested?: boolean;
}

// --- Hardcoded Options ---
const genderOptions = ["Male", "Female"];
const languageOptions = ["Arabic", "English", "French", "Spanish"];
const tagOptions = ["Warm", "Deep", "Conversational", "Corporate"];
const countryOptions = [
  "United States",
  "United Kingdom",
  "Canada",
  "Morocco",
  "France",
  "Spain",
  "Other",
];

const DashboardProfile: React.FC = () => {
  const { actorData: layoutActorData } =
    useOutletContext<ActorDashboardContextType>();

  const [profile, setProfile] = useState<Partial<ActorProfile>>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Eligibility State
  const [completedOrderCount, setCompletedOrderCount] = useState<number>(0);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState<boolean>(true);

  const fetchProfileData = useCallback(async () => {
    if (!layoutActorData.id) return;
    setLoading(true);
    setEligibilityLoading(true);

    const { data: fullProfile, error } = await supabase
      .from("actors")
      .select(
        "id, ActorName, bio, Gender, slug, Language, Tags, HeadshotURL, bank_name, bank_holder_name, bank_iban, bank_account_number, direct_payment_enabled, direct_payment_requested, country, marketplace_status"
      )
      .eq("id", layoutActorData.id)
      .single();

    if (error) {
      console.error("Error fetching full profile:", error);
      setMessage(`Error: ${error.message}`);
    } else if (fullProfile) {
      setProfile(fullProfile);
    }
    setLoading(false);

    try {
      const { count: orderCount } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("actor_id", layoutActorData.id)
        .eq("status", "Completed");
      setCompletedOrderCount(orderCount ?? 0);
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("rating")
        .eq("actor_id", layoutActorData.id);
      if (reviewsData && reviewsData.length > 0) {
        const totalRating = reviewsData.reduce(
          (sum, review) => sum + review.rating,
          0
        );
        setAverageRating(
          parseFloat((totalRating / reviewsData.length).toFixed(1))
        );
      } else {
        setAverageRating(null);
      }
    } catch (error) {
      console.error("Error fetching eligibility data:", error);
    } finally {
      setEligibilityLoading(false);
    }
  }, [layoutActorData.id]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setProfile({ ...profile, [name]: value });
  };

  const handleSelectChange = (name: string, value: string) => {
    setProfile({ ...profile, [name]: value });
  };

  const handleTagToggle = (tagToToggle: string) => {
    const currentTags = profile.Tags
      ? profile.Tags.split(",").map((t) => t.trim())
      : [];
    const newTags = currentTags.includes(tagToToggle)
      ? currentTags.filter((t) => t !== tagToToggle)
      : [...currentTags, tagToToggle];
    setProfile({ ...profile, Tags: newTags.join(", ") });
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !profile.id) return;
    setUploadingAvatar(true);
    setMessage("");
    try {
      const filePath = profile.id;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);
      const newAvatarUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;

      const { error: updateError } = await supabase
        .from("actors")
        .update({ HeadshotURL: newAvatarUrl })
        .eq("id", profile.id);
      if (updateError) throw updateError;

      setProfile((prev) => ({ ...prev, HeadshotURL: newAvatarUrl }));
      setMessage("Profile picture updated!");
    } catch (error) {
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleApplyToMarketplace = async () => {
    if (!profile.id) return;
    setIsSaving(true);
    setMessage("Submitting application...");
    try {
      const { error } = await supabase
        .from("actors")
        .update({ marketplace_status: "pending" })
        .eq("id", profile.id);
      if (error) throw error;
      setProfile((prev) => ({ ...prev, marketplace_status: "pending" }));
      setMessage("Application submitted! We will review it shortly.");
    } catch (error) {
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestDirectPayment = async () => {
    setMessage("");
    if (!profile.id) return;
    setMessage("Sending request...");
    try {
      const { error } = await supabase
        .from("actors")
        .update({ direct_payment_requested: true })
        .eq("id", profile.id);
      if (error) throw error;
      setProfile((prev) => ({ ...prev, direct_payment_requested: true }));
      setMessage("Request sent successfully! An admin will review it.");
    } catch (error) {
      setMessage(`Failed to send request: ${(error as Error).message}`);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.id) return;

    setIsSaving(true);
    setMessage("Saving...");

    const cleanedSlug = (profile.slug || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-");

    const updatePayload = {
      ActorName: profile.ActorName,
      Gender: profile.Gender,
      Language: profile.Language,
      slug: cleanedSlug,
      Tags: profile.Tags,
      bio: profile.bio,
      country: profile.country,
      bank_name: profile.bank_name,
      bank_holder_name: profile.bank_holder_name,
      bank_iban: profile.bank_iban,
      bank_account_number: profile.bank_account_number,
    };

    const { error } = await supabase
      .from("actors")
      .update(updatePayload)
      .eq("id", profile.id);

    if (error) {
      if (
        error.message.includes(
          'duplicate key value violates unique constraint "actors_slug_key"'
        )
      ) {
        setMessage(
          "Error: This URL slug is already taken. Please choose another."
        );
      } else {
        setMessage(`Error: ${error.message}`);
      }
    } else {
      setProfile((prev) => ({ ...prev, slug: cleanedSlug }));
      setMessage("Profile updated successfully!");
    }
    setIsSaving(false);
  };

  if (loading) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        Loading profile...
      </div>
    );
  }

  const isMoroccan = profile.country === "Morocco";
  const isApprovedMarketplace = profile.marketplace_status === "approved";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 md:px-8">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-primary">Talent workspace</p>
          <h1 className="text-4xl font-black tracking-tight">Your public profile</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Shape how clients discover you, understand your expertise, and decide to start a project.</p>
        </div>
        {profile.slug && (
          <Button type="button" variant="outline" asChild className="gap-2">
            <a href={`/actor/${profile.slug}`} target="_blank" rel="noreferrer">View public profile <ExternalLink className="h-4 w-4" /></a>
          </Button>
        )}
      </div>
      {message && (
        <div role={message.startsWith("Error") || message.startsWith("Failed") ? "alert" : "status"} aria-live="polite" className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-3 text-center text-sm font-medium">
          {message}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/80">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-primary/10 p-3 text-primary"><Briefcase className="h-5 w-5" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Marketplace</p><p className="font-bold">{isApprovedMarketplace ? "Active" : profile.marketplace_status === "pending" ? "Under review" : "Not active"}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-amber-500/10 p-3 text-amber-600"><Star className="h-5 w-5" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rating</p><p className="font-bold">{averageRating?.toFixed(1) ?? "New profile"}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Completed work</p><p className="font-bold">{completedOrderCount} orders</p></div>
          </CardContent>
        </Card>
      </div>

      <form onSubmit={handleSaveAll}>
        <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
          <CardContent className="p-0">
            {/* Header / Avatar Area */}
            <div className="flex flex-col gap-5 border-b bg-muted/30 px-6 py-8 sm:flex-row sm:items-center md:px-10">
              <Avatar className="h-28 w-28 border-4 border-background shadow-md sm:h-32 sm:w-32">
                <AvatarImage
                  src={profile.HeadshotURL || "https://via.placeholder.com/150"}
                  alt={profile.ActorName}
                />
                <AvatarFallback>{profile.ActorName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{profile.country || "Add your country"} {profile.Language ? `· ${profile.Language}` : ""}</div>
                <h2 className="text-2xl font-bold">{profile.ActorName || "Your name"}</h2>
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                <Button
                  type="button"
                  variant="outline"
                  className="shadow-sm"
                  aria-label="Change profile picture"
                  asChild
                >
                  <span>
                    {uploadingAvatar ? (
                      <Loader2 className="animate-spin w-4 h-4 mr-2" />
                    ) : (
                      "Change Picture"
                    )}
                  </span>
                </Button>
                </Label>
              </div>
              <Input
                type="file"
                id="avatar-upload"
                className="hidden"
                accept="image/png, image/jpeg"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
              />
            </div>

            <Tabs defaultValue="info" className="p-6">
              <TabsList className="grid w-full grid-cols-2 lg:w-fit lg:min-w-[400px] mb-8 bg-muted/50">
                <TabsTrigger value="info">Basic Info</TabsTrigger>
                {isMoroccan && !isApprovedMarketplace && (
                  <TabsTrigger
                    value="agency"
                    className="text-amber-600 data-[state=active]:text-amber-700"
                  >
                    Apply to Agency
                  </TabsTrigger>
                )}
                {isApprovedMarketplace && (
                  <TabsTrigger value="payout">Payout Settings</TabsTrigger>
                )}
              </TabsList>

              {/* === TAB 1: BASIC INFO === */}
              <TabsContent value="info" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="ActorName">Display Name</Label>
                    <Input
                      id="ActorName"
                      name="ActorName"
                      value={profile.ActorName || ""}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Username / URL</Label>
                    <Input
                      id="slug"
                      name="slug"
                      value={profile.slug || ""}
                      onChange={handleInputChange}
                      placeholder="e.g., your-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select
                      name="country"
                      value={profile.country || ""}
                      onValueChange={(value) =>
                        handleSelectChange("country", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Where are you located?" />
                      </SelectTrigger>
                      <SelectContent>
                        {countryOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="Language">Primary Language</Label>
                    <Select
                      name="Language"
                      value={profile.Language}
                      onValueChange={(value) =>
                        handleSelectChange("Language", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select language..." />
                      </SelectTrigger>
                      <SelectContent>
                        {languageOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 🚀 ONLY SHOW TAGS IF APPROVED FOR MARKETPLACE */}
                  {isApprovedMarketplace && (
                    <div className="md:col-span-2 space-y-2">
                      <Label>Voiceover Tags</Label>
                      <div className="flex flex-wrap gap-2">
                        {tagOptions.map((tag) => {
                          const isSelected = (profile.Tags || "").includes(tag);
                          return (
                            <Button
                              type="button"
                              key={tag}
                              variant={isSelected ? "default" : "secondary"}
                              size="sm"
                              onClick={() => handleTagToggle(tag)}
                            >
                              {tag}
                            </Button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        These tags help clients find you in the UCP Agency
                        directory.
                      </p>
                    </div>
                  )}

                  <div className="md:col-span-2 space-y-2">
                    {/* 🚀 DYNAMIC LABEL FOR BIO */}
                    <Label htmlFor="bio">
                      {isApprovedMarketplace
                        ? "Professional Bio & Experience"
                        : "Short Description"}
                    </Label>
                    <Textarea
                      id="bio"
                      name="bio"
                      rows={4}
                      value={profile.bio || ""}
                      onChange={handleInputChange}
                      placeholder={
                        isApprovedMarketplace
                          ? "Tell clients about your voiceover experience, studio setup, and specialties..."
                          : "Tell us a bit about yourself..."
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              {/* === TAB 2 (OPTIONAL): APPLY TO AGENCY === */}
              {isMoroccan && !isApprovedMarketplace && (
                <TabsContent value="agency" className="mt-0">
                  <div className="max-w-2xl mx-auto py-8 text-center space-y-6">
                    <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Briefcase size={32} />
                    </div>
                    <h2 className="text-2xl font-black">
                      Join the UCP Marketplace
                    </h2>
                    <p className="text-muted-foreground text-base">
                      We noticed you are located in Morocco! You are eligible to
                      apply as a freelance talent on the official UCP Agency
                      network.
                    </p>

                    <div className="bg-muted/50 p-6 rounded-2xl text-left space-y-4 my-8 border">
                      <h4 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">
                        Benefits
                      </h4>
                      <ul className="space-y-3">
                        <li className="flex items-center gap-3">
                          <CheckCircle2 className="text-green-500" size={18} />{" "}
                          Get hired directly by international clients.
                        </li>
                        <li className="flex items-center gap-3">
                          <CheckCircle2 className="text-green-500" size={18} />{" "}
                          Access the Order Dashboard and messaging.
                        </li>
                        <li className="flex items-center gap-3">
                          <CheckCircle2 className="text-green-500" size={18} />{" "}
                          Secure payouts to local Moroccan banks.
                        </li>
                      </ul>
                    </div>

                    {profile.marketplace_status === "pending" ? (
                      <div className="inline-flex items-center gap-2 px-6 py-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-bold">
                        <Clock size={18} /> Application under review by Admins
                      </div>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleApplyToMarketplace}
                        className="h-12 px-8 text-lg font-bold w-full sm:w-auto shadow-lg"
                        disabled={isSaving}
                      >
                        Submit Application
                      </Button>
                    )}
                  </div>
                </TabsContent>
              )}

              {/* === TAB 3 (OPTIONAL): PAYOUT SETTINGS (Only if Approved) === */}
              {isApprovedMarketplace && (
                <TabsContent value="payout" className="mt-0 space-y-8">
                  <div className="bg-green-50 text-green-800 border border-green-200 p-4 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="shrink-0 mt-0.5 text-green-600" />
                    <div>
                      <h4 className="font-bold text-sm">
                        Marketplace Account Active
                      </h4>
                      <p className="text-xs mt-1 opacity-90">
                        You are an approved UCP Freelancer. Manage your
                        withdrawal settings below.
                      </p>
                    </div>
                  </div>

                  <Card className="border-border/50 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Bank Account Details
                      </CardTitle>
                      <CardDescription>
                        Enter where you wish to receive direct payments for your
                        completed orders.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="bank_name">Bank Name</Label>
                        <Input
                          id="bank_name"
                          name="bank_name"
                          value={profile.bank_name || ""}
                          onChange={handleInputChange}
                          placeholder="e.g., Attijariwafa Bank"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bank_holder_name">
                          Account Holder Name
                        </Label>
                        <Input
                          id="bank_holder_name"
                          name="bank_holder_name"
                          value={profile.bank_holder_name || ""}
                          onChange={handleInputChange}
                          placeholder="Full name on account"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="bank_iban">IBAN</Label>
                        <Input
                          id="bank_iban"
                          name="bank_iban"
                          value={profile.bank_iban || ""}
                          onChange={handleInputChange}
                          placeholder="MA..."
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="bank_account_number">
                          Account Number (RIB)
                        </Label>
                        <Input
                          id="bank_account_number"
                          name="bank_account_number"
                          value={profile.bank_account_number || ""}
                          onChange={handleInputChange}
                          placeholder="Full account number"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Direct Payment Eligibility
                      </CardTitle>
                      <CardDescription>
                        Metrics required to process direct marketplace payouts.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {eligibilityLoading ? (
                        <div className="text-center p-4">
                          <Loader2 className="animate-spin mx-auto text-primary" />
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex gap-4">
                            <div className="flex-1 bg-muted/50 p-4 rounded-xl text-center border">
                              <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">
                                Completed Orders
                              </p>
                              <p className="text-2xl font-black">
                                {completedOrderCount}{" "}
                                <span className="text-sm font-medium text-muted-foreground">
                                  / 1
                                </span>
                              </p>
                            </div>
                            <div className="flex-1 bg-muted/50 p-4 rounded-xl text-center border">
                              <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">
                                Avg Rating
                              </p>
                              <p className="text-2xl font-black flex items-center justify-center gap-1">
                                {averageRating?.toFixed(1) ?? "N/A"}{" "}
                                <Star
                                  size={16}
                                  className="fill-amber-400 text-amber-500"
                                />
                              </p>
                            </div>
                          </div>

                          <div className="p-4 bg-background rounded-xl border text-center">
                            {(() => {
                              const isEligible =
                                completedOrderCount >= 1 &&
                                (averageRating ?? 0) > 3.0;
                              if (profile.direct_payment_enabled)
                                return (
                                  <p className="text-green-600 font-bold">
                                    ✅ Direct Payments Approved & Enabled
                                  </p>
                                );
                              if (profile.direct_payment_requested)
                                return (
                                  <p className="text-amber-600 font-bold">
                                    ⏳ Payout Request Pending Admin Approval
                                  </p>
                                );
                              if (isEligible)
                                return (
                                  <Button
                                    type="button"
                                    onClick={handleRequestDirectPayment}
                                    className="w-full sm:w-auto"
                                  >
                                    Request Payout Approval
                                  </Button>
                                );
                              return (
                                <p className="text-sm text-muted-foreground">
                                  Complete 1 order with a 3.0+ rating to request
                                  payouts.
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>

            <div className="p-6 border-t bg-muted/20 flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={isSaving}
                className="w-full sm:w-auto font-bold shadow-lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />{" "}
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-2" /> Save Profile Settings
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default DashboardProfile;
