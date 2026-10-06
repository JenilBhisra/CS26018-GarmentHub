"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { RFQStatus, QuoteStatus, NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { sendInAppNotification } from "@/actions/notifications";
import { sendNotificationEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { createAuditLog } from "@/actions/audit";

/**
 * Creates a Request for Quote (RFQ) for a B2B approved product.
 */
export async function createRFQ(
  productId: string,
  quantity: number,
  targetPrice: number,
  deliveryCity: string,
  notes?: string
) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  const limit = await rateLimit("rfq_create", session.user.id);
  if (!limit.success) {
    return { success: false, error: "Too many RFQ requests. Please try again in an hour." };
  }

  // Retrieve buyer's B2B profile
  const b2bProfile = await prisma.b2BProfile.findUnique({
    where: { userId: session.user.id },
    include: { kyc: true },
  });

  if (!b2bProfile) {
    return { success: false, error: "Unauthorized: Only users with a B2B Profile can request quotes." };
  }

  if (b2bProfile.approvalStatus !== "APPROVED") {
    return { success: false, error: "Your B2B account is pending approval. You will be able to request quotes once approved." };
  }

  if (b2bProfile.kyc?.status !== "APPROVED") {
    return { success: false, error: "Your business KYC must be approved before you can submit RFQs." };
  }

  // Validation
  if (!quantity || quantity <= 0) {
    return { success: false, error: "Quantity must be greater than 0." };
  }
  if (targetPrice < 0) {
    return { success: false, error: "Target price must not be negative." };
  }
  if (!deliveryCity || !deliveryCity.trim()) {
    return { success: false, error: "Delivery city is required." };
  }

  // Fetch product and verify active and B2B approved
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    return { success: false, error: "Product not found." };
  }

  if (product.status !== "ACTIVE" || !product.isB2BEnabled || !product.isB2BApproved) {
    return { success: false, error: "This product is not active or approved for B2B wholesale transactions." };
  }

  try {
    const rfq = await prisma.rFQ.create({
      data: {
        buyerId: b2bProfile.id,
        productId: product.id,
        quantity,
        targetPrice,
        deliveryCity: deliveryCity.trim(),
        notes: notes?.trim() || null,
        status: RFQStatus.PENDING,
      },
    });

    // Fetch seller user details and notify
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { id: product.sellerId },
      include: { user: true }
    });

    if (sellerProfile) {
      sendInAppNotification(
        sellerProfile.userId,
        NotificationType.RFQ_RECEIVED,
        "New RFQ Received",
        `Wholesale buyer "${b2bProfile.companyName}" requested a bulk quotation for "${product.name}".`,
        "/seller/rfqs"
      ).catch((err) => console.error("RFQ Received in-app failed:", err));

      sendNotificationEmail(
        sellerProfile.user.email,
        `New Bulk Quotation Request (RFQ) for "${product.name}"`,
        "SELLER_NEW_RFQ",
        {
          sellerName: sellerProfile.user.name || "Seller",
          productName: product.name,
          quantity,
          targetPrice
        }
      ).catch((err) => console.error("RFQ Received email failed:", err));
    }

    revalidatePath("/b2b");
    revalidatePath("/b2b/rfqs");

    await createAuditLog("CREATE_RFQ", "RFQ", rfq.id, null, { productId, quantity, targetPrice });

    return { success: true, rfqId: rfq.id };
  } catch (error: unknown) {
    console.error("createRFQ error:", error);
    return { success: false, error: "Failed to create RFQ." };
  }
}

/**
 * Responds to an RFQ with a quote proposal.
 */
export async function respondToRFQ(
  rfqId: string,
  price: number,
  moq: number,
  leadTime: string,
  validityDateStr: string,
  notes?: string
) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  // Retrieve seller profile
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    include: { kyc: true },
  });

  if (!seller) {
    return { success: false, error: "Unauthorized: Only registered sellers can quote on RFQs." };
  }

  if (seller.approvalStatus !== "APPROVED" || seller.kyc?.status !== "APPROVED") {
    return { success: false, error: "Your seller account and KYC must be approved before quoting." };
  }

  // Validation
  if (!price || price <= 0) {
    return { success: false, error: "Price must be greater than 0." };
  }
  if (!moq || moq <= 0) {
    return { success: false, error: "MOQ must be greater than 0." };
  }
  if (!leadTime || !leadTime.trim()) {
    return { success: false, error: "Lead time is required." };
  }

  const validityDate = new Date(validityDateStr);
  if (isNaN(validityDate.getTime())) {
    return { success: false, error: "Invalid validity date." };
  }

  // Check if date is in the future
  const now = new Date();
  if (validityDate <= now) {
    return { success: false, error: "Validity date must be a future date." };
  }

  // Fetch RFQ
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
    include: {
      product: true,
    },
  });

  if (!rfq) {
    return { success: false, error: "RFQ not found." };
  }

  // Verify ownership: seller can quote only on RFQs for their own products
  if (rfq.product.sellerId !== seller.id) {
    return { success: false, error: "Forbidden: You can only respond to RFQs for your own products." };
  }

  if (rfq.status === RFQStatus.CLOSED) {
    return { success: false, error: "This RFQ is closed and cannot receive quotes." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create quote
      const quote = await tx.quote.create({
        data: {
          rfqId,
          sellerId: seller.id,
          price,
          moq,
          leadTime: leadTime.trim(),
          validityDate,
          notes: notes?.trim() || null,
          status: QuoteStatus.SENT,
        },
      });

      // Update RFQ status
      const originalRespondedAt = rfq.respondedAt;
      await tx.rFQ.update({
        where: { id: rfqId },
        data: {
          status: RFQStatus.RESPONDED,
          respondedAt: originalRespondedAt || new Date(),
          lastResponseAt: new Date(),
        },
      });

      return quote;
    });

    // Notify buyer
    const buyerProfile = await prisma.b2BProfile.findUnique({
      where: { id: rfq.buyerId },
      include: { user: true }
    });

    if (buyerProfile) {
      sendInAppNotification(
        buyerProfile.userId,
        NotificationType.RFQ_RESPONDED,
        "New Quote Proposal",
        `Seller "${seller.storeName}" has submitted a quotation response for your RFQ on "${rfq.product.name}".`,
        "/b2b/rfqs"
      ).catch((err) => console.error("RFQ Responded in-app failed:", err));

      sendNotificationEmail(
        buyerProfile.user.email,
        `New Quotation Received: "${rfq.product.name}"`,
        "CUSTOMER_ORDER_PLACED",
        {
          customerName: buyerProfile.user.name || "Wholesale Buyer",
          orderNumber: `RFQ-${rfqId.substring(0, 8)}`,
          itemCount: rfq.quantity,
          sellerStoreName: seller.storeName,
          totalAmount: price * rfq.quantity,
          paymentMethod: "Manual Quote Offer"
        }
      ).catch((err) => console.error("RFQ Responded email failed:", err));
    }

    revalidatePath("/seller/rfqs");
    revalidatePath("/b2b/rfqs");

    await createAuditLog("RESPOND_RFQ", "Quote", result.id, null, { rfqId, price, moq });

    return { success: true, quoteId: result.id };
  } catch (error: unknown) {
    console.error("respondToRFQ error:", error);
    return { success: false, error: "Failed to submit quote response." };
  }
}

/**
 * Update the status of a quote (Accept/Reject).
 */
export async function updateQuoteStatus(quoteId: string, status: "ACCEPTED" | "REJECTED") {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  // Retrieve buyer's B2B profile
  const b2bProfile = await prisma.b2BProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!b2bProfile) {
    return { success: false, error: "Unauthorized." };
  }

  // Fetch quote
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      rfq: true,
    },
  });

  if (!quote) {
    return { success: false, error: "Quote not found." };
  }

  // Verify ownership (the RFQ creator is the one accepting/rejecting the quote)
  if (quote.rfq.buyerId !== b2bProfile.id) {
    return { success: false, error: "Forbidden: You do not own this RFQ." };
  }

  try {
    await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: status === "ACCEPTED" ? QuoteStatus.ACCEPTED : QuoteStatus.REJECTED,
      },
    });

    revalidatePath("/b2b/rfqs");
    revalidatePath("/seller/rfqs");

    await createAuditLog("UPDATE_QUOTE_STATUS", "Quote", quoteId, { status: quote.status }, { status });

    return { success: true };
  } catch (error: unknown) {
    console.error("updateQuoteStatus error:", error);
    return { success: false, error: "Failed to update quote status." };
  }
}

/**
 * Closes an RFQ.
 */
export async function closeRFQ(rfqId: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  // Retrieve buyer's B2B profile
  const b2bProfile = await prisma.b2BProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!b2bProfile) {
    return { success: false, error: "Unauthorized." };
  }

  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
  });

  if (!rfq) {
    return { success: false, error: "RFQ not found." };
  }

  if (rfq.buyerId !== b2bProfile.id) {
    return { success: false, error: "Forbidden: You do not own this RFQ." };
  }

  try {
    await prisma.rFQ.update({
      where: { id: rfqId },
      data: {
        status: RFQStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    revalidatePath("/b2b/rfqs");
    revalidatePath("/seller/rfqs");

    await createAuditLog("CLOSE_RFQ", "RFQ", rfqId, { status: rfq.status }, { status: RFQStatus.CLOSED });

    return { success: true };
  } catch (error: unknown) {
    console.error("closeRFQ error:", error);
    return { success: false, error: "Failed to close RFQ." };
  }
}

/**
 * Fetch RFQs submitted by the current B2B buyer.
 */
export async function getBuyerRFQs() {
  const session = await auth();
  if (!session?.user) return [];

  const b2bProfile = await prisma.b2BProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!b2bProfile) return [];

  return prisma.rFQ.findMany({
    where: { buyerId: b2bProfile.id },
    include: {
      product: {
        include: {
          seller: true,
        },
      },
      quotes: {
        include: {
          seller: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Fetch RFQs received by the seller for their own products.
 */
export async function getSellerRFQs() {
  const session = await auth();
  if (!session?.user) return [];

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!seller) return [];

  return prisma.rFQ.findMany({
    where: {
      product: {
        sellerId: seller.id,
      },
    },
    include: {
      buyer: {
        include: {
          user: true,
        },
      },
      product: true,
      quotes: {
        where: { sellerId: seller.id },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Fetch all RFQs for admin view.
 */
export async function getAdminRFQs() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return [];

  return prisma.rFQ.findMany({
    include: {
      buyer: {
        include: {
          user: true,
        },
      },
      product: {
        include: {
          seller: true,
        },
      },
      quotes: {
        include: {
          seller: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
