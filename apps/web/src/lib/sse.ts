import { API_URL } from "./api";
import type { StreamState, TestRun, TestSample } from "./types";

type StreamOptions = {
  runId: string;
  token: string;
  orgId: string;
  onSample: (sample: TestSample) => void;
  onDone: (run: TestRun | null) => void;
  onAbort: () => void;
  onState: (state: StreamState) => void;
};

const MAX_ATTEMPTS = 6;

/**
 * Opens the run's SSE stream with fetch (EventSource cannot send Authorization headers).
 * - Reconnects with bounded exponential backoff.
 * - Never fabricates samples for gaps: whatever the server sends is what is shown.
 * - Returns a disposer that tears the connection down (call on unmount).
 */
export function openRunStream(opts: StreamOptions): () => void {
  const controller = new AbortController();
  let disposed = false;
  let finished = false;
  let lastTimestamp = "";

  async function connect(attempt: number): Promise<void> {
    if (disposed || finished) return;
    opts.onState(attempt === 0 ? "connecting" : "reconnecting");

    try {
      const res = await fetch(`${API_URL}/v1/load-tests/${opts.runId}/stream`, {
        headers: {
          accept: "text/event-stream",
          authorization: `Bearer ${opts.token}`,
          "x-organization-id": opts.orgId,
        },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);

      opts.onState("live");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        // SSE frames are separated by a blank line.
        while ((sep = buffer.search(/\r?\n\r?\n/)) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep).replace(/^\r?\n\r?\n/, "");
          handleFrame(frame);
          if (finished) {
            reader.cancel().catch(() => undefined);
            return;
          }
        }
      }
      // Stream closed without a terminal event — try to reconnect.
      throw new Error("stream closed");
    } catch (err) {
      if (disposed || finished || (err instanceof DOMException && err.name === "AbortError")) return;
      if (attempt + 1 >= MAX_ATTEMPTS) {
        opts.onState("disconnected");
        return;
      }
      opts.onState("reconnecting");
      const delay = Math.min(5000, 400 * 2 ** attempt);
      await new Promise((r) => setTimeout(r, delay));
      return connect(attempt + 1);
    }
  }

  function handleFrame(frame: string) {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith(":")) continue; // heartbeat/comment
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return;

    let payload: unknown;
    try {
      payload = JSON.parse(dataLines.join("\n"));
    } catch {
      return;
    }

    if (event === "sample" || event === "message") {
      const sample = payload as TestSample;
      if (!sample || typeof sample.timestamp !== "string") return;
      // Avoid duplicates when the stream reconnects and replays.
      if (sample.timestamp <= lastTimestamp) return;
      lastTimestamp = sample.timestamp;
      opts.onSample(sample);
    } else if (event === "done") {
      finished = true;
      opts.onState("completed");
      opts.onDone((payload as { run?: TestRun })?.run ?? null);
    } else if (event === "abort") {
      finished = true;
      opts.onState("completed");
      opts.onAbort();
    }
  }

  void connect(0);

  return () => {
    disposed = true;
    controller.abort();
  };
}
