import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CreditCard,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AdminDomainOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [charging, setCharging] = useState(false);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchData = useCallback(async () => {
    setError(null);
    const { data } = await supabase
      .from("store_orders")
      .select("*, store_domains(*)")
      .eq("id", id)
      .single();
    if (!data) setError("This domain order could not be found.");
    setOrder(data);
    setLoading(false);
  }, [id]);

  const handleChargeRent = async () => {
    if (
      !confirm(
        `Are you sure you want to charge ${order.store_domains.price_rent_standard} MAD to the saved card?`
      )
    )
      return;

    setCharging(true);
    const { data, error } = await supabase.functions.invoke(
      "charge-saved-card",
      {
        body: {
          amount: order.store_domains.price_rent_standard,
          customerId: order.stripe_customer_id,
        },
      }
    );

    setCharging(false);

    if (error || data.error) {
      alert("Charge Failed: " + (error?.message || data?.error));
    } else {
      alert("Success! Payment processed. Transaction ID: " + data.id);
    }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center p-8 text-muted-foreground">Loading order details...</div>;
  if (error || !order) return <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 p-8 text-center"><AlertCircle className="h-10 w-10 text-destructive" /><h1 className="text-xl font-semibold">Unable to load order</h1><p className="text-sm text-muted-foreground">{error || "The requested order is unavailable."}</p><Button variant="outline" onClick={fetchData}><RefreshCw className="mr-2 h-4 w-4" /> Try again</Button></div>;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* NEW: BILLING CARD */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <CreditCard className="w-5 h-5" /> Recurring Billing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center bg-white p-3 rounded border">
                <span className="text-sm text-slate-500">Payment Method</span>
                <div className="flex items-center gap-2">
                  {order.stripe_customer_id ? (
                    <Badge className="bg-green-600">Card Saved</Badge>
                  ) : (
                    <Badge variant="destructive">No Card</Badge>
                  )}
                </div>
              </div>

              {order.stripe_customer_id ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    This order allows manual recurring charges. Use this button
                    to collect monthly rent.
                  </p>
                  <Button
                    onClick={handleChargeRent}
                    disabled={charging}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {charging ? (
                      <RefreshCw className="mr-2 w-4 h-4 animate-spin" />
                    ) : (
                      <CreditCard className="mr-2 w-4 h-4" />
                    )}
                    {charging
                      ? "Processing..."
                      : `Charge Rent (${order.store_domains.price_rent_standard} MAD)`}
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-red-500 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Cannot charge automatically. Client paid via Bank or did not
                  save card.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
