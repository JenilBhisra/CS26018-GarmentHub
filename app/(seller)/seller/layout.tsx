import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PortalShell, SELLER_NAV } from "@/components/site/portal-shell";
import { headers } from "next/headers";
import { Clock, Mail, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Middleware already ensures user is authenticated with SELLER or ADMIN role.
  // Here we additionally verify seller approval status.
  if (session?.user?.role === "SELLER") {
    const profile = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id },
      include: { kyc: true },
    });

    if (!profile || !profile.pickupAddress.trim()) {
      // Seller profile missing, or scaffolded but not yet completed — finish onboarding
      redirect("/seller/register");
    }

    if (profile.approvalStatus === "PENDING") {
      return <SellerPendingApproval />;
    }

    if (profile.approvalStatus === "REJECTED") {
      return <SellerRejected reason={profile.rejectedReason} />;
    }

    // Check KYC status
    const kycStatus = profile.kyc?.status || "NOT_SUBMITTED";

    if (kycStatus === "SUSPENDED") {
      return <SellerSuspended reason={profile.kyc?.rejectionReason} />;
    }

    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || "";

    const isKycPage = pathname === "/seller/kyc" || pathname.startsWith("/seller/kyc/");
    const isSellerIndex = pathname === "/seller" || pathname === "/seller/";
    const isRegisterPage = pathname.startsWith("/seller/register");

    if (kycStatus !== "APPROVED" && !isKycPage && !isRegisterPage && !isSellerIndex) {
      redirect("/seller/kyc");
    }
  }

  return (
    <PortalShell brand="GarmentHub" brandTag="Seller Portal" nav={SELLER_NAV}>
      {children}
    </PortalShell>
  );
}

function SellerPendingApproval() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="font-display text-2xl font-light text-stone-900 mb-3">
          Pending Approval
        </h1>
        <p className="text-stone-500 text-sm leading-relaxed mb-6">
          Your seller account is under review. Our team verifies all sellers
          within <strong className="text-stone-700">24–48 business hours</strong>.
          You&apos;ll receive an email once your account is approved.
        </p>
        <div className="rounded-lg bg-stone-50 border border-stone-200 px-4 py-3 text-xs text-stone-600 mb-6 flex items-start gap-3 text-left">
          <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-stone-400" />
          <span>
            Need help? Email us at{" "}
            <a href="mailto:sellers@garmenthub.in" className="underline text-stone-900">
              sellers@garmenthub.in
            </a>
          </span>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
        >
          Back to homepage
        </Link>
      </div>
    </div>
  );
}

function SellerRejected({ reason }: { reason?: string | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="font-display text-2xl font-light text-stone-900 mb-3">
          Application Rejected
        </h1>
        <p className="text-stone-500 text-sm leading-relaxed mb-4">
          Unfortunately, your seller application was not approved at this time.
        </p>
        {reason && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-700 mb-6 text-left">
            <strong>Reason:</strong> {reason}
          </div>
        )}
        <p className="text-xs text-stone-500 mb-6">
          You may re-apply or contact our support team for more information.
        </p>
        <div className="flex gap-3">
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            Homepage
          </Link>
          <a
            href="mailto:sellers@garmenthub.in"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}

function SellerSuspended({ reason }: { reason?: string | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-lg">
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-stone-950 mb-3">
          Account Suspended
        </h1>
        <p className="text-stone-600 text-sm leading-relaxed mb-6">
          Your selling access on GarmentHub has been suspended due to compliance or verification policies.
        </p>
        {reason && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-700 mb-6 text-left">
            <strong>Reason:</strong> {reason}
          </div>
        )}
        <div className="rounded-lg bg-stone-50 border border-stone-200 px-4 py-3 text-xs text-stone-600 mb-6 flex items-start gap-3 text-left">
          <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-stone-400" />
          <span>
            To appeal this suspension, please contact compliance at{" "}
            <a href="mailto:compliance@garmenthub.in" className="underline text-stone-900 font-semibold">
              compliance@garmenthub.in
            </a>
          </span>
        </div>
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center px-6 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
        >
          Back to homepage
        </Link>
      </div>
    </div>
  );
}