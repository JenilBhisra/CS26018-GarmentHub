import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "fs/promises";
import path from "path";

// Allowed file extensions
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx", ".xlsx"];

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
];

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized: Please sign in." }, { status: 401 });
    }

    // 2. Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file uploaded or file is empty." }, { status: 400 });
    }

    // 3. Extension check
    const fileExt = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json(
        { error: `File type not supported. Supported: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // 4. Mime-type check
    const mimeType = file.type;
    if (!ALLOWED_MIME_TYPES.includes(mimeType) && !mimeType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Invalid file content format." },
        { status: 400 }
      );
    }

    // 5. Size check
    const isImage = mimeType.startsWith("image/");
    const maxSize = isImage ? 10 * 1024 * 1024 : 25 * 1024 * 1024; // 10MB or 25MB

    if (file.size > maxSize) {
      const sizeLabel = isImage ? "10MB for images" : "25MB for documents";
      return NextResponse.json(
        { error: `File is too large. Maximum size is ${sizeLabel}.` },
        { status: 400 }
      );
    }

    // 6. Write to private chat-attachments directory in project root
    const chatDir = path.join(process.cwd(), "chat-attachments");
    await fs.mkdir(chatDir, { recursive: true });

    // Generate unique name
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}${fileExt}`;
    const filePath = path.join(chatDir, uniqueFilename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // 7. Return metadata and secure download URL
    return NextResponse.json({
      success: true,
      name: file.name,
      size: file.size,
      mimeType,
      url: `/api/chat/attachments/${uniqueFilename}`,
    });
  } catch (error) {
    console.error("Chat upload API error:", error);
    return NextResponse.json({ error: "Failed to upload attachment." }, { status: 500 });
  }
}
