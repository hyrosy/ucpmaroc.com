import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/supabaseClient";
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
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface PayoutSummary {
  actor_id: string;
  ActorName: string;
  ActorEmail: string;
  bank_holder_name: string | null; // Can be null
  bank_iban: string | null; // Can be null
  completed_orders: number;
  total_due: number;
}

interface PayoutHistoryItem {
  id: string;
  order_id_string: string;
  actor_payout_amount: number;
  created_at: string;
  actors: { ActorName: string } | null;
}

const AdminPayoutsPage = () => {
  const [payouts, setPayouts] = useState<PayoutSummary[]>([]);
  const [history, setHistory] = useState<PayoutHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingActorId, setPayingActorId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // --- THIS IS THE CORRECTED FUNCTION ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    setMessage(null); // --- 1. Fetch Pending Payouts (CORRECTED QUERY) ---
    // This query joins orders -> actors -> actor_payout_methods (single-line select to avoid parser errors)
    const { data: pendingData, error: pendingError } = await supabase
      .from("orders")
      .select(
        "actor_id,actor_payout_amount,actors(ActorName,ActorEmail,actor_payout_methods(bank_holder_name,bank_iban,is_active))"
      )
      .eq("payout_status", "unpaid")
      .eq("status", "Completed");

    if (pendingError) {
      console.error("Error fetching pending payouts:", pendingError);
      setMessage(`Error: ${pendingError.message}`);
      setLoading(false);
      return;
    } // --- 2. Process the pending data (CORRECTED LOGIC) ---
    const summaryMap = new Map<string, PayoutSummary>(); // cast to any[] when iterating to avoid ParserError type complaints from the Supabase client typing
    for (const order of (pendingData || []) as any[]) {
      if (!order.actors) continue;
      const actorId = order.actor_id as string;
      // Supabase v3 returns object, not array, for one-to-one join
      const actor = Array.isArray(order.actors)
        ? order.actors[0]
        : order.actors;

      if (!actor) continue; // Skip if actor profile is somehow missing

      // Find the *active* payout method from the nested array
      const payoutMethod = Array.isArray(actor.actor_payout_methods)
        ? actor.actor_payout_methods.find((m: any) => m.is_active === true)
        : null;

      if (!summaryMap.has(actorId)) {
        summaryMap.set(actorId, {
          actor_id: actorId,
          ActorName: actor.ActorName,
          ActorEmail: actor.ActorEmail,
          bank_holder_name: payoutMethod?.bank_holder_name || null,
          bank_iban: payoutMethod?.bank_iban || null,
          completed_orders: 0,
          total_due: 0,
        });
      }
      const summary = summaryMap.get(actorId)!;
      summary.completed_orders += 1;
      summary.total_due += order.actor_payout_amount || 0;
    }
    const sortedSummary = Array.from(summaryMap.values()).sort(
      (a, b) => b.total_due - a.total_due
    );
    setPayouts(sortedSummary); // --- 3. Fetch Payout History (This part was correct) ---

    const { data: historyData, error: historyError } = await supabase
      .from("orders")
      .select(
        `
        id,
        order_id_string,
        actor_payout_amount,
        created_at,
        actors ( ActorName )
      `
      )
      .eq("payout_status", "paid")
      .eq("status", "Completed")
      .order("created_at", { ascending: false });
    if (historyError) {
      console.error("Error fetching payout history:", historyError);
      setMessage(`Error: ${historyError.message}`);
    }
    if (historyData) {
      setHistory(historyData as unknown as PayoutHistoryItem[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]); // (handleMarkAsPaid logic is correct)

  const handleMarkAsPaid = async (actorId: string) => {
    if (
      !window.confirm(
        "Are you sure you have sent this payment? This action cannot be undone."
      )
    ) {
      return;
    }
    setPayingActorId(actorId);
    setMessage(null);
    try {
      const { error } = await supabase.rpc("mark_actor_payouts_as_paid", {
        p_actor_id: actorId,
      });
      if (error) throw error;
      setMessage("Payout marked as successful!");
      fetchData();
    } catch (error: any) {
      console.error("Error marking as paid:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setPayingActorId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 text-foreground max-w-7xl mx-auto">
                 {" "}
      <Tabs defaultValue="pending">
        <Card>
          <CardHeader>
            <CardTitle>Admin Payouts</CardTitle>
            <CardDescription>
              Manage pending payouts and view completed payment history.
            </CardDescription>
            <TabsList className="grid w-full grid-cols-2 max-w-[400px] mt-4">
              <TabsTrigger value="pending">Pending Payouts</TabsTrigger>
              <TabsTrigger value="history">Payout History</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="pt-0">
            {message && (
              <p
                className={`mb-4 text-sm ${
                  message.startsWith("Error")
                    ? "text-destructive"
                    : "text-green-500"
                }`}
              >
                {message}
              </p>
            )}

            {/* --- PENDING PAYOUTS TAB (Correct) --- */}
            <TabsContent value="pending">
              <div className="overflow-x-auto"><Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Actor</TableHead>
                    <TableHead>Bank Details</TableHead>
                    <TableHead>Unpaid Orders</TableHead>
                    <TableHead>Total Due</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : payouts.length > 0 ? (
                    payouts.map((payout) => (
                      <TableRow key={payout.actor_id}>
                        <TableCell>
                          <div className="font-medium">{payout.ActorName}</div>
                          <div className="text-xs text-muted-foreground">
                            {payout.ActorEmail}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {payout.bank_holder_name || "N/A"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {payout.bank_iban || "No IBAN on file"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {payout.completed_orders}
                        </TableCell>
                        <TableCell className="font-medium">
                          {payout.total_due.toFixed(2)} MAD
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={payingActorId === payout.actor_id}
                            onClick={() => handleMarkAsPaid(payout.actor_id)}
                            aria-label={`Mark ${payout.ActorName} payout as paid`}
                          >
                            {payingActorId === payout.actor_id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            <span className="ml-2">Mark as Paid</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        Your payout queue is empty!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table></div>
            </TabsContent>

            {/* --- 3. FIX in PAYOUT HISTORY TAB --- */}
            <TabsContent value="history">
              <div className="overflow-x-auto"><Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Actor</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead className="text-right">
                      Date Created
                    </TableHead>{" "}
                    {/* <-- Changed header */}
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
                    history.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">
                            {(Array.isArray(item.actors)
                              ? item.actors[0]?.ActorName
                              : item.actors?.ActorName) || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          #{item.order_id_string}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-green-500 border-green-500"
                          >
                            {item.actor_payout_amount.toFixed(2)} MAD
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {new Date(item.created_at).toLocaleDateString()}{" "}
                          {/* <-- Changed to created_at */}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        No payout history found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table></div>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
};

export default AdminPayoutsPage;
