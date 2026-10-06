import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CustomerLayout } from "@/components/site/layout";
import Link from "next/link";
import { headers } from "next/headers";
import { Clock, Mail, ShieldX, ShieldAlert } from "lucide-react";

export default async function B2BLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Middleware ensures only B2B_VENDOR and ADMIN reach here.
  // For B2B vendors, additionally verify approval status.
  if (session?.user?.role === "B2B_VENDOR") {
    const profile = await prisma.b2BProfile.findUnique({
      where: { userId: session.user.id },
      include: { kyc: true },
    });

    if (!profile) {
      // No profile yet — redirect to B2B registration/onboarding
      redirect("/register");
    }

    if (profile.approvalStatus === "PENDING") {
      return (
        <CustomerLayout>
          <B2BPendingApproval />
        </CustomerLayout>
      );
    }

    if (profile.approvalStatus === "REJECTED") {
      return (
        <CustomerLayout>
          <B2BRejected reason={profile.rejectedReason} />
        </CustomerLayout>
      );
    }

    // Check KYC status
    const kycStatus = profile.kyc?.status || "NOT_SUBMITTED";

    if (kycStatus === "SUSPENDED") {
      return (
        <CustomerLayout>
          <B2BSuspended reason={profile.kyc?.rejectionReason} />
        </CustomerLayout>
      );
    }

    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || "";

    const isKycPage = pathname === "/b2b/kyc" || pathname.startsWith("/b2b/kyc/");
    const isB2bIndex = pathname === "/b2b" || pathname === "/b2b/";

    if (kycStatus !== "APPROVED" && !isKycPage && !isB2bIndex) {
      redirect("/b2b/kyc");
    }
  }

  // ADMIN or approved B2B_VENDOR — render normally
  return <>{children}</>;
}

function B2BPendingApproval() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="font-display text-2xl font-light text-stone-900 mb-3">
          B2B Access Pending
        </h1>
        <p className="text-stone-500 text-sm leading-relaxed mb-6">
          Your B2B vendor account is under review. Our team verifies all
          applications within{" "}
          <strong className="text-stone-700">2–3 business days</strong>. You
          will receive an email once your account is approved.
        </p>
        <div className="rounded-lg bg-stone-50 border border-stone-200 px-4 py-3 text-xs text-stone-600 mb-6 flex items-start gap-3 text-left">
          <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-stone-400" />
          <span>
            Need help? Email us at{" "}
            <a
              href="mailto:b2b@garmenthub.in"
              className="underline text-stone-900"
            >
              b2b@garmenthub.in
            </a>
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
          >
            Back to homepage
          </Link>
          <Link
            href="/account"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            My account
          </Link>
        </div>
      </div>
    </div>
  );
}

function B2BRejected({ reason }: { reason?: string | null }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="font-display text-2xl font-light text-stone-900 mb-3">
          B2B Application Rejected
        </h1>
        <p className="text-stone-500 text-sm leading-relaxed mb-4">
          Your B2B vendor application was not approved at this time.
        </p>
        {reason && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-700 mb-4 text-left">
            <strong>Reason:</strong> {reason}
          </div>
        )}
        <p className="text-xs text-stone-500 mb-6">
          {/* TODO: Add re-application flow in a future phase */}
          Please contact our B2B team to discuss your application.
        </p>
        <div className="flex gap-3">
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            Homepage
          </Link>
          <a
            href="mailto:b2b@garmenthub.in"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
          >
            Contact B2B team
          </a>
        </div>
      </div>
    </div>
  );
}

function B2BSuspended({ reason }: { reason?: string | null }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 bg-stone-50">
      <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-stone-900 mb-3">
          B2B Access Suspended
        </h1>
        <p className="text-stone-500 text-sm leading-relaxed mb-6">
          Your B2B vendor status has been suspended due to compliance or verification policies.
        </p>
        {reason && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-700 mb-6 text-left">
            <strong>Reason for suspension:</strong> {reason}
          </div>
        )}
        <div className="rounded-lg bg-stone-50 border border-stone-200 px-4 py-3 text-xs text-stone-600 mb-6 flex items-start gap-3 text-left">
          <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-stone-400" />
          <span>
            Please contact our B2B compliance team at{" "}
            <a href="mailto:compliance@garmenthub.in" className="underline text-stone-900 font-semibold">
              compliance@garmenthub.in
            </a>
          </span>
        </div>
        <div className="flex gap-3">
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            Homepage
          </Link>
          <a
            href="mailto:compliance@garmenthub.in"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
          >
            Contact Compliance
          </a>
        </div>
      </div>
    </div>
  );
}
