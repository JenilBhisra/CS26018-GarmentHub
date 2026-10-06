import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { filename } = await params;
  if (!filename) {
    return new NextResponse("Filename is required", { status: 400 });
  }

  let isAuthorized = false;

  if (session.user.role === "ADMIN") {
    isAuthorized = true;
  } else {
    // 1. Check Seller KYC ownership
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id },
      include: { kyc: true }
    });

    if (sellerProfile?.kyc) {
      const kyc = sellerProfile.kyc;
      if (
        kyc.gstCertificate === filename ||
        kyc.panCard === filename ||
        kyc.idProof === filename ||
        kyc.addressProof === filename ||
        kyc.bankProof === filename
      ) {
        isAuthorized = true;
      }
    }

    // 2. Check B2B KYC ownership
    if (!isAuthorized) {
      const b2bProfile = await prisma.b2BProfile.findUnique({
        where: { userId: session.user.id },
        include: { kyc: true }
      });

      if (b2bProfile?.kyc) {
        const kyc = b2bProfile.kyc;
        if (
          kyc.gstCertificate === filename ||
          kyc.panCard === filename ||
          kyc.idProof === filename ||
          kyc.addressProof === filename ||
          kyc.bankProof === filename
        ) {
          isAuthorized = true;
        }
      }
    }
  }

  if (!isAuthorized) {
    return new NextResponse("Forbidden: You do not have permission to view this document.", { status: 403 });
  }

  const kycPath = path.join(process.cwd(), "kyc-documents", filename);
  try {
    const fileBuffer = await fs.readFile(kycPath);
    const ext = path.extname(filename).toLowerCase();
    
    let contentType = "application/octet-stream";
    if (ext === ".pdf") contentType = "application/pdf";
    else if (ext === ".png") contentType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`
      }
    });
  } catch (error) {
    console.error("KYC File read error:", error);
    return new NextResponse("File not found", { status: 404 });
  }
}
