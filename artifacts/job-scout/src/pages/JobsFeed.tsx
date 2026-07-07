import React, { useState } from "react";
import { useListJobs, useUpdateJob, JobStatus, getListJobsQueryKey } from "@workspace/api-client-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Button, Badge, Input } from "@/components/ui/core";
import { formatTimeAgo } from "@/lib/utils";
import { getStatusColor, getStatusLabel, getRelevanceColor } from "@/lib/formatters";
import { Search, MapPin, DollarSign, Building, Star, ChevronDown, Check, X, Bookmark, Archive, SlidersHorizontal, ChevronRight, ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function JobsFeed() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "">("");

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
    <div className="p-8 max-w-7xl mx-auto flex flex-col h-full">
      <PageHeader 
        title="Job Feed" 
        description="Discover, filter, and process opportunities."
      />

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search titles, companies, keywords..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <select 
          className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
        >
          <option value="">All Statuses</option>
          {Object.values(JobStatus).map(s => (
            <option key={s} value={s}>{getStatusLabel(s)}</option>
          ))}
        </select>
        
        <Button variant="outline" className="gap-2">
          <SlidersHorizontal className="w-4 h-4" />
          More Filters
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
    </div>
  );
}

function BriefcaseIcon(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" {...props}><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
}

function JobCard({ job, onStatusChange, onFavoriteToggle }: { job: any, onStatusChange: (id: number, s: JobStatus) => void, onFavoriteToggle: (id: number, f: boolean) => void }) {
  return (
    <Card className="p-0 overflow-hidden group hover:border-primary/50 transition-colors">
      <div className="flex flex-col sm:flex-row">
        <div className="p-5 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <Link href={`/jobs/${job.id}`}>
                <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer truncate">
                  {job.title}
                </h3>
              </Link>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 font-medium">
                <span className="flex items-center gap-1 text-foreground/80">
                  <Building className="w-4 h-4" /> {job.company}
                </span>
                {job.location && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" /> {job.location} {job.remote && "(Remote)"}
                    </span>
                  </>
                )}
                {job.salary && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                      <DollarSign className="w-4 h-4" /> {job.salary}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <div className={`px-2.5 py-1 rounded-md text-sm font-bold shadow-sm ${getRelevanceColor(job.relevanceScore)}`}>
                {job.relevanceScore !== null ? `${job.relevanceScore}` : "-"}
              </div>
              <button 
                onClick={() => onFavoriteToggle(job.id, job.favorite)}
                className={`p-2 rounded-md hover:bg-muted transition-colors ${job.favorite ? "text-yellow-500" : "text-muted-foreground"}`}
              >
                <Star className="w-5 h-5" fill={job.favorite ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
          
          {job.aiSummary && (
            <p className="text-sm text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
              {job.aiSummary}
            </p>
          )}

          <div className="flex items-center gap-4 mt-4">
            <Badge variant={getStatusColor(job.status)}>{getStatusLabel(job.status)}</Badge>
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              {job.source} • {formatTimeAgo(job.postedAt)}
            </span>
            
            <div className="flex-1" />
            
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {job.status === JobStatus.new && (
                <>
                  <Button size="sm" variant="ghost-danger" onClick={() => onStatusChange(job.id, JobStatus.ignored)}>
                    <X className="w-4 h-4 mr-1" /> Ignore
                  </Button>
                  <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50" onClick={() => onStatusChange(job.id, JobStatus.interested)}>
                    <Check className="w-4 h-4 mr-1" /> Interested
                  </Button>
                </>
              )}
              {job.status === JobStatus.interested && (
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => onStatusChange(job.id, JobStatus.applied)}>
                  <Check className="w-4 h-4 mr-1" /> Mark Applied
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
