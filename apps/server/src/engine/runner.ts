import type { PrismaClient } from "@strim/db";
import { analyzeBreakingPoint, type BreakingPointAnalysis, type SampleMetric } from "@strim/shared";

export type RunConfig = {
  testRunId: string;
  organizationId: string;
  projectId: string;
  targetUrl: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  concurrency: number;
  durationSec: number;
  profile: "SUSTAINED" | "RAMP_UP" | "SPIKE" | "BREAKING_HUNT";
};

export type EngineEvent =
  | { type: "sample"; metric: SampleMetric }
  | { type: "done"; runId: string }
  | { type: "abort"; runId: string };

type LiveSubscriber = (event: EngineEvent) => void;

class LoadEngine {
  private activeRuns = new Map<string, { abortController: AbortController; subscribers: Set<LiveSubscriber> }>();

  /**
   * Subscribes a listener (e.g. SSE stream) to real-time 500ms metrics for a running test.
   */
  subscribe(testRunId: string, listener: LiveSubscriber): () => void {
    const run = this.activeRuns.get(testRunId);
    if (run) {
      run.subscribers.add(listener);
      return () => run.subscribers.delete(listener);
    }
    return () => undefined;
  }

  /**
   * Aborts an in-flight load test immediately.
   */
  abort(testRunId: string): boolean {
    const run = this.activeRuns.get(testRunId);
    if (run) {
      for (const sub of run.subscribers) {
        try {
          sub({ type: "abort", runId: testRunId });
        } catch {
          // ignore
        }
      }
      run.abortController.abort();
      this.activeRuns.delete(testRunId);
      return true;
    }
    return false;
  }

  /**
   * Executes a real high-throughput HTTP load test.
   */
  async execute(db: PrismaClient, config: RunConfig): Promise<void> {
    const abortController = new AbortController();
    const subscribers = new Set<LiveSubscriber>();
    this.activeRuns.set(config.testRunId, { abortController, subscribers });

    const signal = abortController.signal;
    const startTime = Date.now();
    const endTime = startTime + config.durationSec * 1000;

    const allLatencies: number[] = [];
    const statusCodes: Record<string, number> = {};
    let totalRequests = 0;
    let totalErrors = 0;

    const samplesToPersist: Array<{
      testRunId: string;
      timestamp: Date;
      rps: number;
      activeVUs: number;
      p50Ms: number;
      p95Ms: number;
      p99Ms: number;
      errorCount: number;
      statusCodes: Record<string, number>;
    }> = [];

    // Update status to RUNNING
    try {
      await db.testRun.update({
        where: { id: config.testRunId },
        data: { status: "RUNNING", startedAt: new Date() },
      });
    } catch {
      // ignore
    }

    // Interval tracking bucket (every 500ms)
    let intervalRequests = 0;
    let intervalErrors = 0;
    let intervalLatencies: number[] = [];
    let intervalStatusCodes: Record<string, number> = {};
    let lastTick = Date.now();

    const sampleTimer = setInterval(async () => {
      const now = Date.now();
      const elapsedSec = (now - lastTick) / 1000;
      lastTick = now;

      const rps = elapsedSec > 0 ? Number((intervalRequests / elapsedSec).toFixed(1)) : 0;
      intervalLatencies.sort((a, b) => a - b);
      const p50 = intervalLatencies[Math.floor(intervalLatencies.length * 0.5)] ?? 0;
      const p95 = intervalLatencies[Math.floor(intervalLatencies.length * 0.95)] ?? 0;
      const p99 = intervalLatencies[Math.floor(intervalLatencies.length * 0.99)] ?? 0;

      const metric: SampleMetric = {
        timestamp: new Date().toISOString(),
        rps,
        activeVUs: this.calculateCurrentVUs(config, elapsedSinceStart(startTime, now)),
        p50Ms: Number(p50.toFixed(1)),
        p95Ms: Number(p95.toFixed(1)),
        p99Ms: Number(p99.toFixed(1)),
        errorCount: intervalErrors,
        statusCodes: { ...intervalStatusCodes },
      };

      // Broadcast to live SSE stream listeners
      for (const sub of subscribers) {
        try {
          sub({ type: "sample", metric });
        } catch {
          // ignore dead subscriber
        }
      }

      // Collect sample for DB batch write
      samplesToPersist.push({
        testRunId: config.testRunId,
        timestamp: new Date(),
        rps: metric.rps,
        activeVUs: metric.activeVUs,
        p50Ms: metric.p50Ms,
        p95Ms: metric.p95Ms,
        p99Ms: metric.p99Ms,
        errorCount: metric.errorCount,
        statusCodes: metric.statusCodes,
      });

      // Reset interval counters
      intervalRequests = 0;
      intervalErrors = 0;
      intervalLatencies = [];
      intervalStatusCodes = {};
    }, 500);

    const headers = new Headers();
    if (config.headers && typeof config.headers === "object") {
      for (const [k, v] of Object.entries(config.headers)) {
        if (v !== undefined && v !== null) headers.set(k, String(v));
      }
    }
    if (!headers.has("content-type") && config.body) {
      headers.set("content-type", "application/json");
    }
    headers.set("x-strim-loadtest-id", config.testRunId);

    const bodyPayload = config.body ? (typeof config.body === "string" ? config.body : JSON.stringify(config.body)) : undefined;

    // Concurrency Worker Loop
    const workers = Array.from({ length: config.concurrency }, async (_, vuIndex) => {
      while (!signal.aborted && Date.now() < endTime) {
        // Evaluate profile active delay / ramp-up gating
        const currentProgress = elapsedSinceStart(startTime, Date.now()) / config.durationSec;
        const requiredVUs = this.calculateCurrentVUs(config, elapsedSinceStart(startTime, Date.now()));

        if (vuIndex >= requiredVUs) {
          // This VU is not yet active in ramp-up
          await Bun.sleep(100);
          continue;
        }

        const reqStart = performance.now();
        let status = 0;

        try {
          const res = await fetch(config.targetUrl, {
            method: config.method,
            headers,
            body: bodyPayload,
            signal: AbortSignal.timeout(5000),
          });
          status = res.status;
          await res.arrayBuffer(); // Consume body to release socket
        } catch (err: unknown) {
          if (signal.aborted) break;
          status = (err as { name?: string }).name === "TimeoutError" ? 504 : 500;
        }

        const durationMs = performance.now() - reqStart;

        // Record metrics
        totalRequests += 1;
        intervalRequests += 1;
        intervalLatencies.push(durationMs);
        allLatencies.push(durationMs);

        const statusKey = String(status);
        statusCodes[statusKey] = (statusCodes[statusKey] ?? 0) + 1;
        intervalStatusCodes[statusKey] = (intervalStatusCodes[statusKey] ?? 0) + 1;

        if (status >= 400) {
          totalErrors += 1;
          intervalErrors += 1;
        }
      }
    });

    try {
      await Promise.all(workers);
    } catch {
      // worker completed or aborted
    } finally {
      clearInterval(sampleTimer);

      for (const sub of subscribers) {
        try {
          sub({ type: signal.aborted ? "abort" : "done", runId: config.testRunId });
        } catch {
          // ignore
        }
      }

      this.activeRuns.delete(config.testRunId);

      // Compute final percentiles
      allLatencies.sort((a, b) => a - b);
      const p50 = allLatencies[Math.floor(allLatencies.length * 0.5)] ?? 0;
      const p95 = allLatencies[Math.floor(allLatencies.length * 0.95)] ?? 0;
      const p99 = allLatencies[Math.floor(allLatencies.length * 0.99)] ?? 0;
      const totalSec = Math.max(1, (Date.now() - startTime) / 1000);
      const avgRps = Number((totalRequests / totalSec).toFixed(1));
      const peakRps = samplesToPersist.reduce((max, s) => Math.max(max, s.rps), avgRps);
      const errorRate = totalRequests > 0 ? Number((totalErrors / totalRequests).toFixed(4)) : 0;

      // Automated Breaking Point calculation
      const breakingPoint: BreakingPointAnalysis = analyzeBreakingPoint(
        samplesToPersist.map((s) => ({
          rps: s.rps,
          errorRate: s.rps > 0 ? s.errorCount / s.rps : 0,
          p95Ms: s.p95Ms,
          statusCodes: s.statusCodes,
        })),
      );

      // Persist results to DB
      try {
        await db.testRun.update({
          where: { id: config.testRunId },
          data: {
            status: signal.aborted ? "ABORTED" : "COMPLETED",
            totalRequests,
            avgRps,
            peakRps,
            p50Ms: Number(p50.toFixed(1)),
            p95Ms: Number(p95.toFixed(1)),
            p99Ms: Number(p99.toFixed(1)),
            errorRate,
            statusCodes: statusCodes as object,
            breakingPoint: breakingPoint as object,
            completedAt: new Date(),
          },
        });

        if (samplesToPersist.length > 0) {
          await db.testSample.createMany({
            data: samplesToPersist,
          });
        }
      } catch (err) {
        console.error("[LoadEngine] Failed to persist final test run results:", err);
      }
    }
  }

  private calculateCurrentVUs(config: RunConfig, elapsedSec: number): number {
    const totalDuration = Math.max(1, config.durationSec);
    const progress = Math.min(1, elapsedSec / totalDuration);

    if (config.profile === "SUSTAINED") {
      return config.concurrency;
    }

    if (config.profile === "RAMP_UP") {
      // Linear ramp up from 1 to max concurrency
      return Math.max(1, Math.round(progress * config.concurrency));
    }

    if (config.profile === "SPIKE") {
      // 20% warm-up, 40% massive burst, 40% recovery
      if (progress < 0.2) return Math.max(1, Math.round(config.concurrency * 0.2));
      if (progress < 0.6) return config.concurrency;
      return Math.max(1, Math.round(config.concurrency * 0.3));
    }

    return config.concurrency;
  }
}

function elapsedSinceStart(start: number, now: number): number {
  return Math.max(0, (now - start) / 1000);
}

export const loadEngine = new LoadEngine();
