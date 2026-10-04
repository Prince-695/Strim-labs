"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGsap } from "@/hooks/use-gsap";
import gsap from "gsap";
import {
  Building2,
  Users,
  ShieldCheck,
  Plus,
  ArrowRight,
  Server,
  Layers,
  Globe,
  Mail,
  CheckCircle2,
} from "lucide-react";

export default function OrganizationPage() {
  const { orgs, orgId } = useSession();
  const currentOrg = orgs.find((o) => o.id === orgId) ?? orgs[0];

  const containerRef = useGsap<HTMLDivElement>((el) => {
    gsap.from(el.querySelectorAll(".org-section"), {
      y: 20,
      autoAlpha: 0,
      stagger: 0.1,
      duration: 0.45,
      ease: "power2.out",
    });
  });

  const [orgName, setOrgName] = useState(currentOrg?.name ?? "Acme Corp");
  const [orgSlug, setOrgSlug] = useState(currentOrg?.slug ?? "acme");
  const [savedOrg, setSavedOrg] = useState(false);

  // Invite Modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [invitedSuccess, setInvitedSuccess] = useState(false);

  function handleSaveOrg(e: React.FormEvent) {
    e.preventDefault();
    setSavedOrg(true);
    setTimeout(() => setSavedOrg(false), 2500);
  }

  function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInvitedSuccess(true);
    setTimeout(() => {
      setInvitedSuccess(false);
      setInviteOpen(false);
      setInviteEmail("");
    }, 1500);
  }

  return (
    <div ref={containerRef} className="space-y-6 max-w-4xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-extrabold tracking-tight text-foreground">
            Organization
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your workspace organization profile, member access, and team settings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setInviteOpen(true)}
            className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white cursor-pointer gap-2 text-xs font-semibold shadow-xs"
          >
            <Plus className="size-4" />
            Invite Member
          </Button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="org-section p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Team Size</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-foreground">4 Members</span>
            <Users className="size-4 text-brand-pink" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">1 Owner, 1 Admin, 2 Members</p>
        </div>

        <div className="org-section p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subscription Tier</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-emerald-500">Enterprise</span>
            <Badge variant="outline" className="text-[9px] rounded-full text-emerald-600 border-emerald-500/30">
              Active
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Unlimited simulations & rollouts</p>
        </div>

        <div className="org-section p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Environments</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-foreground">2 Active</span>
            <Globe className="size-4 text-sky-500" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Production and Staging</p>
        </div>
      </div>

      {/* Organization Details Form */}
      <Card className="org-section rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="py-4 px-6 border-b border-border/70 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-brand-pink/10 text-brand-pink flex items-center justify-center">
              <Building2 className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-heading font-bold text-foreground">
                Organization Details
              </CardTitle>
              <CardDescription className="text-xs">
                General information and identifiers for this workspace.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSaveOrg} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="orgNameInput" className="text-xs font-semibold">
                  Organization Name
                </Label>
                <Input
                  id="orgNameInput"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="orgSlugInput" className="text-xs font-semibold">
                  Workspace Slug
                </Label>
                <Input
                  id="orgSlugInput"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  className="rounded-xl h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-secondary/50 border border-border/60 text-xs flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground">Organization ID:</span>
                <span className="font-mono text-muted-foreground ml-2">{orgId ?? "org_default_acme"}</span>
              </div>
              <Badge variant="outline" className="text-[10px] rounded-full">
                Primary Workspace
              </Badge>
            </div>

            <div className="flex items-center justify-between pt-2">
              {savedOrg ? (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" /> Organization details updated!
                </span>
              ) : <div />}
              <Button
                type="submit"
                className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white cursor-pointer text-xs font-semibold px-4 h-9 shadow-xs"
              >
                Save Details
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Team & RBAC Gateway Card */}
      <Card className="org-section rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="py-4 px-6 border-b border-border/70 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-heading font-bold text-foreground">
                Team Members & Roles (RBAC)
              </CardTitle>
              <CardDescription className="text-xs">
                Manage who has access to this workspace and their permission levels.
              </CardDescription>
            </div>
          </div>

          <Link
            href="/organization/team"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-colors cursor-pointer"
          >
            <span>Manage Team</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { role: "Owner", desc: "Full administrative and billing control", count: 1 },
              { role: "Admin", desc: "Can manage apps, deployments, and rules", count: 1 },
              { role: "Member", desc: "Can run simulations and create change plans", count: 2 },
              { role: "Viewer", desc: "Read-only access to metrics and logs", count: 0 },
            ].map((r) => (
              <div key={r.role} className="p-3.5 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-heading font-bold text-xs text-foreground">{r.role}</span>
                  <Badge variant="secondary" className="text-[10px] font-mono font-bold">
                    {r.count}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{r.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invite Member Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Invite Team Member</DialogTitle>
            <DialogDescription className="text-xs">
              Send an email invitation to join your workspace.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendInvite} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invEmail" className="text-xs font-semibold">
                Work Email Address
              </Label>
              <div className="relative">
                <Input
                  id="invEmail"
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="rounded-xl h-9 text-xs pl-9"
                />
                <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invRole" className="text-xs font-semibold">
                Access Role
              </Label>
              <select
                id="invRole"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full h-9 rounded-xl border border-border bg-secondary/50 px-2.5 text-xs text-foreground outline-none cursor-pointer"
              >
                <option value="MEMBER">Member (Can simulate and propose rollouts)</option>
                <option value="ADMIN">Admin (Can configure apps, rules, and rollouts)</option>
                <option value="VIEWER">Viewer (Read-only access to dashboards)</option>
              </select>
            </div>

            {invitedSuccess && (
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                <span>Invitation sent to {inviteEmail}!</span>
              </div>
            )}

            <DialogFooter className="pt-3 border-t border-border flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                className="rounded-xl cursor-pointer text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!inviteEmail.trim() || invitedSuccess}
                className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white cursor-pointer text-xs font-semibold"
              >
                Send Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
