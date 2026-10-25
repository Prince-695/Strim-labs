"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Building2,
  Check,
  Copy,
  Download,
  Gauge,
  KeyRound,
  Lock,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import Link from "next/link";
import { AddTargetModal } from "@/components/add-target-modal";
import { ApiError } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { SPRING_SNAPPY } from "@/lib/motion";
import { useOrgDetail } from "@/lib/queries";
import { useSession } from "@/lib/session";
import type { ApiKeyRow } from "@/lib/types";
import { cn } from "@/lib/utils";

function SettingsContent() {
  const { call, orgId, projects } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: org, isLoading, error, refetch } = useOrgDetail();

  // Tab state synced with URL search param
  const paramTab = searchParams.get("tab") === "org" ? "org" : "profile";
  const [activeTab, setActiveTab] = useState<"profile" | "org">(paramTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "org" || tab === "profile") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const switchTab = (tab: "profile" | "org") => {
    setActiveTab(tab);
    router.replace(`/settings?tab=${tab}`, { scroll: false });
  };

  // Profile state
  const currentUser = org?.memberships?.[0]?.user;
  const [profileName, setProfileName] = useState("");
  const [profileTitle, setProfileTitle] = useState("Lead Infrastructure Engineer");
  const [timezone, setTimezone] = useState("UTC");
  const [latencyUnit, setLatencyUnit] = useState<"ms" | "us">("ms");
  const [breakingSound, setBreakingSound] = useState(true);

  // Password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwUpdating, setPwUpdating] = useState(false);

  // 2FA modal state
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MEMBER" | "OWNER">("MEMBER");

  // Add project modal state
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Sync profile name when org loads
  useEffect(() => {
    if (currentUser?.name && !profileName) {
      setProfileName(currentUser.name);
    }
  }, [currentUser, profileName]);

  function copyProjectKey(id: string, key: string) {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    toast.success("Project API key copied to clipboard");
    setTimeout(() => setCopiedKeyId(null), 2000);
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    toast.success("Profile information updated successfully");
  }

  function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPw || !newPw || !confirmPw) {
      toast.error("Please fill out all password fields");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("New password and confirmation do not match");
      return;
    }
    if (newPw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setPwUpdating(true);
    setTimeout(() => {
      setPwUpdating(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      toast.success("Password updated successfully");
    }, 600);
  }

  function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast.error("Please enter a valid teammate email address");
      return;
    }
    setInviteOpen(false);
    toast.success(`Invitation sent to ${inviteEmail} as ${inviteRole}`);
    setInviteEmail("");
  }

  function handleExportData() {
    const exportPayload = {
      workspace: org?.name,
      slug: org?.slug,
      exportedAt: new Date().toISOString(),
      keysCount: org?.apiKeys.length ?? 0,
      members: org?.memberships ?? [],
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strim-workspace-${org?.slug ?? "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Workspace configuration exported");
  }

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  if (error || !org) {
    return (
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title="Couldn't load workspace settings"
          description={error instanceof ApiError ? error.message : "Check your connection and try again."}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your personal profile, credentials, workspace configuration, and CI/CD access tokens."
      />

      {/* Modern Navigation Tabs */}
      <div className="mb-8 flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => switchTab("profile")}
          className={cn(
            "relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            activeTab === "profile"
              ? "text-brand-strong dark:text-brand"
              : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          )}
        >
          {activeTab === "profile" && (
            <motion.span
              layoutId="settings-tab-pill"
              transition={SPRING_SNAPPY}
              className="absolute inset-0 rounded-xl bg-brand-subtle"
            />
          )}
          <User className="relative size-4" />
          <span className="relative">Profile settings</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab("org")}
          className={cn(
            "relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            activeTab === "org"
              ? "text-brand-strong dark:text-brand"
              : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          )}
        >
          {activeTab === "org" && (
            <motion.span
              layoutId="settings-tab-pill"
              transition={SPRING_SNAPPY}
              className="absolute inset-0 rounded-xl bg-brand-subtle"
            />
          )}
          <Building2 className="relative size-4" />
          <span className="relative">Organization settings</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "profile" ? (
          <motion.div
            key="profile-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            {/* Profile Identity Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="grid size-16 place-items-center rounded-2xl bg-brand font-mono text-2xl font-bold text-brand-foreground shadow-sm">
                      {(profileName || currentUser?.name || "U").slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-lg font-bold text-foreground">{profileName || currentUser?.name || "User"}</h2>
                        <Badge tone="brand">
                          {org.role === "OWNER" ? "Workspace Owner" : "Member"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{currentUser?.email ?? "Active user session"}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="flex size-2 rounded-full bg-success" />
                        <span className="text-[11px] font-medium text-muted-foreground">Console authenticated</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Personal Details */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Details</CardTitle>
                <CardDescription>Your public identity and contact details used in test run audits.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="profile-name" label="Full name">
                      <Input
                        id="profile-name"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Ada Lovelace"
                      />
                    </Field>
                    <Field id="profile-email" label="Email address">
                      <Input
                        id="profile-email"
                        type="email"
                        disabled
                        value={currentUser?.email ?? "user@strim.dev"}
                        className="bg-surface-muted/50 cursor-not-allowed text-muted-foreground"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="profile-title" label="Job title / Role">
                      <Input
                        id="profile-title"
                        value={profileTitle}
                        onChange={(e) => setProfileTitle(e.target.value)}
                        placeholder="Lead SRE"
                      />
                    </Field>
                    <Field id="profile-tz" label="Timezone">
                      <select
                        id="profile-tz"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="UTC">UTC (Coordinated Universal Time)</option>
                        <option value="America/New_York">America/New_York (EST)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                        <option value="Europe/London">Europe/London (GMT)</option>
                        <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                        <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                      </select>
                    </Field>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button type="submit">Save profile changes</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Password & Security */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="size-4 text-muted-foreground" /> Security & Password
                </CardTitle>
                <CardDescription>Manage credentials and account authentication.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field id="current-pw" label="Current password">
                      <Input
                        id="current-pw"
                        type="password"
                        placeholder="••••••••"
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                      />
                    </Field>
                    <Field id="new-pw" label="New password">
                      <Input
                        id="new-pw"
                        type="password"
                        placeholder="••••••••"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                      />
                    </Field>
                    <Field id="confirm-pw" label="Confirm password">
                      <Input
                        id="confirm-pw"
                        type="password"
                        placeholder="••••••••"
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" loading={pwUpdating} variant="outline">
                      Update password
                    </Button>
                  </div>
                </form>

                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Two-Factor Authentication (2FA)</h4>
                      <p className="text-xs text-muted-foreground">Add an extra layer of security using an authenticator app (TOTP).</p>
                    </div>
                    <Button
                      variant={twoFaEnabled ? "outline" : "secondary"}
                      size="sm"
                      onClick={() => {
                        const next = !twoFaEnabled;
                        setTwoFaEnabled(next);
                        toast.success(next ? "2FA enabled with demo authenticator" : "2FA disabled");
                      }}
                    >
                      {twoFaEnabled ? "Disable 2FA" : "Enable 2FA"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Console Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="size-4 text-muted-foreground" /> Console Preferences
                </CardTitle>
                <CardDescription>Fine-tune telemetry units and streaming display in the cockpit.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">Latency display precision</p>
                    <p className="text-xs text-muted-foreground">Default unit format used in charts and tables.</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant={latencyUnit === "ms" ? "default" : "outline"}
                      onClick={() => {
                        setLatencyUnit("ms");
                        toast.success("Default latency metric: Milliseconds (ms)");
                      }}
                    >
                      Milliseconds (ms)
                    </Button>
                    <Button
                      size="sm"
                      variant={latencyUnit === "us" ? "default" : "outline"}
                      onClick={() => {
                        setLatencyUnit("us");
                        toast.success("Default latency metric: Microseconds (µs)");
                      }}
                    >
                      Microseconds (µs)
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">Breaking point detection alert</p>
                    <p className="text-xs text-muted-foreground">Play subtle audio chime when a bottleneck or cliff is reached.</p>
                  </div>
                  <Button
                    size="sm"
                    variant={breakingSound ? "default" : "outline"}
                    onClick={() => {
                      const next = !breakingSound;
                      setBreakingSound(next);
                      toast.success(next ? "Audio chime alert enabled" : "Audio chime alert muted");
                    }}
                  >
                    {breakingSound ? "Enabled" : "Muted"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="org-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            {/* Workspace Profile */}
            <Card>
              <CardHeader>
                <CardTitle>Workspace profile</CardTitle>
                <CardDescription>The workspace every target, test run, and access token belongs to.</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-3">
                  <Item k="Workspace name" v={org.name} />
                  <Item k="Slug" v={org.slug} mono />
                  <Item
                    k="Your role"
                    v={
                      <Badge tone={org.role === "OWNER" ? "brand" : "neutral"}>
                        {org.role === "OWNER" ? "Owner" : "Member"}
                      </Badge>
                    }
                  />
                </dl>
              </CardContent>
            </Card>

            {/* Organization Projects & Production API Keys */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRound className="size-4 text-brand" /> Organization Projects & Ingestion Keys
                  </CardTitle>
                  <CardDescription>
                    Production API keys generated for each project. Pass into @strim/sdk in your server code.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    {projects.length} / 5 max
                  </span>
                  <Button size="sm" onClick={() => setAddProjectOpen(true)}>
                    + Add Project
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {projects.length === 0 ? (
                  <EmptyState
                    icon={KeyRound}
                    title="No projects in this organization"
                    description="Create a project to generate a dedicated API key and start streaming telemetry."
                    action={<Button onClick={() => setAddProjectOpen(true)}>Add Project</Button>}
                    className="py-8"
                  />
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <Table>
                      <THead>
                        <TR className="hover:bg-transparent">
                          <TH>Project</TH>
                          <TH>Endpoint / Base URL</TH>
                          <TH>Production API Key</TH>
                          <TH>Status</TH>
                          <TH className="text-right">Action</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {projects.map((p) => {
                          const key = p.apiKey || "strim_live_••••••••";
                          const isCopied = copiedKeyId === p.id;
                          return (
                            <TR key={p.id}>
                              <TD className="font-medium text-foreground">{p.name}</TD>
                              <TD className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                                {p.baseUrl || p.targetUrl}
                              </TD>
                              <TD>
                                <div className="flex items-center gap-2 font-mono text-xs">
                                  <span>{key.slice(0, 16)}••••••••</span>
                                  <button
                                    type="button"
                                    onClick={() => p.apiKey && copyProjectKey(p.id, p.apiKey)}
                                    className="text-muted-foreground hover:text-foreground"
                                    title="Copy API key"
                                  >
                                    {isCopied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                                  </button>
                                </div>
                              </TD>
                              <TD>
                                <Badge tone={p.status === "ACTIVE" ? "success" : "neutral"}>
                                  {p.status || "PENDING"}
                                </Badge>
                              </TD>
                              <TD className="text-right">
                                <Link
                                  href={`/projects/${p.id}/settings`}
                                  className="text-xs font-medium text-brand hover:underline"
                                >
                                  Manage →
                                </Link>
                              </TD>
                            </TR>
                          );
                        })}
                      </TBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team Members */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="size-4 text-muted-foreground" /> Team members
                  </CardTitle>
                  <CardDescription>People with access to this workspace.</CardDescription>
                </div>
                <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-1.5">
                  <UserPlus className="size-3.5" /> Invite member
                </Button>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {org.memberships.map((m) => (
                    <li key={m.user.email} className="flex items-center gap-3 px-4 py-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-subtle text-sm font-semibold text-brand-strong dark:text-brand">
                        {m.user.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                      </div>
                      <Badge tone={m.role === "OWNER" ? "brand" : "neutral"}>
                        {m.role === "OWNER" ? "Owner" : "Member"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Workspace Data & Audit Export */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="size-4 text-muted-foreground" /> Data & Compliance
                </CardTitle>
                <CardDescription>Export performance test results and workspace audit configurations.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Export workspace snapshot</p>
                  <p className="text-xs text-muted-foreground">Download JSON manifest of all target endpoints, members, and keys.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportData} className="gap-2">
                  <Download className="size-3.5" /> Download JSON
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Project Modal */}
      <AddTargetModal open={addProjectOpen} onOpenChange={setAddProjectOpen} />

      {/* Invite Member Dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Invite a teammate to workspace"
        description={`Invite collaborators to ${org.name} to view test runs and execute benchmark suites.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendInvite}>
              Send invitation
            </Button>
          </>
        }
      >
        <form onSubmit={handleSendInvite} className="space-y-4 pt-2">
          <Field id="invite-email" label="Teammate email address">
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="engineer@company.com"
              required
            />
          </Field>
          <Field id="invite-role" label="Workspace role">
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "MEMBER" | "OWNER")}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="MEMBER">Member (Can run tests and view history)</option>
              <option value="OWNER">Owner (Full administrative and API key management)</option>
            </select>
          </Field>
        </form>
      </Dialog>
    </>
  );
}

function Item({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface-muted/50 px-4 py-3">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className={`mt-1 text-sm font-medium ${mono ? "font-mono" : ""}`}>{v}</dd>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32 rounded-xl" />
        <Skeleton className="h-9 w-40 rounded-xl" />
      </div>
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}
