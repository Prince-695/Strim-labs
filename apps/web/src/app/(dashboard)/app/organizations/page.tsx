"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building, Plus, ArrowRight, Shield, Layers, Users, Calendar, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

export default function OrganizationsListPage() {
  const router = useRouter();
  const { orgs, switchOrg } = useAuth();

  const maxOrgs = 3;
  const isCapReached = orgs.length >= maxOrgs;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Manage your enterprise workspaces, team access, and shared project infrastructure."
        action={
          <Button
            size="sm"
            disabled={isCapReached}
            onClick={() => router.push("/app/organizations/new")}
            className="flex items-center gap-1.5"
          >
            <Plus className="size-4" />
            <span>New Organization</span>
          </Button>
        }
      />

      {/* Quota Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Building className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Workspace Quota</div>
            <div className="text-xs text-muted-foreground">
              Each user account is granted a maximum of {maxOrgs} organization memberships.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono font-medium text-muted-foreground">
            {orgs.length} / {maxOrgs} slots active
          </div>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full bg-brand transition-all duration-300"
              style={{ width: `${Math.min(100, (orgs.length / maxOrgs) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Organizations Grid */}
      {orgs.length === 0 ? (
        <EmptyState
          icon={Building}
          title="No organizations found"
          description="Create your first organization to invite teammates, register microservices, and run distributed load tests."
          action={{
            label: "Create Organization",
            onClick: () => router.push("/app/organizations/new"),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <div
              key={org.id}
              className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-all hover:border-brand/50 hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-surface-muted text-foreground font-semibold text-xs border border-border">
                      {org.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors">
                        {org.name}
                      </h3>
                      <p className="font-mono text-[11px] text-muted-foreground truncate max-w-[180px]">
                        {org.slug}
                      </p>
                    </div>
                  </div>
                  <Badge variant={org.plan === "ENTERPRISE" ? "default" : "secondary"} className="text-[10px] font-mono">
                    {org.plan}
                  </Badge>
                </div>

                {org.description && (
                  <p className="mt-3 text-xs text-muted-foreground line-clamp-2">
                    {org.description}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Layers className="size-3.5 text-brand" />
                    <span>{org.projectCount ?? 0} / 5 Projects</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5 text-brand" />
                    <span>{org.memberCount ?? 1} Members</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3">
                <Link
                  href={`/app/organizations/${org.id}/settings`}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Settings
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs group-hover:border-brand/40 group-hover:bg-brand/5 group-hover:text-brand"
                  onClick={() => {
                    switchOrg(org.id);
                    router.push(`/app/organizations/${org.id}`);
                  }}
                >
                  <span>Open Console</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
