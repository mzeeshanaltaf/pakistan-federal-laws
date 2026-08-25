import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Fails open when Upstash env vars aren't set (e.g. local dev without them
// configured) rather than blocking all traffic.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null;

const chatLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "10 m"), prefix: "qanoon:chat" })
  : null;

const contactLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "10 m"), prefix: "qanoon:contact" })
  : null;

// Matches chat's throttling magnitude (Better Auth's own emailOTP.rateLimit
// only covers OTP sends, not raw sign-in/sign-up attempts) but on its own
// prefix, so a chatty signed-in user can't burn through their own future
// sign-in budget and vice versa.
const authLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "10 m"), prefix: "qanoon:auth" })
  : null;

export async function checkRateLimit(ip: string): Promise<{ success: boolean }> {
  if (!chatLimiter) return { success: true };
  const { success } = await chatLimiter.limit(ip);
  return { success };
}

export async function checkContactRateLimit(ip: string): Promise<{ success: boolean }> {
  if (!contactLimiter) return { success: true };
  const { success } = await contactLimiter.limit(ip);
  return { success };
}

export async function checkAuthRateLimit(ip: string): Promise<{ success: boolean }> {
  if (!authLimiter) return { success: true };
  const { success } = await authLimiter.limit(ip);
  return { success };
}
