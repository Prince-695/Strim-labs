"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Users,
  Shield,
  ShieldCheck,
  Plus,
  ArrowLeft,
  Mail,
  CheckCircle2,
  MoreHorizontal,
  Trash2,
  UserCheck,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  lastActive: string;
  initials: string;
};

export default function TeamPage() {
  const { orgs, orgId } = useSession();
  const currentOrg = orgs.find((o) => o.id === orgId) ?? orgs[0];

  const containerRef = useGsap<HTMLDivElement>((el) => {
    gsap.from(el.querySelectorAll(".team-section"), {
      y: 20,
      autoAlpha: 0,
      stagger: 0.1,
      duration: 0.45,
      ease: "power2.out",
    });
  });

  const [members, setMembers] = useState<TeamMember[]>([
    {
      id: "usr_01",
      name: "Priya Patel",
      email: "priya@acme.test",
      role: "OWNER",
      lastActive: "Just now",
      initials: "PP",
    },
    {
      id: "usr_02",
      name: "Marcus Rivera",
      email: "marcus@globex.test",
      role: "ADMIN",
      lastActive: "2 hours ago",
      initials: "MR",
    },
    {
      id: "usr_03",
      name: "Sarah Chen",
      email: "sarah@acme.test",
      role: "MEMBER",
      lastActive: "Yesterday",
      initials: "SC",
    },
    {
      id: "usr_04",
      name: "David Kim",
      email: "david@acme.test",
      role: "MEMBER",
      lastActive: "3 days ago",
      initials: "DK",
    },
  ]);

  // Invite Modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER" | "VIEWER">("MEMBER");
  const [invitedSuccess, setInvitedSuccess] = useState(false);

  function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    const newMember: TeamMember = {
      id: `usr_${Date.now()}`,
      name: inviteName || inviteEmail.split("@")[0],
      email: inviteEmail,
      role: inviteRole,
      lastActive: "Invited",
      initials: (inviteName || inviteEmail.slice(0, 2)).toUpperCase().slice(0, 2),
    };
    setMembers([...members, newMember]);
    setInvitedSuccess(true);
    setTimeout(() => {
      setInvitedSuccess(false);
      setInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
    }, 1500);
  }

  function handleRoleChange(memberId: string, newRole: "ADMIN" | "MEMBER" | "VIEWER") {
    setMembers(
      members.map((m) => (m.id === memberId && m.role !== "OWNER" ? { ...m, role: newRole } : m))
    );
  }

  function handleRemoveMember(memberId: string) {
    setMembers(members.filter((m) => m.id !== memberId || m.role === "OWNER"));
  }

  return (
    <div ref={containerRef} className="space-y-6 max-w-5xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/organization"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-1.5 transition-colors"
          >
            <ArrowLeft className="size-3" /> Back to Organization
          </Link>
          <h1 className="text-2xl font-heading font-extrabold tracking-tight text-foreground">
            Team & Permissions (RBAC)
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage who has access to your workspace and assign roles to team members.
          </p>
        </div>

        <Button
          onClick={() => setInviteOpen(true)}
          className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white cursor-pointer gap-2 text-xs font-semibold shadow-xs"
        >
          <Plus className="size-4" />
          Invite Team Member
        </Button>
      </div>

      {/* Role Definitions Guide Card */}
      <Card className="team-section rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="py-3.5 px-6 border-b border-border/70 bg-muted/20">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-brand-pink" />
            <CardTitle className="text-xs font-heading font-bold text-foreground">
              Workspace Role Guide
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                role: "Owner",
                badge: "Full Control",
                badgeColor: "bg-brand-pink/10 text-brand-pink border-brand-pink/30",
                can: "Billing, workspace settings, team member roles, and all deployments.",
              },
              {
                role: "Admin",
                badge: "Manage",
                badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
                can: "Manage apps, create deployments, configure rules, and invite members.",
              },
              {
                role: "Member",
                badge: "Standard",
                badgeColor: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
                can: "Run simulations, view metrics, and propose deployments for review.",
              },
              {
                role: "Viewer",
                badge: "Read Only",
                badgeColor: "bg-secondary text-muted-foreground border-border",
                can: "View dashboards, request logs, and service maps. Cannot change configs.",
              },
            ].map((r) => (
              <div key={r.role} className="p-3 rounded-xl border border-border bg-card space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-xs text-foreground">{r.role}</span>
                  <Badge variant="outline" className={cn("text-[9px] font-bold rounded-full", r.badgeColor)}>
                    {r.badge}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{r.can}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Members Table Card */}
      <Card className="team-section rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="py-3 px-6 border-b border-border/70 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-brand-pink" />
            <CardTitle className="text-xs font-heading font-bold text-foreground">
              Team Members ({members.length})
            </CardTitle>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            {currentOrg?.name ?? "Acme Corp"}
          </span>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Member
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Role
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Last Active
                </TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id} className="hover:bg-secondary/30 transition-colors border-border/70">
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-gradient-to-tr from-brand-pink to-brand-gold text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {m.initials}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{m.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{m.email}</p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="py-3.5">
                    {m.role === "OWNER" ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-bold rounded-full bg-brand-pink/10 text-brand-pink border-brand-pink/30"
                      >
                        OWNER
                      </Badge>
                    ) : (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value as any)}
                        className="h-7 rounded-lg border border-border bg-secondary/50 px-2 text-xs font-semibold text-foreground outline-none cursor-pointer"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="MEMBER">MEMBER</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    )}
                  </TableCell>

                  <TableCell className="py-3.5 text-xs text-muted-foreground font-mono">
                    {m.lastActive}
                  </TableCell>

                  <TableCell className="py-3.5 text-right">
                    {m.role !== "OWNER" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(m.id)}
                        className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer h-7 px-2"
                        title="Remove member"
                      >
                        <Trash2 className="size-3.5 mr-1" /> Remove
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invite Member Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Invite Team Member</DialogTitle>
            <DialogDescription className="text-xs">
              Assign a role and invite a colleague to collaborate.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendInvite} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invName" className="text-xs font-semibold">
                Full Name
              </Label>
              <Input
                id="invName"
                placeholder="Alex Johnson"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="rounded-xl h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invEmailInput" className="text-xs font-semibold">
                Work Email Address
              </Label>
              <div className="relative">
                <Input
                  id="invEmailInput"
                  type="email"
                  required
                  placeholder="alex@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="rounded-xl h-9 text-xs pl-9"
                />
                <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invRoleSelect" className="text-xs font-semibold">
                Role & Permissions
              </Label>
              <select
                id="invRoleSelect"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
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
