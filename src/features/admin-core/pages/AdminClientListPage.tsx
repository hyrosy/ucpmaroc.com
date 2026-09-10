// In src/pages/AdminClientListPage.tsx

import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import {
  ArrowLeft,
  Users,
  ArrowRight,
  UserRound,
  Building,
  Trash2,
} from "lucide-react"; // Added new icons

// --- shadcn/ui Imports ---
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import DashboardState from "@/components/dashboard/DashboardState";
// ---

// Interface (Unchanged)
interface ClientProfile {
  id: string;
  full_name: string;
  company_name?: string | null;
  user_id: string;
  email: string;
}

const AdminClientListPage: React.FC = () => {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // --- (All your data fetching logic is correct) ---
  // The Edge Function call and error handling (lines 42-65) look solid.
  // There are no obvious errors in your 'invoke' call.
  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(""); // --- Check Admin Role (This part is correct) ---

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/actor-login");
      return;
    }
    const { data: profile } = await supabase
      .from("actors")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (profile?.role !== "admin") {
      navigate("/dashboard");
      return;
    } // --- End Admin Role Check --- // --- THIS IS THE NEW, SIMPLER QUERY --- // No more Edge Function!
    const { data, error: fetchError } = await supabase
      .from("clients")
      .select("id, full_name, company_name, user_id, email") // We can just select email now!
      .order("full_name", { ascending: true });

    if (fetchError) {
      setError(`Error fetching clients: ${fetchError.message}`);
      console.error(fetchError);
      setClients([]);
    } else {
      setClients(data as ClientProfile[]);
    }
    setLoading(false);
  }, [navigate]); // --- END REPLACEMENT ---
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleDeleteClient = async (client: ClientProfile) => {
    if (!window.confirm(`Permanently delete ${client.full_name}? This removes the account and its platform data.`)) return;

    setError("");
    try {
      const { data, error: functionError } = await supabase.functions.invoke("admin-delete-account", {
        body: { accountId: client.id, accountType: "client" },
      });
      if (functionError) throw functionError;
      if (!data?.success) throw new Error(data?.error || "Account deletion failed.");
      setClients((current) => current.filter((item) => item.id !== client.id));
    } catch (deleteError) {
      setError(`Failed to delete client: ${(deleteError as Error).message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        Loading Clients...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 text-foreground">
                 {" "}
      <div className="max-w-7xl mx-auto">
                       
        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchClients}>Retry</Button>
          </div>
        )}
                        {/* --- 2. RESTYLED CARD & TABLE --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Users /> Manage Clients
            </CardTitle>
            <CardDescription>
              A list of all client accounts on the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:hidden">
              {clients.map((client) => (
                <div key={client.id} className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9"><AvatarFallback>{client.full_name?.charAt(0).toUpperCase() || "C"}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{client.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{client.email}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{client.company_name || "No company"}</p>
                    </div>
                    <Button variant="destructive" size="icon" aria-label={`Delete ${client.full_name}`} onClick={() => handleDeleteClient(client)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {clients.length === 0 && <DashboardState variant="empty" title="No clients found" description="Client accounts will appear here when they join." />}
            </div>
                           {" "}
            <div className="hidden overflow-x-auto md:block">
                                 {" "}
              <Table className="min-w-[700px]">
                                       {" "}
                <TableHeader>
                                             {" "}
                  <TableRow>
                                                    <TableHead>Name</TableHead> 
                                                  <TableHead>Company</TableHead>
                                                    <TableHead>Email</TableHead>
                                                   {" "}
                    <TableHead className="text-right">Actions</TableHead>       
                                       {" "}
                  </TableRow>
                                         {" "}
                </TableHeader>
                                       {" "}
                <TableBody>
                                             {" "}
                  {clients.map((client) => (
                    <TableRow key={client.id} className="text-sm">
                                                         {" "}
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {client.full_name?.charAt(0).toUpperCase() || "C"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-semibold">
                              {client.full_name}
                            </span>
                            <span className="text-xs text-muted-foreground sm:hidden">
                              {client.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                                                         {" "}
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-2">
                          {client.company_name ? (
                            <>
                              <Building className="h-4 w-4" />
                              {client.company_name}
                            </>
                          ) : (
                            "-"
                          )}
                        </div>
                      </TableCell>
                                                         {" "}
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        {client.email}
                      </TableCell>
                                                         {" "}
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClient(client)}
                          aria-label={`Delete ${client.full_name}`}
                          title="Permanently delete client and account data"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
                                                           {" "}
                      </TableCell>
                                                     {" "}
                    </TableRow>
                  ))}
                                         {" "}
                </TableBody>
                                   {" "}
              </Table>
                                 {" "}
              {clients.length === 0 && !loading && (
                <p className="text-center text-muted-foreground p-8">
                  No clients found.
                </p>
              )}
                             {" "}
            </div>
          </CardContent>
                         {" "}
        </Card>
                   {" "}
      </div>
             {" "}
    </div>
  );
};

export default AdminClientListPage;
