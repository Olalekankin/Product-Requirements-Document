import React from "react";
import { useGetDashboardStats, useGetRecentActivity, useGetJobsByStatus, useTriggerScan, getGetDashboardStatsQueryKey, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Button, Badge } from "@/components/ui/core";
import { formatTimeAgo } from "@/lib/utils";
import { getStatusColor, getStatusLabel } from "@/lib/formatters";
import { Play, Activity, Target, Briefcase, BarChart3, Database, PieChart } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

function toActivityItems(value: unknown): Array<{
  id: string | number;
  type: string;
  jobTitle: string;
  company: string;
  jobId?: string | number | null;
  meta?: string | null;
  timestamp: string;
}> {
  if (Array.isArray(value)) {
    return value.filter(Boolean) as Array<{
      id: string | number;
      type: string;
      jobTitle: string;
      company: string;
      jobId?: string | number | null;
      meta?: string | null;
      timestamp: string;
    }>;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const maybeItems = record.items;
    if (Array.isArray(maybeItems)) {
      return maybeItems.filter(Boolean) as Array<{
        id: string | number;
        type: string;
        jobTitle: string;
        company: string;
        jobId?: string | number | null;
        meta?: string | null;
        timestamp: string;
      }>;
    }
  }

  return [];
}

function toStatusCounts(value: unknown): Array<{ status: string; count: number }> {
  if (Array.isArray(value)) {
    return value.filter(Boolean) as Array<{ status: string; count: number }>;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const maybeItems = record.items;
    if (Array.isArray(maybeItems)) {
      return maybeItems.filter(Boolean) as Array<{ status: string; count: number }>;
    }
  }

  return [];
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activityData, isLoading: activityLoading } = useGetRecentActivity({ limit: 10 });
  const { data: statusCountsData } = useGetJobsByStatus();
  const triggerScan = useTriggerScan();
  const activity = toActivityItems(activityData);
  const statusCounts = toStatusCounts(statusCountsData);

  const handleTriggerScan = () => {
    toast.promise(
      triggerScan.mutateAsync(undefined as unknown as void),
      {
        loading: 'Initializing scan...',
        success: () => {
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey({ limit: 10 }) });
          return 'Scanner started successfully';
        },
        error: 'Failed to trigger scan'
      }
    );
  };

  if (statsLoading || activityLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-pulse">
        <div className="h-10 w-48 bg-muted rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted rounded-lg"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader 
        title="Command Center" 
        description={`Last scan completed ${formatTimeAgo(stats?.lastScanAt)}`}
        actions={
          <Button onClick={handleTriggerScan} disabled={triggerScan.isPending}>
            <Play className="w-4 h-4 mr-2" fill="currentColor" />
            Trigger Scan
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          title="Total Jobs" 
          value={stats?.totalJobs ?? 0} 
          icon={<Briefcase className="w-5 h-5" />} 
          trend={`+${stats?.jobsThisWeek ?? 0} this week`}
        />
        <StatCard 
          title="New Opportunities" 
          value={stats?.newJobs ?? 0} 
          icon={<Activity className="w-5 h-5 text-blue-500" />} 
        />
        <StatCard 
          title="In Pipeline" 
          value={(stats?.interestedJobs ?? 0) + (stats?.appliedJobs ?? 0)} 
          icon={<Target className="w-5 h-5 text-amber-500" />} 
          description={`${stats?.appliedJobs ?? 0} applied`}
        />
        <StatCard 
          title="Avg Relevance" 
          value={stats?.averageRelevance ? `${Math.round(stats.averageRelevance)}%` : "N/A"} 
          icon={<BarChart3 className="w-5 h-5 text-green-500" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-muted-foreground" />
                Recent Intelligence
              </h2>
              <Link href="/jobs" className="text-sm text-primary hover:underline font-medium">View all jobs →</Link>
            </div>
            
            {activity && activity.length > 0 ? (
              <div className="space-y-4">
                {activity.map((item) => (
                  <div key={item.id} className="flex gap-4 p-3 hover:bg-muted/50 rounded-md transition-colors">
                    <div className="mt-1">
                      {item.type === 'discovered' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                      {item.type === 'status_changed' && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                      {item.type === 'summarized' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                      {item.type === 'favorited' && <div className="w-2 h-2 rounded-full bg-yellow-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.jobId ? (
                          <Link href={`/jobs/${item.jobId}`} className="hover:text-primary transition-colors block truncate">
                            {item.jobTitle}
                          </Link>
                        ) : (
                          item.jobTitle
                        )}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="font-semibold text-foreground/70">{item.company}</span>
                        <span>•</span>
                        <span>{formatTimeAgo(item.timestamp)}</span>
                        {item.meta && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] truncate max-w-[150px] block">{item.meta}</Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No recent activity found. Trigger a scan to discover jobs.
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Pipeline Status</h2>
              </div>
            </div>
            {statusCounts && statusCounts.length > 0 ? (
              <div className="space-y-3">
                {statusCounts.map((sc, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Badge variant={getStatusColor(sc.status as any)}>{getStatusLabel(sc.status as any)}</Badge>
                    <span className="text-sm font-bold">{sc.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">No jobs in pipeline</div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6 border-b border-border pb-4">
              <Database className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Top Sources</h2>
            </div>
            {stats?.topSources && stats.topSources.length > 0 ? (
              <div className="space-y-4">
                {stats.topSources.map((source, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                        {i + 1}
                      </div>
                      <span className="text-sm font-medium">{source.source}</span>
                    </div>
                    <Badge variant="secondary">{source.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">No source data yet</div>
            )}
            <div className="mt-6 pt-4 border-t border-border">
              <Link href="/sources" className="text-sm text-primary hover:underline font-medium block text-center">
                Manage Sources
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, description, trend }: { title: string, value: string | number, icon: React.ReactNode, description?: string, trend?: string }) {
  return (
    <Card className="p-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-500">
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-16 h-16" })}
      </div>
      <div className="relative z-10">
        <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
          {icon} {title}
        </p>
        <h3 className="text-3xl font-bold tracking-tight text-foreground">{value}</h3>
        {(description || trend) && (
          <p className="text-xs text-muted-foreground mt-2 font-medium">
            {trend && <span className="text-green-600 mr-1">{trend}</span>}
            {description}
          </p>
        )}
      </div>
    </Card>
  );
}
