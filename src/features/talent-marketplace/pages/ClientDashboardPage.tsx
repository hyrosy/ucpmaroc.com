// In src/pages/ClientDashboardPage.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Heart, 
  Star, 
  LogOut, 
  ListOrdered, 
  CheckCircle, 
  DollarSign, 
  Inbox,
  ArrowRight,
  MessageSquare
} from 'lucide-react';

// --- shadcn/ui Imports ---
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import PlatformLoader from '@/components/PlatformLoader';
// ---

interface Order {
  id: string;
  order_id_string: string;
  status: string | null; // Status can be null
  created_at: string;
  actors: { ActorName: string }[] | null;
  total_price?: number;
}

// Helper map to style status badges
const statusMap: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  "Completed": "outline",
  "In Progress": "default",
  "Pending Approval": "secondary",
  "Awaiting Payment": "secondary",
  "Awaiting Admin Confirmation": "secondary",
  "Awaiting Actor Confirmation": "secondary",
  "offer_made": "default",
  "awaiting_offer": "secondary",
  "Cancelled": "destructive",
};

const ClientDashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const navigate = useNavigate();

  const activeOrders = orders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length;
  const completedOrders = orders.filter(o => o.status === 'Completed').length;
  const totalSpent = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);

  useEffect(() => {
    const getClientData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        navigate('/client-auth');
        return;
      }
      setClientEmail(user.email);

      const { data: clientProfile, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (clientError || !clientProfile) {
        console.warn('No client profile found, redirecting to create one.');
        navigate('/create-profile', { state: { roleToCreate: 'client' } });
        return;
      }

      setClientName(clientProfile?.full_name || ''); // Use the exact logic from your old code

      const { data: orderData, error } = await supabase
        .from('orders')
        .select('id, order_id_string, status, created_at, total_price, actors(ActorName)')
        .eq('client_email', user.email)
        .order('created_at', { ascending: false });
      
      if (orderData) {
        setOrders(orderData as Order[]);
      }
      setLoading(false);
    };
    getClientData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/client-auth');
  };

  if (loading) {
    return <PlatformLoader message="Loading Your Dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-muted/40 p-4 md:p-8">
      <div className="max-w-6xl mx-auto pt-20">
        
        {/* --- RESTYLED HEADER SECTION --- */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
          
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 hidden sm:flex">
              {/* Added a fallback for empty clientName */}
              <AvatarFallback>{clientName?.charAt(0).toUpperCase() || 'C'}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Welcome, {clientName || 'Client'}</h1>
              <p className="text-muted-foreground">Here's a summary of your activity.</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/messages"> {/* This is the top-level route */}
                <MessageSquare size={16} className="mr-2 text-primary" /> Inbox
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/my-favorites">
                <Star size={16} className="mr-2 text-yellow-500" /> My Favorites
              </Link>
            </Button>
            <Button asChild variant="default" className="w-full sm:w-auto">
              <Link to="/my-shortlist">
                <Heart size={16} className="mr-2" /> My Shortlist
              </Link>
            </Button>
            <Button variant="destructive" onClick={handleLogout} className="w-full sm:w-auto">
              <LogOut size={16} className="mr-2" /> Log Out
            </Button>
          </div>
        </div>

        {/* --- RESTYLED Summary Cards --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <ListOrdered className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{activeOrders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{completedOrders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Inbox className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{orders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approx. Total Spent</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalSpent.toFixed(2)} <span className="text-lg text-muted-foreground">MAD</span></div>
            </CardContent>
          </Card>
        </div>

        {/* --- RESTYLED Order List (now a Table) --- */}
        <Card>
          <CardHeader>
            <CardTitle>Order History</CardTitle>
            <CardDescription>A list of all your recent orders.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:hidden">
              {orders.length > 0 ? orders.map(order => (
                <div key={order.id} className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">#{order.order_id_string}</p><p className="text-xs text-muted-foreground">{order.actors?.[0]?.ActorName || 'N/A'}</p></div><Badge variant={statusMap[order.status || ''] || "secondary"}>{order.status || 'N/A'}</Badge></div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{new Date(order.created_at).toLocaleDateString()}</span><Button asChild variant="outline" size="sm"><Link to={`/order/${order.id}`}>View order <ArrowRight className="ml-1 h-3 w-3" /></Link></Button></div>
                </div>
              )) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">You have not placed any orders yet.</p>}
            </div>
            <div className="hidden overflow-x-auto md:block"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead className="hidden sm:table-cell">Actor</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length > 0 ? (
                  orders.map(order => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-medium">#{order.order_id_string}</div>
                        <div className="text-muted-foreground text-xs sm:hidden">
                          {order.actors?.[0]?.ActorName || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {order.actors?.[0]?.ActorName || 'N/A'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {new Date(order.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {/* --- THIS IS THE FIX --- */}
                        <Badge variant={statusMap[order.status || ''] || "secondary"}>
                          {order.status || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/order/${order.id}`}>
                            <span className="hidden sm:inline">View Order</span>
                            <ArrowRight className="h-4 w-4 sm:hidden" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      You have not placed any orders yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table></div>
          </CardContent>
        </Card>
        
      </div>
    </div>
  );
};

export default ClientDashboardPage;