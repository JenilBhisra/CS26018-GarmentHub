import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminHistoryClient from "./history-client";

export const metadata = {
  title: "Return & Refund History — Admin Portal",
};

export default async function AdminReturnHistoryPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  // Fetch unique store names for seller search dropdown list
  const sellers = await prisma.sellerProfile.findMany({
    select: {
      id: true,
      storeName: true,
    },
    orderBy: { storeName: "asc" },
  });

  return (
    <AdminHistoryClient sellers={sellers} />
  );
}
