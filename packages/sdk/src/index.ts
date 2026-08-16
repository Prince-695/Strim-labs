import { inRollout, type TelemetryEnvelope, type TelemetryEvent } from "@strim/shared";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type StrimInitOptions = {
  projectId: string;
  environment: string;
  apiKey: string;
  ingestUrl?: string;
  configUrl?: string;
  sampleRate?: number;
  maxBuffer?: number;
  configCachePath?: string;
  defaults?: Record<string, unknown>;
  fetchImpl?: FetchLike;
};

type Buffered = TelemetryEvent;

const DEFAULT_MAX = 500;

class StrimClient {
  private opts: StrimInitOptions | null = null;
  private buffer: Buffered[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private runtimeValues: Record<string, unknown> = {};
  private rolloutPercent = 0;
  private proposed: Record<string, unknown> = {};
  private closed = false;

  init(options: StrimInitOptions): void {
    this.opts = options;
    this.runtimeValues = { ...(options.defaults ?? {}) };
    this.loadCache().catch(() => undefined);
    this.timer = setInterval(() => {
      void this.flush();
    }, 500);
    if (typeof this.timer === "object" && "unref" in this.timer) {
      this.timer.unref();
    }
    void this.refreshConfig();
  }

  capture(event: Buffered): void {
    try {
      if (!this.opts || this.closed) return;
      const rate = this.opts.sampleRate ?? 1;
      const isError = (event.status ?? 200) >= 500;
      if (!isError && Math.random() > rate) return;
      const max = this.opts.maxBuffer ?? DEFAULT_MAX;
      if (this.buffer.length >= max) this.buffer.shift();
      this.buffer.push(event);
    } catch {
      // fail-open
    }
  }

  middleware() {
    return async (
      c: {
        req: { method: string; path: string; header: (n: string) => string | undefined };
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
      try {
        await next();
      } finally {
        this.capture({
          type: "request",
          requestId,
          traceId,
          method: c.req.method,
          path: c.req.path,
          status: 200,
          durationMs: Date.now() - started,
          service: this.opts?.projectId,
        });
      }
    };
  }

  configValue<T>(key: string, fallback: T): T;
  configValue(key: string): unknown;
  configValue<T>(key: string, fallback?: T): T | unknown {
    try {
      const useProposed = this.rolloutKey() ? inRollout(this.rolloutKey()!, this.rolloutPercent) : false;
      const source = useProposed ? this.proposed : this.runtimeValues;
      if (key in source) return source[key] as T;
      if (this.opts?.defaults && key in this.opts.defaults) return this.opts.defaults[key] as T;
      return fallback;
    } catch {
      return fallback;
    }
  }

  config<T>(key: string, fallback: T): T;
  config(key: string): unknown;
  config<T>(key: string, fallback?: T): T | unknown {
    return this.configValue(key, fallback as T);
  }

  private rolloutKey(): string | null {
    return this.opts ? `${this.opts.projectId}:${this.opts.environment}` : null;
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
        values: Record<string, unknown>;
        proposed?: Record<string, unknown>;
        rolloutPercent?: number;
      };
      this.runtimeValues = body.values ?? {};
      this.proposed = body.proposed ?? {};
      this.rolloutPercent = body.rolloutPercent ?? 0;
      await this.saveCache();
    } catch {
      // last-known-good already in memory/disk
    }
  }

  async flush(): Promise<void> {
    if (!this.opts || this.buffer.length === 0) return;
    const events = this.buffer.splice(0, this.buffer.length);
    const envelope: TelemetryEnvelope = {
      schema: "strim.telemetry.v1",
      timestamp: new Date().toISOString(),
      projectId: this.opts.projectId,
      environment: this.opts.environment,
      events,
    };
    try {
      await this.fetcher()(`${this.ingestBase()}/v1/ingest`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify(envelope),
      });
    } catch {
      const max = this.opts.maxBuffer ?? DEFAULT_MAX;
      this.buffer = [...events, ...this.buffer].slice(-max);
    }
  }

  shutdown(): void {
    this.closed = true;
    if (this.timer) clearInterval(this.timer);
    void this.flush();
  }

  private ingestBase(): string {
    return (this.opts?.ingestUrl ?? "http://localhost:3001").replace(/\/$/, "");
  }

  private fetcher(): FetchLike {
    return this.opts?.fetchImpl ?? fetch;
  }

  private cachePath(): string {
    return this.opts?.configCachePath ?? ".strim-config-cache.json";
  }

  private async loadCache(): Promise<void> {
    try {
      const raw = await readFile(this.cachePath(), "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      this.runtimeValues = { ...parsed, ...this.runtimeValues };
    } catch {
      // none
    }
  }

  private async saveCache(): Promise<void> {
    try {
      await mkdir(dirname(this.cachePath()), { recursive: true });
      await writeFile(this.cachePath(), JSON.stringify(this.runtimeValues));
    } catch {
      // fail-open
    }
  }
}

export const strim = new StrimClient();

export default strim;
