import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  generateShippingLabelPdfBuffer,
  generateBulkShippingLabelsPdfBuffer,
  generateShippingListBuffer,
} from "@/actions/documents";

export const dynamic = "force-dynamic";

/**
 * Streams the "Download Documents" bundle for a set of orders: either a combined
 * shipping-label + tax-invoice PDF (?type=labels) or a shipping list (?type=list).
 * Generated on demand and never persisted to disk — ownership/auth is enforced inside
 * the generator functions themselves (they re-derive the seller from the session).
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "labels";
  const orderIdsParam = searchParams.get("orderIds") || "";
  const orderIds = orderIdsParam.split(",").map((s) => s.trim()).filter(Boolean);

  if (orderIds.length === 0) {
    return NextResponse.json({ error: "No orders selected." }, { status: 400 });
  }

  try {
    if (type === "list") {
      const buffer = await generateShippingListBuffer(orderIds);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="shipping-list-${Date.now()}.xlsx"`,
        },
      });
    }

    const buffer =
      orderIds.length === 1
        ? await generateShippingLabelPdfBuffer(orderIds[0])
        : await generateBulkShippingLabelsPdfBuffer(orderIds);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="shipping-labels-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Document generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate document.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
