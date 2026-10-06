"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Role } from "@prisma/client";
import fs from "fs/promises";
import path from "path";

/**
 * Adds a new background job to the queue.
 */
export async function enqueueJob(queue: string, payload: unknown, runAt = new Date()) {
  try {
    const job = await prisma.backgroundJob.create({
      data: {
        queue,
        payload: JSON.stringify(payload),
        runAt,
      },
    });
    return job;
  } catch (err) {
    console.error("Failed to enqueue background job:", err);
  }
}

/**
 * Runs the background worker to process pending database-backed jobs
 * and execute necessary data retention cleanup policies.
 */
export async function runBackgroundWorkerTasks() {
  const session = await auth().catch(() => null);
  if (session?.user?.role !== Role.ADMIN) {
    throw new Error("Access denied: Administrator privileges required.");
  }

  const results = {
    jobsProcessed: 0,
    jobsFailed: 0,
    logsCleaned: 0,
    notificationsCleaned: 0,
    filesCleaned: 0,
    errors: [] as string[],
  };

  const now = new Date();

  // ---------------------------------------------------------
  // 1. Process Database-Backed Jobs
  // ---------------------------------------------------------
  try {
    const pendingJobs = await prisma.backgroundJob.findMany({
      where: {
        status: "PENDING",
        runAt: { lte: now },
      },
      take: 10, // Batch limit
    });

    for (const job of pendingJobs) {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "PROCESSING", updatedAt: now },
      });

      try {
        const payload = JSON.parse(job.payload);
        
        // Execute based on queue type
        if (job.queue === "email") {
          // Process mock email queue
          console.log(`[Worker] Mocking email dispatch to: ${payload.recipient || "unknown"}`, payload);
        } else if (job.queue === "notifications") {
          // Notification worker actions (e.g. bulk notifications)
          console.log(`[Worker] Processing notification task...`);
        } else {
          console.log(`[Worker] Unknown queue type: ${job.queue}`);
        }

        // Mark as completed
        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: { status: "COMPLETED", updatedAt: now },
        });
        results.jobsProcessed++;
      } catch (jobErr) {
        const attempts = job.attempts + 1;
        const status = attempts >= job.maxAttempts ? "FAILED" : "PENDING";
        const errMsg = jobErr instanceof Error ? jobErr.message : String(jobErr);
        const errStack = jobErr instanceof Error ? jobErr.stack : undefined;
        
        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status,
            attempts,
            error: errStack || errMsg,
            updatedAt: now,
          },
        });

        results.jobsFailed++;
        results.errors.push(`Job ${job.id} failed: ${errMsg}`);
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    results.errors.push(`Jobs loop failure: ${errMsg}`);
  }

  // ---------------------------------------------------------
  // 2. Data Retention Cleanup Policies
  // ---------------------------------------------------------
  
  // Policy A: Cleanup SystemLogs & AuditLogs older than 90 days
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const systemLogDeletion = await prisma.systemLog.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    });
    const auditLogDeletion = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    });
    results.logsCleaned = systemLogDeletion.count + auditLogDeletion.count;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    results.errors.push(`Logs cleanup error: ${errMsg}`);
  }

  // Policy B: Cleanup read notifications older than 30 days
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const notifDeletion = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: { lt: thirtyDaysAgo },
      },
    });
    results.notificationsCleaned = notifDeletion.count;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    results.errors.push(`Notifications cleanup error: ${errMsg}`);
  }

  // Policy C: Cleanup failed/abandoned chat attachments (files in /chat-attachments > 7 days old that do not exist in Message table)
  try {
    const chatDir = path.join(process.cwd(), "chat-attachments");
    let files: string[] = [];
    try {
      files = await fs.readdir(chatDir);
    } catch {
      // Directory may not exist yet
    }

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const filename of files) {
      const filePath = path.join(chatDir, filename);
      const stats = await fs.stat(filePath).catch(() => null);
      if (!stats) continue;

      // Check if file is older than 7 days
      if (stats.mtimeMs < sevenDaysAgo) {
        // Query database if this file is referenced in any message attachmentUrl
        const activeMessage = await prisma.message.findFirst({
          where: {
            attachmentUrl: {
              contains: filename,
            },
          },
        });

        if (!activeMessage) {
          // Unlinked file - safe to delete
          await fs.unlink(filePath).catch(() => {});
          results.filesCleaned++;
        }
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    results.errors.push(`Abandoned attachments cleanup error: ${errMsg}`);
  }

  return results;
}

/**
 * Gets background worker dashboard metrics summary.
 */
export async function getWorkerSummary() {
  const session = await auth().catch(() => null);
  if (session?.user?.role !== Role.ADMIN) {
    throw new Error("Access denied.");
  }

  const [pending, processing, completed, failed] = await Promise.all([
    prisma.backgroundJob.count({ where: { status: "PENDING" } }),
    prisma.backgroundJob.count({ where: { status: "PROCESSING" } }),
    prisma.backgroundJob.count({ where: { status: "COMPLETED" } }),
    prisma.backgroundJob.count({ where: { status: "FAILED" } }),
  ]);

  const recentJobs = await prisma.backgroundJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    metrics: {
      pending,
      processing,
      completed,
      failed,
      total: pending + processing + completed + failed,
    },
    recentJobs,
  };
}
