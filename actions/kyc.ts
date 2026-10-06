"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rateLimit } from "@/lib/rate-limit";
import { createAuditLog } from "@/actions/audit";
import fs from "fs/promises";
import path from "path";
import { sendInAppNotification } from "@/actions/notifications";
import { sendNotificationEmail } from "@/lib/email";
import { NotificationType } from "@prisma/client";

async function notifyAdminsOfKYC(
  profileType: "Seller" | "B2B Buyer",
  profileName: string,
  isSuspicious: boolean,
  suspiciousReasons: string[]
) {
  try {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
    for (const admin of admins) {
      if (isSuspicious) {
        await sendInAppNotification(
          admin.id,
          NotificationType.SUSPICIOUS_KYC,
          "Suspicious KYC Flagged",
          `KYC submission from ${profileType} "${profileName}" triggered validation warnings.`,
          "/admin/kyc"
        );
        
        await sendNotificationEmail(
          admin.email,
          "⚠️ WARNING: KYC Compliance Alert",
          "ADMIN_SUSPICIOUS_KYC_ALERT",
          {
            profileType,
            profileName,
            warnings: suspiciousReasons,
          }
        );
      } else {
        await sendNotificationEmail(
          admin.email,
          "New KYC Verification Request",
          "ADMIN_NEW_KYC_REQUEST",
          {
            profileType,
            profileName,
          }
        );
      }
    }
  } catch (err) {
    console.error("Failed to notify admins of KYC:", err);
  }
}

// Verhoeff algorithm multiplication table
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

// Permutation table
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

function validateVerhoeff(aadhaar: string): boolean {
  if (!/^\d{12}$/.test(aadhaar)) return false;
  let c = 0;
  const digits = aadhaar.split("").map(Number);
  const reverseDigits = digits.reverse();
  for (let i = 0; i < reverseDigits.length; i++) {
    c = d[c][p[i % 8][reverseDigits[i]]];
  }
  return c === 0;
}

// Format Regexes
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BANK_REGEX = /^[0-9]{9,18}$/;

function isFakePanPattern(pan: string): boolean {
  const clean = pan.toUpperCase().trim();
  if (clean === "ABCDE1234F" || clean === "ABCDE1234Z" || clean === "ABCDE1234A") return true;
  // Repeated letters at start (e.g. AAAAA)
  if (clean.length >= 5 && clean.substring(0, 5) === clean[0].repeat(5)) return true;
  // Repeated numbers (e.g. 1111)
  for (let i = 0; i <= clean.length - 4; i++) {
    const char = clean[i];
    if (/\d/.test(char) && clean[i+1] === char && clean[i+2] === char && clean[i+3] === char) {
      return true;
    }
  }
  // Sequential numbers
  const sequentials = ["1234", "2345", "3456", "4567", "5678", "6789", "9876", "8765", "7654"];
  if (sequentials.some(seq => clean.includes(seq))) return true;
  return false;
}

// Secure file saving logic inside project root/kyc-documents/
async function saveKYCFile(file: File): Promise<string> {
  const kycDir = path.join(process.cwd(), "kyc-documents");
  await fs.mkdir(kycDir, { recursive: true });

  const fileExtension = path.extname(file.name);
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}${fileExtension}`;
  const filePath = path.join(kycDir, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return fileName;
}

export async function submitSellerKYC(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { success: false, error: "Unauthorized" };
  }

  const limit = await rateLimit("kyc", session.user.id);
  if (!limit.success) {
    return { success: false, error: "Too many KYC submission attempts. Please try again in an hour." };
  }

  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      storeName: true,
    }
  });

  if (!sellerProfile) {
    return { success: false, error: "Seller profile not found. Please register first." };
  }

  const sellerId = sellerProfile.id;

  // Text inputs
  const gstNumber = (formData.get("gstNumber") as string || "").toUpperCase().trim();
  const panNumber = (formData.get("panNumber") as string || "").toUpperCase().trim();
  const idNumber = (formData.get("idNumber") as string || "").trim();
  const bankAccountHolderName = (formData.get("bankAccountHolderName") as string || "").trim();
  const bankAccountNumber = (formData.get("bankAccountNumber") as string || "").trim();
  const bankIFSC = (formData.get("bankIFSC") as string || "").toUpperCase().trim();
  const businessRegNumber = (formData.get("businessRegNumber") as string || "").trim();
  const businessAddress = (formData.get("businessAddress") as string || "").trim();
  const city = (formData.get("city") as string || "").trim();
  const state = (formData.get("state") as string || "").trim();
  const pinCode = (formData.get("pinCode") as string || "").trim();

  // Validate required inputs are present
  if (!gstNumber || !panNumber || !idNumber || !bankAccountHolderName || !bankAccountNumber || !bankIFSC || !businessAddress || !city || !state || !pinCode) {
    return { success: false, error: "All required validation fields must be provided." };
  }

  // Format validation and suspicious flagging
  const suspiciousReasons: string[] = [];
  const formatLogs: Record<string, boolean> = {};

  // 1. GST check
  const isGstValid = GSTIN_REGEX.test(gstNumber);
  formatLogs.gstValid = isGstValid;
  if (!isGstValid) {
    suspiciousReasons.push(`Invalid GSTIN number format ("${gstNumber}").`);
  }

  // 2. PAN check
  const isPanValid = PAN_REGEX.test(panNumber);
  formatLogs.panValid = isPanValid;
  if (!isPanValid) {
    suspiciousReasons.push(`Invalid PAN card format ("${panNumber}").`);
  } else if (isFakePanPattern(panNumber)) {
    suspiciousReasons.push(`PAN number "${panNumber}" matches a suspicious pattern (placeholder or repeated digits).`);
  }

  // 3. Aadhaar check
  const isAadhaarValid = validateVerhoeff(idNumber);
  formatLogs.idValid = isAadhaarValid;
  if (!isAadhaarValid) {
    suspiciousReasons.push(`Invalid Aadhaar/Passport ID number checksum or length ("${idNumber}").`);
  }

  // 4. IFSC check
  const isIfscValid = IFSC_REGEX.test(bankIFSC);
  formatLogs.ifscValid = isIfscValid;
  if (!isIfscValid) {
    suspiciousReasons.push(`Invalid Bank IFSC code format ("${bankIFSC}").`);
  }

  // 5. Account check
  const isAccountValid = BANK_REGEX.test(bankAccountNumber);
  formatLogs.accountValid = isAccountValid;
  if (!isAccountValid) {
    suspiciousReasons.push(`Invalid Bank Account number format ("${bankAccountNumber}").`);
  }

  // Duplicate checks in database
  // GST Duplicate check
  const dupGstSeller = await prisma.sellerKYC.findFirst({
    where: { gstNumber, sellerId: { not: sellerId }, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  const dupGstB2b = await prisma.b2BKYC.findFirst({
    where: { gstNumber, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  if (dupGstSeller || dupGstB2b) {
    suspiciousReasons.push(`GSTIN "${gstNumber}" is already linked to another active or pending vendor profile.`);
  }

  // PAN Duplicate check
  const dupPanSeller = await prisma.sellerKYC.findFirst({
    where: { panNumber, sellerId: { not: sellerId }, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  const dupPanB2b = await prisma.b2BKYC.findFirst({
    where: { panNumber, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  if (dupPanSeller || dupPanB2b) {
    suspiciousReasons.push(`PAN "${panNumber}" is already linked to another active or pending vendor profile.`);
  }

  // Aadhaar Duplicate check
  const dupIdSeller = await prisma.sellerKYC.findFirst({
    where: { idNumber, sellerId: { not: sellerId }, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  const dupIdB2b = await prisma.b2BKYC.findFirst({
    where: { idNumber, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  if (dupIdSeller || dupIdB2b) {
    suspiciousReasons.push(`Aadhaar/ID number "${idNumber}" is already linked to another active or pending vendor profile.`);
  }

  // Bank Account Duplicate check
  const dupBankSeller = await prisma.sellerKYC.findFirst({
    where: { bankAccountNumber, sellerId: { not: sellerId }, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  const dupBankB2b = await prisma.b2BKYC.findFirst({
    where: { bankAccountNumber, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  if (dupBankSeller || dupBankB2b) {
    suspiciousReasons.push(`Bank account number "${bankAccountNumber}" is already in use by another vendor profile.`);
  }

  const isSuspicious = suspiciousReasons.length > 0;

  // File uploads
  const gstCertificateFile = formData.get("gstCertificate") as File | null;
  const panCardFile = formData.get("panCard") as File | null;
  const idProofFile = formData.get("idProof") as File | null;
  const addressProofFile = formData.get("addressProof") as File | null;
  const bankProofFile = formData.get("bankProof") as File | null;

  const existingKyc = await prisma.sellerKYC.findUnique({
    where: { sellerId }
  });

  // Verify certificate files are present for first time submission
  if (!existingKyc) {
    if (!gstCertificateFile || gstCertificateFile.size === 0 ||
        !panCardFile || panCardFile.size === 0 ||
        !idProofFile || idProofFile.size === 0 ||
        !addressProofFile || addressProofFile.size === 0 ||
        !bankProofFile || bankProofFile.size === 0) {
      return { success: false, error: "All 5 KYC verification document files must be uploaded." };
    }
  }

  // Save new files if selected
  const gstCertificate = gstCertificateFile && gstCertificateFile.size > 0 ? await saveKYCFile(gstCertificateFile) : existingKyc?.gstCertificate;
  const panCard = panCardFile && panCardFile.size > 0 ? await saveKYCFile(panCardFile) : existingKyc?.panCard;
  const idProof = idProofFile && idProofFile.size > 0 ? await saveKYCFile(idProofFile) : existingKyc?.idProof;
  const addressProof = addressProofFile && addressProofFile.size > 0 ? await saveKYCFile(addressProofFile) : existingKyc?.addressProof;
  const bankProof = bankProofFile && bankProofFile.size > 0 ? await saveKYCFile(bankProofFile) : existingKyc?.bankProof;

  try {
    await prisma.sellerKYC.upsert({
      where: { sellerId },
      update: {
        status: "PENDING_REVIEW",
        gstCertificate,
        panCard,
        idProof,
        addressProof,
        bankProof,
        gstNumber,
        panNumber,
        idNumber,
        bankAccountHolderName,
        bankAccountNumber,
        bankIFSC,
        businessRegNumber,
        businessAddress,
        city,
        state,
        pinCode,
        isSuspicious,
        suspiciousReasons,
        documentValidation: formatLogs,
        rejectionReason: null,
      },
      create: {
        sellerId,
        status: "PENDING_REVIEW",
        gstCertificate: gstCertificate || "",
        panCard: panCard || "",
        idProof: idProof || "",
        addressProof: addressProof || "",
        bankProof: bankProof || "",
        gstNumber,
        panNumber,
        idNumber,
        bankAccountHolderName,
        bankAccountNumber,
        bankIFSC,
        businessRegNumber,
        businessAddress,
        city,
        state,
        pinCode,
        isSuspicious,
        suspiciousReasons,
        documentValidation: formatLogs,
      }
    });

    // Notify admins of new KYC submission
    notifyAdminsOfKYC(
      "Seller",
      sellerProfile.storeName,
      isSuspicious,
      suspiciousReasons
    ).catch((err) => console.error("Admin KYC notification failed:", err));

    await createAuditLog(
      "SUBMIT_SELLER_KYC",
      "SellerKYC",
      sellerId,
      existingKyc ? { gstNumber: existingKyc.gstNumber, status: existingKyc.status } : null,
      { gstNumber, panNumber, idNumber, bankAccountNumber, isSuspicious }
    );

    revalidatePath("/seller/kyc");
    revalidatePath("/admin/kyc");
    return { success: true };
  } catch (error: unknown) {
    console.error("submitSellerKYC error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to submit KYC documents." };
  }
}

export async function submitB2BKYC(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "B2B_VENDOR") {
    return { success: false, error: "Unauthorized" };
  }

  const limit = await rateLimit("kyc", session.user.id);
  if (!limit.success) {
    return { success: false, error: "Too many KYC submission attempts. Please try again in an hour." };
  }

  const b2bProfile = await prisma.b2BProfile.findUnique({
    where: { userId: session.user.id }
  });

  if (!b2bProfile) {
    return { success: false, error: "B2B profile not found. Please onboard first." };
  }

  const b2bId = b2bProfile.id;

  // Text inputs
  const gstNumber = (formData.get("gstNumber") as string || "").toUpperCase().trim();
  const panNumber = (formData.get("panNumber") as string || "").toUpperCase().trim();
  const idNumber = (formData.get("idNumber") as string || "").trim();
  const bankAccountHolderName = (formData.get("bankAccountHolderName") as string || "").trim();
  const bankAccountNumber = (formData.get("bankAccountNumber") as string || "").trim();
  const bankIFSC = (formData.get("bankIFSC") as string || "").toUpperCase().trim();
  const businessRegNumber = (formData.get("businessRegNumber") as string || "").trim();
  const businessAddress = (formData.get("businessAddress") as string || "").trim();
  const city = (formData.get("city") as string || "").trim();
  const state = (formData.get("state") as string || "").trim();
  const pinCode = (formData.get("pinCode") as string || "").trim();

  // Validate required inputs are present
  if (!gstNumber || !panNumber || !idNumber || !bankAccountHolderName || !bankAccountNumber || !bankIFSC || !businessAddress || !city || !state || !pinCode) {
    return { success: false, error: "All required validation fields must be provided." };
  }

  // Format validation and suspicious flagging
  const suspiciousReasons: string[] = [];
  const formatLogs: Record<string, boolean> = {};

  // 1. GST check
  const isGstValid = GSTIN_REGEX.test(gstNumber);
  formatLogs.gstValid = isGstValid;
  if (!isGstValid) {
    suspiciousReasons.push(`Invalid GSTIN number format ("${gstNumber}").`);
  }

  // 2. PAN check
  const isPanValid = PAN_REGEX.test(panNumber);
  formatLogs.panValid = isPanValid;
  if (!isPanValid) {
    suspiciousReasons.push(`Invalid PAN card format ("${panNumber}").`);
  } else if (isFakePanPattern(panNumber)) {
    suspiciousReasons.push(`PAN number "${panNumber}" matches a suspicious pattern (placeholder or repeated digits).`);
  }

  // 3. Aadhaar check
  const isAadhaarValid = validateVerhoeff(idNumber);
  formatLogs.idValid = isAadhaarValid;
  if (!isAadhaarValid) {
    suspiciousReasons.push(`Invalid Aadhaar/Passport ID number checksum or length ("${idNumber}").`);
  }

  // 4. IFSC check
  const isIfscValid = IFSC_REGEX.test(bankIFSC);
  formatLogs.ifscValid = isIfscValid;
  if (!isIfscValid) {
    suspiciousReasons.push(`Invalid Bank IFSC code format ("${bankIFSC}").`);
  }

  // 5. Account check
  const isAccountValid = BANK_REGEX.test(bankAccountNumber);
  formatLogs.accountValid = isAccountValid;
  if (!isAccountValid) {
    suspiciousReasons.push(`Invalid Bank Account number format ("${bankAccountNumber}").`);
  }

  // Duplicate checks in database
  // GST Duplicate check
  const dupGstSeller = await prisma.sellerKYC.findFirst({
    where: { gstNumber, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  const dupGstB2b = await prisma.b2BKYC.findFirst({
    where: { gstNumber, b2bId: { not: b2bId }, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  if (dupGstSeller || dupGstB2b) {
    suspiciousReasons.push(`GSTIN "${gstNumber}" is already linked to another active or pending vendor profile.`);
  }

  // PAN Duplicate check
  const dupPanSeller = await prisma.sellerKYC.findFirst({
    where: { panNumber, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  const dupPanB2b = await prisma.b2BKYC.findFirst({
    where: { panNumber, b2bId: { not: b2bId }, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  if (dupPanSeller || dupPanB2b) {
    suspiciousReasons.push(`PAN "${panNumber}" is already linked to another active or pending vendor profile.`);
  }

  // Aadhaar Duplicate check
  const dupIdSeller = await prisma.sellerKYC.findFirst({
    where: { idNumber, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  const dupIdB2b = await prisma.b2BKYC.findFirst({
    where: { idNumber, b2bId: { not: b2bId }, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  if (dupIdSeller || dupIdB2b) {
    suspiciousReasons.push(`Aadhaar/ID number "${idNumber}" is already linked to another active or pending vendor profile.`);
  }

  // Bank Account Duplicate check
  const dupBankSeller = await prisma.sellerKYC.findFirst({
    where: { bankAccountNumber, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  const dupBankB2b = await prisma.b2BKYC.findFirst({
    where: { bankAccountNumber, b2bId: { not: b2bId }, status: { in: ["APPROVED", "PENDING_REVIEW"] } }
  });
  if (dupBankSeller || dupBankB2b) {
    suspiciousReasons.push(`Bank account number "${bankAccountNumber}" is already in use by another vendor profile.`);
  }

  const isSuspicious = suspiciousReasons.length > 0;

  // File uploads
  const gstCertificateFile = formData.get("gstCertificate") as File | null;
  const panCardFile = formData.get("panCard") as File | null;
  const idProofFile = formData.get("idProof") as File | null;
  const addressProofFile = formData.get("addressProof") as File | null;
  const bankProofFile = formData.get("bankProof") as File | null;

  const existingKyc = await prisma.b2BKYC.findUnique({
    where: { b2bId }
  });

  // Verify certificate files are present for first time submission
  if (!existingKyc) {
    if (!gstCertificateFile || gstCertificateFile.size === 0 ||
        !panCardFile || panCardFile.size === 0 ||
        !idProofFile || idProofFile.size === 0 ||
        !addressProofFile || addressProofFile.size === 0 ||
        !bankProofFile || bankProofFile.size === 0) {
      return { success: false, error: "All 5 KYC verification document files must be uploaded." };
    }
  }

  // Save new files if selected
  const gstCertificate = gstCertificateFile && gstCertificateFile.size > 0 ? await saveKYCFile(gstCertificateFile) : existingKyc?.gstCertificate;
  const panCard = panCardFile && panCardFile.size > 0 ? await saveKYCFile(panCardFile) : existingKyc?.panCard;
  const idProof = idProofFile && idProofFile.size > 0 ? await saveKYCFile(idProofFile) : existingKyc?.idProof;
  const addressProof = addressProofFile && addressProofFile.size > 0 ? await saveKYCFile(addressProofFile) : existingKyc?.addressProof;
  const bankProof = bankProofFile && bankProofFile.size > 0 ? await saveKYCFile(bankProofFile) : existingKyc?.bankProof;

  try {
    await prisma.b2BKYC.upsert({
      where: { b2bId },
      update: {
        status: "PENDING_REVIEW",
        gstCertificate,
        panCard,
        idProof,
        addressProof,
        bankProof,
        gstNumber,
        panNumber,
        idNumber,
        bankAccountHolderName,
        bankAccountNumber,
        bankIFSC,
        businessRegNumber,
        businessAddress,
        city,
        state,
        pinCode,
        isSuspicious,
        suspiciousReasons,
        documentValidation: formatLogs,
        rejectionReason: null,
      },
      create: {
        b2bId,
        status: "PENDING_REVIEW",
        gstCertificate: gstCertificate || "",
        panCard: panCard || "",
        idProof: idProof || "",
        addressProof: addressProof || "",
        bankProof: bankProof || "",
        gstNumber,
        panNumber,
        idNumber,
        bankAccountHolderName,
        bankAccountNumber,
        bankIFSC,
        businessRegNumber,
        businessAddress,
        city,
        state,
        pinCode,
        isSuspicious,
        suspiciousReasons,
        documentValidation: formatLogs,
      }
    });

    // Notify admins of new B2B KYC submission
    notifyAdminsOfKYC(
      "B2B Buyer",
      b2bProfile.companyName,
      isSuspicious,
      suspiciousReasons
    ).catch((err) => console.error("Admin B2B KYC notification failed:", err));

    await createAuditLog(
      "SUBMIT_B2B_KYC",
      "B2BKYC",
      b2bId,
      existingKyc ? { gstNumber: existingKyc.gstNumber, status: existingKyc.status } : null,
      { gstNumber, panNumber, idNumber, bankAccountNumber, isSuspicious }
    );

    revalidatePath("/b2b/kyc");
    revalidatePath("/admin/kyc");
    return { success: true };
  } catch (error: unknown) {
    console.error("submitB2BKYC error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to submit KYC documents." };
  }
}

export async function reviewKYC(
  kycId: string,
  type: "SELLER" | "B2B",
  status: "APPROVED" | "REJECTED" | "SUSPENDED",
  rejectionReason?: string
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized: Admin privileges required." };
  }

  const verifiedById = session.user.id;
  const verifiedAt = status === "APPROVED" ? new Date() : null;

  try {
    let targetUserId = "";
    let profileName = "";

    if (type === "SELLER") {
      const kyc = await prisma.sellerKYC.update({
        where: { id: kycId },
        data: {
          status,
          verifiedById,
          verifiedAt,
          rejectionReason: status === "REJECTED" ? rejectionReason || "Rejected by administrator" : null,
        },
        include: {
          seller: {
            include: { user: true },
          },
        },
      });
      targetUserId = kyc.seller.userId;
      profileName = kyc.seller.storeName;
    } else {
      const kyc = await prisma.b2BKYC.update({
        where: { id: kycId },
        data: {
          status,
          verifiedById,
          verifiedAt,
          rejectionReason: status === "REJECTED" ? rejectionReason || "Rejected by administrator" : null,
        },
        include: {
          b2b: {
            include: { user: true },
          },
        },
      });
      targetUserId = kyc.b2b.userId;
      profileName = kyc.b2b.companyName;
    }

    // Trigger in-app notifications
    if (status === "APPROVED") {
      sendInAppNotification(
        targetUserId,
        NotificationType.KYC_APPROVED,
        "KYC Approved",
        `Congratulations! Your business KYC for "${profileName}" has been approved.`,
        type === "SELLER" ? "/seller/kyc" : "/b2b/kyc"
      ).catch((err) => console.error("KYC Approved in-app failed:", err));
    } else if (status === "REJECTED") {
      sendInAppNotification(
        targetUserId,
        NotificationType.KYC_REJECTED,
        "KYC Rejected",
        `Your business KYC for "${profileName}" was rejected. Reason: ${rejectionReason || "Validation failure"}`,
        type === "SELLER" ? "/seller/kyc" : "/b2b/kyc"
      ).catch((err) => console.error("KYC Rejected in-app failed:", err));
    }

    await createAuditLog(
      "REVIEW_KYC",
      type === "SELLER" ? "SellerProfile" : "B2BProfile",
      kycId,
      { status: "PENDING_REVIEW" },
      { status, rejectionReason }
    );

    revalidatePath("/seller/kyc");
    revalidatePath("/b2b/kyc");
    revalidatePath("/admin/kyc");
    revalidatePath("/seller");
    revalidatePath("/b2b");
    return { success: true };
  } catch (error: unknown) {
    console.error("reviewKYC error:", error);
    return { success: false, error: "Failed to update KYC status." };
  }
}

export async function ensureKycApproved() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role === "ADMIN") {
    return;
  }
  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      approvalStatus: true,
      kyc: {
        select: {
          status: true,
        },
      },
    },
  });
  if (!sellerProfile || sellerProfile.approvalStatus !== "APPROVED") {
    redirect("/seller/register");
  }
  if (sellerProfile.kyc?.status !== "APPROVED") {
    redirect("/seller/kyc");
  }
}
