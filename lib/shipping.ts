import { prisma } from "@/lib/prisma";
import { Prisma, ReturnReasonCategory, ShippingResponsibility } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Classify a customer's return reason into category and responsibility.
 */
export function classifyReturnReason(reason: string): {
  category: ReturnReasonCategory;
  responsibility: ShippingResponsibility;
} {
  const sellerFaultReasons = [
    "damaged item", "defective item", "wrong item delivered", 
    "wrong size sent", "missing item", "poor quality", "courier damage",
    "damaged", "defective", "item damaged or defective", "incorrect product shipped"
  ];
  const customerFaultReasons = [
    "changed mind", "ordered by mistake", "didn't like product", 
    "no longer needed", "incorrect size ordered"
  ];
  const platformFaultReasons = [
    "system pricing bug", "incorrect information shown by marketplace",
    "inventory synchronization issue", "marketplace operational error"
  ];

  const normalized = reason.trim().toLowerCase();

  if (sellerFaultReasons.some(r => normalized.includes(r))) {
    return { category: "SELLER_FAULT", responsibility: "SELLER" };
  }
  if (customerFaultReasons.some(r => normalized.includes(r))) {
    return { category: "CUSTOMER_FAULT", responsibility: "CUSTOMER" };
  }
  if (platformFaultReasons.some(r => normalized.includes(r))) {
    return { category: "PLATFORM_FAULT", responsibility: "PLATFORM" };
  }

  // Default fallback
  return { category: "CUSTOMER_FAULT", responsibility: "CUSTOMER" };
}

/**
 * Retrieve system settings helper.
 */
async function getSettingValue(key: string, defaultValue: string): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting ? setting.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Calculate the return shipping fee based on package weight, zone, and order subtotal.
 */
export async function calculateReturnShippingFee(
  weightKg: number | Decimal,
  zone: string,
  orderSubtotal: number | Decimal
): Promise<Decimal> {
  const subtotal = new Decimal(orderSubtotal);
  const weight = new Decimal(weightKg);

  // 1. Check free shipping threshold
  const freeThresholdStr = await getSettingValue("shipping_free_threshold", "1500");
  const freeThreshold = new Decimal(freeThresholdStr);

  if (subtotal.greaterThanOrEqualTo(freeThreshold)) {
    return new Decimal(0);
  }

  // 2. Determine base weight rate
  let baseRateStr = "50"; // default fallback
  if (weight.lessThanOrEqualTo(0.5)) {
    baseRateStr = await getSettingValue("shipping_weight_0_500", "40");
  } else if (weight.lessThanOrEqualTo(1.0)) {
    baseRateStr = await getSettingValue("shipping_weight_500_1000", "60");
  } else if (weight.lessThanOrEqualTo(2.0)) {
    baseRateStr = await getSettingValue("shipping_weight_1000_2000", "80");
  } else {
    baseRateStr = await getSettingValue("shipping_weight_2000_plus", "120");
  }
  const baseRate = new Decimal(baseRateStr);

  // 3. Determine zone multiplier
  let multiplierStr = "1.0";
  const normalizedZone = zone.trim().toUpperCase();
  if (normalizedZone === "LOCAL") {
    multiplierStr = await getSettingValue("shipping_zone_local", "1.0");
  } else if (normalizedZone === "ZONAL") {
    multiplierStr = await getSettingValue("shipping_zone_zonal", "1.2");
  } else if (normalizedZone === "NATIONAL") {
    multiplierStr = await getSettingValue("shipping_zone_national", "1.5");
  } else if (normalizedZone === "REMOTE") {
    multiplierStr = await getSettingValue("shipping_zone_remote", "2.0");
  } else {
    multiplierStr = await getSettingValue("shipping_zone_default", "1.0");
  }
  const multiplier = new Decimal(multiplierStr);

  return baseRate.times(multiplier);
}
