"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  type: "ORDER" | "SELLER" | "CUSTOMER" | "PRODUCT" | "PAYOUT" | "REFUND" | "DISPUTE";
  route: string;
}

/**
 * Execute role-safe global search across all models.
 */
export async function executeGlobalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  const cleanQuery = query.trim();

  const session = await auth();
  if (!session?.user) return [];

  const role = session.user.role;
  const userId = session.user.id;

  // Resolve Seller Profile ID if seller
  let sellerProfileId: string | null = null;
  if (role === "SELLER") {
    const profile = await prisma.sellerProfile.findUnique({
      where: { userId },
    });
    if (!profile) return [];
    sellerProfileId = profile.id;
  }

  const results: SearchResult[] = [];

  try {
    if (role === "ADMIN") {
      // 1. Search Orders by orderNumber
      const orders = await prisma.order.findMany({
        where: { orderNumber: { contains: cleanQuery, mode: "insensitive" } },
        take: 5,
      });
      orders.forEach((o) => {
        results.push({
          id: o.id,
          label: `Order #${o.orderNumber}`,
          sublabel: `Status: ${o.status} | Value: ₹${o.totalAmount.toFixed(2)}`,
          type: "ORDER",
          route: `/admin/orders?search=${o.orderNumber}`,
        });
      });

      // 2. Search Sellers by storeSlug or storeName
      const sellers = await prisma.sellerProfile.findMany({
        where: {
          OR: [
            { storeName: { contains: cleanQuery, mode: "insensitive" } },
            { storeSlug: { contains: cleanQuery, mode: "insensitive" } },
          ],
        },
        take: 5,
      });
      sellers.forEach((s) => {
        results.push({
          id: s.id,
          label: s.storeName,
          sublabel: `IFSC: ${s.bankIFSC} | Status: ${s.approvalStatus}`,
          type: "SELLER",
          route: `/admin/sellers`, // or link to specific seller page
        });
      });

      // 3. Search Customers by name or email
      const customers = await prisma.user.findMany({
        where: {
          role: "CUSTOMER",
          OR: [
            { name: { contains: cleanQuery, mode: "insensitive" } },
            { email: { contains: cleanQuery, mode: "insensitive" } },
          ],
        },
        take: 5,
      });
      customers.forEach((c) => {
        results.push({
          id: c.id,
          label: c.name,
          sublabel: c.email,
          type: "CUSTOMER",
          route: `/admin/customers`,
        });
      });

      // 4. Search Products by name or slug
      const products = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: cleanQuery, mode: "insensitive" } },
            { slug: { contains: cleanQuery, mode: "insensitive" } },
          ],
        },
        take: 5,
      });
      products.forEach((p) => {
        results.push({
          id: p.id,
          label: p.name,
          sublabel: `Status: ${p.status}`,
          type: "PRODUCT",
          route: `/admin/products`,
        });
      });

      // 5. Search Payouts by UTR / Reference
      const payouts = await prisma.payoutRequest.findMany({
        where: {
          OR: [
            { reference: { contains: cleanQuery, mode: "insensitive" } },
            { bankReference: { contains: cleanQuery, mode: "insensitive" } },
          ],
        },
        include: { seller: true },
        take: 5,
      });
      payouts.forEach((p) => {
        results.push({
          id: p.id,
          label: `Payout Request (₹${p.amount.toFixed(2)})`,
          sublabel: `Store: ${p.seller.storeName} | Status: ${p.status}`,
          type: "PAYOUT",
          route: `/admin/settlements?tab=payouts&search=${p.reference}`,
        });
      });

      // 6. Search Refunds / ReturnRequests
      const returns = await prisma.returnRequest.findMany({
        where: {
          OR: [
            { reference: { contains: cleanQuery, mode: "insensitive" } },
            { reason: { contains: cleanQuery, mode: "insensitive" } },
          ],
        },
        include: { order: true },
        take: 5,
      });
      returns.forEach((r) => {
        results.push({
          id: r.id,
          label: `Refund Request #${r.order.orderNumber}`,
          sublabel: `Reason: ${r.reason} | Status: ${r.status}`,
          type: "REFUND",
          route: `/admin/settlements?tab=returns&search=${r.order.orderNumber}`,
        });
      });

      // 7. Search Disputes
      const disputes = await prisma.dispute.findMany({
        where: {
          id: { contains: cleanQuery, mode: "insensitive" },
        },
        include: { order: true },
        take: 5,
      });
      disputes.forEach((d) => {
        results.push({
          id: d.id,
          label: `Dispute on Order #${d.order?.orderNumber || d.orderId}`,
          sublabel: `Priority: ${d.priority} | Status: ${d.status}`,
          type: "DISPUTE",
          route: `/admin/disputes`,
        });
      });

    } else if (role === "SELLER" && sellerProfileId) {
      // 1. Search Own Orders by orderNumber
      const orders = await prisma.order.findMany({
        where: {
          sellerId: sellerProfileId,
          orderNumber: { contains: cleanQuery, mode: "insensitive" },
        },
        take: 5,
      });
      orders.forEach((o) => {
        results.push({
          id: o.id,
          label: `Order #${o.orderNumber}`,
          sublabel: `Status: ${o.status} | Value: ₹${o.totalAmount.toFixed(2)}`,
          type: "ORDER",
          route: `/seller/orders?search=${o.orderNumber}`,
        });
      });

      // 2. Search Own Products by name
      const products = await prisma.product.findMany({
        where: {
          sellerId: sellerProfileId,
          name: { contains: cleanQuery, mode: "insensitive" },
        },
        take: 5,
      });
      products.forEach((p) => {
        results.push({
          id: p.id,
          label: p.name,
          sublabel: `Status: ${p.status}`,
          type: "PRODUCT",
          route: `/seller/products`,
        });
      });

      // 3. Search Own Customers by name/email
      const ordersWithCustomers = await prisma.order.findMany({
        where: {
          sellerId: sellerProfileId,
          user: {
            OR: [
              { name: { contains: cleanQuery, mode: "insensitive" } },
              { email: { contains: cleanQuery, mode: "insensitive" } },
            ],
          },
        },
        include: { user: true },
        take: 5,
      });
      // Deduplicate customers
      const seen = new Set();
      ordersWithCustomers.forEach((o) => {
        if (!seen.has(o.user.id)) {
          seen.add(o.user.id);
          results.push({
            id: o.user.id,
            label: o.user.name,
            sublabel: o.user.email,
            type: "CUSTOMER",
            route: `/seller/orders?search=${o.user.name}`,
          });
        }
      });

      // 4. Search Own Refunds / ReturnRequests
      const returns = await prisma.returnRequest.findMany({
        where: {
          sellerId: sellerProfileId,
          OR: [
            { reference: { contains: cleanQuery, mode: "insensitive" } },
            { reason: { contains: cleanQuery, mode: "insensitive" } },
          ],
        },
        include: { order: true },
        take: 5,
      });
      returns.forEach((r) => {
        results.push({
          id: r.id,
          label: `Refund Request #${r.order.orderNumber}`,
          sublabel: `Reason: ${r.reason} | Status: ${r.status}`,
          type: "REFUND",
          route: `/seller/returns?search=${r.order.orderNumber}`,
        });
      });
    }

    return results;
  } catch (error) {
    console.error("executeGlobalSearch error:", error);
    return [];
  }
}
