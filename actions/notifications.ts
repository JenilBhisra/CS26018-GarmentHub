"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * Creates an in-app notification for a user.
 */
export async function sendInAppNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link: link || null,
        isRead: false,
      },
    });

    revalidatePath("/account/notifications");
    return { success: true, notification };
  } catch (error: unknown) {
    console.error("sendInAppNotification error:", error);
    return { success: false, error: "Failed to create in-app notification." };
  }
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationRead(notificationId: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Ownership check
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false, error: "Notification not found." };
    }

    if (notification.userId !== session.user.id) {
      return { success: false, error: "Forbidden: Not your notification." };
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    revalidatePath("/account/notifications");
    return { success: true };
  } catch (error) {
    console.error("markNotificationRead error:", error);
    return { success: false, error: "Failed to mark notification as read." };
  }
}

/**
 * Marks all notifications of the logged-in user as read.
 */
export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    revalidatePath("/account/notifications");
    return { success: true };
  } catch (error) {
    console.error("markAllNotificationsRead error:", error);
    return { success: false, error: "Failed to mark all as read." };
  }
}

/**
 * Retrieves paginated notifications for the current user.
 */
export async function getNotifications(page = 1, limit = 10) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized", notifications: [], total: 0, unreadCount: 0 };
  }

  try {
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: session.user.id },
      }),
      prisma.notification.count({
        where: { userId: session.user.id, isRead: false },
      }),
    ]);

    return {
      success: true,
      notifications,
      total,
      unreadCount,
    };
  } catch (error) {
    console.error("getNotifications error:", error);
    return {
      success: false,
      error: "Failed to fetch notifications.",
      notifications: [],
      total: 0,
      unreadCount: 0,
    };
  }
}
