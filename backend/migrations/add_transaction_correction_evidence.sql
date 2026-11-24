-- Migration: preserve source evidence for manually corrected transactions.
-- When an operator corrects a transaction's status, the row must retain what
-- it looked like before the correction so the change can be audited.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS previous_status TEXT;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS corrected_by TEXT;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMP;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS correction_reason TEXT;
