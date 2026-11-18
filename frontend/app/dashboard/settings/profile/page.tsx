"use client"

import * as React from "react"
import {
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AtSign,
  Key,
  User,
  ShieldCheck,
  Sparkles,
  Lock,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { userApi } from "@/lib/user-api"
import { useAuthStore } from "@/lib/stores/auth-store"

export default function ProfileSettingsPage() {
  const { user, setUser, refreshProfile } = useAuthStore()

  // 1. Profile Form State
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [profileMessage, setProfileMessage] = React.useState<string | null>(null)
  const [profileError, setProfileError] = React.useState<string | null>(null)
  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false)

  // 2. Unique Username State
  const [usernameInput, setUsernameInput] = React.useState("")
  const [isCheckingUsername, setIsCheckingUsername] = React.useState(false)
  const [usernameAvailability, setUsernameAvailability] = React.useState<{
    checked: boolean
    available: boolean
    message?: string
  } | null>(null)
  const [usernameSuccess, setUsernameSuccess] = React.useState<string | null>(null)
  const [usernameError, setUsernameError] = React.useState<string | null>(null)
  const [isClaimingUsername, setIsClaimingUsername] = React.useState(false)

  // 3. Password Rotation Form State
  const [oldPassword, setOldPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [passwordMessage, setPasswordMessage] = React.useState<string | null>(null)
  const [passwordError, setPasswordError] = React.useState<string | null>(null)
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false)

  // Sync profile values when user loads
  React.useEffect(() => {
    if (user) {
      setFirstName(user.first_name || "")
      setLastName(user.last_name || "")
    }
  }, [user])

  // Profile Update Handler
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsUpdatingProfile(true)
      setProfileMessage(null)
      setProfileError(null)

      const effectiveFirst = firstName.trim() || user?.first_name || ""
      const effectiveLast = lastName.trim() || user?.last_name || ""

      const res = await userApi.updateProfile({
        first_name: effectiveFirst,
        last_name: effectiveLast,
      })

      if (user) {
        setUser({
          ...user,
          first_name: res.data?.first_name || effectiveFirst,
          last_name: res.data?.last_name || effectiveLast,
        })
      }
      setProfileMessage("Profile updated successfully.")
      setTimeout(() => setProfileMessage(null), 3000)
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile.")
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  // Debounced Username Availability Checker
  React.useEffect(() => {
    if (!usernameInput.trim()) {
      setUsernameAvailability(null)
      return
    }

    const clean = usernameInput.trim().toLowerCase()

    // Client-side regex format check: 3-20 chars, lowercase alphanumeric + underscore, starts with letter
    const usernameRegex = /^[a-z][a-z0-9_]{2,19}$/
    if (!usernameRegex.test(clean)) {
      if (clean.length < 3) {
        setUsernameAvailability({
          checked: true,
          available: false,
          message: "Username must be at least 3 characters",
        })
        return
      }
      if (!/^[a-z]/.test(clean)) {
        setUsernameAvailability({
          checked: true,
          available: false,
          message: "Username must start with a lowercase letter",
        })
        return
      }
      if (clean.length > 20) {
        setUsernameAvailability({
          checked: true,
          available: false,
          message: "Username cannot exceed 20 characters",
        })
        return
      }
      setUsernameAvailability({
        checked: true,
        available: false,
        message: "Only lowercase letters, numbers, and underscores are allowed",
      })
      return
    }

    const timer = setTimeout(async () => {
      try {
        setIsCheckingUsername(true)
        const res = await userApi.checkUsername(clean)
        const isAvail = Boolean(res.data?.available)
        setUsernameAvailability({
          checked: true,
          available: isAvail,
          message: isAvail
            ? `@${clean} is available to claim!`
            : `@${clean} is already taken or reserved`,
        })
      } catch {
        setUsernameAvailability({
          checked: true,
          available: false,
          message: "Could not verify username availability",
        })
      } finally {
        setIsCheckingUsername(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [usernameInput])

  // Claim Username Handler
  const handleClaimUsername = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = usernameInput.trim().toLowerCase()
    if (!clean || !usernameAvailability?.available) return

    try {
      setIsClaimingUsername(true)
      setUsernameError(null)
      setUsernameSuccess(null)

      const res = await userApi.setUsername(clean)

      if (user) {
        setUser({
          ...user,
          username: res.data?.username || clean,
        })
      }
      setUsernameSuccess(`@${clean} has been permanently registered to your account!`)
      setUsernameInput("")
      await refreshProfile()
    } catch (err: unknown) {
      setUsernameError(err instanceof Error ? err.message : "Failed to claim username.")
    } finally {
      setIsClaimingUsername(false)
    }
  }

  // Password Rotation Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match.")
      return
    }

    try {
      setIsUpdatingPassword(true)
      setPasswordMessage(null)
      setPasswordError(null)

      await userApi.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      })

      setPasswordMessage("Password changed successfully. All other active sessions have been revoked.")
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setPasswordMessage(null), 4000)
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password. Please check your current password.")
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl font-mono text-xs">
      {/* Section 1: Unique Username Claiming */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="pb-4 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-semibold font-heading text-foreground flex items-center gap-2">
                <AtSign className="size-4 text-brand" />
                <span>Unique Account Username</span>
              </CardTitle>
              <CardDescription className="text-xs text-foreground-muted font-mono">
                Your unique handle across workspaces, CLI profiles, and test audit logs.
              </CardDescription>
            </div>
            {user?.username && (
              <span className="flex items-center gap-1.5 rounded-full bg-success/15 border border-success/30 px-3 py-1 text-[11px] font-mono text-success">
                <ShieldCheck className="size-3.5" />
                <span>Claimed</span>
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          {usernameSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-2.5 text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{usernameSuccess}</span>
            </div>
          )}
          {usernameError && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-danger">
              <AlertCircle className="size-4 shrink-0" />
              <span>{usernameError}</span>
            </div>
          )}

          {user?.username ? (
            /* User already has a username registered */
            <div className="rounded-xl border border-border-subtle bg-surface-raised p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-foreground-subtle uppercase">
                  Registered Handle
                </span>
                <span className="text-[10px] text-foreground-subtle flex items-center gap-1">
                  <Lock className="size-3" />
                  <span>Permanent Handle</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-brand font-mono">
                  @{user.username}
                </span>
              </div>
              <p className="text-[11px] text-foreground-muted leading-relaxed">
                This unique handle is permanently claimed and linked to your primary developer credentials.
              </p>
            </div>
          ) : (
            /* User has not yet set a username */
            <form onSubmit={handleClaimUsername} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground-muted">Claim Unique Username</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-foreground-subtle font-mono text-xs">
                    @
                  </span>
                  <Input
                    placeholder="dev_alex, prince695..."
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                    className="pl-7 text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
                    disabled={isClaimingUsername}
                  />
                  {isCheckingUsername && (
                    <Loader2 className="absolute right-3 top-2.5 size-4 animate-spin text-foreground-subtle" />
                  )}
                </div>

                {/* Real-time availability indicator */}
                {usernameAvailability && (
                  <div
                    className={`flex items-center gap-2 text-[11px] font-mono ${
                      usernameAvailability.available ? "text-success" : "text-warning"
                    }`}
                  >
                    {usernameAvailability.available ? (
                      <CheckCircle2 className="size-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="size-3.5 shrink-0" />
                    )}
                    <span>{usernameAvailability.message}</span>
                  </div>
                )}

                <div className="rounded-lg border border-border-subtle bg-surface-raised/40 p-3 space-y-1 text-[11px] text-foreground-subtle">
                  <span className="font-semibold text-foreground-muted">Username Guidelines:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                    <li>Between 3 and 20 characters in length</li>
                    <li>Must start with a lowercase letter (a-z)</li>
                    <li>Can only contain lowercase letters, numbers, and underscores (_)</li>
                    <li>Cannot be changed once claimed</li>
                  </ul>
                </div>
              </div>

              <Button
                type="submit"
                disabled={!usernameAvailability?.available || isClaimingUsername || isCheckingUsername}
                className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5"
              >
                {isClaimingUsername ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    <span>Registering Handle...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    <span>Claim Unique Username</span>
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Personal Information */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="pb-4 border-b border-border-subtle">
          <CardTitle className="text-sm font-semibold font-heading text-foreground flex items-center gap-2">
            <User className="size-4 text-brand" />
            <span>Personal Information</span>
          </CardTitle>
          <CardDescription className="text-xs text-foreground-muted font-mono">
            Your name and primary account email used across organization workspaces.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          {profileMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-2.5 text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{profileMessage}</span>
            </div>
          )}
          {profileError && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-danger">
              <AlertCircle className="size-4 shrink-0" />
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
                  className="text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground-muted">Last Name</Label>
                <Input
                  placeholder={user?.last_name || "Last Name"}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
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
                Primary verified email address. Contact workspace admin to transfer organization ownership.
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

      {/* Section 3: Password Rotation & Security */}
      <Card id="security" className="border-border bg-surface shadow-xs">
        <CardHeader className="pb-4 border-b border-border-subtle">
          <CardTitle className="text-sm font-semibold font-heading text-foreground flex items-center gap-2">
            <Key className="size-4 text-brand" />
            <span>Security & Password Rotation</span>
          </CardTitle>
          <CardDescription className="text-xs text-foreground-muted font-mono">
            Change your account password. Successful rotation revokes existing sessions across all devices.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          {passwordMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-2.5 text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{passwordMessage}</span>
            </div>
          )}
          {passwordError && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-danger">
              <AlertCircle className="size-4 shrink-0" />
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
                className="text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground-muted">New Password (Min. 8 chars)</Label>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground-muted">Confirm New Password</Label>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isUpdatingPassword || !oldPassword || !newPassword || !confirmPassword}
              className="bg-brand text-white hover:bg-brand-hover text-xs font-mono"
            >
              {isUpdatingPassword ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  <span>Rotating Password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
