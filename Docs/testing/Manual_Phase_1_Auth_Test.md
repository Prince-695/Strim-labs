# Phase 1: Authentication & Session Management - Manual Verification Guide

This document provides a comprehensive, step-by-step manual test plan for **Phase 1: Foundation & Authentication** of the STRIM Labs backend.

---

## 🛠️ Environment Prerequisites

Set your target API base URL in your shell:

```bash
export API_URL="http://localhost:8080"
export COOKIE_JAR="/tmp/strim_cookies.txt"
rm -f "$COOKIE_JAR"
```

Verify that the API server is alive:

```bash
curl -i -X GET "${API_URL}/health"
```
**Expected Response**:
```json
{
  "success": true,
  "data": {
    "database": "connected",
    "status": "healthy",
    "timestamp": "2026-11-01T12:00:00Z"
  },
  "request_id": "req_0192f1b2-...",
  "response_time": "1.25ms"
}
```

---

## 1. User Registration (`POST /v1/auth/signup`)

### 1.1 Successful Registration
```bash
curl -i -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_JAR" \
  -d '{
    "email": "lead.architect@strimlabs.dev",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Ada",
    "last_name": "Lovelace"
  }'
```

**Expected HTTP Status**: `201 Created`  
**Expected Headers**:
- `Set-Cookie: access_token=eyJhbGci...; Path=/; HttpOnly; SameSite=Lax`
- `Set-Cookie: refresh_token=...; Path=/v1/auth; HttpOnly; SameSite=Lax`

**Expected Body**:
```json
{
  "success": true,
  "message": "Account created. Please verify your email.",
  "access_token": "eyJhbGciOi...",
  "data": {
    "user": {
      "id": "0192f1b2-...",
      "email": "lead.architect@strimlabs.dev",
      "first_name": "Ada",
      "last_name": "Lovelace",
      "is_verified": false,
      "created_at": "2026-11-01T..."
    },
    "refresh_token": "64_char_opaque_hex..."
  },
  "request_id": "req_...",
  "response_time": "..."
}
```

### 1.2 Duplicate Email Conflict
Re-run the exact same signup command:
```bash
curl -i -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lead.architect@strimlabs.dev",
    "password": "Str0ng!P@ssw0rd2026",
    "first_name": "Ada",
    "last_name": "Lovelace"
  }'
```
**Expected HTTP Status**: `409 Conflict`  
**Expected Body**:
```json
{
  "success": false,
  "error": "An account with this email address already exists",
  "error_code": "EMAIL_TAKEN"
}
```

### 1.3 Validation Failures
```bash
curl -i -X POST "${API_URL}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalid-email-format",
    "password": "short",
    "first_name": "",
    "last_name": ""
  }'
```
**Expected HTTP Status**: `400 Bad Request`  
**Expected Error Code**: `VALIDATION_FAILED`

---

## 2. User Authentication (`POST /v1/auth/login`)

### 2.1 Successful Login
```bash
curl -i -X POST "${API_URL}/v1/auth/login" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_JAR" \
  -d '{
    "email": "lead.architect@strimlabs.dev",
    "password": "Str0ng!P@ssw0rd2026"
  }'
```

**Expected HTTP Status**: `200 OK`  
Save the returned access token:
```bash
export ACCESS_TOKEN="<paste_access_token_here>"
```

### 2.2 Invalid Credentials
```bash
curl -i -X POST "${API_URL}/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lead.architect@strimlabs.dev",
    "password": "WrongPassword123!"
  }'
```
**Expected HTTP Status**: `401 Unauthorized`  
**Expected Error Code**: `INVALID_CREDENTIALS`

### 2.3 Account Lockout
Send 10 consecutive failed logins. On the 11th attempt:
```bash
for i in {1..11}; do
  curl -s -X POST "${API_URL}/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"lead.architect@strimlabs.dev","password":"wrong"}' | grep -o 'ACCOUNT_LOCKED'
done
```
**Expected HTTP Status**: `429 Too Many Requests`  
**Expected Headers**: `Retry-After: 900`  
**Expected Error Code**: `ACCOUNT_LOCKED`

---

## 3. Profile Inspection (`GET /v1/auth/me`)

### 3.1 Without Authentication
```bash
curl -i -X GET "${API_URL}/v1/auth/me"
```
**Expected HTTP Status**: `401 Unauthorized`

### 3.2 With Bearer Token
```bash
curl -i -X GET "${API_URL}/v1/auth/me" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```
**Expected HTTP Status**: `200 OK`  
**Expected Body**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "lead.architect@strimlabs.dev",
      "first_name": "Ada",
      "last_name": "Lovelace",
      "is_verified": false
    },
    "is_verified": false,
    "session_id": "...",
    "expires_at": "..."
  }
}
```

### 3.3 With Cookie
```bash
curl -i -X GET "${API_URL}/v1/auth/me" \
  -b "$COOKIE_JAR"
```
**Expected HTTP Status**: `200 OK`

---

## 4. Refresh Token Rotation (`POST /v1/auth/refresh`)

### 4.1 Legitimate Token Rotation (RTR)
```bash
curl -i -X POST "${API_URL}/v1/auth/refresh" \
  -b "$COOKIE_JAR" \
  -c "$COOKIE_JAR"
```
**Expected HTTP Status**: `200 OK`  
A new `access_token` (JWT with `token_type: "access"`, 30 min TTL) and rotated `refresh_token` (JWT with `token_type: "refresh"`, 7 days TTL) are returned and updated in the cookie jar. Old refresh token JTI is added to in-memory TTL denylist.

### 4.2 In-Flight Concurrent Request Deduplication (30-second Grace Cache)
If multiple client browser tabs or parallel API calls refresh simultaneously with the same old refresh token within 30 seconds:
```bash
# Replay within 30 seconds
curl -i -X POST "${API_URL}/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<previous_refresh_jwt>"}'
```
**Expected HTTP Status**: `200 OK`  
**Result**: Serves the exact same freshly generated token pair from the 30-second in-memory grace cache, preventing race condition errors across tabs!

### 4.3 Revoked Token Replay (>30 Seconds After Rotation)
Attempting to replay an old rotated token after the 30-second grace window expires:
```bash
curl -i -X POST "${API_URL}/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<expired_grace_refresh_jwt>"}'
```
**Expected HTTP Status**: `401 Unauthorized`  
**Expected Error Code**: `TOKEN_EXPIRED`  
**Result**: In-memory TTL denylist immediately rejects the request with zero persistent database session overhead.

---

## 5. Email OTP Verification

### 5.1 Request Verification OTP (`POST /v1/auth/otp/send`)
```bash
curl -i -X POST "${API_URL}/v1/auth/otp/send" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```
**Expected HTTP Status**: `200 OK`  
*(Check server logs for `[MAILER] Email Verification OTP: 123456`)*

### 5.2 Verify with Invalid Code (`POST /v1/auth/otp/verify`)
```bash
curl -i -X POST "${API_URL}/v1/auth/otp/verify" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"otp": "000000"}'
```
**Expected HTTP Status**: `400 Bad Request`  
**Expected Error Code**: `OTP_INVALID`

### 5.3 Verify with Valid Code
```bash
curl -i -X POST "${API_URL}/v1/auth/otp/verify" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"otp": "<6_digit_code_from_logs>"}'
```
**Expected HTTP Status**: `200 OK`  
**Expected User Response**: `"is_verified": true`

---

## 6. Password Recovery Flow

### 6.1 Forgot Password (`POST /v1/auth/forgot-password`)
```bash
curl -i -X POST "${API_URL}/v1/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email": "lead.architect@strimlabs.dev"}'
```
**Expected HTTP Status**: `200 OK`  
*(Check server logs for `[MAILER] Password Reset OTP`)*

### 6.2 Reset Password (`POST /v1/auth/reset-password`)
```bash
curl -i -X POST "${API_URL}/v1/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lead.architect@strimlabs.dev",
    "otp": "<6_digit_code_from_logs>",
    "new_password": "N3wBrandSecureP@ss2026!"
  }'
```
**Expected HTTP Status**: `200 OK`  
**Result**: Password updated, all previous active refresh tokens invalidated.

---

## 7. CSRF & Security Controls

### 7.1 CSRF Violation (Cookie Auth without Origin on Mutating Endpoint)
```bash
curl -i -X POST "${API_URL}/v1/auth/logout" \
  -b "$COOKIE_JAR"
```
**Expected HTTP Status**: `403 Forbidden`  
**Expected Error Code**: `CSRF_VIOLATION`

### 7.2 Trusted Origin (Cookie Auth with Valid Origin)
```bash
curl -i -X POST "${API_URL}/v1/auth/logout" \
  -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000"
```
**Expected HTTP Status**: `200 OK`

### 7.3 Bearer Token Exemption from CSRF
```bash
curl -i -X POST "${API_URL}/v1/auth/logout" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```
**Expected HTTP Status**: `200 OK`

### 7.4 JTI Denylist Enforcement After Logout
Attempting to use the logged-out token again:
```bash
curl -i -X GET "${API_URL}/v1/auth/me" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```
**Expected HTTP Status**: `401 Unauthorized`  
**Expected Error Code**: `TOKEN_EXPIRED`

---

## 8. Rate Limiting Verification

Flood any rate-limited endpoint (`/v1/auth/login`, `/v1/auth/signup`, `/v1/auth/forgot-password`):
```bash
for i in {1..7}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "${API_URL}/v1/auth/forgot-password" \
    -H "Content-Type: application/json" \
    -d '{"email":"spam@strimlabs.dev"}'
done
```
**Expected Output**:
```
200
200
200
200
200
429
429
```
**Headers on 429**:
- `Retry-After: <seconds>`
- `X-RateLimit-Limit: 5`
- `X-RateLimit-Remaining: 0`

---

## ✅ Phase 1 Verification Checklist

- [x] OWASP Argon2id password hashing with password complexity enforcement
- [x] Stateless dual-token authentication: short-lived access JWT (30m) & long-lived refresh JWT (7d)
- [x] Mandatory `token_type` claim differentiation ("access" vs "refresh") with strict cross-type rejection
- [x] Zero database lookups on API incoming requests (pure in-memory verification)
- [x] Refresh Token Rotation (RTR) with 30-second in-memory grace cache deduplication for parallel client requests
- [x] In-memory TTL denylisting and user-level revocation on logout, rotation, and password reset
- [x] Dropped persistent `refresh_tokens` database table
- [x] Memory sliding-window rate limiting on all public auth endpoints
- [x] Strict CSRF origin protection on cookie-authenticated mutating requests
- [x] Swagger referer guard preventing cookie fallback in documentation UI
- [x] Account lockout after 10 failed login attempts within 15 minutes
- [x] 6-digit numeric OTP code dispatch and verification with attempt limits
- [x] Unified OAuth in `users` table with auto-verified status
- [x] Environment variable `DB_RUN` controls schema migrations with vibrant purple database logs
- [x] OpenAPI Swagger documentation synchronized and up to date
- [x] 100% automated test suite passing with race detection (`go test -race ./...`)
- [x] Zero linter errors with `golangci-lint`
