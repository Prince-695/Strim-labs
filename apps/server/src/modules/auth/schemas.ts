import { z } from "@hono/zod-openapi";

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "UNAUTHORIZED" }),
    message: z.string().optional().openapi({ example: "Invalid email or password" }),
  })
  .openapi("AuthErrorResponse");

export const SuccessResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({ example: "Operation completed successfully" }),
  })
  .openapi("AuthSuccessResponse");

export const SignUpSchema = z
  .object({
    email: z.string().email().openapi({ example: "alex@company.com" }),
    password: z.string().min(8).openapi({ example: "StrongP@ssw0rd!" }),
    name: z.string().min(1).openapi({ example: "Alex Mercer" }),
    organizationName: z.string().min(1).openapi({ example: "Acme Corp" }),
  })
  .openapi("SignUpRequest");

export const LoginSchema = z
  .object({
    email: z.string().email().openapi({ example: "priya@acme.test" }),
    password: z.string().min(1).openapi({ example: "password123" }),
  })
  .openapi("LoginRequest");

export const UserSchema = z
  .object({
    id: z.string().openapi({ example: "cuid_user_123" }),
    email: z.string().email().openapi({ example: "priya@acme.test" }),
    name: z.string().openapi({ example: "Priya" }),
    createdAt: z.string().datetime().optional(),
  })
  .openapi("User");

export const OrganizationSummarySchema = z
  .object({
    id: z.string().openapi({ example: "cuid_org_123" }),
    name: z.string().openapi({ example: "Acme" }),
    slug: z.string().openapi({ example: "acme" }),
    role: z.string().optional().openapi({ example: "OWNER" }),
  })
  .openapi("OrganizationSummary");

export const AuthResponseSchema = z
  .object({
    token: z.string().openapi({ example: "eyJhbGciOiJIUzI1NiIsIn..." }),
    user: UserSchema,
    organization: OrganizationSummarySchema.optional(),
    organizations: z.array(OrganizationSummarySchema).optional(),
  })
  .openapi("AuthResponse");

export const TokenResponseSchema = z
  .object({
    token: z.string().openapi({ example: "eyJhbGciOiJIUzI1NiIsIn..." }),
  })
  .openapi("TokenResponse");

export const GoogleAuthUrlResponseSchema = z
  .object({
    url: z.string().url().openapi({
      example: "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
    }),
  })
  .openapi("GoogleAuthUrlResponse");

export const GoogleCallbackSchema = z
  .object({
    code: z.string().min(1).openapi({ example: "4/0AeanS..." }),
    state: z.string().optional().openapi({ example: "random_state_string" }),
  })
  .openapi("GoogleCallbackRequest");

export const ForgotPasswordSchema = z
  .object({
    email: z.string().email().openapi({ example: "priya@acme.test" }),
  })
  .openapi("ForgotPasswordRequest");

export const ForgotPasswordResponseSchema = z
  .object({
    message: z.string().openapi({
      example: "If that email exists, password reset instructions have been generated.",
    }),
    resetToken: z.string().optional().openapi({ example: "test_reset_token" }),
  })
  .openapi("ForgotPasswordResponse");

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1).openapi({ example: "reset_token_from_email" }),
    newPassword: z.string().min(8).openapi({ example: "NewP@ssw0rd!" }),
  })
  .openapi("ResetPasswordRequest");

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().openapi({ example: "password123" }),
    newPassword: z.string().min(8).openapi({ example: "NewSecureP@ssw0rd!" }),
  })
  .openapi("ChangePasswordRequest");

export const UpdateProfileSchema = z
  .object({
    name: z.string().min(1).openapi({ example: "Priya Sharma" }),
  })
  .openapi("UpdateProfileRequest");

export const MeResponseSchema = z
  .object({
    user: UserSchema,
    organizations: z.array(OrganizationSummarySchema),
  })
  .openapi("MeResponse");
