"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

/**
 * Retrieves the preferences of the logged-in user.
 * Returns default layout structure if no database record exists.
 */
export async function getUserPreferences() {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const preference = await prisma.userPreference.findUnique({
      where: { userId: session.user.id },
    });

    // Default layouts and preferences if not set yet
    const defaults = {
      cardOrder: ["orders_today", "orders_pending", "kyc_pending", "payouts_pending", "refunds_pending", "disputes_open"],
      hiddenCards: [],
      collapsedWidgets: [],
      savedViews: []
    };

    if (!preference) {
      return { success: true, settings: defaults };
    }

    return { 
      success: true, 
      settings: {
        ...defaults,
        ...(preference.settings as any)
      }
    };
  } catch (error) {
    console.error("getUserPreferences error:", error);
    return { success: false, error: "Failed to load preferences." };
  }
}

/**
 * Saves or updates preferences for the logged-in user.
 */
export async function updateUserPreferences(settings: any) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const preference = await prisma.userPreference.upsert({
      where: { userId: session.user.id },
      update: { settings },
      create: {
        userId: session.user.id,
        settings,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/seller");
    return { success: true, preference };
  } catch (error) {
    console.error("updateUserPreferences error:", error);
    return { success: false, error: "Failed to save preferences." };
  }
}

/**
 * Updates the logged-in user's own name and phone number.
 * Email is intentionally not editable here — it's the login identifier.
 */
export async function updateProfile(data: { name: string; phone: string }) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const name = data.name.trim();
  const phone = data.phone.trim();

  if (!name) {
    return { success: false, error: "Name is required." };
  }
  if (phone && !/^\+?[0-9\s-]{7,15}$/.test(phone)) {
    return { success: false, error: "Enter a valid phone number." };
  }

  try {
    if (phone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone, NOT: { id: session.user.id } },
      });
      if (existingPhone) {
        return { success: false, error: "This phone number is already in use." };
      }
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { name, phone: phone || null },
    });

    revalidatePath("/account/profile");
    return { success: true };
  } catch (error) {
    console.error("updateProfile error:", error);
    return { success: false, error: "Failed to update profile." };
  }
}

/**
 * Updates the logged-in seller's public store name.
 */
export async function updateSellerStoreName(storeName: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { success: false, error: "Unauthorized" };
  }

  const name = storeName.trim();
  if (!name) {
    return { success: false, error: "Store name is required." };
  }

  try {
    const profile = await prisma.sellerProfile.findUnique({ where: { userId: session.user.id } });
    if (!profile) {
      return { success: false, error: "Seller profile not found." };
    }

    await prisma.sellerProfile.update({
      where: { id: profile.id },
      data: { storeName: name },
    });

    revalidatePath("/seller/settings");
    return { success: true };
  } catch (error) {
    console.error("updateSellerStoreName error:", error);
    return { success: false, error: "Failed to update store name." };
  }
}

export type NotificationPrefs = {
  orderUpdates: boolean;
  newMessages: boolean;
  payouts: boolean;
  marketingTips: boolean;
};

const NOTIFICATION_PREFS_DEFAULTS: NotificationPrefs = {
  orderUpdates: true,
  newMessages: true,
  payouts: true,
  marketingTips: true,
};

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const session = await auth();
  if (!session?.user) return NOTIFICATION_PREFS_DEFAULTS;

  const preference = await prisma.userPreference.findUnique({ where: { userId: session.user.id } });
  const settings = (preference?.settings as Record<string, unknown> | undefined) || {};
  const saved = settings.notificationPrefs as Partial<NotificationPrefs> | undefined;
  return { ...NOTIFICATION_PREFS_DEFAULTS, ...(saved || {}) };
}

export async function updateNotificationPrefs(prefs: NotificationPrefs) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const existing = await prisma.userPreference.findUnique({ where: { userId: session.user.id } });
    const existingSettings = (existing?.settings as Record<string, unknown> | undefined) || {};
    const settings = { ...existingSettings, notificationPrefs: prefs };

    await prisma.userPreference.upsert({
      where: { userId: session.user.id },
      update: { settings },
      create: { userId: session.user.id, settings },
    });

    revalidatePath("/seller/settings");
    return { success: true };
  } catch (error) {
    console.error("updateNotificationPrefs error:", error);
    return { success: false, error: "Failed to save notification preferences." };
  }
}
