// In src/features/talent-marketplace/pages/ActorProfilePage.tsx

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { QuoteCalculatorModal } from '@/features/talent-marketplace';
import { getMarketplaceServiceDefinitions, getServiceIcon, getServiceLabel, loadMarketplaceAllowedServiceIds } from '@/features/talent-marketplace/serviceCatalog';
import { Play, Pause, Mic, Phone, CheckCircle, Share2, Heart, UserPlus, Star, PencilLine, Video, FileText, ArrowUpRight, MapPin } from 'lucide-react';
import GlobalAudioPlayer from '@/components/GlobalAudioPlayer';
import { MessageSquare } from 'lucide-react'; // <-- Import an icon
import { useNavigate } from 'react-router-dom'; // <-- Make sure this is imported
// --- shadcn/ui Imports ---
// We'll use these to build the new service tabs
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';

interface Demo {
  id: string;
  title: string;
  demo_url: string;
  language: string;
  style_tag: string;
  likes?: number;
}

interface ScriptDemo {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

interface VideoDemo {
  id: string;
  title: string;
  video_url: string;
  created_at: string;
}

interface Actor {
  id: string;
  ActorName: string;
  bio: string | null;
  Gender: string;
  Language: string;
  Tags: string | null;
  HeadshotURL: string;
  MainDemoURL: string;
  revisions_allowed: number;
  BaseRate_per_Word: string;
  WebMultiplier: string;
  BroadcastMultiplier: string;
  ActorEmail: string;
  slug: string;
  actor_followers: { count: number }[];
  demo_likes: { count: number }[];
  // Service Toggles & Rates
  service_script_description: string | null;
  service_script_rate: number;
  service_video_description: string | null;
  service_video_rate: number;
    actor_services?: Array<{
        service_id: string;
        enabled: boolean;
        status?: string;
        description?: string | null;
        rate?: number | null;
    }>;
}

interface ActorReview {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
}

interface CurrentTrack {
  url: string;
  actor: {
    ActorName: string;
    HeadshotURL: string;
  }
}
// --- End Interfaces ---

const ActorProfilePage = () => {
    // Correctly get the slug from the URL parameter named 'actorName'
    const { actorName: actorSlug } = useParams<{ actorName: string }>();
    const [actor, setActor] = useState<any>(null); // Assuming you have actor state
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [totalLikes, setTotalLikes] = useState(0);
    const [userLikes, setUserLikes] = useState<string[]>([]);
    
    // Audio Player State
    const [demos, setDemos] = useState<Demo[]>([]);
    const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);
    const navigate = useNavigate();
    // Follow State
    const [isFollowing, setIsFollowing] = useState(false);
    
    // Review State
    const [reviews, setReviews] = useState<ActorReview[]>([]);
    const [averageRating, setAverageRating] = useState<number | null>(null);
    const [isLoadingReviews, setIsLoadingReviews] = useState<boolean>(true);    // --- 2. NEW State for multi-service demos ---
    const [scriptDemos, setScriptDemos] = useState<ScriptDemo[]>([]);
    const [videoDemos, setVideoDemos] = useState<VideoDemo[]>([]);
    const [availableServices, setAvailableServices] = useState<any[]>([]); // To store enabled services
    // ---
    const [isStartingChat, setIsStartingChat] = useState(false);
    const [quoteServiceId, setQuoteServiceId] = useState<string | null>(null);


    // Data fetching (already optimized)
    useEffect(() => {
      const getActorData = async () => {
          if (!actorSlug) return;
          setIsLoading(true);
          setError('');

          // 1. Fetch actor profile (now includes service info)
          const { data: actorData, error: actorError } = await supabase
              .from('actors')
              .select(`
                *, 
                actor_followers(count), 
                demo_likes(count),
                actor_services(service_id, enabled, status, description, rate)
              `)
              .eq('slug', actorSlug)
              .single();

          if (actorError || !actorData) { 
            console.error(actorError);
            setError('Actor not found.');
            setIsLoading(false); 
            return; 
          }
          setActor(actorData as Actor);
          setFollowerCount(actorData.actor_followers[0]?.count || 0);
          setTotalLikes(actorData.demo_likes[0]?.count || 0);
          await loadMarketplaceAllowedServiceIds();

                    const approvedServices = (actorData.actor_services || []).filter(
                        (service: { enabled: boolean; status?: string }) => service.enabled && service.status === 'approved'
                    );
                    const publicActorData = { ...actorData, actor_services: approvedServices };

                    const services = getMarketplaceServiceDefinitions(publicActorData)
            .filter((service) => service.enabled)
            .map((service) => ({
              id: service.id,
              title: service.label,
              icon: getServiceIcon(service.id),
              description: service.id === 'voice_over'
                ? 'Professional voice overs.'
                : service.id === 'scriptwriting'
                  ? actorData.service_script_description || 'Professional script writing.'
                  : service.id === 'video_editing'
                    ? actorData.service_video_description || 'Professional video editing.'
                    : actorData.actor_services?.find((item: any) => item.service_id === service.id)?.description || service.description,
              rate: service.id === 'voice_over'
                ? `From ${actorData.BaseRate_per_Word} MAD/word`
                : service.id === 'scriptwriting'
                  ? actorData.service_script_rate > 0 ? `From ${actorData.service_script_rate} MAD/word` : 'Quote-based'
                  : service.id === 'video_editing'
                    ? actorData.service_video_rate > 0 ? `From ${actorData.service_video_rate} MAD/min` : 'Quote-based'
                    : actorData.actor_services?.find((item: any) => item.service_id === service.id)?.rate ? `From ${actorData.actor_services.find((item: any) => item.service_id === service.id).rate} MAD` : service.pricingHint || 'Request a quote',
            }));

          setAvailableServices(services);

          // 2. Fetch Reviews
          setIsLoadingReviews(true);
          try {
              const { data: reviewsData, error: reviewsError } = await supabase
                  .from('reviews')
                  .select('id, rating, comment, created_at')
                  .eq('actor_id', actorData.id)
                  .order('created_at', { ascending: false });

              if (reviewsError) throw reviewsError;
              if (reviewsData) {
                  setReviews(reviewsData as ActorReview[]);
                  if (reviewsData.length > 0) {
                      const totalRating = reviewsData.reduce((sum, review) => sum + review.rating, 0);
                      setAverageRating(parseFloat((totalRating / reviewsData.length).toFixed(1)));
                  } else {
                      setAverageRating(null);
                  }
              }
          } catch (e) { console.error("Exception fetching reviews:", e); }
          finally { setIsLoadingReviews(false); }

          // 3. Fetch all demo types
          try {
            // Audio Demos
            const { data: demosData } = await supabase.from('demos').select('*').eq('actor_id', actorData.id);
            // Script Demos
            const { data: scriptsData } = await supabase.from('script_demos').select('*').eq('actor_id', actorData.id).order('created_at', { ascending: false });
            // Video Demos
            const { data: videosData } = await supabase.from('video_demos').select('*').eq('actor_id', actorData.id).order('created_at', { ascending: false });
            
            setScriptDemos(scriptsData || []);
            setVideoDemos(videosData || []);

            // --- (Audio demo like/follow logic - unchanged) ---
            const otherDemoUrls = (demosData || []).map(d => d.demo_url);
            const demoUrls = [actorData.MainDemoURL, ...otherDemoUrls].filter(Boolean);
            let likesByURL: { [url: string]: number } = {};
            if (demoUrls.length > 0) {
                const { data: allLikesData } = await supabase.from('demo_likes').select('demo_url').in('demo_url', demoUrls);
                likesByURL = (allLikesData || []).reduce((acc, like) => {
                    acc[like.demo_url] = (acc[like.demo_url] || 0) + 1;
                    return acc;
                }, {} as { [url: string]: number });
            }
            let userLikesData: string[] = [];
            const { data: { user } } = await supabase.auth.getUser();
            if (user && demoUrls.length > 0) {
                const { data: userLikesResult } = await supabase.from('demo_likes').select('demo_url').eq('user_id', user.id).in('demo_url', demoUrls);
                if (userLikesResult) userLikesData = userLikesResult.map(l => l.demo_url);
                const { data: followData } = await supabase.from('actor_followers').select().eq('actor_id', actorData.id).eq('user_id', user.id);
                if (followData && followData.length > 0) setIsFollowing(true);
            }
            setUserLikes(userLikesData);
            const mainDemoTrack = {
                id: 'main_demo', title: 'Main Demo Reel', demo_url: actorData.MainDemoURL, language: actorData.Language, style_tag: 'General', likes: likesByURL[actorData.MainDemoURL] || 0
            };
            const otherDemos = (demosData || []).map(d => ({ ...d, likes: likesByURL[d.demo_url] || 0 }));
            setDemos([mainDemoTrack, ...otherDemos].filter(d => d.demo_url));
            // --- (End audio logic) ---
            
          } catch(err) {
            console.error("Error fetching demos:", err);
            setError("Could not load actor's portfolio.");
          }
          
          setIsLoading(false);
      };
      getActorData();
    }, [actorSlug]);


    // --- NEW: Functions to handle like/follow actions ---
    const handleToggleFollow = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !actor) return; // Must be logged in

        if (isFollowing) {
            await supabase.from('actor_followers').delete().match({ user_id: user.id, actor_id: actor.id });
            setFollowerCount(prev => prev - 1);
        } else {
            await supabase.from('actor_followers').insert({ user_id: user.id, actor_id: actor.id });
            setFollowerCount(prev => prev + 1);
        }
        setIsFollowing(!isFollowing);
    };

    const handleToggleLike = async (demo: Demo) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !actor) return; // Must be logged in

        const isCurrentlyLiked = userLikes.includes(demo.demo_url);
        
        if (isCurrentlyLiked) {
            await supabase.from('demo_likes').delete().match({ user_id: user.id, demo_url: demo.demo_url });
            setUserLikes(prev => prev.filter(url => url !== demo.demo_url));
            setDemos(prev => prev.map(d => d.demo_url === demo.demo_url ? { ...d, likes: (d.likes || 1) - 1 } : d));
            setTotalLikes(prev => prev - 1);
        } else {
            await supabase.from('demo_likes').insert({ user_id: user.id, actor_id: actor.id, demo_url: demo.demo_url });
            setUserLikes(prev => [...prev, demo.demo_url]);
            setDemos(prev => prev.map(d => d.demo_url === demo.demo_url ? { ...d, likes: (d.likes || 0) + 1 } : d));
            setTotalLikes(prev => prev + 1);
        }
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);
        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', handleEnded);
        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [currentTrack]);

    // Audio player logic (no changes needed)
    useEffect(() => {
        if (isPlaying) audioRef.current?.play().catch(console.error);
        else audioRef.current?.pause();
    }, [isPlaying, currentTrack]);



    const handlePlayPause = (demo?: Demo) => {
        const targetDemo = demo || demos[0];
        if (!targetDemo || !actor) return;
        
        const newTrack = {
            url: targetDemo.demo_url,
            actor: {
                ActorName: actor.ActorName,
                HeadshotURL: actor.HeadshotURL
            }
        };
        
        if (currentTrack?.url === newTrack.url) {
            setIsPlaying(!isPlaying);
        } else {
            setCurrentTrack(newTrack);
            setIsPlaying(true);
        }
    };

    

    // --- NEW: Robust Share Function ---
    const handleShare = async () => {
        const shareData = {
            title: `Voice Actor: ${actor?.ActorName}`,
            text: `Check out the voice actor profile for ${actor?.ActorName}!`,
            url: window.location.href,
        };

        // Use the modern Web Share API if available
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.error("Share failed:", err);
            }
        } else {
            // Fallback for desktop browsers: copy to clipboard
            try {
                await navigator.clipboard.writeText(window.location.href);
                alert('Profile link copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy:', err);
                alert('Failed to copy link.');
            }
        }
    };

    // Audio Demo Player (Your existing list)
    const AudioDemoList = () => (
      <div className="flex flex-col">
        {demos.length > 0 ? demos.map((demo, index) => (
            <div key={demo.id} className="group grid grid-cols-[40px_1fr_auto_auto] items-center gap-4 p-2 rounded-lg hover:bg-card/50">
                <div onClick={() => handlePlayPause(demo)} className="flex items-center justify-center text-muted-foreground cursor-pointer">
                    {currentTrack?.url === demo.demo_url && isPlaying ? (
                        <Pause size={16} className="text-primary" />
                    ) : (
                        <>
                            <span className="group-hover:hidden">{index + 1}</span>
                            <Play size={16} className="text-foreground hidden group-hover:block" />
                        </>
                    )}
                </div>
                <div onClick={() => handlePlayPause(demo)} className="cursor-pointer">
                    <p className={`font-semibold truncate ${currentTrack?.url === demo.demo_url ? 'text-primary' : 'text-foreground'}`}>{demo.title}</p>
                    <p className="text-sm text-muted-foreground">{demo.language} | {demo.style_tag}</p>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <button onClick={() => handleToggleLike(demo)}>
                        <Heart size={16} className={`transition-colors ${userLikes.includes(demo.demo_url) ? 'text-pink-500 fill-current' : 'text-slate-500 group-hover:text-accent-foreground'}`} />
                    </button>
                    <span className="text-sm w-8">{demo.likes}</span>
                </div>
            </div>
        )) : <p className="text-muted-foreground text-center py-8">No audio demos found.</p>}
      </div>
    );

    // Script Demo "Quote Style"
    const ScriptDemoList = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {scriptDemos.length > 0 ? scriptDemos.map(demo => (
          <Card key={demo.id} className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText size={18} className="text-primary" />
                {demo.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground">
                {demo.content}
              </blockquote>
            </CardContent>
          </Card>
        )) : <p className="text-muted-foreground text-center py-8 md:col-span-2">No script demos found.</p>}
      </div>
    );

    // Video Demo Player
    const VideoDemoList = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videoDemos.length > 0 ? videoDemos.map(demo => (
          <Card key={demo.id} className="bg-card overflow-hidden">
            <CardContent className="p-0">
              <video controls src={demo.video_url} className="w-full aspect-video" />
            </CardContent>
            <CardHeader>
              <CardTitle>{demo.title}</CardTitle>
            </CardHeader>
          </Card>
        )) : <p className="text-muted-foreground text-center py-8 md:col-span-2 lg:col-span-3">No video demos found.</p>}
      </div>
    );

    // --- ADD THIS FUNCTION ---
const handleMessageActor = async () => {
    setIsStartingChat(true);

    // 1. Get the logged-in client (User A)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        // Not logged in! Redirect to login.
        // This is your feature: "must have an account"
        navigate('/client-auth');
        return;
    }

    // 2. Get the client's profile_id
    const { data: clientProfile } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

    if (!clientProfile) {
        console.error("Client profile not found.");
        // You should show a toast/alert here
        setIsStartingChat(false);
        return;
    }

    // 3. Get the actor's IDs (User B) from the profile you already fetched
    const actorUserId = actor.user_id; // The auth.users(id)
    const actorProfileId = actor.id;    // The actors(id)

    // 4. Call the database function you created in Step 2
    const { data: conversationId, error } = await supabase.rpc(
        'get_or_create_conversation', {
            actor_user_id_input: actorUserId,
            client_user_id_input: user.id
        }
    );

    setIsStartingChat(false);

    if (error) {
        console.error("Error starting conversation:", error);
    } else {
        // 5. Success! Redirect to the new messages page
        navigate(`/messages/${conversationId}`);
    }
};
    
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
                <p>Loading...</p>
            </div>
        );
    }

    if (error || !actor) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
                <p>{error || 'Actor not found.'}</p>
            </div>
        );
    }

    // --- Helper to render stars ---
    const renderStars = (rating: number, size = 16) => {
        return (
            <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        size={size}
                        className={` ${
                            star <= rating ? 'text-yellow-400 fill-current' : 'text-slate-600'
                        }`}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-background text-foreground ">
            <audio ref={audioRef} src={currentTrack?.url || ''} />
            
            <header className="relative flex items-end border-b border-border bg-muted/30 pt-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-8" >
                    <div className="flex flex-row items-center gap-4 md:gap-8 z-10 w-full">
                        <img 
                            src={actor.HeadshotURL} 
                            alt={actor.ActorName} 
                            className="w-28 h-28 md:w-52 md:h-52 rounded-2xl object-cover flex-shrink-0 shadow-xl shadow-black/10"
                        />
                        <div className="text-left flex-grow">
                            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight text-foreground break-words">{actor.ActorName}</h1>
                            <div className="flex flex-wrap items-center justify-start gap-x-3 gap-y-1 text-foreground text-sm md:text-base mt-1 md:mt-2">                                
                                <span className='flex items-center gap-1'><MapPin className='h-4 w-4' />{actor.Language} | {actor.Gender}</span>
                                <span className="mx-1">&middot;</span>
                                <span>{followerCount} Followers</span>
                                <span className="mx-1">&middot;</span>
                                <span>{totalLikes.toLocaleString()} Likes</span>
                                {averageRating !== null && (
                                    <>
                                        <span className="mx-1">&middot;</span>
                                        <span className="flex items-center gap-1">
                                           {renderStars(averageRating, 14)} ({averageRating})
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {/* --- Action Buttons (Unchanged) --- */}
              <div className="flex items-center gap-4 sm:gap-6 mb-12 flex-wrap">
                    {/* Replace the <Button> with this <div> block */}
                <div 
                onClick={() => handlePlayPause()} 
                className="w-14 h-14 rounded-full  flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity shadow-lg"
                role="button"
                tabIndex={0}
                                aria-label={isPlaying ? "Pause demo" : "Play demo"}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        handlePlayPause();
                                    }
                                }}
                >
                    {isPlaying ? (
                    <Pause size={28} className="text-primary-foreground" fill="foreground" />
                    ) : (
                    <Play size={28} className="ml-1 text-primary-foreground" fill="foreground" />
                    )}
                </div>    
                   
                  <Button onClick={() => { setQuoteServiceId(null); setIsQuoteModalOpen(true); }} size="lg" variant="outline" className="rounded-full">
                      Get a Quote
                  </Button>
                  <Button onClick={handleShare} size="lg" variant="outline" className="rounded-full">
                      <Share2 size={18} aria-hidden="true" />
                      <span className="sr-only">Share profile</span>
                  </Button>
                  <Button onClick={handleToggleFollow} size="lg" variant={isFollowing ? 'default' : 'outline'} className="rounded-full">
                      {isFollowing ? 'Following' : 'Follow'}
                  </Button>
                  <Button 
                    onClick={handleMessageActor}
                    disabled={isStartingChat}
                    variant="outline"
                >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {isStartingChat ? "Starting..." : "Message Actor"}
                </Button>
              </div>

              {/* --- Bio Section (Unchanged) --- */}
              {actor?.bio && (
                  <div className="mb-12">
                      <h2 className="text-2xl font-bold mb-4">About</h2>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap max-w-3xl">
                          {actor?.bio}
                      </p>
                  </div>
              )}

                            <section className='mb-14'>
                                <div className='mb-5 flex items-end justify-between gap-4'>
                                    <div>
                                        <p className='text-sm font-semibold uppercase tracking-[0.18em] text-primary'>Services</p>
                                        <h2 className='text-3xl font-bold'>What I can help with</h2>
                                    </div>
                                    <span className='text-sm text-muted-foreground'>{availableServices.length} active offers</span>
                                </div>
                                <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
                                    {availableServices.map((service) => {
                                        const Icon = service.icon;
                                        return (
                                            <Card key={service.id} className='group border-border transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg'>
                                                <CardHeader>
                                                    <div className='flex items-start justify-between gap-3'>
                                                        <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary'><Icon className='h-5 w-5' /></div>
                                                        <span className='text-sm font-semibold text-primary'>{service.rate}</span>
                                                    </div>
                                                    <CardTitle className='pt-2'>{service.title}</CardTitle>
                                                    <CardDescription>{service.description}</CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                    <Button onClick={() => { setQuoteServiceId(service.id); setIsQuoteModalOpen(true); }} variant='outline' className='w-full justify-between'>Request this service <ArrowUpRight className='h-4 w-4' /></Button>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </section>

              {/* --- 6. NEW: Dynamic Portfolio Section --- */}
              <div className="mb-12">
                {/* Check if we should show tabs (more than one service) */}
                {availableServices.length > 1 ? (
                  <Tabs defaultValue={availableServices[0]?.id} className="w-full">
                    
                    <TabsList className="grid w-full grid-cols-3 mb-6 h-auto">
                      {availableServices.map(service => (
                        <TabsTrigger key={service.id} value={service.id} className="h-auto p-4 flex flex-col gap-2">
                          <service.icon className="h-6 w-6" />
                          <span className="font-semibold text-base">{service.title}</span>
                          <span className="font-normal text-xs text-muted-foreground">{service.rate}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    
                    {availableServices.some(s => s.id === 'voice_over') && (
                        <TabsContent value="voice_over"><AudioDemoList /></TabsContent>
                    )}
                    {availableServices.some(s => s.id === 'scriptwriting') && (
                      <TabsContent value="scriptwriting"><ScriptDemoList /></TabsContent>
                    )}
                    {availableServices.some(s => s.id === 'video_editing') && (
                      <TabsContent value="video_editing"><VideoDemoList /></TabsContent>
                    )}
                  </Tabs>
                ) : (
                  // If only ONE service is available, show it directly
                  <>
                    {availableServices[0]?.id === 'voice_over' && (
                        <>
                          <h2 className="text-2xl font-bold mb-4">Demos</h2>
                          <AudioDemoList />
                        </>
                    )}
                    {availableServices[0]?.id === 'scriptwriting' && (
                        <>
                          <h2 className="text-2xl font-bold mb-4">Scripts</h2>
                          <ScriptDemoList />
                        </>
                    )}
                    {availableServices[0]?.id === 'video_editing' && (
                        <>
                          <h2 className="text-2xl font-bold mb-4">Videos</h2>
                          <VideoDemoList />
                        </>
                    )}
                  </>
                )}
              </div>
              {/* --- End Dynamic Portfolio --- */}

              {/* --- Reviews Section (Unchanged) --- */}
               <div className="mt-12 pt-8 border-t border-border">
                   <h2 className="text-2xl font-bold mb-6">Reviews ({reviews.length})</h2>
                   {isLoadingReviews ? (
                      <p className="text-muted-foreground">Loading reviews...</p>
                   ) : reviews.length > 0 ? (
                       <div className="space-y-6 max-w-3xl">
                           {reviews.map((review) => (
                               <div key={review.id} className="pb-4 border-b border-border last:border-b-0">
                                   <div className="flex items-center justify-between mb-2">
                                       {renderStars(review.rating)}
                                       <span className="text-xs text-muted-foreground">
                                           {new Date(review.created_at).toLocaleDateString()}
                                       </span>
                                   </div>
                                   {review.comment && (
                                       <p className="text-foreground bg-muted p-3 rounded text-sm italic">
                                           "{review.comment}"
                                       </p>
                                   )}
                               </div>
                           ))}
                       </div>
                   ) : (
                       <p className="text-muted-foreground">No reviews yet for this actor.</p>
                   )}
               </div>
            </main>
            {actor.actor_services?.some((service) => service.service_id === 'voice_over' && service.enabled && service.status === 'approved') && (
            <GlobalAudioPlayer
                audioRef={audioRef}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlayPause={() => handlePlayPause()}
                duration={duration}
                currentTime={currentTime}
            />
            )}
            {isQuoteModalOpen && actor && ( <QuoteCalculatorModal actor={actor} initialService={quoteServiceId} onClose={() => setIsQuoteModalOpen(false)} /> )}
        </div>
    );
};

export default ActorProfilePage;