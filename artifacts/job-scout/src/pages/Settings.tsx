import React, { useState, useEffect, useRef } from "react";
import {
  useGetSettings, useUpdateSettings, getGetSettingsQueryKey, SettingsSchedulerFrequency,
  useListSocialConnections, useDeleteSocialConnection, getListSocialConnectionsQueryKey,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Button, Input, Badge } from "@/components/ui/core";
import { Save, Plus, X, BellRing, Briefcase, Zap, ShieldAlert, Share2, Link2, Link2Off, ExternalLink, CheckCircle2, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: initialSettings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();

  const [settings, setSettings] = useState<any>(null);
  const initializedForId = useRef<boolean>(false);
  const location = useLocation();

  // Query social connections
  const { data: connections, isLoading: isConnLoading } = useListSocialConnections();
  const deleteConnection = useDeleteSocialConnection();

  useEffect(() => {
    if (initialSettings && !initializedForId.current) {
      setSettings(initialSettings);
      initializedForId.current = true;
    }
  }, [initialSettings]);

  // Handle OAuth callback parameters in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");

    if (connected) {
      toast.success(`Successfully connected ${connected.toUpperCase()}!`);
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      queryClient.invalidateQueries({ queryKey: getListSocialConnectionsQueryKey() });
    } else if (error) {
      if (error === "twitter_denied" || error === "linkedin_denied") {
        toast.error("Social connection request was cancelled.");
      } else {
        toast.error(`Connection failed: ${error.replace(/_/g, " ")}`);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location, queryClient]);

  const handleDisconnect = async (id: number, platform: string) => {
    toast.promise(
      deleteConnection.mutateAsync({ id }),
      {
        loading: `Disconnecting ${platform.toUpperCase()}...`,
        success: () => {
          queryClient.invalidateQueries({ queryKey: getListSocialConnectionsQueryKey() });
          return `Disconnected ${platform.toUpperCase()}`;
        },
        error: `Failed to disconnect ${platform.toUpperCase()}`
      }
    );
  };

  if (isLoading || !settings) {
    return <div className="p-4 sm:p-8 max-w-4xl mx-auto animate-pulse"><div className="h-96 bg-muted rounded-xl"></div></div>;
  }

  const handleSave = () => {
    toast.promise(
      updateSettings.mutateAsync({ data: settings }),
      {
        loading: 'Saving settings...',
        success: () => {
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
          return 'Settings updated successfully';
        },
        error: 'Failed to update settings'
      }
    );
  };

  const updateField = (field: string, value: any) => {
    setSettings((s: any) => ({ ...s, [field]: value }));
  };

  const toggleArrayItem = (field: string, item: string) => {
    setSettings((s: any) => {
      const arr = s[field] || [];
      if (arr.includes(item)) return { ...s, [field]: arr.filter((i: string) => i !== item) };
      return { ...s, [field]: [...arr, item] };
    });
  };

  const addTag = (field: string, value: string) => {
    if (!value.trim()) return;
    setSettings((s: any) => {
      const arr = s[field] || [];
      if (arr.includes(value.trim())) return s;
      return { ...s, [field]: [...arr, value.trim()] };
    });
  };

  const removeTag = (field: string, value: string) => {
    setSettings((s: any) => {
      const arr = s[field] || [];
      return { ...s, [field]: arr.filter((i: string) => i !== value) };
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto pb-24">
      <PageHeader 
        title="Scanner Configuration" 
        description="Fine-tune how Job Scout finds and filters opportunities."
        actions={
          <Button onClick={handleSave} disabled={updateSettings.isPending} size="lg" className="w-40">
            <Save className="w-4 h-4 mr-2" /> 
            {updateSettings.isPending ? "Saving..." : "Save Changes"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Core Behavior */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="p-6 border-l-4 border-l-primary">
            <div className="flex items-center gap-2 mb-6 text-primary font-bold text-lg">
              <Zap className="w-5 h-5" /> Core Behavior
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground">Scan Frequency</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-1 text-base shadow-sm"
                  value={settings.schedulerFrequency}
                  onChange={(e) => updateField('schedulerFrequency', e.target.value)}
                >
                  <option value={SettingsSchedulerFrequency['15min']}>Every 15 minutes</option>
                  <option value={SettingsSchedulerFrequency['1hour']}>Every hour</option>
                  <option value={SettingsSchedulerFrequency['6x_daily']}>Every 4 hours (6x daily)</option>
                  <option value={SettingsSchedulerFrequency['2xdaily']}>Twice daily</option>
                  <option value={SettingsSchedulerFrequency['daily']}>Once daily</option>
                  <option value={SettingsSchedulerFrequency.manual}>Manual only</option>
                </select>
                <p className="text-xs text-muted-foreground">How often the background worker checks for new jobs.</p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground">Minimum Relevance Score</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="0" max="100" 
                    value={settings.minRelevanceNotify || 0}
                    onChange={(e) => updateField('minRelevanceNotify', parseInt(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <div className="w-12 text-center font-bold font-mono bg-muted py-1 rounded">
                    {settings.minRelevanceNotify}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Jobs below this score will be silently ignored.</p>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                <div>
                  <h4 className="font-bold text-foreground">Remote Only</h4>
                  <p className="text-sm text-muted-foreground mt-1">Ignore on-site positions entirely</p>
                </div>
                <button 
                  onClick={() => updateField('remoteOnly', !settings.remoteOnly)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.remoteOnly ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.remoteOnly ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground">Minimum Salary (Optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                  <Input 
                    type="number" 
                    className="pl-8 text-lg font-mono" 
                    placeholder="e.g. 120000"
                    value={settings.minSalary || ""}
                    onChange={(e) => updateField('minSalary', e.target.value ? parseInt(e.target.value) : null)}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Autonomous Agents & Auto-Post Settings */}
          <Card className="p-6 border-l-4 border-l-indigo-500">
            <div className="flex items-center gap-2 mb-6 text-indigo-600 font-bold text-lg">
              <Sparkles className="w-5 h-5" /> Autonomous Agents & Auto-Post
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Auto Discovery */}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                <div>
                  <h4 className="font-bold text-foreground">Autonomous Source Discovery</h4>
                  <p className="text-sm text-muted-foreground mt-1">Agent automatically searches and registers job sources daily</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateField('autoDiscoverEnabled', !settings.autoDiscoverEnabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.autoDiscoverEnabled ? 'bg-indigo-600' : 'bg-muted-foreground/30'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.autoDiscoverEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* Auto Post Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                <div>
                  <h4 className="font-bold text-foreground">Automatic Social Posting</h4>
                  <p className="text-sm text-muted-foreground mt-1">Auto-queue social posts for jobs above score threshold</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateField('autoPostEnabled', !settings.autoPostEnabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.autoPostEnabled ? 'bg-indigo-600' : 'bg-muted-foreground/30'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.autoPostEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {settings.autoPostEnabled && (
              <div className="mt-6 pt-6 border-t border-border max-w-md space-y-3">
                <label className="text-sm font-bold text-foreground">Auto-Post Minimum Relevance Score</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="50" max="100"
                    value={settings.autoPostMinScore || 85}
                    onChange={(e) => updateField('autoPostMinScore', parseInt(e.target.value))}
                    className="flex-1 accent-indigo-600"
                  />
                  <div className="w-12 text-center font-bold font-mono bg-muted py-1 rounded">
                    {settings.autoPostMinScore}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Only job opportunities matching or exceeding this relevance score will be auto-published.</p>
              </div>
            )}
          </Card>

          {/* Social Media Connections */}
          <Card className="p-6 border-l-4 border-l-blue-500">
            <div className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-lg">
              <Share2 className="w-5 h-5" /> Social Media Connections
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Connect accounts to enable automated or manual publishing of job opportunities.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Twitter / X Connection */}
              <div className="p-5 rounded-xl border border-border bg-card flex flex-col justify-between min-h-[160px]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-foreground flex items-center gap-2 text-base">
                      Twitter / X
                      {connections?.some(c => c.platform === "twitter") ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200">Connected</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Disconnected</Badge>
                      )}
                    </h4>
                    {connections?.some(c => c.platform === "twitter") ? (
                      <p className="text-sm text-foreground mt-2 font-mono">
                        {connections.find(c => c.platform === "twitter")?.handle}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">
                        Requires Twitter Client ID configured in workspace environment.
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/50 flex justify-end">
                  {connections?.some(c => c.platform === "twitter") ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="text-destructive border-destructive/20 hover:bg-destructive/10"
                      onClick={() => handleDisconnect(connections.find(c => c.platform === "twitter")!.id, "twitter")}
                    >
                      <Link2Off className="w-4 h-4 mr-1.5" /> Disconnect
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => window.location.href = "/api/auth/twitter/connect"}
                    >
                      <Link2 className="w-4 h-4 mr-1.5" /> Connect Twitter
                    </Button>
                  )}
                </div>
              </div>

              {/* LinkedIn Connection */}
              <div className="p-5 rounded-xl border border-border bg-card flex flex-col justify-between min-h-[160px]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-foreground flex items-center gap-2 text-base">
                      LinkedIn
                      {connections?.some(c => c.platform === "linkedin") ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200">Connected</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Disconnected</Badge>
                      )}
                    </h4>
                    {connections?.some(c => c.platform === "linkedin") ? (
                      <p className="text-sm text-foreground mt-2 font-mono">
                        {connections.find(c => c.platform === "linkedin")?.handle}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">
                        Requires LinkedIn Client ID and Secret configured in environment.
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/50 flex justify-end">
                  {connections?.some(c => c.platform === "linkedin") ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="text-destructive border-destructive/20 hover:bg-destructive/10"
                      onClick={() => handleDisconnect(connections.find(c => c.platform === "linkedin")!.id, "linkedin")}
                    >
                      <Link2Off className="w-4 h-4 mr-1.5" /> Disconnect
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => window.location.href = "/api/auth/linkedin/connect"}
                    >
                      <Link2 className="w-4 h-4 mr-1.5" /> Connect LinkedIn
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters & Taxonomy */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6 text-foreground font-bold text-lg">
              <Briefcase className="w-5 h-5 text-muted-foreground" /> Job Taxonomy
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-bold text-foreground block mb-3">Employment Types</label>
                <div className="flex flex-wrap gap-2">
                  {['full-time', 'contract', 'freelance', 'part-time', 'internship'].map(type => (
                    <button
                      key={type}
                      onClick={() => toggleArrayItem('employmentTypes', type)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                        (settings.employmentTypes || []).includes(type) 
                        ? 'bg-primary text-primary-foreground border-primary-border shadow-sm' 
                        : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-foreground block mb-3">Experience Levels</label>
                <div className="flex flex-wrap gap-2">
                  {['entry', 'mid', 'senior', 'lead', 'principal', 'staff', 'manager', 'director'].map(level => (
                    <button
                      key={level}
                      onClick={() => toggleArrayItem('experienceLevels', level)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                        (settings.experienceLevels || []).includes(level) 
                        ? 'bg-primary text-primary-foreground border-primary-border shadow-sm' 
                        : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2 pt-4 border-t border-border">
                <label className="text-sm font-bold text-foreground">Maximum Age (Days)</label>
                <Input 
                  type="number" 
                  min="1" max="90"
                  className="max-w-[150px] font-mono text-center" 
                  value={settings.postedWithinDays || ""}
                  onChange={(e) => updateField('postedWithinDays', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="No limit"
                />
                <p className="text-xs text-muted-foreground">Ignore jobs older than this many days.</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6 text-foreground font-bold text-lg">
              <ShieldAlert className="w-5 h-5 text-muted-foreground" /> Advanced Filtering
            </div>

            <div className="space-y-6">
              <TagInput 
                label="Required Technologies" 
                description="Boosts relevance score if these are found in the description."
                tags={settings.requiredTechnologies || []} 
                onAdd={(v) => addTag('requiredTechnologies', v)} 
                onRemove={(v) => removeTag('requiredTechnologies', v)} 
                color="blue"
              />
              
              <TagInput 
                label="Excluded Keywords" 
                description="Immediately ignore jobs containing these exact phrases."
                tags={settings.excludedKeywords || []} 
                onAdd={(v) => addTag('excludedKeywords', v)} 
                onRemove={(v) => removeTag('excludedKeywords', v)} 
                color="red"
              />
              
              <TagInput 
                label="Blacklisted Companies" 
                description="Never show jobs from these companies."
                tags={settings.blacklistedCompanies || []} 
                onAdd={(v) => addTag('blacklistedCompanies', v)} 
                onRemove={(v) => removeTag('blacklistedCompanies', v)} 
                color="slate"
              />
            </div>
          </Card>
        </div>

        {/* Notifications */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6 text-foreground font-bold text-lg">
              <BellRing className="w-5 h-5 text-muted-foreground" /> Notifications
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                <span className="font-medium text-sm">In-App Alerts</span>
                <button 
                  onClick={() => updateField('inAppNotifications', !settings.inAppNotifications)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${settings.inAppNotifications ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.inAppNotifications ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                <span className="font-medium text-sm">Daily Email Digest</span>
                <button 
                  onClick={() => updateField('emailNotifications', !settings.emailNotifications)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${settings.emailNotifications ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.emailNotifications ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}

function TagInput({ label, description, tags, onAdd, onRemove, color }: { label: string, description: string, tags: string[], onAdd: (v: string) => void, onRemove: (v: string) => void, color: "blue" | "red" | "slate" }) {
  const [val, setVal] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onAdd(val);
      setVal("");
    }
  };

  const colorStyles = {
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    red: "bg-red-100 text-red-800 border-red-200",
    slate: "bg-slate-200 text-slate-800 border-slate-300"
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-foreground">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
        {tags.length === 0 && <span className="text-sm text-muted-foreground italic">None configured</span>}
        {tags.map(tag => (
          <span key={tag} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wide border ${colorStyles[color]}`}>
            {tag}
            <button type="button" onClick={() => onRemove(tag)} className="hover:text-black opacity-60 hover:opacity-100">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input 
          placeholder="Type and press Enter..." 
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-sm"
        />
        <Button 
          type="button" 
          variant="secondary" 
          onClick={() => { onAdd(val); setVal(""); }}
        >
          Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
