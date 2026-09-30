import {
  inRollout,
  redactHeaders,
  redactJson,
  redactString,
  type TelemetryEnvelope,
  type TelemetryEvent,
} from "@strim/shared";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { RingBuffer } from "./ring-buffer";
import type {
  ConfigOptions,
  FetchLike,
  SdkBufferStats,
  StrimInitOptions,
} from "./types";

const DEFAULT_MAX_BUFFER = 500;
const DEFAULT_FLUSH_INTERVAL_MS = 500;
const DEFAULT_CONFIG_CACHE_PATH = ".strim-config-cache.json";

export class StrimClient {
  private opts: StrimInitOptions | null = null;
  private ringBuffer: RingBuffer<TelemetryEvent> = new RingBuffer(DEFAULT_MAX_BUFFER);
  private timer: ReturnType<typeof setInterval> | null = null;
  private runtimeValues: Record<string, unknown> = {};
  private proposed: Record<string, unknown> = {};
  private rolloutPercent = 0;
  private closed = false;
  private streamAbortController: AbortController | null = null;
  private streamRetryTimeout: ReturnType<typeof setTimeout> | null = null;

  init(options: StrimInitOptions): void {
    try {
      this.opts = options;
      this.closed = false;
      this.ringBuffer = new RingBuffer(options.maxBuffer ?? DEFAULT_MAX_BUFFER);
      this.runtimeValues = { ...(options.defaults ?? {}) };
      this.proposed = {};
      this.rolloutPercent = 0;

      // Load last-known-good configuration from disk asynchronously
      void this.loadCache();

      // Start periodic flush timer
      const interval = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
      this.timer = setInterval(() => {
        void this.flush();
      }, interval);
      if (typeof this.timer === "object" && "unref" in this.timer) {
        this.timer.unref();
      }

      // Initial active config fetch
      void this.refreshConfig();

      // Start streaming config updates if enabled
      if (options.enableStreaming !== false) {
        void this.startConfigStreamLoop();
      }
    } catch (err: unknown) {
      this.handleError(err);
    }
  }

  capture(event: TelemetryEvent): void {
    try {
      if (!this.opts || this.closed) return;

      // 1. Sampling evaluation
      const status = event.status ?? 200;
      const isError = status >= 500 || (event.type === "log" && status >= 400);
      const sampleRate = isError
        ? (this.opts.errorSampleRate ?? 1.0)
        : (this.opts.sampleRate ?? 1.0);

      if (sampleRate < 1.0 && Math.random() > sampleRate) {
        return;
      }

      // 2. Source-level PII, token, and auth redaction
      const rules = this.opts.customRedactionRules;
      const sanitized: TelemetryEvent = {
        ...event,
        service: event.service ?? this.opts.projectId,
      };

      if (sanitized.headers) {
        sanitized.headers = redactHeaders(sanitized.headers, rules);
      }

      if (sanitized.path) {
        sanitized.path = redactString(sanitized.path, rules);
      }

      if (sanitized.body !== undefined) {
        sanitized.body = redactJson(sanitized.body, rules);
      }

      if (sanitized.attributes) {
        sanitized.attributes = redactJson(sanitized.attributes, rules) as Record<string, unknown>;
      }

      // 3. Enqueue into bounded ring buffer (drops oldest on backpressure)
      this.ringBuffer.push(sanitized);
    } catch (err: unknown) {
      this.handleError(err);
    }
  }

  middleware() {
    return async (
      c: {
        req: {
          method: string;
          path: string;
          header: (n: string) => string | undefined;
        };
        header: (k: string, v: string) => void;
      },
      next: () => Promise<void>,
    ) => {
      const started = Date.now();
      const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
      const traceId = c.req.header("x-trace-id") ?? crypto.randomUUID();
      c.header("x-request-id", requestId);
      c.header("x-trace-id", traceId);

      this.capture({
        type: "request",
        requestId,
        traceId,
        method: c.req.method,
        path: c.req.path,
        service: this.opts?.projectId,
      });

      let statusCode = 200;
      try {
        await next();
      } catch (err: unknown) {
        statusCode = 500;
        throw err;
      } finally {
        this.capture({
          type: "request",
          requestId,
          traceId,
          method: c.req.method,
          path: c.req.path,
          status: statusCode,
          durationMs: Date.now() - started,
          service: this.opts?.projectId,
        });
      }
    };
  }

  configValue<T>(key: string, fallback?: T, options?: ConfigOptions): T | unknown {
    try {
      const keyToHash = options?.bucketKey ?? this.rolloutKey();
      const useProposed =
        keyToHash && this.rolloutPercent > 0
          ? inRollout(keyToHash, this.rolloutPercent)
          : false;

      const source = useProposed ? this.proposed : this.runtimeValues;

      if (key in source) return source[key] as T;
      if (this.opts?.defaults && key in this.opts.defaults) {
        return this.opts.defaults[key] as T;
      }
      return fallback;
    } catch (err: unknown) {
      this.handleError(err);
      return fallback;
    }
  }

  config<T>(key: string, fallback?: T, options?: ConfigOptions): T | unknown {
    return this.configValue(key, fallback, options);
  }

  inRollout(bucketKey: string, rolloutPercent?: number): boolean {
    try {
      const percent = rolloutPercent ?? this.rolloutPercent;
      if (percent <= 0) return false;
      if (percent >= 100) return true;
      return inRollout(bucketKey, percent);
    } catch (err: unknown) {
      this.handleError(err);
      return false;
    }
  }

  getStats(): SdkBufferStats {
    return this.ringBuffer.stats;
  }

  getAllConfig(): {
    values: Record<string, unknown>;
    proposed: Record<string, unknown>;
    rolloutPercent: number;
  } {
    return {
      values: { ...this.runtimeValues },
      proposed: { ...this.proposed },
      rolloutPercent: this.rolloutPercent,
    };
  }

  async refreshConfig(): Promise<void> {
    if (!this.opts) return;
    const url = this.opts.configUrl ?? `${this.ingestBase()}/v1/sdk/config`;
    try {
      const res = await this.fetcher()(url, {
        headers: {
          authorization: `Bearer ${this.opts.apiKey}`,
          "x-strim-project": this.opts.projectId,
          "x-strim-environment": this.opts.environment,
        },
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        values?: Record<string, unknown>;
        proposed?: Record<string, unknown>;
        rolloutPercent?: number;
      };
      if (body.values) {
        this.runtimeValues = { ...this.runtimeValues, ...body.values };
      }
      if (body.proposed) {
        this.proposed = body.proposed;
      }
      if (typeof body.rolloutPercent === "number") {
        this.rolloutPercent = body.rolloutPercent;
      }
      await this.saveCache();
    } catch (err: unknown) {
      this.handleError(err);
    }
  }

  private async startConfigStreamLoop(): Promise<void> {
    let delay = 1000;
    while (!this.closed) {
      try {
        await this.connectConfigStream();
        delay = 1000; // Reset delay after successful stream run
      } catch (err: unknown) {
        this.handleError(err);
      }

      if (this.closed) break;

      // Exponential backoff with jitter (max 30s)
      const jitter = Math.random() * 500;
      await new Promise((resolve) => {
        this.streamRetryTimeout = setTimeout(resolve, Math.min(30000, delay) + jitter);
      });
      delay *= 2;
    }
  }

  private async connectConfigStream(): Promise<void> {
    if (!this.opts || this.closed) return;
    const streamUrl = `${this.ingestBase()}/v1/sdk/config/stream?project=${encodeURIComponent(
      this.opts.projectId,
    )}&environment=${encodeURIComponent(this.opts.environment)}`;

    this.streamAbortController = new AbortController();
    const res = await this.fetcher()(streamUrl, {
      headers: {
        authorization: `Bearer ${this.opts.apiKey}`,
        "x-strim-project": this.opts.projectId,
        "x-strim-environment": this.opts.environment,
      },
      signal: this.streamAbortController.signal,
    });

    if (!res.ok || !res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (!this.closed) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const block of lines) {
        if (block.includes("event: config")) {
          const dataMatch = block.match(/data: (.+)/);
          if (dataMatch?.[1]) {
            try {
              const payload = JSON.parse(dataMatch[1]) as {
                values?: Record<string, unknown>;
                proposed?: Record<string, unknown>;
                percent?: number;
                rolloutPercent?: number;
              };
              if (payload.values) {
                this.runtimeValues = { ...this.runtimeValues, ...payload.values };
              }
              if (payload.proposed) {
                this.proposed = payload.proposed;
              }
              const pct = payload.percent ?? payload.rolloutPercent;
              if (typeof pct === "number") {
                this.rolloutPercent = pct;
              }
              await this.saveCache();
            } catch {
              // Ignore malformed frame
            }
          }
        }
      }
    }
  }

  async flush(): Promise<void> {
    if (!this.opts || this.ringBuffer.size === 0) return;
    const events = this.ringBuffer.drain();
    if (events.length === 0) return;

    const envelope: TelemetryEnvelope = {
      schema: "strim.telemetry.v1",
      timestamp: new Date().toISOString(),
      projectId: this.opts.projectId,
      environment: this.opts.environment,
      events,
    };

    try {
      const res = await this.fetcher()(`${this.ingestBase()}/v1/ingest`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify(envelope),
      });

      if (!res.ok) {
        // Requeue unsent events respecting capacity
        this.ringBuffer.requeue(events);
      }
    } catch {
      // Requeue on network failure (fail-open)
      this.ringBuffer.requeue(events);
    }
  }

  shutdown(): void {
    this.closed = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.streamRetryTimeout) {
      clearTimeout(this.streamRetryTimeout);
      this.streamRetryTimeout = null;
    }
    if (this.streamAbortController) {
      try {
        this.streamAbortController.abort();
      } catch {
        // ignore
      }
      this.streamAbortController = null;
    }
    void this.flush();
  }

  private rolloutKey(): string | null {
    return this.opts ? `${this.opts.projectId}:${this.opts.environment}` : null;
  }

  private ingestBase(): string {
    return (this.opts?.ingestUrl ?? "http://localhost:8080").replace(/\/$/, "");
  }

  private fetcher(): FetchLike {
    return this.opts?.fetchImpl ?? fetch;
  }

  private cachePath(): string {
    return this.opts?.configCachePath ?? DEFAULT_CONFIG_CACHE_PATH;
  }

  private async loadCache(): Promise<void> {
    try {
      const raw = await readFile(this.cachePath(), "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      this.runtimeValues = { ...parsed, ...this.runtimeValues };
    } catch {
      // No local cache file yet, proceed fail-open
    }
  }

  private async saveCache(): Promise<void> {
    try {
      await mkdir(dirname(this.cachePath()), { recursive: true });
      await writeFile(this.cachePath(), JSON.stringify(this.runtimeValues));
    } catch {
      // Fail-open
    }
  }

  private handleError(err: unknown): void {
    try {
      if (this.opts?.onError && err instanceof Error) {
        this.opts.onError(err);
      }
    } catch {
      // Fail-open
    }
  }
}
