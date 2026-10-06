"use client";

import { useState } from "react";
import { 
  Download, RefreshCw, AlertCircle, FileSpreadsheet, Play, Coins, Wallet, BarChart3, TrendingUp, HelpCircle, AlertTriangle, Percent
} from "lucide-react";
import { getReportData } from "@/actions/analytics";
import { toast } from "sonner";

type ReportRow = Record<string, string | number | boolean | null>;

interface SellerReportsClientProps {
  summary: {
    totalSales: string;
    totalEarned: string;
    commissionDeducted: string;
    refundDeductions: string;
    amountOnHold: string;
    amountPaid: string;
    availableBalance: string;
    negativeBalance: string;
  };
}

export default function SellerReportsClient({ summary }: SellerReportsClientProps) {
  const [reportType, setReportType] = useState("sales");
  const [filter, setFilter] = useState("30days");
  const [customDates, setCustomDates] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportRow[]>([]);
  const [searched, setSearched] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (filter === "custom" && (!customDates.start || !customDates.end)) {
      toast.error("Please specify custom start and end dates.");
      return;
    }

    setLoading(true);
    try {
      const res = await getReportData(
        reportType, 
        filter, 
        filter === "custom" ? customDates.start : undefined, 
        filter === "custom" ? customDates.end : undefined
      );
      setData(res as ReportRow[]);
      setSearched(true);
      toast.success("Report generated successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate report.");
    } finally {
      setLoading(false);
    }
  };

  const getExportUrl = (format: "csv" | "xlsx") => {
    const params = new URLSearchParams({
      type: reportType,
      filter,
      format,
    });
    if (filter === "custom") {
      params.append("start", customDates.start);
      params.append("end", customDates.end);
    }
    return `/api/export?${params.toString()}`;
  };

  const formatCurrency = (val: string | number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(parseFloat(val.toString()));
  };

  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="space-y-8">
      {/* Visual Premium Summary Dashboard */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Total Sales */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Total Sales</span>
            <Coins className="h-4 w-4 text-stone-400" />
          </div>
          <div className="mt-2 text-xl font-semibold text-stone-900">{formatCurrency(summary.totalSales)}</div>
          <p className="mt-0.5 text-[10px] text-stone-450">Gross value of ordered items</p>
        </div>

        {/* Total Earnings */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Net Earnings</span>
            <Coins className="h-4 w-4 text-stone-400" />
          </div>
          <div className="mt-2 text-xl font-semibold text-stone-900">{formatCurrency(summary.totalEarned)}</div>
          <p className="mt-0.5 text-[10px] text-stone-450">Gross sales minus commissions</p>
        </div>

        {/* Commission Deducted */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Commissions</span>
            <Percent className="h-4 w-4 text-stone-400" />
          </div>
          <div className="mt-2 text-xl font-semibold text-stone-900">{formatCurrency(summary.commissionDeducted)}</div>
          <p className="mt-0.5 text-[10px] text-stone-450">Platform fee deductions</p>
        </div>

        {/* Refund Deductions */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Refund Deductions</span>
            <TrendingUp className="h-4 w-4 text-stone-400" />
          </div>
          <div className="mt-2 text-xl font-semibold text-stone-900">{formatCurrency(summary.refundDeductions)}</div>
          <p className="mt-0.5 text-[10px] text-stone-450">Cancelled & returned order payouts</p>
        </div>

        {/* Amount on Hold */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Amount On Hold</span>
            <HelpCircle className="h-4 w-4 text-stone-400" />
          </div>
          <div className="mt-2 text-xl font-semibold text-stone-900">{formatCurrency(summary.amountOnHold)}</div>
          <p className="mt-0.5 text-[10px] text-stone-450">Matures in escrow (pending/reserve)</p>
        </div>

        {/* Amount Paid */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Total Withdrawn</span>
            <Wallet className="h-4 w-4 text-stone-400" />
          </div>
          <div className="mt-2 text-xl font-semibold text-stone-900">{formatCurrency(summary.amountPaid)}</div>
          <p className="mt-0.5 text-[10px] text-stone-450">Successfully paid out to bank</p>
        </div>

        {/* Available Balance */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Available Balance</span>
            <Wallet className="h-4 w-4 text-stone-400" />
          </div>
          <div className="mt-2 text-xl font-semibold text-stone-900">{formatCurrency(summary.availableBalance)}</div>
          <p className="mt-0.5 text-[10px] text-stone-450">Withdrawable funds in wallet</p>
        </div>

        {/* Negative Balance */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Debt Balance</span>
            <AlertTriangle className="h-4 w-4 text-stone-400" />
          </div>
          <div className="mt-2 text-xl font-semibold text-stone-900">{formatCurrency(summary.negativeBalance)}</div>
          <p className="mt-0.5 text-[10px] text-stone-450">Outstanding negative account balance</p>
        </div>
      </section>

      {/* Controls Card */}
      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleGenerate} className="grid gap-6 md:grid-cols-4 items-end">
          {/* Report Type */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Report Category</label>
            <select
              value={reportType}
              onChange={(e) => { setReportType(e.target.value); setData([]); setSearched(false); }}
              className="h-10 w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 text-sm focus:border-stone-500 focus:bg-white outline-none transition"
            >
              <option value="sales">Sales Report</option>
              <option value="product">Product Performance</option>
              <option value="inventory">Inventory Stock status</option>
              <option value="seller_ledger">Seller Ledger Statement</option>
              <option value="payout_report">Payout History</option>
              <option value="transaction_history">Transaction History</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Date Window</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 text-sm focus:border-stone-500 focus:bg-white outline-none transition"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="thisYear">This Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Date Inputs */}
          {filter === "custom" ? (
            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Start Date</label>
                <input
                  type="date"
                  value={customDates.start}
                  onChange={(e) => setCustomDates({ ...customDates, start: e.target.value })}
                  className="h-10 w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 text-sm focus:border-stone-500 focus:bg-white outline-none transition"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">End Date</label>
                <input
                  type="date"
                  value={customDates.end}
                  onChange={(e) => setCustomDates({ ...customDates, end: e.target.value })}
                  className="h-10 w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 text-sm focus:border-stone-500 focus:bg-white outline-none transition"
                />
              </div>
            </div>
          ) : (
            <div className="hidden md:block md:col-span-1" />
          )}

          {/* Action Trigger */}
          <div className="md:col-span-1">
            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-lg bg-stone-900 text-white font-medium text-xs hover:bg-stone-850 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Compiling...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> Compile Report
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Results Section */}
      {searched && (
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-150 pb-4">
            <div>
              <h2 className="text-md font-semibold text-stone-900">Report Preview</h2>
              <p className="text-xs text-stone-500 mt-0.5">Found {data.length} records matching guidelines.</p>
            </div>

            {data.length > 0 && (
              <div className="flex items-center gap-3">
                <a
                  href={getExportUrl("csv")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-stone-200 rounded-lg text-xs font-semibold text-stone-750 hover:bg-stone-50 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 text-stone-400" /> Export CSV
                </a>
                <a
                  href={getExportUrl("xlsx")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold text-white shadow-sm"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-100" /> Export Excel (.xlsx)
                </a>
              </div>
            )}
          </div>

          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-2 text-stone-450">
              <AlertCircle className="h-6 w-6 text-stone-300" />
              <div className="text-xs font-medium">No records found within specified filters.</div>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[450px]">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="sticky top-0 bg-stone-50 border-b border-stone-200 shadow-sm">
                  <tr>
                    {columns.map((c) => (
                      <th key={c} className="py-3 px-4 font-bold text-stone-500 uppercase tracking-wider">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700 font-medium">
                  {data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/50">
                      {columns.map((c) => (
                        <td key={c} className="py-2.5 px-4">
                          {row[c] === null || row[c] === undefined
                            ? "N/A"
                            : typeof row[c] === "boolean"
                            ? row[c]
                              ? "Yes"
                              : "No"
                            : String(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
