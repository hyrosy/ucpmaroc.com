import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { loadStripe, Appearance } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { StripeCheckoutForm } from '@/features/ecommerce';

// UI Components
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, Lock, CreditCard, Wallet, PenTool, Calendar, Sparkles } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas'; 
import { useTheme } from "next-themes";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const DomainCheckout = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  // Data State
  const [domain, setDomain] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [option, setOption] = useState<'buy' | 'rent_standard' | 'rent_deal'>('buy');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'bank'>('stripe');
  const [formData, setFormData] = useState({ fullName: '', email: '', cin: '', phone: '' });
  
  // Payment State
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isSettingUpStripe, setIsSettingUpStripe] = useState(false);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);

  const sigPad = useRef<any>({});
  
  useEffect(() => {
    const fetchDetails = async () => {
      const { data } = await supabase.from('store_domains').select('*').eq('id', id).single();
      if (data) setDomain(data);
      const { data: { user } } = await supabase.auth.getUser();
      if(user) setFormData(prev => ({ ...prev, email: user.email || '' }));
      setLoading(false);
    };
    fetchDetails();
  }, [id]);

  // Re-init Stripe when price changes
  useEffect(() => {
    if (paymentMethod === 'stripe' && domain) {
        setupStripePayment();
    }
  }, [paymentMethod, option, billingCycle, domain]);

  // --- PRICING LOGIC ---
  const getPriceData = () => {
    if (option === 'buy') {
        return { total: domain?.price_buy, label: "One-time Purchase" };
    }
    if (option === 'rent_deal') {
        // Deal is always Annual in this logic
        const total = (domain?.fee_web_dev || 0) + (domain?.price_rent_deal || 0) * 12;
        return { total, label: "Web Dev Fee + 1 Year Rent" };
    }
    // Standard Rent
    if (billingCycle === 'yearly') {
        // Apply 10% Discount
        const annualRaw = (domain?.price_rent_standard || 0) * 12;
        const discounted = Math.round(annualRaw * 0.9);
        return { total: discounted, label: "1 Year Rent (10% Off)", savings: annualRaw - discounted };
    }
    return { total: domain?.price_rent_standard, label: "Monthly Rent" };
  };

  const priceData = getPriceData();

  const setupStripePayment = async () => {
    // Only fetch if we have an email (needed for Customer creation)
    if (!formData.email) return; 

    setIsSettingUpStripe(true);
    try {
        const { data, error } = await supabase.functions.invoke('create-payment-intent', {
            body: { 
                amount: priceData.total, 
                currency: 'mad',
                email: formData.email,
                name: formData.fullName,
                setup_future_usage: 'off_session'
            }
        });
        if (data?.clientSecret) setClientSecret(data.clientSecret);
        if (data?.customerId) setStripeCustomerId(data.customerId);
    } catch (err) {
        console.error("Stripe Error", err);
    } finally {
        setIsSettingUpStripe(false);
    }
  };

  // --- CREATE ORDER ---
  const createOrder = async (status: string, intentId?: string) => {
    if (sigPad.current.isEmpty()) throw new Error("Please sign the agreement first.");
    const signatureData = sigPad.current.toDataURL(); 
    const { data: { user } } = await supabase.auth.getUser();

    const { data: newOrder, error } = await supabase.from('store_orders').insert({
      domain_id: domain.id,
      user_id: user?.id || null,
      buyer_name: formData.fullName,
      buyer_email: formData.email,
      buyer_cin: formData.cin,
      buyer_phone: formData.phone,
      selected_option: option === 'rent_standard' ? `rent_standard_${billingCycle}` : option,
      payment_status: status,
      payment_intent_id: intentId || null,
      signature_url: signatureData,
      stripe_customer_id: stripeCustomerId,
    })
    .select()
    .single();

    if (error) throw error;
    return newOrder;
  };

  const handleBankOrder = async () => {
    if (!formData.fullName || !formData.cin || !formData.phone || sigPad.current.isEmpty()) {
        setCheckoutError("Please fill in all details and sign.");
        return;
    }
    setSubmitting(true);
    setCheckoutError(null);
    try {
        const newOrder = await createOrder('awaiting_payment');
        navigate(`/marketplace/order/${newOrder.id}/status`);
    } catch (err: any) {
        setCheckoutError(err.message);
        setSubmitting(false);
    }
  };

  const handleStripeSuccess = async (paymentIntentId: string) => {
    try {
        const newOrder = await createOrder('paid', paymentIntentId);
        navigate(`/marketplace/order/${newOrder.id}/status`);
    } catch (err: any) {
        setCheckoutError("Payment succeeded but order save failed: " + err.message);
    }
  };

  const stripeAppearance: Appearance = {
    theme: theme === 'dark' ? 'night' : 'stripe',
    labels: 'floating',
    variables: { colorPrimary: '#3b82f6' }
  };

  if (loading || !domain) return <div className="p-20 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* LEFT: PLANS */}
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Secure Domain: <span className="text-blue-500">{domain.name}</span></h1>
            <p className="text-slate-500">Select your acquisition plan below.</p>
          </div>

          <RadioGroup value={option} onValueChange={(v: any) => setOption(v)} className="space-y-4">
            {/* BUY */}
            <div className={`relative flex items-center space-x-2 border-2 p-6 rounded-xl cursor-pointer transition-all ${option === 'buy' ? 'border-blue-500 bg-blue-500/5' : 'border-slate-800 bg-slate-900/50'}`}>
              <RadioGroupItem value="buy" id="opt-buy" />
              <div className="flex-1 pl-2">
                <Label htmlFor="opt-buy" className="text-lg font-bold cursor-pointer text-white">Buy Outright</Label>
                <p className="text-slate-400 text-sm mt-1">Full ownership transfer immediately.</p>
              </div>
              <div className="text-right"><span className="block text-2xl font-black text-white">{domain.price_buy} MAD</span></div>
            </div>

            {/* RENT (With Toggle) */}
            <div className={`relative border-2 p-6 rounded-xl transition-all ${option === 'rent_standard' ? 'border-blue-500 bg-blue-500/5' : 'border-slate-800 bg-slate-900/50'}`}>
              <div className="flex items-center space-x-2 mb-4 cursor-pointer" onClick={() => setOption('rent_standard')}>
                <RadioGroupItem value="rent_standard" id="opt-rent" />
                <div className="flex-1 pl-2">
                    <Label htmlFor="opt-rent" className="text-lg font-bold cursor-pointer text-white">Standard Rental</Label>
                    <p className="text-slate-400 text-sm mt-1">Flexible lease.</p>
                </div>
                <div className="text-right"><span className="block text-2xl font-black text-white">{domain.price_rent_standard} MAD</span><span className="text-xs text-slate-500">/ Month</span></div>
              </div>
              
              {/* YEARLY TOGGLE (Visible only if RENT selected) */}
              {option === 'rent_standard' && (
                  <div className="ml-8 mt-2 p-3 bg-blue-500/10 rounded-lg flex items-center justify-between border border-blue-500/20">
                      <div className="flex items-center gap-2">
                          <Switch checked={billingCycle === 'yearly'} onCheckedChange={(c) => setBillingCycle(c ? 'yearly' : 'monthly')} />
                          <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-blue-400' : 'text-slate-400'}`}>
                              Pay Yearly <span className="text-xs text-green-400 font-bold ml-1">(Save 10%)</span>
                          </span>
                      </div>
                      {billingCycle === 'yearly' && (
                          <div className="text-right">
                              <span className="block text-sm font-bold text-white">{(domain.price_rent_standard * 12 * 0.9).toFixed(0)} MAD</span>
                              <span className="text-[10px] text-green-400">Save {(domain.price_rent_standard * 12 * 0.1).toFixed(0)} MAD</span>
                          </div>
                      )}
                  </div>
              )}
            </div>

            {/* DEAL */}
            <div className={`relative flex items-center space-x-2 border-2 p-6 rounded-xl cursor-pointer transition-all ${option === 'rent_deal' ? 'border-yellow-500 bg-yellow-500/10' : 'border-slate-800 bg-slate-900/50'}`}>
              <div className="absolute -top-3 right-6 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">BEST VALUE</div>
              <RadioGroupItem value="rent_deal" id="opt-deal" className="text-yellow-500 border-yellow-500" />
              <div className="flex-1 pl-2">
                <Label htmlFor="opt-deal" className="text-lg font-bold cursor-pointer text-white">Deal: Rent + Build</Label>
                <p className="text-slate-400 text-sm mt-1">Website ({domain.fee_web_dev} MAD) + 1 Year Rent.</p>
              </div>
              <div className="text-right"><span className="block text-2xl font-black text-yellow-500">{domain.price_rent_deal} MAD</span><span className="text-xs text-slate-500">/ Month</span></div>
            </div>
          </RadioGroup>
        </div>

        {/* RIGHT: FORM & PAYMENT */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl h-fit">
          {/* Form */}
          <div className="space-y-4 mb-6">
            <Input className="bg-white dark:bg-slate-950" placeholder="Full Name" onChange={e => setFormData({...formData, fullName: e.target.value})} />
            <Input className="bg-white dark:bg-slate-950" placeholder="Email" type="email" onBlur={paymentMethod === 'stripe' ? setupStripePayment : undefined} onChange={e => setFormData({...formData, email: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
                <Input className="bg-white dark:bg-slate-950" placeholder="Phone" onChange={e => setFormData({...formData, phone: e.target.value})} />
                <Input className="bg-white dark:bg-slate-950" placeholder="CIN" onChange={e => setFormData({...formData, cin: e.target.value})} />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Signature */}
          <div className="mb-6">
            <Label className="mb-2 block text-xs uppercase tracking-wider text-slate-500 font-bold flex items-center gap-2"><PenTool className="w-3 h-3" /> Sign Contract</Label>
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white overflow-hidden relative"><SignatureCanvas penColor="black" canvasProps={{width: 500, height: 120, className: 'w-full'}} ref={sigPad} /></div>
            <button className="text-xs text-red-500 mt-2 hover:underline" onClick={() => sigPad.current.clear()}>Clear</button>
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-2 gap-4 mb-6">
             <div onClick={() => setPaymentMethod('stripe')} className={`cursor-pointer border-2 rounded-lg p-3 flex flex-col items-center justify-center gap-2 ${paymentMethod === 'stripe' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                <CreditCard className="w-5 h-5 text-blue-500" /><span className="text-xs font-bold">Card</span>
             </div>
             <div onClick={() => setPaymentMethod('bank')} className={`cursor-pointer border-2 rounded-lg p-3 flex flex-col items-center justify-center gap-2 ${paymentMethod === 'bank' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                <Wallet className="w-5 h-5 text-blue-500" /><span className="text-xs font-bold">Bank</span>
             </div>
          </div>

          {/* Total & Action */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-1 text-sm font-bold"><span>Total Due:</span><span className="text-2xl text-blue-600">{priceData.total} MAD</span></div>
            <p className="text-right text-xs text-slate-500 mb-4 italic">{priceData.label}</p>

            {checkoutError && (
              <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {checkoutError}
              </p>
            )}

            {paymentMethod === 'stripe' && (
                <div className="animate-in fade-in zoom-in duration-300">
                    {clientSecret && !isSettingUpStripe ? (
                        <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
                            <StripeCheckoutForm onSuccessfulPayment={handleStripeSuccess} />
                        </Elements>
                    ) : (
                        <div className="text-center p-4 text-slate-500 text-sm">
                            {!formData.email ? "Enter email to load payment..." : "Initializing Secure Gateway..."}
                        </div>
                    )}
                </div>
            )}

            {paymentMethod === 'bank' && (
                <Button className="w-full h-14 text-lg font-bold" onClick={handleBankOrder} disabled={submitting}>{submitting ? 'Processing...' : 'Sign & Complete Order'}</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DomainCheckout;
