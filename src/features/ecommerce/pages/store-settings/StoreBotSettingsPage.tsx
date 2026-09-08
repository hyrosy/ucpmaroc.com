import React, { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import { Bot, MessageCircle, Save, Phone, Sparkles, ChevronLeft, Eye, Plus, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import StorefrontChatWidget from '@/features/ecommerce/components/store-chat/StorefrontChatWidget';
import { ActorDashboardContextType } from '@/layouts/ActorDashboardLayout';

interface SuggestedQuestion {
    question: string;
    answer: string;
}

type ThemeConfig = Record<string, unknown>;

export default function StoreBotSettingsPage() {
    const [searchParams] = useSearchParams();
    const queryPortfolioId = searchParams.get('portfolioId');
    const { actorData } = useOutletContext<ActorDashboardContextType>();
    const [portfolios, setPortfolios] = useState<Array<{ id: string; site_name: string | null; theme_config: ThemeConfig | null }>>([]);
    const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [config, setConfig] = useState({
        store_chat_enabled: false,
        store_chat_mode: 'internal',
        store_chat_whatsapp_number: '',
        store_chat_welcome_message: 'Hi! 👋 How can we help you today?',
        store_chat_ai_assistant: false,
        store_chat_ai_prompt: '',
        store_chat_marketing_optin: false,
        store_chat_marketing_coupon: '',
        store_chat_icon_type: 'message',
        store_chat_custom_icon_url: '',
        store_chat_suggested_questions: [] as { question: string, answer: string }[]
    });

    useEffect(() => {
        const fetchPortfolios = async () => {
            setLoading(true);
            if (!actorData?.id) return;

            const { data } = await supabase.from('portfolios').select('id, site_name, theme_config').eq('actor_id', actorData.id);
            if (data && data.length > 0) {
                setPortfolios(data);
                
                if (queryPortfolioId && data.some(p => p.id === queryPortfolioId)) {
                    // Auto-open if navigating from a specific builder page
                    setActivePortfolioId(queryPortfolioId);
                    const targetPortfolio = data.find(p => p.id === queryPortfolioId);
                    if (targetPortfolio) loadConfig(targetPortfolio.theme_config);
                } else if (data.length === 1) {
                    // Auto-open if they only have 1 store
                    setActivePortfolioId(data[0].id);
                    loadConfig(data[0].theme_config);
                } else {
                    // Show grid of bot cards
                    setActivePortfolioId(null);
                }
            } else {
                setPortfolios([]);
            }
            setLoading(false);
        };
        if (actorData?.id) fetchPortfolios();
    }, [queryPortfolioId, actorData?.id]);

    const loadConfig = (themeConfig: ThemeConfig | null) => {
        const getString = (key: string, fallback: string) => typeof themeConfig?.[key] === 'string' ? themeConfig[key] as string : fallback;
        const getBoolean = (key: string, fallback: boolean) => typeof themeConfig?.[key] === 'boolean' ? themeConfig[key] as boolean : fallback;
        const suggestedQuestions = Array.isArray(themeConfig?.store_chat_suggested_questions) ? themeConfig.store_chat_suggested_questions : [];
        setConfig({
            store_chat_enabled: getBoolean('store_chat_enabled', false),
            store_chat_mode: getString('store_chat_mode', 'internal'),
            store_chat_whatsapp_number: getString('store_chat_whatsapp_number', ''),
            store_chat_welcome_message: getString('store_chat_welcome_message', 'Hi! 👋 How can we help you today?'),
            store_chat_ai_assistant: getBoolean('store_chat_ai_assistant', false),
            store_chat_ai_prompt: getString('store_chat_ai_prompt', ''),
            store_chat_marketing_optin: getBoolean('store_chat_marketing_optin', false),
            store_chat_marketing_coupon: getString('store_chat_marketing_coupon', ''),
            store_chat_icon_type: getString('store_chat_icon_type', 'message'),
            store_chat_custom_icon_url: getString('store_chat_custom_icon_url', ''),
            store_chat_suggested_questions: suggestedQuestions.map((q): SuggestedQuestion => typeof q === 'string' ? { question: q, answer: '' } : q as SuggestedQuestion)
        });
    };

    const handleSave = async () => {
        if (!activePortfolioId) return; // Safeguard against 400 Bad Request error

        setSaving(true);
        const p = portfolios.find(x => x.id === activePortfolioId);
        
        const updatedThemeConfig = {
            ...(p?.theme_config || {}),
            ...config
        };

        const { error } = await supabase
            .from('portfolios')
            .update({ theme_config: updatedThemeConfig })
            .eq('id', activePortfolioId);

        if (error) {
            toast.error("Failed to save settings.");
        } else {
            toast.success("Chat widget settings updated!");
            // Update local state
            setPortfolios(prev => prev.map(port => port.id === activePortfolioId ? { ...port, theme_config: updatedThemeConfig } : port));
        }
        setSaving(false);
    };

    if (loading) return <div className="p-8 text-muted-foreground">Loading settings...</div>;

    // --- 1. The Bot Cards Dashboard (Master View) ---
    if (!activePortfolioId) {
        return (
            <div className="max-w-6xl mx-auto space-y-8 p-4 md:p-8 pb-24">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Live Chat & Bots</h1>
                    <p className="text-muted-foreground">Select a store to configure its chat bot and routing settings.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {portfolios.map(p => {
                        const tc = p.theme_config || {};
                        const isEnabled = tc.store_chat_enabled ?? false;
                        const mode = tc.store_chat_mode ?? 'internal';
                        const aiEnabled = tc.store_chat_ai_assistant ?? false;
                        
                        return (
                            <Card 
                                key={p.id} 
                                className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                                onClick={() => {
                                    setActivePortfolioId(p.id);
                                    loadConfig(tc);
                                }}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{p.site_name || 'My Store'}</div>
                                        <div className={`p-2 rounded-full ${isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                            <Bot size={20} />
                                        </div>
                                    </div>
                                    <div className="space-y-3 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
                                            <span className="font-medium text-foreground">{isEnabled ? 'Chat Enabled' : 'Chat Disabled'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MessageCircle className="w-4 h-4" />
                                            {mode === 'whatsapp' ? 'WhatsApp Routing' : 'Platform Inbox'}
                                        </div>
                                        {mode === 'internal' && (
                                            <div className="flex items-center gap-2">
                                                <Sparkles className={`w-4 h-4 ${aiEnabled ? 'text-indigo-500' : ''}`} />
                                                AI Auto-Reply: {aiEnabled ? <span className="text-indigo-600 dark:text-indigo-400 font-medium">Active</span> : 'Off'}
                                            </div>
                                        )}
                                    </div>
                                    <Button variant="secondary" className="w-full mt-6 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                        Manage Bot
                                    </Button>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>
        );
    }

    // --- 2. The Configuration Panel (Detail View) ---
    const selectedStore = portfolios.find(p => p.id === activePortfolioId);

    return (
        <div className="max-w-6xl mx-auto space-y-8 p-4 md:p-6 pb-24">
            <div className="flex flex-col gap-4">
                {portfolios.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => setActivePortfolioId(null)} className="w-fit -ml-3 text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="w-4 h-4 mr-1" /> Back to all bots
                    </Button>
                )}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        {selectedStore?.site_name || 'My Store'} <Bot className="h-6 w-6 text-primary" />
                    </h1>
                    <p className="text-muted-foreground">Configure how customers communicate with this store.</p>
                </div>
            </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm space-y-8">
                <div className="flex items-center justify-between border-b pb-6">
                    <div>
                        <h3 className="font-semibold flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /> Enable Storefront Chat</h3>
                        <p className="text-sm text-muted-foreground mt-1">Show a floating chat bubble on your live store.</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                        <input type="checkbox" className="sr-only peer" checked={config.store_chat_enabled} onChange={e => setConfig({...config, store_chat_enabled: e.target.checked})} />
                        <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>

                <div className={`space-y-6 transition-opacity ${!config.store_chat_enabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <div className="space-y-3">
                        <Label>Routing Mode</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-4 transition-colors ${config.store_chat_mode === 'internal' ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted'}`}>
                                <input type="radio" className="sr-only" checked={config.store_chat_mode === 'internal'} onChange={() => setConfig({...config, store_chat_mode: 'internal'})} />
                                <MessageCircle className="h-5 w-5" /> Platform Inbox
                            </label>
                            <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-4 transition-colors ${config.store_chat_mode === 'whatsapp' ? 'border-green-500 bg-green-500/5 text-green-600' : 'hover:bg-muted'}`}>
                                <input type="radio" className="sr-only" checked={config.store_chat_mode === 'whatsapp'} onChange={() => setConfig({...config, store_chat_mode: 'whatsapp'})} />
                                <Phone className="h-5 w-5" /> WhatsApp
                            </label>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        <Label>Chat Bubble Icon</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-colors ${config.store_chat_icon_type === 'message' ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted'}`}>
                                <input type="radio" className="sr-only" checked={config.store_chat_icon_type === 'message'} onChange={() => setConfig({...config, store_chat_icon_type: 'message'})} />
                                <MessageCircle className="h-6 w-6" />
                                <span className="text-xs font-semibold">Message</span>
                            </label>
                            <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-colors ${config.store_chat_icon_type === 'bot' ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted'}`}>
                                <input type="radio" className="sr-only" checked={config.store_chat_icon_type === 'bot'} onChange={() => setConfig({...config, store_chat_icon_type: 'bot'})} />
                                <Bot className="h-6 w-6" />
                                <span className="text-xs font-semibold">Bot</span>
                            </label>
                            <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-colors ${config.store_chat_icon_type === 'sparkles' ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted'}`}>
                                <input type="radio" className="sr-only" checked={config.store_chat_icon_type === 'sparkles'} onChange={() => setConfig({...config, store_chat_icon_type: 'sparkles'})} />
                                <Sparkles className="h-6 w-6" />
                                <span className="text-xs font-semibold">Sparkles</span>
                            </label>
                            <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-colors ${config.store_chat_icon_type === 'custom' ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted'}`}>
                                <input type="radio" className="sr-only" checked={config.store_chat_icon_type === 'custom'} onChange={() => setConfig({...config, store_chat_icon_type: 'custom'})} />
                                <div className="h-8 w-8 flex items-center justify-center overflow-visible">
                                   {config.store_chat_custom_icon_url ? <img src={config.store_chat_custom_icon_url} className="w-full h-full object-contain"/> : <span className="text-[10px] font-bold text-muted-foreground opacity-50">PNG</span>}
                                </div>
                                <span className="text-xs font-semibold">Custom</span>
                            </label>
                        </div>
                        {config.store_chat_icon_type === 'custom' && (
                            <div className="mt-4 space-y-2 animate-in fade-in zoom-in-95">
                                <Label className="text-xs">Custom Icon Image URL (PNG/JPG)</Label>
                                <Input placeholder="https://example.com/my-icon.png" value={config.store_chat_custom_icon_url} onChange={(e) => setConfig({...config, store_chat_custom_icon_url: e.target.value})} />
                                <p className="text-[10px] text-muted-foreground">For best results, use a square transparent PNG. The icon will render with no background or border.</p>
                            </div>
                        )}
                    </div>

                    {config.store_chat_mode === 'whatsapp' && (
                        <div className="space-y-2">
                            <Label>WhatsApp Number (Include Country Code)</Label>
                            <Input placeholder="e.g. +212600000000" value={config.store_chat_whatsapp_number} onChange={e => setConfig({...config, store_chat_whatsapp_number: e.target.value})} />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Welcome Message</Label>
                        <Input placeholder="Hi! 👋 How can we help you today?" value={config.store_chat_welcome_message} onChange={e => setConfig({...config, store_chat_welcome_message: e.target.value})} />
                    </div>

                    <div className="space-y-3 pt-2">
                         <Label>Suggested Questions & Pre-defined Answers</Label>
                         <p className="text-xs text-muted-foreground mt-1 mb-2">Provide clickable conversation starters and instant answers (e.g. FAQs).</p>
                         <div className="space-y-3">
                             {config.store_chat_suggested_questions.map((q, i) => (
                             <details key={i} className="group bg-muted/30 rounded-xl border [&_summary::-webkit-details-marker]:hidden" open={i === config.store_chat_suggested_questions.length - 1}>
                                 <summary className="flex items-center justify-between p-3 cursor-pointer list-none select-none">
                                     <div className="flex items-center gap-2">
                                        <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
                                        <span className="text-[10px] font-bold uppercase text-muted-foreground">FAQ #{i + 1} {q.question ? `- ${q.question.substring(0, 20)}...` : ''}</span>
                                     </div>
                                     <Button variant="ghost" size="icon" onClick={(e) => {
                                         e.preventDefault();
                                         const newQs = config.store_chat_suggested_questions.filter((_, idx) => idx !== i);
                                         setConfig({...config, store_chat_suggested_questions: newQs});
                                     }} className="text-muted-foreground hover:text-red-500 h-6 w-6 shrink-0"><X className="w-3 h-3" /></Button>
                                 </summary>
                                 <div className="p-3 pt-0 flex flex-col gap-3 border-t mt-1 border-border/50">
                                     <Input value={q.question} onChange={(e) => {
                                         const newQs = [...config.store_chat_suggested_questions];
                                         newQs[i].question = e.target.value;
                                         setConfig({...config, store_chat_suggested_questions: newQs});
                                     }} placeholder="Question (e.g. Do you ship internationally?)" className="bg-background h-9 text-sm mt-2" />
                                     <Input value={q.answer || ''} onChange={(e) => {
                                         const newQs = [...config.store_chat_suggested_questions];
                                         newQs[i].answer = e.target.value;
                                         setConfig({...config, store_chat_suggested_questions: newQs});
                                     }} placeholder="Answer (Optional: AI will handle if blank)" className="bg-background h-9 text-sm" />
                                 </div>
                             </details>
                             ))}
                             {config.store_chat_suggested_questions.length < 4 && (
                                 <Button variant="outline" size="sm" onClick={() => setConfig({...config, store_chat_suggested_questions: [...config.store_chat_suggested_questions, { question: '', answer: '' }]})} className="text-xs h-8">
                                     <Plus className="w-3 h-3 mr-1" /> Add Question
                                 </Button>
                             )}
                         </div>
                    </div>

                    {config.store_chat_mode === 'internal' && (
                        <div className="flex flex-col gap-4 rounded-xl bg-indigo-500/5 p-5 border border-indigo-500/20 text-indigo-950 dark:text-indigo-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-semibold flex items-center gap-2"><Bot className="h-4 w-4" /> Enable AI Auto-Reply</h4>
                                    <p className="text-sm opacity-80 mt-1">The bot will automatically answer customer questions.</p>
                                </div>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input type="checkbox" className="sr-only peer" checked={config.store_chat_ai_assistant} onChange={e => setConfig({...config, store_chat_ai_assistant: e.target.checked})} />
                                    <div className="w-11 h-6 bg-indigo-900/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                            <div className={`space-y-3 transition-opacity ${!config.store_chat_ai_assistant ? 'opacity-50 pointer-events-none hidden' : 'opacity-100 block'}`}>
                                <Label className="text-indigo-900 dark:text-indigo-200">AI System Prompt (Bot Personality & Knowledge)</Label>
                                <textarea 
                                    className="flex min-h-[100px] w-full rounded-md border border-indigo-500/30 bg-background/50 px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                    placeholder="e.g. You are a polite customer support agent for my brand. Always speak in French or English. You can offer a 10% discount using code WELCOME10..."
                                    value={config.store_chat_ai_prompt || ''} 
                                    onChange={e => setConfig({...config, store_chat_ai_prompt: e.target.value})} 
                                />
                            </div>
                            <div className={`space-y-4 pt-4 border-t border-indigo-500/20 transition-opacity ${!config.store_chat_ai_assistant ? 'hidden' : 'block'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h5 className="font-semibold text-sm">Lead Generation (Discounts)</h5>
                                        <p className="text-xs opacity-80 mt-1">AI will ask for email before giving discount codes.</p>
                                    </div>
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input type="checkbox" className="sr-only peer" checked={config.store_chat_marketing_optin} onChange={e => setConfig({...config, store_chat_marketing_optin: e.target.checked})} />
                                        <div className="w-11 h-6 bg-indigo-900/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                                {config.store_chat_marketing_optin && (
                                    <div className="space-y-2">
                                        <Label className="text-indigo-900 dark:text-indigo-200">Default Coupon Code</Label>
                                        <Input value={config.store_chat_marketing_coupon || ''} onChange={e => setConfig({...config, store_chat_marketing_coupon: e.target.value})} placeholder="e.g. WELCOME10" className="bg-background/50 border-indigo-500/30 text-indigo-950 dark:text-indigo-100 placeholder:text-indigo-900/40" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Button size="lg" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : <><Save className="mr-2 h-4 w-4" /> Save Settings</>}</Button>
            </div>

            {/* Live Preview Pane */}
            <div className="lg:col-span-1 hidden lg:flex flex-col items-center p-6 border rounded-2xl bg-muted/10 sticky top-24 h-[calc(100vh-8rem)]">
                <h3 className="font-bold text-lg mb-2 text-muted-foreground flex items-center gap-2"><Eye className="w-5 h-5"/> Live Preview</h3>
                <p className="text-xs text-muted-foreground mb-8 text-center max-w-[250px]">Test your bot exactly how it will appear to your customers.</p>
                <div className="flex-1 w-full flex items-end justify-end relative min-h-[500px]">
                   {config.store_chat_enabled && config.store_chat_mode === 'internal' && (
                       <StorefrontChatWidget
                          portfolioId={activePortfolioId}
                          storeName={selectedStore?.site_name}
                          aiEnabled={config.store_chat_ai_assistant}
                          iconType={config.store_chat_icon_type}
                          customIconUrl={config.store_chat_custom_icon_url}
                          welcomeMessage={config.store_chat_welcome_message}
                              suggestedQuestions={config.store_chat_suggested_questions}
                          isInline={true}
                       />
                   )}
                </div>
            </div>
            </div>
        </div>
    );
}