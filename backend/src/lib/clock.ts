/**
 * Injectable clock for expiry-sensitive services.
 *
 * Production code uses `systemClock` (the real wall clock). Tests inject a
 * stable `Clock` so expiry, rate-limit, and scheduling behaviour can be
 * exercised deterministically without mocking `Date` globally.
 */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();
