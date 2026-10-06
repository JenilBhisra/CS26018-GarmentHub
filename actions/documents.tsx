"use server";

import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import bwipjs from "bwip-js/node";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Prisma } from "@prisma/client";
import { requireSellerProfileOrThrow } from "@/lib/seller-context";

type OrderForDocument = Prisma.OrderGetPayload<{
  include: { items: true; seller: true; shipment: true; user: true };
}>;

async function fetchOwnedOrders(orderIds: string[], sellerId: string): Promise<OrderForDocument[]> {
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: { items: true, seller: true, shipment: true, user: true },
  });
  if (orders.length !== orderIds.length) {
    throw new Error("One or more orders could not be found.");
  }
  for (const order of orders) {
    if (order.sellerId !== sellerId) {
      throw new Error(`Order #${order.orderNumber} does not belong to you.`);
    }
  }
  return orders;
}

async function barcodeDataUri(text: string): Promise<string> {
  const png = await bwipjs.toBuffer({ bcid: "code128", text, scale: 2, height: 10, includetext: false });
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function qrDataUri(text: string): Promise<string> {
  const png = await bwipjs.toBuffer({ bcid: "qrcode", text, scale: 3 });
  return `data:image/png;base64,${png.toString("base64")}`;
}

function itemProductName(productSnapshot: unknown): string {
  if (productSnapshot && typeof productSnapshot === "object" && "name" in productSnapshot) {
    return String((productSnapshot as { name?: unknown }).name ?? "");
  }
  return "";
}

function itemSku(variantSnapshot: unknown): string {
  if (variantSnapshot && typeof variantSnapshot === "object" && "sku" in variantSnapshot) {
    return String((variantSnapshot as { sku?: unknown }).sku ?? "");
  }
  return "";
}

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: "Helvetica" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  section: { marginBottom: 10, borderBottom: 1, borderColor: "#ccc", paddingBottom: 8 },
  label: { color: "#666", fontSize: 8 },
  bold: { fontWeight: 700 },
  h1: { fontSize: 13, fontWeight: 700, marginBottom: 4 },
  barcode: { width: 180, height: 40 },
  qr: { width: 60, height: 60 },
  table: { marginTop: 6 },
  tableHeader: { flexDirection: "row", borderBottom: 1, borderColor: "#000", paddingBottom: 3, marginBottom: 3 },
  tableRow: { flexDirection: "row", paddingVertical: 2, borderBottom: 0.5, borderColor: "#ddd" },
  colProduct: { width: "34%" },
  colSku: { width: "18%" },
  colHsn: { width: "10%" },
  colQty: { width: "8%", textAlign: "right" },
  colAmt: { width: "15%", textAlign: "right" },
  colGst: { width: "15%", textAlign: "right" },
  notice: { marginTop: 10, fontSize: 7, color: "#888" },
});

interface LabelPageProps {
  order: OrderForDocument;
  awbBarcode: string;
  qr: string;
}

function LabelInvoicePage({ order, awbBarcode, qr }: LabelPageProps) {
  const gstRatePercent = 5; // Fallback used only when a line item has no product-level GST rate configured.

  const lines = order.items.map((item) => {
    const gross = Number(item.price) * item.quantity;
    // Rate resolution happens where product data is joined in generateShippingLabelPdfBuffer;
    // this component receives pre-resolved rates via the item's variantSnapshot for HSN/rate.
    const rate =
      item.variantSnapshot && typeof item.variantSnapshot === "object" && "gstRate" in item.variantSnapshot
        ? Number((item.variantSnapshot as { gstRate?: unknown }).gstRate ?? gstRatePercent)
        : gstRatePercent;
    const hsn =
      item.variantSnapshot && typeof item.variantSnapshot === "object" && "hsnCode" in item.variantSnapshot
        ? String((item.variantSnapshot as { hsnCode?: unknown }).hsnCode ?? "")
        : "";
    const taxable = gross / (1 + rate / 100);
    const gst = gross - taxable;

    return {
      name: itemProductName(item.productSnapshot),
      sku: itemSku(item.variantSnapshot),
      hsn,
      qty: item.quantity,
      gross,
      taxable,
      gst,
      rate,
    };
  });

  const grossTotal = lines.reduce((sum, l) => sum + l.gross, 0);
  const taxableTotal = lines.reduce((sum, l) => sum + l.taxable, 0);
  const gstTotal = lines.reduce((sum, l) => sum + l.gst, 0);

  return (
    <Page size="A5" style={styles.page}>
      <View style={styles.section}>
        <View style={styles.row}>
          <View>
            <Text style={styles.h1}>{order.seller.storeName}</Text>
            <Text style={styles.label}>Order #{order.orderNumber}</Text>
            <Text style={styles.label}>AWB: {order.shippingTrackingNumber || "Pending"}</Text>
            <Text style={styles.label}>Courier: {order.shippingProvider || "Pending"}</Text>
          </View>
          <Image src={qr} style={styles.qr} />
        </View>
        {order.shippingTrackingNumber && <Image src={awbBarcode} style={styles.barcode} />}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Shipping Address</Text>
        <Text style={styles.bold}>{order.user.name}</Text>
        <Text>{order.shippingAddress}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Sold By</Text>
        <Text style={styles.bold}>{order.seller.storeName}</Text>
        <Text>{order.seller.pickupAddress}</Text>
        {order.seller.GSTIN && <Text>GSTIN: {order.seller.GSTIN}</Text>}
      </View>

      <View style={styles.table}>
        <Text style={[styles.bold, { marginBottom: 4 }]}>Tax Invoice</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.colProduct, styles.bold]}>Product</Text>
          <Text style={[styles.colSku, styles.bold]}>SKU</Text>
          <Text style={[styles.colHsn, styles.bold]}>HSN</Text>
          <Text style={[styles.colQty, styles.bold]}>Qty</Text>
          <Text style={[styles.colAmt, styles.bold]}>Taxable</Text>
          <Text style={[styles.colGst, styles.bold]}>GST</Text>
        </View>
        {lines.map((line, idx) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={styles.colProduct}>{line.name}</Text>
            <Text style={styles.colSku}>{line.sku}</Text>
            <Text style={styles.colHsn}>{line.hsn || "-"}</Text>
            <Text style={styles.colQty}>{line.qty}</Text>
            <Text style={styles.colAmt}>Rs. {line.taxable.toFixed(2)}</Text>
            <Text style={styles.colGst}>Rs. {line.gst.toFixed(2)} ({line.rate}%)</Text>
          </View>
        ))}
        <View style={[styles.row, { marginTop: 6 }]}>
          <Text style={styles.bold}>Total</Text>
          <Text style={styles.bold}>Rs. {grossTotal.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Taxable Value</Text>
          <Text style={styles.label}>Rs. {taxableTotal.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>GST</Text>
          <Text style={styles.label}>Rs. {gstTotal.toFixed(2)}</Text>
        </View>
      </View>

      <Text style={styles.notice}>
        GST values shown are estimated from configured product tax rates and are not a substitute for official
        accounting records. Please verify with your accountant before filing.
      </Text>
    </Page>
  );
}

async function buildOrderPageData(order: OrderForDocument): Promise<OrderForDocument> {
  // Attach hsnCode/gstRate onto each item's variantSnapshot so LabelInvoicePage can read
  // them without a second product lookup per render — resolved once, up front.
  const variantIds = order.items.map((i) => i.variantId).filter((id): id is string => !!id);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: { select: { hsnCode: true, gstRate: true } } },
  });
  const byVariantId = new Map(variants.map((v) => [v.id, v.product]));

  return {
    ...order,
    items: order.items.map((item) => {
      const product = item.variantId ? byVariantId.get(item.variantId) : undefined;
      const snapshot =
        item.variantSnapshot && typeof item.variantSnapshot === "object" ? item.variantSnapshot : {};
      return {
        ...item,
        variantSnapshot: {
          ...(snapshot as Record<string, unknown>),
          hsnCode: product?.hsnCode ?? null,
          gstRate: product?.gstRate ?? null,
        },
      };
    }),
  };
}

export async function generateShippingLabelPdfBuffer(orderId: string): Promise<Buffer> {
  const seller = await requireSellerProfileOrThrow();
  const [order] = await fetchOwnedOrders([orderId], seller.id);
  const enriched = await buildOrderPageData(order);

  const awbBarcode = await barcodeDataUri(order.shippingTrackingNumber || order.orderNumber);
  const qr = await qrDataUri(order.orderNumber);

  return renderToBuffer(
    <Document>
      <LabelInvoicePage order={enriched} awbBarcode={awbBarcode} qr={qr} />
    </Document>
  );
}

export async function generateBulkShippingLabelsPdfBuffer(orderIds: string[]): Promise<Buffer> {
  const seller = await requireSellerProfileOrThrow();
  const orders = await fetchOwnedOrders(orderIds, seller.id);

  const pages = await Promise.all(
    orders.map(async (order) => {
      const enriched = await buildOrderPageData(order);
      const awbBarcode = await barcodeDataUri(order.shippingTrackingNumber || order.orderNumber);
      const qr = await qrDataUri(order.orderNumber);
      return { enriched, awbBarcode, qr };
    })
  );

  return renderToBuffer(
    <Document>
      {pages.map(({ enriched, awbBarcode, qr }) => (
        <LabelInvoicePage key={enriched.id} order={enriched} awbBarcode={awbBarcode} qr={qr} />
      ))}
    </Document>
  );
}

/**
 * The Shipping List: which product, how many units, across the selected orders —
 * reuses the same xlsx (SheetJS) pattern already proven in app/api/export/route.ts
 * rather than introducing a second export mechanism.
 */
export async function generateShippingListBuffer(orderIds: string[]): Promise<Buffer> {
  const seller = await requireSellerProfileOrThrow();
  const orders = await fetchOwnedOrders(orderIds, seller.id);

  const rows = orders.flatMap((order) =>
    order.items.map((item) => ({
      "Order #": order.orderNumber,
      SKU: itemSku(item.variantSnapshot),
      Product: itemProductName(item.productSnapshot),
      Quantity: item.quantity,
      "Pack Log": order.packLogId ?? "",
    }))
  );

  const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Notice: "No items in selected orders." }]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Shipping List");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
