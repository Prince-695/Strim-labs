import { IngestEventItem, StrimConfig } from './types.js';

export class StrimClient {
  private config: Required<StrimConfig>;
  private buffer: IngestEventItem[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;

  constructor(config: StrimConfig) {
    this.config = {
      apiKey: config.apiKey,
      endpoint: (config.endpoint || process.env.STRIM_ENDPOINT || 'https://api.strimlabs.com').replace(/\/+$/, ''),
      service: config.service || process.env.STRIM_SERVICE || 'api',
      batchSize: config.batchSize || 50,
      flushIntervalMs: config.flushIntervalMs || 2000,
      debug: config.debug ?? false,
    };

    if (!this.config.apiKey) {
      if (this.config.debug) {
        console.warn('[STRIM Labs] Warning: apiKey is not set. Telemetry events will be discarded.');
      }
    }

    this.startPeriodicFlush();
  }

  public record(event: IngestEventItem): void {
    if (!this.config.apiKey) return;

    this.buffer.push(event);

    if (this.buffer.length >= this.config.batchSize) {
      this.flush().catch(() => {});
    }
  }

  public async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0 || !this.config.apiKey) {
      return;
    }

    this.isFlushing = true;
    const batch = this.buffer.splice(0, this.config.batchSize);

    try {
      const url = `${this.config.endpoint}/v1/ingest/events`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
        body: JSON.stringify({
          service: this.config.service,
          events: batch,
        }),
      });

      if (!response.ok && this.config.debug) {
        console.warn(`[STRIM Labs] Ingest returned HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      if (this.config.debug) {
        console.error('[STRIM Labs] Failed to send telemetry batch:', err);
      }
      // Never throw out of flush: monitoring must never crash the host application
    } finally {
      this.isFlushing = false;
    }
  }

  private startPeriodicFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {});
    }, this.config.flushIntervalMs);

    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as any).unref();
    }
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush().catch(() => {});
  }
}
