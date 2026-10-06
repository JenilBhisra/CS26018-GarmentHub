"use client";

import React, { useState, useEffect } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Calendar, Database, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toggleDatasetActiveState, archiveDataset } from "@/actions/intelligence";

interface DatasetItem {
  id: string;
  fileName: string;
  originalName: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  rowCount: number;
  columns: any;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
  isActive: boolean;
  isArchived: boolean;
}

interface UploadClientProps {
  initialDatasets: DatasetItem[];
}

export default function UploadClient({ initialDatasets }: UploadClientProps) {
  const [datasets, setDatasets] = useState<DatasetItem[]>(initialDatasets);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Active polling if any dataset is in PROCESSING or PENDING state
  useEffect(() => {
    const hasActiveJobs = datasets.some(d => d.status === "PENDING" || d.status === "PROCESSING");
    if (!hasActiveJobs) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/market-intelligence/upload");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.datasets) {
            setDatasets(data.datasets);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [datasets]);

  const handleDeleteDataset = async (id: string) => {
    if (!confirm("Are you sure you want to delete this dataset and all its generated insights?")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/market-intelligence/upload?id=${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete dataset.");
      }

      toast.success(data.message || "Dataset deleted successfully.");
      setDatasets(prev => prev.filter(d => d.id !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete dataset.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const validExtensions = [".csv", ".zip", ".gz", ".gzip"];
      const hasValidExt = validExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext));
      
      if (!hasValidExt) {
        toast.error("Only CSV, ZIP, or GZIP format datasets are allowed.");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a dataset file first.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/market-intelligence/upload", true);

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      setUploadProgress(null);
      setIsUploading(false);

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          toast.success(data.message || "Dataset uploaded successfully!");
          setFile(null);

          // Add new dataset to history in PENDING
          const newDataset: DatasetItem = {
            id: data.dataset.id,
            fileName: data.dataset.fileName,
            originalName: data.dataset.fileName,
            status: "PENDING",
            rowCount: 0,
            columns: [],
            errorMessage: null,
            createdAt: new Date().toISOString(),
            processedAt: null,
            isActive: false,
            isArchived: false,
          };

          setDatasets(prev => [newDataset, ...prev]);
        } catch (err) {
          toast.error("Failed to parse response from server.");
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          toast.error(data.error || "Failed to upload dataset.");
        } catch {
          toast.error("An error occurred during file upload.");
        }
      }
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      setIsUploading(false);
      toast.error("Network connection error during upload.");
    };

    xhr.send(formData);
  };

  const getStatusBadge = (status: DatasetItem["status"]) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Loader2 className="h-3 w-3 animate-spin" /> Pending
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Loader2 className="h-3 w-3 animate-spin" /> Processing
          </span>
        );
      case "COMPLETED":
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Completed</span>;
      case "FAILED":
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">Failed</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 flex items-center gap-2">
          <Database className="h-8 w-8 text-stone-800" />
          Market Intelligence Dataset Manager
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Upload regional market fashion datasets (Kaggle formats) to compile search volumes, trending categories, and garment opportunity scores.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Upload Form card */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-base font-bold text-stone-950 flex items-center gap-1.5">
              <Upload className="h-4.5 w-4.5 text-stone-600" /> Upload New Dataset
            </h2>
            <p className="text-xs text-stone-400">
              CSV formats, ZIP archives, and GZIP compression files are supported. Maximum allowed file size is 500MB. Column headers will be automatically resolved.
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="border-2 border-dashed border-stone-200 rounded-xl p-6 text-center hover:border-stone-400 transition-colors cursor-pointer relative bg-stone-50/50">
                <input
                  type="file"
                  accept=".csv,.zip,.gz,.gzip"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                <FileSpreadsheet className="h-8 w-8 text-stone-400 mx-auto mb-2" />
                <span className="text-xs font-bold text-stone-700 block">
                  {file ? file.name : "Choose CSV, ZIP, or GZIP or drag here"}
                </span>
                {file && (
                  <span className="text-[10px] text-stone-400 block mt-1">
                    Size: {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                )}
              </div>

              {uploadProgress !== null && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[10px] font-bold text-stone-600">
                    <span>Uploading file...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-150" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!file || isUploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold transition-all duration-200 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" /> Uploading ({uploadProgress || 0}%)...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4.5 w-4.5" /> Submit Dataset
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Datasets Upload History table */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
          <h2 className="text-base font-bold text-stone-955 mb-4 flex items-center gap-1.5">
            <Calendar className="h-4.5 w-4.5 text-stone-600" /> Upload History & Processing Status
          </h2>

          <div className="overflow-x-auto rounded-xl border border-stone-100">
            {datasets.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-stone-500 space-y-2">
                <AlertCircle className="h-8 w-8 text-stone-300 animate-pulse" />
                <p className="text-sm font-semibold text-stone-700">No datasets found</p>
                <p className="text-xs text-stone-400">Upload your first market research CSV, ZIP or GZIP to populate dashboard data.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-stone-50 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-100">
                  <tr>
                    <th className="p-3">File Name</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Rows</th>
                    <th className="p-3">Uploaded At</th>
                    <th className="p-3">Processed At</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                  {datasets.map((d) => (
                    <tr key={d.id} className="hover:bg-stone-50/50">
                      <td className="p-3">
                        <div className="font-bold text-stone-900">{d.originalName || d.fileName}</div>
                        {d.errorMessage && (
                          <div className="text-[10px] text-rose-500 mt-1 max-w-xs font-normal">
                            Error: {d.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {getStatusBadge(d.status)}
                      </td>
                      <td className="p-3 text-center font-bold">
                        {d.status === "PROCESSING" ? (
                          <span className="inline-flex items-center gap-1 text-blue-650 text-[10px] font-bold">
                            <Loader2 className="h-3 w-3 animate-spin" /> {d.rowCount > 0 ? d.rowCount.toLocaleString("en-IN") : "0..."}
                          </span>
                        ) : d.status === "PENDING" ? (
                          <span className="text-amber-600 text-[10px] font-bold">Pending...</span>
                        ) : d.rowCount > 0 ? (
                          d.rowCount.toLocaleString("en-IN")
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3 text-stone-500">
                        {new Date(d.createdAt).toLocaleString("en-IN")}
                      </td>
                      <td className="p-3 text-stone-500">
                        {d.processedAt ? new Date(d.processedAt).toLocaleString("en-IN") : "-"}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {d.status === "COMPLETED" && (
                            <>
                              <a
                                href={`/admin/market-intelligence/insights?id=${d.id}`}
                                className="px-2 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-[10px] font-bold transition shrink-0"
                              >
                                Review Insights
                              </a>

                              {d.isActive ? (
                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-250 rounded text-[9px] font-extrabold tracking-wider">
                                  ACTIVE
                                </span>
                              ) : (
                                <button
                                  onClick={async () => {
                                    const res = await toggleDatasetActiveState(d.id, true);
                                    if (res.success) {
                                      toast.success("Dataset marked as ACTIVE!");
                                      window.location.reload();
                                    } else {
                                      toast.error(res.error || "Failed to set active.");
                                    }
                                  }}
                                  className="px-1.5 py-0.5 bg-white text-stone-600 border border-stone-200 hover:border-stone-450 hover:bg-stone-50 rounded text-[9px] font-extrabold tracking-wider transition"
                                >
                                  ACTIVATE
                                </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteDataset(d.id)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
                            title="Delete Dataset"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Temporary Debug Section: Latest Completed Dataset Info */}
      {(() => {
        const latestCompleted = datasets.find(d => d.status === "COMPLETED");
        if (!latestCompleted) return null;
        return (
          <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-yellow-800 flex items-center gap-1.5">
              ⚙️ Debug: Latest Completed Dataset
            </h3>
            <div className="text-xs text-yellow-700 space-y-1 font-mono">
              <div><span className="font-bold">Dataset ID:</span> {latestCompleted.id}</div>
              <div><span className="font-bold">File:</span> {latestCompleted.originalName || latestCompleted.fileName}</div>
              <div><span className="font-bold">Row Count:</span> {latestCompleted.rowCount > 0 ? latestCompleted.rowCount.toLocaleString("en-IN") : "0"}</div>
              <div><span className="font-bold">Columns Detected:</span> {Array.isArray(latestCompleted.columns) ? latestCompleted.columns.join(", ") : JSON.stringify(latestCompleted.columns)}</div>
              <div><span className="font-bold">Processed At:</span> {latestCompleted.processedAt ? new Date(latestCompleted.processedAt).toLocaleString("en-IN") : "-"}</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
