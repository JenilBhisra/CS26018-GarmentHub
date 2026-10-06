"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/actions/audit";
import { sendInAppNotification } from "@/actions/notifications";
import { DisputeStatus, DisputePriority } from "@prisma/client";
import { revalidatePath } from "next/cache";

interface DisputeCreateInput {
  orderId?: string;
  productId?: string;
  sellerId?: string;
  reason: string;
  description: string;
}

/**
 * Customer creates a dispute ticket.
 */
export async function createDispute(data: DisputeCreateInput) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Please sign in to file a dispute." };
  }

  if (!data.reason.trim()) {
    return { success: false, error: "Reason is required." };
  }

  if (!data.description.trim()) {
    return { success: false, error: "Description is required." };
  }

  try {
    const dispute = await prisma.dispute.create({
      data: {
        orderId: data.orderId || null,
        productId: data.productId || null,
        sellerId: data.sellerId || null,
        customerId: session.user.id,
        reason: data.reason,
        description: data.description,
        status: "OPEN",
        priority: "MEDIUM",
      },
      include: {
        seller: true,
      },
    });

    // Create Audit Log
    await createAuditLog(
      "DISPUTE_CREATED",
      "Dispute",
      dispute.id,
      null,
      JSON.stringify({ reason: data.reason })
    );

    // Notification Hook: Dispute created
    if (dispute.seller) {
      await sendInAppNotification(
        dispute.seller.userId,
        "NEW_SUPPORT_MESSAGE",
        "Dispute Raised",
        `A dispute has been raised against order/product. Reason: ${data.reason}`,
        "/seller/messages"
      ).catch(() => null);
    }

    revalidatePath("/admin/disputes");

    return { success: true, disputeId: dispute.id };
  } catch (err: any) {
    console.error("createDispute error:", err);
    return { success: false, error: err.message || "Failed to file dispute ticket." };
  }
}

/**
 * Add a reply/note to a dispute ticket.
 */
export async function addDisputeNote(disputeId: string, note: string, isInternal = true) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Please sign in." };
  }

  if (!note.trim()) {
    return { success: false, error: "Note cannot be empty." };
  }

  try {
    const disputeNote = await prisma.disputeNote.create({
      data: {
        disputeId,
        note,
        isInternal,
        authorId: session.user.id,
      },
    });

    // Notification hook on non-internal note
    if (!isInternal) {
      const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
      if (dispute) {
        const notifyTarget = session.user.id === dispute.customerId ? dispute.sellerId : dispute.customerId;
        if (notifyTarget) {
          const profile = await prisma.user.findUnique({ where: { id: notifyTarget } });
          if (profile) {
            await sendInAppNotification(
              notifyTarget,
              "NEW_SUPPORT_MESSAGE",
              "Dispute Update",
              `A new reply has been added to your dispute: "${note.substring(0, 40)}..."`,
              "/account/messages"
            ).catch(() => null);
          }
        }
      }
    }

    revalidatePath("/admin/disputes");

    return { success: true, disputeNoteId: disputeNote.id };
  } catch (err: any) {
    console.error("addDisputeNote error:", err);
    return { success: false, error: err.message || "Failed to add reply." };
  }
}

/**
 * Admin updates the dispute details (status, priority, internal notes, assigned admin).
 */
export async function updateDisputeAdmin(
  disputeId: string,
  data: {
    status?: DisputeStatus;
    priority?: DisputePriority;
    adminNotes?: string;
    assignedTo?: string;
  }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized access. Admin only." };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.findUnique({
        where: { id: disputeId },
      });

      if (!dispute) {
        return { success: false, error: "Dispute ticket not found." };
      }

      const oldValues = {
        status: dispute.status,
        priority: dispute.priority,
        adminNotes: dispute.adminNotes,
        assignedTo: dispute.assignedTo,
      };

      const updatedDispute = await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: data.status ?? dispute.status,
          priority: data.priority ?? dispute.priority,
          adminNotes: data.adminNotes ?? dispute.adminNotes,
          assignedTo: data.assignedTo ?? dispute.assignedTo,
        },
      });

      // Immutable Audit Log
      await createAuditLog(
        "DISPUTE_UPDATED",
        "Dispute",
        dispute.id,
        JSON.stringify(oldValues),
        JSON.stringify(data)
      );

      // Notification Hook: Dispute resolved/closed/updated
      if (data.status && data.status !== dispute.status) {
        if (dispute.customerId) {
          await sendInAppNotification(
            dispute.customerId,
            "NEW_SUPPORT_MESSAGE",
            "Dispute Ticket Updated",
            `Your dispute status has been changed to ${data.status}.`,
            "/account/orders"
          ).catch(() => null);
        }
      }

      revalidatePath("/admin/disputes");

      return { success: true };
    });
  } catch (err: any) {
    console.error("updateDisputeAdmin error:", err);
    return { success: false, error: err.message || "Failed to update dispute." };
  }
}

/**
 * Fetch all disputes in the system (Admin only).
 */
export async function getDisputesAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized access.");
  }

  return prisma.dispute.findMany({
    include: {
      order: { select: { orderNumber: true, totalAmount: true } },
      customer: { select: { name: true, email: true } },
      seller: { select: { storeName: true } },
      notes: {
        include: {
          author: { select: { name: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
