"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { headers } from "next/headers";
import { sanitizeLogData } from "@/lib/log-sanitizer";

/**
 * Creates an AuditLog entry in the database.
 * Auto-resolves user session, IP address, and User-Agent from headers.
 */
export async function createAuditLog(
  action: string,
  entityType: string,
  entityId?: string | null,
  oldValue?: unknown,
  newValue?: unknown
) {
  try {
    const session = await auth().catch(() => null);
    const userId = session?.user?.id || null;

    let ipAddress = null;
    let userAgent = null;

    try {
      const headersList = await headers();
      ipAddress = headersList.get("x-forwarded-for")?.split(",")[0].trim() || 
                  headersList.get("x-real-ip") || 
                  "127.0.0.1";
      userAgent = headersList.get("user-agent") || null;
    } catch {
      // Fallback if headers are not available (e.g. running in script or build context)
    }

    const cleanOld = sanitizeLogData(oldValue);
    const cleanNew = sanitizeLogData(newValue);

    const log = await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId: entityId || null,
        oldValue: cleanOld,
        newValue: cleanNew,
        ipAddress,
        userAgent,
      },
    });

    return log;
  } catch (err) {
    console.error("Failed to create audit log:", err);
  }
}

export async function getAuditLogs(limit = 50) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Access denied.");
  }
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });
}
