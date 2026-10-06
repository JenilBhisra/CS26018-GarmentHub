import { headers } from "next/headers";

// Configurable limit rules interface
export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

// TODO: In production, rate limiting should be backed by a distributed database 
// such as Redis, Upstash, or Cloudflare KV. Memory-based rate limiting resets
// on server restarts and does not synchronize state across multiple server instances.
export const RATE_LIMIT_RULES: Record<string, RateLimitConfig> = {
  login: { limit: 5, windowMs: 15 * 60 * 1000 },          // 5 requests per 15 minutes
  register: { limit: 3, windowMs: 15 * 60 * 1000 },       // 3 requests per 15 minutes
  kyc: { limit: 5, windowMs: 60 * 60 * 1000 },            // 5 submissions per hour
  product_create: { limit: 10, windowMs: 60 * 60 * 1000 }, // 10 creations per hour
  rfq_create: { limit: 10, windowMs: 60 * 60 * 1000 },     // 10 RFQs per hour
  chat: { limit: 60, windowMs: 60 * 1000 },               // 60 messages per minute
  review: { limit: 10, windowMs: 60 * 60 * 1000 },         // 10 reviews per hour
  coupon_apply: { limit: 20, windowMs: 60 * 1000 },       // 20 applications per minute
  search: { limit: 30, windowMs: 60 * 1000 },             // 30 searches per minute
};

// In-memory sliding window store
const requestStore = new Map<string, number[]>();

// Periodically clean up expired timestamps from memory store to avoid leaks
if (typeof global !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalAny = global as any;
  if (!globalAny.rateLimitCleanupInterval) {
    globalAny.rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, timestamps] of requestStore.entries()) {
        // Resolve action name from the key: "rate-limit:actionName:identifier"
        const parts = key.split(":");
        const action = parts[1];
        const rule = RATE_LIMIT_RULES[action];
        if (rule) {
          const validTimestamps = timestamps.filter(t => now - t < rule.windowMs);
          if (validTimestamps.length === 0) {
            requestStore.delete(key);
          } else {
            requestStore.set(key, validTimestamps);
          }
        } else {
          requestStore.delete(key);
        }
      }
    }, 5 * 60 * 1000); // clean every 5 mins
  }
}

export async function rateLimit(action: string, identifier?: string) {
  if (process.env.NODE_ENV === "development") {
    return { success: true, limit: 9999, remaining: 9999, reset: 0 };
  }

  const rule = RATE_LIMIT_RULES[action];
  if (!rule) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  let finalId = identifier;
  if (!finalId) {
    try {
      const headersList = await headers();
      // Safe fallback extraction of client IP
      finalId = headersList.get("x-forwarded-for")?.split(",")[0].trim() || 
                headersList.get("x-real-ip") || 
                "127.0.0.1";
    } catch {
      finalId = "anonymous";
    }
  }

  const key = `rate-limit:${action}:${finalId}`;
  const now = Date.now();
  const timestamps = requestStore.get(key) || [];

  // Remove timestamps outside of the current sliding window
  const activeTimestamps = timestamps.filter(t => now - t < rule.windowMs);

  if (activeTimestamps.length >= rule.limit) {
    const oldestTimestamp = activeTimestamps[0];
    const resetTime = oldestTimestamp + rule.windowMs;
    return {
      success: false,
      limit: rule.limit,
      remaining: 0,
      reset: resetTime,
    };
  }

  activeTimestamps.push(now);
  requestStore.set(key, activeTimestamps);

  const resetTime = now + rule.windowMs;
  return {
    success: true,
    limit: rule.limit,
    remaining: rule.limit - activeTimestamps.length,
    reset: resetTime,
  };
}
