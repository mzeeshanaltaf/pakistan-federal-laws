import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

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

// Public PDF proxy — no auth required, so this only guards against one client
// hammering it (accidental loops, scraping), not credential abuse. Generous
// on purpose.
const fileLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m"), prefix: "qanoon:file" })
  : null;

// Traefik (the VPS reverse proxy in front of this app) appends the real
// client IP as the *last* entry of X-Forwarded-For, preserving whatever the
// client itself sent as leading entries — so the first entry is
// attacker-controlled (`curl -H "X-Forwarded-For: 1.2.3.4"` spoofs it
// trivially) and must never be trusted. x-real-ip is set by Traefik directly
// from the TCP peer and is not client-suppliable.
export function getClientIp(request: NextRequest | Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((p) => p.trim());
    return parts[parts.length - 1] || "unknown";
  }

  return "unknown";
}

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

export async function checkFileRateLimit(ip: string): Promise<{ success: boolean }> {
  if (!fileLimiter) return { success: true };
  const { success } = await fileLimiter.limit(ip);
  return { success };
}
