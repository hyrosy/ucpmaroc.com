import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const StripeCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      // 1. Grab the auth code and the state object from the URL
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        setStatus("error");
        setErrorMessage(
          searchParams.get("error_description") ||
            "Stripe connection was canceled."
        );
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setErrorMessage("Invalid callback parameters from Stripe.");
        return;
      }

      try {
        // 2. Decode the state to get our actor and portfolio IDs
        const decodedState = JSON.parse(atob(state));
        const { actorId, portfolioId } = decodedState;
        if (!actorId || !portfolioId) throw new Error("Stripe callback state is incomplete.");

        // 3. Send the code to our secure Edge Function to swap it for the Account ID
        const { data, error: funcError } = await supabase.functions.invoke(
          "stripe-standard-oauth",
          {
            body: { code, actorId, portfolioId },
          }
        );

        if (funcError) throw funcError;
        if (data?.error) throw new Error(data.error);

        // 4. Success!
        setStatus("success");

        // Bounce them back to the payments page after 2 seconds
        setTimeout(() => {
          navigate("/dashboard/payments");
        }, 3500);
      } catch (err: any) {
        console.error("OAuth Error:", err);
        setStatus("error");
        setErrorMessage(err.message || "Failed to connect Stripe account.");
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card p-8 rounded-3xl border shadow-sm text-center space-y-4">
        {status === "loading" && (
          <div className="animate-in fade-in zoom-in duration-500">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold">Connecting your account...</h2>
            <p className="text-muted-foreground text-sm">
              Please wait while we secure your Stripe connection.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold">Successfully Connected!</h2>
            <p className="text-muted-foreground text-sm">
              Redirecting you back to your dashboard...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-destructive" />
            </div>
            <h2 className="text-xl font-bold">Connection Failed</h2>
            <p className="text-muted-foreground text-sm mb-6">{errorMessage}</p>
            <Button
              onClick={() => navigate("/dashboard/payments")}
              className="w-full"
            >
              Return to Payments
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StripeCallbackPage;
