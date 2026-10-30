"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Clock,
  User,
  Activity,
  Layers,
  Zap,
  Key,
} from "lucide-react";
import { fetchApi, queryKeys } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string }>;
}

export default function ProjectActivityPage({ params }: PageProps) {
  const { orgId, projectId } = use(params);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.projects.activity(orgId, projectId),
    queryFn: () =>
      fetchApi<{ activity: { action: string; at: string; user: string | null }[] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/activity`
      ),
  });

  if (isLoading) return <LoadingState message="Loading project activity timeline..." />;

  if (error || !data) {
    return (
      <ErrorState
        title="Failed to load activity"
        description={(error as any)?.message || "Could not retrieve activity stream."}
        onRetry={refetch}
      />
    );
  }

  const activities = data.activity || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Activity Log"
        description="Chronological audit history of service registrations, key rotations, and load test events."
      />

      {activities.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity recorded yet"
          description="Administrative mutations and benchmark runs on this project will be recorded here."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="relative border-l border-border pl-6 space-y-6">
            {activities.map((item, idx) => (
              <div key={idx} className="relative group">
                {/* Dot */}
                <div className="absolute -left-[31px] top-1.5 size-2.5 rounded-full border-2 border-background bg-brand" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {item.action}
                    </Badge>
                    <span className="text-xs text-foreground font-medium">
                      Executed by <span className="text-brand">{item.user || "System Operator"}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                    <Clock className="size-3" />
                    <span>{new Date(item.at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
