"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/actions/audit";
import { ensureSellerWallet } from "@/actions/wallets";
import { sendInAppNotification } from "@/actions/notifications";
import { ReturnStatus, Prisma, ShippingResponsibility, ReturnReasonCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { recordLedgerTransaction } from "@/actions/ledger";
import { classifyReturnReason, calculateReturnShippingFee } from "@/lib/shipping";
import { normalizeReason } from "@/lib/reason-helper";
import { requireSellerProfileOrThrow } from "@/lib/seller-context";

const Decimal = Prisma.Decimal;

/**
 * Customer submits a return/refund request for an order.
 */
export async function requestReturn(orderId: string, reason: string, description?: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Please sign in to request a return." };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { 
          shipment: true, 
          returnRequest: true, 
          seller: true,
          items: {
            include: {
              variant: {
                include: { product: true }
              }
            }
          }
        },
      });

      if (!order) {
        return { success: false, error: "Order not found." };
      }

      // Check customer ownership
      if (order.userId !== session.user.id && session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized access." };
      }

      // Safeguard: Prevent double return requests
      if (order.returnRequest) {
        return { success: false, error: "A return request has already been submitted for this order." };
      }

      // Return Protection: Must be in DELIVERED status
      if (order.status !== "DELIVERED") {
        return { success: false, error: "Only delivered orders can be returned." };
      }

      // Return Protection: Must be within 7 days of delivery
      const deliveryDate = order.shipment?.deliveredAt || order.updatedAt;
      const daysSinceDelivery = (Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDelivery > 7) {
        return { success: false, error: "The allowed 7-day return window for this order has expired." };
      }

      const refId = `return_req_${order.id}`;
      const productAmount = order.subtotal.minus(order.discountAmount);

      const normalizedReason = normalizeReason(reason);

      // Look up ReturnReasonRule in DB matching customer-submitted reason (case-insensitive and trimmed)
      const activeRules = await tx.returnReasonRule.findMany({
        where: { isActive: true }
      });
      const matchedRule = activeRules.find(r => normalizeReason(r.name) === normalizedReason);

      let category: ReturnReasonCategory = "CUSTOMER_FAULT";
      let responsibility: ShippingResponsibility = "CUSTOMER";
      let origShipResp: ShippingResponsibility = "CUSTOMER";
      let retShipResp: ShippingResponsibility = "CUSTOMER";
      let reverseComm = false;
      let ruleId: string | null = null;

      if (matchedRule) {
        category = matchedRule.responsibility;
        responsibility = matchedRule.returnShippingResponsibility;
        origShipResp = matchedRule.originalShippingResponsibility;
        retShipResp = matchedRule.returnShippingResponsibility;
        reverseComm = matchedRule.reverseCommission;
        ruleId = matchedRule.id;
      } else {
        // Fallback to old hardcoded classifyReturnReason
        const fallback = classifyReturnReason(reason);
        category = fallback.category;
        responsibility = fallback.responsibility;
        if (category === "SELLER_FAULT") {
          origShipResp = "SELLER";
          retShipResp = "SELLER";
          reverseComm = false;
        } else if (category === "CUSTOMER_FAULT") {
          origShipResp = "CUSTOMER";
          retShipResp = "CUSTOMER";
          reverseComm = false;
        } else {
          origShipResp = "PLATFORM";
          retShipResp = "PLATFORM";
          reverseComm = true;
        }
      }

      if (!matchedRule) {
        if (category === "SELLER_FAULT" || category === "CUSTOMER_FAULT") {
          reverseComm = false;
        }
      }

      // Temporarily log requestReturn details
      console.log("[DEBUG requestReturn] Customer selected reason:", reason);
      console.log("[DEBUG requestReturn] Normalized customer reason:", normalizedReason);
      if (matchedRule) {
        console.log("[DEBUG requestReturn] Matched ReturnReasonRule ID:", matchedRule.id);
        console.log("[DEBUG requestReturn] matchedRule responsibility (category):", matchedRule.responsibility);
        console.log("[DEBUG requestReturn] matchedRule returnShippingResponsibility:", matchedRule.returnShippingResponsibility);
        console.log("[DEBUG requestReturn] matchedRule originalShippingResponsibility:", matchedRule.originalShippingResponsibility);
        console.log("[DEBUG requestReturn] matchedRule reverseCommission:", matchedRule.reverseCommission);
      } else {
        console.log("[DEBUG requestReturn] Matched ReturnReasonRule: None (falling back to classifyReturnReason)");
      }

      // Sum variant weights
      let totalWeight = new Decimal(0);
      for (const item of order.items) {
        const itemWeight = new Decimal((item.variant?.product as any)?.weight || 0.5);
        totalWeight = totalWeight.plus(itemWeight.times(item.quantity));
      }

      // Check shipping zone from address
      let zone = "NATIONAL";
      if (order.shippingAddress.toLowerCase().includes("local") || order.shippingAddress.toLowerCase().includes("jaipur")) {
        zone = "LOCAL";
      } else if (order.shippingAddress.toLowerCase().includes("zonal")) {
        zone = "ZONAL";
      }

      const returnShippingFee = await calculateReturnShippingFee(totalWeight, zone, order.subtotal);
      const originalShipping = order.shippingFee;

      let deductionAmount = new Decimal(0);
      let customerRefundAmount = new Decimal(0);
      let sellerDeductionAmount = new Decimal(0);
      let platformCost = new Decimal(0);

      // Perform calculation:
      // Customer Refund: Product amount + Original Shipping (if seller/platform pays) - Return shipping (if customer pays)
      let calculatedCustomerRefund = productAmount;
      if (origShipResp === "SELLER" || origShipResp === "PLATFORM") {
        calculatedCustomerRefund = calculatedCustomerRefund.plus(originalShipping);
      }
      if (retShipResp === "CUSTOMER") {
        calculatedCustomerRefund = calculatedCustomerRefund.minus(returnShippingFee);
        deductionAmount = returnShippingFee;
      }
      customerRefundAmount = Decimal.max(0, calculatedCustomerRefund);

      // Seller Deduction: Product amount (if seller/customer pays) + Original Shipping (if seller pays) + Return Shipping (if seller pays)
      if (category !== "PLATFORM_FAULT") {
        let calculatedSellerDeduct = productAmount;
        if (origShipResp === "SELLER") {
          calculatedSellerDeduct = calculatedSellerDeduct.plus(originalShipping);
        }
        if (retShipResp === "SELLER") {
          calculatedSellerDeduct = calculatedSellerDeduct.plus(returnShippingFee);
        }
        sellerDeductionAmount = calculatedSellerDeduct;
      } else {
        let calculatedSellerDeduct = new Decimal(0);
        if (origShipResp === "SELLER") {
          calculatedSellerDeduct = calculatedSellerDeduct.plus(originalShipping);
        }
        if (retShipResp === "SELLER") {
          calculatedSellerDeduct = calculatedSellerDeduct.plus(returnShippingFee);
        }
        sellerDeductionAmount = calculatedSellerDeduct;
      }

      // Platform Cost
      let calculatedPlatformCost = new Decimal(0);
      if (category === "PLATFORM_FAULT") {
        calculatedPlatformCost = calculatedPlatformCost.plus(productAmount);
      }
      if (origShipResp === "PLATFORM") {
        calculatedPlatformCost = calculatedPlatformCost.plus(originalShipping);
      }
      if (retShipResp === "PLATFORM") {
        calculatedPlatformCost = calculatedPlatformCost.plus(returnShippingFee);
      }
      platformCost = calculatedPlatformCost;
 
      console.log("[DEBUG requestReturn] Final calculated customerRefundAmount:", customerRefundAmount.toString());
      console.log("[DEBUG requestReturn] Final calculated sellerDeductionAmount:", sellerDeductionAmount.toString());
      console.log("[DEBUG requestReturn] Final calculated platformCost:", platformCost.toString());

      const returnReq = await tx.returnRequest.create({
        data: {
          orderId: order.id,
          customerId: order.userId,
          sellerId: order.sellerId,
          reason,
          description,
          status: "REQUESTED",
          refundAmount: productAmount,
          originalShippingFee: originalShipping,
          returnShippingFee,
          shippingResponsibility: responsibility,
          reasonCategory: category,
          deductionAmount,
          sellerDeductionAmount,
          customerRefundAmount,
          platformCost,
          reverseCommission: reverseComm,
          returnReasonRuleId: ruleId,
          reference: refId,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: "RETURN_REQUESTED" },
      });

      // Immutable Audit Log
      await createAuditLog(
        "RETURN_REQUESTED",
        "ReturnRequest",
        returnReq.id,
        null,
        JSON.stringify({ orderId, reason, refundAmount: productAmount.toString() })
      );

      // Notification Hook: Return requested
      await sendInAppNotification(
        order.seller.userId,
        "ORDER_CANCELLED",
        "Return Requested",
        `A customer has requested a return/refund for order #${order.orderNumber}.`,
        "/seller/orders"
      ).catch(() => null);

      revalidatePath("/account/orders");
      revalidatePath("/seller/orders");
      revalidatePath("/admin/orders");

      return { success: true };
    });
  } catch (err: any) {
    console.error("requestReturn error:", err);
    return { success: false, error: err.message || "Failed to submit return request." };
  }
}

/**
 * Update the return request status (Admin/Seller).
 */
export async function updateReturnStatus(
  returnRequestId: string,
  status: ReturnStatus,
  adminNotes?: string,
  restoreStock = true
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SELLER")) {
    return { success: false, error: "Unauthorized access." };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const returnReq = await tx.returnRequest.findUnique({
        where: { id: returnRequestId },
        include: { order: true },
      });

      if (!returnReq) {
        return { success: false, error: "Return request not found." };
      }

      // Safeguard: Prevent status updates on final states
      if (returnReq.status === "REFUNDED" || returnReq.status === "CLOSED" || returnReq.status === "REJECTED") {
        return { success: false, error: `Cannot change status. Return request is already in a final state: ${returnReq.status}` };
      }

      const oldStatus = returnReq.status;

      await tx.returnRequest.update({
        where: { id: returnRequestId },
        data: {
          status,
          adminNotes,
          restoreStock,
          approvedAt: status === "APPROVED" ? new Date() : undefined,
        },
      });

      // Status side-effects on order
      if (status === "REJECTED") {
        await tx.order.update({
          where: { id: returnReq.orderId },
          data: { status: "DELIVERED" },
        });
      } else if (status === "APPROVED") {
        await tx.order.update({
          where: { id: returnReq.orderId },
          data: { status: "RETURN_REQUESTED" },
        });
      }

      // Immutable Audit Log
      await createAuditLog(
        `RETURN_STATUS_${status}`,
        "ReturnRequest",
        returnReq.id,
        JSON.stringify({ status: oldStatus }),
        JSON.stringify({ status, adminNotes, restoreStock })
      );

      // Notification Hook: Return updated
      await sendInAppNotification(
        returnReq.customerId,
        "ORDER_CONFIRMED",
        `Return Request ${status}`,
        `Your return request for order #${returnReq.order.orderNumber} has been updated to: ${status}.`,
        "/account/orders"
      ).catch(() => null);

      revalidatePath("/seller/orders");
      revalidatePath("/admin/orders");

      return { success: true };
    });
  } catch (err: any) {
    console.error("updateReturnStatus error:", err);
    return { success: false, error: err.message || "Failed to update return status." };
  }
}

/**
 * Fetch one return request with its order's items — including the Tag Loop number
 * recorded on each item at dispatch time — for the return-inspection detail view.
 */
export async function getReturnRequestDetail(returnRequestId: string) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SELLER")) {
    return { success: false, error: "Unauthorized access." };
  }

  const returnReq = await prisma.returnRequest.findUnique({
    where: { id: returnRequestId },
    include: {
      order: { include: { items: true } },
      customer: { select: { name: true, email: true } },
      seller: { select: { storeName: true, userId: true } },
    },
  });

  if (!returnReq) {
    return { success: false, error: "Return request not found." };
  }

  if (session.user.role === "SELLER") {
    const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user.id } });
    if (!seller || returnReq.sellerId !== seller.id) {
      return { success: false, error: "Forbidden: You do not own this return request." };
    }
  }

  return { success: true, returnRequest: returnReq };
}

/**
 * Records a manual Tag Loop verification decision made during return inspection —
 * display + verification only, not an automated fraud-detection engine.
 */
export async function verifyTagLoop(returnRequestId: string, verified: boolean, mismatchNote?: string) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SELLER")) {
    return { success: false, error: "Unauthorized access." };
  }

  try {
    const returnReq = await prisma.returnRequest.findUnique({ where: { id: returnRequestId } });
    if (!returnReq) {
      return { success: false, error: "Return request not found." };
    }

    if (session.user.role === "SELLER") {
      const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user.id } });
      if (!seller || returnReq.sellerId !== seller.id) {
        return { success: false, error: "Forbidden: You do not own this return request." };
      }
    }

    await prisma.returnRequest.update({
      where: { id: returnRequestId },
      data: { tagLoopVerified: verified, tagLoopMismatchNote: verified ? null : mismatchNote?.trim() || null },
    });

    await createAuditLog(
      "RETURN_TAG_LOOP_VERIFIED",
      "ReturnRequest",
      returnRequestId,
      null,
      JSON.stringify({ verified, mismatchNote })
    );

    revalidatePath("/seller/returns");
    revalidatePath("/admin/return-refund-management");

    return { success: true };
  } catch (err: unknown) {
    console.error("verifyTagLoop error:", err);
    const msg = err instanceof Error ? err.message : "Failed to record Tag Loop verification.";
    return { success: false, error: msg };
  }
}

/**
 * Admin finalizes the refund, deducts wallet, restores stock, and registers logs.
 * Money Flow:
 * - Debit SELLER_PENDING or SELLER_WITHDRAWABLE: sellerEarning
 * - Debit PLATFORM_REVENUE: commissionAmount
 * - Credit CUSTOMER_REFUND: refundAmount
 */
export async function finalizeRefundAdmin(
  returnRequestId: string,
  adminNotes?: string,
  overrideCategory?: ReturnReasonCategory,
  overrideResponsibility?: ShippingResponsibility,
  customCustomerRefund?: number,
  customSellerDeduction?: number
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized access. Admin only." };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const returnReq = await tx.returnRequest.findUnique({
        where: { id: returnRequestId },
        include: {
          order: {
            include: {
              items: true,
              user: true,
            }
          },
          seller: { include: { wallet: true } },
          returnReasonRule: true,
        },
      });

      if (!returnReq) {
        return { success: false, error: "Return request not found." };
      }

      // Safeguard: Prevent double refunds
      if (returnReq.status === "REFUNDED") {
        return { success: false, error: "This return request has already been refunded." };
      }

      const order = returnReq.order;
      if (order.status === "REFUNDED" || order.paymentStatus === "REFUNDED") {
        return { success: false, error: "This order has already been marked as refunded." };
      }

      const wallet = returnReq.seller.wallet || (await ensureSellerWallet(returnReq.sellerId, tx));

      // Calculate original seller earning credited to prevent recalculating using current settings
      const sellerEarning = order.sellerEarning.greaterThan(0)
        ? order.sellerEarning
        : Decimal.max(0, order.subtotal.minus(order.discountAmount).minus(order.commissionAmount));

      const earningTx = await tx.walletTransaction.findFirst({
        where: {
          sellerWalletId: wallet.id,
          type: "EARNING",
          reference: `earning_order_${order.id}`,
        },
      });

      // 1. Resolve reason category & shipping responsibility (incorporating optional overrides)
      let category = returnReq.reasonCategory || "CUSTOMER_FAULT";
      let responsibility = returnReq.shippingResponsibility || "CUSTOMER";
      let reverseComm = returnReq.reverseCommission;
      let platformCost = returnReq.platformCost;

      let customerRefund = returnReq.customerRefundAmount;
      let sellerDeduction = returnReq.sellerDeductionAmount;
      const returnShipping = returnReq.returnShippingFee;
      const originalShipping = returnReq.originalShippingFee;
      let deduction = returnReq.deductionAmount;

      const productAmount = order.subtotal.minus(order.discountAmount);

      let origShipResp: ShippingResponsibility = "CUSTOMER";
      let retShipResp: ShippingResponsibility = "CUSTOMER";

      if (returnReq.returnReasonRule) {
        origShipResp = returnReq.returnReasonRule.originalShippingResponsibility;
        retShipResp = returnReq.returnReasonRule.returnShippingResponsibility;
      } else {
        if (category === "SELLER_FAULT") {
          origShipResp = "SELLER";
          retShipResp = "SELLER";
        } else if (category === "CUSTOMER_FAULT") {
          origShipResp = "CUSTOMER";
          retShipResp = "CUSTOMER";
        } else {
          origShipResp = "PLATFORM";
          retShipResp = "PLATFORM";
        }
      }

      console.log("[DEBUG finalizeRefundAdmin] Customer return request reason:", returnReq.reason);
      console.log("[DEBUG finalizeRefundAdmin] returnReasonRuleId stored on ReturnRequest:", returnReq.returnReasonRuleId);
      if (returnReq.returnReasonRule) {
        console.log("[DEBUG finalizeRefundAdmin] matched returnReasonRule:", returnReq.returnReasonRule.name);
        console.log("[DEBUG finalizeRefundAdmin] matched returnReasonRule responsibility (category):", returnReq.returnReasonRule.responsibility);
        console.log("[DEBUG finalizeRefundAdmin] matched returnReasonRule returnShippingResponsibility:", returnReq.returnReasonRule.returnShippingResponsibility);
        console.log("[DEBUG finalizeRefundAdmin] matched returnReasonRule originalShippingResponsibility:", returnReq.returnReasonRule.originalShippingResponsibility);
        console.log("[DEBUG finalizeRefundAdmin] matched returnReasonRule reverseCommission:", returnReq.returnReasonRule.reverseCommission);
      } else {
        console.log("[DEBUG finalizeRefundAdmin] matched returnReasonRule: None");
      }

      if (!returnReq.returnReasonRule) {
        if (category === "SELLER_FAULT" || category === "CUSTOMER_FAULT") {
          reverseComm = false;
        }
      }

      if (overrideCategory || overrideResponsibility) {
        // If override is provided, require adminNotes and log it
        if (!adminNotes || !adminNotes.trim()) {
          return { success: false, error: "An admin override requires a mandatory justification note." };
        }

        category = overrideCategory || category;
        responsibility = overrideResponsibility || responsibility;

        if (returnReq.returnReasonRule && category === returnReq.returnReasonRule.responsibility) {
          origShipResp = returnReq.returnReasonRule.originalShippingResponsibility;
          retShipResp = returnReq.returnReasonRule.returnShippingResponsibility;
          reverseComm = returnReq.returnReasonRule.reverseCommission;
        } else {
          if (category === "SELLER_FAULT") {
            origShipResp = "SELLER";
            retShipResp = "SELLER";
            reverseComm = false;
          } else if (category === "CUSTOMER_FAULT") {
            origShipResp = "CUSTOMER";
            retShipResp = "CUSTOMER";
            reverseComm = false;
          } else { // PLATFORM_FAULT
            origShipResp = "PLATFORM";
            retShipResp = "PLATFORM";
            reverseComm = true;
          }
        }

        if (overrideResponsibility) {
          retShipResp = overrideResponsibility;
        }

        let calculatedCustomerRefund = productAmount;
        if (origShipResp === "SELLER" || origShipResp === "PLATFORM") {
          calculatedCustomerRefund = calculatedCustomerRefund.plus(originalShipping);
        }
        if (retShipResp === "CUSTOMER") {
          calculatedCustomerRefund = calculatedCustomerRefund.minus(returnShipping);
          deduction = returnShipping;
        } else {
          deduction = new Decimal(0);
        }
        customerRefund = Decimal.max(0, calculatedCustomerRefund);

        if (category !== "PLATFORM_FAULT") {
          let calculatedSellerDeduct = productAmount;
          if (origShipResp === "SELLER") {
            calculatedSellerDeduct = calculatedSellerDeduct.plus(originalShipping);
          }
          if (retShipResp === "SELLER") {
            calculatedSellerDeduct = calculatedSellerDeduct.plus(returnShipping);
          }
          sellerDeduction = calculatedSellerDeduct;
        } else {
          let calculatedSellerDeduct = new Decimal(0);
          if (origShipResp === "SELLER") {
            calculatedSellerDeduct = calculatedSellerDeduct.plus(originalShipping);
          }
          if (retShipResp === "SELLER") {
            calculatedSellerDeduct = calculatedSellerDeduct.plus(returnShipping);
          }
          sellerDeduction = calculatedSellerDeduct;
        }

        let calculatedPlatformCost = new Decimal(0);
        if (category === "PLATFORM_FAULT") {
          calculatedPlatformCost = calculatedPlatformCost.plus(productAmount);
        }
        if (origShipResp === "PLATFORM") {
          calculatedPlatformCost = calculatedPlatformCost.plus(originalShipping);
        }
        if (retShipResp === "PLATFORM") {
          calculatedPlatformCost = calculatedPlatformCost.plus(returnShipping);
        }
        platformCost = calculatedPlatformCost;

        // Log the override action specifically
        await createAuditLog(
          "RETURN_REFUND_OVERRIDDEN",
          "ReturnRequest",
          returnReq.id,
          JSON.stringify({
            originalCategory: returnReq.reasonCategory,
            originalResponsibility: returnReq.shippingResponsibility,
            originalCustomerRefund: returnReq.customerRefundAmount.toString(),
            originalSellerDeduction: returnReq.sellerDeductionAmount.toString(),
          }),
          JSON.stringify({
            overriddenCategory: category,
            overriddenResponsibility: responsibility,
            overriddenCustomerRefund: customerRefund.toString(),
            overriddenSellerDeduction: sellerDeduction.toString(),
            note: adminNotes,
          })
        );
      }

      console.log("[DEBUG finalizeRefundAdmin] Final calculated customerRefund:", customerRefund.toString());
      console.log("[DEBUG finalizeRefundAdmin] Final calculated sellerDeduction:", sellerDeduction.toString());
      console.log("[DEBUG finalizeRefundAdmin] Final calculated platformCost:", platformCost.toString());

      // Direct amount overrides
      if (customCustomerRefund !== undefined) customerRefund = new Decimal(customCustomerRefund);
      if (customSellerDeduction !== undefined) sellerDeduction = new Decimal(customSellerDeduction);

      const commission = order.commissionAmount;
      const netSellerDeduction = sellerDeduction.minus(reverseComm ? commission : new Decimal(0));

      // 2. Perform wallet deductions using netSellerDeduction
      let pendingDeduction = new Decimal(0);
      let withdrawableDeduction = new Decimal(0);
      if (netSellerDeduction.greaterThan(0)) {
        withdrawableDeduction = netSellerDeduction;
      }

      let deductedFromPending = false;
      const originalWallet = {
        pendingBalance: wallet.pendingBalance.toString(),
        withdrawableBalance: wallet.withdrawableBalance.toString(),
        negativeBalance: wallet.negativeBalance.toString(),
        totalRefunded: wallet.totalRefunded.toString(),
      };

      if (earningTx && !earningTx.isReleased && netSellerDeduction.greaterThan(0)) {
        // Earning is still pending release:
        if (netSellerDeduction.greaterThanOrEqualTo(sellerEarning)) {
          pendingDeduction = sellerEarning;
          withdrawableDeduction = netSellerDeduction.minus(sellerEarning);
        } else {
          pendingDeduction = netSellerDeduction;
          withdrawableDeduction = new Decimal(0);
        }

        // Update pendingBalance
        await tx.sellerWallet.update({
          where: { id: wallet.id },
          data: {
            pendingBalance: { decrement: pendingDeduction },
          },
        });

        // Invalidate future auto-release of this transaction
        await tx.walletTransaction.update({
          where: { id: earningTx.id },
          data: {
            isReleased: true,
            description: `Earning cancelled due to refund (Return Req #${returnReq.id})`,
          },
        });
        deductedFromPending = true;
      }

      // Now deduct withdrawableDeduction from withdrawable balance
      if (withdrawableDeduction.greaterThan(0)) {
        let newWithdrawable = wallet.withdrawableBalance;
        let newNegative = wallet.negativeBalance;

        if (wallet.withdrawableBalance.greaterThanOrEqualTo(withdrawableDeduction)) {
          newWithdrawable = wallet.withdrawableBalance.minus(withdrawableDeduction);
        } else {
          const debt = withdrawableDeduction.minus(wallet.withdrawableBalance);
          newWithdrawable = new Decimal(0);
          newNegative = wallet.negativeBalance.plus(debt);
        }

        await tx.sellerWallet.update({
          where: { id: wallet.id },
          data: {
            withdrawableBalance: newWithdrawable,
            availableBalance: newWithdrawable,
            negativeBalance: newNegative,
          },
        });
      }

      // Increment totalRefunded by the actual netSellerDeduction
      await tx.sellerWallet.update({
        where: { id: wallet.id },
        data: {
          totalRefunded: { increment: netSellerDeduction },
        },
      });

      // Create refund WalletTransaction log
      const refId = `refund_ret_${returnReq.id}`;
      if (netSellerDeduction.greaterThan(0)) {
        await tx.walletTransaction.create({
          data: {
            sellerWalletId: wallet.id,
            amount: netSellerDeduction.negated(),
            type: "REFUND",
            status: "PAID",
            description: `Refund deduction for Order #${order.orderNumber} (Return Req #${returnReq.id})` +
              (deductedFromPending ? ` [Deducted: ₹${pendingDeduction.toFixed(2)} Pending, ₹${withdrawableDeduction.toFixed(2)} Withdrawable]` : ""),
            reference: refId,
          },
        });
      }

      // 3. Record double-entry ledger entries for refund
      const ledgerEntries = [];

      // Debits (Sources)
      if (pendingDeduction.greaterThan(0)) {
        ledgerEntries.push({
          accountName: `SELLER_PENDING:${wallet.sellerId}`,
          debit: pendingDeduction,
          credit: new Decimal(0),
        });
      }
      if (withdrawableDeduction.greaterThan(0)) {
        ledgerEntries.push({
          accountName: `SELLER_WITHDRAWABLE:${wallet.sellerId}`,
          debit: withdrawableDeduction,
          credit: new Decimal(0),
        });
      }
      if (reverseComm && commission.greaterThan(0)) {
        ledgerEntries.push({
          accountName: "PLATFORM_REVENUE",
          debit: commission,
          credit: new Decimal(0),
        });
      }
      if (platformCost.greaterThan(0)) {
        ledgerEntries.push({
          accountName: "PLATFORM_REFUND_EXPENSE",
          debit: platformCost,
          credit: new Decimal(0),
        });
      }

      // Credits (Destinations)
      ledgerEntries.push({
        accountName: "CUSTOMER_REFUND",
        debit: new Decimal(0),
        credit: customerRefund,
      });

      if (returnShipping.greaterThan(0)) {
        ledgerEntries.push({
          accountName: "RETURN_SHIPPING_PAYABLE",
          debit: new Decimal(0),
          credit: returnShipping,
        });
      }

      const totalDebits = pendingDeduction.plus(withdrawableDeduction)
        .plus(reverseComm ? commission : new Decimal(0))
        .plus(platformCost);

      const remainingCredit = totalDebits.minus(customerRefund).minus(returnShipping);
      if (remainingCredit.greaterThan(0)) {
        ledgerEntries.push({
          accountName: "SHIPPING_REFUND",
          debit: new Decimal(0),
          credit: remainingCredit,
        });
      }

      await recordLedgerTransaction(tx, {
        reference: refId,
        description: `Refund processed for Order #${order.orderNumber} (Return Request #${returnReq.id}) - Category: ${category}`,
        entries: ledgerEntries,
      });

      // Stock Restoration Safeguard: Only restore if requested and not done yet
      if (returnReq.restoreStock && !returnReq.stockRestored) {
        for (const item of order.items) {
          if (item.variantId) {
            const updatedVariant = await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            });

            await tx.inventoryTransaction.create({
              data: {
                variantId: item.variantId,
                sellerId: returnReq.sellerId,
                type: "RETURN_RESTOCK",
                quantityChange: item.quantity,
                quantityBefore: updatedVariant.stock - item.quantity,
                quantityAfter: updatedVariant.stock,
                orderId: order.id,
                orderItemId: item.id,
                reference: `returnrequest:${returnReq.id}:restock`,
              },
            });
          }
        }
      }

      // Update ReturnRequest to final REFUNDED state
      await tx.returnRequest.update({
        where: { id: returnReq.id },
        data: {
          status: "REFUNDED",
          stockRestored: returnReq.restoreStock ? true : returnReq.stockRestored,
          adminNotes,
          reasonCategory: category,
          shippingResponsibility: responsibility,
          customerRefundAmount: customerRefund,
          sellerDeductionAmount: sellerDeduction,
          deductionAmount: deduction,
          platformCost,
          reverseCommission: reverseComm,
          approvedAt: returnReq.approvedAt || new Date(),
          refundedAt: new Date(),
          orderNumber: order.orderNumber,
          sellerStoreName: returnReq.seller.storeName,
          customerName: order.user?.name || "Customer",
          customerEmail: order.user?.email || "customer@garmenthub.local",
          productName: order.items.map(item => (item.productSnapshot as any)?.name || "").filter(Boolean).join(", "),
          productSku: order.items.map(item => (item.variantSnapshot as any)?.sku || "").filter(Boolean).join(", "),
          quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
          productAmount: productAmount,
          originalShippingResponsibility: origShipResp,
          returnShippingResponsibility: retShipResp,
          whoPaidProductRefund: category === "PLATFORM_FAULT" ? "Platform" : "Seller",
          whoPaidOriginalShipping: origShipResp === "SELLER" ? "Seller" : (origShipResp === "PLATFORM" ? "Platform" : "Customer"),
          whoPaidReturnShipping: retShipResp === "SELLER" ? "Seller" : (retShipResp === "PLATFORM" ? "Platform" : "Customer"),
          walletTransactionRef: netSellerDeduction.greaterThan(0) ? refId : null,
          ledgerTransactionRef: refId,
        },
      });

      // Update Order Statuses
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "REFUNDED",
          paymentStatus: "REFUNDED",
          shippingStatus: "RETURNED",
        },
      });

      // Update Shipment if exists
      await tx.shipment.updateMany({
        where: { orderId: order.id },
        data: { shippingStatus: "RETURNED" },
      });

      // Immutable Audit Log
      await createAuditLog(
        "RETURN_REFUND_FINALIZED",
        "ReturnRequest",
        returnReq.id,
        JSON.stringify(originalWallet),
        JSON.stringify({ refundAmount: sellerEarning.toString(), status: "REFUNDED" })
      );

      // Notification Hook: Refund completed
      await sendInAppNotification(
        returnReq.customerId,
        "ORDER_CANCELLED",
        "Refund Processed",
        `A refund of ₹${returnReq.refundAmount.toLocaleString()} was processed for order #${order.orderNumber}.`,
        "/account/orders"
      ).catch(() => null);

      revalidatePath("/account/orders");
      revalidatePath("/seller/orders");
      revalidatePath("/admin/orders");
      revalidatePath("/admin/wallets");

      return { success: true };
    });
  } catch (err: any) {
    console.error("finalizeRefundAdmin error:", err);
    return { success: false, error: err.message || "Failed to finalize refund." };
  }
}

/**
 * Fetch all return requests (Admin only).
 */
export async function getReturnRequestsAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized access.");
  }
  return prisma.returnRequest.findMany({
    include: {
      order: { select: { orderNumber: true, totalAmount: true } },
      customer: { select: { name: true, email: true } },
      seller: { select: { storeName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Fetch return requests for the active seller.
 */
export async function getReturnRequestsSeller() {
  const seller = await requireSellerProfileOrThrow();

  return prisma.returnRequest.findMany({
    where: { sellerId: seller.id },
    include: {
      order: { select: { orderNumber: true, totalAmount: true } },
      customer: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Fetch return rules master list.
 */
export async function getReturnReasonRules(onlyActive = false) {
  return prisma.returnReasonRule.findMany({
    where: onlyActive ? { isActive: true } : {},
    orderBy: { name: "asc" },
  });
}

/**
 * Create a new return reason rule (Admin only).
 */
export async function createReturnReasonRule(data: {
  name: string;
  description?: string;
  responsibility: ReturnReasonCategory;
  originalShippingResponsibility: ShippingResponsibility;
  returnShippingResponsibility: ShippingResponsibility;
  reverseCommission: boolean;
  isActive?: boolean;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized access. Admin only." };
  }

  try {
    const rule = await prisma.returnReasonRule.create({
      data: {
        name: normalizeReason(data.name),
        description: data.description || null,
        responsibility: data.responsibility,
        originalShippingResponsibility: data.originalShippingResponsibility,
        returnShippingResponsibility: data.returnShippingResponsibility,
        reverseCommission: data.reverseCommission,
        isActive: data.isActive ?? true,
      },
    });

    await createAuditLog(
      "RETURN_RULE_CREATED",
      "ReturnReasonRule",
      rule.id,
      null,
      JSON.stringify(rule)
    );

    return { success: true, rule };
  } catch (err: any) {
    console.error("createReturnReasonRule error:", err);
    return { success: false, error: err.message || "Failed to create return rule." };
  }
}

/**
 * Update an existing return reason rule (Admin only).
 */
export async function updateReturnReasonRule(
  id: string,
  data: {
    name: string;
    description?: string;
    responsibility: ReturnReasonCategory;
    originalShippingResponsibility: ShippingResponsibility;
    returnShippingResponsibility: ShippingResponsibility;
    reverseCommission: boolean;
    isActive?: boolean;
  }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized access. Admin only." };
  }

  try {
    const oldRule = await prisma.returnReasonRule.findUnique({ where: { id } });
    const rule = await prisma.returnReasonRule.update({
      where: { id },
      data: {
        name: normalizeReason(data.name),
        description: data.description || null,
        responsibility: data.responsibility,
        originalShippingResponsibility: data.originalShippingResponsibility,
        returnShippingResponsibility: data.returnShippingResponsibility,
        reverseCommission: data.reverseCommission,
        isActive: data.isActive ?? true,
      },
    });

    await createAuditLog(
      "RETURN_RULE_UPDATED",
      "ReturnReasonRule",
      rule.id,
      JSON.stringify(oldRule),
      JSON.stringify(rule)
    );

    return { success: true, rule };
  } catch (err: any) {
    console.error("updateReturnReasonRule error:", err);
    return { success: false, error: err.message || "Failed to update return rule." };
  }
}

/**
 * Deactivate a return reason rule (Admin only - soft delete).
 */
export async function deleteReturnReasonRule(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized access. Admin only." };
  }

  try {
    const oldRule = await prisma.returnReasonRule.findUnique({ where: { id } });
    const rule = await prisma.returnReasonRule.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog(
      "RETURN_RULE_DEACTIVATED",
      "ReturnReasonRule",
      rule.id,
      JSON.stringify(oldRule),
      JSON.stringify(rule)
    );

    return { success: true, rule };
  } catch (err: any) {
    console.error("deleteReturnReasonRule error:", err);
    return { success: false, error: err.message || "Failed to deactivate return rule." };
  }
}

/**
 * Seed standard default return reason rules.
 */
export async function seedReturnReasonRules() {
  const defaultRules = [
    {
      name: "Damaged product",
      description: "Product was received in a damaged condition.",
      responsibility: "SELLER_FAULT",
      originalShippingResponsibility: "SELLER",
      returnShippingResponsibility: "SELLER",
      reverseCommission: false,
    },
    {
      name: "Defective product",
      description: "Product is defective or not working.",
      responsibility: "SELLER_FAULT",
      originalShippingResponsibility: "SELLER",
      returnShippingResponsibility: "SELLER",
      reverseCommission: false,
    },
    {
      name: "Wrong item delivered",
      description: "Received a different product than ordered.",
      responsibility: "SELLER_FAULT",
      originalShippingResponsibility: "SELLER",
      returnShippingResponsibility: "SELLER",
      reverseCommission: false,
    },
    {
      name: "Wrong size sent",
      description: "Seller sent a different size than ordered.",
      responsibility: "SELLER_FAULT",
      originalShippingResponsibility: "SELLER",
      returnShippingResponsibility: "SELLER",
      reverseCommission: false,
    },
    {
      name: "Missing item",
      description: "An item was missing from the package.",
      responsibility: "SELLER_FAULT",
      originalShippingResponsibility: "SELLER",
      returnShippingResponsibility: "SELLER",
      reverseCommission: false,
    },
    {
      name: "Customer changed mind",
      description: "Buyer decided they do not want the item anymore.",
      responsibility: "CUSTOMER_FAULT",
      originalShippingResponsibility: "CUSTOMER",
      returnShippingResponsibility: "CUSTOMER",
      reverseCommission: false,
    },
    {
      name: "Ordered by mistake",
      description: "Buyer ordered the wrong item by mistake.",
      responsibility: "CUSTOMER_FAULT",
      originalShippingResponsibility: "CUSTOMER",
      returnShippingResponsibility: "CUSTOMER",
      reverseCommission: false,
    },
    {
      name: "Did not like product",
      description: "Product is not as liked by customer.",
      responsibility: "CUSTOMER_FAULT",
      originalShippingResponsibility: "CUSTOMER",
      returnShippingResponsibility: "CUSTOMER",
      reverseCommission: false,
    },
    {
      name: "Platform pricing mistake",
      description: "GarmentHub platform displayed incorrect pricing.",
      responsibility: "PLATFORM_FAULT",
      originalShippingResponsibility: "PLATFORM",
      returnShippingResponsibility: "PLATFORM",
      reverseCommission: true,
    },
  ];

  try {
    let seededCount = 0;
    for (const r of defaultRules) {
      const existing = await prisma.returnReasonRule.findUnique({
        where: { name: normalizeReason(r.name) },
      });
      if (!existing) {
        await prisma.returnReasonRule.create({
          data: {
            name: normalizeReason(r.name),
            description: r.description,
            responsibility: r.responsibility as ReturnReasonCategory,
            originalShippingResponsibility: r.originalShippingResponsibility as ShippingResponsibility,
            returnShippingResponsibility: r.returnShippingResponsibility as ShippingResponsibility,
            reverseCommission: r.reverseCommission,
            isActive: true,
          },
        });
        seededCount++;
      } else {
        await prisma.returnReasonRule.update({
          where: { id: existing.id },
          data: {
            name: normalizeReason(r.name),
            reverseCommission: r.reverseCommission,
            responsibility: r.responsibility as ReturnReasonCategory,
            originalShippingResponsibility: r.originalShippingResponsibility as ShippingResponsibility,
            returnShippingResponsibility: r.returnShippingResponsibility as ShippingResponsibility,
          },
        });
      }
    }

    return { success: true, seededCount };
  } catch (err: any) {
    console.error("seedReturnReasonRules error:", err);
    return { success: false, error: err.message || "Failed to seed return rules." };
  }
}
