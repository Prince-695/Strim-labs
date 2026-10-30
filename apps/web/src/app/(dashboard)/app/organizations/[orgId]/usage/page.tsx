"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart,
  Layers,
  Building,
  Activity,
  Zap,
  Key,
  Calendar,
  Clock,
  Sparkles,
  Shield,
  ArrowUpRight,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default function OrganizationUsagePage({ params }: PageProps) {
  const { orgId } = use(params);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.organizations.usage(orgId),
    queryFn: () =>
      fetchApi<Schemas["Usage"]>(`/api/v1/organizations/${orgId}/usage`),
  });

  if (isLoading) return <LoadingState message="Calculating organization quota utilization..." />;

  if (error || !data) {
    return (
      <ErrorState
        title="Failed to load usage & quotas"
        description={(error as any)?.message || "Could not retrieve consumption metrics."}
        onRetry={refetch}
      />
    );
  }

  const quotaItems = [
    {
      title: "Projects",
      used: data.projects.used,
      limit: data.projects.limit,
      unit: "projects",
      desc: "Maximum 5 projects per organization",
      icon: Layers,
    },
    {
      title: "Organization Memberships",
      used: data.organizations.used,
      limit: data.organizations.limit,
      unit: "organizations",
      desc: "Maximum 3 organization memberships per account",
      icon: Building,
    },
    {
      title: "Telemetry Ingestion",
      used: data.ingestEventsPerMonth.used,
      limit: data.ingestEventsPerMonth.limit,
      unit: "events / mo",
      desc: "OTel and SDK request telemetry events",
      icon: Activity,
    },
    {
      title: "Load Testing Capacity",
      used: data.loadTestMinutesPerMonth.used,
      limit: data.loadTestMinutesPerMonth.limit,
      unit: "minutes / mo",
      desc: "Distributed load generator execution time",
      icon: Zap,
    },
    {
      title: "API Keys",
      used: data.apiKeysPerOrg.used,
      limit: data.apiKeysPerOrg.limit,
      unit: "keys",
      desc: "Active service and ingestion credentials",
      icon: Key,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Quotas &amp; Resource Usage"
        description="Monitor tenant resource consumption, billing tier limits, and monthly replenishment schedules."
        badge={
          <Badge variant="default" className="font-mono text-xs">
            {data.plan} TIER
          </Badge>
        }
      />

      {/* Plan Overview Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Current Plan:</span>
            <span className="text-sm font-bold text-brand">{data.plan}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Telemetry data retention: <span className="font-semibold text-foreground">{data.retentionDays} days</span>.
            Quota period resets on <span className="font-semibold text-foreground">{new Date(data.resetAt).toLocaleDateString()}</span>.
          </p>
        </div>

        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
          <span>Manage Subscription</span>
          <ArrowUpRight className="size-3.5" />
        </Button>
      </div>

      {/* Quotas Progress Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {quotaItems.map((item) => {
          const percentage = Math.min(100, Math.round((item.used / item.limit) * 100));
          const isWarning = percentage >= 80;
          const isExceeded = percentage >= 100;

          return (
            <div
              key={item.title}
              className="flex flex-col justify-between rounded-xl border border-border bg-card p-5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className="size-4 text-brand" />
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  </div>
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {item.used.toLocaleString()} / {item.limit.toLocaleString()} {item.unit}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                  <span>Usage: {percentage}%</span>
                  <span>{item.limit - item.used > 0 ? `${(item.limit - item.used).toLocaleString()} available` : "Limit reached"}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isExceeded
                        ? "bg-rose-500"
                        : isWarning
                        ? "bg-amber-500"
                        : "bg-brand"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
