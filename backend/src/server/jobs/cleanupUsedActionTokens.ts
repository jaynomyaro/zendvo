import { db } from "@/lib/db";
import { systemClock, type Clock } from "@/lib/clock";
import { usedActionTokens } from "@/lib/db/schema";
import { lt } from "drizzle-orm";

/**
 * Removes expired used-action-token JTI records from the DB.
 *
 * These records exist purely to enforce single-use semantics on action tokens.
 * Once a token's exp timestamp has passed the token is invalid anyway, so the
 * JTI record is no longer needed.  This job keeps the table from growing
 * unboundedly.
 *
 * Schedule: run every 5 minutes. Records only need to survive until their
 * token's exp timestamp; cleaning up more frequently than the token lifetime
 * (ACTION_TOKEN_EXPIRY = 10 minutes) keeps the table small.
 */
export async function cleanupExpiredUsedActionTokens(
  now: Clock = systemClock,
): Promise<number> {
  try {
    const result = await db
      .delete(usedActionTokens)
      .where(lt(usedActionTokens.expiresAt, now()))
      .returning();

    const deletedCount = result.length;
    console.log(
      `[CLEANUP_JOB] Deleted ${deletedCount} expired used-action-token records.`,
    );
    return deletedCount;
  } catch (error) {
    console.error("[CLEANUP_USED_ACTION_TOKENS_ERROR]", error);
    throw error;
  }
}

if (typeof require !== "undefined" && require.main === module) {
  cleanupExpiredUsedActionTokens()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
