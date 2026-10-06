import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CouponsClient from "./coupons-client";
import { adminGetCoupons, adminGetAllCategories, adminGetAllSellers, adminGetAllProducts } from "@/actions/promotions";

export const metadata = { title: "Coupons – Admin" };

export default async function AdminCouponsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const [{ coupons }, { categories }, { sellers }, { products }] = await Promise.all([
    adminGetCoupons(),
    adminGetAllCategories(),
    adminGetAllSellers(),
    adminGetAllProducts(),
  ]);

  const mappedCoupons = (coupons ?? []).map(c => ({
    ...c,
    discountValue: Number(c.discountValue),
    minimumOrderAmount: Number(c.minimumOrderAmount),
    maximumDiscount: c.maximumDiscount ? Number(c.maximumDiscount) : null,
  }));

  return (
    <CouponsClient
      coupons={mappedCoupons}
      categories={categories ?? []}
      sellers={sellers ?? []}
      products={products ?? []}
    />
  );
}
