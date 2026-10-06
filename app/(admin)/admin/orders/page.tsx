import { requireRole } from "@/lib/auth-helpers";
import { getAllOrders } from "@/actions/orders";
import { serializeDecimals } from "@/lib/serialize";
import AdminOrdersClient from "./orders-client";

export const metadata = {
  title: "Admin Order Dashboard — GarmentHub",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  // Ensure the user has the ADMIN role
  await requireRole(["ADMIN"]);

  const sp = await searchParams;
  const search = sp?.search || "";

  // Fetch all orders in the marketplace. Admin's orders-client.tsx still does its own
  // client-side pagination/slicing, so request a large page here rather than redesigning
  // this page's pagination as part of the seller-side order-workflow rebuild.
  const res = await getAllOrders({ searchQuery: search, pageSize: 500 });
  const initialOrders = serializeDecimals(res.success && res.orders ? res.orders : []);

  return <AdminOrdersClient initialOrders={initialOrders} />;
}
