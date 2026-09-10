import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  useOutletContext,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import { ActorDashboardContextType } from "@/layouts/ActorDashboardLayout"; "@/features/talent-marketplace";
import { supabase } from "@/supabaseClient";
import Editor, { useMonaco } from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import { Button as UIButton } from "@/components/ui/button";
import { Input as UIInput } from "@/components/ui/input";
import { Label as UILabel } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  UploadCloud,
  Code2,
  AlertTriangle,
  FileCode2,
  FolderTree,
  File,
  Settings2,
  LayoutTemplate,
  Layers,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  BookOpen,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
  Plus,
  Clock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
import { useTheme } from "next-themes";

import * as Babel from "@babel/standalone";
import SdkDocsModal from "@/components/dashboard/SdkDocsModal";

// 🚀 IMPORT THE SDK & UI TYPE DEFINITIONS (AS STRINGS FOR MONACO)
import ucpSdkTypesRaw from "@/lib/ucp-sdk/types.d.ts?raw";
import uiTypesRaw from "@/lib/ucp-sdk/ui.d.ts?raw";

// Default Theme Files
import cupertinoHeaderRaw from "@/themes/cupertino/Header.tsx?raw";
import cupertinoHeroRaw from "@/themes/cupertino/Hero.tsx?raw";
import cupertinoGalleryRaw from "@/themes/cupertino/Gallery.tsx?raw";
import cupertinoContactRaw from "@/themes/cupertino/Contact.tsx?raw";
import cupertinoTeamRaw from "@/themes/cupertino/Team.tsx?raw";
import cupertinoMapRaw from "@/themes/cupertino/Map.tsx?raw";
import cupertinoPricingRaw from "@/themes/cupertino/Pricing.tsx?raw";
import cupertinoLeadFormRaw from "@/themes/cupertino/LeadForm.tsx?raw";
import cupertinoShopRaw from "@/themes/cupertino/Shop.tsx?raw";

const INITIAL_FILES: Record<string, string> = {
  "Header.tsx": cupertinoHeaderRaw,
  "Hero.tsx": cupertinoHeroRaw,
  "Gallery.tsx": cupertinoGalleryRaw,
  "Contact.tsx": cupertinoContactRaw,
  "Team.tsx": cupertinoTeamRaw,
  "Map.tsx": cupertinoMapRaw,
  "Pricing.tsx": cupertinoPricingRaw,
  "LeadForm.tsx": cupertinoLeadFormRaw,
  "Shop.tsx": cupertinoShopRaw,
};

export default function ThemeStudioPage() {
  const { actorData } = useOutletContext<ActorDashboardContextType>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const themeId = searchParams.get("themeId");

  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = mounted && resolvedTheme === "dark";

  const [isLoading, setIsLoading] = useState(true);
  const [themeData, setThemeData] = useState<any>(null);

  const [files, setFiles] = useState<Record<string, string>>(INITIAL_FILES);
  const [activeFile, setActiveFile] = useState<string>("Hero.tsx");
  const [openFiles, setOpenFiles] = useState<string[]>(["Hero.tsx"]);
  const [previewMode, setPreviewMode] = useState<"single" | "full">("single");

  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [isDocsOpen, setIsDocsOpen] = useState(false); 

  const [activeSchema, setActiveSchema] = useState<Record<string, any>>({});
  const [mockData, setMockData] = useState<Record<string, any>>({});
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [fileSearch, setFileSearch] = useState("");
  const [showFileSearchDropdown, setShowFileSearchDropdown] = useState(false);

  // 🚀 TEST SITE SELECTION STATE
  const [selectedTestSiteId, setSelectedTestSiteId] = useState<string | null>(null);

  const monaco = useMonaco();

  // 🚀 FORCE MONACO TO UPDATE ITS GLOBAL THEME WHEN DARK MODE TOGGLES
  useEffect(() => {
    if (monaco) {
      monaco.editor.setTheme(isDark ? "ucp-dark" : "ucp-light");
    }
  }, [monaco, isDark]);

  // 🚀 FETCH THE DEVELOPER'S EXISTING SITES TO USE AS TEST DATA
  const { data: testSites = [] } = useQuery({
    queryKey: ["developerTestSites", actorData?.id],
    queryFn: async () => {
      if (!actorData?.id) return [];
      const { data } = await supabase
        .from("portfolios")
        .select("id, site_name")
        .eq("actor_id", actorData.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!actorData?.id,
  });

  // Auto-select the first site if none is selected
  useEffect(() => {
    if (testSites.length > 0 && !selectedTestSiteId) {
      setSelectedTestSiteId(testSites[0].id);
    }
  }, [testSites, selectedTestSiteId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchTheme = async () => {
      if (!actorData?.id) return;
      
      if (!themeId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from("marketplace_themes")
        .select("*")
        .eq("id", themeId)
        .eq("developer_id", actorData.id)
        .single();

      if (error) {
        alert("Theme not found or access denied.");
        navigate("/dashboard/creator-hub");
        return;
      }

      setThemeData(data);
      
      const fetchedFiles = data.files || {};
      const mergedFiles = { ...fetchedFiles };
      let missingFilesAdded = false;

      Object.keys(INITIAL_FILES).forEach(filename => {
          if (!mergedFiles[filename]) {
              mergedFiles[filename] = INITIAL_FILES[filename];
              missingFilesAdded = true;
          }
      });

      setFiles(mergedFiles);

      if (missingFilesAdded) {
          setHasUnsavedChanges(true);
      }

      setIsLoading(false);
    };

    fetchTheme();
  }, [themeId, actorData?.id, navigate]);

  // 🚀 FETCH THE DEVELOPER'S RECENT THEMES FOR THE HOME VIEW
  const { data: recentThemes = [], isLoading: isLoadingRecent } = useQuery({
    queryKey: ["recent_themes", actorData?.id],
    queryFn: async () => {
      if (!actorData?.id) return [];
      const { data } = await supabase
        .from("marketplace_themes")
        .select("id, name, status, updated_at")
        .eq("developer_id", actorData.id)
        .order("updated_at", { ascending: false });
      return data || [];
    },
    enabled: !themeId && !!actorData?.id,
  });

  useEffect(() => {
    if (!hasUnsavedChanges || !themeId || isLoading) return;

    const autoSaveTimer = setTimeout(async () => {
      setIsSaving(true);

      const { error } = await supabase
        .from("marketplace_themes")
        .update({
          files: files,
          updated_at: new Date().toISOString(),
        })
        .eq("id", themeId);

      if (!error) {
        setHasUnsavedChanges(false);
      } else {
        console.error("Failed to auto-save:", error);
      }
      setIsSaving(false);
    }, 1500);

    return () => clearTimeout(autoSaveTimer);
  }, [files, hasUnsavedChanges, themeId, isLoading]);

  const handleOpenFile = (filename: string) => {
    if (!openFiles.includes(filename)) {
      setOpenFiles((prev) => [...prev, filename]);
    }
    setActiveFile(filename);
    setPreviewMode("single");
  };

  const handleCloseFile = (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    const newOpenFiles = openFiles.filter((f) => f !== filename);
    setOpenFiles(newOpenFiles);
    if (activeFile === filename) {
      setActiveFile(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : "");
    }
  };

  const handleCompileAndRun = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    setIsCompiling(true);
    setCompileError(null);

    setTimeout(() => {
      try {
        if (previewMode === "single") {
          if (!activeFile || !files[activeFile]) return;
          const result = Babel.transform(files[activeFile], {
            presets: ["react", "env", "typescript"],
            filename: activeFile,
          });
          
          iframeRef.current?.contentWindow?.postMessage(
            { 
              type: "EXECUTE_CODE", 
              code: result?.code,
              activeFile: activeFile // Send filename so the iframe knows which section data to pull
            },
            "*"
          );
        } else {
          const bundle: Record<string, string> = {};
          const order = ["Header.tsx", "Hero.tsx", "Footer.tsx"];
          const allKeys = [...new Set([...order, ...Object.keys(files)])];

          allKeys.forEach((filename) => {
            if (files[filename]) {
              const result = Babel.transform(files[filename], {
                presets: ["react", "env", "typescript"],
                filename,
              });
              if (result?.code) bundle[filename] = result.code;
            }
          });

          iframeRef.current?.contentWindow?.postMessage(
            { type: "EXECUTE_BUNDLE", bundle },
            "*"
          );
        }
      } catch (err: any) {
        setCompileError(err.message);
      } finally {
        setIsCompiling(false);
      }
    }, 50);
  }, [files, activeFile, previewMode]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // 🚀 Listen for the iframe telling us it has loaded the real React environment
      if (e.data.type === "PREVIEW_READY") {
         handleCompileAndRun();
      }

      if (e.data.type === "SCHEMA_PARSED") {
        const schema = e.data.schema;
        const testData = e.data.testData || {};
        setActiveSchema(schema);
        
        const initialData: Record<string, any> = { ...testData };
        Object.keys(schema).forEach((key) => {
          if (initialData[key] === undefined) {
             initialData[key] = schema[key].default || "";
          }
        });
        
        setMockData(initialData);
      }

      if (e.data.type === "FULL_PAGE_READY") {
        setActiveSchema({});
      }

      if (e.data.type === "UCP_INLINE_EDIT") {
        setMockData((prev) => {
          const newData = { ...prev, [e.data.field]: e.data.value };
          updateIframeProps(newData); 
          return newData;
        });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleCompileAndRun]);

  const updateIframeProps = (newData: Record<string, any>) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "UPDATE_PROPS", props: newData },
        "*"
      );
    }
  };

  const handleEditorWillMount = (m: any) => {
    // 🚀 1. DEFINE CUSTOM THEMES MATCHING OUR TAILWIND ZINC PALETTE
    m.editor.defineTheme('ucp-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#09090b', // zinc-950
        'editor.lineHighlightBackground': '#18181b', // zinc-900
        'editorLineNumber.foreground': '#52525b', // zinc-500
        'editorIndentGuide.background1': '#27272a', // zinc-800
        'editor.selectionBackground': '#3f3f4650', // zinc-700
      }
    });

    m.editor.defineTheme('ucp-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff', // white
        'editor.lineHighlightBackground': '#f4f4f5', // zinc-100
        'editorLineNumber.foreground': '#a1a1aa', // zinc-400
        'editorIndentGuide.background1': '#e4e4e7', // zinc-200
      }
    });

    const ts = m.languages.typescript as any;
    ts.typescriptDefaults.setCompilerOptions({
      jsx: ts.JsxEmit.React,
      jsxFactory: "React.createElement",
      reactNamespace: "React",
      allowNonTsExtensions: true,
      allowJs: true,
      target: ts.ScriptTarget.Latest,
    });
    ts.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
    
    // Inject custom SDK types
    ts.typescriptDefaults.addExtraLib(ucpSdkTypesRaw, 'file:///node_modules/@types/ucp-sdk/index.d.ts');
    ts.typescriptDefaults.addExtraLib(uiTypesRaw, 'file:///node_modules/@types/ucp-ui/index.d.ts');

    // 🚀 FIX: Placed thirdPartyMocks INSIDE handleEditorWillMount so `ts` is in scope
    const thirdPartyMocks = `
      declare module 'framer-motion' { export const motion: any; export const AnimatePresence: any; }
      declare module 'lucide-react' { export const Menu: any; export const Loader2: any; export const X: any; export const Check: any; export const ArrowRight: any; export const ChevronRight: any; export const ChevronLeft: any; }
      declare module 'recharts' { export const LineChart: any; export const ResponsiveContainer: any; export const Line: any; export const XAxis: any; export const YAxis: any; export const Tooltip: any; }
      declare module 'date-fns' { export const format: any; export const parseISO: any; }
      declare module 'canvas-confetti' { const confetti: any; export default confetti; }
    `;
    ts.typescriptDefaults.addExtraLib(thirdPartyMocks, 'file:///node_modules/@types/third-party/index.d.ts');
  };

  const handleEditorDidMount = (editor: any, m: any) => {
    // 🚀 ADD CMD+S / CTRL+S SHORTCUT TO COMPILE & RUN
    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, () => {
      handleCompileAndRun();
    });
  };

  const handlePropChange = (key: string, value: string | boolean) => {
    const newData = { ...mockData, [key]: value };
    setMockData(newData);
    updateIframeProps(newData);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!activeFile) return;
    setFiles((prev) => ({ ...prev, [activeFile]: value || "" }));
    setHasUnsavedChanges(true);
  };

  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => handleCompileAndRun(), 300);
    return () => clearTimeout(timer);
  }, [activeFile, previewMode, isLoading, handleCompileAndRun, selectedTestSiteId]); // Re-compile if site changes

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!themeId) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)] w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 p-4 md:p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto w-full space-y-8 mt-4 md:mt-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">Theme Studio</h1>
              <p className="text-zinc-600 dark:text-zinc-400 text-lg">Select an existing theme to continue editing.</p>
            </div>
            <UIButton onClick={() => navigate("/dashboard/creator-hub")} className="bg-indigo-600 hover:bg-indigo-500 font-bold h-11 px-6 shadow-lg shadow-indigo-500/20">
              <Plus className="mr-2 w-5 h-5" /> Create New Theme
            </UIButton>
          </div>

          {isLoadingRecent ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
          ) : recentThemes.length === 0 ? (
            <div className="text-center py-20 bg-zinc-100/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/50 rounded-3xl">
              <Code2 size={48} className="mx-auto text-zinc-400 dark:text-zinc-600 mb-4 opacity-50" />
              <h3 className="font-bold text-xl mb-2">No themes found</h3>
              <p className="text-zinc-500 mb-6 max-w-sm mx-auto">You haven't created any themes yet. Head over to the Creator Hub to start building.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentThemes.map((theme: any) => (
                <div 
                  key={theme.id}
                  onClick={() => navigate(`/dashboard/studio?themeId=${theme.id}`)}
                  className="bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 p-6 rounded-2xl cursor-pointer transition-all duration-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80 hover:shadow-[0_0_30px_rgba(99,102,241,0.1)] group flex flex-col h-40"
                >
                  <div className="flex justify-between items-start mb-auto">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all">
                      <LayoutTemplate size={24} />
                    </div>
                    <Badge variant="outline" className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider">
                      {theme.status}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1 truncate">{theme.name}</h3>
                    <p className="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
                      <Clock size={12} /> {new Date(theme.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 overflow-hidden">
      {/* --- STUDIO TOPBAR --- */}
      <div className="min-h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 flex flex-wrap items-center justify-between gap-2 px-2 py-2 sm:px-4 shrink-0 shadow-sm z-10 relative backdrop-blur-md">
        <div className="flex items-center gap-3">
          <UIButton
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            onClick={() => navigate("/dashboard/creator-hub")}
          >
            <ArrowLeft size={16} />
          </UIButton>
          <UIButton
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            onClick={() => setIsExplorerOpen(!isExplorerOpen)}
            title="Toggle Explorer"
          >
            {isExplorerOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </UIButton>
          <div className="h-8 w-8 bg-indigo-500/20 border border-indigo-500/30 rounded-md flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Code2 size={18} />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight flex items-center gap-2">
              {themeData?.name || "Theme Studio"}
              <Badge variant="outline" className="text-[10px] h-5 border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                {themeData?.status || "Draft"}
              </Badge>
            </h1>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-1">
              <FolderTree size={10} /> src/components
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />

          {/* 🚀 NEW: TEST SITE SELECTOR */}
          <div className="flex items-center gap-2 border-r border-zinc-200 dark:border-zinc-800 pr-4">
            <Globe size={14} className="text-zinc-500" />
            <Select value={selectedTestSiteId || ""} onValueChange={setSelectedTestSiteId}>
              <SelectTrigger className="h-8 w-[180px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-xs font-medium">
                <SelectValue placeholder="Select Test Site" />
              </SelectTrigger>
              <SelectContent>
                {testSites.map(site => (
                  <SelectItem key={site.id} value={site.id} className="text-xs font-medium">
                    {site.site_name || "Untitled Site"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-1.5">
            {isSaving ? (
              <><Loader2 size={12} className="animate-spin" /> Saving...</>
            ) : hasUnsavedChanges ? (
              <><Cloud size={12} /> Unsaved</>
            ) : (
              <><CheckCircle2 size={12} className="text-emerald-500" /> Saved</>
            )}
          </div>
          
          <UIButton variant="ghost" size="sm" className="h-8 px-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => setIsDocsOpen(true)} aria-label="Open SDK documentation">
            <BookOpen size={14} className="sm:mr-2" /> <span className="hidden sm:inline">SDK Docs</span>
          </UIButton>

          <UIButton size="sm" className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold" aria-label="Publish theme request">
            <UploadCloud size={14} className="sm:mr-2" /> <span className="hidden sm:inline">Publish Request</span>
          </UIButton>
        </div>
      </div>

      {/* --- STUDIO WORKSPACE --- */}
      <div className="flex flex-grow overflow-hidden">
        {/* LEFT: Explorer */}
        <div 
          className={cn(
            "bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0 transition-all duration-300 overflow-hidden",
            isExplorerOpen ? "w-64" : "w-0 border-r-0"
          )}
        >
          <div className="h-8 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest bg-zinc-100/50 dark:bg-zinc-900/50 shrink-0 whitespace-nowrap">
            <span>Explorer</span>
          </div>
          <div className="flex-grow overflow-y-auto py-2">
            {Object.keys(files).map((filename) => {
              const isUntouched = files[filename] === INITIAL_FILES[filename];

              return (
              <button
                type="button"
                key={filename}
                onClick={() => handleOpenFile(filename)}
                className={cn(
                  "flex items-center justify-between px-6 py-1.5 cursor-pointer text-sm font-mono transition-colors border-l-2 whitespace-nowrap",
                  activeFile === filename && previewMode === "single"
                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200 border-transparent"
                )}
              >
                <div className="flex items-center gap-2">
                  <FileCode2 size={14} className={activeFile === filename && previewMode === "single" ? "text-indigo-500 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-500"} />
                  {filename}
                </div>
                {isUntouched && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-[8px] px-1 py-0 border-none h-4">NEW</Badge>
                )}
              </button>
            )})}
          </div>
        </div>

        {/* MIDDLE: Monaco */}
        <div className="flex-grow h-full border-r border-zinc-200 dark:border-zinc-800 flex flex-col relative min-w-0">
          {/* TABS BAR */}
          <div className="flex bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto no-scrollbar shrink-0">
            {openFiles.map((filename) => (
              <button
                type="button"
                key={filename}
                onClick={() => handleOpenFile(filename)}
                className={cn(
                  "flex items-center gap-2 px-4 h-10 min-w-fit cursor-pointer border-r border-zinc-200 dark:border-zinc-800 transition-colors text-sm font-mono group select-none",
                  activeFile === filename 
                    ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-300 border-t-2 border-t-indigo-500" 
                    : "bg-zinc-50 dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-300 border-t-2 border-t-transparent"
                )}
              >
                <FileCode2 size={14} className={activeFile === filename ? "text-indigo-500 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-500"} />
                {filename}
                <span
                  role="button"
                  aria-label={`Close ${filename}`}
                  onClick={(e) => handleCloseFile(e, filename)}
                  className={cn(
                    "ml-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700/50 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                    activeFile === filename && "opacity-100"
                  )}
                >
                  <X size={14} />
                </span>
              </button>
            ))}
            {openFiles.length === 0 && (
              <div className="h-10 flex items-center px-4 text-xs font-mono text-zinc-600">No open files</div>
            )}
          </div>

          {/* SEARCH BAR */}
          <div className="h-8 bg-zinc-100/50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 relative shrink-0">
            <Search size={12} className="text-zinc-400 dark:text-zinc-500 mr-2 shrink-0" />
            <input
              type="text"
              placeholder={activeFile ? `Search files (currently editing ${activeFile})...` : "Search files..."}
              className="bg-transparent text-xs text-zinc-900 dark:text-zinc-200 outline-none w-full placeholder:text-zinc-500 dark:placeholder:text-zinc-600 font-mono"
              value={fileSearch}
              onChange={(e) => {
                setFileSearch(e.target.value);
                setShowFileSearchDropdown(true);
              }}
              onFocus={() => setShowFileSearchDropdown(true)}
              onBlur={() => setTimeout(() => setShowFileSearchDropdown(false), 200)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowFileSearchDropdown(false);
                  e.currentTarget.blur();
                }
              }}
            />
            {showFileSearchDropdown && fileSearch && (
              <div className="absolute top-10 left-0 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xl z-50 max-h-64 overflow-y-auto rounded-b-lg">
                {Object.keys(files)
                  .filter((f) => f.toLowerCase().includes(fileSearch.toLowerCase()))
                  .map((f) => (
                    <div
                      key={f}
                      className="px-4 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer text-sm font-mono text-zinc-700 dark:text-zinc-300 flex items-center gap-3 transition-colors border-l-2 border-transparent hover:border-indigo-500"
                      onClick={() => {
                        handleOpenFile(f);
                        setFileSearch("");
                        setShowFileSearchDropdown(false);
                      }}
                    >
                      <FileCode2 size={14} /> {f}
                    </div>
                  ))}
                {Object.keys(files).filter((f) => f.toLowerCase().includes(fileSearch.toLowerCase())).length === 0 && (
                  <div className="px-4 py-3 text-sm text-zinc-500 font-mono">No files found matching "{fileSearch}".</div>
                )}
              </div>
            )}
          </div>
          <div className="flex-grow relative">
            {activeFile ? (
              <Editor
                height="100%"
                path={activeFile}
                language={activeFile.endsWith(".tsx") || activeFile.endsWith(".ts") ? "typescript" : "javascript"}
                theme={isDark ? "ucp-dark" : "ucp-light"}
                value={files[activeFile]}
                onChange={handleEditorChange}
                beforeMount={handleEditorWillMount}
                onMount={handleEditorDidMount}
                options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: "on", formatOnPaste: true, padding: { top: 16 }, fontFamily: "JetBrains Mono, monospace" }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-950">
                <Code2 size={64} className="mb-4 opacity-10" />
                <p className="text-sm font-mono">Select a file from the explorer to start editing</p>
              </div>
            )}
            {compileError && (
              <div className="absolute bottom-4 left-4 right-4 bg-red-50/90 dark:bg-red-950/90 border border-red-500/50 p-3 rounded-lg shadow-xl backdrop-blur-md z-10">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={16} />
                  <div className="text-red-800 dark:text-red-200 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed overflow-auto max-h-32">
                    {compileError}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Preview */}
        <div className="w-[45%] xl:w-[40%] h-full flex flex-col shrink-0 bg-zinc-100 dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800">
          <div className="h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 shrink-0 bg-zinc-50 dark:bg-zinc-900">
            <div className="flex bg-zinc-200 dark:bg-zinc-950 rounded-lg p-1 border border-zinc-300 dark:border-zinc-800">
              <UIButton size="sm" variant="ghost" className={cn("h-7 px-3 text-xs", previewMode === "single" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white")} onClick={() => setPreviewMode("single")}>
                <LayoutTemplate size={14} className="mr-1.5" /> Component
              </UIButton>
              <UIButton size="sm" variant="ghost" className={cn("h-7 px-3 text-xs", previewMode === "full" ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white")} onClick={() => setPreviewMode("full")}>
                <Layers size={14} className="mr-1.5" /> Full Page
              </UIButton>
            </div>
            <UIButton size="sm" variant="ghost" className="h-8 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white" onClick={handleCompileAndRun}>
              <Play size={14} className="mr-1.5" /> Refresh
            </UIButton>
          </div>

          <div className={cn("flex flex-col min-h-0 relative transition-all duration-300", previewMode === "single" ? "flex-1 border-b border-zinc-200 dark:border-zinc-800" : "h-full")}>
            <div className="flex-grow bg-zinc-100/50 dark:bg-zinc-950/50 relative overflow-hidden flex items-center justify-center p-4">
              
              {/* 🚀 THE REAL ROUTE IFRAME */}
              <iframe
                ref={iframeRef}
                src={`/studio-preview?portfolioId=${selectedTestSiteId || ''}`}
                className={cn(
                  "bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-500",
                  previewMode === "full" ? "w-full h-full rounded-md" : "w-full max-w-2xl h-[500px] rounded-xl"
                )}
                title="Live Sandbox"
                // allow-scripts is sufficient when pointing to a local route
              />

            </div>
          </div>

          {previewMode === "single" && (
            <div className="flex-[0.8] flex flex-col bg-white dark:bg-zinc-900 shrink-0 min-h-0">
              <div className="h-8 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 text-[11px] font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-widest gap-2 bg-indigo-50 dark:bg-indigo-500/5 shrink-0">
                <Settings2 size={12} /> Section Editor Test
              </div>
              <div className="flex-grow overflow-y-auto p-4 custom-scrollbar space-y-4">
                {Object.keys(activeSchema).length === 0 ? (
                  <div className="text-center text-zinc-500 text-sm mt-8 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-6">
                    No <code>.schema</code> object found.
                  </div>
                ) : (
                  Object.entries(activeSchema).map(([key, field]) => (
                    <div key={key} className="space-y-1.5">
                      <UILabel className="text-xs text-zinc-700 dark:text-zinc-300 font-bold uppercase tracking-wider">
                        {field.label}
                      </UILabel>

                      {field.type === "string" && (
                        <UIInput
                          value={mockData[key] || ""}
                          onChange={(e) => handlePropChange(key, e.target.value)}
                          className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-sm h-9 text-zinc-900 dark:text-zinc-100"
                        />
                      )}

                      {field.type === "toggle" && (
                        <div className="flex items-center h-9">
                          <input type="checkbox" checked={mockData[key] !== undefined ? mockData[key] : field.default || false} onChange={(e) => handlePropChange(key, e.target.checked)} className="w-4 h-4 cursor-pointer" />
                        </div>
                      )}

                      {field.type === "select" && (
                        <select
                          value={mockData[key] || field.default}
                          onChange={(e) => handlePropChange(key, e.target.value)}
                          className="flex h-9 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm transition-colors text-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                        >
                          {field.options?.map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}

                      {field.type === "color" && (
                        <div className="flex items-center gap-3">
                          <input type="color" value={mockData[key] || "#000000"} onChange={(e) => handlePropChange(key, e.target.value)} className="w-8 h-8 rounded border border-zinc-300 dark:border-zinc-700 cursor-pointer p-0" />
                          <UIInput value={mockData[key] || ""} onChange={(e) => handlePropChange(key, e.target.value)} className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 font-mono text-xs h-9 uppercase text-zinc-900 dark:text-zinc-100" />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <SdkDocsModal isOpen={isDocsOpen} onOpenChange={setIsDocsOpen} />
    </div>
  );
}