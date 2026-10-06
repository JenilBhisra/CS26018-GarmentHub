"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { Role, ConversationType, MessageType, NotificationType } from "@prisma/client";
import { sendInAppNotification } from "@/actions/notifications";
import { sendNotificationEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { createAuditLog } from "@/actions/audit";

// Helper to authenticate user and update their last active timestamp
async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized: Please log in.");
  }
  
  const userId = session.user.id;
  // Update last active status to track online state
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
  }).catch(err => console.error("Error updating lastActiveAt:", err));

  return session.user;
}

// Check if a user is online (active in last 30 seconds)
function isUserOnline(lastActiveAt: Date | null) {
  if (!lastActiveAt) return false;
  const now = new Date();
  const diffMs = now.getTime() - lastActiveAt.getTime();
  return diffMs < 30000; // 30 seconds
}

// ---------------------------------------------------------------------------
// 1. Get or Create Conversation
// ---------------------------------------------------------------------------
export async function getOrCreateConversation(
  type: ConversationType,
  targetUserId: string,
  productId?: string,
  orderId?: string,
  rfqId?: string
) {
  const currentUser = await requireAuth();

  // Resolve targetUserId from either User.id, SellerProfile.id, or B2BProfile.id dynamically
  let resolvedUserId = targetUserId;
  const seller = await prisma.sellerProfile.findUnique({
    where: { id: targetUserId },
  });
  if (seller) {
    resolvedUserId = seller.userId;
  } else {
    const b2b = await prisma.b2BProfile.findUnique({
      where: { id: targetUserId },
    });
    if (b2b) {
      resolvedUserId = b2b.userId;
    }
  }

  if (currentUser.id === resolvedUserId) {
    throw new Error("You cannot start a conversation with yourself.");
  }

  // Double check that target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: resolvedUserId },
  });
  if (!targetUser) {
    throw new Error("Target user not found.");
  }

  // Check if conversation already exists with this exact type, participants and context
  const existingParticipant = await prisma.conversationParticipant.findFirst({
    where: {
      userId: currentUser.id,
      conversation: {
        type,
        productId: productId || null,
        orderId: orderId || null,
        rfqId: rfqId || null,
        participants: {
          some: {
            userId: resolvedUserId,
          },
        },
      },
    },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                  role: true,
                  lastActiveAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (existingParticipant?.conversation) {
    // If it was archived for either participant, unarchive it
    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId: existingParticipant.conversation.id,
        isArchived: true,
      },
      data: {
        isArchived: false,
      },
    });
    return existingParticipant.conversation;
  }

  // Create new conversation
  const newConversation = await prisma.conversation.create({
    data: {
      type,
      productId: productId || null,
      orderId: orderId || null,
      rfqId: rfqId || null,
      createdById: currentUser.id,
      participants: {
        create: [
          { userId: currentUser.id },
          { userId: resolvedUserId },
        ],
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              role: true,
              lastActiveAt: true,
            },
          },
        },
      },
    },
  });

  return newConversation;
}

// ---------------------------------------------------------------------------
// 2. Fetch Conversations List
// ---------------------------------------------------------------------------
export async function getConversations(searchTerm?: string) {
  const currentUser = await requireAuth();

  const isSearchActive = searchTerm && searchTerm.trim() !== "";
  const searchVal = isSearchActive ? searchTerm!.trim().toLowerCase() : "";

  // Admins get all conversations in the system for moderation, or reported ones
  const isAdmin = currentUser.role === Role.ADMIN;

  const conversations = await prisma.conversation.findMany({
    where: {
      // Admin sees all. Others only see conversations they participate in
      ...(isAdmin
        ? {}
        : {
            participants: {
              some: {
                userId: currentUser.id,
                // Don't show archived conversations unless searching
                isArchived: isSearchActive ? undefined : false,
              },
            },
          }),
      // If B2B/Seller/Customer specific filter needed, it can be derived by participant check
      // Apply search filters
      ...(isSearchActive
        ? {
            OR: [
              {
                messages: {
                  some: {
                    message: {
                      contains: searchVal,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                participants: {
                  some: {
                    user: {
                      name: {
                        contains: searchVal,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              },
              {
                product: {
                  name: {
                    contains: searchVal,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              role: true,
              lastActiveAt: true,
            },
          },
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          brand: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
        },
      },
      rfq: {
        select: {
          id: true,
          quantity: true,
          targetPrice: true,
          status: true,
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      lastMessageAt: "desc",
    },
  });

  // Calculate unread badge counts for each conversation
  const list = await Promise.all(
    conversations.map(async (c) => {
      // Find current user's participant entry
      const myParticipant = c.participants.find((p) => p.userId === currentUser.id);
      
      let unreadCount = 0;
      if (myParticipant) {
        unreadCount = await prisma.message.count({
          where: {
            conversationId: c.id,
            senderId: { not: currentUser.id },
            createdAt: { gt: myParticipant.lastReadAt },
          },
        });
      }

      // Format clean participant list omitting current user
      const otherParticipants = c.participants
        .filter((p) => p.userId !== currentUser.id)
        .map((p) => ({
          ...p.user,
          isOnline: isUserOnline(p.user.lastActiveAt),
        }));

      // Find if this is pinned/archived for current user
      const isPinned = myParticipant?.isPinned || false;
      const isArchived = myParticipant?.isArchived || false;

      return {
        id: c.id,
        type: c.type,
        productId: c.productId,
        product: c.product,
        orderId: c.orderId,
        order: c.order,
        rfqId: c.rfqId,
        rfq: c.rfq,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        lastMessageAt: c.lastMessageAt,
        isSuspended: c.isSuspended,
        suspendedReason: c.suspendedReason,
        isReported: c.isReported,
        reportedReason: c.reportedReason,
        reportedById: c.reportedById,
        isPinned,
        isArchived,
        unreadCount,
        otherParticipants,
        lastMessage: c.messages[0] || null,
      };
    })
  );

  return list;
}

// ---------------------------------------------------------------------------
// 3. Fetch Paginated Messages
// ---------------------------------------------------------------------------
export async function getMessages(conversationId: string, page = 1, limit = 40) {
  const currentUser = await requireAuth();

  // Validate conversation exists and current user is participant or ADMIN
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: true,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  const isParticipant = conversation.participants.some((p) => p.userId === currentUser.id);
  const isAdmin = currentUser.role === Role.ADMIN;

  if (!isParticipant && !isAdmin) {
    throw new Error("Access denied: You are not a participant in this conversation.");
  }

  const skip = (page - 1) * limit;

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
        },
      },
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  // Reverse so they are in chronological order (oldest first)
  return messages.reverse();
}

// ---------------------------------------------------------------------------
// 4. Send Message Action
// ---------------------------------------------------------------------------
export async function sendMessage(
  conversationId: string,
  messageText: string,
  messageType: MessageType = MessageType.TEXT,
  attachmentUrl?: string,
  attachmentName?: string,
  attachmentSize?: number
) {
  const currentUser = await requireAuth();

  const limit = await rateLimit("chat", currentUser.id);
  if (!limit.success) {
    throw new Error("Too many chat messages. Please wait a minute.");
  }

  // Find conversation & check membership
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  const isParticipant = conversation.participants.some((p) => p.userId === currentUser.id);
  if (!isParticipant) {
    throw new Error("Unauthorized: You cannot post to this conversation.");
  }

  // Prevent sending to suspended conversations
  if (conversation.isSuspended) {
    throw new Error("This conversation is currently suspended by an administrator.");
  }

  // Ensure content exists
  if (!messageText.trim() && !attachmentUrl) {
    throw new Error("Message content or attachment is required.");
  }

  const now = new Date();

  // Create message and update conversation timestamps in a transaction
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId: currentUser.id,
        message: messageText,
        messageType,
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        attachmentSize: attachmentSize || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
        reactions: true,
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: now,
        updatedAt: now,
      },
    }),
    // Auto mark as read for the sender
    prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUser.id,
        },
      },
      data: {
        lastReadAt: now,
      },
    }),
  ]);

  // Notifications logic for other participants
  const otherParticipants = conversation.participants.filter((p) => p.userId !== currentUser.id);

  for (const part of otherParticipants) {
    const isOnline = isUserOnline(part.user.lastActiveAt);

    // If participant is offline, trigger notifications
    if (!isOnline) {
      // Map ConversationType to NotificationType
      let notifType: NotificationType = NotificationType.NEW_MESSAGE;
      let title = "New Message";
      let linkPath = `/account/messages?id=${conversationId}`;

      if (conversation.type === ConversationType.ADMIN_SUPPORT) {
        notifType = NotificationType.NEW_SUPPORT_MESSAGE;
        title = "Support Message Received";
        linkPath = part.user.role === Role.ADMIN ? `/admin/messages?id=${conversationId}` : `/account/messages?id=${conversationId}`;
      } else if (conversation.type === ConversationType.B2B_RFQ) {
        notifType = NotificationType.RFQ_CHAT_MESSAGE;
        title = "Wholesale Negotiation Update";
        linkPath = part.user.role === Role.SELLER ? `/seller/messages?id=${conversationId}` : `/b2b/messages?id=${conversationId}`;
      } else if (conversation.type === ConversationType.ORDER_SUPPORT) {
        notifType = NotificationType.ORDER_CHAT_MESSAGE;
        title = "Order Discussion Message";
        linkPath = part.user.role === Role.SELLER ? `/seller/messages?id=${conversationId}` : `/account/messages?id=${conversationId}`;
      } else {
        // CUSTOMER_SELLER
        linkPath = part.user.role === Role.SELLER ? `/seller/messages?id=${conversationId}` : `/account/messages?id=${conversationId}`;
      }

      const emailSubject = `📩 [GarmentHub] ${title} from ${currentUser.name}`;

      // 1. Create In-App Notification
      await sendInAppNotification(
        part.userId,
        notifType,
        title,
        `You received a new ${messageType.toLowerCase()} message in your chat.`,
        linkPath
      ).catch((err) => console.error("Failed to create in-app chat notification:", err));

      // 2. Send Mock Email Notification
      await sendNotificationEmail(
        part.user.email,
        emailSubject,
        "NEW_MESSAGE_EMAIL",
        {
          recipientName: part.user.name,
          senderName: currentUser.name,
          messagePreview: messageType === MessageType.TEXT ? messageText : `[Shared ${messageType.toLowerCase()}]`,
          conversationLink: `http://localhost:3000${linkPath}`,
        }
      ).catch((err) => console.error("Failed to send mock chat email:", err));
    }
  }

  return message;
}

// ---------------------------------------------------------------------------
// 5. Edit Message
// ---------------------------------------------------------------------------
export async function editMessage(messageId: string, newMessageText: string) {
  const currentUser = await requireAuth();

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      conversation: true,
    },
  });

  if (!message) {
    throw new Error("Message not found.");
  }

  if (message.senderId !== currentUser.id) {
    throw new Error("Unauthorized: You can only edit your own messages.");
  }

  if (message.conversation.isSuspended) {
    throw new Error("This conversation is currently suspended.");
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: {
      message: newMessageText,
      isEdited: true,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
        },
      },
      reactions: true,
    },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// 6. Delete Message (Soft Delete)
// ---------------------------------------------------------------------------
export async function deleteMessage(messageId: string) {
  const currentUser = await requireAuth();

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      conversation: true,
    },
  });

  if (!message) {
    throw new Error("Message not found.");
  }

  const isAdmin = currentUser.role === Role.ADMIN;
  const isSender = message.senderId === currentUser.id;

  if (!isSender && !isAdmin) {
    throw new Error("Unauthorized: You can only delete your own messages (unless you are an administrator).");
  }

  if (message.conversation.isSuspended && !isAdmin) {
    throw new Error("This conversation is suspended.");
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: {
      message: "This message was deleted.",
      isDeleted: true,
      attachmentUrl: null,
      attachmentName: null,
      attachmentSize: null,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
        },
      },
      reactions: true,
    },
  });

  await createAuditLog("DELETE_CHAT_MESSAGE", "Message", messageId, { senderId: message.senderId }, null);

  return updated;
}

// ---------------------------------------------------------------------------
// 7. Reactions Management
// ---------------------------------------------------------------------------
export async function addReaction(messageId: string, emoji: string) {
  const currentUser = await requireAuth();

  // Find message and check access
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      conversation: {
        include: {
          participants: true,
        },
      },
    },
  });

  if (!message) {
    throw new Error("Message not found.");
  }

  const isParticipant = message.conversation.participants.some((p) => p.userId === currentUser.id);
  const isAdmin = currentUser.role === Role.ADMIN;

  if (!isParticipant && !isAdmin) {
    throw new Error("Access denied.");
  }

  if (message.conversation.isSuspended) {
    throw new Error("Conversation is suspended.");
  }

  const reaction = await prisma.messageReaction.upsert({
    where: {
      messageId_userId_emoji: {
        messageId,
        userId: currentUser.id,
        emoji,
      },
    },
    update: {},
    create: {
      messageId,
      userId: currentUser.id,
      emoji,
    },
  });

  return reaction;
}

export async function removeReaction(messageId: string, emoji: string) {
  const currentUser = await requireAuth();

  await prisma.messageReaction.delete({
    where: {
      messageId_userId_emoji: {
        messageId,
        userId: currentUser.id,
        emoji,
      },
    },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// 8. User Preferences (Pin / Archive)
// ---------------------------------------------------------------------------
export async function togglePin(conversationId: string, isPinned: boolean) {
  const currentUser = await requireAuth();

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: currentUser.id,
      },
    },
    data: {
      isPinned,
    },
  });

  return { success: true };
}

export async function toggleArchive(conversationId: string, isArchived: boolean) {
  const currentUser = await requireAuth();

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: currentUser.id,
      },
    },
    data: {
      isArchived,
    },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// 9. Read Receipts Update
// ---------------------------------------------------------------------------
export async function markAsRead(conversationId: string) {
  const currentUser = await requireAuth();

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: currentUser.id,
      },
    },
    data: {
      lastReadAt: new Date(),
    },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// 10. Moderation Operations
// ---------------------------------------------------------------------------
export async function reportConversation(conversationId: string, reason: string) {
  const currentUser = await requireAuth();

  if (!reason.trim()) {
    throw new Error("A reason must be provided to report this conversation.");
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      isReported: true,
      reportedReason: reason,
      reportedById: currentUser.id,
    },
  });

  // Notify all Admins in the background
  prisma.user.findMany({
    where: { role: Role.ADMIN },
  }).then(async (admins) => {
    for (const admin of admins) {
      await sendInAppNotification(
        admin.id,
        NotificationType.SUSPICIOUS_KYC, // Reusing alert type or standard
        "Chat Conversation Reported",
        `A chat has been reported by a participant. Reason: "${reason}"`,
        `/admin/messages?id=${conversationId}`
      ).catch(err => console.error(err));
    }
  }).catch(err => console.error(err));

  return { success: true };
}

export async function moderateConversation(
  conversationId: string,
  action: "SUSPEND" | "UNSUSPEND",
  reason?: string
) {
  const currentUser = await requireAuth();
  if (currentUser.role !== Role.ADMIN) {
    throw new Error("Access denied: Administrator privileges required.");
  }

  const isSuspended = action === "SUSPEND";

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      isSuspended,
      suspendedReason: isSuspended ? reason || "Suspended by admin moderation" : null,
    },
  });

  await createAuditLog("MODERATE_CHAT_CONVERSATION", "Conversation", conversationId, null, { action, reason });

  // Revalidate path for UI state refresh
  revalidatePath("/admin/messages");

  return { success: true };
}

// Typing indicators status ping
export async function updateTypingStatus(conversationId: string, isTyping: boolean) {
  const currentUser = await requireAuth();

  if (isTyping) {
    await prisma.conversationTyping.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUser.id,
        },
      },
      update: {
        updatedAt: new Date(),
      },
      create: {
        conversationId,
        userId: currentUser.id,
      },
    });
  } else {
    // Delete typing record on focus out/stop typing
    await prisma.conversationTyping.delete({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUser.id,
        },
      },
    }).catch(() => {}); // Catch if already removed or not found
  }

  return { success: true };
}
