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

### 4.1 Legitimate Token Rotation
```bash
curl -i -X POST "${API_URL}/v1/auth/refresh" \
  -b "$COOKIE_JAR" \
  -c "$COOKIE_JAR"
```
**Expected HTTP Status**: `200 OK`  
A new `access_token` and rotated `refresh_token` are returned and updated in the cookie jar.

### 4.2 Replay / Token Reuse Detection Attack
Save the old refresh token before rotation and replay it:
```bash
curl -i -X POST "${API_URL}/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<old_revoked_token>"}'
```
**Expected HTTP Status**: `401 Unauthorized`  
**Expected Error Code**: `TOKEN_REUSED`  
**Result**: Entire token family is invalidated immediately.

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

## 7. Session Management

### 7.1 List Active Sessions (`GET /v1/auth/sessions`)
```bash
curl -i -X GET "${API_URL}/v1/auth/sessions" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```
**Expected HTTP Status**: `200 OK`  
**Expected Body**:
```json
{
  "success": true,
  "data": [
    {
      "id": "0192f1b2-...",
      "user_agent": "curl/...",
      "ip": "127.0.0.1",
      "created_at": "...",
      "current": true
    }
  ]
}
```

### 7.2 Revoke Session (`DELETE /v1/auth/sessions/:sessionID`)
```bash
curl -i -X DELETE "${API_URL}/v1/auth/sessions/<session_id>" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```
**Expected HTTP Status**: `200 OK`

---

## 8. CSRF & Security Controls

### 8.1 CSRF Violation (Cookie Auth without Origin on Mutating Endpoint)
```bash
curl -i -X POST "${API_URL}/v1/auth/logout" \
  -b "$COOKIE_JAR"
```
**Expected HTTP Status**: `403 Forbidden`  
**Expected Error Code**: `CSRF_VIOLATION`

### 8.2 Trusted Origin (Cookie Auth with Valid Origin)
```bash
curl -i -X POST "${API_URL}/v1/auth/logout" \
  -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000"
```
**Expected HTTP Status**: `200 OK`

### 8.3 Bearer Token Exemption from CSRF
```bash
curl -i -X POST "${API_URL}/v1/auth/logout" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```
**Expected HTTP Status**: `200 OK`

### 8.4 JTI Denylist Enforcement After Logout
Attempting to use the logged-out token again:
```bash
curl -i -X GET "${API_URL}/v1/auth/me" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```
**Expected HTTP Status**: `401 Unauthorized`  
**Expected Error Code**: `TOKEN_EXPIRED`

---

## 9. Rate Limiting Verification

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
- [x] HS256 JWT access tokens with UUIDv7 JTIs & claims
- [x] Opaque hex refresh tokens with SHA-256 storage
- [x] Refresh token rotation with family revocation upon reuse attack
- [x] Memory sliding-window rate limiting on all public auth endpoints
- [x] Strict CSRF origin protection on cookie-authenticated mutating requests
- [x] Swagger referer guard preventing cookie fallback in documentation UI
- [x] Account lockout after 10 failed login attempts within 15 minutes
- [x] In-memory JTI denylisting on logout
- [x] 6-digit numeric OTP code dispatch and verification with attempt limits
- [x] Session listing and individual device revocation
- [x] All 14 OpenAPI Swagger annotations fully documented and synchronized
- [x] 100% automated test suite passing with race detection (`go test -race ./...`)
- [x] Zero linter errors with `golangci-lint`
