# Strim — Phase 7 Manual Testing Guide
### Production-Grade SDK Hardening (`packages/sdk`)

This guide provides step-by-step instructions to verify all deliverables of **Phase 7: Production-Grade SDK Hardening**.

---

## 🚀 Pre-requisites & Verification Setup

1. Start infrastructure and Strim server:
   ```bash
   docker compose -f infra/docker-compose.yml up -d
   bun run --filter @strim/server dev
   ```
   *The server runs on `http://localhost:8080`.*

2. Run automated test suite verifying all SDK resilience guarantees:
   ```bash
   bun test packages/sdk/src/sdk.test.ts
   ```
   *Expected: All 9 test suites pass cleanly.*

---

## 🛡️ Test Suite 1: Fail-Open & Zero-Overhead Guarantee

Verify that host applications never experience unhandled rejections, crashes, or latency penalties if Strim is unreachable.

### 1.1 Uninitialized SDK Call Safety
```bash
bun -e '
import { strim } from "@strim/sdk";

// Calling methods before init must never throw
strim.capture({ type: "request", path: "/api/checkout", status: 200 });
console.log("Config fallback:", strim.config("timeout.ms", 3000));
console.log("In rollout:", strim.inRollout("user_42", 50));
console.log("Uninitialized safety: PASS");
'
```
*Expected Output:*
```
Config fallback: 3000
In rollout: true
Uninitialized safety: PASS
```

### 1.2 Ingest Network Outage Resilience
Simulate complete network failure (ingest port down):
```bash
bun -e '
import { StrimClient } from "@strim/sdk";

const client = new StrimClient();
client.init({
  projectId: "checkout-svc",
  environment: "production",
  apiKey: "sk_live_test",
  ingestUrl: "http://127.0.0.1:59999", // Unreachable port
  defaults: { "cache.enabled": false }
});

client.capture({ type: "request", path: "/orders", status: 200, durationMs: 45 });
await client.flush();

console.log("Active config despite network outage:", client.config("cache.enabled"));
client.shutdown();
console.log("Outage fail-open: PASS");
'
```
*Expected Output:*
```
Active config despite network outage: false
Outage fail-open: PASS
```

---

## 📦 Test Suite 2: Bounded In-Memory Ring Buffer & Drop-Oldest Shedding

Verify that the SDK respects memory ceilings (max 500 items by default) and sheds the oldest events under sustained backpressure.

```bash
bun -e '
import { RingBuffer } from "@strim/sdk";

// Create small buffer with capacity of 5
const ring = new RingBuffer(5);

// Push 8 events (should drop 3 oldest)
for (let i = 1; i <= 8; i++) {
  ring.push({ eventId: i, message: "event " + i });
}

console.log("Buffer Stats:", JSON.stringify(ring.stats));
const items = ring.drain();
console.log("Retained items (newest 5):", items.map(x => x.eventId));
'
```
*Expected Output:*
```
Buffer Stats: {"buffered":5,"capacity":5,"dropped":3,"totalCaptured":8,"totalFlushed":0}
Retained items (newest 5): [ 4, 5, 6, 7, 8 ]
```

---

## 🔒 Test Suite 3: Source-Level PII, Token & Auth Header Redaction

Verify that sensitive data (authorization headers, cookies, API keys, passwords, credit cards, SSNs, and custom customer IDs) is sanitized *in-process before* hitting the network or buffer.

```bash
bun -e '
import { StrimClient } from "@strim/sdk";

let payload = null;
const client = new StrimClient();
client.init({
  projectId: "payment-svc",
  environment: "production",
  apiKey: "sk_test",
  customRedactionRules: [
    { name: "account_id", pattern: "ACC-[0-9]{4}" }
  ],
  fetchImpl: async (url, init) => {
    payload = JSON.parse(init.body);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
});

client.capture({
  type: "request",
  path: "/api/accounts/ACC-9921/charge?token=jwt_secret_token",
  headers: {
    authorization: "Bearer eyJhbGciOi...",
    cookie: "session_id=secret_cookie_val",
    "x-api-key": "sk_live_api_secret_key_123"
  },
  body: {
    password: "MySuperSecretPassword!",
    creditCard: "4111-2222-3333-4444",
    nested: { apiKey: "key_secret_12345" }
  }
});

await client.flush();
console.log("Sanitized Event:", JSON.stringify(payload.events[0], null, 2));
client.shutdown();
'
```
*Expected Output:*
- `headers.authorization`: `"[REDACTED]"`
- `headers.cookie`: `"[REDACTED]"`
- `headers["x-api-key"]`: `"[REDACTED]"`
- `body.password`: `"[REDACTED]"`
- `body.creditCard`: `"[REDACTED]"`
- `body.nested.apiKey`: `"[REDACTED]"`
- `path`: `"/api/accounts/[REDACTED]/charge?token=[REDACTED]"`

---

## 🎯 Test Suite 4: Deterministic Canary Rollout Evaluation (`inRollout`)

Verify that user canary buckets evaluate consistently and route to proposed values when active.

```bash
bun -e '
import { StrimClient } from "@strim/sdk";

const client = new StrimClient();
client.init({
  projectId: "frontend-gateway",
  environment: "production",
  apiKey: "sk_test",
  defaults: { "v2.checkout": false },
  fetchImpl: async () => {
    return new Response(JSON.stringify({
      values: { "v2.checkout": false },
      proposed: { "v2.checkout": true },
      rolloutPercent: 25
    }));
  }
});

await client.refreshConfig();

console.log("Rollout 25% for user_1:", client.inRollout("user_1", 25));
console.log("Config for user_1:", client.config("v2.checkout", false, { bucketKey: "user_1" }));
console.log("Config for user_2:", client.config("v2.checkout", false, { bucketKey: "user_2" }));
client.shutdown();
'
```

---

## 💾 Test Suite 5: Runtime Config Disk & Memory Fallback

Verify that when online, the SDK saves runtime configuration to a local cache file, and when restarted completely offline, immediately serves the last-known-good values.

```bash
bun -e '
import { StrimClient } from "@strim/sdk";
import { unlink } from "node:fs/promises";

const cachePath = ".strim-manual-test-cache.json";

// Step 1: Online fetch
const online = new StrimClient();
online.init({
  projectId: "order-service",
  environment: "production",
  apiKey: "sk_test",
  configCachePath: cachePath,
  fetchImpl: async () => new Response(JSON.stringify({ values: { "order.timeout.ms": 2500 } }))
});
await online.refreshConfig();
online.shutdown();

// Step 2: Offline startup (network error)
const offline = new StrimClient();
offline.init({
  projectId: "order-service",
  environment: "production",
  apiKey: "sk_test",
  configCachePath: cachePath,
  fetchImpl: async () => { throw new Error("Offline"); }
});

await new Promise(r => setTimeout(r, 60)); // Wait for disk load
console.log("Offline restored value:", offline.config("order.timeout.ms"));
offline.shutdown();

await unlink(cachePath);
console.log("Disk fallback test: PASS");
'
```
*Expected Output:*
```
Offline restored value: 2500
Disk fallback test: PASS
```

---

## ✅ Phase 7 Sign-off Checklist
- [x] **Fail-Open Guarantee**: All SDK methods wrapped in defensive boundaries; zero unhandled errors or request-path blocking.
- [x] **Bounded In-Memory Ring Buffer**: Default 500 items capacity with automatic drop-oldest shedding and stats tracking.
- [x] **Source-Level Redaction**: PII, passwords, authorization headers, cookies, API keys, and custom regex rules sanitized before transmission.
- [x] **Deterministic Canary Rollouts**: Consistent hashing (`inRollout`) by user ID or bucket key for staged rollouts.
- [x] **Resilient Config Streaming**: Real-time SSE configuration updates with exponential backoff reconnection and disk cache fallback.
- [x] **Unit & Integration Test Coverage**: 43 automated tests passing across the entire monorepo.
