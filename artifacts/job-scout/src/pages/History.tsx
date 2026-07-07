import React from "react";
import { useListSchedulerRuns, useGetSchedulerStatus } from "@workspace/api-client-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge } from "@/components/ui/core";
import { formatDate, formatTimeAgo } from "@/lib/utils";
import { Activity, Clock, PlayCircle, CheckCircle2, AlertCircle, Calendar } from "lucide-react";

export default function History() {
  const { data: status, isLoading: statusLoading } = useGetSchedulerStatus();
  const { data: runs, isLoading: runsLoading } = useListSchedulerRuns({ limit: 50 });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader 
        title="Scanner History" 
        description="Audit log of background worker executions."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6 border-l-4 border-l-primary flex items-center gap-4">
          <div className={`p-3 rounded-full ${status?.isRunning ? 'bg-primary/20 text-primary animate-pulse' : 'bg-muted text-muted-foreground'}`}>
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Current State</p>
            <p className="text-lg font-bold text-foreground">
              {statusLoading ? "Checking..." : status?.isRunning ? "Scanning Now" : "Idle"}
            </p>
          </div>
        </Card>
        
        <Card className="p-6 flex items-center gap-4">
          <div className="p-3 rounded-full bg-blue-100 text-blue-700">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Next Scheduled Run</p>
            <p className="text-lg font-bold text-foreground">
              {status?.nextRunAt ? formatTimeAgo(status.nextRunAt) : "Manual Trigger"}
            </p>
          </div>
        </Card>

        <Card className="p-6 flex items-center gap-4">
          <div className="p-3 rounded-full bg-green-100 text-green-700">
            <PlayCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Runs Today</p>
            <p className="text-lg font-bold text-foreground">
              {status?.totalRunsToday || 0} Executions
            </p>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 bg-muted/30 border-b border-border font-bold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" /> Execution Log
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-card text-muted-foreground uppercase font-mono text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="px-6 py-3 font-bold">Status</th>
                <th className="px-6 py-3 font-bold">Started At</th>
                <th className="px-6 py-3 font-bold">Duration</th>
                <th className="px-6 py-3 font-bold text-right">Jobs Found</th>
                <th className="px-6 py-3 font-bold text-right">New Added</th>
                <th className="px-6 py-3 font-bold text-right">Duplicates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runsLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground animate-pulse">Loading run history...</td>
                </tr>
              ) : (!runs || runs.length === 0) ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No execution history found.</td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      {run.status === 'running' && <Badge variant="info" className="gap-1"><Activity className="w-3 h-3 animate-spin" /> RUNNING</Badge>}
                      {run.status === 'completed' && <Badge variant="success" className="gap-1 bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3" /> OK</Badge>}
                      {run.status === 'failed' && <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> FAILED</Badge>}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {formatDate(run.startedAt)}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground font-mono">
                      {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "-"}
                    </td>
                    <td className="px-6 py-4 text-right font-bold">
                      {run.jobsFound}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-green-600">
                      +{run.jobsAdded}
                    </td>
                    <td className="px-6 py-4 text-right text-muted-foreground">
                      {run.jobsDuplicated || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
