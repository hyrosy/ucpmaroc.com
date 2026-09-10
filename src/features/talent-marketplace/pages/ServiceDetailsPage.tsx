import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, MapPin, ShieldCheck, Star, Volume2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMarketplaceServiceDefinitions, getServiceIcon, type MarketplaceServiceId } from '@/features/talent-marketplace/serviceCatalog';
import { QuoteCalculatorModal } from '@/features/talent-marketplace';

interface ServiceListing {
  id: string;
  service_id: MarketplaceServiceId;
  title: string | null;
  description: string | null;
  rate: number | null;
  discount_percent: number | null;
  delivery_time: string | null;
  location: string | null;
  media_urls: string[];
  audio_urls: string[];
  offers: Array<{ title?: string; description?: string; price?: number; delivery_time?: string; revisions?: number }>;
  status: string;
  enabled: boolean;
}

const ServiceDetailsPage: React.FC = () => {
  const { actorSlug, serviceId } = useParams<{ actorSlug: string; serviceId: MarketplaceServiceId }>();
  const navigate = useNavigate();
  const [actor, setActor] = useState<any>(null);
  const [listing, setListing] = useState<ServiceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState<Array<{ id: string; rating: number; comment: string | null; created_at: string }>>([]);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  useEffect(() => {
    const loadListing = async () => {
      if (!actorSlug || !serviceId) return;
      const { data, error: actorError } = await supabase
        .from('actors')
        .select('id, slug, ActorName, HeadshotURL, Language, country, actor_services(*)')
        .eq('slug', actorSlug)
        .single();

      if (actorError || !data) {
        setError('This service could not be found.');
        setLoading(false);
        return;
      }

      const service = (data.actor_services || []).find((item: ServiceListing) => item.service_id === serviceId && item.enabled && item.status === 'approved');
      if (!service) setError('This service is not currently available.');
      setActor(data);
      setListing(service || null);
      if (data.id) {
        const { data: reviewData } = await supabase.from('reviews').select('id, rating, comment, created_at').eq('actor_id', data.id).order('created_at', { ascending: false }).limit(6);
        setReviews(reviewData || []);
      }
      setLoading(false);
    };

    loadListing();
  }, [actorSlug, serviceId]);

  if (loading) return <div className='flex min-h-screen items-center justify-center text-muted-foreground'>Loading service...</div>;
  if (error || !listing || !actor) return <div className='flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center'><h1 className='text-2xl font-bold'>{error || 'Service unavailable'}</h1><Button asChild><Link to='/market'>Back to marketplace</Link></Button></div>;

  const catalogService = getMarketplaceServiceDefinitions(actor, [listing.service_id])[0];
  const Icon = getServiceIcon(listing.service_id);
  const offers = Array.isArray(listing.offers) ? listing.offers : [];

  return (
    <main className='min-h-screen bg-background pb-20 pt-24'>
      <div className='mx-auto max-w-6xl px-4'>
        <button aria-label='Go back to marketplace' onClick={() => navigate(-1)} className='mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground'><ArrowLeft className='h-4 w-4' /> Back to marketplace</button>
        <div className='grid gap-8 lg:grid-cols-[1.4fr_0.8fr]'>
          <div>
            <div className='grid gap-3 sm:grid-cols-2'>
              {(listing.media_urls?.length ? listing.media_urls : [actor.HeadshotURL]).filter(Boolean).map((url, index) => <img key={`${url}-${index}`} src={url} alt={listing.title || catalogService?.label} className='h-64 w-full rounded-2xl object-cover sm:h-80' />)}
            </div>
            <div className='mt-8 space-y-4'>
              <div className='flex flex-wrap items-center gap-3'><Badge>{catalogService?.label || listing.service_id}</Badge>{listing.location && <span className='flex items-center gap-1 text-sm text-muted-foreground'><MapPin className='h-4 w-4' />{listing.location}</span>}</div>
              <h1 className='text-4xl font-black tracking-tight'>{listing.title || catalogService?.label}</h1>
              <p className='text-lg leading-8 text-muted-foreground'>{listing.description || catalogService?.description}</p>
              <div className='flex flex-wrap gap-5 border-y border-border py-5 text-sm text-muted-foreground'><span className='flex items-center gap-2'><Icon className='h-4 w-4 text-primary' />By {actor.ActorName}</span>{listing.delivery_time && <span className='flex items-center gap-2'><Clock3 className='h-4 w-4 text-primary' />{listing.delivery_time}</span>}<span className='flex items-center gap-2'><ShieldCheck className='h-4 w-4 text-primary' />Protected project</span></div>
            </div>
          </div>
          <aside>
            <Card className='sticky top-24 border-border/70 shadow-lg'>
              <CardHeader><CardTitle className='flex items-center justify-between gap-3'><span>Choose an offer</span><span className='text-xl text-primary'>{listing.rate ? `${listing.rate} MAD` : 'Custom quote'}</span></CardTitle></CardHeader>
              <CardContent className='space-y-4'>
                {listing.discount_percent ? <p className='text-sm font-semibold text-emerald-600'>{listing.discount_percent}% introductory discount available</p> : null}
                {offers.length > 0 ? offers.map((offer, index) => <div key={`${offer.title}-${index}`} className='rounded-xl border border-border p-4'><div className='flex items-start justify-between gap-3'><div><h3 className='font-bold'>{offer.title || `Offer ${index + 1}`}</h3><p className='mt-1 text-sm text-muted-foreground'>{offer.description || 'A tailored service package.'}</p></div><span className='font-bold text-primary'>{offer.price ? `${offer.price} MAD` : 'Quote'}</span></div><div className='mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground'>{offer.delivery_time && <span>{offer.delivery_time}</span>}{offer.revisions !== undefined && <span>{offer.revisions} revisions</span>}</div></div>) : <div className='rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground'>Tell the provider what you need and receive a tailored offer.</div>}
                <Button onClick={() => setIsQuoteModalOpen(true)} size='lg' className='w-full justify-between'>Request this service <ArrowRight className='h-4 w-4' /></Button>
                <p className='text-center text-xs text-muted-foreground'>You will confirm scope and payment after the provider reviews your request.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
        {listing.audio_urls?.length > 0 && <section className='mt-10 space-y-4'><h2 className='flex items-center gap-2 text-2xl font-bold'><Volume2 className='h-5 w-5 text-primary' />Service previews</h2>{listing.audio_urls.map((url, index) => <audio key={url} aria-label={`Service preview ${index + 1}`} controls src={url} className='w-full' />)}</section>}
        <section className='mt-10 space-y-4'><div className='flex items-center justify-between'><h2 className='text-2xl font-bold'>Reviews</h2><span className='text-sm text-muted-foreground'>{reviews.length} recent reviews</span></div>{reviews.length > 0 ? reviews.map((review) => <div key={review.id} className='rounded-xl border p-4'><div className='flex items-center justify-between gap-3'><div className='flex'>{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-4 w-4 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />)}</div><span className='text-xs text-muted-foreground'>{new Date(review.created_at).toLocaleDateString()}</span></div>{review.comment && <p className='mt-2 text-sm text-muted-foreground'>{review.comment}</p>}</div>) : <p className='text-sm text-muted-foreground'>Reviews will appear here after completed projects.</p>}</section>
        <section className='mt-12 grid gap-4 md:grid-cols-3'><div className='flex gap-3 rounded-xl border p-4'><Check className='h-5 w-5 text-emerald-600' /><span className='text-sm'>Clear service scope and delivery expectations</span></div><div className='flex gap-3 rounded-xl border p-4'><Check className='h-5 w-5 text-emerald-600' /><span className='text-sm'>Secure communication with {actor.ActorName}</span></div><div className='flex gap-3 rounded-xl border p-4'><Check className='h-5 w-5 text-emerald-600' /><span className='text-sm'>Protected marketplace order process</span></div></section>
      </div>
      {isQuoteModalOpen && actor && ( <QuoteCalculatorModal actor={actor} initialService={listing.service_id} onClose={() => setIsQuoteModalOpen(false)} /> )}
    </main>
  );
};

export default ServiceDetailsPage;
