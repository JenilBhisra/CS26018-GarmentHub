/**
 * seller-context.ts
 *
 * Shared helper for resolving the acting seller's profile inside Server Actions.
 *
 * Seller identity is ALWAYS derived from the authenticated server session
 * (session.user.id) — never from a client-supplied sellerId. Callers must not
 * accept a sellerId parameter from the client and pass it into any of these.
 *
 * Two variants are provided to match the two error-handling conventions already
 * used across the codebase, so call sites don't need to change their control flow:
 *  - requireSellerProfile(): result-object pattern, for actions that return
 *    { success: false, error } shapes.
 *  - requireSellerProfileOrThrow(): throwing pattern, for actions that propagate
 *    errors via try/catch.
 *
 * Not usable inside a prisma.$transaction — those call sites must keep looking up
 * the seller profile via the transaction client (tx.sellerProfile.findUnique) to
 * preserve transactional consistency, and should not use this helper.
 */

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SellerProfile } from "@prisma/client";

export async function requireSellerProfile(): Promise<
  { error: string } | { seller: SellerProfile }
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { error: "Unauthorized" };
  }
  const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user.id } });
  if (!seller) {
    return { error: "Seller profile not found" };
  }
  return { seller };
}

export async function requireSellerProfileOrThrow(): Promise<SellerProfile> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    throw new Error("Unauthorized");
  }
  const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user.id } });
  if (!seller) {
    throw new Error("Seller profile not found");
  }
  return seller;
}
