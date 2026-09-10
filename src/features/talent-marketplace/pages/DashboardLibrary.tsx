// In src/pages/dashboard/DashboardLibrary.tsx

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/supabaseClient";
import { useOutletContext } from "react-router-dom";
import { RecordingModal } from "@/features/talent-marketplace";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";

// --- shadcn/ui Imports ---
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// ---

import { Plus, Trash2, UploadCloud, Brain, RefreshCw } from "lucide-react";

// --- Interfaces ---
interface ActorRecording {
  id: string;
  actor_id: string;
  name: string;
  raw_audio_url: string;
  cleaned_audio_url: string | null;
  status: "raw" | "cleaning" | "cleaned" | "error";
  created_at: string;
}

const DashboardLibrary: React.FC = () => {
  const { actorData } = useOutletContext<ActorDashboardContextType>();

  const [recordings, setRecordings] = useState<ActorRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [isSavingRecording, setIsSavingRecording] = useState(false);
  const [cleaningId, setCleaningId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<Map<string, number>>(new Map());
  const [isDeletingRecording, setIsDeletingRecording] = useState<string | null>(
    null
  );
  const [uploadingRecordingFile, setUploadingRecordingFile] =
    useState<File | null>(null);
  const [uploadingRecordingName, setUploadingRecordingName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Fetch data for this page
  const fetchRecordings = useCallback(async () => {
    if (!actorData.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("actor_recordings")
      .select("*")
      .eq("actor_id", actorData.id)
      .order("created_at", { ascending: false });

    if (error) setMessage(`Error: ${error.message}`);
    else setRecordings(data as ActorRecording[]);

    setLoading(false);
  }, [actorData.id]);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  // --- Real-time and Polling useEffects ---
  useEffect(() => {
    if (!actorData.id) return;
    const channel = supabase
      .channel(`actor-recordings-${actorData.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "actor_recordings",
          filter: `actor_id=eq.${actorData.id}`,
        },
        (payload) => {
          const updatedRecording = payload.new as ActorRecording;
          setRecordings((prev) =>
            prev.map((r) =>
              r.id === updatedRecording.id ? updatedRecording : r
            )
          );
          if (
            updatedRecording.id === cleaningId &&
            (updatedRecording.status === "cleaned" ||
              updatedRecording.status === "error")
          ) {
            setCleaningId(null);
            if (updatedRecording.status === "cleaned") {
              setMessage(`Recording "${updatedRecording.name}" is clean!`);
            }
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [actorData.id, cleaningId]);

  useEffect(() => {
    const intervalMap = pollingIntervalRef.current;
    return () => {
      intervalMap.forEach((intervalId) => clearInterval(intervalId));
    };
  }, []);

  useEffect(() => {
    if (cleaningId) {
      const poll = async () => {
        try {
          const { data, error } = await supabase.functions.invoke(
            "poll-audo-status",
            { body: { recordingId: cleaningId } }
          );
          if (error) throw error;
          const audoStatus = data.status;
          if (audoStatus === "succeeded" || audoStatus === "failed") {
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
      pollingIntervalRef.current.set(
        cleaningId,
        intervalId as unknown as number
      );
    }
  }, [cleaningId]);

  // --- Handlers ---
  const handleSaveRecording = async (
    audioFile: File,
    recordingName: string
  ) => {
    if (!actorData.id) return;
    setIsSavingRecording(true);
    setMessage("");
    try {
      const fileExt = audioFile.name.split(".").pop() || "webm";
      const filePath = `${actorData.id}/${recordingName.replace(
        /[^a-zA-Z0-9]/g,
        "-"
      )}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(filePath, audioFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("recordings")
        .getPublicUrl(filePath);

      const { data: newRecording, error: insertError } = await supabase
        .from("actor_recordings")
        .insert({
          actor_id: actorData.id,
          name: recordingName,
          raw_audio_url: urlData.publicUrl,
          status: "raw",
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setRecordings((prev) => [newRecording as ActorRecording, ...prev]);
      setMessage("Recording saved to library!");
      setIsRecordingModalOpen(false);
    } catch (error) {
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsSavingRecording(false);
    }
  };

  const handleUploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadingRecordingFile(e.target.files[0]);
      if (!uploadingRecordingName) {
        setUploadingRecordingName(
          e.target.files[0].name.replace(/\.[^/.]+$/, "")
        );
      }
    } else {
      setUploadingRecordingFile(null);
    }
  };

  const handleUploadRecording = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !uploadingRecordingFile ||
      !uploadingRecordingName.trim() ||
      !actorData.id
    ) {
      setMessage("Please select an audio file and provide a name.");
      return;
    }
    setIsUploading(true);
    setMessage("");
    try {
      const fileExt = uploadingRecordingFile.name.split(".").pop() || "tmp";
      const filePath = `${actorData.id}/${uploadingRecordingName.replace(
        /[^a-zA-Z0-9]/g,
        "-"
      )}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(filePath, uploadingRecordingFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("recordings")
        .getPublicUrl(filePath);
      if (!urlData) throw new Error("Could not get public URL.");

      const { data: newRecording, error: insertError } = await supabase
        .from("actor_recordings")
        .insert({
          actor_id: actorData.id,
          name: uploadingRecordingName.trim(),
          raw_audio_url: urlData.publicUrl,
          status: "raw",
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setRecordings((prev) => [newRecording as ActorRecording, ...prev]);
      setMessage(`Recording "${uploadingRecordingName.trim()}" uploaded!`);

      setUploadingRecordingFile(null);
      setUploadingRecordingName("");
      const fileInput = document.getElementById(
        "recording-file-upload"
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      // Don't switch tab, just show success
    } catch (error) {
      setMessage(`Error uploading recording: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCleanAudio = async (recordingId: string) => {
    setMessage("");
    try {
      setRecordings((prev) =>
        prev.map((r) =>
          r.id === recordingId ? { ...r, status: "cleaning" } : r
        )
      );
      const { data: responseData, error: functionError } =
        await supabase.functions.invoke("clean-audio", {
          body: { recordingId },
        });
      if (functionError) throw functionError;
      if (responseData.error) throw new Error(responseData.error);
      if (!responseData.jobId)
        throw new Error("Function did not return a jobId.");
      setMessage("Cleaning job started...");
      setCleaningId(recordingId);
    } catch (error) {
      setMessage(`Error: ${(error as Error).message}`);
      setRecordings((prev) =>
        prev.map((r) => (r.id === recordingId ? { ...r, status: "error" } : r))
      );
      setCleaningId(null);
    }
  };

  const handleDeleteRecording = async (recording: ActorRecording) => {
    if (!actorData.id) return;
    if (!window.confirm(`Are you sure you want to delete "${recording.name}"?`))
      return;
    setIsDeletingRecording(recording.id);
    setMessage("");
    try {
      const { data: publicUrlData } = supabase.storage
        .from("recordings")
        .getPublicUrl("");
      const baseUrl = publicUrlData?.publicUrl
        ? publicUrlData.publicUrl.replace(/\/$/, "")
        : null;
      const filesToDelete: string[] = [];

      if (recording.raw_audio_url) {
        try {
          const rawPath = new URL(recording.raw_audio_url).pathname.split(
            "/recordings/"
          )[1];
          if (rawPath) filesToDelete.push(rawPath);
        } catch (e) {
          console.error("Could not parse raw_audio_url:", e);
        }
      }

      if (
        recording.cleaned_audio_url &&
        baseUrl &&
        recording.cleaned_audio_url.startsWith(baseUrl)
      ) {
        try {
          const urlObject = new URL(recording.cleaned_audio_url);
          const pathParts = urlObject.pathname.split("/");
          const bucketIndex = pathParts.findIndex(
            (part) => part === "recordings"
          );
          if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
            const cleanedPath = pathParts.slice(bucketIndex + 1).join("/");
            filesToDelete.push(cleanedPath);
          }
        } catch (e) {
          console.error("Could not parse cleaned_audio_url:", e);
        }
      }

      if (filesToDelete.length > 0) {
        await supabase.storage.from("recordings").remove(filesToDelete);
      }

      await supabase
        .from("actor_recordings")
        .delete()
        .eq("id", recording.id)
        .eq("actor_id", actorData.id);
      setRecordings((prev) => prev.filter((r) => r.id !== recording.id));
      setMessage(`Recording "${recording.name}" deleted.`);
    } catch (error) {
      setMessage(`Error deleting recording: ${(error as Error).message}`);
    } finally {
      setIsDeletingRecording(null);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 w-full max-w-7xl mx-auto ">
      <h1 className="text-3xl font-bold mb-6">My Recordings Library</h1>
      {message && (
        <div className="mb-4 p-3 bg-card border rounded-lg text-center text-sm">
          {message}
        </div>
      )}

      <Tabs defaultValue="recordings">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recordings">
            Library ({recordings.length})
          </TabsTrigger>
          <TabsTrigger value="upload">Upload Audio</TabsTrigger>
        </TabsList>

        <TabsContent value="recordings" className="pt-6">
          <Button
            onClick={() => setIsRecordingModalOpen(true)}
            className="w-full mb-6"
          >
            <Plus size={16} className="mr-2" /> Record New Audio
          </Button>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {loading && (
              <p className="text-muted-foreground text-center py-4">
                Loading recordings...
              </p>
            )}
            {!loading && recordings.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">
                Your recording library is empty.
              </p>
            )}
            {recordings.map((rec) => (
              <Card key={rec.id} className="relative group">
                <CardHeader>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete recording ${rec.name}`}
                    onClick={() => handleDeleteRecording(rec)}
                    disabled={isDeletingRecording === rec.id}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"
                  >
                    {isDeletingRecording === rec.id ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </Button>
                  <CardTitle>{rec.name}</CardTitle>
                  <CardDescription>
                    Recorded: {new Date(rec.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Raw Audio:</Label>
                    <audio
                      aria-label={`Raw recording: ${rec.name}`}
                      controls
                      src={rec.raw_audio_url}
                      className="w-full h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    {rec.status === "cleaned" && rec.cleaned_audio_url ? (
                      <>
                        <Label className="text-xs text-green-500">
                          Cleaned Audio (AI):
                        </Label>
                        <audio
                          aria-label={`Cleaned recording: ${rec.name}`}
                          controls
                          src={rec.cleaned_audio_url}
                          className="w-full h-10"
                        />
                      </>
                    ) : (
                      <div className="h-full flex items-end">
                        <Button
                          onClick={() => handleCleanAudio(rec.id)}
                          disabled={
                            cleaningId === rec.id || rec.status === "cleaning"
                          }
                          className="w-full"
                          variant={
                            rec.status === "error" ? "destructive" : "default"
                          }
                        >
                          {rec.status === "cleaning" ||
                          cleaningId === rec.id ? (
                            <RefreshCw
                              size={16}
                              className="mr-2 animate-spin"
                            />
                          ) : (
                            <Brain size={16} className="mr-2" />
                          )}
                          {rec.status === "cleaning" || cleaningId === rec.id
                            ? "Cleaning..."
                            : rec.status === "error"
                            ? "Try Again"
                            : "Clean Audio (AI)"}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="upload" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Existing Audio File</CardTitle>
              <CardDescription>
                Upload an MP3, WAV, etc., from your computer to your library.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUploadRecording} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recording-file-upload">Audio File</Label>
                  <Input
                    id="recording-file-upload"
                    type="file"
                    // Accept standard web audio + iOS/Mac formats + common video formats that contain audio
                    accept="audio/*, .m4a, .mp3, .wav, .aac, .ogg, .webm"
                    onChange={handleUploadFileChange}
                    required
                  />{" "}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uploading-recording-name">
                    Recording Name
                  </Label>
                  <Input
                    id="uploading-recording-name"
                    value={uploadingRecordingName}
                    onChange={(e) => setUploadingRecordingName(e.target.value)}
                    placeholder="e.g., 'Audition Take 1'"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={
                    isUploading ||
                    !uploadingRecordingFile ||
                    !uploadingRecordingName.trim()
                  }
                  className="w-full"
                >
                  <UploadCloud size={18} className="mr-2" />
                  {isUploading ? "Uploading..." : "Upload & Save to Library"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recording Modal */}
      {isRecordingModalOpen && (
        <RecordingModal
          onClose={() => setIsRecordingModalOpen(false)}
          onSave={handleSaveRecording}
          isSaving={isSavingRecording}
        />
      )}
    </div>
  );
};

export default DashboardLibrary;
