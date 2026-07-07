import { JobStatus } from "@workspace/api-client-react";

export function getStatusColor(status: JobStatus): "default" | "success" | "warning" | "destructive" | "info" | "secondary" | "outline" {
  switch (status) {
    case JobStatus.new: return "info";
    case JobStatus.interested: return "warning";
    case JobStatus.applied: return "success";
    case JobStatus.rejected: return "destructive";
    case JobStatus.ignored: return "secondary";
    case JobStatus.saved: return "default";
    case JobStatus.archived: return "outline";
    default: return "default";
  }
}

export function getStatusLabel(status: JobStatus): string {
  return status.toUpperCase();
}

export function getRelevanceColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-muted-foreground bg-muted";
  if (score >= 80) return "text-green-800 bg-green-100 border border-green-200";
  if (score >= 60) return "text-amber-800 bg-amber-100 border border-amber-200";
  return "text-red-800 bg-red-100 border border-red-200";
}
