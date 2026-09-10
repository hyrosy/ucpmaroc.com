// In src/pages/dashboard/ActorEarningsPage.tsx

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/supabaseClient";
import { Link, useOutletContext } from "react-router-dom";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout"; "@/features/talent-marketplace";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, DollarSign, History } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Payout {
  id: string;
  order_id_string: string;
  actor_payout_amount: number;
  created_at: string;
  total_price: number;
}

const ActorEarningsPage = () => {
  const { actorData } = useOutletContext<ActorDashboardContextType>();
  const [totalOwed, setTotalOwed] = useState<number>(0);
  const [history, setHistory] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEarnings = useCallback(async () => {
    if (!actorData.id) return;
    setLoading(true);

    // 1. Get the total amount owed (unpaid)
    const { data: owedData, error: owedError } = await supabase
      .from("orders")
      .select("actor_payout_amount")
      .eq("actor_id", actorData.id)
      .eq("payout_status", "unpaid")
      .eq("status", "Completed");

    if (owedError) console.error("Error fetching total owed:", owedError);
    if (owedData) {
      const total = owedData.reduce(
        (sum, o) => sum + (o.actor_payout_amount || 0),
        0
      );
      setTotalOwed(total);
    }

    // 2. Get the history of paid orders
    const { data: historyData, error: historyError } = await supabase
      .from("orders")
      .select(
        "id, order_id_string, actor_payout_amount, created_at, total_price"
      )
      .eq("actor_id", actorData.id)
      .eq("payout_status", "paid")
      .order("created_at", { ascending: false });

    if (historyError)
      console.error("Error fetching payout history:", historyError);
    if (historyData) setHistory(historyData as Payout[]);

    setLoading(false);
  }, [actorData.id]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  return (
    <div className="p-4 md:p-8 space-y-8 w-full max-w-8xl mx-auto ">
      <Card>
        <CardHeader>
          <CardTitle>Payout Settings</CardTitle>
          <CardDescription>
            Manage the bank account where you receive payouts from the platform.
            This is kept private and is separate from your "Direct Payment"
            details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/dashboard/payout-settings">
              Manage Payout Methods <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Payout</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {totalOwed.toFixed(2)}{" "}
            <span className="text-lg text-muted-foreground">MAD</span>
          </div>
          <p className="text-xs text-muted-foreground">
            This is the total amount for your completed orders that is pending
            payout from the platform.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>
            A list of all payouts you have received from the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto"><Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Order Total</TableHead>
                <TableHead>Your Payout</TableHead>
                <TableHead className="text-right">Date Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : history.length > 0 ? (
                history.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium">
                      #{payout.order_id_string}
                    </TableCell>
                    <TableCell>{payout.total_price?.toFixed(2)} MAD</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-green-500 border-green-500"
                      >
                        {payout.actor_payout_amount.toFixed(2)} MAD
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {new Date(payout.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No paid-out orders found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table></div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActorEarningsPage;
