"use client";

import React, { useState } from "react";
import {
  Coins,
  TrendingUp,
  Percent,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  AlertOctagon,
  FileSpreadsheet,
  Settings,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import { alignWalletToLedger, reconcileAllWalletsAdmin, reconcilePlatformFinancials, getFinancialHealthReport, resetFinancialDataDev } from "@/actions/wallets";

interface AccountingClientProps {
  initialPlatformRecon: any;
  initialHealthReport: any;
  initialWalletRecon: any;
}

export default function AccountingClient({
  initialPlatformRecon,
  initialHealthReport,
  initialWalletRecon,
}: AccountingClientProps) {
  const [platformRecon, setPlatformRecon] = useState(initialPlatformRecon);
  const [healthReport, setHealthReport] = useState(initialHealthReport);
  const [walletRecon, setWalletRecon] = useState(initialWalletRecon);
  const [loading, setLoading] = useState(false);
  const [fixingId, setFixingId] = useState<string | null>(null);

  // Trigger full system-wide audit and update status
  const handleRunAudit = async () => {
    setLoading(true);
    try {
      const [pRecon, hReport, wRecon] = await Promise.all([
        reconcilePlatformFinancials(),
        getFinancialHealthReport(),
        reconcileAllWalletsAdmin(),
      ]);
      setPlatformRecon(pRecon);
      setHealthReport(hReport);
      setWalletRecon(wRecon);
      toast.success("System audit completed. Financial statements updated.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to compile financial audit.");
    } finally {
      setLoading(false);
    }
  };

  // Reconcile and fix a mismatched wallet
  const handleFixWallet = async (sellerId: string) => {
    setFixingId(sellerId);
    try {
      const res = await alignWalletToLedger(sellerId);
      if (res.success) {
        toast.success(res.message);
        // Refresh audit data
        const [hReport, wRecon, pRecon] = await Promise.all([
          getFinancialHealthReport(),
          reconcileAllWalletsAdmin(),
          reconcilePlatformFinancials(),
        ]);
        setHealthReport(hReport);
        setWalletRecon(wRecon);
        setPlatformRecon(pRecon);
      } else {
        toast.error("Failed to reconcile wallet.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to align wallet.");
    } finally {
      setFixingId(null);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  const getExportUrl = (type: string, format: "csv" | "xlsx") => {
    return `/api/export?type=${type}&format=${format}&filter=thisYear`;
  };

  return (
    <div className="space-y-8">
      {/* Dynamic Reconciliation Status Banner */}
      <section className="relative overflow-hidden rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-[0.03] text-stone-900 pointer-events-none">
          <Scale className="h-64 w-64" />
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-lg font-medium text-stone-950 flex items-center gap-2">
              <Scale className="h-5 w-5 text-stone-600" />
              Double-Entry Ledger Balancing Status
            </h2>
            <p className="text-sm text-stone-500 max-w-2xl">
              Verifies that total customer payments in the ledger equal the sum of active seller balances, payouts, refunds, commission revenues, platform fees, and manual adjustments.
            </p>
          </div>
          <button
            onClick={handleRunAudit}
            disabled={loading}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 border border-stone-250 bg-stone-50 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-100 transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Run Financial Audit
          </button>
        </div>

        <div className="mt-6">
          {platformRecon.isBalanced ? (
            <div className="flex items-center gap-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200 p-4 text-emerald-850">
              <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
              <div className="text-xs font-medium">
                <span className="font-semibold text-emerald-950">Ledger Balanced & Healthy.</span> All platform accounts match and reconcile down to the rupee. Mismatch difference is ₹0.00.
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3.5 rounded-lg bg-rose-50/70 border border-rose-200 p-4 text-rose-850">
              <AlertOctagon className="h-5 w-5 shrink-0 text-rose-600" />
              <div className="text-xs font-medium">
                <span className="font-semibold text-rose-950">Financial Imbalance Detected!</span> The platform ledger is currently out of balance by{" "}
                <span className="font-bold underline">{formatCurrency(platformRecon.difference)}</span>. Please audit transactions and align wallets immediately.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Accounting Totals Metric Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Payments */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Customer Payments</span>
            <Coins className="h-4 w-4 text-stone-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-stone-900">
            {formatCurrency(platformRecon.customerPayments)}
          </div>
          <p className="mt-0.5 text-[10px] text-stone-400">Total payments collected from clients</p>
        </div>

        {/* Seller Payables */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Seller Liabilities</span>
            <Coins className="h-4 w-4 text-stone-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-stone-900">
            {formatCurrency(platformRecon.sellerLiabilities)}
          </div>
          <p className="mt-0.5 text-[10px] text-stone-400">
            Pending (₹{platformRecon.walletSummary.pending.toFixed(0)}) + Withdrawable (₹{platformRecon.walletSummary.withdrawable.toFixed(0)}) + Reserve (₹{platformRecon.walletSummary.reserve.toFixed(0)})
          </p>
        </div>

        {/* Platform Revenue */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Platform Revenue</span>
            <Percent className="h-4 w-4 text-stone-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-stone-900">
            {formatCurrency(platformRecon.platformRevenue + platformRecon.platformShipping + platformRecon.platformFees)}
          </div>
          <p className="mt-0.5 text-[10px] text-stone-400">
            Comm. (₹{Number(platformRecon.platformRevenue).toFixed(0)}) + Ship. (₹{Number(platformRecon.platformShipping).toFixed(0)}) + Fees (₹{Number(platformRecon.platformFees).toFixed(0)})
          </p>
        </div>

        {/* Refunds & Outflows */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Refunds & Payouts</span>
            <TrendingUp className="h-4 w-4 text-stone-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-stone-900">
            {formatCurrency(platformRecon.refunds + platformRecon.payouts)}
          </div>
          <p className="mt-0.5 text-[10px] text-stone-400">
            Refunds: {formatCurrency(platformRecon.refunds)} | Payouts: {formatCurrency(platformRecon.payouts)}
          </p>
        </div>

        {/* Shipping Payable / Courier Payable */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Shipping / Courier Payable</span>
            <TrendingUp className="h-4 w-4 text-stone-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-stone-900">
            {formatCurrency(platformRecon.returnShippingPayable || 0)}
          </div>
          <p className="mt-0.5 text-[10px] text-stone-400">
            External return shipping courier payables
          </p>
        </div>
      </div>

      {/* Spreadsheet Exports */}
      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-stone-900 border-b border-stone-150 pb-3">
          Spreadsheet settlement & Audit Exports
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          {[
            { label: "Seller Ledger", type: "seller_ledger" },
            { label: "Payout Report", type: "payout_report" },
            { label: "Refund Report", type: "refund_report" },
            { label: "Commission Report", type: "commission_report" },
            { label: "Settlement Report", type: "admin_settlement" },
          ].map((rep) => (
            <div key={rep.type} className="flex flex-col justify-between rounded-lg border border-stone-150 bg-stone-50/50 p-3.5 space-y-3">
              <div className="text-xs font-bold text-stone-750 truncate">{rep.label}</div>
              <div className="flex items-center gap-2">
                <a
                  href={getExportUrl(rep.type, "csv")}
                  className="flex-1 text-center py-1.5 border border-stone-200 rounded-md text-[10px] font-bold text-stone-650 hover:bg-white shadow-2xs"
                >
                  CSV
                </a>
                <a
                  href={getExportUrl(rep.type, "xlsx")}
                  className="flex-1 text-center py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-md text-[10px] font-bold text-white shadow-2xs inline-flex items-center justify-center gap-1"
                >
                  <FileSpreadsheet className="h-3 w-3" /> Excel
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Integrity Health Audit Checks & Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ledger Integrity health status */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-stone-900 border-b border-stone-150 pb-3">
              System Integrity Audit
            </h3>
            <ul className="space-y-3.5 text-xs">
              {/* Ledger Balanced */}
              <li className="flex items-center justify-between">
                <span className="text-stone-500">Ledger Book Balanced</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${healthReport.ledgerBalanced ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {healthReport.ledgerBalanced ? "BALANCED" : "MISMATCH"}
                </span>
              </li>
              {/* Wallets Matched */}
              <li className="flex items-center justify-between">
                <span className="text-stone-500">Wallets Align with Ledger</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${healthReport.walletsMatched ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {healthReport.walletsMatched ? "ALL MATCH" : `${healthReport.totalWalletMismatches} MISMATCHES`}
                </span>
              </li>
              {/* Negative Reserve Check */}
              <li className="flex items-center justify-between">
                <span className="text-stone-500">Negative Reserve Balances</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${healthReport.negativeReserveCount === 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {healthReport.negativeReserveCount === 0 ? "NONE" : `${healthReport.negativeReserveCount} DETECTED`}
                </span>
              </li>
              {/* Orphan Payouts */}
              <li className="flex items-center justify-between">
                <span className="text-stone-500">Orphan Payout Requests</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${healthReport.orphanPayouts === 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {healthReport.orphanPayouts === 0 ? "NONE" : `${healthReport.orphanPayouts} DETECTED`}
                </span>
              </li>
              {/* Orphan Refunds */}
              <li className="flex items-center justify-between">
                <span className="text-stone-500">Orphan Refund Entries</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${healthReport.orphanRefunds === 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {healthReport.orphanRefunds === 0 ? "NONE" : `${healthReport.orphanRefunds} DETECTED`}
                </span>
              </li>
            </ul>
          </div>
          <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
            <span>Overall Status:</span>
            <span className={`font-semibold ${healthReport.isHealthy ? "text-emerald-600" : "text-rose-600"}`}>
              {healthReport.isHealthy ? "SYSTEM HEALTHY" : "ATTENTION REQUIRED"}
            </span>
          </div>
        </section>

        {/* Live Wallet Audits */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm lg:col-span-2 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Live Seller Wallet Reconciliation</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Checks live ledger entries against wallet balance columns. Mismatches can be auto-aligned.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-stone-500">Store Name</th>
                  <th className="py-2.5 px-3 font-semibold text-stone-500">Withdrawable</th>
                  <th className="py-2.5 px-3 font-semibold text-stone-500">Pending</th>
                  <th className="py-2.5 px-3 font-semibold text-stone-500">Reserve</th>
                  <th className="py-2.5 px-3 font-semibold text-stone-500 text-center">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-stone-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {walletRecon.reports.map((rep: any) => (
                  <tr key={rep.sellerId} className="hover:bg-stone-50/50">
                    <td className="py-3 px-3 text-stone-900">{rep.storeName}</td>
                    <td className="py-3 px-3">
                      ₹{parseFloat(rep.wallet.withdrawableBalance).toFixed(2)}
                      {rep.status.withdrawableMatch ? null : (
                        <span className="block text-[10px] text-rose-500 font-bold">
                          Expected: ₹{parseFloat(rep.expected.withdrawableBalance).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      ₹{parseFloat(rep.wallet.pendingBalance).toFixed(2)}
                      {rep.status.pendingMatch ? null : (
                        <span className="block text-[10px] text-rose-500 font-bold">
                          Expected: ₹{parseFloat(rep.expected.pendingBalance).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      ₹{parseFloat(rep.wallet.reserveBalance).toFixed(2)}
                      {rep.status.reserveMatch ? null : (
                        <span className="block text-[10px] text-rose-500 font-bold">
                          Expected: ₹{parseFloat(rep.expected.reserveBalance).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${rep.isReconciled ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {rep.isReconciled ? "OK" : "MISMATCH"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {rep.isReconciled ? (
                        <span className="text-[10px] text-stone-400 font-medium">Reconciled</span>
                      ) : (
                        <button
                          onClick={() => handleFixWallet(rep.sellerId)}
                          disabled={fixingId !== null}
                          className="px-2.5 py-1 bg-stone-900 hover:bg-stone-850 text-white rounded text-[10px] font-bold transition disabled:opacity-50 cursor-pointer shadow-xs"
                        >
                          {fixingId === rep.sellerId ? "Aligning..." : "Force Align"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Dev Reset Action */}
      <section className="rounded-xl border border-rose-200 bg-rose-50/10 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 text-rose-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-rose-950">Developer Sandbox Control Panel</h3>
            <p className="text-xs text-rose-600 mt-0.5">
              Reset all financial ledgers, wallets, payouts, return requests, and orders to start fresh. Only available in local development mode.
            </p>
          </div>
        </div>
        <button
          onClick={async () => {
            const confirmed = window.confirm(
              "WARNING: Are you sure you want to reset all financial data? \n\n" +
              "This will:\n" +
              "- Delete all Ledger Entries\n" +
              "- Delete all Wallet Transactions\n" +
              "- Delete all Payout Requests & Returns\n" +
              "- Delete all Orders & Shipments\n" +
              "- Set all Seller Wallet Balances to ₹0.00\n\n" +
              "This action is destructive and cannot be undone."
            );
            if (!confirmed) return;

            setLoading(true);
            try {
              const res = await resetFinancialDataDev();
              if (res.success) {
                toast.success((res as any).message);
                await handleRunAudit();
              } else {
                toast.error((res as any).error || "Failed to reset financial data.");
              }
            } catch (err: any) {
              console.error(err);
              toast.error(err.message || "Failed to trigger developer reset.");
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Resetting..." : "Reset Financial Testing Data to Zero"}
        </button>
      </section>
    </div>
  );
}
