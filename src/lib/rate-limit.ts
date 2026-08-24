import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Fails open when Upstash env vars aren't set (e.g. local dev without them
// configured) rather than blocking all traffic.
const limiter =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(20, "10 m"),
        prefix: "qanoon:chat",
      })
    : null;

export async function checkRateLimit(ip: string): Promise<{ success: boolean }> {
  if (!limiter) return { success: true };
  const { success } = await limiter.limit(ip);
  return { success };
}
