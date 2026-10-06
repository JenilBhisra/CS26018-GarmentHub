import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminReportsClient from "./reports-client";
import { Role } from "@prisma/client";

export const metadata = {
  title: "Compile Operational Reports — GarmentHub Admin",
};

export default async function AdminReportsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== Role.ADMIN) {
    redirect("/unauthorized");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-light text-stone-900">Marketplace Reports</h1>
        <p className="text-sm text-stone-500 mt-1">Compile and export spreadsheet reports across sellers, orders, products, and clients.</p>
      </div>

      <AdminReportsClient />
    </div>
  );
}
