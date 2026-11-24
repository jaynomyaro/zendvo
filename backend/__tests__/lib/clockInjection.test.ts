import {
  consumeRateLimit,
  getRateLimitStatusForKey,
} from "@/lib/rate-limiter";
import { cleanupExpiredOTPs } from "@/server/services/otpService";
import { systemClock } from "@/lib/clock";

jest.mock("@/lib/db", () => ({
  db: {
    delete: jest.fn(() => ({
      where: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([]),
      })),
    })),
    query: {},
    update: jest.fn(),
    insert: jest.fn(),
    transaction: jest.fn(),
  },
}));

describe("clock injection", () => {
  it("rate limiter windows follow the injected clock", () => {
    const key = `rl-clock:${Date.now()}`;
    let current = new Date("2026-01-01T00:00:00Z");
    const clock = () => current;

    consumeRateLimit(key, 1, 60_000, clock);
    expect(consumeRateLimit(key, 1, 60_000, clock).limited).toBe(true);

    // Advance past the window — quota must reset deterministically.
    current = new Date("2026-01-01T00:02:00Z");
    const afterWindow = consumeRateLimit(key, 1, 60_000, clock);
    expect(afterWindow.count).toBe(1);
    expect(afterWindow.limited).toBe(false);

    // Status lookups use the same injected clock.
    const status = getRateLimitStatusForKey(key, 1, 60_000, clock);
    expect(status.resetMs).toBe(60_000);
  });

  it("cleanupExpiredOTPs evaluates expiry against the injected clock", async () => {
    const fixed = new Date("2030-06-01T00:00:00Z");
    const clock = jest.fn(() => fixed);

    await cleanupExpiredOTPs(clock);

    expect(clock).toHaveBeenCalled();
  });

  it("systemClock returns the current time", () => {
    const before = Date.now();
    const value = systemClock().getTime();
    expect(value).toBeGreaterThanOrEqual(before);
  });
});
