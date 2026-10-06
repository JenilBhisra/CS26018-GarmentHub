import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PortalShell, SELLER_NAV } from "@/components/site/portal-shell";
import SellerQAClient from "./qa-client";

export default async function SellerQAPage() {
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

  // Fetch questions for products belonging to this seller
  const questions = await prisma.productQuestion.findMany({
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
      answers: {
        where: {
          sellerId: sellerProfile.id,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <PortalShell brand="Seller Hub" brandTag="Fulfillment" nav={SELLER_NAV}>
      <SellerQAClient initialQuestions={JSON.parse(JSON.stringify(questions))} />
    </PortalShell>
  );
}
