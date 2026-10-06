"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VendorRequestRow = {
  type: "SELLER" | "B2B_VENDOR";
  profileId: string;
  userId: string;
  ownerName: string;
  email: string;
  phone: string | null;
  businessName: string;
  role: "SELLER" | "B2B_VENDOR";
  gstin: string | null;
  pan: string | null;
  address: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  rejectedReason: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
};

export type ApprovalResult =
  | { success: true; message: string }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Guard — only ADMIN can call these actions
// ---------------------------------------------------------------------------

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin access required.");
  }
}

// ---------------------------------------------------------------------------
// getPendingVendorRequests
// Fetches ALL seller and B2B vendor accounts with their profiles.
// Admins can filter by status in the UI.
// ---------------------------------------------------------------------------

export async function getVendorRequests(
  statusFilter?: "PENDING" | "APPROVED" | "REJECTED"
): Promise<VendorRequestRow[]> {
  await requireAdmin();

  const [sellers, b2bVendors] = await Promise.all([
    prisma.sellerProfile.findMany({
      where: statusFilter ? { approvalStatus: statusFilter } : undefined,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.b2BProfile.findMany({
      where: statusFilter ? { approvalStatus: statusFilter } : undefined,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const sellerRows: VendorRequestRow[] = sellers.map((s) => ({
    type: "SELLER",
    profileId: s.id,
    userId: s.userId,
    ownerName: s.user.name,
    email: s.user.email,
    phone: s.user.phone,
    businessName: s.storeName,
    role: "SELLER",
    gstin: s.GSTIN,
    pan: s.PAN,
    address: s.pickupAddress,
    approvalStatus: s.approvalStatus,
    rejectedReason: s.rejectedReason,
    verifiedAt: s.verifiedAt,
    createdAt: s.createdAt,
  }));

  const b2bRows: VendorRequestRow[] = b2bVendors.map((b) => ({
    type: "B2B_VENDOR",
    profileId: b.id,
    userId: b.userId,
    ownerName: b.user.name,
    email: b.user.email,
    phone: b.user.phone,
    businessName: b.companyName,
    role: "B2B_VENDOR",
    gstin: b.GSTIN,
    pan: b.PAN,
    address: b.address,
    approvalStatus: b.approvalStatus,
    rejectedReason: b.rejectedReason,
    verifiedAt: b.verifiedAt,
    createdAt: b.createdAt,
  }));

  // Merge and sort by date desc
  return [...sellerRows, ...b2bRows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

// ---------------------------------------------------------------------------
// approveVendor
// ---------------------------------------------------------------------------

export async function approveVendor(
  profileId: string,
  type: "SELLER" | "B2B_VENDOR"
): Promise<ApprovalResult> {
  try {
    await requireAdmin();

    if (type === "SELLER") {
      await prisma.sellerProfile.update({
        where: { id: profileId },
        data: {
          approvalStatus: "APPROVED",
          rejectedReason: null,
          verifiedAt: new Date(),
        },
      });
    } else {
      await prisma.b2BProfile.update({
        where: { id: profileId },
        data: {
          approvalStatus: "APPROVED",
          rejectedReason: null,
          verifiedAt: new Date(),
        },
      });
    }

    revalidatePath("/admin/requests");
    return { success: true, message: "Vendor approved successfully." };
  } catch (err) {
    console.error("approveVendor error:", err);
    if (err instanceof Error && err.message.startsWith("Unauthorized")) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "Failed to approve vendor. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// rejectVendor
// ---------------------------------------------------------------------------

export async function rejectVendor(
  profileId: string,
  type: "SELLER" | "B2B_VENDOR",
  reason: string
): Promise<ApprovalResult> {
  try {
    await requireAdmin();

    if (!reason.trim()) {
      return { success: false, error: "Rejection reason is required." };
    }

    if (type === "SELLER") {
      await prisma.sellerProfile.update({
        where: { id: profileId },
        data: {
          approvalStatus: "REJECTED",
          rejectedReason: reason.trim(),
          verifiedAt: null,
        },
      });
    } else {
      await prisma.b2BProfile.update({
        where: { id: profileId },
        data: {
          approvalStatus: "REJECTED",
          rejectedReason: reason.trim(),
          verifiedAt: null,
        },
      });
    }

    revalidatePath("/admin/requests");
    return { success: true, message: "Vendor rejected." };
  } catch (err) {
    console.error("rejectVendor error:", err);
    if (err instanceof Error && err.message.startsWith("Unauthorized")) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "Failed to reject vendor. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// getVendorStats — summary counts for the admin dashboard
// ---------------------------------------------------------------------------

export async function getVendorStats() {
  await requireAdmin();

  const [
    sellerPending,
    sellerApproved,
    sellerRejected,
    b2bPending,
    b2bApproved,
    b2bRejected,
  ] = await Promise.all([
    prisma.sellerProfile.count({ where: { approvalStatus: "PENDING" } }),
    prisma.sellerProfile.count({ where: { approvalStatus: "APPROVED" } }),
    prisma.sellerProfile.count({ where: { approvalStatus: "REJECTED" } }),
    prisma.b2BProfile.count({ where: { approvalStatus: "PENDING" } }),
    prisma.b2BProfile.count({ where: { approvalStatus: "APPROVED" } }),
    prisma.b2BProfile.count({ where: { approvalStatus: "REJECTED" } }),
  ]);

  return {
    seller: { pending: sellerPending, approved: sellerApproved, rejected: sellerRejected },
    b2b: { pending: b2bPending, approved: b2bApproved, rejected: b2bRejected },
    total: {
      pending: sellerPending + b2bPending,
      approved: sellerApproved + b2bApproved,
      rejected: sellerRejected + b2bRejected,
    },
  };
}

// ---------------------------------------------------------------------------
// Platform settings — backed by the SystemSetting key/value table
// ---------------------------------------------------------------------------

const PLATFORM_SETTING_KEYS = {
  marketplaceName: "platform_marketplace_name",
  supportEmail: "platform_support_email",
  defaultCommissionPercent: "platform_default_commission_percent",
} as const;

const PLATFORM_SETTING_DEFAULTS = {
  marketplaceName: "GarmentHub",
  supportEmail: "help@garmenthub.in",
  defaultCommissionPercent: "10",
};

export type PlatformSettings = typeof PLATFORM_SETTING_DEFAULTS;

export async function getPlatformSettings(): Promise<PlatformSettings> {
  await requireAdmin();

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: Object.values(PLATFORM_SETTING_KEYS) } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  return {
    marketplaceName: byKey.get(PLATFORM_SETTING_KEYS.marketplaceName) ?? PLATFORM_SETTING_DEFAULTS.marketplaceName,
    supportEmail: byKey.get(PLATFORM_SETTING_KEYS.supportEmail) ?? PLATFORM_SETTING_DEFAULTS.supportEmail,
    defaultCommissionPercent:
      byKey.get(PLATFORM_SETTING_KEYS.defaultCommissionPercent) ?? PLATFORM_SETTING_DEFAULTS.defaultCommissionPercent,
  };
}

// Internal (no admin gate) — used by seller signup to apply the admin-configured
// default commission rate as a 0-1 fraction, e.g. "10" -> 0.10.
export async function getDefaultCommissionRate(): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: PLATFORM_SETTING_KEYS.defaultCommissionPercent },
  });
  const percent = Number(setting?.value ?? PLATFORM_SETTING_DEFAULTS.defaultCommissionPercent);
  if (Number.isNaN(percent) || percent < 0 || percent > 100) {
    return Number(PLATFORM_SETTING_DEFAULTS.defaultCommissionPercent) / 100;
  }
  return percent / 100;
}

export async function updatePlatformSettings(settings: PlatformSettings): Promise<ApprovalResult> {
  await requireAdmin();

  const marketplaceName = settings.marketplaceName.trim();
  const supportEmail = settings.supportEmail.trim();
  const defaultCommissionPercent = settings.defaultCommissionPercent.trim();

  if (!marketplaceName) {
    return { success: false, error: "Marketplace name is required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    return { success: false, error: "Enter a valid support email address." };
  }
  const commissionNum = Number(defaultCommissionPercent);
  if (Number.isNaN(commissionNum) || commissionNum < 0 || commissionNum > 100) {
    return { success: false, error: "Default commission must be a number between 0 and 100." };
  }

  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: PLATFORM_SETTING_KEYS.marketplaceName },
      update: { value: marketplaceName },
      create: { key: PLATFORM_SETTING_KEYS.marketplaceName, value: marketplaceName },
    }),
    prisma.systemSetting.upsert({
      where: { key: PLATFORM_SETTING_KEYS.supportEmail },
      update: { value: supportEmail },
      create: { key: PLATFORM_SETTING_KEYS.supportEmail, value: supportEmail },
    }),
    prisma.systemSetting.upsert({
      where: { key: PLATFORM_SETTING_KEYS.defaultCommissionPercent },
      update: { value: defaultCommissionPercent },
      create: { key: PLATFORM_SETTING_KEYS.defaultCommissionPercent, value: defaultCommissionPercent },
    }),
  ]);

  revalidatePath("/admin/settings");
  return { success: true, message: "Platform settings saved." };
}
