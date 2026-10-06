import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminPromotionsClient from "./promotions-client";
import {
  adminGetAllPromotions,
  adminGetAllCategories,
  adminGetAllSellers,
  adminGetAllProducts,
} from "@/actions/promotions";

export const metadata = { title: "Promotions – Admin" };

export default async function AdminPromotionsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const [{ promotions }, { categories }, { sellers }, { products }] = await Promise.all([
    adminGetAllPromotions(),
    adminGetAllCategories(),
    adminGetAllSellers(),
    adminGetAllProducts(),
  ]);

  const mappedPromotions = (promotions ?? []).map(p => ({
    ...p,
    discountValue: Number(p.discountValue),
  }));

  return (
    <AdminPromotionsClient
      promotions={mappedPromotions}
      categories={categories ?? []}
      sellers={sellers ?? []}
    />
  );

}
