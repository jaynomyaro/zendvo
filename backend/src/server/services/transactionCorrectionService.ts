import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, transactionStatusEnum } from "@/lib/db/schema";

export type CorrectableTransactionStatus =
  (typeof transactionStatusEnum.enumValues)[number];

export interface CorrectTransactionStatusInput {
  transactionId: string;
  status: CorrectableTransactionStatus;
  correctedBy: string;
  reason: string;
}

export type CorrectTransactionStatusResult =
  | { success: true; transaction: typeof transactions.$inferSelect }
  | { success: false; error: string };

/**
 * Applies a manual status correction to a transaction while preserving the
 * source evidence needed to audit it later.
 *
 * The row is locked (`SELECT ... FOR UPDATE`) so the previous status snapshot
 * and the correction write are atomic — concurrent corrections or automatic
 * reconciliation sweeps cannot interleave and lose the original status.
 *
 * Evidence preserved on the record:
 * - `previousStatus` — the status the row held immediately before correction.
 * - `blockchainTxHash` — left untouched, so the on-chain source reference
 *   remains intact.
 * - `correctedBy` / `correctedAt` / `correctionReason` — who corrected the
 *   record, when, and why.
 */
export async function correctTransactionStatus(
  input: CorrectTransactionStatusInput,
): Promise<CorrectTransactionStatusResult> {
  const correctedBy = input.correctedBy?.trim();
  const reason = input.reason?.trim();

  if (!input.transactionId?.trim()) {
    return { success: false, error: "transactionId is required" };
  }
  if (!transactionStatusEnum.enumValues.includes(input.status)) {
    return {
      success: false,
      error: `Invalid status. Must be one of: ${transactionStatusEnum.enumValues.join(", ")}`,
    };
  }
  if (!correctedBy) {
    return { success: false, error: "correctedBy is required" };
  }
  if (!reason) {
    return { success: false, error: "reason is required" };
  }

  try {
    const transaction = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(transactions)
        .where(eq(transactions.id, input.transactionId))
        .for("update");

      if (!locked) {
        return null;
      }

      const [updated] = await tx
        .update(transactions)
        .set({
          status: input.status,
          // Keep the earliest pre-correction status once a record has already
          // been manually corrected so the original evidence is not overwritten.
          previousStatus: locked.correctedBy
            ? locked.previousStatus
            : locked.status,
          correctedBy,
          correctedAt: new Date(),
          correctionReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, locked.id))
        .returning();

      return updated ?? null;
    });

    if (!transaction) {
      return { success: false, error: "Transaction not found" };
    }

    return { success: true, transaction };
  } catch (error) {
    console.error("[TRANSACTION_CORRECTION_ERROR]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
