import { cleanupExpiredOTPs } from "../services/otpService";
import { systemClock, type Clock } from "@/lib/clock";

export async function cleanupExpiredOTPRecords(
  now: Clock = systemClock,
): Promise<number> {
  try {
    const deletedCount = await cleanupExpiredOTPs(now);

    console.log(
      `[CLEANUP_JOB] Deleted ${deletedCount} expired OTP records.`,
    );
    return deletedCount;
  } catch (error) {
    console.error("[CLEANUP_JOB_ERROR]", error);
    throw error;
  }
}

if (typeof require !== "undefined" && require.main === module) {
  cleanupExpiredOTPRecords()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
