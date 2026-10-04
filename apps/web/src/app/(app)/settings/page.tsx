"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useGsap } from "@/hooks/use-gsap";
import gsap from "gsap";
import {
  User,
  Mail,
  Lock,
  Bell,
  Palette,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  KeyRound,
} from "lucide-react";

export default function SettingsPage() {
  const { orgs, orgId } = useSession();
  const currentOrg = orgs.find((o) => o.id === orgId) ?? orgs[0];

  const containerRef = useGsap<HTMLDivElement>((el) => {
    gsap.from(el.querySelectorAll(".settings-section"), {
      y: 20,
      autoAlpha: 0,
      stagger: 0.1,
      duration: 0.45,
      ease: "power2.out",
    });
  });

  // Profile Form State
  const [name, setName] = useState("Priya Patel");
  const [email, setEmail] = useState("priya@acme.test");
  const [savedProfile, setSavedProfile] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savedPassword, setSavedPassword] = useState(false);

  // Notification Preferences
  const [notifyIncidents, setNotifyIncidents] = useState(true);
  const [notifyRollouts, setNotifyRollouts] = useState(true);
  const [notifyWeekly, setNotifyWeekly] = useState(false);

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavedProfile(true);
    setTimeout(() => setSavedProfile(false), 2500);
  }

  function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavedPassword(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => setSavedPassword(false), 2500);
  }

  return (
    <div ref={containerRef} className="space-y-6 max-w-4xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-extrabold tracking-tight text-foreground">
            Profile & Settings
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your personal profile, security credentials, and workspace preferences.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs font-semibold py-1 px-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          >
            <ShieldCheck className="size-3.5 mr-1 text-emerald-500" />
            Account Verified
          </Badge>
        </div>
      </div>

      {/* Profile Card */}
      <Card className="settings-section rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="py-4 px-6 border-b border-border/70 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-brand-pink/10 text-brand-pink flex items-center justify-center">
              <User className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-heading font-bold text-foreground">
                Personal Information
              </CardTitle>
              <CardDescription className="text-xs">
                Your display name and work email used across the team.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSaveProfile} className="space-y-5">
            {/* Avatar & Display Details */}
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-full bg-gradient-to-tr from-brand-pink to-brand-gold text-white font-bold text-xl flex items-center justify-center shrink-0 shadow-sm">
                {name.split(" ").map((n) => n[0]).join("") || "U"}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">{name}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] rounded-full uppercase tracking-wider font-bold">
                    {currentOrg?.role ?? "OWNER"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{currentOrg?.name ?? "Acme Corp"}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-xs font-semibold">
                  Display Name
                </Label>
                <Input
                  id="displayName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="displayEmail" className="text-xs font-semibold">
                  Email Address
                </Label>
                <Input
                  id="displayEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {savedProfile ? (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" /> Changes saved successfully!
                </span>
              ) : <div />}
              <Button
                type="submit"
                className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white cursor-pointer text-xs font-semibold px-4 h-9 shadow-xs"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password & Security Card */}
      <Card className="settings-section rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="py-4 px-6 border-b border-border/70 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Lock className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-heading font-bold text-foreground">
                Password & Security
              </CardTitle>
              <CardDescription className="text-xs">
                Update your login password to keep your account safe.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSavePassword} className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="currPass" className="text-xs font-semibold">
                Current Password
              </Label>
              <Input
                id="currPass"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                className="rounded-xl h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPass" className="text-xs font-semibold">
                New Password
              </Label>
              <Input
                id="newPass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="rounded-xl h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPass" className="text-xs font-semibold">
                Confirm New Password
              </Label>
              <Input
                id="confirmPass"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                className="rounded-xl h-9 text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {savedPassword ? (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" /> Password updated!
                </span>
              ) : <div />}
              <Button
                type="submit"
                disabled={!newPassword || newPassword !== confirmPassword}
                className="rounded-xl bg-[#0D0C22] text-white hover:opacity-90 dark:bg-white dark:text-[#0D0C22] cursor-pointer text-xs font-semibold px-4 h-9 shadow-xs"
              >
                Update Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Notifications Preferences */}
      <Card className="settings-section rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="py-4 px-6 border-b border-border/70 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Bell className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-heading font-bold text-foreground">
                Notification Preferences
              </CardTitle>
              <CardDescription className="text-xs">
                Choose when you want to receive alerts and email updates.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-border/60">
            <div>
              <p className="text-xs font-semibold text-foreground">Incident Alerts</p>
              <p className="text-[11px] text-muted-foreground">Receive real-time alerts when high-severity anomalies or errors occur.</p>
            </div>
            <input
              type="checkbox"
              checked={notifyIncidents}
              onChange={(e) => setNotifyIncidents(e.target.checked)}
              className="size-4 accent-brand-pink rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between py-2 border-b border-border/60">
            <div>
              <p className="text-xs font-semibold text-foreground">Deployment Updates</p>
              <p className="text-[11px] text-muted-foreground">Notifications when staged rollouts start, complete, or automatically roll back.</p>
            </div>
            <input
              type="checkbox"
              checked={notifyRollouts}
              onChange={(e) => setNotifyRollouts(e.target.checked)}
              className="size-4 accent-brand-pink rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-xs font-semibold text-foreground">Weekly Performance Digest</p>
              <p className="text-[11px] text-muted-foreground">A summary of system health, traffic volume, and latency improvements.</p>
            </div>
            <input
              type="checkbox"
              checked={notifyWeekly}
              onChange={(e) => setNotifyWeekly(e.target.checked)}
              className="size-4 accent-brand-pink rounded cursor-pointer"
            />
          </div>
        </CardContent>
      </Card>

      {/* Appearance Section */}
      <Card className="settings-section rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="py-4 px-6 border-b border-border/70 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Palette className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-heading font-bold text-foreground">
                Appearance & Theme
              </CardTitle>
              <CardDescription className="text-xs">
                Switch between light and dark themes.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">Interface Theme</p>
              <p className="text-[11px] text-muted-foreground">Toggle between light editorial mode and dark mode.</p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
