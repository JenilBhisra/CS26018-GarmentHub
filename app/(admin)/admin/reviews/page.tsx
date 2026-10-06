import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PortalShell, ADMIN_NAV } from "@/components/site/portal-shell";
import AdminReviewsClient from "./reviews-client";

export default async function AdminReviewsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  // Fetch all reviews in the system
  const reviews = await prisma.review.findMany({
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
    <PortalShell brand="Admin Control" brandTag="Moderation" nav={ADMIN_NAV}>
      <AdminReviewsClient initialReviews={JSON.parse(JSON.stringify(reviews))} />
    </PortalShell>
  );
}
