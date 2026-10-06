"use client";

import React, { useState, useEffect } from "react";
import { 
  CornerUpLeft, Search, Calendar, User, ShoppingBag, 
  HelpCircle, AlertCircle, CheckCircle, XCircle, ArrowRightLeft, 
  FileText, Download, Loader2, ChevronLeft, ChevronRight, Filter
} from "lucide-react";
import { getReturnRequestsReport, getReturnRequestsExport } from "@/actions/returns-report";
import SavedFiltersBar, { type SavedView } from "@/components/site/saved-filters-bar";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ReturnItem {
  id: string;
  orderId: string;
  customerId: string;
  sellerId: string;
  reason: string;
  description: string | null;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "ITEM_RECEIVED" | "REFUNDED" | "CLOSED";
  adminNotes: string | null;
  refundAmount: number;
  originalShippingFee: number;
  returnShippingFee: number;
  shippingResponsibility: "SELLER" | "CUSTOMER" | "PLATFORM" | null;
  reasonCategory: "SELLER_FAULT" | "CUSTOMER_FAULT" | "PLATFORM_FAULT" | null;
  deductionAmount: number;
  sellerDeductionAmount: number;
  customerRefundAmount: number;
  restoreStock: boolean;
  stockRestored: boolean;
  createdAt: Date | string;
  order: {
    orderNumber: string;
    totalAmount: string | number;
  };
  customer: {
    name: string;
    email: string;
  };
  orderNumber?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  productName?: string | null;
  productSku?: string | null;
  quantity?: number;
  whoPaidProductRefund?: string | null;
  whoPaidOriginalShipping?: string | null;
  whoPaidReturnShipping?: string | null;
  walletTransactionRef?: string | null;
  ledgerTransactionRef?: string | null;
  approvedAt?: Date | string | null;
  refundedAt?: Date | string | null;
}

interface SellerReturnsClientProps {
  initialReturns: any[];
  initialPreferences?: any;
}

export default function SellerReturnsClient({ initialReturns, initialPreferences }: SellerReturnsClientProps) {
  // Tabs State
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");

  // Tab 1: Active Returns State (Local filter)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [preferences, setPreferences] = useState(initialPreferences || { savedViews: [] });
  const savedViews: SavedView[] = preferences.savedViews || [];

  const currentFilters: Record<string, string> = {
    ...(search ? { search } : {}),
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
  };

  // Tab 2: Refund History & Reports Server-side State
  const [historyItems, setHistoryItems] = useState<ReturnItem[]>([]);
  const [historySummary, setHistorySummary] = useState<any>({
    totalCount: 0,
    customerRefundTotal: 0,
    sellerDeductionsTotal: 0,
    customerDeductionsTotal: 0,
    platformCostTotal: 0,
    sellerReturnShippingTotal: 0,
    sellerFaultCount: 0,
    customerFaultCount: 0,
    platformFaultCount: 0,
  });
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // History Filters State
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("ALL");
  const [historyReason, setHistoryReason] = useState("ALL");
  const [historyResponsibility, setHistoryResponsibility] = useState("ALL");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Unique return reasons in initialReturns for selection filter
  const uniqueReasons = Array.from(new Set(initialReturns.map(r => r.reason).filter(Boolean)));

  // Fetch paginated history from server action
  const fetchHistoryReport = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await getReturnRequestsReport({
        page: historyPage,
        limit: 10,
        search: historySearch || undefined,
        status: historyStatus !== "ALL" ? historyStatus : undefined,
        reason: historyReason !== "ALL" ? historyReason : undefined,
        responsibility: historyResponsibility !== "ALL" ? historyResponsibility : undefined,
        startDate: historyStartDate || undefined,
        endDate: historyEndDate || undefined,
      });

      if (res.success) {
        setHistoryItems(res.data as any[]);
        if (res.summary) setHistorySummary(res.summary);
        if (res.totalCount !== undefined) setHistoryTotalCount(res.totalCount);
        if (res.totalPages !== undefined) setHistoryTotalPages(res.totalPages);
      } else {
        toast.error("Failed to load refund history.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("An error occurred loading reports.");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Re-fetch report when activeTab becomes "history" or filters change
  useEffect(() => {
    if (activeTab === "history") {
      fetchHistoryReport();
    }
  }, [activeTab, historyPage, historyStatus, historyReason, historyResponsibility, historyStartDate, historyEndDate]);

  // Debounced search trigger for history
  useEffect(() => {
    if (activeTab !== "history") return;
    const delayDebounceFn = setTimeout(() => {
      setHistoryPage(1);
      fetchHistoryReport();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [historySearch]);

  const handleApplySavedView = (filters: Record<string, string>) => {
    if (filters.search !== undefined) setSearch(filters.search);
    if (filters.status !== undefined) setStatusFilter(filters.status);
    else setStatusFilter("ALL");
  };

  const handleSavedViewsChange = (views: SavedView[]) => {
    setPreferences((prev: any) => ({ ...prev, savedViews: views }));
  };

  // Excel/CSV Exporter using SheetJS
  const handleExportHistory = async (format: "csv" | "excel") => {
    setIsExporting(true);
    try {
      const exportData = await getReturnRequestsExport({
        search: historySearch || undefined,
        status: historyStatus !== "ALL" ? historyStatus : undefined,
        reason: historyReason !== "ALL" ? historyReason : undefined,
        responsibility: historyResponsibility !== "ALL" ? historyResponsibility : undefined,
        startDate: historyStartDate || undefined,
        endDate: historyEndDate || undefined,
      });

      if (exportData.length === 0) {
        toast.error("No return records found matching filters.");
        return;
      }

      // Rename headers to be user-friendly for seller export
      const formattedData = exportData.map(item => ({
        "Refund ID": item.refundId,
        "Order Number": item.orderNumber,
        "Customer Name & Email": item.customer,
        "Returned Products": item.productName,
        "SKU": item.productSku,
        "Quantity": item.quantity,
        "Product Amount": item.productAmount,
        "Original Shipping Paid": item.originalShipping,
        "Return Shipping Cost": item.returnShipping,
        "Customer Refund Received": item.customerRefund,
        "Amount Deducted From You": item.sellerDeduction,
        "Customer Deduction": item.customerDeduction,
        "Reason For Return": item.returnReason,
        "Customer Comment": item.customerComment,
        "Who Paid Return Shipping": item.whoPaidReturnShipping,
        "Who Paid Original Shipping": item.whoPaidOriginalShipping,
        "Who Paid Product Refund": item.whoPaidProductRefund,
        "Commission Status": item.commissionReversed,
        "Refund Status": item.status,
        "Requested Date": item.requestedDate ? new Date(item.requestedDate).toLocaleDateString("en-IN") : "",
        "Finalized Date": item.finalizedDate ? new Date(item.finalizedDate).toLocaleDateString("en-IN") : "",
        "Admin Notes": item.adminNote,
        "Wallet Impact Reference": item.walletTransactionReference,
        "Ledger Reference": item.ledgerReference,
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Refund History");

      const filename = `return_refund_history_${new Date().toISOString().slice(0,10)}`;
      if (format === "csv") {
        XLSX.writeFile(workbook, `${filename}.csv`, { bookType: "csv" });
      } else {
        XLSX.writeFile(workbook, `${filename}.xlsx`, { bookType: "xlsx" });
      }
      toast.success(`Exported ${exportData.length} records successfully.`);
    } catch (err: any) {
      console.error(err);
      toast.error("Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  // Format currency
  const formatCurrency = (val: string | number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(val));
  };

  // Format date
  const formatDate = (dateStr: Date | string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Status badge helper
  const getStatusBadge = (status: ReturnItem["status"]) => {
    switch (status) {
      case "REQUESTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <HelpCircle className="h-3 w-3" /> Requested
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle className="h-3 w-3" /> Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="h-3 w-3" /> Rejected
          </span>
        );
      case "ITEM_RECEIVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <ArrowRightLeft className="h-3 w-3" /> Item Received
          </span>
        );
      case "REFUNDED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="h-3 w-3" /> Refunded
          </span>
        );
      case "CLOSED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-50 text-stone-700 border border-stone-200">
            <XCircle className="h-3 w-3" /> Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-50 text-stone-700 border border-stone-200">
            {status}
          </span>
        );
    }
  };

  // Filter returns locally for Tab 1
  const filteredActiveReturns = initialReturns.filter((r) => {
    const matchesSearch = 
      r.order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.customer.name.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    
    // Hide refunded/closed/rejected in active returns list to separate active workflow
    const isWorkflowActive = r.status !== "REFUNDED" && r.status !== "REJECTED" && r.status !== "CLOSED";
    
    return matchesSearch && matchesStatus && isWorkflowActive;
  });

  // Calculate totals for active requests
  const activeCount = initialReturns.filter((r) => r.status !== "REFUNDED" && r.status !== "REJECTED" && r.status !== "CLOSED").length;
  const pendingActionCount = initialReturns.filter((r) => r.status === "REQUESTED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 flex items-center gap-2">
            <CornerUpLeft className="h-8 w-8 text-stone-800" />
            Returns & Refunds
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Manage active return requests and audit refund splits history with detailed financial reports.
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="flex bg-stone-100 p-1.5 rounded-xl border border-stone-200/50 self-start">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              activeTab === "active"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            Active Requests ({activeCount})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              activeTab === "history"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            Refund History & Reports
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* TAB 1: ACTIVE RETURN REQUESTS              */}
      {/* ========================================== */}
      {activeTab === "active" && (
        <>
          {/* Active Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs flex items-center justify-between transition-all duration-300 hover:shadow-md">
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Active Return Claims</p>
                <h3 className="text-3xl font-extrabold text-stone-900 mt-1">{activeCount}</h3>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl text-stone-600 border border-stone-100">
                <CornerUpLeft className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs flex items-center justify-between transition-all duration-300 hover:shadow-md">
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Pending Action</p>
                <h3 className="text-3xl font-extrabold text-amber-600 mt-1">{pendingActionCount}</h3>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600 border border-amber-100">
                <HelpCircle className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs flex items-center justify-between transition-all duration-300 hover:shadow-md">
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Approved Returns</p>
                <h3 className="text-3xl font-extrabold text-blue-600 mt-1">
                  {initialReturns.filter(r => r.status === "APPROVED" || r.status === "ITEM_RECEIVED").length}
                </h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600 border border-blue-100">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Saved Filters */}
          <SavedFiltersBar
            currentFilters={currentFilters}
            savedViews={savedViews}
            onApply={handleApplySavedView}
            onSavedViewsChange={handleSavedViewsChange}
            currentPreferences={preferences}
          />

          {/* Table Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-stone-400" />
              <input
                type="text"
                placeholder="Search by Order # or Customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400"
              />
            </div>

            <div className="flex gap-2 items-center">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-stone-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400 font-semibold text-stone-700"
              >
                <option value="ALL">All Active Statuses</option>
                <option value="REQUESTED">Requested</option>
                <option value="APPROVED">Approved</option>
                <option value="ITEM_RECEIVED">Item Received</option>
              </select>
            </div>
          </div>

          {/* Active Returns Table */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
            {filteredActiveReturns.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-stone-500 space-y-3">
                <AlertCircle className="h-8 w-8 text-stone-300 animate-pulse" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-stone-700">No active return requests</p>
                  <p className="text-xs text-stone-400 mt-1">There are no active customer requests waiting for updates.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Order Details</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Reason & Category</th>
                      <th className="py-3.5 px-4 text-right">Estimated Wallet Impact</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4">Admin Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                    {filteredActiveReturns.map((ret) => {
                      const baseVal = Number(ret.refundAmount);
                      const returnShip = Number(ret.returnShippingFee || 0);
                      const totalDeduct = Number(ret.sellerDeductionAmount || 0);

                      return (
                        <tr key={ret.id} className="hover:bg-stone-50/30 align-top transition-colors">
                          <td className="py-4 px-4 space-y-1">
                            <div className="text-stone-900 font-semibold">#{ret.order.orderNumber}</div>
                            <div className="text-stone-400 text-xs flex items-center gap-1 font-medium">
                              <Calendar className="h-3 w-3" /> {formatDate(ret.createdAt)}
                            </div>
                          </td>
                          <td className="py-4 px-4 space-y-0.5">
                            <div className="text-stone-900 font-semibold flex items-center gap-1">
                              <User className="h-3.5 w-3.5 text-stone-400" /> {ret.customer.name}
                            </div>
                            <div className="text-stone-400 text-xs font-medium">{ret.customer.email}</div>
                          </td>
                          <td className="py-4 px-4 space-y-1.5 max-w-xs">
                            <div>
                              <div className="text-stone-800 font-bold">{ret.reason}</div>
                              {ret.description && (
                                <p className="text-stone-400 text-xs leading-relaxed font-normal italic mt-0.5">
                                  "{ret.description}"
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {ret.reasonCategory && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  ret.reasonCategory === "SELLER_FAULT"
                                    ? "bg-rose-50 text-rose-700 border border-rose-100"
                                    : ret.reasonCategory === "CUSTOMER_FAULT"
                                    ? "bg-blue-50 text-blue-700 border border-blue-100"
                                    : "bg-purple-50 text-purple-700 border border-purple-100"
                                }`}>
                                  {ret.reasonCategory.replace("_", " ")}
                                </span>
                              )}
                              {ret.shippingResponsibility && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  ret.shippingResponsibility === "SELLER"
                                    ? "bg-rose-100/40 text-rose-800 border border-rose-200/50"
                                    : ret.shippingResponsibility === "CUSTOMER"
                                    ? "bg-blue-100/40 text-blue-800 border border-blue-200/50"
                                    : "bg-purple-100/40 text-purple-800 border border-purple-200/50"
                                }`}>
                                  {ret.shippingResponsibility} BEARS
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right space-y-1">
                            <div className="text-stone-900 font-bold text-sm">
                              {formatCurrency(totalDeduct)}
                              <span className="text-[10px] text-stone-400 font-semibold block">Estimated Deduct</span>
                            </div>
                            <div className="text-[10px] text-stone-400 font-normal leading-normal">
                              <div>Base Item: {formatCurrency(baseVal)}</div>
                              <div>Return Shipping: {formatCurrency(returnShip)}</div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {getStatusBadge(ret.status)}
                          </td>
                          <td className="py-4 px-4 max-w-xs">
                            {ret.adminNotes ? (
                              <div className="flex items-start gap-1.5 text-xs text-stone-500 bg-stone-50 p-2.5 rounded-lg border border-stone-200 font-normal leading-relaxed">
                                <FileText className="h-3.5 w-3.5 shrink-0 text-stone-400 mt-0.5" />
                                <span>{ret.adminNotes}</span>
                              </div>
                            ) : (
                              <span className="text-stone-400 text-xs font-normal">No decision notes.</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================== */}
      {/* TAB 2: REFUND HISTORY & REPORTS            */}
      {/* ========================================== */}
      {activeTab === "history" && (
        <>
          {/* Premium History Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative overflow-hidden bg-gradient-to-tr from-stone-900 to-stone-800 p-5 rounded-xl border border-stone-950 shadow-md text-white transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <div className="relative z-10">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total Refunded Orders</p>
                <h3 className="text-3xl font-extrabold mt-1">{historySummary.totalCount}</h3>
              </div>
              <CornerUpLeft className="absolute -right-4 -bottom-4 h-24 w-24 text-stone-700/20 pointer-events-none" />
            </div>

            <div className="relative overflow-hidden bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs flex items-center justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Amount Deducted From You</p>
                <h3 className="text-3xl font-extrabold text-stone-900 mt-1">{formatCurrency(historySummary.sellerDeductionsTotal)}</h3>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl text-stone-700 border border-stone-100">
                <XCircle className="h-5 w-5" />
              </div>
            </div>

            <div className="relative overflow-hidden bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs flex items-center justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Return Shipping Paid By You</p>
                <h3 className="text-3xl font-extrabold text-rose-700 mt-1">{formatCurrency(historySummary.sellerReturnShippingTotal)}</h3>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl text-rose-700 border border-rose-100">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
            </div>

            {/* Split Counts */}
            <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Refund Splits Breakdown</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-600 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span> Seller Fault
                  </span>
                  <span className="font-bold text-stone-900">{historySummary.sellerFaultCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-600 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-500"></span> Customer Fault
                  </span>
                  <span className="font-bold text-stone-900">{historySummary.customerFaultCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-purple-600 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-purple-500"></span> Platform Fault
                  </span>
                  <span className="font-bold text-stone-900">{historySummary.platformFaultCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Report Filters & Export */}
          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
              <Filter className="h-4.5 w-4.5 text-stone-600" />
              <span className="text-sm font-bold text-stone-800">Advanced Query Filters</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              {/* Product search */}
              <div className="col-span-1 sm:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Product or Order #</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search name, SKU, Order..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full pl-8.5 pr-3 py-1.5 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Refund Status</label>
                <select
                  value={historyStatus}
                  onChange={(e) => { setHistoryPage(1); setHistoryStatus(e.target.value); }}
                  className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs bg-white font-semibold text-stone-700"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="REFUNDED">Refunded</option>
                  <option value="CLOSED">Closed</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REQUESTED">Requested</option>
                </select>
              </div>

              {/* Reason */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Return Reason</label>
                <select
                  value={historyReason}
                  onChange={(e) => { setHistoryPage(1); setHistoryReason(e.target.value); }}
                  className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs bg-white font-semibold text-stone-700"
                >
                  <option value="ALL">All Reasons</option>
                  {uniqueReasons.map((r, idx) => (
                    <option key={idx} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Responsibility */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Responsibility</label>
                <select
                  value={historyResponsibility}
                  onChange={(e) => { setHistoryPage(1); setHistoryResponsibility(e.target.value); }}
                  className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs bg-white font-semibold text-stone-700"
                >
                  <option value="ALL">All Responsibilities</option>
                  <option value="SELLER">Seller Bears</option>
                  <option value="CUSTOMER">Customer Bears</option>
                  <option value="PLATFORM">Platform Bears</option>
                </select>
              </div>

              {/* Exports */}
              <div className="flex flex-col justify-end gap-1.5">
                <div className="flex gap-2">
                  <button
                    disabled={isExporting}
                    onClick={() => handleExportHistory("excel")}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-bold transition-all duration-200 hover:bg-stone-800 disabled:opacity-50"
                  >
                    {isExporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Excel
                  </button>
                  <button
                    disabled={isExporting}
                    onClick={() => handleExportHistory("csv")}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 border border-stone-300 text-stone-700 rounded-lg text-xs font-bold transition-all duration-200 hover:bg-stone-50 disabled:opacity-50"
                  >
                    CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Date range filter rows */}
            <div className="flex items-center gap-4 bg-stone-50 p-3 rounded-lg border border-stone-200/50">
              <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
                <Calendar className="h-4 w-4" /> Filter by Date Range:
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => { setHistoryPage(1); setHistoryStartDate(e.target.value); }}
                  className="px-2.5 py-1 border border-stone-200 rounded-lg text-xs focus:outline-none"
                />
                <span className="text-stone-400 text-xs">to</span>
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => { setHistoryPage(1); setHistoryEndDate(e.target.value); }}
                  className="px-2.5 py-1 border border-stone-200 rounded-lg text-xs focus:outline-none"
                />
                {(historyStartDate || historyEndDate) && (
                  <button
                    onClick={() => { setHistoryPage(1); setHistoryStartDate(""); setHistoryEndDate(""); }}
                    className="text-stone-500 hover:text-stone-800 text-[10px] font-bold underline ml-2"
                  >
                    Clear Dates
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Paginated Reports Table */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden relative">
            {isLoadingHistory && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xs z-20 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-stone-600">
                  <Loader2 className="h-8 w-8 animate-spin text-stone-800" />
                  <span className="text-xs font-bold">Querying history report...</span>
                </div>
              </div>
            )}

            {historyItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-stone-500 space-y-3">
                <AlertCircle className="h-8 w-8 text-stone-300 animate-pulse" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-stone-700">No report records found</p>
                  <p className="text-xs text-stone-400 mt-1">Try adjusting your search keywords, status, or date range filters.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold text-xs uppercase tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4">Order Number</th>
                        <th className="py-3.5 px-4 font-bold">Products Returned</th>
                        <th className="py-3.5 px-4">Customer Details</th>
                        <th className="py-3.5 px-4">Reason For Return</th>
                        <th className="py-3.5 px-4 text-center">Status</th>
                        <th className="py-3.5 px-4 text-right">Customer Received</th>
                        <th className="py-3.5 px-4 text-right">Amount Deducted From You</th>
                        <th className="py-3.5 px-4 text-center">Return Shipping Paid By</th>
                        <th className="py-3.5 px-4 text-center">Wallet Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                      {historyItems.map((ret) => {
                        const productRefundPaidBy = ret.whoPaidProductRefund || (ret.reasonCategory === "PLATFORM_FAULT" ? "Platform" : "Seller");
                        const returnShippingPaidBy = ret.whoPaidReturnShipping || "Customer";
                        const walletRef = ret.walletTransactionRef || (ret.status === "REFUNDED" ? `refund_ret_${ret.id}` : null);

                        return (
                          <tr key={ret.id} className="hover:bg-stone-50/30 align-top transition-colors text-xs">
                            {/* Date */}
                            <td className="py-4 px-4 font-medium text-stone-500 whitespace-nowrap">
                              {formatDate(ret.createdAt)}
                            </td>
                            {/* Order Number */}
                            <td className="py-4 px-4 font-bold text-stone-900 whitespace-nowrap">
                              #{ret.orderNumber || ret.order.orderNumber}
                            </td>
                            {/* Products */}
                            <td className="py-4 px-4 max-w-xs">
                              <div className="font-semibold text-stone-800 line-clamp-2">
                                {ret.productName || "Products details synced"}
                              </div>
                              {(ret.productSku || ret.quantity) && (
                                <div className="text-[10px] text-stone-400 mt-0.5">
                                  SKU: {ret.productSku || "N/A"} | Qty: {ret.quantity ?? 1}
                                </div>
                              )}
                            </td>
                            {/* Customer */}
                            <td className="py-4 px-4 whitespace-nowrap">
                              <div className="text-stone-950 font-semibold">{ret.customerName || ret.customer.name}</div>
                              <div className="text-[10px] text-stone-400">{ret.customerEmail || ret.customer.email}</div>
                            </td>
                            {/* Return Reason */}
                            <td className="py-4 px-4 max-w-xs">
                              <div className="font-bold text-stone-800">{ret.reason}</div>
                              {ret.description && (
                                <div className="text-stone-400 italic font-normal text-[10px] line-clamp-1 mt-0.5">"{ret.description}"</div>
                              )}
                            </td>
                            {/* Status */}
                            <td className="py-4 px-4 text-center whitespace-nowrap">
                              {getStatusBadge(ret.status)}
                            </td>
                            {/* Customer Refund */}
                            <td className="py-4 px-4 text-right font-bold text-stone-900">
                              {formatCurrency(ret.customerRefundAmount)}
                            </td>
                            {/* Seller Deduction */}
                            <td className="py-4 px-4 text-right font-bold text-rose-700">
                              {formatCurrency(ret.sellerDeductionAmount)}
                            </td>
                            {/* Return Shipping Payer */}
                            <td className="py-4 px-4 text-center whitespace-nowrap font-bold">
                              <span className={`inline-flex px-2.5 py-0.5 rounded text-[10px] ${
                                returnShippingPaidBy === "Seller"
                                  ? "bg-rose-50 text-rose-700 border border-rose-100"
                                  : returnShippingPaidBy === "Customer"
                                  ? "bg-blue-50 text-blue-700 border border-blue-100"
                                  : "bg-purple-50 text-purple-700 border border-purple-100"
                              }`}>
                                {returnShippingPaidBy}
                              </span>
                            </td>
                            {/* Wallet Impact */}
                            <td className="py-4 px-4 text-center whitespace-nowrap">
                              {walletRef ? (
                                <div className="text-stone-500 font-semibold font-mono text-[10px]">
                                  {walletRef}
                                </div>
                              ) : (
                                <span className="text-stone-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Server-side Pagination controls */}
                <div className="bg-stone-50 border-t border-stone-200 px-4 py-3.5 flex items-center justify-between">
                  <div className="text-xs font-semibold text-stone-500">
                    Showing <span className="text-stone-800">{(historyPage - 1) * 10 + 1}</span> to{" "}
                    <span className="text-stone-800">{Math.min(historyPage * 10, historyTotalCount)}</span> of{" "}
                    <span className="text-stone-800">{historyTotalCount}</span> records
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                      className="p-1.5 border border-stone-300 rounded-lg bg-white text-stone-600 disabled:opacity-40 transition-colors hover:bg-stone-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: historyTotalPages }, (_, i) => i + 1).map((pageNumber) => (
                      <button
                        key={pageNumber}
                        onClick={() => setHistoryPage(pageNumber)}
                        className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all duration-150 ${
                          historyPage === pageNumber
                            ? "bg-stone-900 border-stone-950 text-white shadow-sm"
                            : "bg-white border-stone-300 text-stone-600 hover:bg-stone-50"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    <button
                      disabled={historyPage === historyTotalPages}
                      onClick={() => setHistoryPage(prev => Math.min(historyTotalPages, prev + 1))}
                      className="p-1.5 border border-stone-300 rounded-lg bg-white text-stone-600 disabled:opacity-40 transition-colors hover:bg-stone-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
