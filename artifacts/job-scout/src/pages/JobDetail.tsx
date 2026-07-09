import React, { useState } from "react";
import { 
  useGetJob, useUpdateJob, useListNotes, useCreateNote, useDeleteNote, 
  useGetSocialPost, useGenerateSocialPost, useSummarizeJob, JobStatus, 
  getGetJobQueryKey, getListNotesQueryKey, getGetSocialPostQueryKey,
  useListSocialConnections, usePublishNow, useSchedulePost,
  useListScheduledPosts, useCancelScheduledPost, getListScheduledPostsQueryKey
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Button, Badge, Input } from "@/components/ui/core";
import { formatTimeAgo, formatDate } from "@/lib/utils";
import { getStatusColor, getStatusLabel, getRelevanceColor } from "@/lib/formatters";
import { ArrowLeft, Building, MapPin, DollarSign, Star, ExternalLink, Calendar, RefreshCcw, Share2, Sparkles, Clock, Trash2, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const jobId = parseInt(id || "0", 10);
  const queryClient = useQueryClient();

  const { data: job, isLoading } = useGetJob(jobId, { query: { enabled: !!jobId, queryKey: ["getJob", jobId] } });
  const updateJob = useUpdateJob();
  const summarizeJob = useSummarizeJob();
  
  const handleStatusChange = (status: JobStatus) => {
    toast.promise(
      updateJob.mutateAsync({ id: jobId, data: { status } }),
      {
        loading: 'Updating status...',
        success: () => {
          queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
          return 'Status updated';
        },
        error: 'Failed to update'
      }
    );
  };

  const handleFavoriteToggle = () => {
    if (!job) return;
    updateJob.mutate({ id: jobId, data: { favorite: !job.favorite } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) })
    });
  };

  const handleReSummarize = () => {
    toast.promise(
      summarizeJob.mutateAsync({ id: jobId }),
      {
        loading: 'Running AI analysis...',
        success: () => {
          queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
          return 'Analysis complete';
        },
        error: 'Analysis failed'
      }
    );
  };

  if (isLoading) {
    return <div className="p-4 sm:p-8 max-w-5xl mx-auto animate-pulse"><div className="h-64 bg-muted rounded-xl"></div></div>;
  }

  if (!job) {
    return <div className="p-4 sm:p-8 text-center text-muted-foreground">Job not found</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <Link href="/jobs" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to feed
      </Link>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground leading-tight">
                {job.title}
              </h1>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="icon" onClick={handleFavoriteToggle} className={job.favorite ? "text-yellow-500 border-yellow-200 bg-yellow-50" : ""}>
                  <Star className="w-5 h-5" fill={job.favorite ? "currentColor" : "none"} />
                </Button>
                <a
                  href={job.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 transition-colors"
                >
                  Apply <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-y-3 gap-x-6 text-sm text-foreground/80 font-medium">
              <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                <Building className="w-4 h-4 text-muted-foreground" /> {job.company}
              </span>
              {(job.location || job.remote) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-muted-foreground" /> 
                  {job.location || "Unspecified location"} {job.remote && <Badge variant="secondary" className="ml-1 text-[10px]">REMOTE</Badge>}
                </span>
              )}
              {job.salary && (
                <span className="flex items-center gap-1.5 text-green-700 font-bold bg-green-50 px-2 py-1 rounded-md border border-green-200">
                  <DollarSign className="w-4 h-4" /> {job.salary}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="w-4 h-4" /> Posted {formatDate(job.postedAt)}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 mt-6 pt-6 border-t border-border">
              <select 
                className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                value={job.status}
                onChange={(e) => handleStatusChange(e.target.value as JobStatus)}
              >
                {Object.values(JobStatus).map(s => (
                  <option key={s} value={s}>{getStatusLabel(s)}</option>
                ))}
              </select>
              
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 font-mono text-xs uppercase text-muted-foreground">
                <RefreshCcw className="w-3.5 h-3.5" /> Discovered {formatTimeAgo(job.createdAt)} via {job.source}
              </div>
            </div>
          </div>

          {/* AI Intelligence Panel */}
          <Card className="p-6 border-primary/20 bg-primary/5 shadow-inner">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-primary/10">
              <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
                <Sparkles className="w-5 h-5" /> Scout Intelligence
              </h2>
              <div className="flex items-center gap-4">
                <div className="text-sm font-medium">Relevance Score:</div>
                <div className={`px-3 py-1 rounded-md text-lg font-bold shadow-sm ${getRelevanceColor(job.relevanceScore)}`}>
                  {job.relevanceScore !== null ? `${job.relevanceScore}/100` : "Pending"}
                </div>
                <Button variant="ghost" size="sm" onClick={handleReSummarize} disabled={summarizeJob.isPending} className="h-8">
                  <RefreshCcw className={`w-4 h-4 ${summarizeJob.isPending ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              {job.aiSummary && (
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Executive Summary</h3>
                  <p className="text-foreground leading-relaxed font-medium">{job.aiSummary}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {job.aiWhyFits && (
                  <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-green-700 mb-2 font-bold">Why It's a Match</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed">{job.aiWhyFits}</p>
                  </div>
                )}
                {job.aiRequirements && (
                  <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-amber-700 mb-2 font-bold">Key Requirements</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed">{job.aiRequirements}</p>
                  </div>
                )}
              </div>

              {(job.aiTechnologies && job.aiTechnologies.length > 0) && (
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Tech Stack</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.aiTechnologies.map(tech => (
                      <Badge key={tech} variant="secondary" className="px-2 py-1">{tech}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Full Description */}
          <div>
            <h2 className="text-xl font-bold mb-4">Description</h2>
            <Card className="p-6">
              <div 
                className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary whitespace-pre-wrap font-sans"
                dangerouslySetInnerHTML={{ __html: job.description || "No description provided." }}
              />
            </Card>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 space-y-6 shrink-0">
          <NotesPanel jobId={jobId} notes={job.notes || []} />
          <SocialPostPanel jobId={jobId} initialPost={job.socialPost} />
        </div>
      </div>
    </div>
  );
}

function NotesPanel({ jobId, notes: initialNotes }: { jobId: number, notes: any[] }) {
  const queryClient = useQueryClient();
  const { data: notes } = useListNotes(jobId, { query: { initialData: initialNotes, queryKey: ["listNotes", jobId] } });
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const [content, setContent] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    createNote.mutate({ jobId, data: { content } }, {
      onSuccess: () => {
        setContent("");
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(jobId) });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteNote.mutate({ jobId, id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(jobId) })
    });
  };

  return (
    <Card className="flex flex-col max-h-[500px]">
      <div className="p-4 border-b border-border font-bold flex items-center gap-2 shrink-0">
        <Clock className="w-4 h-4 text-muted-foreground" /> Process Notes
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {(!notes || notes.length === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-4">No notes added yet.</p>
        ) : (
          notes.map((note: any) => (
            <div key={note.id} className="bg-muted/30 p-3 rounded-lg border border-border group relative">
              <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{formatDate(note.createdAt)}</span>
                <button 
                  onClick={() => handleDelete(note.id)}
                  className="text-destructive/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-border shrink-0 bg-muted/10">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input 
            placeholder="Add a note..." 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={createNote.isPending}
            className="text-sm"
          />
          <Button type="submit" size="icon" disabled={createNote.isPending || !content.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}

function SocialPostPanel({ jobId, initialPost }: { jobId: number, initialPost: any }) {
  const queryClient = useQueryClient();
  
  // Data queries & mutations
  const { data: socialPost } = useGetSocialPost(jobId, { query: { initialData: initialPost, queryKey: ["getSocialPost", jobId] } });
  const { data: connections } = useListSocialConnections();
  const { data: allScheduled } = useListScheduledPosts();
  
  const generatePost = useGenerateSocialPost();
  const publishNow = usePublishNow();
  const schedulePost = useSchedulePost();
  const cancelPost = useCancelScheduledPost();

  // Local state
  const [platform, setPlatform] = useState<"twitter" | "linkedin">("twitter");
  const [tone, setTone] = useState<"interesting" | "applying" | "sharing">("sharing");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);

  const handleGenerate = () => {
    generatePost.mutate({ jobId, data: { platform, tone } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSocialPostQueryKey(jobId) });
        toast.success("Social post content generated");
      }
    });
  };

  const handleCopy = () => {
    if (socialPost?.content) {
      navigator.clipboard.writeText(socialPost.content);
      toast.success("Copied to clipboard");
    }
  };

  // Find connection for selected platform
  const connection = connections?.find(c => c.platform === platform);

  const handlePublishNow = () => {
    if (!socialPost?.content) return;
    if (!connection) {
      toast.error(`Please connect a ${platform.toUpperCase()} account in Settings first.`);
      return;
    }

    toast.promise(
      publishNow.mutateAsync({
        id: connection.id,
        data: { content: socialPost.content }
      }),
      {
        loading: `Publishing to ${platform.toUpperCase()}...`,
        success: () => {
          queryClient.invalidateQueries({ queryKey: getListScheduledPostsQueryKey() });
          return `Successfully posted to ${platform.toUpperCase()}!`;
        },
        error: "Failed to publish post"
      }
    );
  };

  const handleSchedulePost = () => {
    if (!socialPost?.content || !scheduleTime) return;
    if (!connection) {
      toast.error(`Please connect a ${platform.toUpperCase()} account in Settings first.`);
      return;
    }

    toast.promise(
      schedulePost.mutateAsync({
        id: connection.id,
        data: {
          content: socialPost.content,
          scheduledAt: new Date(scheduleTime).toISOString(),
          jobId
        }
      }),
      {
        loading: "Scheduling post...",
        success: () => {
          setScheduleTime("");
          setIsScheduling(false);
          queryClient.invalidateQueries({ queryKey: getListScheduledPostsQueryKey() });
          return "Post scheduled successfully";
        },
        error: "Failed to schedule post"
      }
    );
  };

  const handleCancelPost = (id: number) => {
    toast.promise(
      cancelPost.mutateAsync({ id }),
      {
        loading: "Cancelling post...",
        success: () => {
          queryClient.invalidateQueries({ queryKey: getListScheduledPostsQueryKey() });
          return "Post cancelled";
        },
        error: "Failed to cancel post"
      }
    );
  };

  // Filter scheduled posts for this specific job
  const jobPosts = allScheduled?.filter(p => p.jobId === jobId) || [];

  return (
    <div className="space-y-6">
      <Card className="p-0 overflow-hidden border-blue-200">
        <div className="p-4 bg-blue-50 border-b border-blue-100 font-bold flex items-center justify-between text-blue-900">
          <span className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-blue-600" /> Share Opportunity
          </span>
          {!connection && (
            <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-[10px]">
              Disconnected
            </Badge>
          )}
        </div>
        <div className="p-4 space-y-4 bg-card">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant={platform === "twitter" ? "default" : "outline"} 
              size="sm" 
              onClick={() => setPlatform("twitter")}
            >Twitter / X</Button>
            <Button 
              variant={platform === "linkedin" ? "default" : "outline"} 
              size="sm" 
              onClick={() => setPlatform("linkedin")}
            >LinkedIn</Button>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground">Tone</label>
            <select 
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
              value={tone}
              onChange={(e) => setTone(e.target.value as any)}
            >
              <option value="sharing">Just sharing</option>
              <option value="applying">I'm applying</option>
              <option value="interesting">Looks interesting</option>
            </select>
          </div>
          
          <Button 
            className="w-full gap-2" 
            onClick={handleGenerate} 
            disabled={generatePost.isPending}
          >
            <Sparkles className="w-4 h-4" /> 
            {generatePost.isPending ? "Generating..." : socialPost ? "Regenerate Draft" : "Generate Draft"}
          </Button>

          {socialPost?.content && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              <div className="bg-muted/50 p-3 rounded-md text-sm text-foreground whitespace-pre-wrap border border-border">
                {socialPost.content}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1 text-xs" size="sm" onClick={handleCopy}>
                  Copy
                </Button>
                <Button 
                  disabled={!connection || publishNow.isPending} 
                  className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" 
                  size="sm" 
                  onClick={handlePublishNow}
                >
                  Publish Now
                </Button>
              </div>

              {/* Scheduling controls */}
              <div className="pt-2 border-t border-border/50">
                {!isScheduling ? (
                  <Button 
                    variant="outline" 
                    className="w-full text-xs gap-1.5" 
                    size="sm" 
                    disabled={!connection}
                    onClick={() => setIsScheduling(true)}
                  >
                    <Clock className="w-3.5 h-3.5" /> Schedule for Later
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Schedule Time</label>
                    <Input
                      type="datetime-local"
                      className="text-xs"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setIsScheduling(false)}>
                        Cancel
                      </Button>
                      <Button 
                        disabled={!scheduleTime || schedulePost.isPending} 
                        size="sm" 
                        className="text-xs h-7 bg-indigo-600 text-white hover:bg-indigo-700"
                        onClick={handleSchedulePost}
                      >
                        Confirm
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* History and scheduled queue logs for this job */}
      {jobPosts.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="font-bold text-sm text-foreground flex items-center gap-1.5 border-b border-border pb-2">
            <Calendar className="w-4 h-4 text-muted-foreground" /> Publication Queue
          </div>
          <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
            {jobPosts.map((post) => (
              <div key={post.id} className="text-xs p-2.5 rounded-lg border border-border bg-muted/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-blue-600">
                    {post.platform}
                  </span>
                  <div>
                    {post.status === "pending" && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[9px] px-1 py-0 font-medium">Pending</Badge>
                    )}
                    {post.status === "posted" && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[9px] px-1 py-0 font-medium">Posted</Badge>
                    )}
                    {post.status === "failed" && (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[9px] px-1 py-0 font-medium">Failed</Badge>
                    )}
                    {post.status === "cancelled" && (
                      <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 text-[9px] px-1 py-0 font-medium">Cancelled</Badge>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 italic bg-muted/40 p-1.5 rounded">
                  "{post.content}"
                </p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {post.status === "posted" 
                      ? `Posted: ${new Date(post.postedAt!).toLocaleDateString()}` 
                      : `Scheduled: ${new Date(post.scheduledAt).toLocaleString()}`}
                  </span>
                  {post.status === "pending" && (
                    <button 
                      onClick={() => handleCancelPost(post.id)}
                      className="text-destructive font-medium hover:underline"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {post.errorMessage && (
                  <p className="text-[10px] text-destructive bg-destructive/5 p-1 rounded font-mono break-all mt-1">
                    Error: {post.errorMessage}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
