import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ContractDocument } from '../components/ContractPDF';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, PenTool, Server, Download, AlertCircle } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas'; 
import { cn } from "@/lib/utils";

export default function DomainOrderPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [domain, setDomain] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Step States
  const [ns1, setNs1] = useState('');
  const [ns2, setNs2] = useState('');
  const [savingNs, setSavingNs] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [nsStatus, setNsStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const sigPad = useRef<any>({});

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    const { data: orderData } = await supabase.from('store_orders').select('*').eq('id', id).single();
    if (orderData) {
      setOrder(orderData);
      if(orderData.nameservers) {
          setNs1(orderData.nameservers.ns1 || '');
          setNs2(orderData.nameservers.ns2 || '');
      }
      const { data: domainData } = await supabase.from('store_domains').select('*').eq('id', orderData.domain_id).single();
      setDomain(domainData);
    }
    setLoading(false);
  };

  const handleSaveSignature = async () => {
      if (sigPad.current.isEmpty()) {
        setSignatureStatus({ type: "error", message: "Please sign first." });
        return;
      }
      const sigData = sigPad.current.toDataURL();
      
      const { error } = await supabase.from('store_orders').update({ signature_url: sigData }).eq('id', id);
      if (!error) {
          setSignatureStatus({ type: "success", message: "Signature saved!" });
          fetchOrder();
      } else {
          setSignatureStatus({ type: "error", message: "Failed to save signature: " + error.message });
      }
  };

  const handleSaveNameservers = async () => {
      if (!ns1 || !ns2) {
        setNsStatus({ type: "error", message: "Please enter both nameservers." });
        return;
      }
      setSavingNs(true);
      setNsStatus(null);
      const { error } = await supabase.from('store_orders').update({
          nameservers: { ns1, ns2 }
      }).eq('id', id);
      
      if (!error) {
          setNsStatus({ type: "success", message: "Nameservers updated! We will start propagation shortly." });
          fetchOrder();
      } else {
          setNsStatus({ type: "error", message: "Failed to update nameservers: " + error.message });
      }
      setSavingNs(false);
  };

    if (loading) return <div className="flex min-h-[50vh] items-center justify-center p-8 text-center text-muted-foreground">Loading order details...</div>;

  const isSigned = !!order?.signature_url;
  const hasNameservers = !!order?.nameservers;

  return (
    <div className="min-h-screen bg-background pt-20 px-4 pb-20">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* SUCCESS BANNER */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
            <div className="flex justify-center mb-2"><CheckCircle2 className="w-10 h-10 text-green-500"/></div>
            <h1 className="text-2xl font-bold text-green-500">Payment Successful!</h1>
            <p className="text-muted-foreground">You have secured <span className="font-bold">{domain?.name}</span>.</p>
        </div>

        {/* STEP 1: SIGNATURE (Only if not signed) */}
        {!isSigned && (
            <Card className="border-2 border-blue-500/20 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-500">
                        <PenTool className="w-5 h-5" /> Action Required: Sign Contract
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">Please sign below to finalize the lease/sale agreement.</p>
                    <div className="border-2 border-dashed border-slate-300 rounded-lg bg-white overflow-hidden mb-4">
                        <SignatureCanvas 
                            penColor="black"
                            canvasProps={{width: 600, height: 200, className: 'w-full'}}
                            ref={sigPad}
                        />
                    </div>
                    {signatureStatus && (
                      <p role="status" className={cn("text-sm font-medium mb-3", signatureStatus.type === "error" ? "text-destructive" : "text-emerald-600")}>
                        {signatureStatus.message}
                      </p>
                    )}
                    <Button onClick={handleSaveSignature} className="w-full">Save & Sign Contract</Button>
                    <Button variant="ghost" size="sm" onClick={() => sigPad.current.clear()} className="mt-2 text-xs text-red-500">Clear</Button>
                </CardContent>
            </Card>
        )}

        {/* STEP 2: NAMESERVERS (Only if signed, but missing NS) */}
        {isSigned && (
            <Card className={hasNameservers ? "opacity-100" : "border-2 border-yellow-500/20 shadow-lg"}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Server className="w-5 h-5" /> Domain Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        Where should we point this domain? Enter your hosting nameservers.
                    </p>
                    <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
                        <div className="space-y-2"><Label htmlFor="nameserver-primary">Primary nameserver</Label><Input id="nameserver-primary" placeholder="ns1.hosting.com" value={ns1} onChange={e => setNs1(e.target.value)} /></div>
                        <div className="space-y-2"><Label htmlFor="nameserver-secondary">Secondary nameserver</Label><Input id="nameserver-secondary" placeholder="ns2.hosting.com" value={ns2} onChange={e => setNs2(e.target.value)} /></div>
                    </div>
                    {nsStatus && (
                      <p role="status" className={cn("text-sm font-medium mb-3", nsStatus.type === "error" ? "text-destructive" : "text-emerald-600")}>
                        {nsStatus.message}
                      </p>
                    )}
                    <Button onClick={handleSaveNameservers} disabled={savingNs} variant={hasNameservers ? "outline" : "default"}>
                        {savingNs ? "Saving..." : hasNameservers ? "Update Nameservers" : "Save Configuration"}
                    </Button>
                </CardContent>
            </Card>
        )}

        {/* STEP 3: DOWNLOAD CONTRACT (Only if signed) */}
        {isSigned && (
            <Card className="bg-slate-50 border-slate-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Download className="w-5 h-5" /> Your Documents
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <PDFDownloadLink 
                        document={<ContractDocument order={order} domain={domain} />} 
                        fileName={`Contract-${domain.name}.pdf`}
                        className="w-full block"
                    >
                        {({ loading }) => (
                            <Button className="w-full h-12" disabled={loading} variant="secondary">
                                {loading ? 'Generating PDF...' : 'Download Signed Agreement'}
                            </Button>
                        )}
                    </PDFDownloadLink>
                </CardContent>
            </Card>
        )}

        <div className="text-center">
             <Button variant="link" asChild><Link to="/marketplace/domains">Back to Marketplace</Link></Button>
        </div>

      </div>
    </div>
  );
}
