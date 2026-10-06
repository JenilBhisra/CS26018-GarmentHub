"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/actions/audit";
import { ensureSellerWallet } from "@/actions/wallets";
import { sendInAppNotification } from "@/actions/notifications";
import { PayoutStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { recordLedgerTransaction } from "@/actions/ledger";
import { requireSellerProfileOrThrow } from "@/lib/seller-context";

const Decimal = Prisma.Decimal;

/**
 * Seller requests a payout from withdrawable balance.
 * Money Flow:
 * - Debit SELLER_WITHDRAWABLE: amount
 * - Credit SELLER_RESERVE: amount
 */
export async function requestPayout(amount: number) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { success: false, error: "Unauthorized access." };
  }

  if (amount <= 0) {
    return { success: false, error: "Amount must be greater than zero." };
  }

  const amountDec = new Decimal(amount);

  try {
    return await prisma.$transaction(async (tx) => {
      const seller = await tx.sellerProfile.findUnique({
        where: { userId: session.user.id },
        include: { kyc: true, wallet: true },
      });

      if (!seller) {
        return { success: false, error: "Seller profile not found." };
      }

      // Payout Protection: Seller profile must be APPROVED
      if (seller.approvalStatus !== "APPROVED") {
        return { success: false, error: "Payout failed. Your store profile must be approved." };
      }

      // Payout Protection: Seller KYC must be APPROVED
      if (!seller.kyc || seller.kyc.status !== "APPROVED") {
        return { success: false, error: "Payout failed. Your KYC verification must be approved first." };
      }

      // Payout Protection: Bank details must be completed
      const bankFields = [seller.bankAccountNumber, seller.bankIFSC, seller.bankName, seller.bankAccountHolder];
      if (bankFields.some((field) => !field || !field.trim())) {
        return { success: false, error: "Payout failed. Please update valid bank details in settings." };
      }

      const wallet = seller.wallet || (await ensureSellerWallet(seller.id, tx));

      // Financial Safeguard: No payouts if negative balance exists
      if (wallet.negativeBalance.greaterThan(0)) {
        return { success: false, error: "Payout failed. Cannot withdraw while wallet has a negative balance." };
      }

      // Financial Safeguard: Ensure sufficient withdrawable balance
      if (wallet.withdrawableBalance.lessThan(amountDec)) {
        return {
          success: false,
          error: `Payout failed. Insufficient withdrawable balance. Available: ₹${wallet.withdrawableBalance.toLocaleString(
            "en-IN"
          )}`,
        };
      }

      const refId = `payout_req_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

      // Deduct from withdrawableBalance and transfer to reserveBalance
      await tx.sellerWallet.update({
        where: { id: wallet.id },
        data: {
          withdrawableBalance: { decrement: amountDec },
          availableBalance: { decrement: amountDec },
          reserveBalance: { increment: amountDec },
        },
      });

      // Create PayoutRequest
      const payout = await tx.payoutRequest.create({
        data: {
          sellerId: seller.id,
          amount: amountDec,
          status: "PENDING",
          reference: refId,
        },
      });

      // Create WalletTransaction log
      await tx.walletTransaction.create({
        data: {
          sellerWalletId: wallet.id,
          amount: amountDec.negated(),
          type: "PAYOUT",
          status: "PENDING",
          description: `Withdrawal request #${payout.id}`,
          reference: refId,
        },
      });

      // Record double-entry ledger entries for payout hold
      await recordLedgerTransaction(tx, {
        reference: refId,
        description: `Withholding payout request #${payout.id} in reserve`,
        entries: [
          { accountName: `SELLER_WITHDRAWABLE:${seller.id}`, debit: amountDec, credit: new Decimal(0) },
          { accountName: `SELLER_RESERVE:${seller.id}`, debit: new Decimal(0), credit: amountDec },
        ],
      });

      // Immutable Audit Log
      await createAuditLog(
        "PAYOUT_REQUESTED",
        "PayoutRequest",
        payout.id,
        null,
        JSON.stringify({ amount: amountDec.toString(), status: "PENDING" })
      );

      // Notification Hook: Payout requested
      await sendInAppNotification(
        seller.userId,
        "PAYMENT_SUCCESS",
        "Payout Requested",
        `A payout request of ₹${amount.toLocaleString("en-IN")} has been submitted for review.`,
        "/seller/wallet"
      ).catch(() => null);

      revalidatePath("/seller/wallet");
      revalidatePath("/admin/settlements");

      return { success: true, payoutId: payout.id };
    });
  } catch (err: any) {
    console.error("requestPayout error:", err);
    return { success: false, error: err.message || "Failed to submit payout request." };
  }
}

/**
 * Admin processes or updates payout request status.
 * Money Flow on Processed (PAID):
 * - Debit SELLER_RESERVE: amount
 * - Credit PAYOUT_OUTFLOW: amount
 * Money Flow on Rejected/Failed:
 * - Debit SELLER_RESERVE: amount
 * - Credit SELLER_WITHDRAWABLE: amount
 */
export async function updatePayoutStatusAdmin(
  payoutId: string,
  status: PayoutStatus,
  bankReference?: string,
  reason?: string,
  adminNotes?: string
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized access." };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const payout = await tx.payoutRequest.findUnique({
        where: { id: payoutId },
        include: { seller: { include: { wallet: true } } },
      });

      if (!payout) {
        return { success: false, error: "Payout request not found." };
      }

      // Payout Protection: Prevent processing if seller/KYC/bank are invalid
      if (status === "PROCESSING" || status === "PAID") {
        const seller = await tx.sellerProfile.findUnique({
          where: { id: payout.sellerId },
          include: { kyc: true },
        });

        if (!seller || seller.approvalStatus !== "APPROVED") {
          return { success: false, error: "Cannot process payout. Seller account is not APPROVED." };
        }

        if (!seller.kyc || seller.kyc.status !== "APPROVED") {
          return { success: false, error: "Cannot process payout. Seller KYC is not APPROVED." };
        }

        const bankFields = [seller.bankAccountNumber, seller.bankIFSC, seller.bankName, seller.bankAccountHolder];
        if (bankFields.some((field) => !field || !field.trim())) {
          return { success: false, error: "Cannot process payout. Seller bank details are incomplete." };
        }
      }

      // Safeguard: Prevent double transitions on completed states
      if (payout.status === "PAID" || payout.status === "REJECTED" || payout.status === "REVERSED") {
        return { success: false, error: `Payout request is already in a final state: ${payout.status}` };
      }

      const wallet = payout.seller.wallet;
      if (!wallet) throw new Error("Seller wallet not found.");

      const oldStatus = payout.status;
      const amount = payout.amount; // Decimal

      if (status === "PAID") {
        if (!bankReference || !bankReference.trim()) {
          return { success: false, error: "Bank Reference number (UTR) is mandatory to mark payout as PAID." };
        }

        // Deduct from reserve balance, increment totalPaid
        await tx.sellerWallet.update({
          where: { id: wallet.id },
          data: {
            reserveBalance: { decrement: amount },
            totalPaid: { increment: amount },
          },
        });

        // Update PayoutRequest status and save bank reference (UTR)
        await tx.payoutRequest.update({
          where: { id: payout.id },
          data: { status: "PAID", bankReference, adminNotes },
        });

        // Update associated wallet transaction
        await tx.walletTransaction.updateMany({
          where: { reference: payout.reference },
          data: { status: "PAID", description: `Withdrawal request paid (UTR: ${bankReference})` },
        });

        // Record double-entry ledger entries for payout outflow
        await recordLedgerTransaction(tx, {
          reference: `${payout.reference}_paid`,
          description: `Payout finalized. Paid to seller bank (UTR: ${bankReference})`,
          entries: [
            { accountName: `SELLER_RESERVE:${payout.sellerId}`, debit: amount, credit: new Decimal(0) },
            { accountName: "PAYOUT_OUTFLOW", debit: new Decimal(0), credit: amount },
          ],
        });

        // Notification Hook: Payout approved/completed
        await sendInAppNotification(
          payout.seller.userId,
          "PAYMENT_SUCCESS",
          "Payout Processed",
          `Your payout request for ₹${amount.toLocaleString()} was successfully processed. UTR: ${bankReference}`,
          "/seller/wallet"
        ).catch(() => null);

      } else if (status === "REJECTED" || status === "FAILED" || status === "REVERSED") {
        // Return funds from reserveBalance to withdrawable Balance (recovering debt first if negative balance grew in the interim)
        let toWithdrawable = amount;
        let newNegative = wallet.negativeBalance;

        if (wallet.negativeBalance.greaterThan(0)) {
          if (amount.greaterThanOrEqualTo(wallet.negativeBalance)) {
            toWithdrawable = amount.minus(wallet.negativeBalance);
            newNegative = new Decimal(0);
          } else {
            toWithdrawable = new Decimal(0);
            newNegative = wallet.negativeBalance.minus(amount);
          }
        }

        await tx.sellerWallet.update({
          where: { id: wallet.id },
          data: {
            reserveBalance: { decrement: amount },
            withdrawableBalance: { increment: toWithdrawable },
            availableBalance: { increment: toWithdrawable },
            negativeBalance: newNegative,
          },
        });

        // Update request status
        await tx.payoutRequest.update({
          where: { id: payout.id },
          data: { status, rejectionReason: reason || "Admin adjustment", adminNotes },
        });

        // Update associated wallet transaction
        await tx.walletTransaction.updateMany({
          where: { reference: payout.reference },
          data: { status, description: `Withdrawal request ${status.toLowerCase()}. Reason: ${reason || "Admin decision"}` },
        });

        // Record double-entry ledger entries for payout rejection return
        await recordLedgerTransaction(tx, {
          reference: `${payout.reference}_failed`,
          description: `Payout request rejected or failed. Returned to withdrawable balance. Reason: ${reason || "Admin decision"}`,
          entries: [
            { accountName: `SELLER_RESERVE:${payout.sellerId}`, debit: amount, credit: new Decimal(0) },
            { accountName: `SELLER_WITHDRAWABLE:${payout.sellerId}`, debit: new Decimal(0), credit: amount },
          ],
        });

        // Notification Hook: Payout failed / rejected
        await sendInAppNotification(
          payout.seller.userId,
          "PAYMENT_FAILED",
          `Payout Request ${status}`,
          `Your payout request for ₹${amount.toLocaleString()} was marked as ${status}. Reason: ${
            reason || "Admin review details"
          }`,
          "/seller/wallet"
        ).catch(() => null);

      } else if (status === "PROCESSING") {
        await tx.payoutRequest.update({
          where: { id: payout.id },
          data: { status: "PROCESSING", adminNotes },
        });

        await tx.walletTransaction.updateMany({
          where: { reference: payout.reference },
          data: { status: "PROCESSING" },
        });
      }

      // Immutable Audit Log
      await createAuditLog(
        `PAYOUT_STATUS_${status}`,
        "PayoutRequest",
        payout.id,
        JSON.stringify({ status: oldStatus }),
        JSON.stringify({ status, bankReference, reason, adminNotes })
      );

      revalidatePath("/seller/wallet");
      revalidatePath("/admin/settlements");

      return { success: true };
    });
  } catch (err: any) {
    console.error("updatePayoutStatusAdmin error:", err);
    return { success: false, error: err.message || "Failed to update payout status." };
  }
}

/**
 * Fetch all payout requests in the system (Admin only).
 */
export async function getPayoutRequestsAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized access.");
  }
  return prisma.payoutRequest.findMany({
    include: {
      seller: {
        select: {
          storeName: true,
          bankAccountHolder: true,
          bankAccountNumber: true,
          bankIFSC: true,
          bankName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Fetch seller's own payout requests.
 */
export async function getSellerPayoutRequests() {
  const seller = await requireSellerProfileOrThrow();

  return prisma.payoutRequest.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
  });
}
