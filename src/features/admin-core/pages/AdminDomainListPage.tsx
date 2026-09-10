import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { Plus, Edit, Trash2, Globe, FileText, User } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminDomainListPage() {
  const [domains, setDomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'General',
    price_buy: '',
    price_rent_standard: '',
    price_rent_deal: '',
    fee_web_dev: '3000',
    status: 'available'
  });

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    const { data, error } = await supabase
      .from('store_domains')
      .select(`
        *,
        store_orders (
          id,
          buyer_name,
          payment_status,
          created_at
        )
      `)
      .order('created_at', { ascending: false });
      
    if (error) console.error('Error:', error);
    if (data) setDomains(data);
    setLoading(false);
  };

  const handleSave = async () => {
    setLoading(true);
    if (!formData.name || !formData.price_buy) {
        alert("Please fill in the domain name and buy price.");
        setLoading(false);
        return;
    }

    const { error } = await supabase.from('store_domains').insert([formData]);
    
    if (error) {
      alert('Error: ' + error.message);
    } else {
      setIsOpen(false);
      fetchDomains(); 
      setFormData({
        name: '', category: 'General', price_buy: '', 
        price_rent_standard: '', price_rent_deal: '', 
        fee_web_dev: '3000', status: 'available'
      });
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
      if (!confirm("Delete this domain?")) return;
      const { error } = await supabase.from('store_domains').delete().eq('id', id);
      if (!error) fetchDomains();
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 text-foreground">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <Globe className="h-8 w-8 text-blue-500" /> Domain Inventory
            </h1>
            <p className="text-slate-500">Manage assets, pricing, and active rentals.</p>
            </div>
            
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" /> Add Domain
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-card text-card-foreground">
                <DialogHeader>
                <DialogTitle>Add New Premium Domain</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Domain Name</label>
                    <Input placeholder="example.com" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                    <label className="text-sm font-medium">Buy Price (MAD)</label>
                    <Input type="number" placeholder="4000" value={formData.price_buy} onChange={e => setFormData({...formData, price_buy: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select onValueChange={(v) => setFormData({...formData, category: v})} defaultValue={formData.category}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Tech">Tech</SelectItem>
                        <SelectItem value="Business">Business</SelectItem>
                        <SelectItem value="Creative">Creative</SelectItem>
                        <SelectItem value="Real Estate">Real Estate</SelectItem>
                        </SelectContent>
                    </Select>
                    </div>
                </div>

                <div className="space-y-2 border-t pt-2 mt-2">
                    <h4 className="font-semibold text-xs text-slate-500 uppercase">Rental Options</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs">Standard Rent /mo</label>
                            <Input type="number" placeholder="70" value={formData.price_rent_standard} onChange={e => setFormData({...formData, price_rent_standard: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs">"Deal" Rent /mo</label>
                            <Input type="number" placeholder="10" className="border-yellow-500" value={formData.price_rent_deal} onChange={e => setFormData({...formData, price_rent_deal: e.target.value})} />
                        </div>
                    </div>
                </div>
                
                <Button onClick={handleSave} disabled={loading} className="w-full mt-4">
                    {loading ? 'Saving...' : 'List Domain'}
                </Button>
                </div>
            </DialogContent>
            </Dialog>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Listed Domains</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                <TableHeader>
                    <TableRow>
                    <TableHead>Domain Name</TableHead>
                    <TableHead>Prices (Buy / Rent)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Active Client</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {domains.map((domain) => {
                        const activeOrder = domain.store_orders && domain.store_orders.length > 0 
                            ? domain.store_orders.slice().sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                            : null;

                        return (
                        <TableRow key={domain.id}>
                            <TableCell className="font-medium text-lg text-blue-600">{domain.name}</TableCell>
                            <TableCell>
                                <div className="flex flex-col text-sm">
                                    <span className="font-bold">{domain.price_buy} MAD</span>
                                    <span className="text-xs text-slate-500">{domain.price_rent_standard} /mo</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={domain.status === 'available' ? 'default' : 'secondary'} 
                                       className={domain.status === 'available' ? 'bg-green-500' : ''}>
                                    {domain.status}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                {activeOrder ? (
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium flex items-center gap-1">
                                            <User className="w-3 h-3"/> {activeOrder.buyer_name}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            {activeOrder.payment_status}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-slate-400 text-sm">-</span>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    {activeOrder && (
                                        <Button asChild size="sm" variant="outline" className="h-8">
                                            <Link to={`/admin/domains/order/${activeOrder.id}`}>
                                                <FileText className="w-3 h-3 mr-1" /> Manage
                                            </Link>
                                        </Button>
                                    )}
                                    
                                    <Button variant="ghost" size="icon" className="text-red-500" aria-label={`Delete ${domain.name}`} onClick={() => handleDelete(domain.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                        );
                    })}
                </TableBody>
                </Table>
                </div>
                {domains.length === 0 && !loading && <p className="py-10 text-center text-sm text-muted-foreground">No domains listed yet. Add your first domain to begin.</p>}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
