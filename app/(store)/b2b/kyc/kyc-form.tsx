"use client";

import { useState, useTransition } from "react";
import { submitB2BKYC } from "@/actions/kyc";
import { AlertTriangle, CheckCircle2, UploadCloud, File, RefreshCw } from "lucide-react";
import { toast } from "sonner";

// Verhoeff tables for client Aadhaar validation
const d = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];
const p = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 0, 1, 9],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

function validateAadhaar(aadhaar: string): boolean {
  const clean = aadhaar.replace(/[\s-]/g, "");
  if (!/^\d{12}$/.test(clean)) return false;
  let c = 0;
  const digits = clean.split("").map(Number);
  const reverseDigits = digits.reverse();
  for (let i = 0; i < reverseDigits.length; i++) {
    c = d[c][p[i % 8][reverseDigits[i]]];
  }
  return c === 0;
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BANK_REGEX = /^[0-9]{9,18}$/;

function isFakePanPattern(pan: string): boolean {
  const clean = pan.toUpperCase().trim();
  if (clean === "ABCDE1234F" || clean === "ABCDE1234Z" || clean === "ABCDE1234A") return true;
  if (clean.length >= 5 && clean.substring(0, 5) === clean[0].repeat(5)) return true;
  for (let i = 0; i <= clean.length - 4; i++) {
    const char = clean[i];
    if (/\d/.test(char) && clean[i+1] === char && clean[i+2] === char && clean[i+3] === char) {
      return true;
    }
  }
  const sequentials = ["1234", "2345", "3456", "4567", "5678", "6789", "9876", "8765", "7654"];
  if (sequentials.some(seq => clean.includes(seq))) return true;
  return false;
}

interface KYCFormProps {
  initialData?: {
    gstNumber?: string | null;
    panNumber?: string | null;
    idNumber?: string | null;
    bankAccountHolderName?: string | null;
    bankAccountNumber?: string | null;
    bankIFSC?: string | null;
    businessRegNumber?: string | null;
    businessAddress?: string | null;
    city?: string | null;
    state?: string | null;
    pinCode?: string | null;
    gstCertificate?: string | null;
    panCard?: string | null;
    idProof?: string | null;
    addressProof?: string | null;
    bankProof?: string | null;
  };
}

export function B2BKYCForm({ initialData }: KYCFormProps) {
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    gstNumber: initialData?.gstNumber || "",
    panNumber: initialData?.panNumber || "",
    idNumber: initialData?.idNumber || "",
    bankAccountHolderName: initialData?.bankAccountHolderName || "",
    bankAccountNumber: initialData?.bankAccountNumber || "",
    bankIFSC: initialData?.bankIFSC || "",
    businessRegNumber: initialData?.businessRegNumber || "",
    businessAddress: initialData?.businessAddress || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    pinCode: initialData?.pinCode || ""
  });

  const [files, setFiles] = useState<Record<string, File | null>>({
    gstCertificate: null,
    panCard: null,
    idProof: null,
    addressProof: null,
    bankProof: null
  });

  const [previews, setPreviews] = useState<Record<string, string>>({});

  // Warnings states
  const [warnings, setWarnings] = useState<Record<string, string>>({});

  const validateField = (name: string, value: string) => {
    let warnMsg = "";
    if (name === "gstNumber" && value) {
      if (!GSTIN_REGEX.test(value.toUpperCase())) {
        warnMsg = "Invalid GSTIN format. Should be like 27AAAAA1111A1Z1.";
      }
    } else if (name === "panNumber" && value) {
      const upper = value.toUpperCase();
      if (!PAN_REGEX.test(upper)) {
        warnMsg = "Invalid PAN format. Should be like ABCDE1234F.";
      } else if (isFakePanPattern(upper)) {
        warnMsg = "Pattern matches common placeholders (e.g., sequential digits or letters).";
      }
    } else if (name === "idNumber" && value) {
      if (!validateAadhaar(value)) {
        warnMsg = "Aadhaar checksum validation failed or invalid length (must be 12 digits).";
      }
    } else if (name === "bankIFSC" && value) {
      if (!IFSC_REGEX.test(value.toUpperCase())) {
        warnMsg = "Invalid IFSC format. Should be like SBIN0001234.";
      }
    } else if (name === "bankAccountNumber" && value) {
      if (!BANK_REGEX.test(value)) {
        warnMsg = "Bank Account number should be numeric and between 9 to 18 digits.";
      }
    }

    setWarnings((prev) => ({
      ...prev,
      [name]: warnMsg
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  const handleFileChange = (name: string, file: File | null) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Max size is 5MB.`);
        return;
      }
      setFiles((prev) => ({ ...prev, [name]: file }));

      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviews((prev) => ({ ...prev, [name]: url }));
      } else {
        setPreviews((prev) => ({ ...prev, [name]: "" }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Final checks
    if (
      !formData.gstNumber ||
      !formData.panNumber ||
      !formData.idNumber ||
      !formData.bankAccountHolderName ||
      !formData.bankAccountNumber ||
      !formData.bankIFSC ||
      !formData.businessAddress ||
      !formData.city ||
      !formData.state ||
      !formData.pinCode
    ) {
      toast.error("Please fill in all required text fields.");
      return;
    }

    if (!initialData) {
      const missingFiles = Object.values(files).filter((f) => !f);
      if (missingFiles.length > 0) {
        toast.error("Please upload all 5 required verification document files.");
        return;
      }
    }

    startTransition(async () => {
      const submission = new FormData();
      Object.entries(formData).forEach(([k, v]) => submission.append(k, v));
      Object.entries(files).forEach(([k, file]) => {
        if (file) submission.append(k, file);
      });

      const res = await submitB2BKYC(submission);
      if (res.success) {
        toast.success("B2B KYC documents submitted successfully!");
        window.location.reload();
      } else {
        toast.error(res.error || "Failed to submit B2B KYC.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {Object.values(warnings).some((w) => w) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 flex gap-3 text-amber-800 text-xs">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <span className="font-semibold">Verification Warnings Detected:</span>
            <ul className="list-disc pl-4 mt-1 space-y-1">
              {Object.entries(warnings).map(([field, msg]) => {
                if (!msg) return null;
                const fieldLabel = {
                  gstNumber: "GSTIN",
                  panNumber: "PAN Card",
                  idNumber: "Aadhaar / Passport ID",
                  bankIFSC: "Bank IFSC",
                  bankAccountNumber: "Account Number"
                }[field];
                return (
                  <li key={field}>
                    <strong>{fieldLabel}:</strong> {msg}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-amber-700">
              Note: B2B KYC allows submission despite pattern warnings. Compliance administrators will review flagged discrepancies manually.
            </p>
          </div>
        </div>
      )}

      {/* Section: Business Identifiers */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-stone-900">Business Identifiers</h3>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              GSTIN Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="gstNumber"
              value={formData.gstNumber}
              onChange={handleChange}
              placeholder="e.g. 27AAAAA1111A1Z1"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                warnings.gstNumber ? "border-amber-400 focus:ring-amber-200" : "border-stone-200 focus:ring-stone-100"
              }`}
              required
            />
            {warnings.gstNumber && <p className="text-xs text-amber-600 mt-1">{warnings.gstNumber}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              PAN Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="panNumber"
              value={formData.panNumber}
              onChange={handleChange}
              placeholder="e.g. ABCDE1234F"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                warnings.panNumber ? "border-amber-400 focus:ring-amber-200" : "border-stone-200 focus:ring-stone-100"
              }`}
              required
            />
            {warnings.panNumber && <p className="text-xs text-amber-600 mt-1">{warnings.panNumber}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              Aadhaar / Passport ID Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="idNumber"
              value={formData.idNumber}
              onChange={handleChange}
              placeholder="12-digit Aadhaar or ID code"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                warnings.idNumber ? "border-amber-400 focus:ring-amber-200" : "border-stone-200 focus:ring-stone-100"
              }`}
              required
            />
            {warnings.idNumber && <p className="text-xs text-amber-600 mt-1">{warnings.idNumber}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              Business Registration Number <span className="text-stone-400">(Optional)</span>
            </label>
            <input
              type="text"
              name="businessRegNumber"
              value={formData.businessRegNumber}
              onChange={handleChange}
              placeholder="MSME / Corporate Reg ID"
              className="w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-100"
            />
          </div>
        </div>
      </div>

      <hr className="border-stone-200" />

      {/* Section: Business Address */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-stone-900">Business Address</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              Business Address <span className="text-red-500">*</span>
            </label>
            <textarea
              name="businessAddress"
              rows={2}
              value={formData.businessAddress}
              onChange={handleChange}
              placeholder="Complete physical office / warehouse address"
              className="w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-100"
              required
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="e.g. Mumbai"
                className="w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="e.g. Maharashtra"
                className="w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                PIN Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="pinCode"
                value={formData.pinCode}
                onChange={handleChange}
                placeholder="6-digit postal code"
                className="w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-100"
                required
              />
            </div>
          </div>
        </div>
      </div>

      <hr className="border-stone-200" />

      {/* Section: Bank Details */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-stone-900">Settlement Bank Account Information</h3>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              Holder Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="bankAccountHolderName"
              value={formData.bankAccountHolderName}
              onChange={handleChange}
              placeholder="As per bank records"
              className="w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-100"
              required
            />
          </div>

          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              Account Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="bankAccountNumber"
              value={formData.bankAccountNumber}
              onChange={handleChange}
              placeholder="Account numeric ID"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                warnings.bankAccountNumber ? "border-amber-400 focus:ring-amber-200" : "border-stone-200 focus:ring-stone-100"
              }`}
              required
            />
            {warnings.bankAccountNumber && <p className="text-xs text-amber-600 mt-1">{warnings.bankAccountNumber}</p>}
          </div>

          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              IFSC Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="bankIFSC"
              value={formData.bankIFSC}
              onChange={handleChange}
              placeholder="e.g. SBIN0001234"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                warnings.bankIFSC ? "border-amber-400 focus:ring-amber-200" : "border-stone-200 focus:ring-stone-100"
              }`}
              required
            />
            {warnings.bankIFSC && <p className="text-xs text-amber-600 mt-1">{warnings.bankIFSC}</p>}
          </div>
        </div>
      </div>

      <hr className="border-stone-200" />

      {/* Section: File Uploads */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-stone-900">Upload Business Verification Documents</h3>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { key: "gstCertificate", label: "GST Registration Certificate" },
            { key: "panCard", label: "PAN Card Document" },
            { key: "idProof", label: "Aadhaar / Passport Proof" },
            { key: "addressProof", label: "Business Address Proof" },
            { key: "bankProof", label: "Cheque / Passbook Copy" }
          ].map((doc) => {
            const hasExisting = initialData?.[doc.key as keyof typeof initialData];
            const file = files[doc.key];
            const preview = previews[doc.key];
            return (
              <div key={doc.key} className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 space-y-3">
                <div className="text-xs font-semibold text-stone-700">{doc.label} <span className="text-red-500">*</span></div>
                
                {hasExisting && !file && (
                  <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg p-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="truncate">Existing document file loaded</span>
                  </div>
                )}

                <label className="relative flex flex-col items-center justify-center border-2 border-dashed border-stone-200 hover:border-stone-400 rounded-lg p-4 cursor-pointer bg-white transition-colors">
                  <UploadCloud className="h-6 w-6 text-stone-400" />
                  <span className="text-xs text-stone-500 mt-1">Select File</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => handleFileChange(doc.key, e.target.files?.[0] || null)}
                  />
                </label>

                {preview && (
                  <div className="mt-2 relative rounded-lg border border-stone-200 overflow-hidden bg-stone-100 aspect-[4/3] w-full max-h-36">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Thumbnail preview" className="w-full h-full object-contain" />
                  </div>
                )}

                {file && !preview && (
                  <div className="flex items-center gap-2 text-xs bg-stone-100 rounded-lg p-2 overflow-hidden truncate">
                    <File className="h-4 w-4 text-stone-500 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-8 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isPending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" /> Submitting Details...
            </>
          ) : (
            "Submit KYC Details"
          )}
        </button>
      </div>
    </form>
  );
}
