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
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { userApi } from "@/lib/user-api"
import { useAuthStore } from "@/lib/stores/auth-store"

export default function ProfileSettingsPage() {
  const { user, setUser, refreshProfile } = useAuthStore()

  // 1. Profile Form State
  const [firstNameOverride, setFirstNameOverride] = React.useState<
    string | null
  >(null)
  const [lastNameOverride, setLastNameOverride] = React.useState<string | null>(
    null
  )
  const firstName =
    firstNameOverride !== null ? firstNameOverride : user?.first_name || ""
  const lastName =
    lastNameOverride !== null ? lastNameOverride : user?.last_name || ""
  const [profileMessage, setProfileMessage] = React.useState<string | null>(
    null
  )
  const [profileError, setProfileError] = React.useState<string | null>(null)
  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false)

  // 2. Unique Username State
  const [usernameInput, setUsernameInput] = React.useState("")
  const [isCheckingUsername, setIsCheckingUsername] = React.useState(false)
  const [serverAvailability, setServerAvailability] = React.useState<{
    checked: boolean
    available: boolean
    message?: string
  } | null>(null)
  const [usernameSuccess, setUsernameSuccess] = React.useState<string | null>(
    null
  )
  const [usernameError, setUsernameError] = React.useState<string | null>(null)
  const [isClaimingUsername, setIsClaimingUsername] = React.useState(false)

  // Derived client-side username validation
  const clientFormatError = React.useMemo(() => {
    if (!usernameInput.trim()) return null
    const clean = usernameInput.trim().toLowerCase()
    if (clean.length < 3) return "Username must be at least 3 characters"
    if (!/^[a-z]/.test(clean))
      return "Username must start with a lowercase letter"
    if (clean.length > 20) return "Username cannot exceed 20 characters"
    const usernameRegex = /^[a-z][a-z0-9_]{2,19}$/
    if (!usernameRegex.test(clean)) {
      return "Only lowercase letters, numbers, and underscores are allowed"
    }
    return null
  }, [usernameInput])

  const usernameAvailability = React.useMemo(() => {
    if (!usernameInput.trim()) return null
    if (clientFormatError) {
      return {
        checked: true,
        available: false,
        message: clientFormatError,
      }
    }
    return serverAvailability
  }, [usernameInput, clientFormatError, serverAvailability])

  // 3. Password Rotation Form State
  const [oldPassword, setOldPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [passwordMessage, setPasswordMessage] = React.useState<string | null>(
    null
  )
  const [passwordError, setPasswordError] = React.useState<string | null>(null)
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false)

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
      setFirstNameOverride(null)
      setLastNameOverride(null)
      setProfileMessage("Profile updated successfully.")
      setTimeout(() => setProfileMessage(null), 3000)
    } catch (err: unknown) {
      setProfileError(
        err instanceof Error ? err.message : "Failed to update profile."
      )
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  // Debounced Username Availability Checker (Server Verification)
  React.useEffect(() => {
    const clean = usernameInput.trim().toLowerCase()
    if (!clean || clientFormatError) {
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      try {
        setIsCheckingUsername(true)
        const res = await userApi.checkUsername(clean)
        if (!active) return
        const isAvail = Boolean(res.data?.available)
        setServerAvailability({
          checked: true,
          available: isAvail,
          message: isAvail
            ? `@${clean} is available to claim!`
            : `@${clean} is already taken or reserved`,
        })
      } catch {
        if (!active) return
        setServerAvailability({
          checked: true,
          available: false,
          message: "Could not verify username availability",
        })
      } finally {
        if (active) {
          setIsCheckingUsername(false)
        }
      }
    }, 350)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [usernameInput, clientFormatError])

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
      setUsernameSuccess(
        `@${clean} has been permanently registered to your account!`
      )
      setUsernameInput("")
      setServerAvailability(null)
      await refreshProfile()
    } catch (err: unknown) {
      setUsernameError(
        err instanceof Error ? err.message : "Failed to claim username."
      )
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

      setPasswordMessage(
        "Password changed successfully. All other active sessions have been revoked."
      )
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setPasswordMessage(null), 4000)
    } catch (err: unknown) {
      setPasswordError(
        err instanceof Error
          ? err.message
          : "Failed to change password. Please check your current password."
      )
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6 font-mono text-xs">
      {/* Section 1: Unique Username Claiming */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="border-b border-border-subtle pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
                <AtSign className="size-4 text-brand" />
                <span>Unique Account Username</span>
              </CardTitle>
              <CardDescription className="font-mono text-xs text-foreground-muted">
                Your unique handle across workspaces, CLI profiles, and test
                audit logs.
              </CardDescription>
            </div>
            {user?.username && (
              <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/15 px-3 py-1 font-mono text-[11px] text-success">
                <ShieldCheck className="size-3.5" />
                <span>Claimed</span>
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
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
            <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-raised p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-foreground-subtle uppercase">
                  Registered Handle
                </span>
                <span className="flex items-center gap-1 text-[10px] text-foreground-subtle">
                  <Lock className="size-3" />
                  <span>Permanent Handle</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-brand">
                  @{user.username}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-foreground-muted">
                This unique handle is permanently claimed and linked to your
                primary developer credentials.
              </p>
            </div>
          ) : (
            /* User has not yet set a username */
            <form onSubmit={handleClaimUsername} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground-muted">
                  Claim Unique Username
                </Label>
                <div className="relative">
                  <span className="absolute top-2.5 left-3 font-mono text-xs text-foreground-subtle">
                    @
                  </span>
                  <Input
                    placeholder="dev_alex, prince695..."
                    value={usernameInput}
                    onChange={(e) => {
                      setUsernameInput(
                        e.target.value.toLowerCase().replace(/\s+/g, "")
                      )
                      setServerAvailability(null)
                    }}
                    className="border-border-subtle bg-surface-raised pl-7 font-mono text-xs focus-visible:border-brand"
                    disabled={isClaimingUsername}
                  />
                  {isCheckingUsername && (
                    <Loader2 className="absolute top-2.5 right-3 size-4 animate-spin text-foreground-subtle" />
                  )}
                </div>

                {/* Real-time availability indicator */}
                {usernameAvailability && (
                  <div
                    className={`flex items-center gap-2 font-mono text-[11px] ${
                      usernameAvailability.available
                        ? "text-success"
                        : "text-warning"
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

                <div className="space-y-1 rounded-lg border border-border-subtle bg-surface-raised/40 p-3 text-[11px] text-foreground-subtle">
                  <span className="font-semibold text-foreground-muted">
                    Username Guidelines:
                  </span>
                  <ul className="list-inside list-disc space-y-0.5 text-[10px]">
                    <li>Between 3 and 20 characters in length</li>
                    <li>Must start with a lowercase letter (a-z)</li>
                    <li>
                      Can only contain lowercase letters, numbers, and
                      underscores (_)
                    </li>
                    <li>Cannot be changed once claimed</li>
                  </ul>
                </div>
              </div>

              <Button
                type="submit"
                disabled={
                  !usernameAvailability?.available ||
                  isClaimingUsername ||
                  isCheckingUsername
                }
                className="gap-1.5 bg-brand font-mono text-xs text-white hover:bg-brand-hover"
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
        <CardHeader className="border-b border-border-subtle pb-4">
          <CardTitle className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
            <User className="size-4 text-brand" />
            <span>Personal Information</span>
          </CardTitle>
          <CardDescription className="font-mono text-xs text-foreground-muted">
            Your name and primary account email used across organization
            workspaces.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
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
                  onChange={(e) => setFirstNameOverride(e.target.value)}
                  className="border-border-subtle bg-surface-raised font-mono text-xs focus-visible:border-brand"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground-muted">Last Name</Label>
                <Input
                  placeholder={user?.last_name || "Last Name"}
                  value={lastName}
                  onChange={(e) => setLastNameOverride(e.target.value)}
                  className="border-border-subtle bg-surface-raised font-mono text-xs focus-visible:border-brand"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground-muted">Account Email</Label>
              <div className="relative">
                <Mail className="absolute top-2.5 left-3 size-3.5 text-foreground-subtle" />
                <Input
                  value={user?.email || ""}
                  disabled
                  className="cursor-not-allowed border-border-subtle bg-surface-raised/40 pl-8 font-mono text-xs opacity-70"
                />
              </div>
              <span className="text-[10px] text-foreground-subtle">
                Primary verified email address. Contact workspace admin to
                transfer organization ownership.
              </span>
            </div>

            <Button
              type="submit"
              disabled={isUpdatingProfile}
              className="bg-brand font-mono text-xs text-white hover:bg-brand-hover"
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
        <CardHeader className="border-b border-border-subtle pb-4">
          <CardTitle className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
            <Key className="size-4 text-brand" />
            <span>Security & Password Rotation</span>
          </CardTitle>
          <CardDescription className="font-mono text-xs text-foreground-muted">
            Change your account password. Successful rotation revokes existing
            sessions across all devices.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
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
                className="border-border-subtle bg-surface-raised font-mono text-xs focus-visible:border-brand"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground-muted">
                  New Password (Min. 8 chars)
                </Label>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border-border-subtle bg-surface-raised font-mono text-xs focus-visible:border-brand"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground-muted">
                  Confirm New Password
                </Label>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border-border-subtle bg-surface-raised font-mono text-xs focus-visible:border-brand"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={
                isUpdatingPassword ||
                !oldPassword ||
                !newPassword ||
                !confirmPassword
              }
              className="bg-brand font-mono text-xs text-white hover:bg-brand-hover"
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
