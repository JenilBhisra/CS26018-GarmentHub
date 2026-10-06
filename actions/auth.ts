"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth, signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { rateLimit } from "@/lib/rate-limit";
import { createAuditLog } from "@/actions/audit";
import { getDefaultCommissionRate } from "@/actions/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RegisterResult =
  | { success: true; message: string }
  | { success: false; error: string };

export type LoginResult =
  | { success: true }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export async function registerUser(formData: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: "CUSTOMER" | "SELLER" | "B2B_VENDOR";
}): Promise<RegisterResult> {
  try {
    const limit = await rateLimit("register");
    if (!limit.success) {
      return { success: false, error: "Too many registration attempts. Please try again in 15 minutes." };
    }

    const { name, email, phone, password, role } = formData;

    // Validate role — admins cannot self-register
    const allowedRoles: Role[] = ["CUSTOMER", "SELLER", "B2B_VENDOR"];
    if (!allowedRoles.includes(role as Role)) {
      return { success: false, error: "Invalid role selected." };
    }

    // Check for existing email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "An account with this email already exists." };
    }

    // Check for existing phone (if provided)
    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        return { success: false, error: "An account with this phone number already exists." };
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || undefined,
        passwordHash,
        role: role as Role,
      },
    });

    // If SELLER, create a pending SellerProfile scaffold. Business name and
    // pickup address are completed afterward at /seller/register.
    if (role === "SELLER") {
      const commissionRate = await getDefaultCommissionRate();
      await prisma.sellerProfile.create({
        data: {
          userId: user.id,
          storeName: `${name}'s Store`,
          storeSlug: `store-${user.id.substring(0, 8)}`,
          pickupAddress: "",
          approvalStatus: "PENDING",
          commissionRate,
        },
      });
    }

    // If B2B_VENDOR, create a pending B2BProfile scaffold
    if (role === "B2B_VENDOR") {
      await prisma.b2BProfile.create({
        data: {
          userId: user.id,
          companyName: `${name}'s Company`,
          companySlug: `b2b-${user.id.substring(0, 8)}`,
          address: "", // To be completed during B2B onboarding
          approvalStatus: "PENDING",
        },
      });
    }

    await createAuditLog("REGISTER_USER", "User", user.id, null, { name: user.name, email: user.email, role: user.role });

    return { success: true, message: "Account created successfully. Please log in." };
  } catch (error) {
    console.error("Registration error:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Complete seller profile (business name + pickup address)
// ---------------------------------------------------------------------------
// registerUser() creates a minimal SellerProfile scaffold with a blank
// pickupAddress. This is the (previously missing) step that actually
// completes it. GST/PAN/Aadhaar/bank details are collected separately via
// the seller KYC flow (/seller/kyc) — not duplicated here.

export async function completeSellerProfile(formData: {
  storeName: string;
  pickupAddress: string;
}): Promise<RegisterResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { success: false, error: "Unauthorized." };
  }

  const storeName = formData.storeName.trim();
  const pickupAddress = formData.pickupAddress.trim();

  if (!storeName || !pickupAddress) {
    return { success: false, error: "Business name and pickup address are required." };
  }

  const existing = await prisma.sellerProfile.findUnique({ where: { userId: session.user.id } });

  if (existing) {
    await prisma.sellerProfile.update({
      where: { id: existing.id },
      data: { storeName, pickupAddress },
    });
  } else {
    const slugBase = storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
    let storeSlug = slugBase || `store-${session.user.id.substring(0, 8)}`;
    let suffix = 0;
    while (await prisma.sellerProfile.findUnique({ where: { storeSlug } })) {
      suffix += 1;
      storeSlug = `${slugBase}-${suffix}`;
    }

    await prisma.sellerProfile.create({
      data: {
        userId: session.user.id,
        storeName,
        storeSlug,
        pickupAddress,
        approvalStatus: "PENDING",
      },
    });
  }

  await createAuditLog("SELLER_PROFILE_COMPLETED", "SellerProfile", session.user.id, null, { storeName });
  revalidatePath("/seller");
  redirect("/seller");
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function loginUser(formData: {
  email: string;
  password: string;
  callbackUrl?: string;
}): Promise<LoginResult> {
  try {
    const limit = await rateLimit("login");
    if (!limit.success) {
      return { success: false, error: "Too many login attempts. Please try again in 15 minutes." };
    }

    await signIn("credentials", {
      email: formData.email,
      password: formData.password,
      redirectTo: formData.callbackUrl,
      redirect: false,
    });
    
    await createAuditLog("LOGIN_SUCCESS", "User", null, null, { email: formData.email });
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof AuthError && error.type === "CredentialsSignin"
      ? "Invalid email or password."
      : "Authentication failed. Please try again.";

    await createAuditLog("LOGIN_FAILED", "User", null, { email: formData.email }, { error: errorMsg });

    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { success: false, error: "Invalid email or password." };
        default:
          return { success: false, error: "Authentication failed. Please try again." };
      }
    }
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logoutUser(): Promise<void> {
  await signOut({ redirect: false });
  redirect("/");
}

// ---------------------------------------------------------------------------
// Google OAuth login
// ---------------------------------------------------------------------------

export async function loginWithGoogle(callbackUrl?: string): Promise<void> {
  await signIn("google", { redirectTo: callbackUrl ?? "/" });
}
