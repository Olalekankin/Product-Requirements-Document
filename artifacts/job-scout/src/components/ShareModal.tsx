import React, { useState, useEffect } from "react";
import {
  useGetSocialPost,
  useGenerateSocialPost,
  getGetSocialPostQueryKey,
  SocialPostRequestPlatform,
  SocialPostRequestTone,
  useListSocialConnections,
  usePublishNow,
  useSchedulePost,
  useListScheduledPosts,
  useCancelScheduledPost,
  getListScheduledPostsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  X, Copy, Check, Sparkles, Loader2, Share2, Calendar, Clock,
  Send, Trash2, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/core";
import { Link } from "wouter";
import { formatTimeAgo } from "@/lib/utils";

interface ShareModalProps {
  jobId: number;
  jobTitle: string;
  jobUrl: string;
  onClose: () => void;
}

type PostMode = "now" | "schedule";

export function ShareModal({ jobId, jobTitle, jobUrl, onClose }: ShareModalProps) {
  const queryClient = useQueryClient();

  // ── Data ─────────────────────────────────────────────────────────────────────
  const { data: connections = [], isLoading: connectionsLoading } = useListSocialConnections();
  const { data: scheduledPosts = [], refetch: refetchScheduled } = useListScheduledPosts();
  const {
    data: socialPost,
    isLoading: postLoading,
    isError: postError,
  } = useGetSocialPost(jobId, {
    query: { queryKey: getGetSocialPostQueryKey(jobId), retry: false },
  });

  // ── Local state ───────────────────────────────────────────────────────────────
  const [selectedConnId, setSelectedConnId] = useState<number | null>(null);
  const [postText, setPostText] = useState("");
  const [mode, setMode] = useState<PostMode>("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [copied, setCopied] = useState(false);

  const generatePost = useGenerateSocialPost();
  const publishNow = usePublishNow();
  const schedulePost = useSchedulePost();
  const cancelPost = useCancelScheduledPost();

  // Auto-select first connection
  useEffect(() => {
    if (connections.length > 0 && !selectedConnId) {
      setSelectedConnId(connections[0].id);
    }
  }, [connections]);

  // Populate textarea from AI post (first load only)
  useEffect(() => {
    if (socialPost?.content && !postText) {
      setPostText(socialPost.content);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socialPost?.content]);

  // Set default scheduled time to tomorrow 9am
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    setScheduledAt(d.toISOString().slice(0, 16));
  }, []);

  // Keyboard / backdrop close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const selectedConn = connections.find((c) => c.id === selectedConnId) ?? null;

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleGenerate = () => {
    const platform = selectedConn?.platform === "linkedin"
      ? SocialPostRequestPlatform.linkedin
      : SocialPostRequestPlatform.twitter;

    toast.promise(
      generatePost.mutateAsync({ jobId, data: { platform, tone: SocialPostRequestTone.sharing } }),
      {
        loading: "Generating with Gemini AI…",
        success: (post) => {
          setPostText(post.content || "");
          queryClient.invalidateQueries({ queryKey: getGetSocialPostQueryKey(jobId) });
          return "Post generated!";
        },
        error: "Failed to generate",
      }
    );
  };

  const handlePublishNow = () => {
    if (!selectedConnId || !postText.trim()) return;
    toast.promise(
      publishNow.mutateAsync({ id: selectedConnId, data: { content: postText, jobId } }),
      {
        loading: `Posting to ${selectedConn?.platform === "twitter" ? "X (Twitter)" : "LinkedIn"}…`,
        success: (result) => {
          queryClient.invalidateQueries({ queryKey: getListScheduledPostsQueryKey() });
          return `Posted successfully!`;
        },
        error: (err) => err?.message || "Failed to post",
      }
    );
  };

  const handleSchedule = () => {
    if (!selectedConnId || !postText.trim() || !scheduledAt) return;
    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      toast.error("Please choose a future date and time");
      return;
    }
    toast.promise(
      schedulePost.mutateAsync({
        id: selectedConnId,
        data: { content: postText, scheduledAt: scheduledDate.toISOString(), jobId },
      }),
      {
        loading: "Scheduling post…",
        success: () => {
          refetchScheduled();
          setMode("now");
          return `Scheduled for ${scheduledDate.toLocaleString()}`;
        },
        error: (err) => err?.message || "Failed to schedule",
      }
    );
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(postText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCancelScheduled = (id: number) => {
    toast.promise(
      cancelPost.mutateAsync({ id }),
      {
        loading: "Cancelling…",
        success: () => { refetchScheduled(); return "Post cancelled"; },
        error: "Failed to cancel",
      }
    );
  };

  const hasContent = !!postText;
  const showGenerate = !postLoading && !postError && !postText && !generatePost.isPending;
  const isPosting = publishNow.isPending || schedulePost.isPending;

  // Scheduled posts for this job
  const jobScheduledPosts = scheduledPosts.filter(
    (p: any) => p.jobId === jobId && (p.status === "pending" || p.status === "posted" || p.status === "failed")
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Share2 className="w-4 h-4 text-primary" />
            Share this opportunity
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 flex flex-col gap-4">
            <p className="text-xs text-muted-foreground font-medium truncate">{jobTitle}</p>

            {/* ── No connections state ── */}
            {!connectionsLoading && connections.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Share2 className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">No accounts connected</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connect a social account to post directly from Job Scout.
                  </p>
                </div>
                <Link href="/settings" onClick={onClose}>
                  <Button className="gap-2 mt-1">
                    <Settings className="w-4 h-4" />
                    Go to Settings → Connected Accounts
                  </Button>
                </Link>
              </div>
            )}

            {/* ── Loading connections ── */}
            {connectionsLoading && (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            )}

            {/* ── Connected: platform selector ── */}
            {!connectionsLoading && connections.length > 0 && (
              <>
                {connections.length > 1 && (
                  <div className="flex gap-2">
                    {connections.map((conn) => (
                      <button
                        key={conn.id}
                        onClick={() => setSelectedConnId(conn.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          selectedConnId === conn.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {conn.platform === "twitter" ? <XIcon className="w-4 h-4" /> : <LinkedInIcon className="w-4 h-4" />}
                        {conn.handle}
                      </button>
                    ))}
                  </div>
                )}

                {connections.length === 1 && selectedConn && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm">
                    {selectedConn.platform === "twitter" ? <XIcon className="w-4 h-4" /> : <LinkedInIcon className="w-4 h-4 text-blue-600" />}
                    <span className="font-medium">{selectedConn.handle}</span>
                    <span className="text-muted-foreground">· {selectedConn.platform === "twitter" ? "X (Twitter)" : "LinkedIn"}</span>
                  </div>
                )}

                {/* Post content */}
                {(postLoading || generatePost.isPending) && (
                  <div className="flex items-center gap-2 py-4 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">{generatePost.isPending ? "Generating…" : "Loading post…"}</span>
                  </div>
                )}

                {showGenerate && (
                  <div className="flex flex-col items-center gap-3 py-4 bg-muted/30 rounded-lg border border-dashed border-border">
                    <p className="text-sm text-muted-foreground text-center px-4">
                      Let Gemini AI craft a post based on this job's details.
                    </p>
                    <Button onClick={handleGenerate} className="gap-2">
                      <Sparkles className="w-4 h-4" /> Generate Post with AI
                    </Button>
                  </div>
                )}

                {hasContent && (
                  <>
                    <div className="relative">
                      <textarea
                        className="w-full min-h-[130px] rounded-lg border border-input bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring leading-relaxed"
                        value={postText}
                        onChange={(e) => setPostText(e.target.value)}
                        placeholder="Your post content…"
                      />
                    </div>
                    <div className="flex items-center justify-between -mt-2">
                      <span className={`text-xs ${postText.length > 280 && selectedConn?.platform === "twitter" ? "text-amber-500 font-medium" : "text-muted-foreground"}`}>
                        {postText.length} chars
                        {postText.length > 280 && selectedConn?.platform === "twitter" && " · over X's 280 limit"}
                      </span>
                      <button
                        onClick={handleGenerate}
                        disabled={generatePost.isPending}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Sparkles className="w-3 h-3" /> Regenerate
                      </button>
                    </div>

                    {/* Mode toggle */}
                    <div className="flex gap-1 p-1 bg-muted rounded-lg">
                      <button
                        onClick={() => setMode("now")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                          mode === "now" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" /> Post Now
                      </button>
                      <button
                        onClick={() => setMode("schedule")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                          mode === "schedule" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" /> Schedule
                      </button>
                    </div>

                    {/* Schedule datetime picker */}
                    {mode === "schedule" && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Post at</label>
                        <input
                          type="datetime-local"
                          value={scheduledAt}
                          min={new Date().toISOString().slice(0, 16)}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Scheduled posts for this job */}
                {jobScheduledPosts.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Scheduled / Recent Posts
                    </p>
                    {jobScheduledPosts.slice(0, 3).map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`shrink-0 px-1.5 py-0.5 rounded font-mono uppercase tracking-wide ${
                            p.status === "pending" ? "bg-amber-100 text-amber-700" :
                            p.status === "posted" ? "bg-green-100 text-green-700" :
                            p.status === "failed" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"
                          }`}>{p.status}</span>
                          <span className="text-muted-foreground truncate">
                            {p.status === "pending" ? formatTimeAgo(p.scheduledAt) : p.status === "posted" ? formatTimeAgo(p.postedAt) : p.errorMessage}
                          </span>
                        </div>
                        {p.status === "pending" && (
                          <button
                            onClick={() => handleCancelScheduled(p.id)}
                            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        {!connectionsLoading && connections.length > 0 && hasContent && (
          <div className="flex items-center gap-2 px-5 py-4 border-t border-border bg-muted/30 rounded-b-xl shrink-0">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>

            <div className="flex-1" />

            {mode === "now" ? (
              <Button
                size="sm"
                onClick={handlePublishNow}
                disabled={isPosting || !postText.trim()}
                className="gap-1.5"
              >
                {isPosting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Post to {selectedConn?.platform === "twitter" ? "X" : "LinkedIn"}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSchedule}
                disabled={isPosting || !postText.trim() || !scheduledAt}
                className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {isPosting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                Schedule
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Minimal inline SVGs for platform icons
function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function LinkedInIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
