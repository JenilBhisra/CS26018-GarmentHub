"use client";

import React, { useState, useEffect } from "react";
import { 
  CornerUpLeft, Search, Calendar, User, ShoppingBag, 
  HelpCircle, AlertCircle, CheckCircle, XCircle, ArrowRightLeft, 
  FileText, Download, Loader2, ChevronLeft, ChevronRight, Filter, Store
} from "lucide-react";
import { getReturnRequestsReport, getReturnRequestsExport } from "@/actions/returns-report";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface SellerItem {
  id: string;
  storeName: string;
}

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
  platformCost: number;
  reverseCommission: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  orderNumber: string | null;
  sellerStoreName: string | null;
  customerName: string | null;
  customerEmail: string | null;
  productName: string | null;
  productSku: string | null;
  quantity: number;
  productAmount: number;
  originalShippingResponsibility: "SELLER" | "CUSTOMER" | "PLATFORM" | null;
  returnShippingResponsibility: "SELLER" | "CUSTOMER" | "PLATFORM" | null;
  whoPaidProductRefund: string | null;
  whoPaidOriginalShipping: string | null;
  whoPaidReturnShipping: string | null;
  walletTransactionRef: string | null;
  ledgerTransactionRef: string | null;
  approvedAt: Date | string | null;
  refundedAt: Date | string | null;
}

interface AdminHistoryClientProps {
  sellers: SellerItem[];
}

export default function AdminHistoryClient({ sellers }: AdminHistoryClientProps) {
  // Report items and summary cards stats
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [summary, setSummary] = useState<any>({
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
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Filters State
  const [search, setSearch] = useState("");
  const [selectedSeller, setSelectedSeller] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedReason, setSelectedReason] = useState("ALL");
  const [selectedResponsibility, setSelectedResponsibility] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedWhoPaid, setSelectedWhoPaid] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Predefined lists
  const reasonOptions = [
    "Item damaged or defective",
    "Incorrect product shipped",
    "Quality not as expected",
    "Wrong size ordered",
    "Item arrived late",
    "Changed mind"
  ];

  // Fetch report data from server
  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const res = await getReturnRequestsReport({
        page,
        limit: 10,
        search: search || undefined,
        sellerId: selectedSeller !== "ALL" ? selectedSeller : undefined,
        status: selectedStatus !== "ALL" ? selectedStatus : undefined,
        reason: selectedReason !== "ALL" ? selectedReason : undefined,
        responsibility: selectedResponsibility !== "ALL" ? selectedResponsibility : undefined,
        reasonCategory: selectedCategory !== "ALL" ? selectedCategory : undefined,
        whoPaid: selectedWhoPaid !== "ALL" ? selectedWhoPaid : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (res.success) {
        setItems(res.data as any[]);
        if (res.summary) setSummary(res.summary);
        if (res.totalCount !== undefined) setTotalCount(res.totalCount);
        if (res.totalPages !== undefined) setTotalPages(res.totalPages);
      } else {
        toast.error("Failed to load reports.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("An error occurred loading reports.");
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch report when filters change
  useEffect(() => {
    fetchReport();
  }, [page, selectedSeller, selectedStatus, selectedReason, selectedResponsibility, selectedCategory, selectedWhoPaid, startDate, endDate]);

  // Debounced search trigger
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setPage(1);
      fetchReport();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  // Excel/CSV Exporter
  const handleExport = async (format: "csv" | "excel") => {
    setIsExporting(true);
    try {
      const exportData = await getReturnRequestsExport({
        search: search || undefined,
        sellerId: selectedSeller !== "ALL" ? selectedSeller : undefined,
        status: selectedStatus !== "ALL" ? selectedStatus : undefined,
        reason: selectedReason !== "ALL" ? selectedReason : undefined,
        responsibility: selectedResponsibility !== "ALL" ? selectedResponsibility : undefined,
        reasonCategory: selectedCategory !== "ALL" ? selectedCategory : undefined,
        whoPaid: selectedWhoPaid !== "ALL" ? selectedWhoPaid : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (exportData.length === 0) {
        toast.error("No return records found matching filters.");
        return;
      }

      const formattedData = exportData.map(item => ({
        "Refund ID": item.refundId,
        "Seller Store": item.seller,
        "Order Number": item.orderNumber,
        "Customer Name & Email": item.customer,
        "Returned Products": item.productName,
        "SKU": item.productSku,
        "Quantity": item.quantity,
        "Product Amount": item.productAmount,
        "Original Shipping Fee": item.originalShipping,
        "Return Shipping Fee": item.returnShipping,
        "Customer Refund Amount": item.customerRefund,
        "Seller Deduction": item.sellerDeduction,
        "Customer Deduction": item.customerDeduction,
        "Platform Cost": item.platformCost,
        "Return Reason": item.returnReason,
        "Customer Comment": item.customerComment,
        "Responsibility Status": item.responsibility,
        "Who Paid Product Refund": item.whoPaidProductRefund,
        "Who Paid Original Shipping": item.whoPaidOriginalShipping,
        "Who Paid Return Shipping": item.whoPaidReturnShipping,
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

      const filename = `admin_return_refund_history_${new Date().toISOString().slice(0,10)}`;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 flex items-center gap-2">
            <CornerUpLeft className="h-8 w-8 text-stone-800" />
            Global Return & Refund Reports
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Global ledger-aligned return records audit, cost distributions, and downloadable CSV/Excel history reporting.
          </p>
        </div>
      </div>

      {/* Premium Admin Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Refunds Paid */}
        <div className="relative overflow-hidden bg-gradient-to-tr from-stone-900 to-stone-800 p-5 rounded-xl border border-stone-950 shadow-md text-white transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          <div className="relative z-10">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total Customers Refunded</p>
            <h3 className="text-3xl font-extrabold mt-1">{formatCurrency(summary.customerRefundTotal)}</h3>
            <div className="text-[10px] text-stone-400 mt-2 font-semibold">Across {summary.totalCount} return orders</div>
          </div>
          <CheckCircle className="absolute -right-4 -bottom-4 h-24 w-24 text-stone-700/20 pointer-events-none" />
        </div>

        {/* Card 2: Seller Deductions */}
        <div className="relative overflow-hidden bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs flex items-center justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <div>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total Seller Deductions</p>
            <h3 className="text-3xl font-extrabold text-stone-900 mt-1">{formatCurrency(summary.sellerDeductionsTotal)}</h3>
            <div className="text-[10px] text-stone-400 mt-2 font-semibold">Refunded items and shipping fees</div>
          </div>
          <div className="p-3 bg-stone-50 rounded-xl text-stone-700 border border-stone-100">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
        </div>

        {/* Card 3: Platform Cost */}
        <div className="relative overflow-hidden bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs flex items-center justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <div>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total Platform Cost</p>
            <h3 className="text-3xl font-extrabold text-amber-700 mt-1">{formatCurrency(summary.platformCostTotal)}</h3>
            <div className="text-[10px] text-stone-400 mt-2 font-semibold">Platform-fault return expenses</div>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-700 border border-amber-100">
            <HelpCircle className="h-5 w-5" />
          </div>
        </div>

        {/* Card 4: Categories Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Claim Responsibility Splits</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-rose-600 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500"></span> Seller Fault
              </span>
              <span className="font-bold text-stone-900">{summary.sellerFaultCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-blue-600 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500"></span> Customer Fault
              </span>
              <span className="font-bold text-stone-900">{summary.customerFaultCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-purple-600 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-purple-500"></span> Platform Fault
              </span>
              <span className="font-bold text-stone-900">{summary.platformFaultCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Query Filters */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
          <Filter className="h-4.5 w-4.5 text-stone-600" />
          <span className="text-sm font-bold text-stone-800">Global Query Filters</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          {/* Global search */}
          <div className="col-span-1 sm:col-span-2 space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Product or Order or Customer</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search name, email, Order #, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8.5 pr-3 py-1.5 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400"
              />
            </div>
          </div>

          {/* Seller Store */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Seller Store</label>
            <select
              value={selectedSeller}
              onChange={(e) => { setPage(1); setSelectedSeller(e.target.value); }}
              className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs bg-white font-semibold text-stone-700"
            >
              <option value="ALL">All Stores</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>{seller.storeName}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Refund Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => { setPage(1); setSelectedStatus(e.target.value); }}
              className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs bg-white font-semibold text-stone-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="REFUNDED">Refunded</option>
              <option value="REQUESTED">Requested</option>
              <option value="APPROVED">Approved</option>
              <option value="ITEM_RECEIVED">Item Received</option>
              <option value="REJECTED">Rejected</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* Return Reason */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Return Reason</label>
            <select
              value={selectedReason}
              onChange={(e) => { setPage(1); setSelectedReason(e.target.value); }}
              className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs bg-white font-semibold text-stone-700"
            >
              <option value="ALL">All Reasons</option>
              {reasonOptions.map((r, idx) => (
                <option key={idx} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Responsibility */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Responsibility</label>
            <select
              value={selectedResponsibility}
              onChange={(e) => { setPage(1); setSelectedResponsibility(e.target.value); }}
              className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs bg-white font-semibold text-stone-700"
            >
              <option value="ALL">All Responsibilities</option>
              <option value="SELLER">Seller Bears</option>
              <option value="CUSTOMER">Customer Bears</option>
              <option value="PLATFORM">Platform Bears</option>
            </select>
          </div>

          {/* Fault Category */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Fault Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => { setPage(1); setSelectedCategory(e.target.value); }}
              className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs bg-white font-semibold text-stone-700"
            >
              <option value="ALL">All Categories</option>
              <option value="SELLER_FAULT">Seller Fault</option>
              <option value="CUSTOMER_FAULT">Customer Fault</option>
              <option value="PLATFORM_FAULT">Platform Fault</option>
            </select>
          </div>

          {/* Who Paid Dropdown */}
          <div className="col-span-1 sm:col-span-2 space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Charge Payers (Who Paid...)</label>
            <select
              value={selectedWhoPaid}
              onChange={(e) => { setPage(1); setSelectedWhoPaid(e.target.value); }}
              className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs bg-white font-semibold text-stone-700"
            >
              <option value="ALL">All Payer Splits</option>
              <option value="whoPaidProductRefund_Seller">Product Refund Paid by Seller</option>
              <option value="whoPaidProductRefund_Platform">Product Refund Paid by Platform</option>
              <option value="whoPaidOriginalShipping_Seller">Original Shipping Paid by Seller</option>
              <option value="whoPaidOriginalShipping_Customer">Original Shipping Paid by Customer</option>
              <option value="whoPaidOriginalShipping_Platform">Original Shipping Paid by Platform</option>
              <option value="whoPaidReturnShipping_Seller">Return Shipping Paid by Seller</option>
              <option value="whoPaidReturnShipping_Customer">Return Shipping Paid by Customer</option>
              <option value="whoPaidReturnShipping_Platform">Return Shipping Paid by Platform</option>
            </select>
          </div>

          {/* Date range filter row */}
          <div className="col-span-1 sm:col-span-2 flex flex-col justify-end">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Date Range</label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setPage(1); setStartDate(e.target.value); }}
                className="w-full px-2 py-1 border border-stone-200 rounded-lg text-xs"
              />
              <span className="text-stone-400 text-xs">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setPage(1); setEndDate(e.target.value); }}
                className="w-full px-2 py-1 border border-stone-200 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Exports */}
          <div className="flex flex-col justify-end gap-1.5">
            <div className="flex gap-2">
              <button
                disabled={isExporting}
                onClick={() => handleExport("excel")}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-bold transition-all duration-200 hover:bg-stone-800 disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Excel
              </button>
              <button
                disabled={isExporting}
                onClick={() => handleExport("csv")}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 border border-stone-300 text-stone-700 rounded-lg text-xs font-bold transition-all duration-200 hover:bg-stone-50 disabled:opacity-50"
              >
                CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Global Reports Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs z-20 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-stone-600">
              <Loader2 className="h-8 w-8 animate-spin text-stone-800" />
              <span className="text-xs font-bold">Querying global records...</span>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-stone-500 space-y-3">
            <AlertCircle className="h-8 w-8 text-stone-300 animate-pulse" />
            <div className="text-center">
              <p className="text-sm font-semibold text-stone-700">No global return records found</p>
              <p className="text-xs text-stone-400 mt-1">Try adjusting your global query filters or date ranges.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-3">Date</th>
                    <th className="py-3.5 px-3">Seller Store</th>
                    <th className="py-3.5 px-3">Order Number</th>
                    <th className="py-3.5 px-3">Customer Details</th>
                    <th className="py-3.5 px-3 font-bold">Returned Products</th>
                    <th className="py-3.5 px-3">Return Reason & Comment</th>
                    <th className="py-3.5 px-3 text-right">Customer Refund</th>
                    <th className="py-3.5 px-3 text-right">Seller Deduct</th>
                    <th className="py-3.5 px-3 text-right">Cust Deduct</th>
                    <th className="py-3.5 px-3 text-right">Platform Cost</th>
                    <th className="py-3.5 px-3 text-right">Orig Shipping</th>
                    <th className="py-3.5 px-3 text-right">Ret Shipping</th>
                    <th className="py-3.5 px-3 text-center">Shipping Payers</th>
                    <th className="py-3.5 px-3 text-center">Commission Status</th>
                    <th className="py-3.5 px-3 text-center">Status</th>
                    <th className="py-3.5 px-3">Ledger Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium text-stone-700 text-xs">
                  {items.map((ret) => {
                    const originalShippingPaidBy = ret.whoPaidOriginalShipping || "Customer";
                    const returnShippingPaidBy = ret.whoPaidReturnShipping || "Customer";
                    const ledgerRef = ret.ledgerTransactionRef || "";

                    return (
                      <tr key={ret.id} className="hover:bg-stone-50/30 align-top transition-colors">
                        {/* Date */}
                        <td className="py-3.5 px-3 font-medium text-stone-500 whitespace-nowrap">
                          {formatDate(ret.createdAt)}
                        </td>
                        {/* Seller */}
                        <td className="py-3.5 px-3 whitespace-nowrap font-bold text-stone-900">
                          <div className="flex items-center gap-1">
                            <Store className="h-3 w-3 text-stone-400 shrink-0" />
                            {ret.sellerStoreName || "Store Profile"}
                          </div>
                        </td>
                        {/* Order Number */}
                        <td className="py-3.5 px-3 font-bold text-stone-950 whitespace-nowrap">
                          #{ret.orderNumber || ""}
                        </td>
                        {/* Customer */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="font-semibold text-stone-950">{ret.customerName}</div>
                          <div className="text-[10px] text-stone-400">{ret.customerEmail}</div>
                        </td>
                        {/* Product */}
                        <td className="py-3.5 px-3 max-w-[150px]">
                          <div className="font-semibold text-stone-850 line-clamp-1">
                            {ret.productName}
                          </div>
                          <div className="text-[9px] text-stone-400">SKU: {ret.productSku}</div>
                        </td>
                        {/* Reason */}
                        <td className="py-3.5 px-3 max-w-[180px]">
                          <div className="font-bold text-stone-850">{ret.reason}</div>
                          {ret.description && (
                            <div className="text-[10px] text-stone-400 font-normal italic line-clamp-1">
                              "{ret.description}"
                            </div>
                          )}
                        </td>
                        {/* Customer Refund */}
                        <td className="py-3.5 px-3 text-right font-bold text-stone-950">
                          {formatCurrency(ret.customerRefundAmount)}
                        </td>
                        {/* Seller Deduction */}
                        <td className="py-3.5 px-3 text-right font-bold text-rose-700">
                          {formatCurrency(ret.sellerDeductionAmount)}
                        </td>
                        {/* Customer Deduction */}
                        <td className="py-3.5 px-3 text-right font-bold text-amber-700">
                          {formatCurrency(ret.deductionAmount)}
                        </td>
                        {/* Platform Cost */}
                        <td className="py-3.5 px-3 text-right font-bold text-purple-700">
                          {formatCurrency(ret.platformCost)}
                        </td>
                        {/* Original Shipping Fee */}
                        <td className="py-3.5 px-3 text-right font-semibold text-stone-500">
                          {formatCurrency(ret.originalShippingFee)}
                        </td>
                        {/* Return Shipping Fee */}
                        <td className="py-3.5 px-3 text-right font-semibold text-stone-500">
                          {formatCurrency(ret.returnShippingFee)}
                        </td>
                        {/* Who Paid Shipping */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <div className="space-y-0.5">
                            <div className="text-[9px] leading-none font-bold">
                              Orig: <span className={
                                originalShippingPaidBy === "Seller" ? "text-rose-600" :
                                originalShippingPaidBy === "Platform" ? "text-purple-600" : "text-blue-600"
                              }>{originalShippingPaidBy}</span>
                            </div>
                            <div className="text-[9px] leading-none font-bold">
                              Ret: <span className={
                                returnShippingPaidBy === "Seller" ? "text-rose-600" :
                                returnShippingPaidBy === "Platform" ? "text-purple-600" : "text-blue-600"
                              }>{returnShippingPaidBy}</span>
                            </div>
                          </div>
                        </td>
                        {/* Commission */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap font-bold text-[10px]">
                          <span className={ret.reverseCommission ? "text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded" : "text-stone-600 bg-stone-50 px-1.5 py-0.5 rounded"}>
                            {ret.reverseCommission ? "Reversed" : "Remains"}
                          </span>
                        </td>
                        {/* Status */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {getStatusBadge(ret.status)}
                        </td>
                        {/* Ledger */}
                        <td className="py-3.5 px-3 whitespace-nowrap text-[9px] font-mono text-stone-500">
                          {ledgerRef || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-stone-50 border-t border-stone-200 px-4 py-3.5 flex items-center justify-between">
              <div className="text-xs font-semibold text-stone-500">
                Showing <span className="text-stone-800">{(page - 1) * 10 + 1}</span> to{" "}
                <span className="text-stone-800">{Math.min(page * 10, totalCount)}</span> of{" "}
                <span className="text-stone-800">{totalCount}</span> records
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  className="p-1.5 border border-stone-300 rounded-lg bg-white text-stone-600 disabled:opacity-40 transition-colors hover:bg-stone-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    onClick={() => setPage(pageNumber)}
                    className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all duration-150 ${
                      page === pageNumber
                        ? "bg-stone-900 border-stone-950 text-white shadow-sm"
                        : "bg-white border-stone-300 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  className="p-1.5 border border-stone-300 rounded-lg bg-white text-stone-600 disabled:opacity-40 transition-colors hover:bg-stone-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
