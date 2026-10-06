import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PromotionsClient from "./promotions-client";
import { sellerGetPromotions, sellerGetOwnProducts, adminGetAllCategories } from "@/actions/promotions";

export const metadata = { title: "My Promotions – Seller Portal" };

export default async function SellerPromotionsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    redirect("/login");
  }

  const [{ promotions }, { products }, { categories }] = await Promise.all([
    sellerGetPromotions(),
    sellerGetOwnProducts(),
    adminGetAllCategories(),
  ]);

  const mappedPromotions = (promotions ?? []).map((p) => ({
    ...p,
    discountValue: Number(p.discountValue),
  }));

  return (
    <PromotionsClient
      promotions={mappedPromotions}
      products={products ?? []}
      categories={categories ?? []}
    />
  );
}
