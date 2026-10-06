import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeReason } from "@/lib/reason-helper";
import { classifyReturnReason } from "@/lib/shipping";
import { Prisma } from "@prisma/client";

const Decimal = Prisma.Decimal;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const reason = searchParams.get("reason") || "";
  
  if (!reason.trim()) {
    return NextResponse.json({ success: false, error: "reason parameter is required." }, { status: 400 });
  }

  const normalizedReason = normalizeReason(reason);

  const activeRules = await prisma.returnReasonRule.findMany({
    where: { isActive: true }
  });
  const matchedRule = activeRules.find(r => normalizeReason(r.name) === normalizedReason);

  let category = "CUSTOMER_FAULT";
  let responsibility = "CUSTOMER";
  let origShipResp = "CUSTOMER";
  let retShipResp = "CUSTOMER";
  let reverseComm = false;
  let ruleId = null;

  if (matchedRule) {
    category = matchedRule.responsibility;
    responsibility = matchedRule.returnShippingResponsibility;
    origShipResp = matchedRule.originalShippingResponsibility;
    retShipResp = matchedRule.returnShippingResponsibility;
    reverseComm = matchedRule.reverseCommission;
    ruleId = matchedRule.id;
  } else {
    const fallback = classifyReturnReason(reason);
    category = fallback.category;
    responsibility = fallback.responsibility;
    if (category === "SELLER_FAULT") {
      origShipResp = "SELLER";
      retShipResp = "SELLER";
      reverseComm = false;
    } else if (category === "CUSTOMER_FAULT") {
      origShipResp = "CUSTOMER";
      retShipResp = "CUSTOMER";
      reverseComm = false;
    } else {
      origShipResp = "PLATFORM";
      retShipResp = "PLATFORM";
      reverseComm = true;
    }
  }

  if (!matchedRule) {
    if (category === "SELLER_FAULT" || category === "CUSTOMER_FAULT") {
      reverseComm = false;
    }
  }

  // Calculate refund values for order: subtotal = 1000, shippingFee = 0, returnShippingFee = 180
  const productAmount = new Decimal(1000);
  const originalShipping = new Decimal(0);
  const returnShippingFee = new Decimal(180);

  let deductionAmount = new Decimal(0);
  let customerRefundAmount = new Decimal(0);
  let sellerDeductionAmount = new Decimal(0);
  let platformCost = new Decimal(0);

  let calculatedCustomerRefund = productAmount;
  if (origShipResp === "SELLER" || origShipResp === "PLATFORM") {
    calculatedCustomerRefund = calculatedCustomerRefund.plus(originalShipping);
  }
  if (retShipResp === "CUSTOMER") {
    calculatedCustomerRefund = calculatedCustomerRefund.minus(returnShippingFee);
    deductionAmount = returnShippingFee;
  }
  customerRefundAmount = Decimal.max(0, calculatedCustomerRefund);

  if (category !== "PLATFORM_FAULT") {
    let calculatedSellerDeduct = productAmount;
    if (origShipResp === "SELLER") {
      calculatedSellerDeduct = calculatedSellerDeduct.plus(originalShipping);
    }
    if (retShipResp === "SELLER") {
      calculatedSellerDeduct = calculatedSellerDeduct.plus(returnShippingFee);
    }
    sellerDeductionAmount = calculatedSellerDeduct;
  } else {
    let calculatedSellerDeduct = new Decimal(0);
    if (origShipResp === "SELLER") {
      calculatedSellerDeduct = calculatedSellerDeduct.plus(originalShipping);
    }
    if (retShipResp === "SELLER") {
      calculatedSellerDeduct = calculatedSellerDeduct.plus(returnShippingFee);
    }
    sellerDeductionAmount = calculatedSellerDeduct;
  }

  let calculatedPlatformCost = new Decimal(0);
  if (category === "PLATFORM_FAULT") {
    calculatedPlatformCost = calculatedPlatformCost.plus(productAmount);
  }
  if (origShipResp === "PLATFORM") {
    calculatedPlatformCost = calculatedPlatformCost.plus(originalShipping);
  }
  if (retShipResp === "PLATFORM") {
    calculatedPlatformCost = calculatedPlatformCost.plus(returnShippingFee);
  }
  platformCost = calculatedPlatformCost;

  return NextResponse.json({
    success: true,
    matchedRule: matchedRule ? {
      id: matchedRule.id,
      name: matchedRule.name,
      responsibility: matchedRule.responsibility,
      originalShippingResponsibility: matchedRule.originalShippingResponsibility,
      returnShippingResponsibility: matchedRule.returnShippingResponsibility,
      reverseCommission: matchedRule.reverseCommission,
      isActive: matchedRule.isActive,
    } : null,
    calculated: {
      category,
      responsibility,
      origShipResp,
      retShipResp,
      reverseComm,
      customerRefundAmount: customerRefundAmount.toNumber(),
      sellerDeductionAmount: sellerDeductionAmount.toNumber(),
      deductionAmount: deductionAmount.toNumber(),
      platformCost: platformCost.toNumber(),
    }
  });
}
