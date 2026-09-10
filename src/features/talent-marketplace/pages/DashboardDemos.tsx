//  In  src/pages/dashboard/DashboardDemos.tsx

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/supabaseClient";
import { useOutletContext } from "react-router-dom";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout";

//  ---  shadcn/ui  Imports  ---
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
//  ---  NEW  Imports  ---
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Music,
  Trash2,
  PencilLine,
  Video,
  UploadCloud,
  RefreshCw,
  Save,
  Mic,
  CheckCircle,
  Library,
} from "lucide-react";
//  ---

//  ---  Interfaces  ---
interface Demo {
  id: string;
  title: string;
  language: string;
  style_tag: string;
  demo_url: string;
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

//  ---  NEW:  Interface  for  actor  recordings  (from  library)  ---
interface ActorRecording {
  id: string;
  actor_id: string;
  name: string;
  raw_audio_url: string;
  cleaned_audio_url: string | null;
  status: "raw" | "cleaning" | "cleaned" | "error";
  created_at: string;
}

interface Actor {
  id: string;
  MainDemoURL?: string;
}

//  ---  Hardcoded  Options  ---
const languageOptions = ["Arabic", "English", "French", "Spanish"];
const tagOptions = ["Warm", "Deep", "Conversational", "Corporate"];

const DashboardDemos: React.FC = () => {
  const { actorData: layoutActorData } =
    useOutletContext<ActorDashboardContextType>();
  const [mainDemoUrl, setMainDemoUrl] = useState<string | undefined>(undefined);
  const [demos, setDemos] = useState<Demo[]>([]);
  const [scriptDemos, setScriptDemos] = useState<ScriptDemo[]>([]);
  const [videoDemos, setVideoDemos] = useState<VideoDemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(""); //  Audio  state
  const [uploadingMainDemo, setUploadingMainDemo] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [newDemo, setNewDemo] = useState({
    title: "",
    language: "",
    style_tag: "",
  });
  const [demoFile, setDemoFile] = useState<File | null>(null); //  ---  NEW:  Library  state  ---

  const [recordings, setRecordings] = useState<ActorRecording[]>([]);
  const [uploadSource, setUploadSource] = useState<"upload" | "library">(
    "upload"
  );
  const [selectedRecordingUrl, setSelectedRecordingUrl] = useState<
    string | null
  >(null); //  --- //  Script  state
  const [isUploadingScript, setIsUploadingScript] = useState(false);
  const [newScriptDemo, setNewScriptDemo] = useState({
    title: "",
    content: "",
  }); //  Video  state

  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [newVideoDemo, setNewVideoDemo] = useState({ title: "" });
  const [videoDemoFile, setVideoDemoFile] = useState<File | null>(null); //  ---  MODIFIED:  Fetch  data  for  this  page  ---

  const fetchDemoData = useCallback(async () => {
    if (!layoutActorData.id) return;
    setLoading(true);
    setMessage("");
    const errors: string[] = [];

    const { data: actor, error: actorError } = await supabase
      .from("actors")
      .select("MainDemoURL")
      .eq("id", layoutActorData.id)
      .single();
    if (actorError) errors.push(`profile: ${actorError.message}`);
    else setMainDemoUrl(actor?.MainDemoURL);

    const [audioResult, scriptsResult, videosResult, recordingsResult] = await Promise.all([
      supabase.from("demos").select("*").eq("actor_id", layoutActorData.id).order("created_at", { ascending: false }),
      supabase.from("script_demos").select("*").eq("actor_id", layoutActorData.id).order("created_at", { ascending: false }),
      supabase.from("video_demos").select("*").eq("actor_id", layoutActorData.id).order("created_at", { ascending: false }),
      supabase.from("actor_recordings").select("*").eq("actor_id", layoutActorData.id).order("created_at", { ascending: false }),
    ]);

    if (audioResult.error) errors.push(`audio demos: ${audioResult.error.message}`);
    else setDemos((audioResult.data || []) as Demo[]);
    if (scriptsResult.error) errors.push(`script demos: ${scriptsResult.error.message}`);
    else setScriptDemos((scriptsResult.data || []) as ScriptDemo[]);
    if (videosResult.error) errors.push(`video demos: ${videosResult.error.message}`);
    else setVideoDemos((videosResult.data || []) as VideoDemo[]);
    if (recordingsResult.error) errors.push(`recording library: ${recordingsResult.error.message}`);
    else setRecordings((recordingsResult.data || []) as ActorRecording[]);

    if (errors.length > 0) setMessage(`Some demo features could not load: ${errors.join("; ")}`);
    setLoading(false);
  }, [layoutActorData.id]);

  useEffect(() => {
    fetchDemoData();
  }, [fetchDemoData]); //  ---  Handlers  ---

  const handleMainDemoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    //  (This  function  is  unchanged)
    const file = event.target.files?.[0];
    if (!file || !layoutActorData.id) return;
    setUploadingMainDemo(true);
    setMessage("");
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${layoutActorData.id}/main-demo.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("demos")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("demos")
        .getPublicUrl(filePath);
      const newDemoUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;

      const { error: updateError } = await supabase
        .from("actors")
        .update({ MainDemoURL: newDemoUrl })
        .eq("id", layoutActorData.id);
      if (updateError) throw updateError;
      setMainDemoUrl(newDemoUrl);
      setMessage("Main  demo  updated!");
    } catch (error) {
      setMessage(`Error:  ${(error as Error).message}`);
    } finally {
      setUploadingMainDemo(false);
    }
  };

  const handleDemoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewDemo((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }; //  ---  MODIFIED:  This  function  now  handles  BOTH  uploads  and  library  imports  ---

  const handleDemoUpload = async (e: React.FormEvent) => {
    e.preventDefault(); //  General  validation
    if (
      !newDemo.title ||
      !newDemo.language ||
      !newDemo.style_tag ||
      !layoutActorData.id
    ) {
      setMessage(
        "Please  fill  all  demo  fields  (Title,  Language,  Style)."
      );
      return;
    }
    setUploadingAudio(true);
    setMessage("");

    try {
      let demoUrlToInsert = "";

      if (uploadSource === "upload") {
        //  ---  1.  Logic  for  File  Upload  ---
        if (!demoFile) {
          setMessage("Please  select  a  file  to  upload.");
          setUploadingAudio(false);
          return;
        }
        const fileExt = demoFile.name.split(".").pop();
        const filePath = `${layoutActorData.id}/${Date.now()}.${fileExt}`;
        await supabase.storage.from("demos").upload(filePath, demoFile);
        const { data: urlData } = supabase.storage
          .from("demos")
          .getPublicUrl(filePath);
        demoUrlToInsert = urlData.publicUrl;
      } else if (uploadSource === "library") {
        //  ---  2.  Logic  for  Library  Import  ---
        if (!selectedRecordingUrl) {
          setMessage("Please  select  a  recording  from  your  library.");
          setUploadingAudio(false);
          return;
        }
        demoUrlToInsert = selectedRecordingUrl;
      } //  ---  3.  Common  Logic:  Insert  into  'demos'  table  ---

      const { data: newDemoData, error: insertError } = await supabase
        .from("demos")
        .insert({
          actor_id: layoutActorData.id,
          demo_url: demoUrlToInsert,
          ...newDemo,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      setDemos((prev) => [newDemoData as Demo, ...prev]);
      setNewDemo({ title: "", language: "", style_tag: "" });
      setDemoFile(null);
      setSelectedRecordingUrl(null);
      setUploadSource("upload"); //  Reset  form
      if (document.getElementById("demo-file-input")) {
        (document.getElementById("demo-file-input") as HTMLInputElement).value =
          "";
      }
      setMessage("Audio  demo  uploaded!");
    } catch (error) {
      setMessage(`Error:  ${(error as Error).message}`);
    } finally {
      setUploadingAudio(false);
    }
  };
  const handleDemoDelete = async (demoId: string, demoUrl: string) => {
    //  (This  function  is  unchanged)
    if (!window.confirm("Are  you  sure?")) return;
    setMessage("");
    try {
      const filePath = new URL(demoUrl).pathname.split("/demos/")[1];
      await supabase.storage.from("demos").remove([filePath]);
      await supabase.from("demos").delete().eq("id", demoId);
      setDemos((prev) => prev.filter((d) => d.id !== demoId));
      setMessage("Audio  demo  deleted.");
    } catch (error) {
      setMessage(`Error:  ${(error as Error).message}`);
    }
  }; //  (All  Script  and  Video  handlers  are  unchanged) //  ---  NEW  Handlers  for  Scripts  ---

  const handleScriptChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setNewScriptDemo((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleScriptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScriptDemo.title || !newScriptDemo.content || !layoutActorData.id) {
      setMessage(
        "Please  provide  a  title  and  content  for  your  script  demo."
      );
      return;
    }
    setIsUploadingScript(true);
    setMessage("");
    try {
      const { data: newScript, error } = await supabase
        .from("script_demos")
        .insert({
          actor_id: layoutActorData.id,
          title: newScriptDemo.title,
          content: newScriptDemo.content,
        })
        .select()
        .single();
      if (error) throw error;
      setScriptDemos((prev) => [newScript as ScriptDemo, ...prev]);
      setNewScriptDemo({ title: "", content: "" }); //  Clear  form
      setMessage("Script  demo  added!");
    } catch (error) {
      setMessage(`Error:  ${(error as Error).message}`);
    } finally {
      setIsUploadingScript(false);
    }
  };
  const handleScriptDelete = async (demoId: string) => {
    if (!window.confirm("Are  you  sure?")) return;
    setMessage("");
    try {
      await supabase.from("script_demos").delete().eq("id", demoId);
      setScriptDemos((prev) => prev.filter((d) => d.id !== demoId));
      setMessage("Script  demo  deleted.");
    } catch (error) {
      setMessage(`Error:  ${(error as Error).message}`);
    }
  }; //  ---  NEW  Handlers  for  Videos  ---
  const handleVideoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoDemoFile || !newVideoDemo.title || !layoutActorData.id) {
      setMessage("Please  provide  a  title  and  a  video  file.");
      return;
    }
    setIsUploadingVideo(true);
    setMessage("");
    try {
      const fileExt = videoDemoFile.name.split(".").pop();
      const filePath = `${layoutActorData.id}/${Date.now()}.${fileExt}`; //  Upload  to  the  new  'video-demos'  bucket
      await supabase.storage
        .from("video-demos")
        .upload(filePath, videoDemoFile);
      const { data: urlData } = supabase.storage
        .from("video-demos")
        .getPublicUrl(filePath);

      const { data: newVideo, error: insertError } = await supabase
        .from("video_demos")
        .insert({
          actor_id: layoutActorData.id,
          title: newVideoDemo.title,
          video_url: urlData.publicUrl,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setVideoDemos((prev) => [newVideo as VideoDemo, ...prev]);
      setNewVideoDemo({ title: "" });
      setVideoDemoFile(null);
      (document.getElementById("video-file-input") as HTMLInputElement).value =
        "";
      setMessage("Video  demo  added!");
    } catch (error) {
      setMessage(`Error:  ${(error as Error).message}`);
    } finally {
      setIsUploadingVideo(false);
    }
  };
  const handleVideoDelete = async (demoId: string, videoUrl: string) => {
    if (!window.confirm("Are  you  sure?")) return;
    setMessage("");
    try {
      const filePath = new URL(videoUrl).pathname.split("/video-demos/")[1];
      await supabase.storage.from("video-demos").remove([filePath]);
      await supabase.from("video_demos").delete().eq("id", demoId);
      setVideoDemos((prev) => prev.filter((d) => d.id !== demoId));
      setMessage("Video  demo  deleted.");
    } catch (error) {
      setMessage(`Error:  ${(error as Error).message}`);
    }
  }; //  ---  Main  JSX  (Refactored  with  Tabs)  ---
  return (
    <div className="max-w-4xl w-full mx-auto pt-20">
            <h1 className="text-3xl  font-bold  mb-6">Manage Your Portfolio</h1>
           {" "}
      {message && (
        <div
          className={`mb-4  p-3  bg-card  border  rounded-lg  text-center  text-sm  ${
            message.includes("Error") ? "text-destructive" : "text-green-500"
          }`}
        >
          {message}
        </div>
      )}
           {" "}
      <Tabs defaultValue="audio">
               {" "}
        <TabsList className="grid  w-full  grid-cols-3">
                   {" "}
          <TabsTrigger value="audio">
            <Music className="mr-2  h-4  w-4" /> Audio Demos
          </TabsTrigger>
                   {" "}
          <TabsTrigger value="scripts">
            <PencilLine className="mr-2  h-4  w-4" /> Script Demos
          </TabsTrigger>
                   {" "}
          <TabsTrigger value="videos">
            <Video className="mr-2  h-4  w-4" /> Video Demos
          </TabsTrigger>
                 {" "}
        </TabsList>
                        {/*  ---  1.  Audio  Demos  Tab  ---  */}       {" "}
        <TabsContent value="audio" className="pt-6">
                   {" "}
          <div className="grid  grid-cols-1  md:grid-cols-2  gap-6">
                       {" "}
            <Card>
                           {" "}
              <CardHeader>
                                <CardTitle>Main Demo</CardTitle>               {" "}
                <CardDescription>
                  Plays on your main profile card.
                </CardDescription>
                             {" "}
              </CardHeader>
                           {" "}
              <CardContent className="space-y-4">
                               {" "}
                {mainDemoUrl && (
                  <audio controls src={mainDemoUrl} className="w-full  h-10" />
                )}
                               {" "}
                <Label htmlFor="main-demo-upload" className="w-full">
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full  cursor-pointer"
                  >
                    {uploadingMainDemo ? "Uploading..." : "Upload  &  Replace"}
                  </Button>
                </Label>
                               {" "}
                <Input
                  type="file"
                  id="main-demo-upload"
                  className="hidden"
                  accept="audio/*, .m4a, .mp3, .wav, .aac, .ogg, .webm"
                  onChange={handleMainDemoUpload}
                  disabled={uploadingMainDemo}
                />
                             {" "}
              </CardContent>
                         {" "}
            </Card>
                       {" "}
            {/*  ---  MODIFIED:  Add  New  Audio  Demo  Card  ---  */}         
             {" "}
            <Card>
                           {" "}
              <CardHeader>
                                <CardTitle>Add New Audio Demo</CardTitle>       
                       {" "}
                <CardDescription>
                  Upload a new file or add from your library.
                </CardDescription>
                             {" "}
              </CardHeader>
                           {" "}
              <CardContent>
                               {" "}
                <form onSubmit={handleDemoUpload} className="space-y-4">
                                    {/*  ---  NEW:  Shared  Fields  ---  */}
                                   {" "}
                  <Input
                    name="title"
                    placeholder="Demo  Title"
                    value={newDemo.title}
                    onChange={handleDemoInputChange}
                    required
                  />
                                   {" "}
                  <Select
                    name="language"
                    value={newDemo.language}
                    onValueChange={(v) =>
                      setNewDemo((p) => ({ ...p, language: v }))
                    }
                  >
                                       {" "}
                    <SelectTrigger>
                      <SelectValue placeholder="Select  Language..." />
                    </SelectTrigger>
                                       {" "}
                    <SelectContent>
                                           {" "}
                      {languageOptions.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {lang}
                        </SelectItem>
                      ))}
                                         {" "}
                    </SelectContent>
                                     {" "}
                  </Select>
                                   {" "}
                  <Select
                    name="style_tag"
                    value={newDemo.style_tag}
                    onValueChange={(v) =>
                      setNewDemo((p) => ({ ...p, style_tag: v }))
                    }
                  >
                                       {" "}
                    <SelectTrigger>
                      <SelectValue placeholder="Select  Style..." />
                    </SelectTrigger>
                                       {" "}
                    <SelectContent>
                                           {" "}
                      {tagOptions.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                                         {" "}
                    </SelectContent>
                                     {" "}
                  </Select>
                                    {/*  ---  NEW:  Source  Selector  ---  */} 
                                 {" "}
                  <RadioGroup
                    value={uploadSource}
                    onValueChange={(v) =>
                      setUploadSource(v as "upload" | "library")
                    }
                    className="grid  grid-cols-2  gap-4"
                  >
                                       {" "}
                    <div>
                                           {" "}
                      <Label
                        htmlFor="upload"
                        className={`flex  flex-col  items-center  justify-center  p-4  border  rounded-lg  cursor-pointer  ${
                          uploadSource === "upload" ? "border-primary" : ""
                        }`}
                      >
                                               {" "}
                        <RadioGroupItem
                          value="upload"
                          id="upload"
                          className="sr-only"
                        />
                                               {" "}
                        <UploadCloud className="w-6  h-6  mb-2" />             
                                  Upload File                      {" "}
                      </Label>
                                         {" "}
                    </div>
                                       {" "}
                    <div>
                                           {" "}
                      <Label
                        htmlFor="library"
                        className={`flex  flex-col  items-center  justify-center  p-4  border  rounded-lg  cursor-pointer  ${
                          uploadSource === "library" ? "border-primary" : ""
                        }`}
                      >
                                               {" "}
                        <RadioGroupItem
                          value="library"
                          id="library"
                          className="sr-only"
                        />
                                               {" "}
                        <Library className="w-6  h-6  mb-2" />                 
                              From Library                    {" "}
                      </Label>
                                         {" "}
                    </div>
                                     {" "}
                  </RadioGroup>
                                   {" "}
                  {/*  ---  NEW:  Conditional  Inputs  ---  */}                 {" "}
                  {uploadSource === "upload" && (
                    <Input
                      id="demo-file-input"
                      type="file"
                      accept="audio/*, .m4a, .mp3, .wav, .aac, .ogg, .webm"
                      onChange={(e) => setDemoFile(e.target.files?.[0] || null)}
                      required
                    />
                  )}
                                   {" "}
                  {uploadSource === "library" && (
                    <Select
                      onValueChange={(url) => setSelectedRecordingUrl(url)}
                    >
                                           {" "}
                      <SelectTrigger>
                                               {" "}
                        <SelectValue placeholder="Select  from  your  library..." />
                                             {" "}
                      </SelectTrigger>
                                           {" "}
                      <SelectContent>
                                               {" "}
                        <ScrollArea className="h-[200px]">
                                                   {" "}
                          {recordings.length === 0 && (
                            <SelectItem value="none" disabled>
                              Your library is empty.
                            </SelectItem>
                          )}
                                                   {" "}
                          {recordings.map((rec) => {
                            const url =
                              rec.cleaned_audio_url || rec.raw_audio_url;
                            return (
                              <SelectItem key={rec.id} value={url}>
                                                               {" "}
                                <div className="flex  flex-col">
                                                                   {" "}
                                  <span className="font-medium">
                                    {rec.name}
                                  </span>
                                                                   {" "}
                                  {rec.cleaned_audio_url ? (
                                    <span className="text-xs  text-green-500">
                                      AI Cleaned
                                    </span>
                                  ) : (
                                    <span className="text-xs  text-yellow-500">
                                      Raw Audio
                                    </span>
                                  )}
                                                                 {" "}
                                </div>
                                                             {" "}
                              </SelectItem>
                            );
                          })}
                                                 {" "}
                        </ScrollArea>
                                             {" "}
                      </SelectContent>
                                         {" "}
                    </Select>
                  )}
                                               {" "}
                  <Button
                    type="submit"
                    disabled={uploadingAudio}
                    className="w-full"
                  >
                                       {" "}
                    {uploadingAudio ? (
                      <RefreshCw className="mr-2  h-4  w-4  animate-spin" />
                    ) : (
                      <UploadCloud className="mr-2  h-4  w-4" />
                    )}
                                       {" "}
                    {uploadingAudio ? "Uploading..." : "Upload  Audio  Demo"}   
                                 {" "}
                  </Button>
                                 {" "}
                </form>
                             {" "}
              </CardContent>
                         {" "}
            </Card>
                     {" "}
          </div>
                   {" "}
          <Card className="mt-6">
                       {" "}
            <CardHeader>
              <CardTitle>Manage Audio Demos ({demos.length})</CardTitle>
            </CardHeader>
                       {" "}
            <CardContent className="space-y-3">
                           {" "}
              {demos.length > 0 ? (
                demos.map((demo) => (
                  <Card
                    key={demo.id}
                    className="flex  items-center  justify-between  p-3"
                  >
                                     {" "}
                    <div className="flex  items-center  gap-3">
                                         {" "}
                      <Music size={16} className="text-muted-foreground" />     
                                   {" "}
                      <div>
                                             {" "}
                        <p className="font-semibold">{demo.title}</p>           
                           {" "}
                        <p className="text-xs  text-muted-foreground">
                          {demo.language} | {demo.style_tag}
                        </p>
                                           {" "}
                      </div>
                                       {" "}
                    </div>
                                     {" "}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDemoDelete(demo.id, demo.demo_url)}
                      className="text-destructive  hover:text-destructive"
                    >
                                      <Trash2 size={16} />                 {" "}
                    </Button>
                                   {" "}
                  </Card>
                ))
              ) : (
                <p className="text-muted-foreground  text-sm  text-center  py-4">
                  No portfolio demos uploaded yet.
                </p>
              )}
                         {" "}
            </CardContent>
                     {" "}
          </Card>
                 {" "}
        </TabsContent>
                        {/*  ---  2.  Script  Demos  Tab  (Unchanged)  ---  */} 
             {" "}
        <TabsContent value="scripts" className="pt-6">
                   {" "}
          <div className="grid  grid-cols-1  md:grid-cols-2  gap-6">
                       {" "}
            <Card>
                           {" "}
              <CardHeader>
                                <CardTitle>Add New Script Demo</CardTitle>     
                         {" "}
                <CardDescription>
                  Add a scriptwriting sample as text. This will be displayed
                  like a quote.
                </CardDescription>
                             {" "}
              </CardHeader>
                           {" "}
              <CardContent>
                               {" "}
                <form onSubmit={handleScriptSubmit} className="space-y-4">
                                   {" "}
                  <Input
                    name="title"
                    placeholder="Script  Title  (e.g.,  'Tech  Explainer')"
                    value={newScriptDemo.title}
                    onChange={handleScriptChange}
                    required
                  />
                               {" "}
                  <Textarea
                    name="content"
                    rows={10}
                    placeholder="Paste  your  script  content  here..."
                    value={newScriptDemo.content}
                    onChange={handleScriptChange}
                    required
                  />
                                   {" "}
                  <Button
                    type="submit"
                    disabled={isUploadingScript}
                    className="w-full"
                  >
                                       {" "}
                    {isUploadingScript ? (
                      <RefreshCw className="mr-2  h-4  w-4  animate-spin" />
                    ) : (
                      <Save className="mr-2  h-4  w-4" />
                    )}
                               {" "}
                    {isUploadingScript ? "Saving..." : "Save  Script  Demo"}   
                                 {" "}
                  </Button>
                                 {" "}
                </form>
                             {" "}
              </CardContent>
                         {" "}
            </Card>
                       {" "}
            <Card>
                           {" "}
              <CardHeader>
                <CardTitle>
                  Manage Script Demos ({scriptDemos.length})
                </CardTitle>
              </CardHeader>
                           {" "}
              <CardContent className="space-y-3  max-h-[500px]  overflow-y-auto  custom-scrollbar">
                               {" "}
                {scriptDemos.length > 0 ? (
                  scriptDemos.map((demo) => (
                    <Card key={demo.id} className="relative  group  p-4">
                                     {" "}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete script demo ${demo.title}`}
                        onClick={() => handleScriptDelete(demo.id)}
                        className="absolute  top-2  right-2  text-destructive  hover:text-destructive  opacity-0  group-hover:opacity-100  focus-visible:opacity-100  transition-opacity"
                      >
                                              <Trash2 size={16} />             
                             {" "}
                      </Button>
                                         {" "}
                      <p className="font-semibold  mb-2">{demo.title}</p>       
                                 {" "}
                      <p className="text-sm  text-muted-foreground  line-clamp-3  italic">
                        "{demo.content}"
                      </p>
                                       {" "}
                    </Card>
                  ))
                ) : (
                  <p className="text-muted-foreground  text-sm  text-center  py-4">
                    No script demos uploaded yet.
                  </p>
                )}
                         {" "}
              </CardContent>
                         {" "}
            </Card>
                     {" "}
          </div>
                 {" "}
        </TabsContent>
                        {/*  ---  3.  Video  Demos  Tab  (Unchanged)  ---  */} 
             {" "}
        <TabsContent value="videos" className="pt-6">
                   {" "}
          <div className="grid  grid-cols-1  md:grid-cols-2  gap-6">
                       {" "}
            <Card>
                           {" "}
              <CardHeader>
                                <CardTitle>Add New Video Demo</CardTitle>       
                   {" "}
                <CardDescription>
                  Upload a short video (MP4, MOV) to showcase your editing
                  skills. Max 3 videos.
                </CardDescription>
                             {" "}
              </CardHeader>
                           {" "}
              <CardContent>
                               {" "}
                <form onSubmit={handleVideoUpload} className="space-y-4">
                                   {" "}
                  <Input
                    name="title"
                    placeholder="Video  Title  (e.g.,  'Commercial  Edit')"
                    value={newVideoDemo.title}
                    onChange={(e) => setNewVideoDemo({ title: e.target.value })}
                    required
                  />
                                   {" "}
                  <Input
                    id="video-file-input"
                    type="file"
                    accept="video/mp4,video/quicktime"
                    onChange={(e) =>
                      setVideoDemoFile(e.target.files?.[0] || null)
                    }
                    required
                  />
                             {" "}
                  <Button
                    type="submit"
                    disabled={isUploadingVideo || videoDemos.length >= 3}
                    className="w-full"
                  >
                                       {" "}
                    {isUploadingVideo ? (
                      <RefreshCw className="mr-2  h-4  w-4  animate-spin" />
                    ) : (
                      <UploadCloud className="mr-2  h-4  w-4" />
                    )}
                                       {" "}
                    {isUploadingVideo ? "Uploading..." : "Upload  Video  Demo"} 
                                   {" "}
                  </Button>
                                   {" "}
                  {videoDemos.length >= 3 && (
                    <p className="text-xs  text-destructive  text-center">
                      You have reached the 3 video limit.
                    </p>
                  )}
                             {" "}
                </form>
                             {" "}
              </CardContent>
                         {" "}
            </Card>
                       {" "}
            <Card>
                           {" "}
              <CardHeader>
                <CardTitle>
                  Manage Video Demos ({videoDemos.length}/3)
                </CardTitle>
              </CardHeader>
                           {" "}
              <CardContent className="space-y-3  max-h-[500px]  overflow-y-auto  custom-scrollbar">
                               {" "}
                {videoDemos.length > 0 ? (
                  videoDemos.map((demo) => (
                    <Card key={demo.id} className="relative  group  p-4">
                               {" "}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          handleVideoDelete(demo.id, demo.video_url)
                        }
                        className="absolute  top-2  right-2  text-destructive  hover:text-destructive  opacity-0  group-hover:opacity-100  transition-opacity  z-10"
                      >
                                              <Trash2 size={16} />             
                             {" "}
                      </Button>
                                         {" "}
                      <p className="font-semibold  mb-2">{demo.title}</p>
                                   {" "}
                      <video
                        controls
                        src={demo.video_url}
                        className="w-full  rounded-md"
                      />
                                       {" "}
                    </Card>
                  ))
                ) : (
                  <p className="text-muted-foreground  text-sm  text-center  py-4">
                    No video demos uploaded yet.
                  </p>
                )}
                             {" "}
              </CardContent>
                         {" "}
            </Card>
                     {" "}
          </div>
                 {" "}
        </TabsContent>
             {" "}
      </Tabs>
         {" "}
    </div>
  );
};

export default DashboardDemos;
