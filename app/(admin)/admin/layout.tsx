import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PortalShell, ADMIN_NAV } from "@/components/site/portal-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Extra server-side gate — middleware protects /admin but we double-check here.
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <PortalShell brand="GarmentHub" brandTag="Admin Panel" nav={ADMIN_NAV}>
      {children}
    </PortalShell>
  );
}