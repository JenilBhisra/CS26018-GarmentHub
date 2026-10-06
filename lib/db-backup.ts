"use server";

import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { Role } from "@prisma/client";

const BACKUP_DIR = path.join(process.cwd(), "backups");

// Order is important during insertion to satisfy foreign key constraints
const TABLE_ORDER = [
  "category",
  "user",
  "sellerProfile",
  "b2BProfile",
  "product",
  "productVariant",
  "cart",
  "cartItem",
  "coupon",
  "order",
  "orderItem",
  "notification",
  "review",
  "wishlist",
  "promotion",
  "conversation",
  "conversationParticipant",
  "message",
  "messageReaction",
  "conversationTyping",
  "auditLog",
  "systemLog",
  "backgroundJob"
];

/**
 * Exports all database tables to a structured JSON file.
 */
export async function exportDbBackup() {
  const session = await auth();
  if (session?.user?.role !== Role.ADMIN) {
    throw new Error("Access denied: Administrator privileges required.");
  }

  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const backupData: Record<string, unknown[]> = {};

    // Fetch all records from each table
    for (const table of TABLE_ORDER) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (prisma as any)[table];
      if (client && typeof client.findMany === "function") {
        const records = await client.findMany();
        backupData[table] = records;
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `db-backup-${timestamp}.json`;
    const filePath = path.join(BACKUP_DIR, filename);

    await fs.writeFile(filePath, JSON.stringify(backupData, null, 2), "utf8");

    return {
      success: true,
      message: `Database backup exported successfully to ${filename}`,
      filePath,
      filename,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Backup export error:", err);
    throw new Error(`Failed to export database backup: ${errMsg}`);
  }
}

/**
 * Manually restores the database from a backup JSON file.
 * Restricted to localhost/development and requires a verification key to prevent accidents.
 */
export async function restoreDbBackup(filename: string, safetyKey: string) {
  const session = await auth();
  if (session?.user?.role !== Role.ADMIN) {
    throw new Error("Access denied: Administrator privileges required.");
  }

  // Safety Gate 1: Check environment
  if (process.env.NODE_ENV === "production") {
    throw new Error("Restoration BLOCKED: Database restoration is disabled in production environments.");
  }

  // Safety Gate 2: Check safety key
  const EXPECTED_SAFETY_KEY = "RESTORE_DEV_DATABASE_GARMENTHUB";
  if (safetyKey !== EXPECTED_SAFETY_KEY) {
    throw new Error("Restoration BLOCKED: Invalid safety verification key.");
  }

  const filePath = path.join(BACKUP_DIR, filename);
  try {
    // Check if file exists
    await fs.access(filePath);
  } catch {
    throw new Error(`Backup file ${filename} not found.`);
  }

  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    const backupData = JSON.parse(fileContent);

    // Delete existing records in reverse order to satisfy foreign keys
    const tablesInReverse = [...TABLE_ORDER].reverse();
    for (const table of tablesInReverse) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (prisma as any)[table];
      if (client && typeof client.deleteMany === "function") {
        await client.deleteMany();
      }
    }

    // Insert records in correct order
    for (const table of TABLE_ORDER) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (prisma as any)[table];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = (backupData as Record<string, any[]>)[table] || [];
      if (client && typeof client.create === "function" && records.length > 0) {
        for (const record of records) {
          // Convert string dates back to Date objects in Prisma payload
          const formattedRecord = { ...record };
          for (const key in formattedRecord) {
            if (
              typeof formattedRecord[key] === "string" &&
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(formattedRecord[key])
            ) {
              formattedRecord[key] = new Date(formattedRecord[key]);
            }
          }
          await client.create({ data: formattedRecord });
        }
      }
    }

    return {
      success: true,
      message: "Database successfully restored from backup.",
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Backup restoration error:", err);
    throw new Error(`Failed to restore database: ${errMsg}`);
  }
}

/**
 * Lists available backups in the backups folder.
 */
export async function listAvailableBackups() {
  const session = await auth();
  if (session?.user?.role !== Role.ADMIN) {
    throw new Error("Access denied.");
  }

  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files.filter(f => f.startsWith("db-backup-") && f.endsWith(".json"));

    const details = await Promise.all(
      backups.map(async (filename) => {
        const filePath = path.join(BACKUP_DIR, filename);
        const stats = await fs.stat(filePath);
        return {
          filename,
          sizeBytes: stats.size,
          createdAt: stats.mtime,
        };
      })
    );

    // Sort newest first
    return details.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    return [];
  }
}
