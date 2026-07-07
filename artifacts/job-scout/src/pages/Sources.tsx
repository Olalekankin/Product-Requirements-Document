import React, { useState } from "react";
import { useListSources, useCreateSource, useUpdateSource, useDeleteSource, useGetJobsBySource, getListSourcesQueryKey, SourceType, SourceInputType } from "@workspace/api-client-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Button, Input, Badge } from "@/components/ui/core";
import { formatTimeAgo } from "@/lib/utils";
import { Plus, Trash2, RadioReceiver, Globe, Code2, UserRound, Power, Activity } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Sources() {
  const queryClient = useQueryClient();
  const { data: sources, isLoading } = useListSources();
  const { data: jobsBySource } = useGetJobsBySource();
  
  const createSource = useCreateSource();
  const updateSource = useUpdateSource();
  const deleteSource = useDeleteSource();

  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: "", slug: "", type: "api" as SourceInputType, url: "" });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.slug) return;
    
    createSource.mutate({ data: { ...formData, enabled: true } }, {
      onSuccess: () => {
        setFormData({ name: "", slug: "", type: "api", url: "" });
        setShowAdd(false);
        queryClient.invalidateQueries({ queryKey: getListSourcesQueryKey() });
        toast.success("Source added");
      }
    });
  };

  const handleToggle = (id: number, enabled: boolean) => {
    updateSource.mutate({ id, data: { enabled: !enabled } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSourcesQueryKey() })
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Remove this source?")) return;
    deleteSource.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSourcesQueryKey() });
        toast.success("Source removed");
      }
    });
  };

  const getSourceIcon = (type: string) => {
    switch(type) {
      case "api": return <Code2 className="w-5 h-5 text-blue-500" />;
      case "rss": return <RadioReceiver className="w-5 h-5 text-orange-500" />;
      case "scraper": return <Globe className="w-5 h-5 text-purple-500" />;
      case "manual": return <UserRound className="w-5 h-5 text-emerald-500" />;
      default: return <Activity className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getJobCount = (slug: string, storedCount?: number) => {
    const fromStats = jobsBySource?.find(s => s.source === slug)?.count;
    return fromStats !== undefined ? fromStats : (storedCount || 0);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col h-full">
      <PageHeader 
        title="Data Sources" 
        description="Where the scanner looks for jobs."
        actions={
          <Button onClick={() => setShowAdd(!showAdd)}>
            <Plus className="w-4 h-4 mr-2" /> Add Source
          </Button>
        }
      />

      {showAdd && (
        <Card className="mb-8 p-6 border-primary/50 bg-primary/5 shadow-md">
          <h3 className="font-bold text-lg mb-4">Add New Source</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input required value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') }))} placeholder="e.g. Hacker News Jobs" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Slug (Internal ID)</label>
                <Input required value={formData.slug} onChange={e => setFormData(f => ({ ...f, slug: e.target.value }))} placeholder="hacker-news" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <select 
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
                  value={formData.type}
                  onChange={e => setFormData(f => ({ ...f, type: e.target.value as SourceInputType }))}
                >
                  <option value="api">API Endpoint</option>
                  <option value="rss">RSS Feed</option>
                  <option value="scraper">Web Scraper</option>
                  <option value="manual">Manual Entry</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">URL / Endpoint</label>
                <Input value={formData.url} onChange={e => setFormData(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" disabled={createSource.isPending}>Save Source</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-40 animate-pulse bg-muted">{null}</Card>)
        ) : sources?.map(source => (
          <Card key={source.id} className={`p-6 transition-all ${!source.enabled ? 'opacity-70 bg-muted/30 grayscale-[50%]' : ''}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-card border border-border shadow-sm rounded-lg">
                  {getSourceIcon(source.type)}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">{source.name}</h3>
                  <div className="text-xs font-mono text-muted-foreground uppercase">{source.type} • {source.slug}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button 
                  variant={source.enabled ? "default" : "secondary"} 
                  size="icon" 
                  className="w-8 h-8 rounded-full"
                  onClick={() => handleToggle(source.id, source.enabled)}
                >
                  <Power className="w-4 h-4" />
                </Button>
                <Button variant="ghost-danger" size="icon" className="w-8 h-8 rounded-full" onClick={() => handleDelete(source.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">URL Target</span>
                <span className="font-medium text-foreground truncate max-w-[200px]" title={source.url || 'None'}>
                  {source.url || 'None configured'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jobs Extracted</span>
                <span className="font-bold">{getJobCount(source.slug, source.jobsFound)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Scanned</span>
                <span className="font-medium">{formatTimeAgo(source.lastScannedAt)}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
