type Handler<T> = (data: T) => Promise<void>;

export class MemoryQueue {
  private handlers = new Map<string, Handler<unknown>>();
  private events: { type: string; payload: unknown }[] = [];
  private wsListeners = new Set<(data: string) => void>();

  async enqueue<T>(name: string, data: T): Promise<void> {
    const handler = this.handlers.get(name);
    if (handler) {
      queueMicrotask(() => {
        void handler(data);
      });
    }
  }

  process<T>(name: string, handler: Handler<T>): void {
    this.handlers.set(name, handler as Handler<unknown>);
  }

  publish(type: string, payload: unknown): void {
    const packet = JSON.stringify({ type, payload, occurredAt: new Date().toISOString() });
    this.events.push({ type, payload });
    if (this.events.length > 500) this.events.shift();
    for (const l of this.wsListeners) l(packet);
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

export const queue = new MemoryQueue();
