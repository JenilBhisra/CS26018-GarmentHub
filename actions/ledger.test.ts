import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordLedgerTransaction } from "@/actions/ledger";
import type { Prisma } from "@prisma/client";

// Every test runs inside a Prisma transaction that is always rolled back
// (via ROLLBACK_SENTINEL), so these tests never leave data behind in
// whatever database DATABASE_URL points to.
class RollbackSentinel extends Error {}

async function inRollbackTransaction(fn: (tx: Prisma.TransactionClient) => Promise<void>) {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new RollbackSentinel();
    });
  } catch (err) {
    if (!(err instanceof RollbackSentinel)) throw err;
  }
}

describe("recordLedgerTransaction — double-entry ledger engine", () => {
  it("accepts balanced debit/credit entries and writes one row per entry", async () => {
    await inRollbackTransaction(async (tx) => {
      const reference = `test_balanced_${Date.now()}`;
      const result = await recordLedgerTransaction(tx, {
        reference,
        description: "Test balanced transaction",
        entries: [
          { accountName: "TEST_ACCOUNT_A", debit: 100, credit: 0 },
          { accountName: "TEST_ACCOUNT_B", debit: 0, credit: 100 },
        ],
      });

      expect(result.success).toBe(true);

      const rows = await tx.ledgerEntry.findMany({
        where: { reference: { startsWith: `${reference}_` } },
      });
      expect(rows).toHaveLength(2);

      const totalDebit = rows.reduce((sum, r) => sum + Number(r.debit), 0);
      const totalCredit = rows.reduce((sum, r) => sum + Number(r.credit), 0);
      expect(totalDebit).toBe(totalCredit);
      expect(totalDebit).toBe(100);
    });
  });

  it("rejects unbalanced entries (debits must equal credits)", async () => {
    await inRollbackTransaction(async (tx) => {
      const reference = `test_unbalanced_${Date.now()}`;
      await expect(
        recordLedgerTransaction(tx, {
          reference,
          description: "Test unbalanced transaction",
          entries: [
            { accountName: "TEST_ACCOUNT_A", debit: 100, credit: 0 },
            { accountName: "TEST_ACCOUNT_B", debit: 0, credit: 50 },
          ],
        })
      ).rejects.toThrow(/Strict Ledger Balancing Mismatch/);

      const rows = await tx.ledgerEntry.findMany({
        where: { reference: { startsWith: `${reference}_` } },
      });
      expect(rows).toHaveLength(0);
    });
  });

  it("rejects a duplicate reference (idempotency guard)", async () => {
    await inRollbackTransaction(async (tx) => {
      const reference = `test_dup_${Date.now()}`;
      const entries = [
        { accountName: "TEST_ACCOUNT_A", debit: 50, credit: 0 },
        { accountName: "TEST_ACCOUNT_B", debit: 0, credit: 50 },
      ];

      const first = await recordLedgerTransaction(tx, {
        reference,
        description: "First attempt",
        entries,
      });
      expect(first.success).toBe(true);

      await expect(
        recordLedgerTransaction(tx, {
          reference,
          description: "Duplicate attempt",
          entries,
        })
      ).rejects.toThrow(/Duplicate financial operation blocked/);

      const rows = await tx.ledgerEntry.findMany({
        where: { reference: { startsWith: `${reference}_` } },
      });
      expect(rows).toHaveLength(2); // only from the first, successful call
    });
  });

  it("rejects negative debit or credit amounts", async () => {
    await inRollbackTransaction(async (tx) => {
      const reference = `test_negative_${Date.now()}`;
      await expect(
        recordLedgerTransaction(tx, {
          reference,
          description: "Negative amount transaction",
          entries: [
            { accountName: "TEST_ACCOUNT_A", debit: -10, credit: 0 },
            { accountName: "TEST_ACCOUNT_B", debit: 0, credit: -10 },
          ],
        })
      ).rejects.toThrow(/cannot contain negative/);
    });
  });

  it("rejects an empty entries array", async () => {
    await inRollbackTransaction(async (tx) => {
      await expect(
        recordLedgerTransaction(tx, {
          reference: `test_empty_${Date.now()}`,
          description: "Empty transaction",
          entries: [],
        })
      ).rejects.toThrow(/Cannot record an empty ledger transaction/);
    });
  });

  it("supports multi-leg entries as long as total debits equal total credits", async () => {
    await inRollbackTransaction(async (tx) => {
      const reference = `test_multileg_${Date.now()}`;
      const result = await recordLedgerTransaction(tx, {
        reference,
        description: "Multi-leg split",
        entries: [
          { accountName: "TEST_SOURCE", debit: 300, credit: 0 },
          { accountName: "TEST_DEST_A", debit: 0, credit: 100 },
          { accountName: "TEST_DEST_B", debit: 0, credit: 100 },
          { accountName: "TEST_DEST_C", debit: 0, credit: 100 },
        ],
      });

      expect(result.success).toBe(true);

      const rows = await tx.ledgerEntry.findMany({
        where: { reference: { startsWith: `${reference}_` } },
      });
      expect(rows).toHaveLength(4);
      // All rows from one recordLedgerTransaction call share the same transactionId.
      const transactionIds = new Set(rows.map((r) => r.transactionId));
      expect(transactionIds.size).toBe(1);
    });
  });
});
