import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { Link, useOutletContext } from 'react-router-dom';
import { ActorDashboardContextType } from '@/layouts/ActorDashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, ExternalLink, ImagePlus, Loader2, Plus, Save, Send, Trash2, Upload } from 'lucide-react';
import { getMarketplaceAllowedServiceIds, loadMarketplaceAllowedServiceIds, MARKETPLACE_SERVICE_CATALOG, getServiceIcon, type MarketplaceServiceId } from '@/features/talent-marketplace/serviceCatalog';

type ListingStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived';
type ServiceOffer = { title?: string; description?: string; price?: number; delivery_time?: string; revisions?: number };
type ServiceMediaAsset = { url: string; status: 'pending' | 'approved' | 'rejected' };
type ServiceListing = { id: string; actor_id: string; service_id: MarketplaceServiceId; title: string | null; description: string | null; rate: number | null; discount_percent: number | null; delivery_time: string | null; location: string | null; media_urls: string[]; media_assets: ServiceMediaAsset[]; audio_urls: string[]; offers: ServiceOffer[]; enabled: boolean; status: ListingStatus; review_note?: string | null };
const statusLabels: Record<ListingStatus, string> = { draft: 'Draft', pending_review: 'In review', approved: 'Published', rejected: 'Changes requested', archived: 'Archived' };

const DashboardServices: React.FC<{ initialServiceId?: MarketplaceServiceId }> = ({ initialServiceId }) => {
  const { actorData } = useOutletContext<ActorDashboardContextType>();
  const [listings, setListings] = useState<ServiceListing[]>([]);
  const [allowedIds, setAllowedIds] = useState<MarketplaceServiceId[]>(getMarketplaceAllowedServiceIds());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newServiceId, setNewServiceId] = useState<MarketplaceServiceId | ''>('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [uploading, setUploading] = useState(false); const [message, setMessage] = useState('');
  const selectedListing = listings.find((listing) => listing.id === selectedId) || null;
  const availableToCreate = useMemo(() => MARKETPLACE_SERVICE_CATALOG.filter((service) => allowedIds.includes(service.id) && !listings.some((listing) => listing.service_id === service.id)), [allowedIds, listings]);

  const fetchListings = useCallback(async () => {
    if (!actorData.id) return;
    setLoading(true); setAllowedIds(await loadMarketplaceAllowedServiceIds());
    const { data, error } = await supabase.from('actor_services').select('*').eq('actor_id', actorData.id).neq('status', 'archived').order('created_at', { ascending: true });
    if (error) setMessage(`Error loading services: ${error.message}`); else { const loaded = (data || []).map((listing: ServiceListing) => ({ ...listing, offers: Array.isArray(listing.offers) ? listing.offers : [], media_urls: listing.media_urls || [], media_assets: Array.isArray(listing.media_assets) ? listing.media_assets : (listing.media_urls || []).map((url) => ({ url, status: 'approved' as const })), audio_urls: listing.audio_urls || [] })); setListings(loaded); setSelectedId((current) => current && loaded.some((listing) => listing.id === current) ? current : loaded.find((listing) => listing.service_id === initialServiceId)?.id || loaded[0]?.id || null); }
    setLoading(false);
  }, [actorData.id, initialServiceId]);
  useEffect(() => { fetchListings(); }, [fetchListings]);

  const updateSelected = (patch: Partial<ServiceListing>) => setListings((previous) => previous.map((listing) => listing.id === selectedId ? { ...listing, ...patch } : listing));
  const updateOffer = (index: number, patch: Partial<ServiceOffer>) => selectedListing && updateSelected({ offers: selectedListing.offers.map((offer, offerIndex) => offerIndex === index ? { ...offer, ...patch } : offer) });

  const createService = async () => {
    if (!actorData.id || !newServiceId) return;
    const catalog = MARKETPLACE_SERVICE_CATALOG.find((service) => service.id === newServiceId); if (!catalog) return;
    setSaving(true); const { data, error } = await supabase.from('actor_services').insert({ actor_id: actorData.id, service_id: newServiceId, title: catalog.label, description: catalog.description, status: 'draft', enabled: false, offers: [], media_urls: [], media_assets: [], audio_urls: [] }).select('*').single();
    if (error) setMessage(`Could not create service: ${error.message}`); else if (data) { setListings((previous) => [...previous, data as ServiceListing]); setSelectedId(data.id); setNewServiceId(''); setMessage('Service created as a draft.'); } setSaving(false);
  };

  const uploadFiles = async (event: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'audio') => {
    const files = Array.from(event.target.files || []); if (!selectedListing || !files.length) return;
    setUploading(true);
    try { const bucket = kind === 'image' ? 'portfolio-assets' : 'demos'; const urls: string[] = []; for (const file of files) { const extension = file.name.split('.').pop() || (kind === 'image' ? 'jpg' : 'mp3'); const path = `service-listings/${selectedListing.actor_id}/${selectedListing.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`; const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false }); if (error) throw error; urls.push(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl); } updateSelected(kind === 'image' ? { media_assets: [...selectedListing.media_assets, ...urls.map((url) => ({ url, status: 'pending' as const }))] } : { audio_urls: [...selectedListing.audio_urls, ...urls] }); setMessage(`${kind === 'image' ? 'Images' : 'Audio'} uploaded. Save the service to keep them.`); }
    catch (error) { setMessage(`Upload failed: ${(error as Error).message}`); } finally { setUploading(false); event.target.value = ''; }
  };

  const saveListing = async (submitForReview = false) => {
    if (!selectedListing) return; setSaving(true); const status: ListingStatus = submitForReview ? 'pending_review' : selectedListing.status; const enabled = submitForReview ? false : selectedListing.enabled;
    const approvedMediaUrls = selectedListing.media_assets.filter((asset) => asset.status === 'approved').map((asset) => asset.url);
    const { error } = await supabase.from('actor_services').update({ title: selectedListing.title, description: selectedListing.description, rate: selectedListing.rate || null, discount_percent: selectedListing.discount_percent || null, delivery_time: selectedListing.delivery_time, location: selectedListing.location, media_assets: selectedListing.media_assets, media_urls: approvedMediaUrls, audio_urls: selectedListing.audio_urls, offers: selectedListing.offers, enabled, status, updated_at: new Date().toISOString() }).eq('id', selectedListing.id);
    if (error) setMessage(`Could not save service: ${error.message}`); else { updateSelected({ status, enabled }); setMessage(submitForReview ? 'Service submitted for review.' : 'Service saved.'); } setSaving(false);
  };

  const togglePublished = async () => {
    if (!selectedListing || selectedListing.status !== 'approved') return;
    setSaving(true);
    const enabled = !selectedListing.enabled;
    const { error } = await supabase.from('actor_services').update({ enabled, updated_at: new Date().toISOString() }).eq('id', selectedListing.id);
    if (error) setMessage(`Could not update publication: ${error.message}`);
    else { updateSelected({ enabled }); setMessage(enabled ? 'Service published.' : 'Service unpublished.'); }
    setSaving(false);
  };

  const deleteDraft = async () => { if (!selectedListing || selectedListing.status !== 'draft') return; const { error } = await supabase.from('actor_services').delete().eq('id', selectedListing.id); if (error) setMessage(`Could not remove draft: ${error.message}`); else { setListings((previous) => previous.filter((listing) => listing.id !== selectedListing.id)); setSelectedId(null); setMessage('Draft removed.'); } };
  if (loading) return <div className='p-8 text-center text-muted-foreground'>Loading your services...</div>;

  return <div className='mx-auto w-full max-w-6xl px-4 pb-16 pt-8 md:px-8'>
    <div className='mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end'><div><p className='mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-primary'>Marketplace workspace</p><h1 className='text-4xl font-black tracking-tight'>Your services</h1><p className='mt-2 text-muted-foreground'>Create a listing, upload your work, and submit it for review.</p></div><div className='flex items-center gap-2'><Select value={newServiceId} onValueChange={(value) => setNewServiceId(value as MarketplaceServiceId)}><SelectTrigger className='w-52'><SelectValue placeholder='Choose a service' /></SelectTrigger><SelectContent>{availableToCreate.map((service) => <SelectItem key={service.id} value={service.id}>{service.label}</SelectItem>)}</SelectContent></Select><Button onClick={createService} disabled={!newServiceId || saving} className='gap-2'><Plus className='h-4 w-4' /> Add service</Button></div></div>
    {message && <div className='mb-6 rounded-xl border border-primary/20 bg-primary/5 p-3 text-center text-sm font-medium'>{message}</div>}
    {listings.length === 0 ? <Card className='border-dashed'><CardContent className='flex flex-col items-center gap-4 p-12 text-center'><Plus className='h-10 w-10 text-primary' /><h2 className='text-2xl font-bold'>Create your first service</h2><p className='max-w-md text-muted-foreground'>Choose an approved category above to create a draft listing.</p></CardContent></Card> : <div className='grid gap-6 lg:grid-cols-[280px_1fr]'>
      <div className='space-y-3'>{listings.map((listing) => { const catalog = MARKETPLACE_SERVICE_CATALOG.find((service) => service.id === listing.service_id); const Icon = getServiceIcon(listing.service_id); return <button key={listing.id} type='button' onClick={() => setSelectedId(listing.id)} className={`w-full rounded-xl border p-4 text-left transition ${listing.id === selectedId ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/50'}`}><div className='flex items-start justify-between gap-3'><Icon className='h-5 w-5 text-primary' /><span className='text-xs font-semibold text-muted-foreground'>{statusLabels[listing.status]}</span></div><p className='mt-4 font-bold'>{listing.title || catalog?.label}</p><p className='mt-1 text-xs text-muted-foreground'>{catalog?.label} · {listing.enabled ? 'Enabled' : 'Disabled'}</p></button>; })}</div>
      {selectedListing && <Card><CardHeader><div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-start'><div><CardTitle>{selectedListing.title || 'Untitled service'}</CardTitle><CardDescription>{MARKETPLACE_SERVICE_CATALOG.find((service) => service.id === selectedListing.service_id)?.description}</CardDescription></div><div className='flex flex-wrap gap-2'>{selectedListing.status === 'approved' && actorData.slug && <Button variant='outline' asChild><Link to={`/market/service/${actorData.slug}/${selectedListing.service_id}`} target='_blank' rel='noreferrer'><ExternalLink className='mr-2 h-4 w-4' /> Preview service</Link></Button>}{selectedListing.status === 'draft' && <Button variant='outline' onClick={deleteDraft}><Trash2 className='mr-2 h-4 w-4' /> Delete draft</Button>}<Button onClick={() => saveListing(false)} disabled={saving || uploading}><Save className='mr-2 h-4 w-4' /> Save</Button>{selectedListing.status === 'approved' && <Button variant='outline' onClick={togglePublished} disabled={saving}>{selectedListing.enabled ? <><EyeOff className='mr-2 h-4 w-4' /> Unpublish</> : <><Eye className='mr-2 h-4 w-4' /> Publish</>}</Button>}</div></div></CardHeader><CardContent className='space-y-6'>
        <div className='flex items-center justify-between rounded-xl border bg-muted/30 p-4'><div><p className='font-semibold'>Listing status</p><p className='text-sm text-muted-foreground'>{selectedListing.review_note || 'Complete the listing, then submit it for marketplace review.'}</p></div><span className='rounded-full bg-background px-3 py-1 text-sm font-semibold'>{statusLabels[selectedListing.status]}</span></div>
        <div className='grid gap-5 md:grid-cols-2'><div className='space-y-2 md:col-span-2'><Label htmlFor='service-title'>Service title</Label><Input id='service-title' value={selectedListing.title || ''} onChange={(event) => updateSelected({ title: event.target.value })} /></div><div className='space-y-2 md:col-span-2'><Label htmlFor='service-description'>Description</Label><Textarea id='service-description' rows={6} value={selectedListing.description || ''} onChange={(event) => updateSelected({ description: event.target.value })} /></div><div className='space-y-2'><Label htmlFor='service-rate'>Starting price (MAD)</Label><Input id='service-rate' type='number' min='0' value={selectedListing.rate || ''} onChange={(event) => updateSelected({ rate: Number(event.target.value) || null })} /></div><div className='space-y-2'><Label htmlFor='service-discount'>Discount (%)</Label><Input id='service-discount' type='number' min='0' max='100' value={selectedListing.discount_percent || ''} onChange={(event) => updateSelected({ discount_percent: Number(event.target.value) || null })} /></div><div className='space-y-2'><Label htmlFor='service-time'>Delivery time</Label><Input id='service-time' value={selectedListing.delivery_time || ''} onChange={(event) => updateSelected({ delivery_time: event.target.value })} /></div><div className='space-y-2'><Label htmlFor='service-location'>Location or coverage</Label><Input id='service-location' value={selectedListing.location || ''} onChange={(event) => updateSelected({ location: event.target.value })} /></div></div>
        <div className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-3 rounded-xl border p-4'>
            <div className='flex items-center gap-2 font-semibold'><ImagePlus className='h-5 w-5 text-primary' /> Gallery images</div>
            <Input type='file' accept='image/*' multiple disabled={uploading} onChange={(event) => uploadFiles(event, 'image')} />
            <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4'>
              {selectedListing.media_assets.map((asset, index) => (
                <div key={asset.url} className='relative group'>
                  <img src={asset.url} alt='Service gallery' className='aspect-square w-full rounded-lg object-cover' />
                  <span className='absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white'>{asset.status}</span>
                  <button 
                    type="button" 
                    aria-label={`Remove gallery image ${index + 1}`}
                    onClick={() => {
                      const newAssets = [...selectedListing.media_assets];
                      newAssets.splice(index, 1);
                      updateSelected({ media_assets: newAssets });
                    }}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <p className='text-xs text-muted-foreground'>New images stay hidden from clients until admin approval.</p>
          </div>
          <div className='space-y-3 rounded-xl border p-4'>
            <div className='flex items-center gap-2 font-semibold'><Upload className='h-5 w-5 text-primary' /> Audio previews</div>
            <Input type='file' accept='audio/*' multiple disabled={uploading} onChange={(event) => uploadFiles(event, 'audio')} />
            {selectedListing.audio_urls.map((url, index) => (
              <div key={url} className="flex items-center gap-2">
                <audio controls src={url} className='w-full' />
                <Button variant="ghost" size="icon" aria-label={`Remove audio preview ${index + 1}`} className="text-destructive hover:bg-destructive/10 shrink-0" onClick={() => {
                  const newUrls = [...selectedListing.audio_urls];
                  newUrls.splice(index, 1);
                  updateSelected({ audio_urls: newUrls });
                }}>
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div><h3 className='font-bold'>Offer packages</h3><p className='text-sm text-muted-foreground'>Give clients clear options.</p></div>
            <Button type='button' variant='outline' onClick={() => updateSelected({ offers: [...selectedListing.offers, { title: 'New offer', description: '', price: selectedListing.rate || 0, delivery_time: selectedListing.delivery_time || '', revisions: 1 }] })}><Plus className='mr-2 h-4 w-4' /> Add offer</Button>
          </div>
          {selectedListing.offers.map((offer, index) => (
            <div key={index} className='grid gap-3 rounded-xl border p-4 md:grid-cols-2 relative group'>
              <Button variant="ghost" size="icon" aria-label={`Remove offer ${index + 1}`} className="absolute top-2 right-2 text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                const newOffers = [...selectedListing.offers];
                newOffers.splice(index, 1);
                updateSelected({ offers: newOffers });
              }}>
                <Trash2 size={16} />
              </Button>
              <div className="md:col-span-2 pr-8 space-y-1">
                <Label>Offer Name</Label>
                <Input value={offer.title || ''} onChange={(event) => updateOffer(index, { title: event.target.value })} placeholder='Offer name' />
              </div>
              <div className="space-y-1"><Label>Price</Label><Input type='number' value={offer.price || ''} onChange={(event) => updateOffer(index, { price: Number(event.target.value) || 0 })} placeholder='Price' /></div>
              <div className="space-y-1"><Label>Revisions</Label><Input type='number' value={offer.revisions || ''} onChange={(event) => updateOffer(index, { revisions: Number(event.target.value) || 0 })} placeholder='Revisions' /></div>
              <div className="md:col-span-2 space-y-1"><Label>Delivery Time</Label><Input value={offer.delivery_time || ''} onChange={(event) => updateOffer(index, { delivery_time: event.target.value })} placeholder='Delivery time (e.g. 2 Days)' /></div>
              <div className="md:col-span-2 space-y-1"><Label>What's included</Label><Textarea value={offer.description || ''} onChange={(event) => updateOffer(index, { description: event.target.value })} placeholder='What this package includes' /></div>
            </div>
          ))}
        </div>
        {selectedListing.status === 'approved' && <div className='flex items-center justify-between border-t pt-5'><div><Label htmlFor='service-enabled'>Public visibility</Label><p className='text-sm text-muted-foreground'>{selectedListing.enabled ? 'Clients can see this service.' : 'This service is hidden from clients.'}</p></div><Switch id='service-enabled' checked={selectedListing.enabled} disabled={saving} onCheckedChange={togglePublished} /></div>}{selectedListing.status !== 'approved' && <Button onClick={() => saveListing(true)} disabled={saving || uploading || selectedListing.status === 'pending_review'} className='w-full gap-2'>{saving ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />} Submit for review</Button>}
      </CardContent></Card>}
    </div>}
  </div>;
};

export default DashboardServices;
