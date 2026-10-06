"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface LedgerEntryInput {
  accountName: string;
  debit: number | Prisma.Decimal;
  credit: number | Prisma.Decimal;
  description?: string;
}

interface RecordLedgerParams {
  reference: string;
  description: string;
  entries: LedgerEntryInput[];
}

/**
 * Records a double-entry transaction in the LedgerEntry table.
 * Crucial Safeguards:
 * 1. Must run inside a Prisma transaction context ('tx').
 * 2. Total Debits must equal Total Credits.
 * 3. Reference must be unique (idempotency guard).
 * 4. Immutability: No update or delete operations are exposed for LedgerEntry.
 */
export async function recordLedgerTransaction(
  tx: Omit<
    typeof prisma,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  params: RecordLedgerParams
) {
  const { reference, description, entries } = params;

  if (entries.length === 0) {
    throw new Error("Cannot record an empty ledger transaction.");
  }

  // 1. Idempotency Guard: check if reference was already processed
  const existingEntry = await tx.ledgerEntry.findFirst({
    where: { reference: { startsWith: `${reference}_` } },
  });

  if (existingEntry) {
    throw new Error(`Duplicate financial operation blocked. Reference '${reference}' already exists in the ledger.`);
  }

  // 2. Strict Balance Verification: Sum of Debits == Sum of Credits
  let totalDebits = new Prisma.Decimal(0);
  let totalCredits = new Prisma.Decimal(0);

  const formattedEntries = entries.map((entry) => {
    const debitDec = new Prisma.Decimal(entry.debit.toString());
    const creditDec = new Prisma.Decimal(entry.credit.toString());

    if (debitDec.isNegative() || creditDec.isNegative()) {
      throw new Error("Ledger entries cannot contain negative debit or credit amounts.");
    }

    totalDebits = totalDebits.plus(debitDec);
    totalCredits = totalCredits.plus(creditDec);

    return {
      accountName: entry.accountName,
      debit: debitDec,
      credit: creditDec,
      description: entry.description || description,
    };
  });

  if (!totalDebits.equals(totalCredits)) {
    throw new Error(
      `Strict Ledger Balancing Mismatch: Total Debits (₹${totalDebits.toFixed(2)}) ` +
      `must equal Total Credits (₹${totalCredits.toFixed(2)}) for reference '${reference}'.`
    );
  }

  // 3. Write Ledger Records
  const transactionId = `tx_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;

  for (const entry of formattedEntries) {
    await tx.ledgerEntry.create({
      data: {
        transactionId,
        accountName: entry.accountName,
        debit: entry.debit,
        credit: entry.credit,
        reference: `${reference}_${entry.accountName}`,
        description: entry.description,
      },
    });
  }

  return { success: true, transactionId };
}
