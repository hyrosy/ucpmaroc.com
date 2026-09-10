import React, { useState, useEffect, useCallback, useMemo } from 'react'; // <-- Import useMemo
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { CheckCircle, Clock, ListOrdered, Hourglass, Banknote, ArrowUpDown, Filter, X as XIcon, Globe, Search, Users, AlertTriangle } from 'lucide-react'; // <-- Add Search here
import emailjs from '@emailjs/browser';
import { Link } from 'react-router-dom';
import DashboardPageHeader from '@/components/dashboard/DashboardPageHeader';
import DashboardState from '@/components/dashboard/DashboardState';
// --- shadcn/ui Imports ---
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Updated Interface
interface Order {
  id: string;
  order_id_string: string;
  client_name: string;
  status: string;
  created_at: string;
  total_price: number; // Added
  payment_method: 'stripe' | 'bank' | null; // Added
  actors: {
       ActorName: string;
       ActorEmail?: string; // Add optional ActorEmail
   };  // Add actor_email if needed for notifications
  // actors: { ActorName: string, ActorEmail?: string };
}

// Define possible sort keys and directions
type SortKey = 'created_at' | 'total_price' | 'client_name' | 'actor_name';
type SortDirection = 'asc' | 'desc';

const AdminDashboardPage = () => {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [message, setMessage] = useState(''); // For feedback messages
    const navigate = useNavigate();

    const totalOrders = orders.length;
    const awaitingPaymentOrders = orders.filter(o => o.status === 'Awaiting Payment').length;
    const awaitingAdminConfirmation = orders.filter(o => o.status === 'Awaiting Admin Confirmation').length;
    const inProgressOrders = orders.filter(o => o.status === 'In Progress' || o.status === 'Pending Approval').length; // Combine these
    const completedOrders = orders.filter(o => o.status === 'Completed').length;
    // Optional: Calculate total revenue if needed (ensure total_price is selected in fetchData)
    // const totalRevenue = orders.reduce((sum, o) => sum + (o.status === 'Completed' ? (o.total_price || 0) : 0), 0);
    // --- END CALCULATIONS ---

    // --- NEW: State for Filters ---
    const [filterStatus, setFilterStatus] = useState<string>('all'); // e.g., 'all', 'In Progress', 'Awaiting Payment'
    const [filterPayment, setFilterPayment] = useState<string>('all'); // e.g., 'all', 'bank', 'stripe'
    const [filterSearchTerm, setFilterSearchTerm] = useState<string>(''); // For client/actor name search

    // --- NEW: State for Sorting ---
    const [sortKey, setSortKey] = useState<SortKey>('created_at');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Memoize fetchData to prevent unnecessary re-renders if used elsewhere
    const fetchData = useCallback(async () => {
        // --- Check Admin Role (existing logic) ---
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/actor-login'); // Redirect non-logged-in users
            return;
        }
        const { data: profile } = await supabase.from('actors').select('role').eq('user_id', user.id).single();
        if (profile?.role !== 'admin') {
            navigate('/dashboard'); // Redirect non-admins
            return;
        }
        // --- End Admin Role Check ---

        // Fetch ALL orders with added columns and related actor's name
        // Added: total_price, payment_method
        const { data: orderData, error } = await supabase
            .from('orders')
            .select('*, actors(ActorName, ActorEmail)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching orders:", error);
            setMessage(`Error fetching orders: ${error.message}`);
        } else if (orderData) {
            // Ensure data conforms to the Order interface
            setOrders(orderData as Order[]);
        }
        setLoading(false);
    }, [navigate]); // Add navigate to dependency array

    useEffect(() => {
        fetchData();
    }, [fetchData]); // Use fetchData in dependency array

    // Existing function to handle general status changes via dropdown
    const handleStatusChange = async (orderId: string, newStatus: string) => {
        setMessage(''); // Clear previous message
        const originalOrders = [...orders]; // Keep backup in case of error
        // Optimistic UI update
        setOrders(prevOrders => prevOrders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

        const { error } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId);

        if (error) {
            console.error("Failed to update status:", error);
            setMessage(`Failed to update status: ${error.message}`);
            setOrders(originalOrders); // Revert UI on failure
        } else {
             setMessage(`Order status updated to ${newStatus}.`);
             // Optionally trigger notifications here
        }
    };

    // --- NEW: Function to handle Bank Payment Approval ---
    const handlePaymentApproval = async (orderId: string) => {
        setMessage('');
        const originalOrders = [...orders];
        // Find the specific order being approved to get details for email
        const orderToApprove = originalOrders.find(o => o.id === orderId);

        if (!orderToApprove) {
            setMessage('Error: Could not find order details.');
            return;
        }

        // Optimistic update
        setOrders(prevOrders => prevOrders.map(o => o.id === orderId ? { ...o, status: 'In Progress' } : o));

        const { error } = await supabase
            .from('orders')
            .update({ status: 'In Progress' })
            .match({ id: orderId, status: 'Awaiting Admin Confirmation', payment_method: 'bank' });

        if (error) {
            console.error("Failed to approve payment:", error);
            setMessage(`Failed to approve payment: ${error.message}`);
            setOrders(originalOrders); // Revert on error
        } else {
            setMessage('Payment confirmed. Order moved to In Progress.');

            // --- Send EmailJS notification to Actor ---
            if (orderToApprove.actors?.ActorEmail) {
                const emailParams = {
                    actorName: orderToApprove.actors.ActorName,
                    actorEmail: orderToApprove.actors.ActorEmail,
                    orderIdString: orderToApprove.order_id_string,
                    clientName: orderToApprove.client_name,
                    // Add any other details the actor needs, like word count or script link
                };

                // Replace with your actual Service ID, Template ID, and Public Key
                emailjs.send(
                    'service_r3pvt1s', // Replace
                    'template_zmx5e0u', // Replace (Create this template in EmailJS)
                    emailParams,
                    'I51tDIHsXYKncMQpO' // Replace (Often initialized in App.tsx)
                )
                .then(response => {
                   console.log('Actor notification email sent!', response.status, response.text);
                   setMessage('Payment confirmed & Actor notified.'); // Update message
                })
                .catch(err => {
                   console.error('Failed to send actor notification email:', err);
                   // Update message to indicate email failure
                   setMessage('Payment confirmed, but failed to notify actor.');
                });
            } else {
                console.warn("Could not send notification: Actor email missing for order", orderToApprove.order_id_string);
                setMessage('Payment confirmed, but actor email was missing.');
            }
            // --- End EmailJS notification ---
        }
    };
    // --- End Payment Approval Function ---

    // ... rest of component (loading check, return JSX) ...

    // --- NEW: Calculate Filtered and Sorted Orders using useMemo ---
    const filteredAndSortedOrders = useMemo(() => {
        let processedOrders = [...orders];

        // Apply Filters
        if (filterStatus !== 'all') {
            processedOrders = processedOrders.filter(order => order.status === filterStatus);
        }
        if (filterPayment !== 'all') {
            processedOrders = processedOrders.filter(order => order.payment_method === filterPayment);
        }
        if (filterSearchTerm.trim() !== '') {
            const searchTermLower = filterSearchTerm.toLowerCase();
            processedOrders = processedOrders.filter(order =>
                order.client_name.toLowerCase().includes(searchTermLower) ||
                (order.actors?.ActorName && order.actors.ActorName.toLowerCase().includes(searchTermLower))
            );
        }

        // Apply Sorting
        processedOrders.sort((a, b) => {
            let valA: any;
            let valB: any;

            switch (sortKey) {
                case 'actor_name':
                    valA = a.actors?.ActorName?.toLowerCase() || '';
                    valB = b.actors?.ActorName?.toLowerCase() || '';
                    break;
                case 'client_name':
                    valA = a.client_name.toLowerCase();
                    valB = b.client_name.toLowerCase();
                    break;
                case 'total_price':
                    valA = a.total_price || 0;
                    valB = b.total_price || 0;
                    break;
                case 'created_at': // Default date sort
                default:
                    valA = new Date(a.created_at).getTime();
                    valB = new Date(b.created_at).getTime();
                    break;
            }

            if (valA < valB) {
                return sortDirection === 'asc' ? -1 : 1;
            }
            if (valA > valB) {
                return sortDirection === 'asc' ? 1 : -1;
            }
            return 0;
        });

        return processedOrders;
    }, [orders, filterStatus, filterPayment, filterSearchTerm, sortKey, sortDirection]); // Dependencies

    // --- NEW: Handle Sort Click ---
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            // Toggle direction if same key is clicked
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            // Set new key and default to descending (or ascending if you prefer)
            setSortKey(key);
            setSortDirection('desc');
        }
    };

    // --- Get unique statuses and payment methods for dropdowns ---
    const uniqueStatuses = useMemo(() => ['all', ...new Set(orders.map(o => o.status))], [orders]);
    const uniquePaymentMethods = useMemo(() => ['all', ...new Set(orders.map(o => o.payment_method).filter(Boolean))], [orders]); // Filter out nulls

    if (loading) {
      return <DashboardState variant="loading" title="Loading admin orders" description="Preparing the operations workspace." className="mx-4 my-8" />;
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 text-foreground">
            <div className="max-w-7xl mx-auto">
                <DashboardPageHeader title="All orders" description="Review payments, fulfillment, and operational status across stores." className="mb-6" />

                {/* --- 1. RESTYLED SUMMARY CARDS --- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                    <ListOrdered className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalOrders}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Awaiting Payment</CardTitle>
                    <Hourglass className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{awaitingPaymentOrders}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Admin</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{awaitingAdminConfirmation}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                    <Clock className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{inProgressOrders}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completed</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{completedOrders}</div>
                  </CardContent>
                </Card>
                </div>
                
                
                
                {message && <p className="mb-4 p-3 bg-card rounded-md text-sm">{message}</p>}

                {/* --- 3. RESTYLED Filter Controls --- */}
                <Card className="mb-6">
                  <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
                    <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2 shrink-0">
                      <Filter size={16}/> Filters:
                    </span>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                         {uniqueStatuses.map(status => (
                            <SelectItem key={status} value={status}>{status === 'all' ? 'All Statuses' : status}</SelectItem>
                         ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterPayment} onValueChange={setFilterPayment}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="All Payment Methods" />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="all">All Payment Methods</SelectItem>
                          {uniquePaymentMethods.map(method => (
                            <SelectItem key={method!} value={method!}>{method!.charAt(0).toUpperCase() + method!.slice(1)}</SelectItem>
                         ))}
                      </SelectContent>
                    </Select>
                    <div className="relative w-full sm:w-auto flex-grow">
                      <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                      <Input
                        type="text"
                        placeholder="Search Client or Actor..."
                        value={filterSearchTerm}
                        onChange={(e) => setFilterSearchTerm(e.target.value)}
                        className="pl-8 w-full"
                      />
                      {filterSearchTerm && (
                        <Button
                            variant="ghost"
                            size="icon"
                          onClick={() => setFilterSearchTerm('')}
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Clear search"
                        >
                          <XIcon size={16}/>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                {/* --- 4. RESTYLED Order Table --- */}
                <Card>
                  <CardHeader>
                    <CardTitle>All Orders</CardTitle>
                    <CardDescription>
                      {filteredAndSortedOrders.length} order(s) found.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                 <div className="overflow-x-auto">
                        <Table className="min-w-[900px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Order ID</TableHead>
                              <TableHead>
                                <Button variant="ghost" size="sm" className="-ml-3 h-8 px-3" onClick={() => handleSort('created_at')} aria-label={`Sort by date ${sortKey === 'created_at' ? sortDirection : ''}`}><span className="flex items-center gap-1">Date <ArrowUpDown size={12} /></span></Button>
                              </TableHead>
                              <TableHead>
                                <Button variant="ghost" size="sm" className="-ml-3 h-8 px-3" onClick={() => handleSort('client_name')} aria-label={`Sort by client ${sortKey === 'client_name' ? sortDirection : ''}`}><span className="flex items-center gap-1">Client <ArrowUpDown size={12} /></span></Button>
                              </TableHead>
                              <TableHead>
                                <Button variant="ghost" size="sm" className="-ml-3 h-8 px-3" onClick={() => handleSort('actor_name')} aria-label={`Sort by actor ${sortKey === 'actor_name' ? sortDirection : ''}`}><span className="flex items-center gap-1">Actor <ArrowUpDown size={12} /></span></Button>
                              </TableHead>
                              <TableHead className="text-right">
                                <Button variant="ghost" size="sm" className="-mr-3 h-8 px-3" onClick={() => handleSort('total_price')} aria-label={`Sort by price ${sortKey === 'total_price' ? sortDirection : ''}`}><span className="flex items-center justify-end gap-1">Price (MAD) <ArrowUpDown size={12} /></span></Button>
                              </TableHead>
                              <TableHead>Payment</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAndSortedOrders.map(order => (
                              <TableRow 
                                key={order.id} 
                                className={`text-sm ${
                                    order.status === 'Awaiting Admin Confirmation' ? 'bg-yellow-900/30 hover:bg-yellow-900/50' : 
                                    order.status === 'Awaiting Actor Confirmation' ? 'bg-blue-900/30 hover:bg-blue-900/50' :
                                    'hover:bg-muted/50'
                               }`}
                              >
                                <TableCell className="p-4 font-mono text-xs text-muted-foreground">
                                  <Link className="hover:underline" to={`/admin/order/${order.id}`}>{order.order_id_string}</Link>
                                </TableCell>
                                <TableCell className="p-4 whitespace-nowrap">{new Date(order.created_at).toLocaleDateString()}</TableCell>
                                <TableCell className="p-4">{order.client_name}</TableCell>
                                <TableCell className="p-4">{order.actors?.ActorName || 'N/A'}</TableCell>
                                <TableCell className="p-4 text-right">{order.total_price?.toFixed(2) || 'N/A'}</TableCell>
                                <TableCell className="p-4 capitalize">{order.payment_method || 'N/A'}</TableCell>
                               <TableCell className="p-4" onClick={(e) => e.stopPropagation()}>
                                 <select
                                    value={order.status}
                                 onChange={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(order.id, e.target.value);
                            }}
                                    className="bg-background border border-border rounded-md p-2 text-foreground text-xs w-full focus:ring-primary focus:border-primary"
                               >
                                      <option value="Awaiting Payment">Awaiting Payment</option>
                                      <option value="Awaiting Admin Confirmation">Awaiting Admin Confirmation</option>
                                      <option value="Awaiting Actor Confirmation">Awaiting Actor Confirmation</option>
                                      <option value="In Progress">In Progress</option>
                                 <option value="Pending Approval">Pending Approval</option>
                                      <option value="Completed">Completed</option>
                                      <option value="Cancelled">Cancelled</option>
                               </select>
                                </TableCell>
                                <TableCell className="p-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                               {order.status === 'Awaiting Admin Confirmation' && order.payment_method === 'bank' && (
                                    <Button onClick={(e) => { e.stopPropagation(); handlePaymentApproval(order.id); }}
                                         size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-foreground text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1">
                                        <CheckCircle size={14} /> Confirm
                                    </Button>
                                  )}
                                 {(order.status !== 'Awaiting Admin Confirmation' || order.payment_method !== 'bank') && (
                                  <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                            </TableRow>
                          ))}
                   </TableBody>
                    </Table>
                    {filteredAndSortedOrders.length === 0 && (
                      <p className="text-center text-muted-foreground p-8">
                        {orders.length === 0 ? 'No orders found.' : 'No orders match the current filters.'}
                      </p>
                    )}
                  </div>
                  </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AdminDashboardPage;