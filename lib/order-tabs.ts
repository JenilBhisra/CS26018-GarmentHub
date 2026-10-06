import type { OrderStatus } from "@prisma/client";

// Named order-tab groupings, matching the OMS-Guru-style Orders page tabs.
// Lives outside any "use server" module — those may only export async functions.
export const ORDER_TAB_STATUSES: Record<string, OrderStatus[]> = {
  new: ["PENDING", "CONFIRMED"],
  packed: ["PACKED"],
  ready_to_ship: ["READY_TO_SHIP"],
  cancelled: ["CANCELLED"],
};
