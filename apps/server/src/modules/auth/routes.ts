import { createRoute } from "@hono/zod-openapi";
import {
  AuthResponseSchema,
  ChangePasswordSchema,
  ErrorResponseSchema,
  ForgotPasswordResponseSchema,
  ForgotPasswordSchema,
  GoogleAuthUrlResponseSchema,
  GoogleCallbackSchema,
  LoginSchema,
  MeResponseSchema,
  ResetPasswordSchema,
  SignUpSchema,
  SuccessResponseSchema,
  TokenResponseSchema,
  UpdateProfileSchema,
  UserSchema,
} from "./schemas";

const tags = ["Authentication"];

export const signUpRoute = createRoute({
  method: "post",
  path: "/signup",
  tags,
  summary: "Sign up and create an organization",
  description: "Registers a new user, provisions a new tenant organization with Owner role, and sets session cookie.",
  request: {
    body: {
      content: { "application/json": { schema: SignUpSchema } },
    },
  },
  responses: {
    201: {
      description: "User registered and session created",
      content: { "application/json": { schema: AuthResponseSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Email already registered",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const loginRoute = createRoute({
  method: "post",
  path: "/login",
  tags,
  summary: "Log in with email and password",
  description: "Authenticates credentials against Argon2id hash, enforces rate limits, and issues a session token.",
  request: {
    body: {
      content: { "application/json": { schema: LoginSchema } },
    },
  },
  responses: {
    200: {
      description: "Login successful",
      content: { "application/json": { schema: AuthResponseSchema } },
    },
    401: {
      description: "Invalid credentials",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    429: {
      description: "Rate limit exceeded (5 attempts per 15 min)",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const googleUrlRoute = createRoute({
  method: "get",
  path: "/google/url",
  tags,
  summary: "Get Google OAuth authorization URL",
  description: "Returns the Google OAuth 2.0 authorization consent screen URL.",
  responses: {
    200: {
      description: "Google OAuth consent URL",
      content: { "application/json": { schema: GoogleAuthUrlResponseSchema } },
    },
  },
});

export const googleCallbackRoute = createRoute({
  method: "post",
  path: "/google/callback",
  tags,
  summary: "Exchange Google OAuth code for session",
  description: "Exchanges Google authorization code for access token, verifies profile, auto-provisions tenant, and creates session.",
  request: {
    body: {
      content: { "application/json": { schema: GoogleCallbackSchema } },
    },
  },
  responses: {
    200: {
      description: "Google login successful",
      content: { "application/json": { schema: AuthResponseSchema } },
    },
    400: {
      description: "OAuth exchange failed",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const logoutRoute = createRoute({
  method: "post",
  path: "/logout",
  tags,
  summary: "Log out current session",
  description: "Invalidates the active session record and clears the HTTP-only session cookie.",
  responses: {
    200: {
      description: "Logged out successfully",
      content: { "application/json": { schema: SuccessResponseSchema } },
    },
  },
});

export const refreshRoute = createRoute({
  method: "post",
  path: "/refresh",
  tags,
  summary: "Refresh active session",
  description: "Extends session expiration by 7 days and returns a refreshed session token.",
  responses: {
    200: {
      description: "Session refreshed",
      content: { "application/json": { schema: TokenResponseSchema } },
    },
    401: {
      description: "Session expired or invalid",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const forgotPasswordRoute = createRoute({
  method: "post",
  path: "/forgot-password",
  tags,
  summary: "Request password reset",
  description: "Generates a secure 1-hour password reset token if the email exists in the system.",
  request: {
    body: {
      content: { "application/json": { schema: ForgotPasswordSchema } },
    },
  },
  responses: {
    200: {
      description: "Reset instructions generated",
      content: { "application/json": { schema: ForgotPasswordResponseSchema } },
    },
  },
});

export const resetPasswordRoute = createRoute({
  method: "post",
  path: "/reset-password",
  tags,
  summary: "Reset password using token",
  description: "Validates reset token, updates password hash, revokes all other active sessions.",
  request: {
    body: {
      content: { "application/json": { schema: ResetPasswordSchema } },
    },
  },
  responses: {
    200: {
      description: "Password reset successful",
      content: { "application/json": { schema: SuccessResponseSchema } },
    },
    400: {
      description: "Invalid or expired token, or weak password",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags,
  summary: "Get current user profile and memberships",
  description: "Returns authenticated user identity, account created timestamp, and associated organizations.",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "User profile data",
      content: { "application/json": { schema: MeResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const updateMeRoute = createRoute({
  method: "patch",
  path: "/me",
  tags,
  summary: "Update current user profile",
  description: "Updates profile fields such as display name.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: UpdateProfileSchema } },
    },
  },
  responses: {
    200: {
      description: "Profile updated",
      content: { "application/json": { schema: UserSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const changePasswordRoute = createRoute({
  method: "post",
  path: "/change-password",
  tags,
  summary: "Change account password",
  description: "Verifies current password and updates to new password with complexity enforcement.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: ChangePasswordSchema } },
    },
  },
  responses: {
    200: {
      description: "Password changed successfully",
      content: { "application/json": { schema: SuccessResponseSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Incorrect current password or unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
