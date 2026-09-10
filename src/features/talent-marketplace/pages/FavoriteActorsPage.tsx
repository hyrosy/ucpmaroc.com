// In src/features/talent-marketplace/pages/FavoriteActorsPage.tsx

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Star } from 'lucide-react';
import ActorCard, { Actor } from '../components/ActorCard'; // Import ActorCard and its interface
import GlobalAudioPlayer from '@/components/GlobalAudioPlayer';

// Define the shape of the track for the audio player
interface CurrentTrack {
  url: string;
  actor: {
    ActorName: string;
    HeadshotURL: string;
  }
}

// Define the shape of the data we fetch
interface FollowedActor {
  actors: Actor; // The query will return a nested actor object
}

const FavoriteActorsPage = () => {
    const [loading, setLoading] = useState(true);
    const [favoriteActors, setFavoriteActors] = useState<Actor[]>([]);
    const navigate = useNavigate();

    // --- Global Audio Player State ---
    const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const fetchFavoriteActors = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/client-auth'); // Redirect if not logged in
                return;
            }

            // Fetch all `actor_followers` rows for this user,
            // and join to get the full actor details for each.
            const { data, error } = await supabase
                .from('actor_followers')
                .select(`
                    actors (
                        id,
                        slug,
                        ActorName,
                        Gender,
                        Language,
                        HeadshotURL,
                        MainDemoURL,
                        revisions_allowed,
                        BaseRate_per_Word,
                        IsActive,
                        actor_followers(count),
                        demo_likes(count)
                    )
                `)
                .eq('user_id', user.id);
            
            if (error) {
                console.error("Error fetching favorite actors:", error);
            } else {
                // The data is an array of { actors: {...} }, so we map it.
                // We also filter out any potential null actor data.
            const actorsList = data.map(item => item.actors as unknown as Actor).filter(Boolean);                setFavoriteActors(actorsList as Actor[]);
            }
            setLoading(false);
        };
        fetchFavoriteActors();
    }, [navigate]);

    // --- Audio Player Logic ---
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

    useEffect(() => {
        if (isPlaying) {
            audioRef.current?.play().catch(console.error);
        } else {
            audioRef.current?.pause();
        }
    }, [isPlaying, currentTrack]);

    const handlePlayPause = () => {
        if (currentTrack) {
            setIsPlaying(!isPlaying);
        }
    };

    const handleSelectTrack = (actor: Actor) => {
        const newTrackUrl = actor.MainDemoURL;
        if (!newTrackUrl) return;

        if (currentTrack?.url === newTrackUrl) {
            handlePlayPause();
        } else {
            setCurrentTrack({ 
                url: newTrackUrl, 
                actor: { ActorName: actor.ActorName, HeadshotURL: actor.HeadshotURL } 
            });
            setIsPlaying(true);
        }
    };
    // --- End Audio Player Logic ---

    if (loading) {
        return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Loading Your Favorite Actors...</div>;
    }

    return (
        <div className="min-h-screen bg-background text-foreground pt-20">
            <div className="max-w-7xl mx-auto py-20 px-4">
                <div className="text-center mb-12">
                    <div className="inline-block bg-card/50 rounded-full p-5 border border mb-6">
                        <Star size={40} className="text-yellow-400" />
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black tracking-tighter text-foreground mb-4">
                        My Favorite Actors
                    </h1>
                    <p className="text-lg text-muted-foreground">All the talent you follow, saved in one place.</p>
                </div>
                
                {favoriteActors.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {favoriteActors.map(actor => (
                            <ActorCard
                                key={actor.id}
                                actor={actor}
                                onPlayClick={handleSelectTrack}
                                isCurrentlyPlaying={isPlaying && currentTrack?.url === actor.MainDemoURL}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-slate-500 mb-4">You haven't followed any actors yet.</p>
                        <Link to="/" className="text-purple-400 font-semibold hover:underline">
                            Browse Talent
                        </Link>
                    </div>
                )}
            </div>
            
            {/* Audio Player */}
            <div role="region" aria-label="Audio player for favorite actors">
                <GlobalAudioPlayer
                    audioRef={audioRef}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    duration={duration}
                    currentTime={currentTime}
                />
            </div>
            {/* Hidden audio element */}
            <audio aria-label={currentTrack ? `Demo by ${currentTrack.name}` : "Favorite actor demo player"} ref={audioRef} src={currentTrack?.url || ''} />
        </div>
    );
};

export default FavoriteActorsPage;