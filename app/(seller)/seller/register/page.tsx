import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { RegisterForm } from "./register-form";

export default async function Page() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    redirect("/login");
  }

  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    select: { storeName: true, pickupAddress: true },
  });

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="container-page max-w-xl">
        <h1 className="font-display text-4xl">Complete your business profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us your store name and pickup address. Our team reviews new seller
          applications within 48 hours. GST, PAN, Aadhaar and bank details are
          collected separately in{" "}
          <span className="font-medium text-foreground">KYC Verification</span>{" "}
          once your application is approved.
        </p>

        <RegisterForm
          initialStoreName={profile?.storeName ?? ""}
          initialPickupAddress={profile?.pickupAddress ?? ""}
        />
      </div>
    </div>
  );
}
