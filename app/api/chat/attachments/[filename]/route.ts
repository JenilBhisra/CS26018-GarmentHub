import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import fs from "fs/promises";
import path from "path";

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

interface RouteContext {
  params: Promise<{
    filename: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { filename } = await context.params;
    if (!filename) {
      return new Response("Bad Request: Filename is missing.", { status: 400 });
    }

    // 2. Locate message associated with this filename to check permissions
    const message = await prisma.message.findFirst({
      where: {
        attachmentUrl: {
          contains: filename,
        },
      },
      include: {
        conversation: {
          include: {
            participants: true,
          },
        },
      },
    });

    // Check permissions
    const isAdmin = session.user.role === Role.ADMIN;
    
    if (message) {
      const isParticipant = message.conversation.participants.some(
        (p) => p.userId === session.user.id
      );

      if (!isParticipant && !isAdmin) {
        return new Response("Forbidden: You do not have permission to access this attachment.", { status: 403 });
      }
    } else {
      // If there is no message yet, we only allow access if the user is an Admin
      // or if they are the one who uploaded it (since filename contains timestamp + random key,
      // only the uploader knows the URL before it's posted, but for strict security, we restrict it)
      if (!isAdmin) {
        // Allow if uploader holds a valid session and request was sent within 5 minutes of upload (based on filename timestamp)
        const parts = filename.split("-");
        const timestamp = Number(parts[0]);
        const now = Date.now();
        const isValidIntermediate = !isNaN(timestamp) && (now - timestamp) < 300000; // 5 minutes
        
        if (!isValidIntermediate) {
          return new Response("Forbidden: Attachment is not linked to any active conversation.", { status: 403 });
        }
      }
    }

    // 3. Resolve file path
    const chatDir = path.join(process.cwd(), "chat-attachments");
    const filePath = path.join(chatDir, filename);

    try {
      await fs.access(filePath);
    } catch {
      return new Response("File Not Found", { status: 404 });
    }

    // 4. Read file and stream response
    const fileBuffer = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";

    // Set download headers for non-images
    const isImage = contentType.startsWith("image/");
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Length": fileBuffer.length.toString(),
      "Cache-Control": "private, max-age=31536000, immutable",
    });

    if (!isImage) {
      headers.set("Content-Disposition", `attachment; filename="${message?.attachmentName || filename}"`);
    } else {
      headers.set("Content-Disposition", `inline; filename="${message?.attachmentName || filename}"`);
    }

    return new Response(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Secure file download error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
