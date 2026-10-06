import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { B2BKYCForm } from "./kyc-form";
import { CustomerLayout } from "@/components/site/layout";
import { ShieldCheck, Clock, AlertTriangle, AlertCircle } from "lucide-react";

export default async function B2BKYCPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const b2bProfile = await prisma.b2BProfile.findUnique({
    where: { userId: session.user.id },
    include: { kyc: true }
  });

  if (!b2bProfile) {
    redirect("/register");
  }

  const kyc = b2bProfile.kyc;
  const status = kyc?.status || "NOT_SUBMITTED";

  return (
    <CustomerLayout>
      <div className="container-page py-12 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-3xl text-stone-900">B2B Vendor KYC Verification</h1>
          <p className="text-sm text-stone-500 mt-1">
            Provide business verification details to enable wholesale catalog ordering, price negotiations, and factory quotation submissions.
          </p>
        </div>

        {/* KYC Status Display */}
        {status === "APPROVED" && (
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-8 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 bg-emerald-100/50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-medium text-emerald-900">B2B Verified Approved</h2>
            <p className="text-sm text-emerald-700 mt-2">
              Your business KYC details are validated and approved. You have full access to wholesale operations.
            </p>
            <div className="mt-6 border-t border-emerald-100 pt-6 text-left space-y-3 text-xs text-emerald-900 max-w-md mx-auto">
              <div className="flex justify-between">
                <span className="text-emerald-700">Company Name:</span>
                <span className="font-medium">{b2bProfile.companyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-700">GSTIN Number:</span>
                <span className="font-mono font-medium">{kyc?.gstNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-700">PAN Number:</span>
                <span className="font-mono font-medium">{kyc?.panNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-700">ID / Aadhaar Number:</span>
                <span className="font-mono font-medium">xxxx-xxxx-{kyc?.idNumber?.slice(-4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-700">Bank IFSC:</span>
                <span className="font-mono font-medium">{kyc?.bankIFSC}</span>
              </div>
            </div>
          </div>
        )}

        {status === "PENDING_REVIEW" && (
          <div className="bg-sky-50/40 border border-sky-100 rounded-2xl p-8 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 bg-sky-100/50 text-sky-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-sky-200">
              <Clock className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-medium text-sky-955">Verification Pending</h2>
            <p className="text-sm text-sky-700 mt-2 leading-relaxed">
              Your B2B profile credentials were submitted on <span className="font-medium">{kyc?.updatedAt.toLocaleDateString()}</span>. Our team will review the details within 48 business hours.
            </p>
            <div className="mt-4 p-3 bg-white border border-sky-100/50 rounded-xl text-left text-xs text-sky-900 space-y-2">
              <div className="font-semibold text-sky-950 mb-1 border-b pb-1">Submitted Information:</div>
              <div className="flex justify-between">
                <span>GSTIN Number:</span>
                <span className="font-mono font-medium">{kyc?.gstNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>PAN Number:</span>
                <span className="font-mono font-medium">{kyc?.panNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Aadhaar/Passport:</span>
                <span className="font-mono font-medium">xxxx-xxxx-{kyc?.idNumber?.slice(-4)}</span>
              </div>
              <div className="flex justify-between">
                <span>IFSC Code:</span>
                <span className="font-mono font-medium">{kyc?.bankIFSC}</span>
              </div>
            </div>
          </div>
        )}

        {status === "SUSPENDED" && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-200">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold text-red-955">B2B Portal Suspended</h2>
            <p className="text-sm text-red-700 mt-2">
              Access to wholesale listings has been suspended due to compliance checks.
            </p>
            {kyc?.rejectionReason && (
              <div className="mt-4 p-4 bg-white border border-red-100 rounded-xl text-left text-xs text-red-800">
                <strong>Compliance Message:</strong> {kyc.rejectionReason}
              </div>
            )}
          </div>
        )}

        {status === "REJECTED" && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
            <div className="flex items-start gap-3 text-red-800">
              <AlertTriangle className="h-6 w-6 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold">KYC Verification Rejected</h3>
                <p className="text-sm mt-1">
                  Your business verification documents were not approved. Check comments below, adjust inputs and resubmit.
                </p>
                {kyc?.rejectionReason && (
                  <div className="mt-3 p-3 bg-white border border-red-100 rounded-xl text-xs">
                    <strong>Rejection reason:</strong> {kyc.rejectionReason}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* KYC Form Render for Not Submitted or Rejected Statuses */}
        {(status === "NOT_SUBMITTED" || status === "REJECTED") && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="border-b border-stone-200 pb-4 mb-6">
              <h2 className="font-semibold text-lg text-stone-900">B2B Documentation Form</h2>
              <p className="text-xs text-stone-500 mt-0.5">Please provide GST certificate, PAN copy and authorized details.</p>
            </div>
            <B2BKYCForm initialData={kyc || undefined} />
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
