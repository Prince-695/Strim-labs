export interface StrimConfig {
  /**
   * Your Project API Key (e.g. strim_live_...) from the STRIM Labs dashboard.
   */
  apiKey: string;

  /**
   * Optional STRIM Labs ingestion endpoint.
   * Defaults to 'https://api.strimlabs.com' or process.env.STRIM_ENDPOINT.
   */
  endpoint?: string;

  /**
   * Optional service identifier (e.g. 'auth-service', 'checkout-api').
   */
  service?: string;

  /**
   * Maximum number of events to buffer in memory before triggering an immediate flush.
   * Defaults to 50.
   */
  batchSize?: number;

  /**
   * Interval in milliseconds at which the buffered events are flushed.
   * Defaults to 2000 ms (2 seconds).
   */
  flushIntervalMs?: number;

  /**
   * Enable verbose console logging for debugging telemetry delivery.
   * Defaults to false.
   */
  debug?: boolean;
}

export interface IngestEventItem {
  ts: string;
  method: string;
  path: string;
  route?: string;
  status: number;
  duration_ms: number;
  bytes?: number;
  error?: boolean;
}

export interface IngestPayload {
  service?: string;
  events: IngestEventItem[];
}
