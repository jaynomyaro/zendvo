import { db } from "@/lib/db";
import { systemClock, type Clock } from "@/lib/clock";
import { passwordResets } from "@/lib/db/schema";
import { or, lt, isNotNull } from "drizzle-orm";

export async function cleanupExpiredTokens(now: Clock = systemClock) {
  try {
    const currentTime = now();
    const twentyFourHoursAgo = new Date(
      currentTime.getTime() - 24 * 60 * 60 * 1000,
    );

    const result = await db
      .delete(passwordResets)
      .where(
        or(
          lt(passwordResets.expiresAt, currentTime),
          lt(passwordResets.createdAt, twentyFourHoursAgo),
          isNotNull(passwordResets.usedAt),
        ),
      )
      .returning();

    console.log(
      `[CLEANUP_JOB] Deleted ${result.length} expired/used password reset tokens.`,
    );
    return result.length;
  } catch (error) {
    console.error("[CLEANUP_JOB_ERROR]", error);
  }
}

if (typeof require !== "undefined" && require.main === module) {
  cleanupExpiredTokens()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
