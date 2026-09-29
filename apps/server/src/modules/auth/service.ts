import type { AppDb } from "../../lib/prisma";
import {
  hashPassword,
  randomToken,
  sha256,
  signSession,
  validatePasswordComplexity,
  verifyPassword,
  verifySession,
} from "../../lib/crypto";
import { writeAudit } from "../../lib/audit";
import { rateLimit } from "../../lib/redis";
import type { GoogleUserProfile, SessionPayload } from "./types";

export class AuthService {
  static async signUp(
    db: AppDb,
    input: { email: string; password: string; name: string; organizationName: string },
  ): Promise<{ status: number; data: SessionPayload | { error: string; message: string } }> {
    const complexity = validatePasswordComplexity(input.password);
    if (!complexity.valid) {
      return { status: 400, data: { error: "VALIDATION", message: complexity.message ?? "Password does not meet complexity requirements" } };
    }

    const email = input.email.toLowerCase();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return { status: 409, data: { error: "CONFLICT", message: "Email is already registered" } };
    }

    const user = await db.user.create({
      data: {
        email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
      },
    });

    const slug = input.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const org = await db.organization.create({
      data: { name: input.organizationName, slug: `${slug}-${user.id.slice(-6)}` },
    });

    const team = await db.team.create({
      data: { organizationId: org.id, name: "Platform" },
    });
    await db.teamMember.create({ data: { teamId: team.id, userId: user.id } });

    await db.membership.create({
      data: { organizationId: org.id, userId: user.id, role: "OWNER", scope: "ORGANIZATION" },
    });
    await db.billingAccount.create({ data: { organizationId: org.id, plan: "team" } });

    await writeAudit(db, {
      organizationId: org.id,
      actorId: user.id,
      action: "organization.create",
      resourceType: "organization",
      resourceId: org.id,
      newValue: { name: org.name },
    });

    const sessionRecord = await db.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256(randomToken()),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    const token = await signSession({
      userId: user.id,
      email: user.email,
      sessionId: sessionRecord.id,
    });

    return {
      status: 201,
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
        organization: { id: org.id, name: org.name, slug: org.slug, role: "OWNER" },
      },
    };
  }

  static async login(
    db: AppDb,
    input: { email: string; password: string },
    ip: string,
  ): Promise<{ status: number; data: SessionPayload | { error: string; message: string } }> {
    const emailKey = input.email.toLowerCase();
    const rl = await rateLimit(`login:${ip}:${emailKey}`, 5, 900);
    if (!rl.allowed) {
      return {
        status: 429,
        data: {
          error: "RATE_LIMITED",
          message: "Too many login attempts. Please wait 15 minutes before trying again.",
        },
      };
    }

    const user = await db.user.findUnique({ where: { email: emailKey } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      return { status: 401, data: { error: "UNAUTHORIZED", message: "Invalid email or password" } };
    }

    const sessionRecord = await db.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256(randomToken()),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    const token = await signSession({
      userId: user.id,
      email: user.email,
      sessionId: sessionRecord.id,
    });

    const memberships = await db.membership.findMany({
      where: { userId: user.id },
      include: { organization: true },
    });

    return {
      status: 200,
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
        organizations: memberships.map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          role: m.role as any,
        })),
      },
    };
  }

  static getGoogleAuthUrl(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? "mock-client-id";
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3001/api/v1/auth/google/callback";
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  static async handleGoogleCallback(
    db: AppDb,
    code: string,
  ): Promise<{ status: number; data: SessionPayload | { error: string; message: string } }> {
    let googleUser: GoogleUserProfile;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3001/api/v1/auth/google/callback";

    // Handle mock/dev mode for seamless local testing
    if (!clientId || clientId.startsWith("mock-") || code.startsWith("mock_")) {
      googleUser = {
        id: "google_mock_123",
        email: code.includes("@") ? code : "google-dev@strim.test",
        name: "Google Developer",
        verified_email: true,
      };
    } else {
      try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret ?? "",
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });

        if (!tokenRes.ok) {
          return { status: 400, data: { error: "OAUTH_FAILED", message: "Failed to exchange Google OAuth code" } };
        }

        const tokenData = (await tokenRes.json()) as { access_type?: string; access_token: string };
        const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (!userRes.ok) {
          return { status: 400, data: { error: "OAUTH_FAILED", message: "Failed to fetch Google profile" } };
        }

        googleUser = (await userRes.json()) as GoogleUserProfile;
      } catch (err: any) {
        return { status: 500, data: { error: "OAUTH_FAILED", message: err.message ?? "Google OAuth error" } };
      }
    }

    const email = googleUser.email.toLowerCase();
    let user = await db.user.findUnique({ where: { email } });

    if (!user) {
      // Provision new user and organization
      user = await db.user.create({
        data: {
          email,
          name: googleUser.name || (email.split("@")[0] ?? "User"),
          passwordHash: await hashPassword(randomToken(24)), // Random secure password
        },
      });

      const orgName = `${user.name}'s Org`;
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const org = await db.organization.create({
        data: { name: orgName, slug: `${slug}-${user.id.slice(-6)}`, ssoProvider: "google" },
      });

      const team = await db.team.create({
        data: { organizationId: org.id, name: "Platform" },
      });
      await db.teamMember.create({ data: { teamId: team.id, userId: user.id } });

      await db.membership.create({
        data: { organizationId: org.id, userId: user.id, role: "OWNER", scope: "ORGANIZATION" },
      });
      await db.billingAccount.create({ data: { organizationId: org.id, plan: "team" } });

      await writeAudit(db, {
        organizationId: org.id,
        actorId: user.id,
        action: "organization.create",
        resourceType: "organization",
        resourceId: org.id,
        newValue: { name: org.name, sso: "google" },
      });
    }

    const sessionRecord = await db.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256(randomToken()),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    const token = await signSession({
      userId: user.id,
      email: user.email,
      sessionId: sessionRecord.id,
    });

    const memberships = await db.membership.findMany({
      where: { userId: user.id },
      include: { organization: true },
    });

    return {
      status: 200,
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
        organizations: memberships.map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          role: m.role as any,
        })),
      },
    };
  }

  static async logout(db: AppDb, token: string | null): Promise<void> {
    if (!token) return;
    const session = verifySession(token);
    if (session?.sessionId) {
      try {
        await db.session.delete({ where: { id: session.sessionId } });
      } catch {
        // Ignore if already deleted
      }
    }
  }

  static async refreshSession(
    db: AppDb,
    token: string,
  ): Promise<{ status: number; data: { token: string } | { error: string; message: string } }> {
    const session = verifySession(token);
    if (!session) {
      return { status: 401, data: { error: "UNAUTHORIZED", message: "Session expired or invalid" } };
    }

    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      return { status: 401, data: { error: "UNAUTHORIZED", message: "User not found" } };
    }

    const newExpiry = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    if (session.sessionId) {
      await db.session.update({
        where: { id: session.sessionId },
        data: { expiresAt: newExpiry },
      });
    }

    const newToken = await signSession({
      userId: user.id,
      email: user.email,
      sessionId: session.sessionId,
    });

    return { status: 200, data: { token: newToken } };
  }

  static async forgotPassword(
    db: AppDb,
    email: string,
  ): Promise<{ message: string; resetToken?: string }> {
    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      const resetToken = randomToken(32);
      await db.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(resetToken),
          expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
        },
      });

      return {
        message: "If that email exists, password reset instructions have been generated.",
        resetToken,
      };
    }

    return {
      message: "If that email exists, password reset instructions have been generated.",
    };
  }

  static async resetPassword(
    db: AppDb,
    token: string,
    newPass: string,
  ): Promise<{ status: number; data: { success: boolean; message: string } | { error: string; message: string } }> {
    const complexity = validatePasswordComplexity(newPass);
    if (!complexity.valid) {
      return { status: 400, data: { error: "VALIDATION", message: complexity.message ?? "Password does not meet complexity requirements" } };
    }

    const tokenRecord = await db.passwordResetToken.findUnique({
      where: { tokenHash: sha256(token) },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      return { status: 400, data: { error: "UNAUTHORIZED", message: "Password reset token is invalid or expired" } };
    }

    const newHash = await hashPassword(newPass);
    await db.user.update({
      where: { id: tokenRecord.userId },
      data: { passwordHash: newHash },
    });

    await db.session.deleteMany({ where: { userId: tokenRecord.userId } });
    await db.passwordResetToken.delete({ where: { id: tokenRecord.id } });

    return {
      status: 200,
      data: { success: true, message: "Password has been successfully updated. Please sign in." },
    };
  }

  static async getProfile(
    db: AppDb,
    userId: string,
  ): Promise<{ user: any; organizations: any[] }> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    const memberships = await db.membership.findMany({
      where: { userId },
      include: { organization: true },
    });

    return {
      user,
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
      })),
    };
  }

  static async updateProfile(
    db: AppDb,
    userId: string,
    name: string,
  ): Promise<{ id: string; email: string; name: string }> {
    return db.user.update({
      where: { id: userId },
      data: { name },
      select: { id: true, email: true, name: true },
    });
  }

  static async changePassword(
    db: AppDb,
    userId: string,
    currentPass: string,
    newPass: string,
  ): Promise<{ status: number; data: { success: boolean; message: string } | { error: string; message: string } }> {
    const complexity = validatePasswordComplexity(newPass);
    if (!complexity.valid) {
      return { status: 400, data: { error: "VALIDATION", message: complexity.message ?? "Password does not meet complexity requirements" } };
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !(await verifyPassword(currentPass, user.passwordHash))) {
      return { status: 401, data: { error: "UNAUTHORIZED", message: "Current password is incorrect" } };
    }

    const newHash = await hashPassword(newPass);
    await db.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { status: 200, data: { success: true, message: "Password updated successfully" } };
  }
}
