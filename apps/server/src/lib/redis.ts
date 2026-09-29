import Redis from "ioredis";

let redisClient: Redis | null = null;
let redisPubClient: Redis | null = null;
let redisSubClient: Redis | null = null;
let isRedisAvailable = false;

const inMemoryRateLimits = new Map<string, number[]>();

export function initRedis(): Redis | null {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }

  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
    });

    client.on("connect", () => {
      isRedisAvailable = true;
    });

    client.on("error", () => {
      isRedisAvailable = false;
    });

    redisClient = client;
    return client;
  } catch {
    isRedisAvailable = false;
    return null;
  }
}

export function getRedis(): Redis | null {
  if (!redisClient) {
    initRedis();
  }
  return isRedisAvailable ? redisClient : null;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }> {
  const redis = getRedis();
  const now = Date.now();

  if (redis) {
    try {
      const windowMs = windowSeconds * 1000;
      const clearBefore = now - windowMs;
      const redisKey = `ratelimit:${key}`;

      const multi = redis.multi();
      multi.zremrangebyscore(redisKey, 0, clearBefore);
      multi.zadd(redisKey, now, `${now}-${Math.random()}`);
      multi.zcard(redisKey);
      multi.expire(redisKey, windowSeconds);

      const results = await multi.exec();
      const count = (results?.[2]?.[1] as number) ?? 0;
      const remaining = Math.max(0, limit - count);

      return {
        allowed: count <= limit,
        remaining,
        resetSeconds: windowSeconds,
      };
    } catch {
      // Fallback to in-memory on Redis error
    }
  }

  // In-memory sliding window fallback
  const windowMs = windowSeconds * 1000;
  const timestamps = inMemoryRateLimits.get(key) ?? [];
  const valid = timestamps.filter((t) => t > now - windowMs);
  valid.push(now);
  inMemoryRateLimits.set(key, valid);

  if (inMemoryRateLimits.size > 10000) {
    const oldestAllowed = now - 3600000;
    for (const [k, ts] of inMemoryRateLimits.entries()) {
      if (!ts.some((t) => t > oldestAllowed)) inMemoryRateLimits.delete(k);
    }
  }

  const count = valid.length;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetSeconds: windowSeconds,
  };
}

export async function withLock<T>(
  lockKey: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  const token = Math.random().toString(36).slice(2);
  const key = `lock:${lockKey}`;

  let acquired = false;
  if (redis) {
    try {
      const res = await redis.set(key, token, "PX", ttlMs, "NX");
      acquired = res === "OK";
    } catch {
      acquired = false;
    }
  } else {
    acquired = true; // In single-process fallback mode, execute directly
  }

  if (!acquired) {
    throw new Error(`Could not acquire lock for ${lockKey}`);
  }

  try {
    return await fn();
  } finally {
    if (redis) {
      try {
        const val = await redis.get(key);
        if (val === token) {
          await redis.del(key);
        }
      } catch {
        // ignore unlock errors
      }
    }
  }
}
