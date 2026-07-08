import React, { useState } from "react";
import { useListJobs, useUpdateJob, JobStatus, getListJobsQueryKey } from "@workspace/api-client-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Button, Badge, Input } from "@/components/ui/core";
import { formatTimeAgo } from "@/lib/utils";
import { getStatusColor, getStatusLabel, getRelevanceColor } from "@/lib/formatters";
import { Search, MapPin, DollarSign, Building, Star, Check, X, SlidersHorizontal, ChevronRight, ChevronLeft, ExternalLink, Wifi, MapPinOff, Share2 } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShareModal } from "@/components/ShareModal";

export default function JobsFeed() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "">("");
  const [shareJob, setShareJob] = useState<{ id: number; title: string; url: string } | null>(null);

  // Simple debounce
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useListJobs({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter ? statusFilter as JobStatus : undefined,
    sortBy: "postedAt",
    sortDir: "desc"
  });

  const updateJob = useUpdateJob();

  const handleStatusChange = (id: number, status: JobStatus) => {
    toast.promise(
      updateJob.mutateAsync({ id, data: { status } }),
      {
        loading: 'Updating status...',
        success: () => {
          queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
          return 'Status updated';
        },
        error: 'Failed to update'
      }
    );
  };

  const handleFavoriteToggle = (id: number, favorite: boolean) => {
    updateJob.mutate({ id, data: { favorite: !favorite } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
      }
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col h-full">
      <PageHeader 
        title="Job Feed" 
        description="Discover, filter, and process opportunities."
      />

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search titles, companies, keywords..." 
            className="pl-9 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <select 
          className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-w-[130px]"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
        >
          <option value="">All Statuses</option>
          {Object.values(JobStatus).map(s => (
            <option key={s} value={s}>{getStatusLabel(s)}</option>
          ))}
        </select>
        
        <Button variant="outline" className="gap-2 shrink-0">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">More Filters</span>
        </Button>
      </div>

      <div className="flex-1 space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-6 h-32 animate-pulse bg-muted">{null}</Card>
          ))
        ) : data?.jobs.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground border-2 border-dashed border-border rounded-xl">
            <BriefcaseIcon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-foreground">No opportunities found</p>
            <p className="text-sm mt-1">Try adjusting your filters or triggering a new scan.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data?.jobs.map(job => (
              <JobCard 
                key={job.id} 
                job={job} 
                onStatusChange={handleStatusChange}
                onFavoriteToggle={handleFavoriteToggle}
                onShare={() => setShareJob({ id: job.id, title: job.title, url: job.url })}
              />
            ))}
            
            {data && data.total > data.limit && (
              <div className="flex items-center justify-between py-6 border-t border-border mt-8">
                <span className="text-sm text-muted-foreground font-medium">
                  Showing {(page - 1) * data.limit + 1} - {Math.min(page * data.limit, data.total)} of {data.total}
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={page * data.limit >= data.total}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share modal */}
      {shareJob && (
        <ShareModal
          jobId={shareJob.id}
          jobTitle={shareJob.title}
          jobUrl={shareJob.url}
          onClose={() => setShareJob(null)}
        />
      )}
    </div>
  );
}

function BriefcaseIcon(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" {...props}><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
}

function JobCard({ job, onStatusChange, onFavoriteToggle, onShare }: { job: any, onStatusChange: (id: number, s: JobStatus) => void, onFavoriteToggle: (id: number, f: boolean) => void, onShare: () => void }) {
  return (
    <Card className="p-0 overflow-hidden group hover:border-primary/50 transition-colors">
      <div className="p-5">
        {/* Top row: title + score + favorite */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="min-w-0 flex-1">
            <Link href={`/jobs/${job.id}`}>
              <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer leading-snug">
                {job.title}
              </h3>
            </Link>
            <span className="text-sm text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
              <Building className="w-3.5 h-3.5 shrink-0" /> {job.company}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={`px-2.5 py-1 rounded-md text-sm font-bold shadow-sm ${getRelevanceColor(job.relevanceScore)}`}>
              {job.relevanceScore !== null ? `${job.relevanceScore}` : "–"}
            </div>
            <button
              onClick={() => onFavoriteToggle(job.id, job.favorite)}
              className={`p-1.5 rounded-md hover:bg-muted transition-colors ${job.favorite ? "text-yellow-500" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
            >
              <Star className="w-4 h-4" fill={job.favorite ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        {/* Meta chips: remote, location, salary */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {job.remote && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
              <Wifi className="w-3 h-3" /> Remote
            </span>
          )}
          {!job.remote && job.location && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              <MapPin className="w-3 h-3" /> {job.location}
            </span>
          )}
          {job.remote && job.location && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              <MapPin className="w-3 h-3" /> {job.location}
            </span>
          )}
          {!job.remote && !job.location && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground/60 border border-border">
              <MapPinOff className="w-3 h-3" /> Location TBD
            </span>
          )}
          {job.salary && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
              <DollarSign className="w-3 h-3" /> {job.salary}
            </span>
          )}
          {job.employmentType && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              {job.employmentType}
            </span>
          )}
        </div>

        {/* AI summary */}
        {job.aiSummary && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
            {job.aiSummary}
          </p>
        )}

        {/* Bottom row: status + source + actions + APPLY */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border/50">
          <Badge variant={getStatusColor(job.status)}>{getStatusLabel(job.status)}</Badge>
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider truncate">
            {job.source} • {formatTimeAgo(job.postedAt)}
          </span>

          <div className="flex-1" />

          {/* Quick status actions — visible on hover (hidden on mobile tap) */}
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {job.status === JobStatus.new && (
              <>
                <Button size="sm" variant="ghost-danger" onClick={() => onStatusChange(job.id, JobStatus.ignored)}>
                  <X className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Ignore</span>
                </Button>
                <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50" onClick={() => onStatusChange(job.id, JobStatus.interested)}>
                  <Check className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Interested</span>
                </Button>
              </>
            )}
            {job.status === JobStatus.interested && (
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => onStatusChange(job.id, JobStatus.applied)}>
                <Check className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Mark Applied</span>
              </Button>
            )}
          </div>

          {/* Share button */}
          <button
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            title="Share to social media"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <Share2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Share</span>
          </button>

          {/* Apply link — always visible */}
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            Apply <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </Card>
  );
}
