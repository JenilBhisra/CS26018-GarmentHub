"use client";

import { useState, useTransition } from "react";
import { reviewKYC } from "@/actions/kyc";
import { 
  Search, ShieldAlert, CheckCircle, XCircle, 
  FileText, Download, Phone, Mail, Calendar, Info
} from "lucide-react";
import { toast } from "sonner";

interface KYCRequest {
  id: string;
  profileId: string;
  type: "SELLER" | "B2B";
  name: string;
  email: string;
  phone: string;
  status: string;
  gstCertificate: string | null;
  panCard: string | null;
  idProof: string | null;
  addressProof: string | null;
  bankProof: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  idNumber: string | null;
  bankAccountHolderName: string | null;
  bankAccountNumber: string | null;
  bankIFSC: string | null;
  businessRegNumber: string | null;
  businessAddress: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  isSuspicious: boolean;
  suspiciousReasons: string[];
  documentValidation: Record<string, boolean> | null;
  rejectionReason: string | null;
  updatedAt: string;
}

interface AdminKYCClientProps {
  initialRequests: KYCRequest[];
}

export function AdminKYCClient({ initialRequests }: AdminKYCClientProps) {
  const [requests, setRequests] = useState<KYCRequest[]>(initialRequests);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"ALL" | "PENDING" | "FLAGGED" | "APPROVED">("PENDING");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialRequests.find(r => r.status === "PENDING_REVIEW")?.id || initialRequests[0]?.id || null
  );
  
  const [rejectionComment, setRejectionComment] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedRequest = requests.find(r => r.id === selectedId);

  // Filter requests
  const filteredRequests = requests.filter(r => {
    const matchesSearch = 
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      (r.gstNumber && r.gstNumber.toLowerCase().includes(search.toLowerCase())) ||
      (r.panNumber && r.panNumber.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterTab === "PENDING") return r.status === "PENDING_REVIEW";
    if (filterTab === "FLAGGED") return r.status === "PENDING_REVIEW" && r.isSuspicious;
    if (filterTab === "APPROVED") return r.status === "APPROVED";
    return true; // ALL
  });

  const handleAction = (status: "APPROVED" | "REJECTED" | "SUSPENDED") => {
    if (!selectedRequest) return;
    if ((status === "REJECTED" || status === "SUSPENDED") && !rejectionComment.trim()) {
      toast.error("Please provide a reason/comment for rejection or suspension.");
      return;
    }

    startTransition(async () => {
      const res = await reviewKYC(
        selectedRequest.id,
        selectedRequest.type,
        status,
        rejectionComment
      );

      if (res.success) {
        toast.success(`KYC status updated to ${status} successfully.`);
        // Update local state
        setRequests(prev => 
          prev.map(r => 
            r.id === selectedRequest.id 
              ? { ...r, status, rejectionReason: status === "APPROVED" ? null : rejectionComment }
              : r
          )
        );
        setRejectionComment("");
      } else {
        toast.error(res.error || "Failed to update KYC status.");
      }
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12 items-start">
      {/* LEFT PANEL: Queue List (Col 5) */}
      <div className="lg:col-span-5 bg-white border border-stone-200 rounded-2xl p-4 space-y-4 shadow-sm self-stretch">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-stone-900 text-sm">Submission Queue</h2>
          <span className="text-xs text-stone-400 font-medium">Showing {filteredRequests.length}</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search vendor name, email, GST, PAN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-100"
          />
        </div>

        {/* Queue filter tabs */}
        <div className="flex gap-1 border-b border-stone-100 pb-1">
          {([
            { id: "PENDING", label: "Pending" },
            { id: "FLAGGED", label: "Flagged" },
            { id: "APPROVED", label: "Approved" },
            { id: "ALL", label: "All" }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                filterTab === tab.id
                  ? "bg-stone-900 text-white"
                  : "text-stone-500 hover:bg-stone-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable list */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 text-xs text-stone-400">
              No matching KYC records found.
            </div>
          ) : (
            filteredRequests.map(req => {
              const active = req.id === selectedId;
              return (
                <button
                  key={req.id}
                  onClick={() => {
                    setSelectedId(req.id);
                    setRejectionComment("");
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-2 cursor-pointer ${
                    active 
                      ? "border-stone-900 bg-stone-50/50 shadow-sm" 
                      : "border-stone-200 hover:border-stone-300 bg-white"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-xs text-stone-900 truncate max-w-[70%]">
                      {req.name}
                    </span>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                      req.type === "SELLER" 
                        ? "bg-orange-50 text-orange-700 border border-orange-100" 
                        : "bg-blue-50 text-blue-700 border border-blue-100"
                    }`}>
                      {req.type}
                    </span>
                  </div>

                  <div className="text-[11px] text-stone-500 truncate">{req.email}</div>

                  <div className="flex justify-between items-center text-[10px] text-stone-400 mt-1">
                    <span>{new Date(req.updatedAt).toLocaleDateString()}</span>
                    <div className="flex gap-1.5 items-center">
                      {req.isSuspicious && req.status === "PENDING_REVIEW" && (
                        <span className="bg-red-50 text-red-600 font-bold border border-red-100 px-2 py-0.5 rounded-full">
                          FLAGGED
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full uppercase font-bold text-[9px] ${
                        req.status === "PENDING_REVIEW" 
                          ? "bg-amber-100 text-amber-800" 
                          : req.status === "APPROVED"
                          ? "bg-green-100 text-green-800"
                          : req.status === "REJECTED"
                          ? "bg-red-100 text-red-800"
                          : "bg-stone-200 text-stone-800"
                      }`}>
                        {req.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Details Audit Inspector (Col 7) */}
      <div className="lg:col-span-7 bg-white border border-stone-200 rounded-2xl p-6 space-y-6 shadow-sm min-h-[500px]">
        {selectedRequest ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-stone-100 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400">
                  {selectedRequest.type} PROFILE AUDIT
                </span>
                <h2 className="font-display text-2xl font-light text-stone-900 mt-1">
                  {selectedRequest.name}
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500 mt-2">
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {selectedRequest.email}</span>
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedRequest.phone}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(selectedRequest.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase ${
                  selectedRequest.status === "PENDING_REVIEW" 
                    ? "bg-amber-50 text-amber-700 border border-amber-200" 
                    : selectedRequest.status === "APPROVED"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : selectedRequest.status === "REJECTED"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-stone-100 text-stone-700 border border-stone-200"
                }`}>
                  Status: {selectedRequest.status.replace("_", " ")}
                </span>
              </div>
            </div>

            {/* Suspicious warning banner */}
            {selectedRequest.isSuspicious && (
              <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 space-y-2.5">
                <div className="flex items-center gap-2.5 text-red-800">
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                  <span className="font-semibold text-sm">Suspicious verification data — please manually verify before approval.</span>
                </div>
                <div className="text-xs text-red-700 space-y-1 bg-white/70 border border-red-100 p-3 rounded-lg">
                  <div className="font-semibold mb-1">Mismatches and Flags Logged:</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {selectedRequest.suspiciousReasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Grid of details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-1.5">
                <Info className="h-4 w-4 text-stone-400" /> Document & Verification Details
              </h3>
              
              <div className="grid gap-4 sm:grid-cols-2 text-xs">
                <div className="bg-stone-50 p-3 rounded-lg space-y-1.5 border border-stone-100">
                  <div className="text-stone-400 font-medium">GSTIN Number</div>
                  <div className="font-mono font-bold text-stone-900 flex justify-between">
                    <span>{selectedRequest.gstNumber || "Not Provided"}</span>
                    {selectedRequest.documentValidation?.gstValid !== undefined && (
                      <span className={selectedRequest.documentValidation.gstValid ? "text-emerald-600 font-sans" : "text-amber-600 font-sans"}>
                        {selectedRequest.documentValidation.gstValid ? "✓ Pattern OK" : "✗ Pattern Invalid"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-stone-50 p-3 rounded-lg space-y-1.5 border border-stone-100">
                  <div className="text-stone-400 font-medium">PAN Card Number</div>
                  <div className="font-mono font-bold text-stone-900 flex justify-between">
                    <span>{selectedRequest.panNumber || "Not Provided"}</span>
                    {selectedRequest.documentValidation?.panValid !== undefined && (
                      <span className={selectedRequest.documentValidation.panValid ? "text-emerald-600 font-sans" : "text-amber-600 font-sans"}>
                        {selectedRequest.documentValidation.panValid ? "✓ Pattern OK" : "✗ Pattern Invalid"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-stone-50 p-3 rounded-lg space-y-1.5 border border-stone-100">
                  <div className="text-stone-400 font-medium">Aadhaar / ID Number</div>
                  <div className="font-mono font-bold text-stone-900 flex justify-between">
                    <span>{selectedRequest.idNumber || "Not Provided"}</span>
                    {selectedRequest.documentValidation?.idValid !== undefined && (
                      <span className={selectedRequest.documentValidation.idValid ? "text-emerald-600 font-sans" : "text-amber-600 font-sans"}>
                        {selectedRequest.documentValidation.idValid ? "✓ Checksum OK" : "✗ Checksum Failed"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-stone-50 p-3 rounded-lg space-y-1.5 border border-stone-100">
                  <div className="text-stone-400 font-medium">Business Registration Number</div>
                  <div className="font-mono font-bold text-stone-900">
                    {selectedRequest.businessRegNumber || "Not Provided"}
                  </div>
                </div>

                {/* Business Address details */}
                <div className="sm:col-span-2 bg-stone-50/50 p-4 rounded-lg border border-stone-200 space-y-2">
                  <div className="text-xs font-semibold text-stone-800 border-b border-stone-200 pb-1">Business Address Details</div>
                  <div className="text-xs text-stone-900 leading-relaxed">
                    <p><strong>Address:</strong> {selectedRequest.businessAddress || "Not Provided"}</p>
                    <div className="grid gap-2 sm:grid-cols-3 mt-2">
                      <div>
                        <span className="text-stone-400">City:</span> <span className="font-medium">{selectedRequest.city || "Not Provided"}</span>
                      </div>
                      <div>
                        <span className="text-stone-400">State:</span> <span className="font-medium">{selectedRequest.state || "Not Provided"}</span>
                      </div>
                      <div>
                        <span className="text-stone-400">PIN Code:</span> <span className="font-mono font-medium">{selectedRequest.pinCode || "Not Provided"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Settlement bank account details */}
                <div className="sm:col-span-2 bg-stone-50/50 p-4 rounded-lg border border-stone-200 space-y-2">
                  <div className="text-xs font-semibold text-stone-800 border-b border-stone-200 pb-1">Settlement Bank Details</div>
                  <div className="grid gap-2 sm:grid-cols-3 text-xs">
                    <div>
                      <div className="text-stone-400">Account Holder</div>
                      <div className="font-medium text-stone-900">{selectedRequest.bankAccountHolderName}</div>
                    </div>
                    <div>
                      <div className="text-stone-400">Account Number</div>
                      <div className="font-mono font-medium text-stone-900 flex items-center justify-between">
                        <span>{selectedRequest.bankAccountNumber}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-400">Bank IFSC Code</div>
                      <div className="font-mono font-medium text-stone-900 flex items-center justify-between">
                        <span>{selectedRequest.bankIFSC}</span>
                      </div>
                    </div>
                  </div>
                  {selectedRequest.documentValidation?.accountValid !== undefined && (
                    <div className="flex gap-4 text-[10px] text-stone-500 pt-1">
                      <span>Account Valid: <b className={selectedRequest.documentValidation.accountValid ? "text-emerald-600" : "text-amber-600"}>{selectedRequest.documentValidation.accountValid ? "YES" : "NO"}</b></span>
                      <span>IFSC Valid: <b className={selectedRequest.documentValidation.ifscValid ? "text-emerald-600" : "text-amber-600"}>{selectedRequest.documentValidation.ifscValid ? "YES" : "NO"}</b></span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Document Downloads (Secure Files Stream API) */}
            <div className="space-y-3">
              <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-stone-400" /> Submitted Document Files
              </h3>
              
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                {[
                  { key: "gstCertificate", label: "GST Certificate" },
                  { key: "panCard", label: "PAN Card Document" },
                  { key: "idProof", label: "ID Proof Document" },
                  { key: "addressProof", label: "Address Proof" },
                  { key: "bankProof", label: "Cancelled Cheque/Cheque" }
                ].map((doc) => {
                  const filename = selectedRequest[doc.key as keyof typeof selectedRequest] as string | null;
                  return (
                    <div key={doc.key} className="rounded-xl border border-stone-200 bg-stone-50/30 p-3 flex justify-between items-center">
                      <div className="truncate pr-2">
                        <div className="font-semibold text-stone-800">{doc.label}</div>
                        <div className="text-[10px] text-stone-400 truncate">{filename || "No file uploaded"}</div>
                      </div>
                      {filename ? (
                        <a
                          href={`/api/kyc/${filename}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg transition-colors cursor-pointer"
                          title="View / Download securely"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-[10px] text-stone-400">-</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Moderation Controls Panel */}
            {selectedRequest.status === "PENDING_REVIEW" && (
              <div className="border-t border-stone-100 pt-6 space-y-4">
                <h3 className="font-semibold text-stone-900 text-sm">Compliance Verification Decision</h3>
                
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-stone-500">
                    Rejection / Suspension Comment <span className="text-stone-400">(Required for non-approvals)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter reason for rejecting or suspending this application..."
                    value={rejectionComment}
                    onChange={(e) => setRejectionComment(e.target.value)}
                    className="w-full text-xs p-3 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-100"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleAction("APPROVED")}
                    disabled={isPending}
                    className="flex-1 inline-flex justify-center items-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle className="h-4 w-4" /> Approve KYC
                  </button>

                  <button
                    onClick={() => handleAction("REJECTED")}
                    disabled={isPending}
                    className="flex-1 inline-flex justify-center items-center gap-1.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <XCircle className="h-4 w-4" /> Reject KYC
                  </button>

                  <button
                    onClick={() => handleAction("SUSPENDED")}
                    disabled={isPending}
                    className="flex-1 inline-flex justify-center items-center gap-1.5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-850 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <ShieldAlert className="h-4 w-4" /> Suspend Vendor
                  </button>
                </div>
              </div>
            )}

            {/* Approved controls (allow suspend) */}
            {selectedRequest.status === "APPROVED" && (
              <div className="border-t border-stone-100 pt-6 space-y-4">
                <h3 className="font-semibold text-stone-900 text-sm">Administrative Override</h3>
                
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-stone-500">
                    Reason for Suspension
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide compliance details explaining why this vendor is being suspended..."
                    value={rejectionComment}
                    onChange={(e) => setRejectionComment(e.target.value)}
                    className="w-full text-xs p-3 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-100"
                  />
                </div>

                <button
                  onClick={() => handleAction("SUSPENDED")}
                  disabled={isPending}
                  className="w-full inline-flex justify-center items-center gap-1.5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <ShieldAlert className="h-4 w-4" /> Suspend Approved Vendor Account
                </button>
              </div>
            )}

            {/* Non-pending status override warning (Rejected / Suspended status) */}
            {(selectedRequest.status === "REJECTED" || selectedRequest.status === "SUSPENDED") && (
              <div className="border-t border-stone-100 pt-6 space-y-2">
                <h4 className="font-semibold text-stone-900 text-xs uppercase">Compliance Action Log</h4>
                <div className="text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-lg p-3">
                  <strong>Status:</strong> {selectedRequest.status.replace("_", " ")}
                  {selectedRequest.rejectionReason && (
                    <div className="mt-1">
                      <strong>Log Reason:</strong> {selectedRequest.rejectionReason}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-stone-400 mt-2">
                  Once a submission is rejected, vendors are allowed to adjust details and resubmit. If a vendor is suspended, selling access is fully revoked and manual review is required.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-xs text-stone-400 py-20">
            <ShieldAlert className="h-10 w-10 text-stone-200 mb-2" />
            Select a vendor request from the left queue to view and audit submitted verification documents.
          </div>
        )}
      </div>
    </div>
  );
}
