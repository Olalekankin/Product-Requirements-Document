import React, { useState, useEffect } from "react";
import {
  useGetSocialPost,
  useGenerateSocialPost,
  getGetSocialPostQueryKey,
  SocialPostRequestPlatform,
  SocialPostRequestTone,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  X,
  Copy,
  Check,
  Sparkles,
  Twitter,
  Linkedin,
  Share2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/core";

interface ShareModalProps {
  jobId: number;
  jobTitle: string;
  jobUrl: string;
  onClose: () => void;
}

export function ShareModal({ jobId, jobTitle, jobUrl, onClose }: ShareModalProps) {
  const queryClient = useQueryClient();
  const [postText, setPostText] = useState("");
  const [copied, setCopied] = useState(false);

  // Use the canonical query key so invalidation always hits the same cache entry
  const {
    data: socialPost,
    isLoading,
    isError,
  } = useGetSocialPost(jobId, {
    query: {
      queryKey: getGetSocialPostQueryKey(jobId),
      retry: false,
    },
  });

  const generatePost = useGenerateSocialPost();

  // When post loads (first time only), populate the textarea
  useEffect(() => {
    if (socialPost?.content && !postText) {
      setPostText(socialPost.content);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socialPost?.content]);

  const handleGenerate = () => {
    toast.promise(
      generatePost.mutateAsync({ jobId, data: { platform: SocialPostRequestPlatform.linkedin, tone: SocialPostRequestTone.sharing } }),
      {
        loading: "Generating with Gemini AI…",
        success: (post) => {
          // Populate textarea immediately from mutation result — don't wait for query refetch
          const content = post.content || "";
          setPostText(content);
          queryClient.invalidateQueries({ queryKey: getGetSocialPostQueryKey(jobId) });
          return "Post generated!";
        },
        error: "Failed to generate post",
      }
    );
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(postText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(postText)}`;
    window.open(url, "_blank", "noopener,noreferrer,width=550,height=420");
  };

  const handleShareLinkedIn = () => {
    const params = new URLSearchParams({
      url: jobUrl,
      summary: postText,
      title: jobTitle,
    });
    const url = `https://www.linkedin.com/shareArticle?mini=true&${params.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=600");
  };

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Gate on postText (populated immediately from mutation result OR query)
  // so the textarea/share buttons appear right after generation without needing a refetch
  const hasPost = !!postText;
  const showGenerate = !isLoading && !postText && !generatePost.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Share2 className="w-4 h-4 text-primary" />
            Share this opportunity
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          <p className="text-xs text-muted-foreground font-medium truncate">
            {jobTitle}
          </p>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading post…</span>
            </div>
          )}

          {/* Generate button when no post exists */}
          {showGenerate && (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-muted-foreground text-center">
                No social post yet. Let Gemini AI craft one based on the job details.
              </p>
              <Button
                onClick={handleGenerate}
                disabled={generatePost.isPending}
                className="gap-2"
              >
                {generatePost.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate Post with AI
              </Button>
            </div>
          )}

          {/* Editable post content */}
          {hasPost && (
            <textarea
              className="w-full min-h-[140px] rounded-lg border border-input bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring leading-relaxed"
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              placeholder="Your post content…"
            />
          )}

          {/* Character count hint */}
          {hasPost && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {postText.length} chars
                {postText.length > 280 && (
                  <span className="text-amber-500 ml-2">
                    · LinkedIn OK, but too long for X (280 max)
                  </span>
                )}
              </span>
              <button
                onClick={handleGenerate}
                disabled={generatePost.isPending}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                Regenerate
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {hasPost && (
          <div className="flex items-center gap-2 px-5 py-4 border-t border-border bg-muted/30 rounded-b-xl">
            {/* Copy */}
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </Button>

            <div className="flex-1" />

            {/* LinkedIn */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleShareLinkedIn}
              className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
            >
              <Linkedin className="w-3.5 h-3.5" />
              LinkedIn
            </Button>

            {/* Twitter / X */}
            <Button
              size="sm"
              onClick={handleShareTwitter}
              className="gap-1.5 bg-black hover:bg-black/80 text-white"
            >
              <XIcon className="w-3.5 h-3.5" />
              Post to X
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Lucide doesn't have an X (Twitter) icon — use a minimal inline SVG
function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}
