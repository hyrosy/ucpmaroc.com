import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { OrderDetailsModal, RecordingModal } from '@/features/talent-marketplace';

// --- shadcn/ui Imports ---
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// ---

// --- Icon Imports ---
import { 
  Music, Trash2, UploadCloud, User, DollarSign, Settings, Banknote, CheckCircle, 
  AudioLines, Plus, Play, Brain, RefreshCw, ListOrdered, Clock, 
  Mic, PencilLine, Video, Save
} from 'lucide-react';
import emailjs from '@emailjs/browser';
import PlatformLoader from '@/components/PlatformLoader';

// --- Interfaces (with new service fields) ---
interface Demo {
  id: string;
  title: string;
  language: string;
  style_tag: string;
  demo_url: string;
}

interface Actor {
  id: string;
  ActorName: string;
  bio: string;
  Gender: string;
  slug: string;
  Language: string;
  Tags: string;
  BaseRate_per_Word: number;
  revisions_allowed: number;
  WebMultiplier: number;
  BroadcastMultiplier: number;
  HeadshotURL?: string;
  MainDemoURL?: string;
  bank_name?: string | null;
  bank_holder_name?: string | null;
  bank_iban?: string | null;
  bank_account_number?: string | null;
  direct_payment_enabled?: boolean;
  direct_payment_requested?: boolean;
  service_scriptwriting: boolean;
  service_videoediting: boolean;
}

interface Order {
  actor_id: any;
  id: string;
  order_id_string: string;
  client_name: string;
  client_email: string;
  status: string;
  script: string;
  final_audio_url?: string;
  actors: {
    ActorName: string;
    ActorEmail?: string;
  };
  deliveries: { id: string; created_at: string; file_url: string; version_number: number }[];
  service_type: string;

}

interface ActorRecording {
  id: string;
  actor_id: string;
  name: string;
  raw_audio_url: string;
  cleaned_audio_url: string | null;
  status: 'raw' | 'cleaning' | 'cleaned' | 'error';
  created_at: string;
}

// --- Hardcoded Options ---
const genderOptions = ["Male", "Female"];
const languageOptions = ["Arabic", "English", "French", "Spanish"];
const tagOptions = ["Warm", "Deep", "Conversational", "Corporate"];

const ActorDashboardPage = () => {
  // --- State ---
  const [loading, setLoading] = useState(true);
  const [actorData, setActorData] = useState<Partial<Actor>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const navigate = useNavigate();
  const [activeOrderTab, setActiveOrderTab] = useState<'active' | 'completed'>('active');
  const [demos, setDemos] = useState<Demo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [newDemo, setNewDemo] = useState({ title: '', language: '', style_tag: '' });
  const [demoFile, setDemoFile] = useState<File | null>(null);
  const [uploadingMainDemo, setUploadingMainDemo] = useState(false);
  const [demoMessage, setDemoMessage] = useState('');
  const [completedOrderCount, setCompletedOrderCount] = useState<number>(0);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState<boolean>(true);
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [recordings, setRecordings] = useState<ActorRecording[]>([]);
  const [isSavingRecording, setIsSavingRecording] = useState(false);
  const [cleaningId, setCleaningId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<Map<string, number>>(new Map());
  const [activeLibraryTab, setActiveLibraryTab] = useState<'recordings' | 'upload'>('recordings');
  const [isDeletingRecording, setIsDeletingRecording] = useState<string | null>(null);
  const [uploadingRecordingFile, setUploadingRecordingFile] = useState<File | null>(null);
  const [uploadingRecordingName, setUploadingRecordingName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // --- fetchData (Selects new service fields) ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    setEligibilityLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/actor-login');
      return;
    }

    const { data: actorProfile, error: actorError } = await supabase
      .from('actors')
      .select('*') // Selects all columns, including new service_... ones
      .eq('user_id', user.id)
      .single();
    
    if (actorError || !actorProfile) {
      console.warn('No actor profile found, redirecting to create one.');
      navigate('/create-profile', { state: { roleToCreate: 'actor' } });
      return;
    }
    setActorData(actorProfile);

    const { data: orderData } = await supabase
      .from('orders')
      .select('*, actors(ActorName, ActorEmail)')
      .eq('actor_id', actorProfile.id)
      .order('created_at', { ascending: false });
    if (orderData) setOrders(orderData as Order[]);
    
    const { data: demosData } = await supabase.from('demos').select('*').eq('actor_id', actorProfile.id).order('created_at', { ascending: false });
    if(demosData) setDemos(demosData);

    try {
      const { count: orderCount } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('actor_id', actorProfile.id).eq('status', 'Completed');
      setCompletedOrderCount(orderCount ?? 0);
      const { data: reviewsData } = await supabase.from('reviews').select('rating').eq('actor_id', actorProfile.id);
      if (reviewsData && reviewsData.length > 0) {
        const totalRating = reviewsData.reduce((sum, review) => sum + review.rating, 0);
        setAverageRating(parseFloat((totalRating / reviewsData.length).toFixed(1)));
      } else {
        setAverageRating(null);
      }
    } catch (error) {
      console.error("Error fetching eligibility data:", error);
      setMessage("Could not load eligibility data.");
    } finally {
      setEligibilityLoading(false);
    }

    const { data: recordingsData } = await supabase.from('actor_recordings').select('*').eq('actor_id', actorProfile.id).order('created_at', { ascending: false });
    if(recordingsData) setRecordings(recordingsData as ActorRecording[]);

    setLoading(false);
  }, [navigate]);

  // --- useEffects (For data fetching, real-time, and polling) ---
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!actorData.id) return;
    const channel = supabase.channel(`actor-recordings-${actorData.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'actor_recordings', filter: `actor_id=eq.${actorData.id}` },
        (payload) => {
          const updatedRecording = payload.new as ActorRecording;
          setRecordings(prev => prev.map(r => r.id === updatedRecording.id ? updatedRecording : r));
          if (updatedRecording.id === cleaningId && (updatedRecording.status === 'cleaned' || updatedRecording.status === 'error')) {
            setCleaningId(null);
            if(updatedRecording.status === 'cleaned') {
              setMessage(`Recording "${updatedRecording.name}" is clean!`);
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [actorData.id, cleaningId]); // Added cleaningId dependency

  useEffect(() => {
    const intervalMap = pollingIntervalRef.current;
    return () => {
      intervalMap.forEach(intervalId => clearInterval(intervalId));
    };
  }, []);

  useEffect(() => {
    if (cleaningId) {
      const poll = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('poll-audo-status', { body: { recordingId: cleaningId } });
          if (error) throw error;
          const audoStatus = data.status;
          if (audoStatus === 'succeeded' || audoStatus === 'failed') {
            const intervalId = pollingIntervalRef.current.get(cleaningId);
            if (intervalId) {
              clearInterval(intervalId);
              pollingIntervalRef.current.delete(cleaningId);
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
          const intervalId = pollingIntervalRef.current.get(cleaningId);
          if (intervalId) {
            clearInterval(intervalId);
            pollingIntervalRef.current.delete(cleaningId);
          }
        }
      };
      poll();
      const intervalId = setInterval(poll, 10000);
      pollingIntervalRef.current.set(cleaningId, intervalId as unknown as number);
    }
  }, [cleaningId]);

  // --- ALL HANDLER FUNCTIONS ---

  // --- NEW: Handle Service Toggle ---
  const handleServiceToggle = async (serviceName: 'service_scriptwriting' | 'service_videoediting', isEnabled: boolean) => {
    if (!actorData.id) return;

    // Optimistic UI update
    setActorData(prev => ({ ...prev, [serviceName]: isEnabled }));
    
    // Update database
    const { error } = await supabase
      .from('actors')
      .update({ [serviceName]: isEnabled })
      .eq('id', actorData.id);
      
    if (error) {
      // Revert on error
      setActorData(prev => ({ ...prev, [serviceName]: !isEnabled }));
      setMessage(`Error updating service: ${error.message}`);
    } else {
      setMessage(`${serviceName.replace('service_', '')} ${isEnabled ? 'enabled' : 'disabled'}.`);
    }
  };

  // --- THIS FUNCTION WAS MISSING ---
  const handleRequestDirectPayment = async () => {
    setMessage('');
    if (!actorData.id) return;
    setMessage('Sending request...');
    try {
        const { error } = await supabase
            .from('actors')
            .update({ direct_payment_requested: true })
            .eq('id', actorData.id);
        if (error) throw error;
        setActorData(prev => ({ ...prev, direct_payment_requested: true }));
        setMessage('Request sent successfully! An admin will review it.');
    } catch (error) {
        const err = error as Error;
        console.error("Error requesting direct payment:", err);
        setMessage(`Failed to send request: ${err.message}`);
    }
  };

  // --- handleUpdate (Main profile save) ---
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Saving...');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const cleanedSlug = (actorData.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const updatePayload = {
      ActorName: actorData.ActorName,
      Gender: actorData.Gender,
      Language: actorData.Language,
      slug: cleanedSlug,
      Tags: actorData.Tags,
      BaseRate_per_Word: actorData.BaseRate_per_Word,
      WebMultiplier: actorData.WebMultiplier,
      BroadcastMultiplier: actorData.BroadcastMultiplier,
      revisions_allowed: actorData.revisions_allowed,
      bio: actorData.bio,
      bank_name: actorData.bank_name,
      bank_holder_name: actorData.bank_holder_name,
      bank_iban: actorData.bank_iban,
      bank_account_number: actorData.bank_account_number,
    };

    const { error } = await supabase
      .from('actors')
      .update(updatePayload)
      .eq('user_id', user.id);

    if (error) {
      if (error.message.includes('duplicate key value violates unique constraint "actors_slug_key"')) {
        setMessage('Error: This URL slug is already taken. Please choose another.');
      } else {
        setMessage(`Error: ${error.message}`);
      }
    } else {
      setActorData(prev => ({ ...prev, slug: cleanedSlug }));
      setMessage('Profile updated successfully!');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setActorData({ ...actorData, [name]: value });
  };
  
  // Handlers for shadcn Select components
  const handleSelectChange = (name: string, value: string) => {
    setActorData({ ...actorData, [name]: value });
  };

  const handleTagToggle = (tagToToggle: string) => {
    const currentTags = actorData.Tags ? actorData.Tags.split(',').map(t => t.trim()) : [];
    const newTags = currentTags.includes(tagToToggle)
      ? currentTags.filter(t => t !== tagToToggle)
      : [...currentTags, tagToToggle];
    setActorData({ ...actorData, Tags: newTags.join(', ') });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/actor-login');
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !actorData.id) return;
    try {
      setUploading(true);
      const filePath = actorData.id;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const newAvatarUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`; // Cache bust
      const { error: updateError } = await supabase.from('actors').update({ HeadshotURL: newAvatarUrl }).eq('id', actorData.id);
      if (updateError) throw updateError;
      setActorData(prev => ({ ...prev, HeadshotURL: newAvatarUrl }));
      setMessage("Profile picture updated!");
    } catch (error) {
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setUploading(false);
    }
  };
  
  const handleMainDemoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !actorData.id) return;
    try {
      setUploadingMainDemo(true);
      setMessage("Uploading main demo...");
      const fileExt = file.name.split('.').pop();
      const filePath = `${actorData.id}/main-demo.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('demos').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('demos').getPublicUrl(filePath);
      const newDemoUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
      const { error: updateError } = await supabase.from('actors').update({ MainDemoURL: newDemoUrl }).eq('id', actorData.id);
      if (updateError) throw updateError;
      setActorData(prev => ({ ...prev, MainDemoURL: newDemoUrl }));
      setMessage("Main demo updated successfully!");
    } catch (error) {
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setUploadingMainDemo(false);
    }
  };

  const handleDemoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewDemo({ ...newDemo, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setDemoFile(e.target.files[0]);
  };

  const handleDemoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoFile || !newDemo.title || !newDemo.language || !newDemo.style_tag || !actorData.id) {
      setDemoMessage("Please fill all demo fields and select a file.");
      return;
    }
    setUploading(true);
    setDemoMessage("Uploading demo...");
    try {
      const fileExt = demoFile.name.split('.').pop();
      const cleanFileName = `${Date.now()}.${fileExt}`;
      const filePath = `${actorData.id}/${cleanFileName}`;
      const { error: uploadError } = await supabase.storage.from('demos').upload(filePath, demoFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('demos').getPublicUrl(filePath);
      const { data: newDemoData, error: insertError } = await supabase.from('demos').insert({
        actor_id: actorData.id, demo_url: urlData.publicUrl, title: newDemo.title, language: newDemo.language, style_tag: newDemo.style_tag,
      }).select().single();
      if (insertError) throw insertError;
      setDemos(prev => [newDemoData as Demo, ...prev]);
      setNewDemo({ title: '', language: '', style_tag: '' });
      setDemoFile(null);
      (document.getElementById('demo-file-input') as HTMLInputElement).value = "";
      setDemoMessage("Demo uploaded successfully!");
    } catch (error) {
      setDemoMessage(`Error: ${(error as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDemoDelete = async (demoId: string, demoUrl: string) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      const filePath = new URL(demoUrl).pathname.split('/demos/')[1];
      const { error: storageError } = await supabase.storage.from('demos').remove([filePath]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from('demos').delete().eq('id', demoId);
      if (dbError) throw dbError;
      setDemos(prev => prev.filter(d => d.id !== demoId));
      setMessage("Demo deleted.");
    } catch (error) {
      setMessage(`Error: ${(error as Error).message}`);
    }
  };

  const handleDeleteRecording = async (recording: ActorRecording) => {
    if (!actorData.id) return;
    if (!window.confirm(`Are you sure you want to delete "${recording.name}"? This cannot be undone.`)) return;
    setIsDeletingRecording(recording.id);
    setMessage('');
    try {
      const { data: publicUrlData } = supabase.storage.from('recordings').getPublicUrl('');
      const baseUrl = publicUrlData?.publicUrl ? publicUrlData.publicUrl.replace(/\/$/, '') : null;
      const filesToDelete: string[] = [];
      if (recording.raw_audio_url) {
        try {
          const rawPath = new URL(recording.raw_audio_url).pathname.split('/recordings/')[1];
          if (rawPath) filesToDelete.push(rawPath);
        } catch (e) { console.error("Could not parse raw_audio_url:", e); }
      }
      if (recording.cleaned_audio_url && baseUrl) {
         try {
            if (recording.cleaned_audio_url.startsWith(baseUrl)) {
               const urlObject = new URL(recording.cleaned_audio_url);
               const pathParts = urlObject.pathname.split('/'); 
               const bucketIndex = pathParts.findIndex(part => part === 'recordings'); 
               if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
                   const cleanedPath = pathParts.slice(bucketIndex + 1).join('/');
                   filesToDelete.push(cleanedPath);
               }
            }
         } catch (e) { console.error("Could not parse cleaned_audio_url:", e); }
      }
      if (filesToDelete.length > 0) {
        const { error: storageError } = await supabase.storage.from('recordings').remove(filesToDelete);
        if (storageError) console.error("Error deleting storage files:", storageError);
      }
      const { error: dbError } = await supabase.from('actor_recordings').delete().eq('id', recording.id).eq('actor_id', actorData.id);
      if (dbError) throw dbError;
      setRecordings(prev => prev.filter(r => r.id !== recording.id));
      setMessage(`Recording "${recording.name}" deleted successfully.`);
    } catch (error) {
      setMessage(`Error deleting recording: ${(error as Error).message}`);
    } finally {
      setIsDeletingRecording(null);
    }
  };

  const handleUploadRecording = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadingRecordingFile || !uploadingRecordingName.trim() || !actorData.id) {
        setMessage("Please select an audio file and provide a name.");
        return;
    }
    setIsUploading(true);
    setMessage('');
    try {
        const fileExt = uploadingRecordingFile.name.split('.').pop() || 'tmp';
        const filePath = `${actorData.id}/${uploadingRecordingName.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('recordings').upload(filePath, uploadingRecordingFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('recordings').getPublicUrl(filePath);
        if (!urlData) throw new Error("Could not get public URL for uploaded recording.");
        const { data: newRecording, error: insertError } = await supabase.from('actor_recordings').insert({
            actor_id: actorData.id, name: uploadingRecordingName.trim(), raw_audio_url: urlData.publicUrl, status: 'raw'
        }).select().single();
        if (insertError) throw insertError;
        setRecordings(prev => [newRecording as ActorRecording, ...prev]);
        setMessage(`Recording "${uploadingRecordingName.trim()}" uploaded successfully!`);
        setUploadingRecordingFile(null);
        setUploadingRecordingName('');
        setActiveLibraryTab('recordings');
        const fileInput = document.getElementById('recording-file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = "";
    } catch (error) {
        setMessage(`Error uploading recording: ${(error as Error).message}`);
    } finally {
        setIsUploading(false);
    }
  };

  const handleUploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setUploadingRecordingFile(e.target.files[0]);
        if (!uploadingRecordingName) {
           setUploadingRecordingName(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
        }
    } else {
        setUploadingRecordingFile(null);
    }
  };
  
  const handleSaveRecording = async (audioFile: File, recordingName: string) => {
    if (!actorData.id) return;
    setIsSavingRecording(true);
    setMessage('');
    try {
        const fileExt = audioFile.name.split('.').pop() || 'webm';
        const filePath = `${actorData.id}/${recordingName.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('recordings').upload(filePath, audioFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('recordings').getPublicUrl(filePath);
        const { data: newRecording, error: insertError } = await supabase.from('actor_recordings').insert({
            actor_id: actorData.id, name: recordingName, raw_audio_url: urlData.publicUrl, status: 'raw'
        }).select().single();
        if (insertError) throw insertError;
        setRecordings(prev => [newRecording as ActorRecording, ...prev]);
        setMessage('Recording saved to library!');
        setIsRecordingModalOpen(false);
    } catch (error) {
        setMessage(`Error: ${(error as Error).message}`);
    } finally {
        setIsSavingRecording(false);
    }
  };
  
  // --- CORRECTED handleCleanAudio ---
  const handleCleanAudio = async (recordingId: string) => {
    setMessage('');
    try {
        setRecordings(prev => prev.map(r => r.id === recordingId ? { ...r, status: 'cleaning' } : r));
        
        const { data: responseData, error: functionError } = await supabase.functions.invoke('clean-audio', { body: { recordingId } });

        if (functionError) throw functionError; 
        if (responseData.error) throw new Error(responseData.error); 
        if (!responseData.jobId) throw new Error("Function did not return a jobId.");

        setMessage('Cleaning job started! This may take a few minutes...');
        
        // Set cleaningId AFTER getting jobId to prevent race condition
        setCleaningId(recordingId); 

    } catch (error) {
        setMessage(`Error: ${(error as Error).message}`);
        setRecordings(prev => prev.map(r => r.id === recordingId ? { ...r, status: 'error' } : r));
        setCleaningId(null); 
    }
  };
  
  const handleActorConfirmPayment = async (orderId: string, clientEmail: string, clientName: string, orderIdString: string) => {
    setMessage('');
    try {
        const { error: updateError } = await supabase.from('orders').update({ status: 'In Progress' }).eq('id', orderId).eq('status', 'Awaiting Actor Confirmation');
        if (updateError) throw updateError;
        setMessage('Payment confirmed! The order is now In Progress.');
        fetchData();
        setSelectedOrder(null);
        const emailParams = { clientName, clientEmail, orderIdString, actorName: actorData.ActorName };
        // Create this template in EmailJS
        emailjs.send('service_r3pvt1s', 'YOUR_CLIENT_WORK_STARTED_TEMPLATE_ID', emailParams, 'I51tDIHsXYKncMQpO')
          .catch(err => console.error("Failed to send 'work started' email:", err));
    } catch (error) {
        setMessage(`Error confirming payment: ${(error as Error).message}`);
        throw error; // Re-throw to keep modal's loading state
    }
  };

  // --- Loading State ---
  if (loading && !selectedOrder) {
    return <PlatformLoader message="Loading Dashboard..." />;
  }

  // --- Filtered Orders ---
  const filteredOrders = orders.filter(order => {
    if (activeOrderTab === 'active') {
      return order.status !== 'Completed' && order.status !== 'Cancelled';
    }
    return order.status === 'Completed';
  });

  // --- Main JSX (Fully Refactored with shadcn/ui) ---
  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Your Dashboard</h1>
          <Button variant="destructive" onClick={handleLogout}>Log Out</Button>
        </div>

        {/* Global Message */}
        {message && <div className="mb-4 p-3 bg-card border rounded-lg text-center text-sm">{message}</div>}

        <Accordion type="multiple" defaultValue={['profile']} className="w-full space-y-6">
          
          {/* --- 1. Manage Profile --- */}
          <AccordionItem value="profile">
            <AccordionTrigger className="text-2xl font-bold flex items-center gap-3">
              <Settings size={20}/> Manage Your Profile
            </AccordionTrigger>
            <AccordionContent className="p-0 pt-4">
              <form onSubmit={handleUpdate}>
                <Card className="border-0 shadow-none">
                  <CardContent className="space-y-6">
                    {/* Avatar Upload */}
                    <div className="flex flex-col items-center gap-4 pt-6 pb-6">
                      <Avatar className="w-32 h-32 border-4 border-muted">
                        <AvatarImage src={actorData.HeadshotURL || 'https://via.placeholder.com/150'} alt={actorData.ActorName} />
                        <AvatarFallback>{actorData.ActorName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <Label htmlFor="avatar-upload" className="cursor-pointer">
                        <Button type="button" variant="outline" asChild>
                          <span>{uploading ? 'Uploading...' : 'Change Picture'}</span>
                        </Button>
                      </Label>
                      <Input type="file" id="avatar-upload" className="hidden" accept="image/png, image/jpeg" onChange={handleAvatarUpload} disabled={uploading}/>
                    </div>

                    {/* Profile Tabs */}
                    <Tabs defaultValue="info">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="info">Basic Info</TabsTrigger>
                        <TabsTrigger value="rates">Rates</TabsTrigger>
                        <TabsTrigger value="payout">Payout</TabsTrigger>
                      </TabsList>

                      {/* Info Tab */}
                      <TabsContent value="info" className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="ActorName">Display Name</Label>
                            <Input id="ActorName" name="ActorName" value={actorData.ActorName || ''} onChange={handleInputChange} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="slug">Username / URL</Label>
                            <Input id="slug" name="slug" value={actorData.slug || ''} onChange={handleInputChange} placeholder="e.g., your-name"/>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="Gender">Gender</Label>
                            <Select name="Gender" value={actorData.Gender} onValueChange={(value) => handleSelectChange('Gender', value)}>
                              <SelectTrigger><SelectValue placeholder="Select gender..." /></SelectTrigger>
                              <SelectContent>
                                {genderOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="Language">Primary Language</Label>
                            <Select name="Language" value={actorData.Language} onValueChange={(value) => handleSelectChange('Language', value)}>
                              <SelectTrigger><SelectValue placeholder="Select language..." /></SelectTrigger>
                              <SelectContent>
                                {languageOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <Label>Tags (Select all that apply)</Label>
                            <div className="flex flex-wrap gap-2">
                              {tagOptions.map(tag => {
                                const isSelected = (actorData.Tags || '').includes(tag);
                                return (
                                  <Button type="button" key={tag} variant={isSelected ? 'default' : 'secondary'} size="sm" onClick={() => handleTagToggle(tag)}>
                                    {tag}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="bio">Your Bio</Label>
                            <Textarea id="bio" name="bio" rows={4} value={actorData.bio || ''} onChange={handleInputChange} placeholder="Tell clients about your voice..."/>
                          </div>
                        </div>
                      </TabsContent>

                      {/* Rates Tab */}
                      <TabsContent value="rates" className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="BaseRate_per_Word">Base Rate per Word (MAD)</Label>
                            <Input type="number" step="0.01" id="BaseRate_per_Word" name="BaseRate_per_Word" value={actorData.BaseRate_per_Word || 0} onChange={handleInputChange} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="revisions_allowed">Revisions Offered</Label>
                            <Input type="number" id="revisions_allowed" name="revisions_allowed" value={actorData.revisions_allowed || 2} onChange={handleInputChange}/>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="WebMultiplier">Web Usage Multiplier (e.g., 1.5)</Label>
                            <Input type="number" step="0.1" id="WebMultiplier" name="WebMultiplier" value={actorData.WebMultiplier || 1} onChange={handleInputChange} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="BroadcastMultiplier">Broadcast Multiplier (e.g., 3)</Label>
                            <Input type="number" step="0.1" id="BroadcastMultiplier" name="BroadcastMultiplier" value={actorData.BroadcastMultiplier || 1} onChange={handleInputChange} />
                          </div>
                        </div>
                      </TabsContent>

                      {/* Payout Tab */}
                      <TabsContent value="payout" className="pt-6 space-y-6">
                        <Card>
                          <CardHeader>
                            <CardTitle>Bank Account Details</CardTitle>
                            <CardDescription>Enter where you wish to receive direct payments. This is required to enable the feature.</CardDescription>
                          </CardHeader>
                          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <Label htmlFor="bank_name">Bank Name</Label>
                              <Input id="bank_name" name="bank_name" value={actorData.bank_name || ''} onChange={handleInputChange} placeholder="e.g., Attijariwafa Bank"/>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="bank_holder_name">Account Holder Name</Label>
                              <Input id="bank_holder_name" name="bank_holder_name" value={actorData.bank_holder_name || ''} onChange={handleInputChange} placeholder="Full name on account"/>
                            </div>
                            <div className="md:col-span-2 space-y-2">
                              <Label htmlFor="bank_iban">IBAN</Label>
                              <Input id="bank_iban" name="bank_iban" value={actorData.bank_iban || ''} onChange={handleInputChange} placeholder="MA..."/>
                            </div>
                            <div className="md:col-span-2 space-y-2">
                              <Label htmlFor="bank_account_number">Account Number (RIB)</Label>
                              <Input id="bank_account_number" name="bank_account_number" value={actorData.bank_account_number || ''} onChange={handleInputChange} placeholder="Full account number"/>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader>
                            <CardTitle>Direct Payment Eligibility</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {eligibilityLoading ? <p>Loading eligibility...</p> : (
                              <div className="space-y-4">
                                <div className="flex gap-4">
                                  <div className="flex-1 bg-muted p-3 rounded-lg text-center">
                                    <p className="text-xs text-muted-foreground uppercase">Completed Orders</p>
                                    <p className="text-xl font-bold">{completedOrderCount} / <span className="text-muted-foreground">1</span></p>
                                  </div>
                                  <div className="flex-1 bg-muted p-3 rounded-lg text-center">
                                    <p className="text-xs text-muted-foreground uppercase">Average Rating</p>
                                    <p className="text-xl font-bold">{averageRating?.toFixed(1) ?? 'N/A'} / <span className="text-muted-foreground">3.0+</span></p>
                                  </div>
                                </div>
                                <div className="p-4 bg-background rounded-lg text-center">
                                  {(() => {
                                    const isEligible = completedOrderCount >= 1 && (averageRating ?? 0) > 3.0;
                                    if (actorData.direct_payment_enabled) return <p className="text-green-500 font-semibold">✅ Direct Payments Approved & Enabled</p>;
                                    if (actorData.direct_payment_requested) return <p className="text-yellow-500 font-semibold">⏳ Request Pending Admin Approval</p>;
                                    if (isEligible) return <Button type="button" onClick={handleRequestDirectPayment}>Request Admin Approval</Button>;
                                    return <p className="text-muted-foreground">Meet the requirements to request direct payments.</p>;
                                  })()}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </Tabs>

                    {/* Save Button */}
                    <div className="mt-6 pt-6 border-t text-right">
                      <Button type="submit" size="lg">
                        <Save size={16} className="mr-2"/> Save Profile Changes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </AccordionContent>
          </AccordionItem>

          {/* --- 2. My Services (NEW) --- */}
          <AccordionItem value="services">
            <AccordionTrigger className="text-2xl font-bold flex items-center gap-3">
              <CheckCircle size={20}/> My Services
            </AccordionTrigger>
            <AccordionContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <Card className="bg-muted/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Voice Over</CardTitle>
                    <Mic className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">Enabled</div>
                    <p className="text-xs text-muted-foreground">This is your core service.</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Script Writing</CardTitle>
                    <PencilLine className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {actorData.service_scriptwriting ? "Active" : "Inactive"}
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">Offer script writing as a service.</p>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="service_scriptwriting"
                        checked={actorData.service_scriptwriting || false}
                        onCheckedChange={(isChecked) => handleServiceToggle('service_scriptwriting', isChecked)}
                      />
                      <Label htmlFor="service_scriptwriting">Enable</Label>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Video Editing</CardTitle>
                    <Video className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {actorData.service_videoediting ? "Active" : "Inactive"}
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">Offer video editing as a service.</p>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="service_videoediting"
                        checked={actorData.service_videoediting || false}
                        onCheckedChange={(isChecked) => handleServiceToggle('service_videoediting', isChecked)}
                      />
                      <Label htmlFor="service_videoediting">Enable</Label>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* --- 3. Manage Demos --- */}
          <AccordionItem value="demos">
            <AccordionTrigger className="text-2xl font-bold flex items-center gap-3">
              <Music size={20}/> Manage Your Demos
            </AccordionTrigger>
            <AccordionContent className="p-6">
              <Tabs defaultValue="upload">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload">Upload New</TabsTrigger>
                  <TabsTrigger value="manage">Manage ({demos.length})</TabsTrigger>
                </TabsList>
                {/* Upload Tab */}
                <TabsContent value="upload" className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Main Demo</CardTitle>
                        <CardDescription>This plays on your main profile card.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {actorData.MainDemoURL && (
                          <audio controls src={actorData.MainDemoURL} className="w-full h-10" />
                        )}
                        <Label htmlFor="main-demo-upload" className="w-full">
                          <Button variant="outline" asChild className="w-full cursor-pointer">
                            <span>{uploadingMainDemo ? 'Uploading...' : 'Upload & Replace'}</span>
                          </Button>
                        </Label>
                        <Input type="file" id="main-demo-upload" className="hidden" accept="audio/*" onChange={handleMainDemoUpload} disabled={uploadingMainDemo} />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Add New Demo</CardTitle>
                        <CardDescription>Add a new demo to your portfolio.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleDemoUpload} className="space-y-4">
                          <Input name="title" placeholder="Demo Title" value={newDemo.title} onChange={handleDemoInputChange} required />
                          <Select name="language" value={newDemo.language} onValueChange={(v) => setNewDemo(p => ({...p, language: v}))} required>
                            <SelectTrigger><SelectValue placeholder="Select Language..." /></SelectTrigger>
                            <SelectContent>
                              {languageOptions.map(lang => <SelectItem key={lang} value={lang}>{lang}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select name="style_tag" value={newDemo.style_tag} onValueChange={(v) => setNewDemo(p => ({...p, style_tag: v}))} required>
                            <SelectTrigger><SelectValue placeholder="Select Style..." /></SelectTrigger>
                            <SelectContent>
                              {tagOptions.map(tag => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input id="demo-file-input" type="file" accept="audio/*" onChange={handleFileChange} required />
                          <Button type="submit" disabled={uploading} className="w-full">
                            {uploading ? 'Uploading...' : 'Upload Demo'}
                          </Button>
                        </form>
                        {demoMessage && <p className="text-center text-sm text-muted-foreground mt-2">{demoMessage}</p>}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                {/* Manage Tab */}
                <TabsContent value="manage" className="pt-6">
                  <div className="space-y-3">
                    {demos.length > 0 ? demos.map(demo => (
                      <Card key={demo.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <Music size={16} className="text-muted-foreground" />
                          <div>
                            <p className="font-semibold">{demo.title}</p>
                            <p className="text-xs text-muted-foreground">{demo.language} | {demo.style_tag}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDemoDelete(demo.id, demo.demo_url)} className="text-destructive hover:text-destructive">
                          <Trash2 size={16} aria-hidden="true" />
                        </Button>
                      </Card>
                    )) : <p className="text-muted-foreground text-sm text-center py-4">No portfolio demos uploaded yet.</p>}
                  </div>
                </TabsContent>
              </Tabs>
            </AccordionContent>
          </AccordionItem>

          {/* --- 4. Recording Library --- */}
          <AccordionItem value="recordings">
            <AccordionTrigger className="text-2xl font-bold flex items-center gap-3">
              <AudioLines size={20}/> My Recordings Library
            </AccordionTrigger>
            <AccordionContent className="p-6">
              <Tabs defaultValue="recordings">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="recordings">Library ({recordings.length})</TabsTrigger>
                  <TabsTrigger value="upload">Upload Audio</TabsTrigger>
                </TabsList>
                {/* Library Tab */}
                <TabsContent value="recordings" className="pt-6">
                  <Button onClick={() => setIsRecordingModalOpen(true)} className="w-full mb-6">
                    <Plus size={16} className="mr-2"/> Record New Audio
                  </Button>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {recordings.length === 0 && (
                      <p className="text-muted-foreground text-sm text-center py-4">Your recording library is empty.</p>
                    )}
                    {recordings.map(rec => (
                      <Card key={rec.id} className="relative group">
                        <CardHeader>
                          <Button
                            variant="ghost" size="icon"
                            aria-label={`Delete recording ${rec.name}`}
                            onClick={() => handleDeleteRecording(rec)}
                            disabled={isDeletingRecording === rec.id}
                            className="absolute top-2 right-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"
                          >
                            {isDeletingRecording === rec.id ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </Button>
                          <CardTitle>{rec.name}</CardTitle>
                          <CardDescription>Recorded: {new Date(rec.created_at).toLocaleDateString()}</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs">Raw Audio:</Label>
                            <audio aria-label={`Raw recording: ${rec.name}`} controls src={rec.raw_audio_url} className="w-full h-10" />
                          </div>
                          <div className="space-y-1">
                            {rec.status === 'cleaned' && rec.cleaned_audio_url ? (
                              <>
                                <Label className="text-xs text-green-500">Cleaned Audio (AI):</Label>
                                <audio aria-label={`Cleaned recording: ${rec.name}`} controls src={rec.cleaned_audio_url} className="w-full h-10" />
                              </>
                            ) : (
                              <div className="h-full flex items-end">
                                <Button
                                  onClick={() => handleCleanAudio(rec.id)}
                                  disabled={cleaningId === rec.id || rec.status === 'cleaning'}
                                  className="w-full"
                                  variant={rec.status === 'error' ? 'destructive' : 'default'}
                                >
                                  {rec.status === 'cleaning' || cleaningId === rec.id ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <Brain size={16} className="mr-2" />}
                                  {rec.status === 'cleaning' || cleaningId === rec.id ? 'Cleaning...' : (rec.status === 'error' ? 'Try Again' : 'Clean Audio (AI)')}
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
                {/* Upload Tab */}
                <TabsContent value="upload" className="pt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Upload Existing Audio File</CardTitle>
                      <CardDescription>Upload an MP3, WAV, etc., from your computer to your library.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleUploadRecording} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="recording-file-upload">Audio File</Label>
                          <Input id="recording-file-upload" type="file" accept="audio/*" onChange={handleUploadFileChange} required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="uploading-recording-name">Recording Name</Label>
                          <Input id="uploading-recording-name" value={uploadingRecordingName} onChange={(e) => setUploadingRecordingName(e.target.value)} placeholder="e.g., 'Audition Take 1'" required />
                        </div>
                        <Button type="submit" disabled={isUploading || !uploadingRecordingFile || !uploadingRecordingName.trim()} className="w-full">
                          <UploadCloud size={18} className="mr-2" />
                          {isUploading ? 'Uploading...' : 'Upload & Save to Library'}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </AccordionContent>
          </AccordionItem>

          {/* --- 5. Your Orders --- */}
          <AccordionItem value="orders">
            <AccordionTrigger className="text-2xl font-bold flex items-center gap-3">
              <ListOrdered size={20}/> Your Orders
            </AccordionTrigger>
            <AccordionContent className="p-6">
              <Tabs value={activeOrderTab} onValueChange={(value) => setActiveOrderTab(value as 'active' | 'completed')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="completed">Completed</TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="space-y-4 mt-6">
                {filteredOrders.length > 0 ? (
                  filteredOrders.map(order => (
                    <Card key={order.id} className="p-4">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className={`w-full text-left ${order.status === 'Awaiting Actor Confirmation' ? 'border border-green-500 rounded-lg p-3 -m-3' : ''}`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="text-left">
                            <p className="font-bold text-base">Order #{order.order_id_string}</p>
                            <p className="text-sm text-muted-foreground">Client: {order.client_name}</p>
                          </div>
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            order.status === 'Completed' ? 'bg-green-500/20 text-green-300' :
                            order.status === 'Awaiting Actor Confirmation' ? 'bg-green-500/20 text-green-300 animate-pulse' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </button>
                    </Card>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-4">You have no {activeOrderTab} orders.</p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>

      {/* --- Modals (Unchanged) --- */}
      {isRecordingModalOpen && (
        <RecordingModal 
          onClose={() => setIsRecordingModalOpen(false)}
          onSave={handleSaveRecording}
          isSaving={isSavingRecording}
        />
      )}

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={fetchData} 
          onActorConfirmPayment={handleActorConfirmPayment}
        />
      )}
    </div>
  ); 
}; 

export default ActorDashboardPage;