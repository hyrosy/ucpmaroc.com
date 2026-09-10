import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Archive } from 'lucide-react';
import { supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  MARKETPLACE_SERVICE_CATALOG,
  loadMarketplaceAllowedServiceIds,
  resetMarketplaceAllowedServiceIds,
  saveMarketplaceAllowedServiceIds,
  type MarketplaceServiceId,
} from '@/features/talent-marketplace/serviceCatalog';

const AdminMarketplaceSettingsPage = () => {
  const [allowedIds, setAllowedIds] = useState<MarketplaceServiceId[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [listings, setListings] = useState<any[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [updatingMedia, setUpdatingMedia] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadMarketplaceAllowedServiceIds().then((ids) => {
      if (mounted) setAllowedIds(ids);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const loadListings = async () => {
    const { data, error } = await supabase
      .from('actor_services')
      .select('*, actors(id, ActorName, ActorEmail, slug)')
      .order('updated_at', { ascending: false });
    if (error) setMessage(`Could not load service listings: ${error.message}`);
    else setListings(data || []);
  };

  useEffect(() => {
    loadListings();
  }, []);

  const reviewListing = async (id: string, status: 'approved' | 'rejected' | 'archived') => {
    setReviewingId(id);
    const { error } = await supabase.from('actor_services').update({ status, enabled: status === 'approved', reviewed_at: new Date().toISOString() }).eq('id', id);
    if (error) setMessage(`Could not update listing: ${error.message}`);
    else {
      setListings((previous) => previous.map((listing) => listing.id === id ? { ...listing, status, enabled: status === 'approved' } : listing));
      setMessage(`Service listing ${status}.`);
    }
    setReviewingId(null);
  };

  const updateMedia = async (mediaKeys: string[], status: 'approved' | 'rejected') => {
    setUpdatingMedia(true);
    setMessage('');
    try {
    const byListing = new Map<string, string[]>();
    for (const mediaKey of mediaKeys) {
      const separatorIndex = mediaKey.indexOf(':');
      const listingId = mediaKey.slice(0, separatorIndex);
      const url = mediaKey.slice(separatorIndex + 1);
      byListing.set(listingId, [...(byListing.get(listingId) || []), url]);
    }
    for (const listing of listings) {
      const changed = byListing.get(listing.id);
      if (!changed) continue;
      const nextAssets = (listing.media_assets || []).map((asset: any) => changed.includes(asset.url) ? { ...asset, status } : asset);
      const { error } = await supabase.from('actor_services').update({ media_assets: nextAssets, media_urls: nextAssets.filter((asset: any) => asset.status === 'approved').map((asset: any) => asset.url) }).eq('id', listing.id);
      if (error) throw error;
    }
      setListings((previous) => previous.map((listing) => ({ ...listing, media_assets: (listing.media_assets || []).map((asset: any) => mediaKeys.includes(`${listing.id}:${asset.url}`) ? { ...asset, status } : asset) })));
      setSelectedMedia([]);
      setMessage(`Selected images ${status}.`);
    } catch (error) {
      setMessage(`Could not update gallery images: ${(error as Error).message}`);
    } finally {
      setUpdatingMedia(false);
    }
  };

  const pendingMedia = listings.flatMap((listing) => (listing.media_assets || []).filter((asset: any) => asset.status === 'pending').map((asset: any) => ({ ...asset, listingId: listing.id, actorName: listing.actors?.ActorName, listingTitle: listing.title })));

  const selectedCount = allowedIds.length;

  const handleToggle = (id: MarketplaceServiceId, checked: boolean) => {
    setAllowedIds((prev) => {
      if (checked) {
        return [...new Set([...prev, id])];
      }
      return prev.filter((entry) => entry !== id);
    });
  };

  const allSelected = useMemo(() => selectedCount === MARKETPLACE_SERVICE_CATALOG.length, [selectedCount]);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      await saveMarketplaceAllowedServiceIds(allowedIds);
      setMessage('Marketplace category settings saved.');
    } catch {
      setMessage('Something went wrong while saving the settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const defaults = resetMarketplaceAllowedServiceIds();
    setAllowedIds(defaults);
    setSaving(true);
    setMessage('');

    try {
      await saveMarketplaceAllowedServiceIds(defaults);
      setMessage('Marketplace categories reset to default allowlist.');
    } catch {
      setMessage('Something went wrong while resetting the settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAll = (checked: boolean) => {
    setAllowedIds(checked ? MARKETPLACE_SERVICE_CATALOG.map((service) => service.id) : []);
  };

  return (
    <div className='max-w-6xl mx-auto p-6 md:p-8 space-y-6'>
      <div className='flex items-center justify-between gap-4 flex-wrap'>
        <div>
          <p className='text-sm uppercase tracking-[0.2em] text-muted-foreground'>Admin</p>
          <h1 className='text-3xl font-bold'>Marketplace categories</h1>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={handleReset}>Reset defaults</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</Button>
        </div>
      </div>

      {message && (
        <Card className='border-green-500/20 bg-green-500/5'>
          <CardContent className='p-4 text-sm text-green-700 dark:text-green-300'>{message}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Allowed marketplace categories</CardTitle>
          <CardDescription>
            Control which service categories are available to providers and clients across the platform. This is the central allowlist for the marketplace.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div>
              <p className='font-medium'>All categories</p>
              <p className='text-sm text-muted-foreground'>{selectedCount} / {MARKETPLACE_SERVICE_CATALOG.length} enabled</p>
            </div>
            <Checkbox id='all-marketplace-categories' checked={allSelected} onCheckedChange={(checked) => handleToggleAll(Boolean(checked))} />
            <Label htmlFor='all-marketplace-categories' className='sr-only'>Enable all marketplace categories</Label>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {MARKETPLACE_SERVICE_CATALOG.map((service) => {
              const checked = allowedIds.includes(service.id);

              return (
                <div key={service.id} className='rounded-lg border p-4 flex items-start gap-3'>
                  <Checkbox
                    id={`marketplace-category-${service.id}`}
                    checked={checked}
                    onCheckedChange={(value) => handleToggle(service.id, Boolean(value))}
                  />
                  <div className='space-y-1'>
                    <Label htmlFor={`marketplace-category-${service.id}`} className='font-semibold'>{service.label}</Label>
                    <p className='text-sm text-muted-foreground'>{service.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className='flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'><div><CardTitle>Gallery image approvals</CardTitle><CardDescription>Select multiple new images and approve them together.</CardDescription></div><Button onClick={() => updateMedia(selectedMedia, 'approved')} disabled={!selectedMedia.length || updatingMedia}>{updatingMedia ? 'Updating...' : `Approve selected (${selectedMedia.length})`}</Button></div>
        </CardHeader>
        <CardContent>
          {pendingMedia.length === 0 ? <p className='text-sm text-muted-foreground'>No pending gallery images.</p> : <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'>{pendingMedia.map((asset: any) => { const key = `${asset.listingId}:${asset.url}`; const checked = selectedMedia.includes(key); return <button type='button' key={key} onClick={() => setSelectedMedia((previous) => checked ? previous.filter((item) => item !== key) : [...previous, key])} className={`relative overflow-hidden rounded-xl border-2 text-left ${checked ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}><img src={asset.url} alt={asset.listingTitle || 'Pending service gallery'} className='aspect-square w-full object-cover' /><span className='block truncate p-2 text-xs'>{asset.actorName || 'Provider'}</span>{checked && <span className='absolute right-2 top-2 rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground'>Selected</span>}</button>; })}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service listing review</CardTitle>
          <CardDescription>Review provider listings before they become visible in the public marketplace.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {listings.length === 0 ? <p className='text-sm text-muted-foreground'>No service listings have been created yet.</p> : listings.map((listing) => (
            <div key={listing.id} className='rounded-xl border p-4'>
              <div className='flex flex-col justify-between gap-4 md:flex-row md:items-start'>
                <div className='space-y-1'>
                  <div className='flex flex-wrap items-center gap-2'><h3 className='font-bold'>{listing.title || listing.service_id}</h3><span className='rounded-full bg-muted px-2 py-1 text-xs font-semibold'>{listing.status}</span></div>
                  <p className='text-sm text-muted-foreground'>By {listing.actors?.ActorName || 'Unknown provider'} · {listing.service_id}</p>
                  <p className='max-w-2xl text-sm'>{listing.description || 'No description provided.'}</p>
                  <p className='text-sm font-semibold text-primary'>{listing.rate ? `${listing.rate} MAD` : 'Custom quote'} {listing.discount_percent ? `· ${listing.discount_percent}% discount` : ''}</p>
                </div>
                <div className='flex shrink-0 flex-wrap gap-2'>
                  <Button size='sm' onClick={() => reviewListing(listing.id, 'approved')} disabled={reviewingId === listing.id || listing.status === 'approved'}><CheckCircle2 className='mr-1 h-4 w-4' /> Approve</Button>
                  <Button size='sm' variant='outline' onClick={() => reviewListing(listing.id, 'rejected')} disabled={reviewingId === listing.id || listing.status === 'rejected'}><XCircle className='mr-1 h-4 w-4' /> Reject</Button>
                  <Button size='sm' variant='ghost' onClick={() => reviewListing(listing.id, 'archived')} disabled={reviewingId === listing.id || listing.status === 'archived'}><Archive className='mr-1 h-4 w-4' /> Archive</Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMarketplaceSettingsPage;
