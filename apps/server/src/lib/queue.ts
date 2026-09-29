import { getRedis } from "./redis";

type Handler<T> = (data: T) => Promise<void>;

export class ResilientQueue {
  private handlers = new Map<string, Handler<unknown>>();
  private events: { type: string; payload: unknown; occurredAt: string }[] = [];
  private wsListeners = new Set<(data: string) => void>();
  private redisSubscribed = false;

  constructor() {
    this.setupRedisSubscriber();
  }

  private setupRedisSubscriber() {
    const redis = getRedis();
    if (!redis || this.redisSubscribed) return;

    try {
      const sub = redis.duplicate();
      sub.subscribe("strim:events", (err) => {
        if (!err) this.redisSubscribed = true;
      });

      sub.on("message", (_channel, message) => {
        try {
          const parsed = JSON.parse(message) as { type: string; payload: unknown; occurredAt: string };
          this.events.push(parsed);
          if (this.events.length > 500) this.events.shift();
          for (const l of this.wsListeners) l(message);
        } catch {
          // ignore malformed packets
        }
      });
    } catch {
      this.redisSubscribed = false;
    }
  }

  async enqueue<T>(name: string, data: T): Promise<void> {
    const handler = this.handlers.get(name);
    if (handler) {
      queueMicrotask(async () => {
        try {
          await handler(data);
        } catch (err) {
          console.error(`[Queue] Error processing job '${name}':`, err);
        }
      });
    }
  }

  process<T>(name: string, handler: Handler<T>): void {
    this.handlers.set(name, handler as Handler<unknown>);
  }

  publish(type: string, payload: unknown): void {
    const occurredAt = new Date().toISOString();
    const packet = JSON.stringify({ type, payload, occurredAt });
    this.events.push({ type, payload, occurredAt });
    if (this.events.length > 500) this.events.shift();

    for (const l of this.wsListeners) l(packet);

    const redis = getRedis();
    if (redis) {
      redis.publish("strim:events", packet).catch(() => undefined);
    }
  }

  subscribe(listener: (data: string) => void): () => void {
    this.wsListeners.add(listener);
    return () => this.wsListeners.delete(listener);
  }

  recent(organizationId?: string) {
    return this.events.filter((e) => {
      const p = e.payload as { organizationId?: string };
      return !organizationId || p.organizationId === organizationId;
    });
  }
}

export const queue = new ResilientQueue();
