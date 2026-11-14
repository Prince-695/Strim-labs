# STRIM Labs: Production Operations Runbook & Hardening Guide

This document defines the operational procedures, incident response playbooks, disaster recovery strategies, and security hardening guidelines for deploying and maintaining the STRIM Labs production backend infrastructure.

---

## 1. System Architecture & Topology

```
                          [ Ingress / Cloudflare / ALB ]
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
                 [ API Server Pod 1 ]          [ API Server Pod 2 ]
                 (Fiber HTTP Server)           (Fiber HTTP Server)
                         │                             │
                         ├──────────────┬──────────────┤
                         ▼              ▼              ▼
                 [ PostgreSQL 16 ]  [ Worker 1 ]   [ Prometheus ]
                 (Primary DB & TS)  (Load Engine)  (Metrics Scraper)
```

### Core Components
| Component | Binary | Responsibilities | High Availability Strategy |
|---|---|---|---|
| **API Server** | `bin/server` | Ingest API, REST API, SSE streaming, Auth, RBAC, Alert Evaluator | Horizontal scaling (2+ instances) behind load balancer |
| **Worker Node** | `bin/worker` | Distributed load generation, HDR histogram aggregation, Capacity analysis | Horizontal worker pool scaling via queue/job dispatcher |
| **Database** | PostgreSQL 16 | Relational data, Tenant isolation, Time-series rollups (1m & 1h) | Primary + Read Replica with automated failover |

---

## 2. Health Probes & Monitoring

### 2.1 Kubernetes / Container Probe Configuration
```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /readyz
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 2
```

- **/healthz (Liveness)**: Fast, zero-dependency process health check. If the HTTP server loop is deadlocked or unhandled panic occurs, kubelet restarts the container.
- **/readyz (Readiness)**: Deep dependency check executing database connection ping. If database connections are saturated or network is severed, traffic is temporarily routed away without restarting the process.
- **/v1/version (Build Info)**: Exposes compiled version, git commit hash, and build timestamp for release verification and CI/CD audit trails.

### 2.2 Prometheus Scraping (`/metrics`)
Scrape interval: 15s. Key metrics exposed:
- `strim_process_uptime_seconds`: Process continuous uptime.
- `strim_go_goroutines`: Active Go routines (detect goroutine leaks).
- `strim_go_memstats_alloc_bytes`: In-use heap memory.
- `strim_go_memstats_num_gc`: Garbage collection cycles count.

Sample Prometheus Alerting Rules:
```yaml
groups:
  - name: strim_alerts
    rules:
      - alert: StrimHighGoroutines
        expr: strim_go_goroutines > 10000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Abnormal goroutine spike detected in STRIM server"

      - alert: StrimDatabaseReadinessDegraded
        expr: probe_success{instance="strim-api/readyz"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "STRIM API failed readiness probe: Database unreachable"
```

---

## 3. Database Operations & Disaster Recovery

### 3.1 Automated Daily Backups (`pg_dump`)
Run daily at 02:00 UTC via scheduled cron or cloud-native snapshot service:
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/strim"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_FILE="${BACKUP_DIR}/strim_backup_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

# Execute custom-format binary dump with gzip compression
pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" -F c -Z 9 -f "${BACKUP_FILE}"

# Encrypt and upload to secure offsite object storage (S3/GCS)
# aws s3 cp "${BACKUP_FILE}" "s3://strim-secure-backups/${BACKUP_FILE}"

# Enforce 30-day retention policy
find "${BACKUP_DIR}" -type f -name "strim_backup_*.dump" -mtime +30 -delete
```

### 3.2 Disaster Recovery & Database Restoration
In case of catastrophic failure or data corruption:
```bash
# 1. Stop API and Worker instances to prevent partial writes
docker compose stop api worker

# 2. Restore into target database using pg_restore
pg_restore -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists -v /var/backups/strim/latest.dump

# 3. Verify table counts and integrity
psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" -c "
  SELECT count(*) FROM users;
  SELECT count(*) FROM projects;
  SELECT count(*) FROM request_events_raw;
"

# 4. Resume services and verify readiness
docker compose start api worker
curl -i http://localhost:8080/readyz
```

---

## 4. Incident Response Playbooks

### Playbook 1: High Ingestion Queue Depth & Backpressure (`INGEST_BACKPRESSURE`)
- **Symptom**: Telemetry ingestion requests receive HTTP `429 Too Many Requests` with error code `INGEST_BACKPRESSURE`.
- **Cause**: Ingestion channel buffer (`10,000` default capacity) reaches 95% capacity because disk I/O or database write throughput is slower than incoming traffic.
- **Immediate Triage Steps**:
  1. Inspect PostgreSQL write IOPS and active transactions:
     ```sql
     SELECT count(*), state FROM pg_stat_activity GROUP BY state;
     ```
  2. Increase batcher flush parameters in environment if CPU/RAM permits:
     `INGEST_BATCH_SIZE=2000` and `INGEST_BUFFER_SIZE=50000`.
  3. Verify that table indexes on `request_events_raw` and `request_rollup_1m` are not bloated. Run `VACUUM ANALYZE request_events_raw;`.

### Playbook 2: Database Connection Pool Exhaustion
- **Symptom**: `/readyz` returns HTTP `503 Service Unavailable`; logs display `sorry, too many clients already`.
- **Immediate Triage Steps**:
  1. Check connection counts per client:
     ```sql
     SELECT client_addr, count(*) FROM pg_stat_activity GROUP BY client_addr;
     ```
  2. Ensure PgBouncer or transaction pooling is enabled if running multiple API server replicas.
  3. Terminate idle-in-transaction connections older than 5 minutes:
     ```sql
     SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE state = 'idle in transaction'
       AND state_change < current_timestamp - INTERVAL '5 minutes';
     ```

### Playbook 3: Compromised API Key or Emergency Rotation
- **Symptom**: Unauthorized traffic or security notification regarding leaked key `strim_live_...`.
- **Immediate Triage Steps**:
  1. Query active API key ID from database or API:
     ```bash
     curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/api-keys" \
       -H "Authorization: Bearer ${ADMIN_TOKEN}"
     ```
  2. Revoke the key immediately:
     ```bash
     curl -i -X DELETE "${API_URL}/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/api-keys/${KEY_ID}" \
       -H "Authorization: Bearer ${ADMIN_TOKEN}"
     ```
  3. In-memory caches evict the key immediately upon revocation. Check audit logs to review exfiltrated data:
     ```bash
     curl -s -X GET "${API_URL}/v1/organizations/${ORG_ID}/audit-logs?action=api_key.revoked" \
       -H "Authorization: Bearer ${ADMIN_TOKEN}"
     ```

### Playbook 4: Emergency JWT Secret Rotation
- **Symptom**: Root `JWT_SECRET` compromised.
- **Immediate Triage Steps**:
  1. Generate a new cryptographically secure 64-character secret:
     ```bash
     openssl rand -hex 32
     ```
  2. Update environment variable `JWT_SECRET` in configuration store / deployment manifest.
  3. Restart all API instances. All previously issued tokens will be immediately invalidated and users will be forced to re-authenticate cleanly.

---

## 5. Security Checklist (OWASP ASVS L2 Alignment)

- [x] **SSRF Protection**: All outbound webhook and project verification requests pass through strict CIDR validation (`netguard.SSRFGuard`), rejecting loopback, private IPv4/IPv6, cloud metadata, and DNS rebinding attacks.
- [x] **Multi-Tenant Isolation**: Automated cross-tenant route sweeps guarantee that foreign tenant credentials strictly receive 404/403 with zero data leakage.
- [x] **Cryptographic Secret Storage**: Passwords hashed with `bcrypt` (cost 12), API keys stored as cryptographic `SHA-256` hashes, and webhook signing secrets masked in responses.
- [x] **HMAC Signatures**: Outbound webhooks signed with `HMAC-SHA256` (`X-Strim-Signature`) to prevent payload tampering.
- [x] **Security Headers**: OWASP recommended HTTP security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`).
- [x] **Non-Root Containers**: Docker images run as unprivileged `appuser` (UID 10001) with read-only root filesystems where appropriate.
