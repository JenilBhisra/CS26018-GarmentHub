"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { OrderStatus, ShipmentStatus, NotificationType, PaymentStatus, ShippingStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { sendInAppNotification } from "@/actions/notifications";
import { sendNotificationEmail } from "@/lib/email";
import { handleOrderDeliveredWallet } from "@/actions/wallets";

async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function markOrderPacked(orderId: string) {
  const user = await getSessionUser();
  if (!user || (user.role !== "SELLER" && user.role !== "ADMIN")) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        seller: true,
      },
    });

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (user.role === "SELLER") {
      const sellerProfile = await prisma.sellerProfile.findUnique({
        where: { userId: user.id },
      });
      if (!sellerProfile || order.sellerId !== sellerProfile.id) {
        return { success: false, error: "Forbidden: You do not own this order." };
      }
    }

    // Update order status to PACKED
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PACKED,
      },
    });

    // Upsert Shipment record
    await prisma.shipment.upsert({
      where: { orderId: order.id },
      update: {
        shippingStatus: ShipmentStatus.PACKED,
      },
      create: {
        orderId: order.id,
        shippingStatus: ShipmentStatus.PACKED,
      },
    });

    // Send in-app notification to customer
    await sendInAppNotification(
      order.userId,
      NotificationType.ORDER_CONFIRMED,
      "Order Packed",
      `Your order #${order.orderNumber} has been packed and is ready for courier pickup.`,
      `/account/orders`
    );

    revalidatePath("/account/orders");
    revalidatePath("/seller/orders");
    revalidatePath("/admin/orders");

    return { success: true };
  } catch (error) {
    console.error("markOrderPacked error:", error);
    return { success: false, error: "Failed to mark order as packed" };
  }
}

export async function addCourierDetails(
  orderId: string,
  courierName: string,
  trackingNumber: string,
  trackingUrl?: string,
  estimatedDeliveryDate?: string
) {
  const user = await getSessionUser();
  if (!user || (user.role !== "SELLER" && user.role !== "ADMIN")) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        seller: true,
        items: true,
      },
    });

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (user.role === "SELLER") {
      const sellerProfile = await prisma.sellerProfile.findUnique({
        where: { userId: user.id },
      });
      if (!sellerProfile || order.sellerId !== sellerProfile.id) {
        return { success: false, error: "Forbidden: You do not own this order." };
      }
    }

    const estDate = estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : null;

    // Update order status to SHIPPED and record courier details on Order model
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SHIPPED,
        shippingStatus: "SHIPPED",
        shippingProvider: courierName,
        shippingTrackingNumber: trackingNumber,
      },
    });

    // Update shipment details
    await prisma.shipment.upsert({
      where: { orderId: order.id },
      update: {
        courierName,
        trackingNumber,
        trackingUrl: trackingUrl || null,
        estimatedDeliveryDate: estDate,
        shippedAt: new Date(),
        shippingStatus: ShipmentStatus.SHIPPED,
      },
      create: {
        orderId: order.id,
        courierName,
        trackingNumber,
        trackingUrl: trackingUrl || null,
        estimatedDeliveryDate: estDate,
        shippedAt: new Date(),
        shippingStatus: ShipmentStatus.SHIPPED,
      },
    });

    // Send in-app notification to customer
    await sendInAppNotification(
      order.userId,
      NotificationType.ORDER_SHIPPED,
      "Order Shipped",
      `Your order #${order.orderNumber} has been shipped via ${courierName}. Tracking Number: ${trackingNumber}`,
      `/account/orders`
    );

    // Send mock email to customer
    await sendNotificationEmail(
      order.user.email,
      `Your Order #${order.orderNumber} Has Been Shipped`,
      "CUSTOMER_ORDER_SHIPPED",
      {
        customerName: order.user.name,
        orderNumber: order.orderNumber,
        sellerStoreName: order.seller.storeName,
        courierName,
        trackingNumber,
        trackingUrl,
        estimatedDeliveryDate: estDate ? estDate.toLocaleDateString("en-IN") : "3-5 business days",
      }
    );

    revalidatePath("/account/orders");
    revalidatePath("/seller/orders");
    revalidatePath("/admin/orders");

    return { success: true };
  } catch (error) {
    console.error("addCourierDetails error:", error);
    return { success: false, error: "Failed to add courier details" };
  }
}

export async function markOrderDelivered(orderId: string) {
  const user = await getSessionUser();
  if (!user || (user.role !== "SELLER" && user.role !== "ADMIN")) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        seller: true,
      },
    });

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (user.role === "SELLER") {
      const sellerProfile = await prisma.sellerProfile.findUnique({
        where: { userId: user.id },
      });
      if (!sellerProfile || order.sellerId !== sellerProfile.id) {
        return { success: false, error: "Forbidden: You do not own this order." };
      }
    }

    // Update order status to DELIVERED, paymentStatus to PAID
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.DELIVERED,
        shippingStatus: "DELIVERED",
        paymentStatus: "PAID",
      },
    });

    // Automate wallet balance processing
    await handleOrderDeliveredWallet(orderId);

    // Update shipment details
    await prisma.shipment.upsert({
      where: { orderId: order.id },
      update: {
        deliveredAt: new Date(),
        shippingStatus: ShipmentStatus.DELIVERED,
      },
      create: {
        orderId: order.id,
        deliveredAt: new Date(),
        shippingStatus: ShipmentStatus.DELIVERED,
      },
    });

    // Update payment transaction status to PAID
    const pendingTransaction = await prisma.paymentTransaction.findFirst({
      where: { orderId: order.id, status: "PENDING" },
    });

    if (pendingTransaction) {
      await prisma.paymentTransaction.update({
        where: { id: pendingTransaction.id },
        data: {
          status: "PAID",
          gatewayResponse: {
            message: "Payment collected and verified upon delivery.",
            updatedAt: new Date().toISOString(),
          },
        },
      });
    }

    // Send in-app notification to customer
    await sendInAppNotification(
      order.userId,
      NotificationType.ORDER_DELIVERED,
      "Order Delivered",
      `Your order #${order.orderNumber} has been successfully delivered.`,
      `/account/orders`
    );

    // Send mock email to customer
    await sendNotificationEmail(
      order.user.email,
      `Your Order #${order.orderNumber} Delivered`,
      "CUSTOMER_ORDER_DELIVERED",
      {
        customerName: order.user.name,
        orderNumber: order.orderNumber,
        sellerStoreName: order.seller.storeName,
      }
    );

    revalidatePath("/account/orders");
    revalidatePath("/seller/orders");
    revalidatePath("/admin/orders");

    return { success: true };
  } catch (error) {
    console.error("markOrderDelivered error:", error);
    return { success: false, error: "Failed to mark order as delivered" };
  }
}

export async function updateShipmentAdmin(
  orderId: string,
  data: {
    courierName?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    estimatedDeliveryDate?: string;
    shippingStatus?: ShipmentStatus;
  }
) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized. Admin access required." };
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        seller: true,
        shipment: true,
      },
    });

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    const estDate = data.estimatedDeliveryDate ? new Date(data.estimatedDeliveryDate) : undefined;

    const updatedShipment = await prisma.shipment.upsert({
      where: { orderId },
      update: {
        courierName: data.courierName,
        trackingNumber: data.trackingNumber,
        trackingUrl: data.trackingUrl,
        estimatedDeliveryDate: estDate,
        shippingStatus: data.shippingStatus,
        shippedAt: data.shippingStatus === "SHIPPED" ? new Date() : undefined,
        deliveredAt: data.shippingStatus === "DELIVERED" ? new Date() : undefined,
      },
      create: {
        orderId,
        courierName: data.courierName || null,
        trackingNumber: data.trackingNumber || null,
        trackingUrl: data.trackingUrl || null,
        estimatedDeliveryDate: estDate || null,
        shippingStatus: data.shippingStatus || "PENDING",
        shippedAt: data.shippingStatus === "SHIPPED" ? new Date() : null,
        deliveredAt: data.shippingStatus === "DELIVERED" ? new Date() : null,
      },
    });

    const orderUpdateData: {
      status?: OrderStatus;
      shippingStatus?: ShippingStatus;
      paymentStatus?: PaymentStatus;
      shippingProvider?: string;
      shippingTrackingNumber?: string;
    } = {};

    if (data.shippingStatus) {
      if (data.shippingStatus === ShipmentStatus.DELIVERED) {
        orderUpdateData.status = OrderStatus.DELIVERED;
        orderUpdateData.shippingStatus = "DELIVERED";
        orderUpdateData.paymentStatus = "PAID";
      } else if (data.shippingStatus === ShipmentStatus.SHIPPED) {
        orderUpdateData.status = OrderStatus.SHIPPED;
        orderUpdateData.shippingStatus = "SHIPPED";
      } else if (data.shippingStatus === ShipmentStatus.PACKED) {
        orderUpdateData.status = OrderStatus.PACKED;
      } else if (data.shippingStatus === ShipmentStatus.CANCELLED) {
        orderUpdateData.status = OrderStatus.CANCELLED;
      }
    }

    if (data.courierName) orderUpdateData.shippingProvider = data.courierName;
    if (data.trackingNumber) orderUpdateData.shippingTrackingNumber = data.trackingNumber;

    if (Object.keys(orderUpdateData).length > 0) {
      await prisma.order.update({
        where: { id: orderId },
        data: orderUpdateData,
      });

      if (orderUpdateData.status === OrderStatus.DELIVERED) {
        await handleOrderDeliveredWallet(orderId);
      }
    }

    if (data.shippingStatus) {
      let notifType: NotificationType | null = null;
      let title = "";
      let message = "";

      if (data.shippingStatus === ShipmentStatus.DELIVERED) {
        notifType = NotificationType.ORDER_DELIVERED;
        title = "Order Delivered";
        message = `Your order #${order.orderNumber} has been delivered.`;
      } else if (data.shippingStatus === ShipmentStatus.SHIPPED) {
        notifType = NotificationType.ORDER_SHIPPED;
        title = "Order Shipped";
        message = `Your order #${order.orderNumber} has been shipped via ${data.courierName || order.shipment?.courierName || "courier"}.`;
      }

      if (notifType) {
        await sendInAppNotification(
          order.userId,
          notifType,
          title,
          message,
          `/account/orders`
        );
      }
    }

    revalidatePath("/account/orders");
    revalidatePath("/seller/orders");
    revalidatePath("/admin/orders");

    return { success: true, shipment: updatedShipment };
  } catch (error) {
    console.error("updateShipmentAdmin error:", error);
    return { success: false, error: "Failed to update shipment" };
  }
}
