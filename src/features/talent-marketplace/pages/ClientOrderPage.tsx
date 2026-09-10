// In src/pages/ClientOrderPage.tsx

import React, { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import {
  Download,
  Check,
  RotateCcw,
  Banknote,
  FileText,
  Package,
  MessageSquare,
  Copy,
  CreditCard,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Star,
  Bell,
  Info,
  Send,
  Wallet,
  History,
  Mic,
  PencilLine,
  Video, // --- Added service icons ---
  RefreshCw,
  LinkIcon,
} from "lucide-react";
import AccordionItem from "@/components/AccordionItem";
import { ChatBox } from "@/features/messaging";
import emailjs from "@emailjs/browser";

// --- shadcn/ui Imports ---
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { StripeCheckoutForm } from "@/features/ecommerce";
import { ScrollArea } from "@/components/ui/scroll-area"; // --- Added ScrollArea ---
import { Textarea } from "@/components/ui/textarea"; // --- Added Textarea for reviews ---
import { useTheme } from "next-themes"; // --- Added useTheme ---
import { DialogHeader } from "@/components/ui/dialog";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@radix-ui/react-dialog";
import ProjectMaterialsUploader from "@/components/ProjectMaterialsUploader"; // <-- Import new component

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// --- 1. UPDATED Order Interface (to match OrderDetailsModal) ---
interface Order {
  id: string;
  order_id_string: string;
  client_name: string;
  client_email: string; // Added this
  status: string;
  script: string;
  final_audio_url?: string;
  actor_id: string; // Added this
  actors: {
    id: string; // Added this
    ActorEmail: any;
    ActorName: string;
    revisions_allowed: number;
    direct_payment_enabled?: boolean;
    bank_name?: string | null;
    bank_holder_name?: string | null;
    bank_iban?: string | null;
    bank_account_number?: string | null;
    HeadshotURL?: string; // Added for display
  };
  deliveries: {
    id: number;
    file_url: string;
    created_at: string;
    version_number: number;
  }[]; // Added version_number
  revisions_used: number; // Added this

  // Service & Quote Fields
  service_type: string;
  total_price: number | null; // This is the key field
  word_count?: number;
  usage?: string | null;
  quote_est_duration?: string | null;
  quote_video_type?: string | null;
  quote_footage_choice?: string | null;

  // Joined Offer data
  offers: Offer[];
  latest_offer: Offer | null;
  last_message_sender_role: "client" | "actor" | null;
  actor_has_unread_messages: boolean;
  client_has_unread_messages: boolean;
  from_chat_offer: boolean;
  material_file_urls: string[] | null; // <-- ADD THIS
  project_notes: string | null; // <-- ADD THIS
}
// (Interfaces for Offer and Review are unchanged)
interface Offer {
  id: string;
  created_at: string;
  offer_title: string;
  offer_agreement: string | null;
  offer_price: number;
}
interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}
// --- End Interfaces ---

// (Bank details and helper maps are unchanged)
const bankOptions = [
  {
    name: "Attijariwafa Bank",
    holder: "Coming Soon",
    iban: "Coming Soon",
    accountNumber: "Coming Soon",
  },
  {
    name: "CIH Bank",
    holder: "HAMZA KADIRI ELMAANA",
    iban: "MA64 2304 5025 9646 2211 0019 0095",
    accountNumber: "2596462211001900",
  },
];

const serviceIcons = {
  voice_over: <Mic className="h-5 w-5" />,
  scriptwriting: <PencilLine className="h-5 w-5" />,
  video_editing: <Video className="h-5 w-5" />,
};

const statusColors: { [key: string]: string } = {
  Completed: "bg-green-500/20 text-green-300",
  "Awaiting Actor Confirmation":
    "bg-yellow-500/20 text-yellow-300 animate-pulse",
  "Awaiting Payment": "bg-yellow-500/20 text-yellow-300 animate-pulse",
  awaiting_offer: "bg-blue-500/20 text-blue-300",
  offer_made: "bg-primary/20 text-primary animate-pulse",
  "In Progress": "bg-blue-500/20 text-blue-300",
  "Pending Approval": "bg-primary/20 text-primary animate-pulse",
  default: "bg-muted-foreground/20 text-muted-foreground",
};

// --- ADD THIS HELPER COMPONENT ---
const MaterialsDisplay: React.FC<{
  script: string | null;
  fileUrls: string[] | null;
}> = ({ script, fileUrls }) => {
  if (!script && (!fileUrls || fileUrls.length === 0)) {
    return (
      <p className="text-muted-foreground">
        The client has not uploaded any materials yet.
      </p>
    );
  }

  const scriptText = script?.trim();
  const fileLinks = fileUrls || [];

  return (
    <div className="space-y-4">
      {scriptText && (
        <div>
          <h4 className="font-semibold text-foreground mb-2">
            Project Details / Notes
          </h4>
          <p className="text-muted-foreground whitespace-pre-wrap">
            {scriptText}
          </p>
        </div>
      )}

      {fileLinks.length > 0 && (
        <div>
          <h4 className="font-semibold text-foreground mb-3">Attached Files</h4>
          <div className="space-y-2">
            {fileLinks.map((url, index) => (
              <Button
                key={index}
                asChild
                variant="outline"
                className="w-full justify-start text-left h-auto"
              >
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <LinkIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{url.split("/").pop()}</span>
                </a>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
// --- END HELPER COMPONENT ---

const ClientOrderPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { theme } = useTheme(); // For Stripe
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [copySuccess, setCopySuccess] = useState("");
  const [expandedBank, setExpandedBank] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState({
    // payment: true, // This will be moved to the sidebar
    script: false,
    deliveries: true,
    // communication: true, // This will be moved to the sidebar
    quote_details: true,
    offer_history: true,
  });

  // Review State
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewMessage, setReviewMessage] = useState<string>("");
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState<boolean>(true);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "bank" | null>(
    null
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isSettingUpStripe, setIsSettingUpStripe] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [notifyingAdmin, setNotifyingAdmin] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true); // This was duplicated, removed one

  // Local page message (avoid using global `onmessage`)
  const [pageMessage, setPageMessage] = useState<string | null>(null);

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // --- 3. UPDATED fetchOrderAndReview (to match actor modal) ---
  const fetchOrderAndReview = useCallback(async () => {
    if (!orderId) {
      setError("No order ID provided.");
      setLoading(false);
      return;
    }

    // Use new variable for this function's loading state
    setIsLoading(true);
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(
        `
                *,
                actors ( id, ActorName, ActorEmail, revisions_allowed, direct_payment_enabled, bank_name, bank_holder_name, bank_iban, bank_account_number, HeadshotURL ),
                deliveries ( id, file_url, created_at, version_number ),
                offers ( * )
            `
      )
      .eq("id", orderId)
      .order("created_at", { foreignTable: "deliveries", ascending: false })
      .order("created_at", { foreignTable: "offers", ascending: false }) // Get newest offer first
      .single();

    if (orderError) {
      setError("Order not found or you do not have permission.");
      console.error(orderError);
      setLoading(false);
      return;
    }

    // --- NEW: Process the offers (from your file) ---
    if (orderData.offers && orderData.offers.length > 0) {
      orderData.latest_offer = orderData.offers[0]; // Already sorted by query
    } else {
      orderData.latest_offer = null;
    }
    // ---

    setOrder(orderData as Order);
    setLoading(false);
    setIsLoading(false); // Make sure to set the page loading to false

    // Reset payment state on fetch
    setPaymentMethod(null);
    setClientSecret(null);
    setStatusMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setIsLoadingReview(false);
      return;
    }
    setIsLoggedIn(true);

    let clientProfileId: string | null = null;
    try {
      const { data: clientProfile } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id)
        .single();
      clientProfileId = clientProfile?.id ?? null;
    } catch (e) {
      /* ignore */
    }

    if (orderData.status === "Completed" && clientProfileId) {
      setIsLoadingReview(true);
      try {
        const { data: reviewData } = await supabase
          .from("reviews")
          .select("*")
          .eq("order_id", orderId)
          .eq("client_id", clientProfileId)
          .maybeSingle();
        if (reviewData) setExistingReview(reviewData as Review);
      } catch (e) {
        console.error("Exception checking review:", e);
      }
      setIsLoadingReview(false);
    } else {
      setIsLoadingReview(false);
    }
  }, [orderId]); // Use useCallback

  useEffect(() => {
    fetchOrderAndReview();
  }, [fetchOrderAndReview]); // Use the memoized function

  // --- ADD THIS NEW USE-EFFECT ---
  // This implements "Mark as Read" when the client opens the order page.
  useEffect(() => {
    const markAsRead = async () => {
      // This page is for the 'client', so we check and update the client's flag
      // We check `order` exists first.
      if (order && order.client_has_unread_messages) {
        const { error } = await supabase
          .from("orders")
          .update({
            actor_has_unread_messages: false,
            notification_due_at: null, // <-- ADD THIS LINE
          })
          .eq("id", order.id);

        if (error) {
          console.error("Error marking messages as read:", error);
        }
        // No need to re-fetch, just set the flag locally if needed
        // or let the subscription handle it.
      }
    };

    markAsRead();
    // Run this check whenever the order data (or the specific flag) changes
  }, [order?.id, order?.client_has_unread_messages]);
  // --- END ADD ---

  // --- handleAcceptOffer (THIS IS THE CRITICAL FIX) ---
  const handleAcceptOffer = async () => {
    if (!order || !order.latest_offer) {
      setStatusMessage("No offer to accept.");
      return;
    }

    const latestOffer = order.latest_offer;
    const finalPrice = latestOffer.offer_price;

    setIsLoading(true);
    setStatusMessage("");

    try {
      // Update the order with BOTH status and the final price
      const { error } = await supabase
        .from("orders")
        .update({
          status: "Awaiting Payment",
          total_price: finalPrice, // <-- THIS SAVES THE PRICE
        })
        .eq("id", order.id);

      if (error) throw error;

      // Send email to actor

      try {
        await emailjs.send(
          "service_r3pvt1s",
          "template_n2y66co", // Client Accepted Offer
          {
            orderId: order.order_id_string,
            order_uuid: order.id,
            clientName: order.client_name,
            actorName: order.actors.ActorName,
            actorEmail: order.actors.ActorEmail,
            offerPrice: finalPrice.toFixed(2),
            offerTitle: latestOffer.offer_title,
            offerAgreement: latestOffer.offer_agreement || "N/A",
          },
          "I51tDIHsXYKncMQpO"
        );

        setStatusMessage("Offer accepted! Please complete the payment.");
        fetchOrderAndReview(); // Re-fetch to show new status
      } catch (emailError) {
        console.error("Failed to send 'offer accepted' email:", emailError); // Just log it, don't stop the function
      } // --- END FIX --- // This will now run even if the email fails
      setStatusMessage("Offer accepted! Please complete the payment.");
      await fetchOrderAndReview(); // Add await to ensure it finishes before "finally"
    } catch (error) {
      // This will now only catch critical DB errors
      const err = error as Error;
      console.error("Error accepting offer:", err);
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  // --- END CRITICAL FIX ---

  // --- onSuccessfulStripePayment (THIS IS THE CRITICAL FIX) ---
  const onSuccessfulStripePayment = async (intentId: string) => {
    if (!order) return;

    const finalPrice = order.latest_offer?.offer_price ?? order.total_price;
    if (!finalPrice) {
      setStatusMessage(
        "Error: Order price is missing. Cannot confirm payment."
      );
      return;
    }

    setStatusMessage("Processing Payment...");
    try {
      const { data, error } = await supabase.functions.invoke("confirm-order-payment", {
        body: { orderId: order.id, paymentIntentId: intentId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Send notification email to Actor
      try {
        const emailParams = {
          actorName: order.actors.ActorName,
          actorEmail: order.actors.ActorEmail,
          orderIdString: order.order_id_string,
          clientName: order.client_name,
        };
        await emailjs.send(
          "service_r3pvt1s",
          "template_zmx5e0u",
          emailParams,
          "I51tDIHsXYKncMQpO"
        );
      } catch (emailError) {
        console.error("Failed to send actor notification email:", emailError);
      }

      setStatusMessage("Payment Successful! The order is now In Progress.");
      await fetchOrderAndReview(); // Add await here too
      setIsPaymentModalOpen(false);
    } catch (err) {
      // This will now only catch DB errors
      setStatusMessage(
        `Error: ${(err as Error).message}. Please contact support.`
      );
    }
  };
  // --- END CRITICAL FIX ---

  // --- handleBankTransferConfirmation (THIS IS THE CRITICAL FIX) ---
  const handleBankTransferConfirmation = async () => {
    if (!order) return;

    const finalPrice = order.latest_offer?.offer_price ?? order.total_price;
    if (!finalPrice) {
      setStatusMessage(
        "Error: Order price is missing. Cannot confirm payment."
      );
      return;
    }

    setStatusMessage("Updating order...");
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "Awaiting Payment", // Status is set when *accepting*
          payment_method: "bank",
          total_price: finalPrice, // --- Ensure price is saved ---
        })
        .eq("id", order.id);

      if (error) throw error;
      fetchOrderAndReview(); // Refresh to show the next step (bank details)
    } catch (err) {
      setStatusMessage(`Error: ${(err as Error).message}.`);
    }
  };
  // --- END CRITICAL FIX ---

  // (All other handlers are unchanged)
  const handleApproval = async () => {
    if (!order) return;
    await supabase
      .from("orders")
      .update({ status: "Completed" })
      .eq("id", order.id);
    fetchOrderAndReview(); // Refresh data
  };
  const handleRevisionRequest = async () => {
    if (!order) return;
    const newRevisionCount = order.revisions_used + 1;
    await supabase
      .from("orders")
      .update({ status: "In Progress", revisions_used: newRevisionCount })
      .eq("id", order.id);
    const emailParams = {
      orderId: order.order_id_string,
      actorName: order.actors.ActorName,
      actorEmail: order.actors.ActorEmail,
      clientName: order.client_name,
    };
    emailjs
      .send(
        "service_r3pvt1s",
        "template_w9k1a08",
        emailParams,
        "I51tDIHsXYKncMQpO"
      )
      .catch((err) => console.error("Failed to send revision email:", err));
    fetchOrderAndReview(); // Refresh data
  };
  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(`${fieldName} copied!`);
      setTimeout(() => setCopySuccess(""), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
      setCopySuccess(`Failed to copy ${fieldName}.`);
      setTimeout(() => setCopySuccess(""), 2000);
    }
  };
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || rating === 0) {
      setReviewMessage("Please select a star rating.");
      return;
    }
    if (!order.actors?.id) {
      setReviewMessage("Cannot submit review: Actor ID missing.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setReviewMessage("You must be logged in.");
      return;
    }
    const { data: clientProfile } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!clientProfile?.id) {
      setReviewMessage("Could not verify client profile.");
      return;
    }
    setIsSubmittingReview(true);
    setReviewMessage("");
    try {
      const { data: newReview, error } = await supabase
        .from("reviews")
        .insert({
          order_id: order.id,
          client_id: clientProfile.id,
          actor_id: order.actors.id,
          rating: rating,
          comment: comment.trim() || null,
        })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") {
          setReviewMessage(
            "You have already submitted a review for this order."
          );
          fetchOrderAndReview();
        } else {
          throw error;
        }
      } else {
        setExistingReview(newReview as Review);
        setReviewMessage("Review submitted successfully! Thank you.");
      }
    } catch (error) {
      const err = error as Error;
      console.error("Error submitting review:", err);
      setReviewMessage(`Error: ${err.message}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };
  const handleMarkAsPaid = async () => {
    if (!order) return;
    setNotifyingAdmin(true);
    setNotificationMessage("");

    // 1. CALL THE SECURE DATABASE FUNCTION
    // This bypasses RLS restrictions safely
    const { error: rpcError } = await supabase.rpc("confirm_client_payment", {
      p_order_id: order.id,
    });

    if (rpcError) {
      console.error("Failed to update order status:", rpcError);
      setNotificationMessage(`Error: ${rpcError.message}`);
      setNotifyingAdmin(false);
      return;
    }

    // 2. Database success! Now try email (Non-blocking)
    // We check the local state for the email logic, which is fine for notifications
    const isDirectToActor = order.actors?.direct_payment_enabled === true;

    if (isDirectToActor) {
      const templateId = "template_my3996b";
      const recipientEmail = order.actors.ActorEmail;
      const emailParams = {
        clientName: order.client_name,
        clientEmail: order.client_email,
        orderIdString: order.order_id_string,
        orderUUID: order.id,
        recipientEmail: recipientEmail,
        actorName: order.actors.ActorName,
      };

      try {
        await emailjs.send(
          "service_r3pvt1s",
          templateId,
          emailParams,
          "I51tDIHsXYKncMQpO"
        );
        setNotificationMessage("Payment confirmed & Actor notified!");
      } catch (err) {
        console.error("Failed to send actor notification:", err);
        // Valid success state, just missing email
        setNotificationMessage(
          "Payment confirmed! (Email failed, but actor will see it in dashboard)"
        );
      }
    } else {
      setNotificationMessage("Payment confirmed! Awaiting admin confirmation.");
    }

    // 3. Always refresh and finish
    await fetchOrderAndReview();
    setNotifyingAdmin(false);
  };
  const handleStripePaymentClick = async () => {
    if (!order) return;
    const amount = order.total_price; // Use the already-set price
    if (amount === null || amount === undefined) {
      setStatusMessage("No offer price available. Please contact support.");
      return;
    }
    setIsSettingUpStripe(true);
    setStatusMessage("Initializing secure payment...");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "create-payment-intent",
        {
          body: { orderId: order.id },
        }
      );
      if (invokeError) throw invokeError;
      if (data.error) throw new Error(data.error);
      if (!data.clientSecret)
        throw new Error("Payment client secret is missing.");

      setClientSecret(data.clientSecret);
      setIsPaymentModalOpen(true);
      setStatusMessage("");
    } catch (error) {
      setStatusMessage(`Error: ${(error as Error).message}. Please try again.`);
      setClientSecret(null);
    } finally {
      setIsSettingUpStripe(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        Loading Your Order...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-destructive">
        {error || "Could not load order."}
      </div>
    );
  }

  const latestDelivery = order.deliveries?.[0];
  const canRequestRevision =
    order.revisions_used < order.actors.revisions_allowed;

  // --- THIS IS THE CORRECTED PRICE LOGIC ---
  // The order's offer_price is the single source of truth.
  const displayPrice = order.latest_offer?.offer_price ?? order.total_price;
  // ---

  const currentStatus =
    order.status === "awaiting_offer" ? "Awaiting Offer" : order.status;
  const statusColorClass =
    statusColors[order.status as keyof typeof statusColors] ||
    statusColors.default;
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pt-20">
      {pageMessage && (
        <div className="mb-4 p-3 bg-card border rounded-lg text-center text-sm">
          {pageMessage}
        </div>
      )}

      <div className="max-w-8xl mx-auto flex flex-col-reverse lg:grid lg:grid-cols-3 gap-8 pt-20">
        {/* --- Left Column (Main Content) --- */}
        <div className="lg:col-span-2 space-y-6">
          {/* --- Order Header Card --- 
                    <Card>
                      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle className="text-3xl font-bold text-foreground mb-1">
                            {order.service_type === 'voice_over' ? `Order #${order.order_id_string}` : `Quote #${order.order_id_string}`}
                          </CardTitle>
                          <CardDescription className="text-base">
                            For: {order.actors.ActorName}
                          </CardDescription>
                        </div>
                        {isLoggedIn ? (
                          <Button asChild variant="ghost" className="mt-4 sm:mt-0">
                            <Link to="/client-dashboard">View All Orders</Link>
                          </Button>
                        ) : (
                          <Button asChild variant="ghost" className="mt-4 sm:mt-0">
                            <Link to="/client-auth" state={{ email: order.client_email }}>
                              Login to see all orders
                            </Link>
                          </Button>
                        )}
                      </CardHeader>
                    </Card>*/}

          {/* 2. Check if materials need to be uploaded */}
          {order.status === "In Progress" &&
            !order.project_notes &&
            !order.material_file_urls && (
              <Card>
                <CardHeader>
                  <CardTitle>Upload Your Project Materials</CardTitle>
                  <CardDescription>
                    Please upload your script, files, or any other materials the
                    actor needs to begin.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ProjectMaterialsUploader
                    order={order}
                    onUploadComplete={() => fetchOrderAndReview()}
                  />
                </CardContent>
              </Card>
            )}
          {/* 3. Check if materials can be *displayed* */}
          {(order.project_notes || order.material_file_urls) && (
            <AccordionItem
              title="Project Materials"
              icon={<FileText size={18} />}
              isOpen={true}
              onToggle={() => {}}
            >
              <div className="bg-card p-4 rounded-b-lg max-h-60 overflow-y-auto custom-scrollbar border-t">
                <MaterialsDisplay
                  script={order.project_notes}
                  fileUrls={order.material_file_urls}
                />
              </div>
            </AccordionItem>
          )}

          {/* --- Review Section (Completed) --- */}
          {order.status === "Completed" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star size={18} />{" "}
                  {existingReview ? "Your Review" : "Leave a Review"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingReview ? (
                  <p className="text-muted-foreground text-sm">
                    Loading review status...
                  </p>
                ) : existingReview ? (
                  <div className="space-y-3">
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={20}
                          className={`cursor-default ${
                            star <= existingReview.rating
                              ? "text-yellow-400 fill-current"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({existingReview.rating}/5 stars)
                      </span>
                    </div>
                    {existingReview.comment && (
                      <p className="text-muted-foreground bg-muted p-3 rounded text-sm italic">
                        "{existingReview.comment}"
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Reviewed on:{" "}
                      {new Date(existingReview.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleReviewSubmit} className="space-y-4">
                    <div>
                      <Label className="block text-sm font-medium text-muted-foreground mb-2">
                        Your Rating *
                      </Label>
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            type="button"
                            key={star}
                            aria-label={`Rate ${star} ${star === 1 ? "star" : "stars"}`}
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="p-1 text-muted-foreground/30 hover:text-yellow-400 transition-colors"
                          >
                            <Star
                              size={24}
                              className={`${
                                star <= (hoverRating || rating)
                                  ? "text-yellow-400 fill-current"
                                  : ""
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label
                        htmlFor="reviewComment"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        Your Comment (Optional)
                      </Label>
                      <Textarea
                        id="reviewComment"
                        rows={4}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Tell us about your experience..."
                      />
                    </div>
                    <div className="text-right">
                      {reviewMessage && (
                        <p
                          className={`text-sm mb-2 text-center ${
                            reviewMessage.includes("Error") ||
                            reviewMessage.includes("Failed")
                              ? "text-destructive"
                              : "text-green-400"
                          }`}
                        >
                          {reviewMessage}
                        </p>
                      )}
                      <Button
                        type="submit"
                        disabled={isSubmittingReview || rating === 0}
                      >
                        {isSubmittingReview ? "Submitting..." : "Submit Review"}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}

          {/* --- Order Details Accordions --- */}

          {order.script && (
            <div className="space-y-4">
              {order.service_type !== "voice_over" && (
                <AccordionItem
                  title="Quote Details"
                  icon={<Info size={18} />}
                  isOpen={openSections.quote_details}
                  onToggle={() => toggleSection("quote_details")}
                >
                  <div className="bg-card p-4 rounded-b-lg space-y-2 text-sm border-t">
                    {order.service_type === "scriptwriting" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Est. Video Duration:
                          </span>
                          <span className="font-semibold text-foreground">
                            {order.quote_est_duration || "N/A"} min
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Est. Word Count:
                          </span>
                          <span className="font-semibold text-foreground">
                            {order.word_count || "N/A"}
                          </span>
                        </div>
                      </>
                    )}
                    {order.service_type === "video_editing" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Video Type:
                          </span>
                          <span className="font-semibold text-foreground capitalize">
                            {order.quote_video_type || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Footage:
                          </span>
                          <span className="font-semibold text-foreground">
                            {order.quote_footage_choice === "has_footage"
                              ? "Client has footage"
                              : "Needs stock footage"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </AccordionItem>
              )}

              <AccordionItem
                title={
                  order.service_type === "voice_over"
                    ? "Script"
                    : "Project Description"
                }
                icon={<FileText size={18} />}
                isOpen={openSections.script}
                onToggle={() => toggleSection("script")}
              >
                <div className="bg-card p-4 rounded-b-lg max-h-60 overflow-y-auto custom-scrollbar border-t">
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {order.script}
                  </p>
                </div>
              </AccordionItem>

              <AccordionItem
                title="Deliveries"
                icon={<Package size={18} />}
                isOpen={openSections.deliveries}
                onToggle={() => toggleSection("deliveries")}
              >
                <div className="bg-card p-4 rounded-b-lg border-t">
                  {order.deliveries && order.deliveries.length > 0 ? (
                    <div className="space-y-6">
                      {order.deliveries.map((delivery, index) => (
                        <div
                          key={delivery.id || index}
                          className="bg-background p-4 rounded-lg"
                        >
                          <p className="font-semibold text-lg mb-2 text-foreground">
                            Version{" "}
                            {delivery.version_number ||
                              order.deliveries.length - index}
                            {index === 0 && (
                              <span className="text-xs text-primary ml-2">
                                (Latest)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mb-3">
                            Delivered on:{" "}
                            {new Date(delivery.created_at).toLocaleString()}
                          </p>
                          <audio
                            controls
                            src={delivery.file_url}
                            className="w-full mb-3"
                          ></audio>
                          <Button asChild variant="outline" size="sm">
                            <a href={delivery.file_url} download>
                              <Download size={16} className="mr-2" />
                              Download Version{" "}
                              {delivery.version_number ||
                                order.deliveries.length - index}
                            </a>
                          </Button>
                        </div>
                      ))}

                      {order.status === "Pending Approval" && (
                        <div className="mt-6 pt-6 border-t space-y-4">
                          <h3 className="text-lg font-semibold text-foreground">
                            Review & Confirm Latest Delivery
                          </h3>
                          <div className="flex flex-col sm:flex-row gap-4">
                            <Button
                              onClick={handleApproval}
                              size="lg"
                              className="w-full bg-green-600 hover:bg-green-700"
                            >
                              <Check size={20} className="mr-2" /> Accept
                              Delivery
                            </Button>
                            {canRequestRevision ? (
                              <Button
                                onClick={handleRevisionRequest}
                                size="lg"
                                variant="outline"
                                className="w-full"
                              >
                                <RotateCcw size={16} className="mr-2" /> Request
                                Revision (
                                {order.actors.revisions_allowed -
                                  order.revisions_used}{" "}
                                left)
                              </Button>
                            ) : (
                              <Button
                                size="lg"
                                variant="outline"
                                className="w-full"
                                disabled
                              >
                                <RotateCcw size={16} className="mr-2" /> No
                                revisions remaining
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      The actor has not delivered the files yet.
                    </p>
                  )}
                </div>
              </AccordionItem>
              {/* --- Communication Card --- */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare size={18} /> Communication
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ChatBox
                    orderId={order.id}
                    userRole="client"
                    orderData={{
                      last_message_sender_role: order.last_message_sender_role,
                      client_email: order.client_email,
                      client_name: order.client_name,
                      actor_email: order.actors.ActorEmail || "",
                      actor_name: order.actors.ActorName,
                      order_id_string: order.order_id_string,
                    }}
                    conversationId={""}
                    currentUserId={""}
                    otherUserName={""}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* --- Right Column (Sticky Sidebar) --- */}
        <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24 h-fit">
          {/* --- Status Card --- */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-foreground mb-1">
                  {order.service_type === "voice_over"
                    ? `Order #${order.order_id_string}`
                    : `Quote #${order.order_id_string}`}
                </CardTitle>
                <CardDescription className="text-base mb-1">
                  For: {order.actors.ActorName}
                </CardDescription>
                {isLoggedIn ? (
                  <Link to="/client-dashboard">View All Orders</Link>
                ) : (
                  <Button asChild variant="ghost" className="mt-4 sm:mt-0">
                    <Link
                      to="/client-auth"
                      state={{ email: order.client_email }}
                    >
                      Login to see all orders
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Order Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${statusColorClass}`}
                >
                  {currentStatus}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Service</span>
                <span className="font-semibold capitalize text-foreground">
                  {order.service_type.replace("_", " ")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Price</span>
                <span className="font-bold text-2xl text-primary">
                  {displayPrice
                    ? `${displayPrice.toFixed(2)} MAD`
                    : "Not Quoted"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* --- Action Card: Accept Offer --- */}
          {order.status === "offer_made" && order.latest_offer && (
            <Card className="animate-in fade-in duration-300 border-primary shadow-lg shadow-primary/10">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Banknote className="text-primary" /> Your Quote is Ready
                </CardTitle>
                <CardDescription>
                  {order.actors.ActorName} has sent you an offer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Card className="bg-muted/50">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">
                      {order.latest_offer.offer_title}
                    </CardTitle>
                    <CardDescription>
                      {new Date(order.latest_offer.created_at).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {order.latest_offer.offer_agreement && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-4">
                        {order.latest_offer.offer_agreement}
                      </p>
                    )}
                    <div className="text-right">
                      <Label className="text-sm text-muted-foreground">
                        Total Price
                      </Label>
                      <p className="text-4xl font-bold text-primary">
                        {order.latest_offer.offer_price.toFixed(2)} MAD
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Button
                  onClick={handleAcceptOffer}
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Accept Offer & Proceed to Payment
                </Button>
              </CardContent>
            </Card>
          )}

          {/* --- Action Card: Awaiting Payment --- */}
          {order.status === "Awaiting Payment" && (
            <Card className="animate-in fade-in duration-300 border-yellow-500/50">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Wallet className="text-yellow-400" /> Complete Your Payment
                </CardTitle>
                <CardDescription>
                  Please choose your preferred payment method to begin the
                  order.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={paymentMethod || ""}
                  onValueChange={(val) =>
                    setPaymentMethod(val as "stripe" | "bank")
                  }
                >
                  <Card
                    className={`transition hover:border-primary cursor-pointer ${
                      paymentMethod === "stripe"
                        ? "border-primary bg-accent"
                        : ""
                    }`}
                  >
                    <Label
                      htmlFor="r-stripe"
                      className="flex items-center gap-4 p-4 cursor-pointer"
                    >
                      <RadioGroupItem value="stripe" id="r-stripe" />
                      <CreditCard className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-semibold">Pay by Card (Stripe)</p>
                        <p className="text-sm text-muted-foreground">
                          Securely pay with your credit/debit card.
                        </p>
                      </div>
                    </Label>
                  </Card>
                  <Card
                    className={`transition hover:border-primary cursor-pointer ${
                      paymentMethod === "bank" ? "border-primary bg-accent" : ""
                    }`}
                  >
                    <Label
                      htmlFor="r-bank"
                      className="flex items-center gap-4 p-4 cursor-pointer"
                    >
                      <RadioGroupItem value="bank" id="r-bank" />
                      <Banknote className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-semibold">Bank Transfer</p>
                        <p className="text-sm text-muted-foreground">
                          Pay manually and notify the{" "}
                          {order.actors.direct_payment_enabled
                            ? "actor"
                            : "admin"}
                          .
                        </p>
                      </div>
                    </Label>
                  </Card>
                </RadioGroup>

                {statusMessage && (
                  <p
                    className={`text-center text-sm ${
                      statusMessage.includes("Error")
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {statusMessage}
                  </p>
                )}

                {paymentMethod === "stripe" && (
                  <Button
                    onClick={handleStripePaymentClick}
                    disabled={isSettingUpStripe}
                    className="w-full"
                    size="lg"
                  >
                    {isSettingUpStripe ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="mr-2 h-4 w-4" />
                    )}
                    Proceed to Stripe
                  </Button>
                )}

                {paymentMethod === "bank" && (
                  <AccordionItem
                    title="Bank Transfer Details"
                    icon={<Info size={18} />}
                    isOpen={true}
                    onToggle={() => {}}
                  >
                    <div className="bg-card p-4 rounded-b-lg border-t space-y-4">
                      <p className="text-muted-foreground text-sm">
                        Please complete the payment using the details below. Use
                        your Order ID (
                        <strong className="text-foreground">
                          {order.order_id_string}
                        </strong>
                        ) as the payment reference.
                      </p>

                      {order.actors?.direct_payment_enabled ? (
                        // Actor's Bank Details
                        <div className="bg-background p-4 rounded-lg text-sm space-y-2 relative text-muted-foreground">
                          <p className="text-xs text-primary font-semibold mb-2">
                            Please pay the actor directly:
                          </p>
                          <div className="flex justify-between items-center group">
                            <span>
                              <strong className="font-semibold text-muted-foreground w-28 inline-block">
                                Bank Name:
                              </strong>{" "}
                              {order.actors.bank_name || "N/A"}
                            </span>
                            {order.actors.bank_name && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  copyToClipboard(
                                    order.actors.bank_name!,
                                    "Bank Name"
                                  )
                                }
                              >
                                <Copy size={14} />
                              </Button>
                            )}
                          </div>
                          <div className="flex justify-between items-center group">
                            <span>
                              <strong className="font-semibold text-muted-foreground w-28 inline-block">
                                Account Holder:
                              </strong>{" "}
                              {order.actors.bank_holder_name || "N/A"}
                            </span>
                            {order.actors.bank_holder_name && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  copyToClipboard(
                                    order.actors.bank_holder_name!,
                                    "Account Holder"
                                  )
                                }
                              >
                                <Copy size={14} />
                              </Button>
                            )}
                          </div>
                          <div className="flex justify-between items-center group">
                            <span>
                              <strong className="font-semibold text-muted-foreground w-28 inline-block">
                                IBAN:
                              </strong>{" "}
                              {order.actors.bank_iban || "N/A"}
                            </span>
                            {order.actors.bank_iban && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  copyToClipboard(
                                    order.actors.bank_iban!,
                                    "IBAN"
                                  )
                                }
                              >
                                <Copy size={14} />
                              </Button>
                            )}
                          </div>
                          <div className="flex justify-between items-center group">
                            <span>
                              <strong className="font-semibold text-muted-foreground w-28 inline-block">
                                Account No (RIB):
                              </strong>{" "}
                              {order.actors.bank_account_number || "N/A"}
                            </span>
                            {order.actors.bank_account_number && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  copyToClipboard(
                                    order.actors.bank_account_number!,
                                    "Account Number"
                                  )
                                }
                              >
                                <Copy size={14} />
                              </Button>
                            )}
                          </div>
                          {copySuccess && (
                            <p className="text-xs text-green-400 text-right">
                              {copySuccess}
                            </p>
                          )}
                        </div>
                      ) : (
                        // Agency Bank Details
                        <div className="space-y-2 relative">
                          {bankOptions.map((bank) => (
                            <div
                              key={bank.name}
                              className="bg-background rounded-lg border overflow-hidden"
                            >
                              <button
                                onClick={() =>
                                  setExpandedBank(
                                    expandedBank === bank.name
                                      ? null
                                      : bank.name
                                  )
                                }
                                className="w-full flex justify-between items-center p-3 text-left hover:bg-muted/50 transition-colors"
                              >
                                <span className="font-semibold text-foreground">
                                  {bank.name}
                                </span>
                                {expandedBank === bank.name ? (
                                  <ChevronUp size={18} />
                                ) : (
                                  <ChevronDown size={18} />
                                )}
                              </button>
                              {expandedBank === bank.name && (
                                <div className="p-3 border-t text-sm space-y-2 text-muted-foreground animate-in fade-in duration-300">
                                  <div className="flex justify-between items-center group">
                                    <span>
                                      <strong className="w-28 inline-block">
                                        Account Holder:
                                      </strong>{" "}
                                      {bank.holder}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() =>
                                        copyToClipboard(
                                          bank.holder,
                                          "Account Holder"
                                        )
                                      }
                                    >
                                      <Copy size={14} />
                                    </Button>
                                  </div>
                                  <div className="flex justify-between items-center group">
                                    <span>
                                      <strong className="w-28 inline-block">
                                        IBAN:
                                      </strong>{" "}
                                      {bank.iban}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() =>
                                        copyToClipboard(bank.iban, "IBAN")
                                      }
                                    >
                                      <Copy size={14} />
                                    </Button>
                                  </div>
                                  <div className="flex justify-between items-center group">
                                    <span>
                                      <strong className="w-28 inline-block">
                                        Account No (RIB):
                                      </strong>{" "}
                                      {bank.accountNumber}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() =>
                                        copyToClipboard(
                                          bank.accountNumber,
                                          "Account Number"
                                        )
                                      }
                                    >
                                      <Copy size={14} />
                                    </Button>
                                  </div>
                                  {copySuccess && (
                                    <p className="text-xs text-green-400 text-right">
                                      {copySuccess}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <Button
                        onClick={handleMarkAsPaid}
                        disabled={notifyingAdmin}
                        className="w-full"
                        size="lg"
                      >
                        {notifyingAdmin ? (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Bell className="mr-2 h-4 w-4" />
                        )}
                        {notifyingAdmin
                          ? "Notifying..."
                          : "I Have Paid (Notify)"}
                      </Button>
                      {notificationMessage && (
                        <p
                          className={`text-center text-sm ${
                            notificationMessage.includes("Error")
                              ? "text-destructive"
                              : "text-green-400"
                          }`}
                        >
                          {notificationMessage}
                        </p>
                      )}
                    </div>
                  </AccordionItem>
                )}
              </CardContent>
            </Card>
          )}

          {/* --- Action Card: Awaiting Confirmation --- */}
          {(order.status === "Awaiting Admin Confirmation" ||
            order.status === "Awaiting Actor Confirmation") && (
            <Card className="animate-in fade-in duration-300 border-yellow-500/50">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <RefreshCw className="h-6 w-6 text-yellow-400 animate-spin" />
                <CardTitle>Awaiting Payment Confirmation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We have notified the{" "}
                  {order.status === "Awaiting Admin Confirmation"
                    ? "admin"
                    : "actor"}
                  . Your order status will update to "In Progress" once payment
                  is confirmed.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* --- Stripe Payment Modal --- */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Your Payment</DialogTitle>
            <DialogDescription>
              Please enter your card details below to pay{" "}
              {order.total_price?.toFixed(2)} MAD.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {clientSecret && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: { theme: "night", labels: "floating" },
                }}
              >
                <StripeCheckoutForm
                  onSuccessfulPayment={onSuccessfulStripePayment}
                />
              </Elements>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientOrderPage;
