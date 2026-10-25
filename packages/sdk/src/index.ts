/**
 * STRIM Labs SDK - Continuous Production Observability & Breakpoint Diagnosis
 */

export interface StrimConfig {
  /** Project API Key from STRIM Labs (strim_live_...) */
  apiKey: string;
  /** STRIM Ingestion Endpoint (defaults to http://localhost:8080/v1/ingest or STRIM_ENDPOINT_URL env) */
  endpointUrl?: string;
  /** Buffer flush interval in milliseconds (default: 2000ms) */
  flushIntervalMs?: number;
  /** Max batch size to flush at once (default: 100) */
  maxBatchSize?: number;
  /** Max buffer capacity before dropping oldest events to prevent memory leaks (default: 5000) */
  maxBufferCapacity?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

export interface TelemetryEvent {
  timestamp: number;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userAgent?: string;
  ipHash?: string;
}

export class StrimClient {
  private config: Required<StrimConfig>;
  private buffer: TelemetryEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;

  constructor(config: StrimConfig) {
    if (!config.apiKey) {
      throw new Error("[STRIM SDK] API key is required. Provide `apiKey: 'strim_live_...'`");
    }

    const defaultEndpoint = 
      typeof process !== "undefined" && process.env?.STRIM_ENDPOINT_URL
        ? process.env.STRIM_ENDPOINT_URL
        : "http://localhost:8080/v1/ingest";

    this.config = {
      apiKey: config.apiKey,
      endpointUrl: (config.endpointUrl || defaultEndpoint).replace(/\/+$/, ""),
      flushIntervalMs: config.flushIntervalMs ?? 2000,
      maxBatchSize: config.maxBatchSize ?? 100,
      maxBufferCapacity: config.maxBufferCapacity ?? 5000,
      debug: config.debug ?? false,
    };

    this.startPeriodicFlush();

    // Hook node graceful shutdown if available
    if (typeof process !== "undefined" && typeof process.on === "function") {
      process.on("beforeExit", () => {
        this.flush().catch(() => {});
      });
    }
  }

  private startPeriodicFlush() {
    if (typeof setInterval !== "undefined") {
      this.flushTimer = setInterval(() => {
        this.flush().catch((err) => {
          if (this.config.debug) {
            console.warn("[STRIM SDK] Background flush error:", err);
          }
        });
      }, this.config.flushIntervalMs);

      // Prevent keeping the node process alive unnecessarily
      if (this.flushTimer && typeof (this.flushTimer as any).unref === "function") {
        (this.flushTimer as any).unref();
      }
    }
  }

  /**
   * Record a single telemetry event into the buffer
   */
  public record(event: TelemetryEvent) {
    // Prevent memory leaks if STRIM ingestion is unreachable
    if (this.buffer.length >= this.config.maxBufferCapacity) {
      this.buffer.shift(); // Drop oldest
    }

    this.buffer.push(event);

    if (this.buffer.length >= this.config.maxBatchSize) {
      this.flush().catch(() => {});
    }
  }

  /**
   * Flush current buffer to STRIM ingestion server
   */
  public async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) return;
    this.isFlushing = true;

    const batch = this.buffer.splice(0, this.config.maxBatchSize);

    try {
      const targetUrl = this.config.endpointUrl.endsWith("/v1/ingest")
        ? this.config.endpointUrl
        : `${this.config.endpointUrl}/v1/ingest`;

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-strim-key": this.config.apiKey,
          "User-Agent": "@strim/sdk-v0.1.0",
        },
        body: JSON.stringify({
          events: batch,
          sentAt: Date.now(),
        }),
      });

      if (!response.ok && this.config.debug) {
        console.warn(`[STRIM SDK] Ingestion returned HTTP ${response.status}`);
      }
    } catch (err) {
      if (this.config.debug) {
        console.warn("[STRIM SDK] Failed to send telemetry batch to STRIM Labs:", err);
      }
      // Re-insert un-sent events if capacity allows
      if (this.buffer.length + batch.length <= this.config.maxBufferCapacity) {
        this.buffer.unshift(...batch);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Stop timer and clean up
   */
  public destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

/**
 * Global singleton manager
 */
let globalClient: StrimClient | null = null;

export function initStrim(config: StrimConfig): StrimClient {
  globalClient = new StrimClient(config);
  return globalClient;
}

export function getStrim(): StrimClient | null {
  return globalClient;
}

/**
 * Route path normalizer: removes query parameters and hashes, trims trailing slash
 */
export function normalizePath(pathOrUrl: string): string {
  try {
    const rawPath = pathOrUrl.includes("://")
      ? new URL(pathOrUrl).pathname
      : (pathOrUrl.split("?")[0] || "/").split("#")[0] || "/";
    const cleaned = rawPath.replace(/\/+$/, "");
    return cleaned === "" ? "/" : cleaned;
  } catch {
    return pathOrUrl.split("?")[0] || "/";
  }
}

/**
 * Express Middleware
 * Usage:
 * ```ts
 * import express from 'express';
 * import { strimExpress } from '@strim/sdk';
 * const app = express();
 * app.use(strimExpress({ apiKey: 'strim_live_...' }));
 * ```
 */
export function strimExpress(config: StrimConfig) {
  const client = initStrim(config);

  return function (req: any, res: any, next: (err?: any) => void) {
    const start = performance.now();
    const originalEnd = res.end;

    res.end = function (...args: any[]) {
      const durationMs = Math.round(performance.now() - start);
      const path = normalizePath(req.originalUrl || req.url || "/");
      const method = (req.method || "GET").toUpperCase();
      const statusCode = res.statusCode || 200;

      client.record({
        timestamp: Date.now(),
        method,
        path,
        statusCode,
        durationMs,
        userAgent: req.headers?.["user-agent"] || "",
      });

      return originalEnd.apply(res, args);
    };

    next();
  };
}

/**
 * Hono Middleware
 * Usage:
 * ```ts
 * import { Hono } from 'hono';
 * import { strimHono } from '@strim/sdk';
 * const app = new Hono();
 * app.use('*', strimHono({ apiKey: 'strim_live_...' }));
 * ```
 */
export function strimHono(config: StrimConfig) {
  const client = initStrim(config);

  return async function (c: any, next: () => Promise<void>) {
    const start = performance.now();
    await next();
    const durationMs = Math.round(performance.now() - start);
    const path = normalizePath(c.req.path || "/");
    const method = (c.req.method || "GET").toUpperCase();
    const statusCode = c.res.status || 200;

    client.record({
      timestamp: Date.now(),
      method,
      path,
      statusCode,
      durationMs,
      userAgent: c.req.header("user-agent") || "",
    });
  };
}

/**
 * Fastify Plugin Hook
 * Usage:
 * ```ts
 * fastify.addHook('onResponse', strimFastify({ apiKey: 'strim_live_...' }));
 * ```
 */
export function strimFastify(config: StrimConfig) {
  const client = initStrim(config);

  return function (request: any, reply: any, done: () => void) {
    const durationMs = Math.round(reply.elapsedTime || 0);
    const path = normalizePath(request.url || "/");
    const method = (request.method || "GET").toUpperCase();
    const statusCode = reply.statusCode || 200;

    client.record({
      timestamp: Date.now(),
      method,
      path,
      statusCode,
      durationMs,
      userAgent: request.headers?.["user-agent"] || "",
    });

    done();
  };
}

/**
 * Next.js Route Handler Wrapper
 * Usage:
 * ```ts
 * export const GET = strimNext(async (req) => {
 *   return Response.json({ ok: true });
 * }, { apiKey: 'strim_live_...' });
 * ```
 */
export function strimNext<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  config: StrimConfig
): T {
  const client = getStrim() || initStrim(config);

  return (async (...args: any[]) => {
    const start = performance.now();
    const req = args[0] as Request | undefined;
    const url = req ? new URL(req.url) : null;
    let res: Response;
    let statusCode = 200;

    try {
      res = await handler(...args);
      statusCode = res.status;
      return res;
    } catch (err) {
      statusCode = 500;
      throw err;
    } finally {
      const durationMs = Math.round(performance.now() - start);
      if (url) {
        client.record({
          timestamp: Date.now(),
          method: req?.method?.toUpperCase() || "GET",
          path: normalizePath(url.pathname),
          statusCode,
          durationMs,
          userAgent: req?.headers?.get("user-agent") || "",
        });
      }
    }
  }) as T;
}
