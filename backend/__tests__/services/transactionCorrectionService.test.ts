import {
  correctTransactionStatus,
  type CorrectableTransactionStatus,
} from "@/server/services/transactionCorrectionService";

const lockedTransaction = {
  id: "tx-1",
  userId: "user-1",
  status: "pending",
  previousStatus: null,
  correctedBy: null,
  correctedAt: null,
  correctionReason: null,
  blockchainTxHash: "abc123",
};

const mockFor = jest.fn();
const mockWhereSelect = jest.fn(() => ({ for: mockFor }));
const mockFromSelect = jest.fn(() => ({ where: mockWhereSelect }));
const mockSelect = jest.fn(() => ({ from: mockFromSelect }));

const mockReturning = jest.fn();
const mockWhereUpdate = jest.fn(() => ({ returning: mockReturning }));
const mockSet = jest.fn((arg: Record<string, unknown>) => ({
  where: mockWhereUpdate,
}));
const mockUpdate = jest.fn(() => ({ set: mockSet }));

jest.mock("@/lib/db", () => ({
  db: {
    transaction: jest.fn(async (cb: (tx: unknown) => unknown) =>
      cb({ select: mockSelect, update: mockUpdate }),
    ),
  },
}));

describe("correctTransactionStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFor.mockResolvedValue([lockedTransaction]);
    mockReturning.mockResolvedValue([
      { ...lockedTransaction, status: "completed" },
    ]);
  });

  it("rejects an invalid status", async () => {
    const result = await correctTransactionStatus({
      transactionId: "tx-1",
      status: "bogus" as CorrectableTransactionStatus,
      correctedBy: "admin-1",
      reason: "manual fix",
    });
    expect(result.success).toBe(false);
  });

  it("requires correctedBy and reason", async () => {
    const missingActor = await correctTransactionStatus({
      transactionId: "tx-1",
      status: "completed",
      correctedBy: "  ",
      reason: "manual fix",
    });
    expect(missingActor.success).toBe(false);

    const missingReason = await correctTransactionStatus({
      transactionId: "tx-1",
      status: "completed",
      correctedBy: "admin-1",
      reason: "",
    });
    expect(missingReason.success).toBe(false);
  });

  it("returns not found when the transaction does not exist", async () => {
    mockFor.mockResolvedValue([]);
    const result = await correctTransactionStatus({
      transactionId: "missing",
      status: "completed",
      correctedBy: "admin-1",
      reason: "manual fix",
    });
    expect(result).toEqual({
      success: false,
      error: "Transaction not found",
    });
  });

  it("snapshots the previous status and records correction evidence", async () => {
    const result = await correctTransactionStatus({
      transactionId: "tx-1",
      status: "completed",
      correctedBy: "admin-1",
      reason: "confirmed on-chain manually",
    });

    expect(result.success).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        previousStatus: "pending",
        correctedBy: "admin-1",
        correctionReason: "confirmed on-chain manually",
      }),
    );
    const setArg = mockSet.mock.calls[0][0];
    expect(setArg.correctedAt).toBeInstanceOf(Date);
  });

  it("preserves the earliest previousStatus on repeated corrections", async () => {
    mockFor.mockResolvedValue([
      {
        ...lockedTransaction,
        status: "failed",
        previousStatus: "pending",
        correctedBy: "admin-1",
      },
    ]);

    await correctTransactionStatus({
      transactionId: "tx-1",
      status: "completed",
      correctedBy: "admin-2",
      reason: "second look",
    });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ previousStatus: "pending" }),
    );
  });
});
