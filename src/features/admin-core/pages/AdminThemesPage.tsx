import React, { useState } from "react";
import { supabase } from "@/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Search, 
  TerminalSquare, 
  ShieldAlert,
  Play
} from "lucide-react";

export default function AdminThemesPage() {
  const [selectedTheme, setSelectedTheme] = useState<any | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // 1. Fetch themes needing review
  const { data: pendingThemes = [], refetch, isLoading } = useQuery({
    queryKey: ["admin_pending_themes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_themes")
        .select(`
          *,
          developer:actors(ActorName, ActorEmail)
        `)
        .eq("status", "pending_review")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // 2. Trigger the Edge Function to Compile & Approve
  const handleApproveAndCompile = async (themeId: string) => {
    if (!confirm("Are you sure this code is safe? This will compile and publish the theme to the live marketplace.")) return;
    
    setIsCompiling(true);
    
    // Call the Edge Function we created earlier!
    const { data, error } = await supabase.functions.invoke('compile-theme', {
      body: { theme_id: themeId }
    });

    setIsCompiling(false);

    if (error || data?.error) {
      alert(`Compilation Failed:\n${error?.message || data?.error}`);
    } else {
      alert("Theme successfully compiled and approved!");
      setSelectedTheme(null);
      refetch();
    }
  };

  // 3. Reject Theme
  const handleReject = async (themeId: string) => {
    const reason = prompt("Enter a rejection reason (optional):");
    if (reason === null) return; // User cancelled

    setIsRejecting(true);
    const { error } = await supabase
      .from("marketplace_themes")
      .update({ 
          status: "rejected",
          // You could optionally save the rejection reason to a column if you create one
      })
      .eq("id", themeId);

    setIsRejecting(false);

    if (error) alert("Failed to reject theme.");
    else {
      setSelectedTheme(null);
      refetch();
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ShieldAlert className="text-amber-500" /> Theme Auditor
        </h1>
        <p className="text-muted-foreground mt-2">
          Review developer code submissions for security issues before compiling and publishing them to the marketplace.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
      ) : pendingThemes.length === 0 ? (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <CheckCircle2 size={48} className="mb-4 opacity-20" />
            <p className="font-bold">No themes pending review!</p>
            <p className="text-sm">Developers haven't submitted anything new.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingThemes.map((theme: any) => (
            <Card key={theme.id} className="border-amber-200 bg-amber-50/10">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <Badge className="bg-amber-500 hover:bg-amber-600">Pending Review</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(theme.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <CardTitle className="mt-2 text-xl">{theme.name}</CardTitle>
                <CardDescription>
                  By: {theme.developer?.ActorName || "Unknown"} ({theme.developer?.ActorEmail})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-xs font-mono bg-muted p-2 rounded border">
                  <div>Site: <span className="font-bold">{theme.site_price}</span></div>
                  <div>Global: <span className="font-bold">{theme.global_price}</span></div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full gap-2" 
                  onClick={() => setSelectedTheme(theme)}
                >
                  <Search size={16} /> Audit Code
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* MANUAL CODE AUDITOR MODAL */}
      <Dialog open={!!selectedTheme} onOpenChange={() => setSelectedTheme(null)}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <TerminalSquare className="text-primary" /> Auditing: {selectedTheme?.name}
            </DialogTitle>
            <DialogDescription>
              Check the files below for malicious code (e.g., unauthorized <code>fetch</code> calls, raw <code>&lt;script&gt;</code> tags, or `window.parent` hacks).
            </DialogDescription>
          </DialogHeader>

          <div className="flex-grow overflow-hidden flex flex-col p-6">
            {selectedTheme?.files ? (
              <Tabs defaultValue={Object.keys(selectedTheme.files)[0]} className="flex flex-col h-full">
                <div className="mb-4 max-w-full overflow-x-auto">
                <TabsList className="w-max">
                  {Object.keys(selectedTheme.files).map(filename => (
                    <TabsTrigger key={filename} value={filename}>{filename}</TabsTrigger>
                  ))}
                </TabsList>
                </div>
                
                {Object.entries(selectedTheme.files).map(([filename, code]) => (
                  <TabsContent key={filename} value={filename} className="flex-grow mt-0 h-full">
                    {/* Read-only code viewer */}
                    <div className="w-full h-full bg-zinc-950 text-zinc-300 p-4 rounded-xl overflow-auto font-mono text-xs leading-relaxed custom-scrollbar border border-zinc-800">
                      <pre>
                        <code>{String(code)}</code>
                      </pre>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No files found in this theme.
              </div>
            )}
          </div>

          <DialogFooter className="flex shrink-0 flex-col items-stretch gap-3 border-t bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Button 
              variant="destructive" 
              onClick={() => handleReject(selectedTheme.id)}
              disabled={isRejecting || isCompiling}
            >
              {isRejecting ? <Loader2 className="animate-spin mr-2" /> : <XCircle className="mr-2" size={16} />}
              Reject & Send Back
            </Button>
            
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleApproveAndCompile(selectedTheme.id)}
              disabled={isCompiling || isRejecting}
            >
              {isCompiling ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2" size={16} />}
              {isCompiling ? "Compiling Server-Side..." : "Approve & Compile Theme"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}