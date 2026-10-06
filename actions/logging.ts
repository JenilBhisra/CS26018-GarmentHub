"use server";

import { prisma } from "@/lib/prisma";
import { LogLevel } from "@prisma/client";
import { sanitizeLogData } from "@/lib/log-sanitizer";

/**
 * Creates a SystemLog entry in the database.
 * Auto-filters sensitive secrets from message text or contexts.
 */
export async function logSystemEvent(
  level: LogLevel,
  message: string,
  context?: unknown
) {
  try {
    // Basic sanitization of message string if it contains any password/secret strings (rare but good safeguard)
    let cleanMessage = message;
    if (message.toLowerCase().includes("password") || message.toLowerCase().includes("secret") || message.toLowerCase().includes("key")) {
      cleanMessage = "[SANITIZED] System event message contained potential security details.";
    }

    const cleanContext = sanitizeLogData(context);

    const log = await prisma.systemLog.create({
      data: {
        level,
        message: cleanMessage,
        context: cleanContext,
      },
    });

    return log;
  } catch (err) {
    console.error("Failed to write system log to database:", err);
  }
}

// Helper utility shortcuts
export async function logInfo(message: string, context?: unknown) {
  return logSystemEvent(LogLevel.INFO, message, context);
}

export async function logWarn(message: string, context?: unknown) {
  return logSystemEvent(LogLevel.WARN, message, context);
}

export async function logError(message: string, context?: unknown) {
  return logSystemEvent(LogLevel.ERROR, message, context);
}

export async function getSystemLogs(level?: LogLevel, limit = 50) {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Access denied.");
  }
  return prisma.systemLog.findMany({
    where: level ? { level } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
