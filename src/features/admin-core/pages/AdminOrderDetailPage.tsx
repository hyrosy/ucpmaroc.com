// In src/pages/AdminOrderDetailPage.tsx

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { ArrowLeft, User, Briefcase, FileText, Package, MessageSquare, Banknote, CreditCard, Clock } from 'lucide-react';
import { ChatBox } from '@/features/messaging';
// Define a detailed interface for this page
interface DetailedOrder {
    id: string;
    order_id_string: string;
    client_name: string;
    client_email: string; // Added client email
    status: string;
    created_at: string;
    total_price: number;
    payment_method: 'stripe' | 'bank' | null;
    script: string;
    word_count: number;
    usage: string;
    stripe_payment_intent_id: string | null;
    revisions_used: number;
    actors: { // Actor details
        id: string; // Added actor id
        ActorName: string;
        ActorEmail?: string;
        revisions_allowed: number;
    };
    deliveries: { // Delivery details
        id: string;
        file_url: string;
        created_at: string;
        version_number: number;
    }[];
    // We can add messages later if needed
}

const AdminOrderDetailPage: React.FC = () => {
    const { orderId } = useParams<{ orderId: string }>();
    const [order, setOrder] = useState<DetailedOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchOrderDetails = async () => {
            if (!orderId) {
                setError('No order ID provided.');
                setLoading(false);
                return;
            }

            // Fetch comprehensive order details
            // NOTE: Add checks for admin role here if direct access to this page should be restricted
            const { data, error: fetchError } = await supabase
                .from('orders')
                .select(`
                    *,
                    actors ( id, ActorName, ActorEmail, revisions_allowed ),
                    deliveries ( * )
                `)
                .eq('id', orderId)
                .order('created_at', { foreignTable: 'deliveries', ascending: false }) // Get latest delivery first
                .single();

            if (fetchError) {
                setError('Order not found or error fetching details.');
                console.error(fetchError);
            } else if (data) {
                setOrder(data as DetailedOrder);
            } else {
                setError('Order not found.');
            }
            setLoading(false);
        };

        fetchOrderDetails();
    }, [orderId]);

    // Function to handle status change (could reuse logic or keep separate)
    const handleAdminStatusChange = async (newStatus: string) => {
        if (!order) return;
        setLoading(true); // Indicate loading during update
        const { error: updateError } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', order.id);

        if (updateError) {
            setError(`Failed to update status: ${updateError.message}`);
        } else {
            // Re-fetch data to show the updated status
            setOrder(prev => prev ? { ...prev, status: newStatus } : null);
            setError(''); // Clear previous errors
        }
        setLoading(false);
    };


    if (loading && !order) { // Show initial loading state
        return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Loading Order Details...</div>;
    }

    if (error && !order) { // Show error if order couldn't be fetched
        return <div className="min-h-screen bg-background flex items-center justify-center text-red-400 p-4">{error}</div>;
    }

    if (!order) { // Should not happen if error handling is correct, but good fallback
        return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Order data unavailable.</div>;
    }

    // Determine status color
     const getStatusClass = (status: string) => {
        switch (status) {
            case 'Completed': return 'bg-green-500/20 text-green-300';
            case 'In Progress': return 'bg-blue-500/20 text-blue-300';
            case 'Pending Approval': return 'bg-yellow-500/20 text-yellow-300';
            case 'Awaiting Payment': return 'bg-orange-500/20 text-orange-300';
            case 'Cancelled': return 'bg-red-500/20 text-red-300';
            default: return 'bg-slate-600/50 text-muted-foreground';
        }
    };


    return (
        <div className="min-h-screen bg-background p-4 md:p-8 text-foreground">
            <div className="max-w-4xl mx-auto">
                {/* Back Link */}
                <Link to="/admin" className="inline-flex items-center gap-2 text-muted-foreground hover:text-accent-foreground mb-6 transition-colors">
                    <ArrowLeft size={16} /> Back to All Orders
                </Link>

                {/* Header */}
                <div className="mb-8 p-6 bg-card rounded-lg border border">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-foreground mb-1">Order #{order.order_id_string}</h1>
                            <p className="text-sm text-muted-foreground">
                                Created: {new Date(order.created_at).toLocaleString()}
                            </p>
                        </div>
                         <span className={`px-4 py-1.5 text-sm font-semibold rounded-full ${getStatusClass(order.status)}`}>
                             {order.status}
                         </span>
                    </div>
                     {/* Admin Status Change */}
                    <div className="mt-4 pt-4 border-t flex items-center gap-3">
                         <label htmlFor="adminStatusSelect" className="text-sm font-medium text-muted-foreground">Change Status:</label>
                         <select
                            id="adminStatusSelect"
                            value={order.status}
                            onChange={(e) => handleAdminStatusChange(e.target.value)}
                            disabled={loading} // Disable while updating
                             className="bg-background border border-input rounded-md p-2 text-foreground text-xs w-auto focus:ring-primary focus:border-primary"
                        >
                            <option value="Awaiting Payment">Awaiting Payment</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Pending Approval">Pending Approval</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                         {loading && <span className="text-xs text-muted-foreground">Updating...</span>}
                         {error && <span className="text-xs text-red-400">{error}</span>} {/* Show update errors here */}
                     </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Client Info */}
                    <div className="md:col-span-1 p-5 bg-card/50 rounded-lg border border/50">
                        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><User size={18}/> Client Details</h2>
                        <p className="text-sm"><strong className="text-muted-foreground">Name:</strong> {order.client_name}</p>
                        <p className="text-sm"><strong className="text-muted-foreground">Email:</strong> {order.client_email}</p>
                        {/* Add Phone if fetched */}
                    </div>
                     {/* Actor Info */}
                    <div className="md:col-span-1 p-5 bg-card/50 rounded-lg border border/50">
                        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Briefcase size={18}/> Actor Details</h2>
                        <p className="text-sm"><strong className="text-muted-foreground">Name:</strong> {order.actors?.ActorName || 'N/A'}</p>
                        <p className="text-sm"><strong className="text-muted-foreground">Email:</strong> {order.actors?.ActorEmail || 'N/A'}</p>
                        <p className="text-sm"><strong className="text-muted-foreground">Revisions Allowed:</strong> {order.actors?.revisions_allowed ?? 'N/A'}</p>
                    </div>
                     {/* Order/Payment Info */}
                    <div className="md:col-span-1 p-5 bg-card/50 rounded-lg border border/50">
                        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Banknote size={18}/> Payment & Scope</h2>
                        <p className="text-sm"><strong className="text-muted-foreground">Total Price:</strong> {order.total_price.toFixed(2)} MAD</p>
                        <p className="text-sm capitalize flex items-center gap-1.5"><strong className="text-muted-foreground">Method:</strong> {order.payment_method === 'bank' ? <Banknote size={14}/> : <CreditCard size={14}/>} {order.payment_method || 'N/A'}</p>
                        {order.payment_method === 'stripe' && order.stripe_payment_intent_id && (
                             <p className="text-xs mt-1">
                                 <a href={`https://dashboard.stripe.com/payments/${order.stripe_payment_intent_id}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">View on Stripe</a>
                             </p>
                        )}
                        <p className="text-sm mt-2"><strong className="text-muted-foreground">Word Count:</strong> {order.word_count}</p>
                        <p className="text-sm capitalize"><strong className="text-muted-foreground">Usage:</strong> {order.usage}</p>
                        <p className="text-sm"><strong className="text-muted-foreground">Revisions Used:</strong> {order.revisions_used}</p>
                    </div>
                </div>

                {/* Script */}
                <div className="mb-8 p-5 bg-card/50 rounded-lg border border/50">
                     <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><FileText size={18}/> Script</h2>
                     <div className="bg-background p-4 rounded max-h-60 overflow-y-auto">
                        <p className="text-muted-foreground whitespace-pre-wrap text-sm">{order.script}</p>
                     </div>
                </div>

                {/* Deliveries */}
                <div className="mb-8 p-5 bg-card/50 rounded-lg border border/50">
                     <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Package size={18}/> Deliveries</h2>
                     {order.deliveries && order.deliveries.length > 0 ? (
                         <div className="space-y-4">
                             {order.deliveries.map((delivery) => (
                               <div key={delivery.id} className="bg-background border border/50 p-3 rounded">
                                 <p className="font-semibold text-sm mb-2">Version {delivery.version_number} <span className="text-xs text-muted-foreground ml-2">({new Date(delivery.created_at).toLocaleString()})</span></p>
                                 <audio aria-label={`Delivery version ${delivery.version_number}`} controls src={delivery.file_url} className="w-full h-10 mb-2"></audio>
                                 <a href={delivery.file_url} download className="text-xs text-blue-400 hover:underline">Download File</a>
                               </div>
                             ))}
                         </div>
                     ) : (
                         <p className="text-muted-foreground text-sm">No deliveries uploaded yet.</p>
                     )}
                </div>

                {/* --- Add Chat History Section --- */}
                <div className="p-5 bg-card/50 rounded-lg border border/50">
                     <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><MessageSquare size={18}/> Communication History</h2>
                     {/* Pass order ID and a role for alignment (admin is just viewing) */}
                     <ChatBox orderId={order.id} userRole="client" />
                </div>
                {/* --- End Chat History Section --- */}

            </div>
        </div>
    );
};

export default AdminOrderDetailPage;