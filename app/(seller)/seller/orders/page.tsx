import { ensureKycApproved } from "@/actions/kyc";
import { getSellerOrders, getSellerOrderTabCounts } from "@/actions/orders";
import { ORDER_TAB_STATUSES } from "@/lib/order-tabs";
import { serializeDecimals } from "@/lib/serialize";
import SellerOrdersClient from "./orders-client";

export const metadata = {
  title: "Seller Orders — GarmentHub",
};

type TabKey = keyof typeof ORDER_TAB_STATUSES | "all";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; tab?: string; page?: string }>;
}) {
  // Ensure the seller is logged in and their KYC is approved
  await ensureKycApproved();

  const sp = await searchParams;
  const search = sp?.search || "";
  const tab = (sp?.tab as TabKey) || "new";
  const page = Math.max(1, parseInt(sp?.page || "1", 10) || 1);

  const [ordersRes, countsRes] = await Promise.all([
    getSellerOrders({
      tab: tab === "all" ? undefined : tab,
      searchQuery: search,
      page,
      pageSize: 20,
    }),
    getSellerOrderTabCounts(),
  ]);

  const initialOrders = serializeDecimals(ordersRes.success && ordersRes.orders ? ordersRes.orders : []);
  const total = ordersRes.success ? ordersRes.total ?? 0 : 0;
  const counts = countsRes.success && countsRes.counts ? countsRes.counts : null;

  return (
    <SellerOrdersClient
      initialOrders={initialOrders}
      total={total}
      page={page}
      pageSize={20}
      activeTab={tab}
      counts={counts}
      search={search}
    />
  );
}
