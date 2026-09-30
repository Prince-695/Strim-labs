import type { SdkBufferStats } from "./types";

export class RingBuffer<T> {
  private buffer: T[] = [];
  private readonly capacity: number;
  private droppedCount = 0;
  private totalCapturedCount = 0;
  private totalFlushedCount = 0;

  constructor(capacity = 500) {
    this.capacity = Math.max(1, capacity);
  }

  push(item: T): boolean {
    this.totalCapturedCount++;
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift(); // drop oldest to respect memory ceiling
      this.droppedCount++;
    }
    this.buffer.push(item);
    return true;
  }

  drain(): T[] {
    const items = this.buffer;
    this.buffer = [];
    this.totalFlushedCount += items.length;
    return items;
  }

  requeue(items: T[]): void {
    if (items.length === 0) return;
    this.totalFlushedCount = Math.max(0, this.totalFlushedCount - items.length);

    // Prepend items back, shedding oldest if combined exceeds capacity
    const combined = [...items, ...this.buffer];
    if (combined.length > this.capacity) {
      const dropCount = combined.length - this.capacity;
      this.droppedCount += dropCount;
      this.buffer = combined.slice(dropCount);
    } else {
      this.buffer = combined;
    }
  }

  get size(): number {
    return this.buffer.length;
  }

  get stats(): SdkBufferStats {
    return {
      buffered: this.buffer.length,
      capacity: this.capacity,
      dropped: this.droppedCount,
      totalCaptured: this.totalCapturedCount,
      totalFlushed: this.totalFlushedCount,
    };
  }

  clear(): void {
    this.buffer = [];
  }
}
