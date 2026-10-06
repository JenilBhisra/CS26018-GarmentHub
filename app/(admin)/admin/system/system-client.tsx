"use client";

import { useState } from "react";
import { 
  Activity, Database, Cpu, RefreshCw, 
  Download, UploadCloud, Play, AlertTriangle, ShieldCheck, 
  Server, Terminal, Eye, FileText, X
} from "lucide-react";
import { toast } from "sonner";
import { exportDbBackup, restoreDbBackup, listAvailableBackups } from "@/lib/db-backup";
import { runBackgroundWorkerTasks, getWorkerSummary } from "@/lib/background-worker";
import { getSystemLogs } from "@/actions/logging";
import { getAuditLogs } from "@/actions/audit";

interface SystemClientProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialSystemLogs: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialAuditLogs: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialBackups: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialWorkerData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storageStats: any[];
  uptimeSeconds: number;
}

export default function SystemClient({
  initialSystemLogs,
  initialAuditLogs,
  initialBackups,
  initialWorkerData,
  storageStats,
  uptimeSeconds
}: SystemClientProps) {
  const [activeTab, setActiveTab] = useState<"health" | "audit" | "logs" | "backups" | "worker">("health");
  
  // Data lists states
  const [systemLogs, setSystemLogs] = useState(initialSystemLogs);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  const [backups, setBackups] = useState(initialBackups);
  const [workerData, setWorkerData] = useState(initialWorkerData);
  
  // Backups states
  const [safetyKey, setSafetyKey] = useState("");
  const [selectedBackup, setSelectedBackup] = useState("");
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Background worker states
  const [runningWorker, setRunningWorker] = useState(false);

  // Modals state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedLogPayload, setSelectedLogPayload] = useState<any | null>(null);
  const [selectedAuditDiff, setSelectedAuditDiff] = useState<{ old: string | null; new: string | null; action: string } | null>(null);

  // Refresh handlers
  const handleRefreshLogs = async () => {
    try {
      const res = await getSystemLogs(undefined, 50);
      setSystemLogs(res);
      toast.success("System logs refreshed.");
    } catch {
      toast.error("Failed to load logs.");
    }
  };

  const handleRefreshAudits = async () => {
    try {
      const res = await getAuditLogs(50);
      setAuditLogs(res);
      toast.success("Audit logs refreshed.");
    } catch {
      toast.error("Failed to load audit logs.");
    }
  };

  const handleRefreshWorker = async () => {
    try {
      const res = await getWorkerSummary();
      setWorkerData(res);
      toast.success("Worker queue summary updated.");
    } catch {
      toast.error("Failed to fetch worker statistics.");
    }
  };

  const handleRefreshBackups = async () => {
    try {
      const res = await listAvailableBackups();
      setBackups(res);
      toast.success("Backup archives list refreshed.");
    } catch {
      toast.error("Failed to scan backup storage.");
    }
  };

  // Operations
  const handleExportBackup = async () => {
    setBackingUp(true);
    try {
      const res = await exportDbBackup();
      if (res.success) {
        toast.success(res.message);
        handleRefreshBackups();
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(errMsg || "Failed to create database snapshot.");
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) {
      toast.error("Please select a backup file to restore.");
      return;
    }
    if (!safetyKey.trim()) {
      toast.error("Please enter the safety verification key.");
      return;
    }

    const confirmText = `Are you sure you want to overwrite all database tables with snapshot data from: "${selectedBackup}"?\nThis cannot be undone.`;
    if (!window.confirm(confirmText)) return;

    setRestoring(true);
    try {
      const res = await restoreDbBackup(selectedBackup, safetyKey);
      if (res.success) {
        toast.success(res.message);
        setSafetyKey("");
        setSelectedBackup("");
        // Reload all data
        handleRefreshAudits();
        handleRefreshLogs();
        handleRefreshWorker();
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(errMsg || "Database restoration failed.");
    } finally {
      setRestoring(false);
    }
  };

  const handleRunWorker = async () => {
    setRunningWorker(true);
    try {
      const res = await runBackgroundWorkerTasks();
      toast.success(
        `Worker processed: ${res.jobsProcessed} jobs successfully. System cleanups applied! (Logs: ${res.logsCleaned}, Notifs: ${res.notificationsCleaned}, Failed Uploads: ${res.filesCleaned})`
      );
      if (res.errors.length > 0) {
        console.warn("Worker warnings:", res.errors);
        toast.warning(`${res.errors.length} cleanup task warnings. Check console.`);
      }
      handleRefreshWorker();
      handleRefreshLogs();
      handleRefreshAudits();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(errMsg || "Failed to trigger queue worker.");
    } finally {
      setRunningWorker(false);
    }
  };

  // Uptime formatting helper
  const formatUptime = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      {/* 1. Left Tab Controls */}
      <aside className="space-y-1">
        {[
          { id: "health", label: "Telemetry & Health", icon: Cpu },
          { id: "audit", label: "Audit Trail", icon: ShieldCheck },
          { id: "logs", label: "System Logs", icon: Terminal },
          { id: "backups", label: "Backups Console", icon: Database },
          { id: "worker", label: "Jobs Worker", icon: Play },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as "health" | "audit" | "logs" | "backups" | "worker")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left text-xs font-semibold tracking-wide transition ${
              activeTab === tab.id
                ? "bg-stone-900 text-white shadow-sm"
                : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            }`}
          >
            <tab.icon className="h-4 w-4 shrink-0" />
            {tab.label}
          </button>
        ))}
      </aside>

      {/* 2. Main Console Content */}
      <main className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 overflow-x-auto min-h-[60vh]">
        
        {/* TAB 1: TELEMETRY & HEALTH */}
        {activeTab === "health" && (
          <div className="space-y-6">
            <h2 className="font-display text-lg font-light text-stone-900">System Telemetry & Resource Footprint</h2>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-stone-200 p-4 bg-stone-50/50 flex items-center gap-4">
                <Server className="h-8 w-8 text-stone-500" />
                <div className="text-xs">
                  <p className="text-stone-400 font-bold uppercase tracking-wider text-[9px]">Uptime Indicator</p>
                  <p className="font-semibold text-stone-800 mt-1">{formatUptime(uptimeSeconds)}</p>
                </div>
              </div>
              
              <div className="rounded-xl border border-stone-200 p-4 bg-stone-50/50 flex items-center gap-4">
                <Activity className="h-8 w-8 text-emerald-500" />
                <div className="text-xs">
                  <p className="text-stone-400 font-bold uppercase tracking-wider text-[9px]">Database Status</p>
                  <p className="font-semibold text-emerald-600 mt-1">ONLINE / HEALTHY</p>
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 p-4 bg-stone-50/50 flex items-center gap-4">
                <Cpu className="h-8 w-8 text-stone-500" />
                <div className="text-xs">
                  <p className="text-stone-400 font-bold uppercase tracking-wider text-[9px]">Platform Runtime</p>
                  <p className="font-semibold text-stone-800 mt-1">Node {process.version} ({process.platform})</p>
                </div>
              </div>
            </div>

            {/* Storage metric */}
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Workspace Folder Statistics</h3>
              <div className="border border-stone-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 uppercase tracking-wider text-[9px]">
                      <th className="p-3.5">Directory Name</th>
                      <th className="p-3.5">Files Count</th>
                      <th className="p-3.5">Accumulated Space</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-150">
                    {storageStats.map((s: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                      <tr key={s.name} className="hover:bg-stone-50/50 text-stone-850">
                        <td className="p-3.5 font-semibold">{s.name}</td>
                        <td className="p-3.5">{s.fileCount} items</td>
                        <td className="p-3.5">{s.totalSizeMb} MB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: AUDIT TRAIL */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-light text-stone-900">User Audit Trail logs</h2>
                <p className="text-xs text-stone-450 mt-0.5">List of recent sensitive user transactions and state mutations.</p>
              </div>
              <button 
                onClick={handleRefreshAudits}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-bold uppercase tracking-wider text-stone-650 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh List
              </button>
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 uppercase tracking-wider text-[9px]">
                    <th className="p-3">Actor</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Entity Type</th>
                    <th className="p-3">IP Address</th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-150 text-stone-750">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-stone-400 italic">No audit records logged yet.</td>
                    </tr>
                  ) : (
                    auditLogs.map((log: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                      <tr key={log.id} className="hover:bg-stone-50/50">
                        <td className="p-3">
                          <p className="font-semibold">{log.user?.name || "System/Anonymous"}</p>
                          <p className="text-[10px] text-stone-400 font-mono">{log.user?.email || "N/A"}</p>
                        </td>
                        <td className="p-3 font-mono font-semibold text-stone-800">{log.action}</td>
                        <td className="p-3 capitalize">{log.entityType}</td>
                        <td className="p-3 font-mono text-[10px]">{log.ipAddress || "localhost"}</td>
                        <td className="p-3 text-stone-450">
                          {new Date(log.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedAuditDiff({ old: log.oldValue, new: log.newValue, action: log.action })}
                            className="p-1.5 rounded border border-stone-200 hover:bg-stone-50 text-stone-600 hover:text-stone-900 cursor-pointer inline-flex items-center gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SYSTEM LOGS */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-light text-stone-900">System Activity Logs</h2>
                <p className="text-xs text-stone-450 mt-0.5">Logs warnings, background occurrences, and critical errors.</p>
              </div>
              <button 
                onClick={handleRefreshLogs}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-bold uppercase tracking-wider text-stone-650 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh List
              </button>
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 uppercase tracking-wider text-[9px]">
                    <th className="p-3 w-20">Level</th>
                    <th className="p-3">Log Message</th>
                    <th className="p-3 w-40">Timestamp</th>
                    <th className="p-3 text-right w-24">Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-150 text-stone-750">
                  {systemLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-stone-400 italic">No system log logs present.</td>
                    </tr>
                  ) : (
                    systemLogs.map((log: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                      <tr key={log.id} className="hover:bg-stone-50/50">
                        <td className="p-3">
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            log.level === "ERROR" ? "bg-red-50 text-red-700 border border-red-150" :
                            log.level === "WARN" ? "bg-amber-50 text-amber-700 border border-amber-150" :
                            "bg-stone-100 text-stone-700 border border-stone-200"
                          }`}>
                            {log.level}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] leading-relaxed break-all">{log.message}</td>
                        <td className="p-3 text-stone-450">
                          {new Date(log.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "medium" })}
                        </td>
                        <td className="p-3 text-right">
                          {log.context ? (
                            <button
                              onClick={() => setSelectedLogPayload(log.context)}
                              className="p-1 rounded border border-stone-200 hover:bg-stone-50 text-stone-600 cursor-pointer"
                              title="View Log Details"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-stone-400 italic">None</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: BACKUPS CONSOLE */}
        {activeTab === "backups" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-light text-stone-900">Database Snapshot manager</h2>
                <p className="text-xs text-stone-450 mt-0.5">Export structured JSON archives or perform local database recovery resets.</p>
              </div>
              <button 
                onClick={handleRefreshBackups}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-bold uppercase tracking-wider text-stone-650 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Scan Backups folder
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              
              {/* Backups file lists */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Available Backups</h3>
                  <button
                    onClick={handleExportBackup}
                    disabled={backingUp}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-850 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" /> {backingUp ? "Exporting..." : "Create Backup Snapshot"}
                  </button>
                </div>

                <div className="border border-stone-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto shadow-sm">
                  {backups.length === 0 ? (
                    <div className="p-8 text-center text-xs text-stone-400 italic bg-stone-50/50">
                      No backups found in `/backups` directory. Click &quot;Create Backup Snapshot&quot; to export.
                    </div>
                  ) : (
                    <div className="divide-y divide-stone-150">
                      {backups.map((b) => (
                        <div key={b.filename} className="p-3.5 hover:bg-stone-50 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-semibold text-stone-800">{b.filename}</p>
                            <p className="text-[10px] text-stone-400 mt-0.5">
                              {(b.sizeBytes / 1024).toFixed(1)} KB • {new Date(b.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedBackup(b.filename);
                              toast.info(`Selected backup: ${b.filename}`);
                            }}
                            className={`px-2.5 py-1.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                              selectedBackup === b.filename
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "border-stone-250 text-stone-600 hover:bg-stone-50 hover:text-stone-800"
                            }`}
                          >
                            Select
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Restore Manager */}
              <section className="space-y-3 bg-red-50/30 border border-red-100 rounded-xl p-5">
                <h3 className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Manual Recovery Console
                </h3>
                
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  Restoring database clears all existing tables and writes entries parsed from the selected JSON backup. Only works in development (localhost).
                </p>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-450 uppercase mb-1">Target Backup Snapshot</label>
                    <input
                      type="text"
                      readOnly
                      placeholder="Select a backup file from the list"
                      value={selectedBackup}
                      className="w-full bg-stone-100 border border-stone-200 rounded-lg p-2.5 text-xs text-stone-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-450 uppercase mb-1">Safety Key Verification</label>
                    <input
                      type="text"
                      placeholder="Type safety key to execute restore"
                      value={safetyKey}
                      onChange={(e) => setSafetyKey(e.target.value)}
                      className="w-full bg-white border border-stone-200 rounded-lg p-2.5 text-xs text-stone-700 outline-none focus:border-red-400 shadow-sm"
                    />
                    <span className="block text-[9px] text-stone-400 mt-1">Safety Key: <code className="bg-stone-100 px-1 rounded font-bold text-stone-600 font-mono">RESTORE_DEV_DATABASE_GARMENTHUB</code></span>
                  </div>

                  <button
                    onClick={handleRestoreBackup}
                    disabled={restoring || !selectedBackup || !safetyKey}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition"
                  >
                    <UploadCloud className="h-4 w-4" /> {restoring ? "Restoring..." : "Run Database Restoration"}
                  </button>
                </div>
              </section>

            </div>
          </div>
        )}

        {/* TAB 5: WORKER & QUEUE */}
        {activeTab === "worker" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-light text-stone-900">Background Worker & Cleanups Console</h2>
                <p className="text-xs text-stone-450 mt-0.5">Control database-backed tasks queues and execute system-wide log cleanups.</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleRefreshWorker}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-bold uppercase tracking-wider text-stone-650 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh Metrics
                </button>
                
                <button
                  onClick={handleRunWorker}
                  disabled={runningWorker}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-stone-900 text-white rounded-lg hover:bg-stone-850 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" /> {runningWorker ? "Processing Worker Tasks..." : "Trigger Background Worker Now"}
                </button>
              </div>
            </div>

            {/* Metrics count */}
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                { label: "Pending Jobs", count: workerData.metrics.pending, color: "text-stone-500 bg-stone-50" },
                { label: "Processing", count: workerData.metrics.processing, color: "text-blue-600 bg-blue-50" },
                { label: "Completed", count: workerData.metrics.completed, color: "text-emerald-600 bg-emerald-50/70" },
                { label: "Failed", count: workerData.metrics.failed, color: "text-red-600 bg-red-50" },
              ].map((card) => (
                <div key={card.label} className={`rounded-xl border border-stone-200 p-4 ${card.color} text-center`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-450">{card.label}</p>
                  <p className="text-3xl font-display font-light text-stone-900 mt-2">{card.count}</p>
                </div>
              ))}
            </div>

            {/* Jobs list */}
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Worker execution trail (Last 10 Jobs)</h3>
              <div className="border border-stone-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 uppercase tracking-wider text-[9px]">
                      <th className="p-3">Queue</th>
                      <th className="p-3">Payload</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Retries</th>
                      <th className="p-3">Run At</th>
                      <th className="p-3">Trace Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-150 text-stone-750 font-mono text-[11px]">
                    {workerData.recentJobs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-stone-450 italic font-sans">No background jobs registered.</td>
                      </tr>
                    ) : (
                      workerData.recentJobs.map((job: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                        <tr key={job.id} className="hover:bg-stone-50/50">
                          <td className="p-3 capitalize font-semibold font-sans">{job.queue}</td>
                          <td className="p-3 max-w-[200px] truncate" title={job.payload}>{job.payload}</td>
                          <td className="p-3">
                            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-sans ${
                              job.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" :
                              job.status === "FAILED" ? "bg-red-50 text-red-700" :
                              job.status === "PROCESSING" ? "bg-blue-50 text-blue-700 animate-pulse" :
                              "bg-stone-100 text-stone-600"
                            }`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="p-3">{job.attempts} / {job.maxAttempts}</td>
                          <td className="p-3 text-[10px] text-stone-450 font-sans">
                            {new Date(job.runAt).toLocaleTimeString()}
                          </td>
                          <td className="p-3 text-red-650 max-w-[150px] truncate" title={job.error || "N/A"}>
                            {job.error || "N/A"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

      </main>

      {/* 3. JSON Log Payload Modal */}
      {selectedLogPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl p-6 shadow-xl border border-stone-200 relative flex flex-col max-h-[80vh]">
            <button 
              onClick={() => setSelectedLogPayload(null)}
              className="absolute right-4 top-4 text-stone-400 hover:text-stone-700 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-semibold text-stone-900 border-b border-stone-200 pb-3 mb-4">Log Context Payload</h3>
            <div className="flex-1 overflow-auto bg-stone-950 text-stone-250 rounded-xl p-4 font-mono text-[11px] leading-relaxed">
              <pre>{JSON.stringify(JSON.parse(selectedLogPayload), null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      {/* 4. Audit Log Diff Modal */}
      {selectedAuditDiff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl p-6 shadow-xl border border-stone-200 relative flex flex-col max-h-[85vh]">
            <button 
              onClick={() => setSelectedAuditDiff(null)}
              className="absolute right-4 top-4 text-stone-400 hover:text-stone-700 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            
            <h3 className="font-display text-lg font-semibold text-stone-900 border-b border-stone-200 pb-3 mb-4">
              Audit Data Change Diff: <span className="font-mono text-xs bg-stone-100 text-stone-700 rounded px-1.5 py-0.5">{selectedAuditDiff.action}</span>
            </h3>

            <div className="grid gap-4 md:grid-cols-2 flex-1 overflow-hidden">
              <div className="flex flex-col h-full overflow-hidden">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">Previous Value (Old)</span>
                <div className="flex-1 overflow-auto bg-stone-50 border border-stone-200 rounded-xl p-4 font-mono text-[10px] leading-normal text-stone-700">
                  {selectedAuditDiff.old ? (
                    <pre>{selectedAuditDiff.old.startsWith("{") ? JSON.stringify(JSON.parse(selectedAuditDiff.old), null, 2) : selectedAuditDiff.old}</pre>
                  ) : (
                    <span className="italic text-stone-400">N/A (No previous state)</span>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col h-full overflow-hidden">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">Modified Value (New)</span>
                <div className="flex-1 overflow-auto bg-stone-50 border border-stone-200 rounded-xl p-4 font-mono text-[10px] leading-normal text-stone-700">
                  {selectedAuditDiff.new ? (
                    <pre>{selectedAuditDiff.new.startsWith("{") ? JSON.stringify(JSON.parse(selectedAuditDiff.new), null, 2) : selectedAuditDiff.new}</pre>
                  ) : (
                    <span className="italic text-stone-400">N/A (No new state)</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
