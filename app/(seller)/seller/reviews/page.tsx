import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PortalShell, SELLER_NAV } from "@/components/site/portal-shell";
import SellerReviewsClient from "./reviews-client";

export default async function SellerReviewsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    redirect("/unauthorized");
  }

  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!sellerProfile) {
    redirect("/seller/register");
  }

  // Fetch reviews for products belonging to this seller
  const reviews = await prisma.review.findMany({
    where: {
      product: {
        sellerId: sellerProfile.id,
      },
    },
    include: {
      product: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      images: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <PortalShell brand="Seller Hub" brandTag="Fulfillment" nav={SELLER_NAV}>
      <SellerReviewsClient initialReviews={JSON.parse(JSON.stringify(reviews))} />
    </PortalShell>
  );
}
