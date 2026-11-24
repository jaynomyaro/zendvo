import { systemClock, type Clock } from "@/lib/clock";

type RateLimitStore = {
  [key: string]: {
    count: number;
    startTime: number;
  };
};

export type RateLimitStatus = {
  key: string;
  count: number;
  limit: number;
  windowMs: number;
  remaining: number;
  resetMs: number;
  limited: boolean;
};

const store: RateLimitStore = {};

function getRateLimitStatus(
  key: string,
  limit: number,
  windowMs: number,
  now: () => number,
): RateLimitStatus {
  const nowMs = now();
  const entry = store[key];

  if (!entry || nowMs - entry.startTime > windowMs) {
    return {
      key,
      count: 0,
      limit,
      windowMs,
      remaining: limit,
      resetMs: windowMs,
      limited: false,
    };
  }

  const elapsed = nowMs - entry.startTime;
  const resetMs = windowMs - elapsed;
  const remaining = Math.max(0, limit - entry.count);

  return {
    key,
    count: entry.count,
    limit,
    windowMs,
    remaining,
    resetMs,
    limited: entry.count >= limit,
  };
}

function consumeRateLimitInternal(
  key: string,
  limit: number = 5,
  windowMs: number = 3600000,
  now: () => number,
): RateLimitStatus {
  const nowMs = now();
  const entry = store[key];

  if (!entry || nowMs - (entry?.startTime ?? 0) > windowMs) {
    store[key] = { count: 1, startTime: nowMs };
    return {
      key,
      count: 1,
      limit,
      windowMs,
      remaining: Math.max(0, limit - 1),
      resetMs: windowMs,
      limited: 1 > limit,
    };
  }

  entry.count += 1;
  const elapsed = nowMs - entry.startTime;
  const resetMs = windowMs - elapsed;
  const remaining = Math.max(0, limit - entry.count);

  return {
    key,
    count: entry.count,
    limit,
    windowMs,
    remaining,
    resetMs,
    limited: entry.count > limit,
  };
}

function toMsClock(now: Clock = systemClock): () => number {
  return () => now().getTime();
}

export const consumeRateLimit = (
  key: string,
  limit: number = 5,
  windowMs: number = 3600000,
  now: Clock = systemClock,
): RateLimitStatus => {
  return consumeRateLimitInternal(key, limit, windowMs, toMsClock(now));
};

export const isRateLimited = (
  key: string,
  limit: number = 5,
  windowMs: number = 3600000,
  now: Clock = systemClock,
): boolean => {
  const status = consumeRateLimitInternal(key, limit, windowMs, toMsClock(now));
  return status.limited;
};

export const getRateLimitRemaining = (
  key: string,
  limit: number = 5,
  windowMs: number = 3600000,
  now: Clock = systemClock,
): number => {
  return getRateLimitStatus(key, limit, windowMs, toMsClock(now)).remaining;
};

export const getRateLimitStatusForKey = (
  key: string,
  limit: number = 5,
  windowMs: number = 3600000,
  now: Clock = systemClock,
): RateLimitStatus => {
  return getRateLimitStatus(key, limit, windowMs, toMsClock(now));
};
