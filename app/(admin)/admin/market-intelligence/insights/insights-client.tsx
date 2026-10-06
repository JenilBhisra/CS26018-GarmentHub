"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Database, Activity, Calendar, AlertCircle, CheckCircle2, 
  Trash2, RefreshCw, Archive, ToggleLeft, ToggleRight, 
  ChevronRight, ArrowLeft, Layers, Sparkles, Check, Play, Clock
} from "lucide-react";
import { toast } from "sonner";
import { 
  toggleDatasetActiveState, 
  archiveDataset, 
  reprocessDatasetAction, 
  toggleInsightActiveState 
} from "@/actions/intelligence";

interface DatasetListItem {
  id: string;
  originalName: string;
  status: string;
  isActive: boolean;
  isArchived: boolean;
  rowCount: number;
  createdAt: string;
}

interface InsightItem {
  id: string;
  type: string;
  title: string;
  description: string;
  value: any;
  score: number | null;
  isActive: boolean;
}

interface DatasetDetails {
  id: string;
  fileName: string;
  originalName: string;
  status: string;
  rowCount: number;
  columns: any;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
  isActive: boolean;
  isArchived: boolean;
  qualityReport: any;
  insights: InsightItem[];
}

interface InsightsClientProps {
  datasets: DatasetListItem[];
  initialDatasetDetails: DatasetDetails | null;
}

export default function InsightsClient({ datasets, initialDatasetDetails }: InsightsClientProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(initialDatasetDetails?.id || "");
  const [details, setDetails] = useState<DatasetDetails | null>(initialDatasetDetails);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null);

  // Sync state if initialDatasetDetails changes (due to router selection)
  useEffect(() => {
    if (initialDatasetDetails) {
      setDetails(initialDatasetDetails);
      setSelectedId(initialDatasetDetails.id);
    }
  }, [initialDatasetDetails]);

  const handleDatasetSelect = (id: string) => {
    setSelectedId(id);
    router.push(`/admin/market-intelligence/insights?id=${id}`);
  };

  const handleToggleActive = async (isActive: boolean) => {
    if (!details) return;
    setActionLoading(true);
    try {
      const res = await toggleDatasetActiveState(details.id, isActive);
      if (res.success) {
        toast.success(isActive ? "Dataset activated successfully!" : "Dataset deactivated.");
        router.refresh();
      } else {
        toast.error("Failed to toggle active status.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update dataset active state.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleArchive = async (isArchived: boolean) => {
    if (!details) return;
    setActionLoading(true);
    try {
      const res = await archiveDataset(details.id, isArchived);
      if (res.success) {
        toast.success(isArchived ? "Dataset archived successfully!" : "Dataset unarchived.");
        router.refresh();
      } else {
        toast.error("Failed to archive dataset.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update archive status.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReprocess = async () => {
    if (!details) return;
    setActionLoading(true);
    try {
      const res = await reprocessDatasetAction(details.id);
      if (res.success) {
        toast.success("Reprocessing has started in the background. Refreshing soon...");
        // Poll for completion
        setTimeout(() => {
          router.refresh();
        }, 3000);
      } else {
        toast.error("Failed to trigger reprocessing.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to reprocess dataset.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleInsight = async (insightId: string, isActive: boolean) => {
    try {
      const res = await toggleInsightActiveState(insightId, isActive);
      if (res.success) {
        toast.success(isActive ? "Insight card activated." : "Insight card deactivated.");
        
        // Update local state instantly
        if (details) {
          setDetails({
            ...details,
            insights: details.insights.map(i => i.id === insightId ? { ...i, isActive } : i)
          });
        }
      } else {
        toast.error("Failed to toggle insight status.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update insight status.");
    }
  };

  const getConfidenceLevel = (score: number) => {
    if (score >= 90) return { label: "High Confidence", color: "text-emerald-700 bg-emerald-50 border-emerald-150" };
    if (score >= 70) return { label: "Medium Confidence", color: "text-amber-700 bg-amber-50 border-amber-150" };
    return { label: "Low Quality / Review Needed", color: "text-rose-700 bg-rose-50 border-rose-150" };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 pb-5">
        <div className="space-y-1">
          <button 
            onClick={() => router.push("/admin/market-intelligence")} 
            className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-850 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dataset Ingestor
          </button>
          <h1 className="text-2xl font-light tracking-tight text-stone-900 flex items-center gap-2 mt-2">
            <Sparkles className="h-7 w-7 text-stone-800" />
            Insight Review Panel
          </h1>
          <p className="text-xs text-stone-500">
            Preview, reprocess, and toggle visibility of compiled market dataset insights before showing them to sellers.
          </p>
        </div>

        {/* Dataset Selector Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-stone-500 whitespace-nowrap">Dataset:</label>
          <select 
            value={selectedId} 
            onChange={(e) => handleDatasetSelect(e.target.value)}
            className="bg-white px-3 py-1.5 rounded-xl border border-stone-250 text-xs font-semibold focus:outline-none focus:border-stone-400 max-w-xs"
          >
            <option value="" disabled>Select a dataset...</option>
            {datasets.map(d => (
              <option key={d.id} value={d.id}>
                {d.originalName} ({new Date(d.createdAt).toLocaleDateString("en-IN")}) {d.isActive ? "🟢 Active" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!details ? (
        <div className="bg-white p-16 rounded-2xl border border-stone-200 shadow-xs flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-4">
          <Database className="h-12 w-12 text-stone-300 animate-pulse" />
          <h3 className="text-sm font-bold text-stone-805">No Processed Datasets Found</h3>
          <p className="text-xs text-stone-450 max-w-xs leading-relaxed">
            Upload and process a market research dataset in the main panel to activate insights controls.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* LEFT SIDE: DATASET LOGS & CONTROLS */}
          <div className="space-y-6 lg:col-span-1">
            {/* Status & Action Center */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4 relative">
              <h3 className="text-xs font-bold text-stone-450 uppercase tracking-wider">Dataset Control Center</h3>
              
              {/* Badges */}
              <div className="flex flex-wrap gap-2 pt-1.5">
                {details.isActive ? (
                  <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    🟢 Active In Dashboard
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-stone-100 text-stone-500 border border-stone-200">
                    ⚪ Inactive
                  </span>
                )}
                {details.isArchived && (
                  <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-250">
                    📦 Archived
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                {!details.isActive ? (
                  <button
                    onClick={() => handleToggleActive(true)}
                    disabled={actionLoading || details.status !== "COMPLETED"}
                    className="w-full py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" /> Set Active Dataset
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggleActive(false)}
                    disabled={actionLoading}
                    className="w-full py-2 bg-stone-105 border border-stone-200 text-stone-700 rounded-xl text-xs font-bold hover:bg-stone-200 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
                  >
                    Deactivate Dataset
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleReprocess}
                    disabled={actionLoading}
                    className="py-1.5 bg-white border border-stone-200 hover:bg-stone-50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                    title="Clear old insights and regenerate from original file"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${actionLoading ? "animate-spin" : ""}`} /> Reprocess
                  </button>

                  {!details.isArchived ? (
                    <button
                      onClick={() => handleToggleArchive(true)}
                      disabled={actionLoading}
                      className="py-1.5 bg-stone-50 hover:bg-stone-100 text-stone-650 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleArchive(false)}
                      disabled={actionLoading}
                      className="py-1.5 bg-stone-50 hover:bg-stone-100 text-stone-655 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      Unarchive
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quality Report card */}
            {details.qualityReport && (
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
                <div className="flex justify-between items-start border-b border-stone-50 pb-2">
                  <div>
                    <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Data Quality Audit</h3>
                    <p className="text-[10px] text-stone-400 font-semibold mt-0.5">Ingested via streaming parser.</p>
                  </div>
                  
                  {/* Deterministic Confidence rating */}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getConfidenceLevel(details.qualityReport.confidenceScore).color}`}>
                    {details.qualityReport.confidenceScore}% Quality
                  </span>
                </div>

                <div className="space-y-3 pt-1 font-semibold text-stone-705 text-xs">
                  <div className="flex justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-105">
                    <span>Rows Processed</span>
                    <span className="font-bold text-stone-900">{(details.qualityReport.rowsProcessed || details.rowCount).toLocaleString("en-IN")}</span>
                  </div>

                  <div className="flex justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-105">
                    <span>Skipped / Skipped Rows</span>
                    <span className={`font-bold ${details.qualityReport.rowsSkipped > 0 ? "text-amber-600" : "text-stone-500"}`}>
                      {details.qualityReport.rowsSkipped.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-105">
                    <span>Duplicate Rows</span>
                    <span className={`font-bold ${details.qualityReport.duplicateRows > 0 ? "text-amber-500" : "text-stone-500"}`}>
                      {details.qualityReport.duplicateRows.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-105">
                    <span>Invalid Prices</span>
                    <span className={`font-bold ${details.qualityReport.invalidPriceRows > 0 ? "text-rose-600" : "text-stone-500"}`}>
                      {details.qualityReport.invalidPriceRows}
                    </span>
                  </div>

                  <div className="flex justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-105">
                    <span>Invalid Seasons/Dates</span>
                    <span className={`font-bold ${details.qualityReport.invalidDateRows > 0 ? "text-rose-600" : "text-stone-500"}`}>
                      {details.qualityReport.invalidDateRows}
                    </span>
                  </div>

                  <div className="flex justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-105">
                    <span>Execution duration</span>
                    <span className="text-stone-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {details.qualityReport.processingTimeMs} ms
                    </span>
                  </div>
                </div>

                {/* Missing required checklist columns */}
                <div className="pt-2 border-t border-stone-100 space-y-2">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Required Columns Check</span>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-stone-600">
                    {["category", "price", "demand", "product", "season"].map(col => {
                      const isMissing = details.qualityReport?.missingColumns.includes(col);
                      return (
                        <div key={col} className="flex items-center gap-1.5">
                          {isMissing ? (
                            <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          )}
                          <span className={isMissing ? "line-through text-stone-400" : "text-stone-700"}>{col}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDE: COMPILED INSIGHT CARDS REVIEW LIST */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">Insight Cards Review</h3>
                <p className="text-[11px] text-stone-450 mt-0.5">Toggle visibility on seller intelligence views.</p>
              </div>
              <span className="text-xs font-bold text-indigo-600">
                {details.insights.length} Insights Generated
              </span>
            </div>

            {details.insights.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-dashed border-stone-200 text-center text-stone-500 space-y-2">
                <AlertCircle className="h-8 w-8 text-stone-300 mx-auto" />
                <p className="text-sm font-bold text-stone-700">No Insights for this Dataset</p>
                <p className="text-xs text-stone-400">Try reprocessing the dataset to extract compatibility metrics.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {details.insights.map((ins) => (
                  <div 
                    key={ins.id}
                    className={`bg-white rounded-2xl border transition duration-300 ${
                      ins.isActive ? "border-stone-200 hover:border-stone-350 shadow-xs" : "border-stone-150 bg-stone-50/20 opacity-75"
                    }`}
                  >
                    {/* Card Header */}
                    <div className="p-5 flex items-start justify-between gap-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-stone-900">{ins.title}</h4>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                            {ins.type}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 font-medium">{ins.description}</p>
                      </div>

                      {/* Toggle visibility */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                          {ins.isActive ? "Visible" : "Hidden"}
                        </span>
                        <button
                          onClick={() => handleToggleInsight(ins.id, !ins.isActive)}
                          className="text-stone-400 hover:text-indigo-650 transition"
                        >
                          {ins.isActive ? (
                            <ToggleRight className="h-6 w-6 text-indigo-600" />
                          ) : (
                            <ToggleLeft className="h-6 w-6" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible JSON Previewer */}
                    <div className="border-t border-stone-100">
                      <button
                        onClick={() => setExpandedInsightId(expandedInsightId === ins.id ? null : ins.id)}
                        className="w-full px-5 py-2.5 text-left text-[10px] font-bold text-stone-550 hover:bg-stone-50 hover:text-stone-800 transition flex items-center justify-between"
                      >
                        <span>JSON VALUE SCHEMA PREVIEW</span>
                        <span className="text-stone-400">
                          {expandedInsightId === ins.id ? "Collapse ▲" : "Expand ▼"}
                        </span>
                      </button>

                      {expandedInsightId === ins.id && (
                        <div className="px-5 pb-5 pt-1.5 bg-stone-900 rounded-b-2xl overflow-x-auto max-h-[250px]">
                          <pre className="text-[10px] text-stone-200 font-mono leading-relaxed">
                            {JSON.stringify(ins.value, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
