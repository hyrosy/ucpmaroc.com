// In src/pages/dashboard/ActorPayoutSettingsPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/supabaseClient';
import { useOutletContext } from 'react-router-dom';
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout"; '@/features/talent-marketplace';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, PlusCircle, CheckCircle } from 'lucide-react';

interface PayoutMethod {
  id: string;
  bank_name: string;
  bank_holder_name: string;
  bank_iban: string;
  is_active: boolean;
}

const ActorPayoutSettingsPage = () => {
  const { actorData } = useOutletContext<ActorDashboardContextType>();
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // State for the "Add New" form
  const [bankName, setBankName] = useState('');
  const [holderName, setHolderName] = useState('');
  const [iban, setIban] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMethods = useCallback(async () => {
    if (!actorData.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('actor_payout_methods')
      .select('*')
      .eq('actor_id', actorData.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching methods:", error);
      setMessage(`Error: ${error.message}`);
    } else {
      setMethods(data as PayoutMethod[]);
    }
    setLoading(false);
  }, [actorData.id]);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !holderName || !iban || !actorData.id) {
      setMessage("Error: Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);
    setMessage(null);

    const { data, error } = await supabase
      .from('actor_payout_methods')
      .insert({
        actor_id: actorData.id,
        bank_name: bankName,
        bank_holder_name: holderName,
        bank_iban: iban
      })
      .select()
      .single();

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      // If this is their first method, automatically set it to active
      if (methods.length === 0 && data) {
        await handleSetActive(data.id);
      } else {
        fetchMethods(); // Just refresh the list
      }
      // Clear form
      setBankName('');
      setHolderName('');
      setIban('');
    }
    setIsSubmitting(false);
  };

  const handleSetActive = async (methodId: string) => {
    setMessage(null);
    const { error } = await supabase
      .from('actor_payout_methods')
      .update({ is_active: true })
      .eq('id', methodId);
      
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      // The trigger we created in SQL will handle deactivating old ones
      fetchMethods(); // Refresh list to show new active method
    }
  };

  const handleDelete = async (methodId: string) => {
    if (!window.confirm("Are you sure you want to delete this payout method?")) return;
    
    setMessage(null);
    const { error } = await supabase
      .from('actor_payout_methods')
      .delete()
      .eq('id', methodId);

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      fetchMethods(); // Refresh list
    }
  };

  return (
    <div className="space-y-6 w-full pt-20">
      {/* 1. Add New Method Card */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Payout Method</CardTitle>
          <CardDescription>
            Add a new bank account for receiving platform payouts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddMethod} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input id="bankName" value={bankName} onChange={(e) => setBankName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="holderName">Account Holder Name</Label>
                <Input id="holderName" value={holderName} onChange={(e) => setHolderName(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input id="iban" value={iban} onChange={(e) => setIban(e.target.value)} required />
            </div>
            
            {message && (
              <p className={`text-sm ${message.startsWith('Error') ? 'text-destructive' : 'text-green-500'}`}>
                {message}
              </p>
            )}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? "Saving..." : "Add Method"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 2. Manage Existing Methods Card */}
      <Card>
        <CardHeader>
          <CardTitle>Manage Payout Methods</CardTitle>
          <CardDescription>
            Set your active account or remove old ones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto"><Table className="min-w-[680px]">
            <TableHeader>
              <TableRow>
                <TableHead>Bank</TableHead>
                <TableHead>Account Holder</TableHead>
                <TableHead>IBAN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell></TableRow>
              ) : methods.length > 0 ? (
                methods.map(method => (
                  <TableRow key={method.id} className={method.is_active ? 'bg-muted/50' : ''}>
                    <TableCell className="font-medium">{method.bank_name}</TableCell>
                    <TableCell>{method.bank_holder_name}</TableCell>
                    <TableCell>{method.bank_iban}</TableCell>
                    <TableCell>
                      {method.is_active ? (
                        <Badge><CheckCircle className="h-3 w-3 mr-1" /> Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {!method.is_active && (
                        <Button variant="outline" size="sm" onClick={() => handleSetActive(method.id)}>
                          Set as Active
                        </Button>
                      )}
                      <Button variant="destructive" size="icon" aria-label={`Delete ${method.bank_name} payout method`} onClick={() => handleDelete(method.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="h-24 text-center">No payout methods added yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table></div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActorPayoutSettingsPage;