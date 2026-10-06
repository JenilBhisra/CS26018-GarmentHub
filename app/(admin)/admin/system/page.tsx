import { Suspense } from "react";
import SystemClient from "./system-client";
import { getSystemLogs } from "@/actions/logging";
import { getAuditLogs } from "@/actions/audit";
import { listAvailableBackups } from "@/lib/db-backup";
import { getWorkerSummary } from "@/lib/background-worker";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

async function getStorageStats() {
  const dirs = [
    { name: "Chat Attachments", path: path.join(process.cwd(), "chat-attachments") },
    { name: "KYC Documents", path: path.join(process.cwd(), "kyc-documents") },
  ];
  
  const stats = [];
  for (const d of dirs) {
    let fileCount = 0;
    let totalSizeBytes = 0;
    try {
      const files = await fs.readdir(d.path);
      fileCount = files.length;
      for (const file of files) {
        const s = await fs.stat(path.join(d.path, file));
        totalSizeBytes += s.size;
      }
    } catch {
      // Directory might not exist yet
    }
    stats.push({
      name: d.name,
      fileCount,
      totalSizeMb: Number((totalSizeBytes / 1024 / 1024).toFixed(2)),
    });
  }
  return stats;
}

export default async function AdminSystemPage() {
  // Server-side ADMIN role protection
  const session = await auth();
  if (!session?.user || session.user.role !== Role.ADMIN) {
    redirect("/unauthorized");
  }

  // Fetch initial dashboard records in parallel
  const [systemLogs, auditLogs, backups, workerData, storageStats] = await Promise.all([
    getSystemLogs(undefined, 50).catch(() => []),
    getAuditLogs(50).catch(() => []),
    listAvailableBackups().catch(() => []),
    getWorkerSummary().catch(() => ({ metrics: { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 }, recentJobs: [] })),
    getStorageStats().catch(() => []),
  ]);

  const appUptime = Math.floor(process.uptime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-light text-stone-900">System Operations Console</h1>
        <p className="text-sm text-stone-500 mt-1">Audit security logs, check telemetry metrics, manage data backup snapshots, and background jobs.</p>
      </div>

      <Suspense fallback={<div className="text-xs text-stone-500 py-12 text-center">Loading system dashboard...</div>}>
        <SystemClient
          initialSystemLogs={systemLogs}
          initialAuditLogs={auditLogs}
          initialBackups={backups}
          initialWorkerData={workerData}
          storageStats={storageStats}
          uptimeSeconds={appUptime}
        />
      </Suspense>
    </div>
  );
}
