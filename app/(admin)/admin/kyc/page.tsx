import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminKYCClient } from "./kyc-client";

export const metadata = {
  title: "KYC Verification Requests — GarmentHub Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminKYCPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  // Fetch Seller KYC entries
  const sellerKycRaw = await prisma.sellerKYC.findMany({
    include: {
      seller: {
        include: {
          user: true
        }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  // Fetch B2B KYC entries
  const b2bKycRaw = await prisma.b2BKYC.findMany({
    include: {
      b2b: {
        include: {
          user: true
        }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  // Normalize data for the client component
  const sellerRequests = sellerKycRaw.map(k => ({
    id: k.id,
    profileId: k.sellerId,
    type: "SELLER" as const,
    name: k.seller.storeName,
    email: k.seller.user.email,
    phone: k.seller.user.phone || "No phone",
    status: k.status,
    gstCertificate: k.gstCertificate,
    panCard: k.panCard,
    idProof: k.idProof,
    addressProof: k.addressProof,
    bankProof: k.bankProof,
    gstNumber: k.gstNumber,
    panNumber: k.panNumber,
    idNumber: k.idNumber,
    bankAccountHolderName: k.bankAccountHolderName,
    bankAccountNumber: k.bankAccountNumber,
    bankIFSC: k.bankIFSC,
    businessRegNumber: k.businessRegNumber,
    businessAddress: k.businessAddress,
    city: k.city,
    state: k.state,
    pinCode: k.pinCode,
    isSuspicious: k.isSuspicious,
    suspiciousReasons: k.suspiciousReasons,
    documentValidation: k.documentValidation as Record<string, boolean> | null,
    rejectionReason: k.rejectionReason,
    updatedAt: k.updatedAt.toISOString(),
  }));

  const b2bRequests = b2bKycRaw.map(k => ({
    id: k.id,
    profileId: k.b2bId,
    type: "B2B" as const,
    name: k.b2b.companyName,
    email: k.b2b.user.email,
    phone: k.b2b.user.phone || "No phone",
    status: k.status,
    gstCertificate: k.gstCertificate,
    panCard: k.panCard,
    idProof: k.idProof,
    addressProof: k.addressProof,
    bankProof: k.bankProof,
    gstNumber: k.gstNumber,
    panNumber: k.panNumber,
    idNumber: k.idNumber,
    bankAccountHolderName: k.bankAccountHolderName,
    bankAccountNumber: k.bankAccountNumber,
    bankIFSC: k.bankIFSC,
    businessRegNumber: k.businessRegNumber,
    businessAddress: k.businessAddress,
    city: k.city,
    state: k.state,
    pinCode: k.pinCode,
    isSuspicious: k.isSuspicious,
    suspiciousReasons: k.suspiciousReasons,
    documentValidation: k.documentValidation as Record<string, boolean> | null,
    rejectionReason: k.rejectionReason,
    updatedAt: k.updatedAt.toISOString(),
  }));

  const requests = [...sellerRequests, ...b2bRequests].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  // Compute stats
  const pendingCount = requests.filter(r => r.status === "PENDING_REVIEW").length;
  const suspiciousCount = requests.filter(r => r.status === "PENDING_REVIEW" && r.isSuspicious).length;
  const approvedCount = requests.filter(r => r.status === "APPROVED").length;
  const suspendedCount = requests.filter(r => r.status === "SUSPENDED").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-light text-stone-900">KYC Verification Requests</h1>
        <p className="mt-1 text-sm text-stone-500">
          Verify corporate records, review validation logs, investigate matching anomalies, and control selling capabilities.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-2xl font-semibold text-stone-900">{pendingCount}</div>
          <div className="text-xs text-stone-500 mt-1">Pending Review</div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-2xl font-semibold text-amber-600">{suspiciousCount}</div>
          <div className="text-xs text-amber-500 mt-1">Flagged Suspicious</div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-2xl font-semibold text-emerald-600">{approvedCount}</div>
          <div className="text-xs text-emerald-500 mt-1">Total Approved</div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-2xl font-semibold text-red-600">{suspendedCount}</div>
          <div className="text-xs text-red-500 mt-1">Suspended Accounts</div>
        </div>
      </div>

      <Suspense fallback={<div className="h-40 flex items-center justify-center text-xs text-stone-400">Loading KYC queue...</div>}>
        <AdminKYCClient initialRequests={requests} />
      </Suspense>
    </div>
  );
}
