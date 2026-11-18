"use client"

import * as React from "react"
import {
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api-client"
import { useAuthStore } from "@/lib/stores/auth-store"

export default function ProfileSettingsPage() {
  const { user, setUser } = useAuthStore()

  // Profile Form State
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [profileMessage, setProfileMessage] = React.useState<string | null>(null)
  const [profileError, setProfileError] = React.useState<string | null>(null)
  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false)

  // Password Form State
  const [oldPassword, setOldPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [passwordMessage, setPasswordMessage] = React.useState<string | null>(null)
  const [passwordError, setPasswordError] = React.useState<string | null>(null)
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false)

  // Profile Update Handler
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsUpdatingProfile(true)
      setProfileMessage(null)
      setProfileError(null)

      const effectiveFirst = firstName || user?.first_name || ""
      const effectiveLast = lastName || user?.last_name || ""

      await api.put("/users/update", {
        first_name: effectiveFirst,
        last_name: effectiveLast,
      })

      if (user) {
        setUser({
          ...user,
          first_name: effectiveFirst,
          last_name: effectiveLast,
        })
      }
      setProfileMessage("Profile updated successfully.")
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile.")
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  // Password Change Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsUpdatingPassword(true)
      setPasswordMessage(null)
      setPasswordError(null)

      await api.post("/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      })

      setPasswordMessage("Password changed successfully across all sessions.")
      setOldPassword("")
      setNewPassword("")
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password.")
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl font-mono text-xs">
      {/* Personal Info Card */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="pb-4 border-b border-border-subtle">
          <CardTitle className="text-sm font-semibold font-heading text-foreground">
            Personal Information
          </CardTitle>
          <CardDescription className="text-xs text-foreground-muted font-mono">
            Your name and account email used across organization workspaces.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          {profileMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-2.5 text-success">
              <CheckCircle2 className="size-4" />
              <span>{profileMessage}</span>
            </div>
          )}
          {profileError && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-danger">
              <AlertCircle className="size-4" />
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground-muted">First Name</Label>
                <Input
                  placeholder={user?.first_name || "First Name"}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="text-xs font-mono bg-surface-raised border-border-subtle"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground-muted">Last Name</Label>
                <Input
                  placeholder={user?.last_name || "Last Name"}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="text-xs font-mono bg-surface-raised border-border-subtle"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground-muted">Account Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 size-3.5 text-foreground-subtle" />
                <Input
                  value={user?.email || ""}
                  disabled
                  className="pl-8 text-xs font-mono bg-surface-raised/40 border-border-subtle opacity-70 cursor-not-allowed"
                />
              </div>
              <span className="text-[10px] text-foreground-subtle">
                Primary verified email address. Contact workspace admin to transfer ownership.
              </span>
            </div>

            <Button
              type="submit"
              disabled={isUpdatingProfile}
              className="bg-brand text-white hover:bg-brand-hover text-xs font-mono"
            >
              {isUpdatingProfile ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Profile Changes</span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Change Card */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="pb-4 border-b border-border-subtle">
          <CardTitle className="text-sm font-semibold font-heading text-foreground">
            Security & Password Rotation
          </CardTitle>
          <CardDescription className="text-xs text-foreground-muted font-mono">
            Update your account password to invalidate old sessions.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          {passwordMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-2.5 text-success">
              <CheckCircle2 className="size-4" />
              <span>{passwordMessage}</span>
            </div>
          )}
          {passwordError && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-danger">
              <AlertCircle className="size-4" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-foreground-muted">Current Password</Label>
              <Input
                type="password"
                placeholder="••••••••••••"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="text-xs font-mono bg-surface-raised border-border-subtle"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground-muted">New Password (Min. 8 characters)</Label>
              <Input
                type="password"
                placeholder="••••••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="text-xs font-mono bg-surface-raised border-border-subtle"
              />
            </div>

            <Button
              type="submit"
              disabled={isUpdatingPassword || !oldPassword || !newPassword}
              className="bg-brand text-white hover:bg-brand-hover text-xs font-mono"
            >
              {isUpdatingPassword ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Change Password</span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
