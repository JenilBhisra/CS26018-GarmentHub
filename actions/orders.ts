"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { NotificationType } from "@prisma/client";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { sendInAppNotification } from "@/actions/notifications";
import { sendNotificationEmail } from "@/lib/email";
import { Prisma } from "@prisma/client";
import { ORDER_TAB_STATUSES } from "@/lib/order-tabs";
import { requireSellerProfile } from "@/lib/seller-context";

const Decimal = Prisma.Decimal;

/**
 * Get current user's session.
 */
async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

export interface ShippingAddressInput {
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
}

/**
 * Checkout and place orders. Splits items by seller and creates one Order per seller inside a transaction.
 */
export async function createOrders(address: ShippingAddressInput, paymentMethod: string, couponCode?: string) {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "Please sign in to place an order" };
  }

  if (!address.addressLine.trim() || !address.city.trim() || !address.state.trim() || !address.pincode.trim()) {
    return { success: false, error: "Please complete all address fields (address, city, state, and pincode)." };
  }

  const shippingAddress = `${address.addressLine.trim()}, ${address.city.trim()}, ${address.state.trim()} - ${address.pincode.trim()}`;

  try {
    // 1. Fetch current cart (with category for engine)
    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    seller: true,
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return { success: false, error: "Your bag is empty." };
    }

    // 2. Validate product status + stock before entering transaction
    for (const item of cart.items) {
      if (item.variant.product.status !== "ACTIVE") {
        return {
          success: false,
          error: `Product "${item.variant.product.name}" is no longer active for purchase. Please remove it from your bag.`,
        };
      }
      if (item.variant.stock < item.quantity) {
        return {
          success: false,
          error: `Insufficient stock for "${item.variant.product.name}" (${item.variant.size || ""}). Only ${item.variant.stock} left. Please reduce quantity or remove item.`,
        };
      }
    }

    // 3. Apply active promotions server-side (Phase 12)
    const { getActivePromotions } = await import("@/actions/promotions");
    const { applyPromotionToItem, validateAndComputeCouponDiscount } = await import("@/lib/promotions-engine");
    const activePromotions = await getActivePromotions();

    // Build cart items for engine
    const cartItemsForEngine = cart.items.map((item) => ({
      variantId: item.variantId,
      productId: item.variant.productId,
      sellerId: item.variant.product.sellerId,
      categoryId: item.variant.product.categoryId,
      sellingPrice: new Decimal(item.variant.sellingPrice.toString()).toNumber(),
      quantity: item.quantity,
    }));

    // Compute promotion-adjusted effective prices per variant
    const effectivePrices: Record<string, number> = {};
    for (const engineItem of cartItemsForEngine) {
      effectivePrices[engineItem.variantId] = applyPromotionToItem(engineItem, activePromotions);
    }

    // 4. Group by seller
    const itemsBySeller: Record<string, typeof cart.items> = {};
    for (const item of cart.items) {
      const sellerId = item.variant.product.sellerId;
      if (!itemsBySeller[sellerId]) itemsBySeller[sellerId] = [];
      itemsBySeller[sellerId].push(item);
    }

    // 5. Resolve coupon code (from param or cart)
    const resolvedCouponCode = couponCode?.trim().toUpperCase() || cart.appliedCouponCode || null;

    // 6. Server-side coupon revalidation (MUST happen before order creation)
    let couponRecord: Awaited<ReturnType<typeof prisma.coupon.findUnique>> = null;
    const couponDiscountPerSeller: Record<string, number> = {};
    let totalCouponDiscount = 0;

    if (resolvedCouponCode) {
      couponRecord = await prisma.coupon.findUnique({ where: { code: resolvedCouponCode } });

      if (!couponRecord) {
        return { success: false, error: `Coupon "${resolvedCouponCode}" is invalid.` };
      }

      // Build per-seller subtotals with promotion prices applied
      const perSellerSubtotals = Object.entries(itemsBySeller).map(([sellerId, items]) => {
        let sub = new Decimal(0);
        for (const item of items) {
          const price = new Decimal((effectivePrices[item.variantId] ?? item.variant.sellingPrice).toString());
          sub = sub.plus(price.times(new Decimal(item.quantity)));
        }
        return {
          sellerId,
          subtotal: sub.toNumber(),
        };
      });

      const userUsageCount = await prisma.couponUsage.count({
        where: { couponId: couponRecord.id, userId: user.id },
      });

      const validation = validateAndComputeCouponDiscount(
        {
          id: couponRecord.id,
          code: couponRecord.code,
          discountType: couponRecord.discountType,
          discountValue: new Decimal(couponRecord.discountValue.toString()).toNumber(),
          minimumOrderAmount: new Decimal(couponRecord.minimumOrderAmount.toString()).toNumber(),
          maximumDiscount: couponRecord.maximumDiscount ? new Decimal(couponRecord.maximumDiscount.toString()).toNumber() : null,
          sellerId: couponRecord.sellerId,
          categoryId: couponRecord.categoryId,
          productId: couponRecord.productId,
          usageLimit: couponRecord.usageLimit,
          perUserLimit: couponRecord.perUserLimit,
          usageCount: couponRecord.usageCount,
          startDate: couponRecord.startDate,
          endDate: couponRecord.endDate,
          status: couponRecord.status,
        },
        user.id,
        userUsageCount,
        perSellerSubtotals,
        cartItemsForEngine
      );

      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      totalCouponDiscount = validation.totalDiscount;
      for (const { sellerId, discount } of validation.perSellerDiscounts) {
        couponDiscountPerSeller[sellerId] = discount;
      }
    }

    const createdOrderIds: string[] = [];
    const notificationsToSend: Array<{
      userId: string;
      email: string;
      role: "CUSTOMER" | "SELLER";
      type: NotificationType;
      title: string;
      message: string;
      link: string;
      emailTemplate?: string;
      emailSubject?: string;
      emailContext?: Record<string, unknown>;
    }> = [];

    // 7. Run the entire order placement inside a database transaction
    await prisma.$transaction(async (tx) => {
      for (const [sellerId, sellerItems] of Object.entries(itemsBySeller)) {
        // Fetch seller profile to get commission rate and user info
        const sellerProfile = await tx.sellerProfile.findUnique({
          where: { id: sellerId },
          include: { user: true },
        });

        if (!sellerProfile) {
          throw new Error("Seller profile not found for some items in the cart.");
        }

        // Use promotion-adjusted prices for subtotal calculation
        let subtotal = new Decimal(0);
        for (const item of sellerItems) {
          const price = new Decimal((effectivePrices[item.variantId] ?? item.variant.sellingPrice).toString());
          subtotal = subtotal.plus(price.times(new Decimal(item.quantity)));
        }

        // Fees logic
        const platformFee = new Decimal(15);
        const shippingFee = subtotal.greaterThan(999) ? new Decimal(0) : new Decimal(49);
        const commissionAmount = subtotal.times(new Decimal(sellerProfile.commissionRate));
        const discountAmount = new Decimal(couponDiscountPerSeller[sellerId] ?? 0);
        const totalAmount = Decimal.max(0, subtotal.plus(platformFee).plus(shippingFee).minus(discountAmount));
        const orderNumber = `GH-ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // COD orders immediately become CONFIRMED
        const initialOrderStatus: OrderStatus = paymentMethod === "COD" ? "CONFIRMED" : "PENDING";

        // Create the order with discount tracking
        const order = await tx.order.create({
          data: {
            userId: user.id,
            sellerId,
            orderNumber,
            subtotal,
            shippingFee,
            platformFee,
            commissionAmount,
            discountAmount,
            totalAmount,
            couponId: couponRecord && discountAmount.greaterThan(0) ? couponRecord.id : null,
            status: initialOrderStatus,
            paymentStatus: "PENDING",
            paymentMethod,
            shippingAddress,
            shippingState: address.state.trim(),
            shippingCity: address.city.trim(),
            shippingPincode: address.pincode.trim(),
          },
        });

        createdOrderIds.push(order.id);

        // Process order items with promotion-adjusted prices
        for (const item of sellerItems) {
          // Re-verify stock inside transaction for race-conditions
          const dbVariant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
          });

          if (!dbVariant || dbVariant.stock < item.quantity) {
            throw new Error(
              `Insufficient stock for "${item.variant.product.name}" (${item.variant.size || ""}). Please update your bag.`
            );
          }

          const effectivePrice = effectivePrices[item.variantId] ?? item.variant.sellingPrice;

          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              variantId: item.variantId,
              sellerId,
              quantity: item.quantity,
              price: effectivePrice, // Store promotion-adjusted price
              productSnapshot: {
                name: item.variant.product.name,
                description: item.variant.product.description || "",
                brand: item.variant.product.brand,
                images: item.variant.product.images,
              },
              variantSnapshot: {
                size: item.variant.size || "",
                color: item.variant.color || "",
                sku: item.variant.sku || "",
              },
            },
          });

          // Decrement stock
          const updatedVariant = await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } },
          });

          // Inventory ledger — recorded in the same transaction as the stock change so
          // the two can never drift apart.
          await tx.inventoryTransaction.create({
            data: {
              variantId: item.variantId,
              sellerId,
              type: "SALE",
              quantityChange: -item.quantity,
              quantityBefore: updatedVariant.stock + item.quantity,
              quantityAfter: updatedVariant.stock,
              orderId: order.id,
              orderItemId: orderItem.id,
              reference: `orderitem:${orderItem.id}:sale`,
            },
          });

          // Track purchase count in ProductAnalytics
          await tx.productAnalytics.upsert({
            where: { productId: item.variant.productId },
            update: { purchases: { increment: item.quantity } },
            create: {
              productId: item.variant.productId,
              purchases: item.quantity,
              views: 0,
              wishlistCount: 0,
              cartAdds: 0,
            },
          });
        }

        // Create Commission record
        await tx.commission.create({
          data: {
            orderId: order.id,
            sellerId,
            rate: sellerProfile.commissionRate,
            amount: commissionAmount,
          },
        });

        // Initialize Shipment record
        await tx.shipment.create({
          data: {
            orderId: order.id,
            shippingStatus: "PENDING",
          },
        });

        // Record PaymentTransaction
        await tx.paymentTransaction.create({
          data: {
            orderId: order.id,
            customerId: user.id,
            paymentProvider: paymentMethod,
            paymentMethod,
            amount: totalAmount,
            currency: "INR",
            status: "PENDING",
            gatewayResponse: { message: `Order placed via ${paymentMethod}. Payment pending collection.` },
          },
        });

        // Record CouponUsage — only after successful order creation
        if (couponRecord && discountAmount.greaterThan(0)) {
          await tx.couponUsage.create({
            data: {
              couponId: couponRecord.id,
              orderId: order.id,
              userId: user.id,
              discount: discountAmount,
            },
          });
          // Increment global usage count
          await tx.coupon.update({
            where: { id: couponRecord.id },
            data: { usageCount: { increment: 1 } },
          });
        }

        // Prepare notifications
        notificationsToSend.push({
          userId: user.id,
          email: user.email!,
          role: "CUSTOMER",
          type: NotificationType.ORDER_PLACED,
          title: "Order Placed Successfully",
          message: `Your order #${orderNumber} for ₹${totalAmount.toFixed(2)} has been placed.`,
          link: "/account/orders",
          emailTemplate: "CUSTOMER_ORDER_PLACED",
          emailSubject: `Your Order #${orderNumber} Has Been Placed`,
          emailContext: {
            customerName: user.name || "Customer",
            orderNumber,
            itemCount: sellerItems.length,
            sellerStoreName: sellerProfile.storeName,
            totalAmount,
            paymentMethod,
          },
        });

        notificationsToSend.push({
          userId: sellerProfile.userId,
          email: sellerProfile.user.email,
          role: "SELLER",
          type: NotificationType.ORDER_PLACED,
          title: "New Order Received",
          message: `You have received a new order #${orderNumber} for ₹${subtotal}.`,
          link: "/seller/orders",
          emailTemplate: "SELLER_NEW_ORDER",
          emailSubject: `New Order Received #${orderNumber}`,
          emailContext: {
            sellerName: sellerProfile.user.name || "Seller",
            orderNumber,
            storeName: sellerProfile.storeName,
            subtotal,
          },
        });
      }

      // Clear Cart items and reset coupon
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({
        where: { id: cart.id },
        data: { appliedCouponCode: null },
      });
    });

    // Send notifications outside of the transaction scope
    for (const notif of notificationsToSend) {
      sendInAppNotification(notif.userId, notif.type, notif.title, notif.message, notif.link).catch((err) => {
        console.error("Failed to send checkout in-app notification:", err);
      });

      if (notif.email && notif.emailTemplate && notif.emailContext) {
        sendNotificationEmail(notif.email, notif.emailSubject || "", notif.emailTemplate, notif.emailContext).catch((err) => {
          console.error("Failed to send checkout mock email:", err);
        });
      }
    }

    revalidatePath("/cart");
    revalidatePath("/account/orders");
    revalidatePath("/seller/orders");
    revalidatePath("/admin/orders");

    return { success: true, orderIds: createdOrderIds, totalCouponDiscount };
  } catch (error: unknown) {
    console.error("createOrders transaction error:", error);
    const msg = error instanceof Error ? error.message : "Failed to place your orders. Please try again.";
    return { success: false, error: msg };
  }
}

/**
 * Customer fetches their own order history.
 */
export async function getCustomerOrders() {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "Please sign in to view orders" };
  }

  try {
    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            review: true,
            variant: true,
          },
        },
        seller: true,
        shipment: true,
        paymentTransactions: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, orders };
  } catch (error) {
    console.error("getCustomerOrders error:", error);
    return { success: false, error: "Failed to fetch orders" };
  }
}

export interface OrderQueryOptions {
  tab?: keyof typeof ORDER_TAB_STATUSES; // omit for "All Orders"
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Seller fetches orders containing their products, filtered by tab and paginated server-side.
 */
export async function getSellerOrders(opts: OrderQueryOptions = {}) {
  const ctx = await requireSellerProfile();
  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }

  try {
    const sellerProfile = ctx.seller;

    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));

    const where: Prisma.OrderWhereInput = {
      sellerId: sellerProfile.id,
    };

    if (opts.tab && ORDER_TAB_STATUSES[opts.tab]) {
      where.status = { in: ORDER_TAB_STATUSES[opts.tab] };
    }

    if (opts.searchQuery) {
      where.OR = [
        { orderNumber: { contains: opts.searchQuery, mode: "insensitive" } },
        { user: { name: { contains: opts.searchQuery, mode: "insensitive" } } },
        { user: { email: { contains: opts.searchQuery, mode: "insensitive" } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          user: true,
          shipment: true,
          paymentTransactions: true,
          packLog: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return { success: true, orders, total, page, pageSize };
  } catch (error) {
    console.error("getSellerOrders error:", error);
    return { success: false, error: "Failed to fetch seller orders" };
  }
}

/**
 * Admin fetches all orders in the system, filtered by tab and paginated server-side.
 */
export async function getAllOrders(opts: OrderQueryOptions = {}) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized access" };
  }

  try {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));

    const where: Prisma.OrderWhereInput = {};

    if (opts.tab && ORDER_TAB_STATUSES[opts.tab]) {
      where.status = { in: ORDER_TAB_STATUSES[opts.tab] };
    }

    if (opts.searchQuery) {
      where.OR = [
        { orderNumber: { contains: opts.searchQuery, mode: "insensitive" } },
        { user: { name: { contains: opts.searchQuery, mode: "insensitive" } } },
        { user: { email: { contains: opts.searchQuery, mode: "insensitive" } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          user: true,
          seller: true,
          shipment: true,
          paymentTransactions: true,
          packLog: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return { success: true, orders, total, page, pageSize };
  } catch (error) {
    console.error("getAllOrders error:", error);
    return { success: false, error: "Failed to fetch admin orders" };
  }
}

/**
 * Per-tab order counts for the seller Orders page (e.g. "New (16)").
 */
export async function getSellerOrderTabCounts() {
  const ctx = await requireSellerProfile();
  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }
  const sellerProfile = ctx.seller;

  const [newCount, packedCount, readyCount, cancelledCount, allCount] = await Promise.all([
    prisma.order.count({ where: { sellerId: sellerProfile.id, status: { in: ORDER_TAB_STATUSES.new } } }),
    prisma.order.count({ where: { sellerId: sellerProfile.id, status: { in: ORDER_TAB_STATUSES.packed } } }),
    prisma.order.count({ where: { sellerId: sellerProfile.id, status: { in: ORDER_TAB_STATUSES.ready_to_ship } } }),
    prisma.order.count({ where: { sellerId: sellerProfile.id, status: { in: ORDER_TAB_STATUSES.cancelled } } }),
    prisma.order.count({ where: { sellerId: sellerProfile.id } }),
  ]);

  return {
    success: true,
    counts: { new: newCount, packed: packedCount, ready_to_ship: readyCount, cancelled: cancelledCount, all: allCount },
  };
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  paymentStatus?: PaymentStatus
) {
  const user = await getSessionUser();
  if (!user || (user.role !== "SELLER" && user.role !== "ADMIN")) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { seller: true, items: true },
      });

      if (!order) {
        throw new Error("Order not found");
      }

      // Role-based auth check
      if (user.role === "SELLER") {
        const sellerProfile = await tx.sellerProfile.findUnique({
          where: { userId: user.id },
        });
        if (!sellerProfile || order.sellerId !== sellerProfile.id) {
          throw new Error("Forbidden: You do not own this order.");
        }
      }

      const oldStatus = order.status;

      const updatedData: { status: OrderStatus; paymentStatus?: PaymentStatus } = { status };
      if (paymentStatus) {
        updatedData.paymentStatus = paymentStatus;
      }

      await tx.order.update({
        where: { id: orderId },
        data: updatedData,
      });

      // Stock restoration if order is CANCELLED (only if it wasn't cancelled already)
      if (status === "CANCELLED" && oldStatus !== "CANCELLED") {
        for (const item of order.items) {
          if (item.variantId) {
            const updatedVariant = await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            });

            await tx.inventoryTransaction.create({
              data: {
                variantId: item.variantId,
                sellerId: order.sellerId,
                type: "CANCELLATION",
                quantityChange: item.quantity,
                quantityBefore: updatedVariant.stock - item.quantity,
                quantityAfter: updatedVariant.stock,
                orderId: order.id,
                orderItemId: item.id,
                reference: `orderitem:${item.id}:cancellation`,
              },
            });
          }
        }
      }

      return {
        success: true,
        triggerEarning: status === "DELIVERED" && oldStatus !== "DELIVERED",
      };
    });

    if (result.success && result.triggerEarning) {
      const { handleOrderDeliveredWallet } = await import("@/actions/wallets");
      await handleOrderDeliveredWallet(orderId);
    }

    revalidatePath("/account/orders");
    revalidatePath("/seller/orders");
    revalidatePath("/admin/orders");

    return { success: true };
  } catch (error: any) {
    console.error("updateOrderStatus error:", error);
    return { success: false, error: error.message || "Failed to update order status" };
  }
}
