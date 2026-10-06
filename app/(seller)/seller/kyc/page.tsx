import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SellerKYCForm } from "./kyc-form";
import { ShieldCheck, Clock, AlertTriangle, AlertCircle } from "lucide-react";

export default async function SellerKYCPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    include: { kyc: true }
  });

  if (!sellerProfile) {
    redirect("/seller/register");
  }

  const kyc = sellerProfile.kyc;
  const status = kyc?.status || "NOT_SUBMITTED";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Business KYC Verification</h1>
        <p className="text-sm text-stone-500 mt-1">
          Submit official business documentation and bank information to verify your seller account on GarmentHub.
        </p>
      </div>

      {/* KYC Status Display */}
      {status === "APPROVED" && (
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-8 text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-emerald-100/50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-medium text-emerald-900">Verification Successful</h2>
          <p className="text-sm text-emerald-700 mt-2">
            Your KYC details have been verified and approved. Your seller account is active with full selling access.
          </p>
          <div className="mt-6 border-t border-emerald-100 pt-6 text-left space-y-3 text-xs text-emerald-900 max-w-md mx-auto">
            <div className="flex justify-between">
              <span className="text-emerald-700">GSTIN Number:</span>
              <span className="font-mono font-medium">{kyc?.gstNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-700">PAN Number:</span>
              <span className="font-mono font-medium">{kyc?.panNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-700">ID / Aadhaar:</span>
              <span className="font-mono font-medium">xxxx-xxxx-{kyc?.idNumber?.slice(-4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-700">Bank Account Number:</span>
              <span className="font-mono font-medium">xxxx{kyc?.bankAccountNumber?.slice(-4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-700">IFSC Code:</span>
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
          <h2 className="text-xl font-medium text-sky-950">KYC Under Review</h2>
          <p className="text-sm text-sky-700 mt-2 leading-relaxed">
            Your KYC documents were submitted on <span className="font-medium">{kyc?.updatedAt.toLocaleDateString()}</span>. Our compliance team is verifying your business details.
          </p>
          <div className="mt-4 p-3 bg-white/80 border border-sky-100/50 rounded-xl text-left text-xs text-sky-900 space-y-2">
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
              <span>Aadhaar Number:</span>
              <span className="font-mono font-medium">xxxx-xxxx-{kyc?.idNumber?.slice(-4)}</span>
            </div>
            <div className="flex justify-between">
              <span>IFSC Code:</span>
              <span className="font-mono font-medium">{kyc?.bankIFSC}</span>
            </div>
          </div>
          <p className="text-xs text-stone-500 mt-6">
            If any discrepancy is found, you will receive an alert to edit and resubmit your files.
          </p>
        </div>
      )}

      {status === "SUSPENDED" && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-200">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold text-red-950">Verification Suspended</h2>
          <p className="text-sm text-red-700 mt-2">
            Your selling privileges have been suspended. Please check compliance guidelines.
          </p>
          {kyc?.rejectionReason && (
            <div className="mt-4 p-4 bg-white border border-red-100 rounded-xl text-left text-xs text-red-800">
              <strong>Compliance Notice:</strong> {kyc.rejectionReason}
            </div>
          )}
        </div>
      )}

      {status === "REJECTED" && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-3 text-red-800">
            <AlertTriangle className="h-6 w-6 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold">KYC Verification Rejected</h3>
              <p className="text-sm mt-1">
                Your previous KYC submission was rejected by our administration. Please review the comments below, correct the fields, and resubmit.
              </p>
              {kyc?.rejectionReason && (
                <div className="mt-3 p-3 bg-white/80 border border-red-200/50 rounded-xl text-xs font-medium font-sans">
                  <strong>Rejection comments:</strong> {kyc.rejectionReason}
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
            <h2 className="font-semibold text-lg text-stone-900">Document Submission Form</h2>
            <p className="text-xs text-stone-500 mt-0.5">All upload files must be in PDF, PNG or JPG format (max 5MB).</p>
          </div>
          <SellerKYCForm initialData={kyc || undefined} />
        </div>
      )}
    </div>
  );
}
