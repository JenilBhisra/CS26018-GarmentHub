import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PortalShell, ADMIN_NAV } from "@/components/site/portal-shell";
import AdminQAClient from "./qa-client";

export default async function AdminQAPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  // Fetch all questions with products, users, and answers
  const questions = await prisma.productQuestion.findMany({
    include: {
      product: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      answers: {
        include: {
          seller: {
            select: {
              storeName: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <PortalShell brand="Admin Control" brandTag="Moderation" nav={ADMIN_NAV}>
      <AdminQAClient initialQuestions={JSON.parse(JSON.stringify(questions))} />
    </PortalShell>
  );
}
