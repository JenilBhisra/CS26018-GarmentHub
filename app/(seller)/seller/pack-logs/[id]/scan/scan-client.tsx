"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { scanOrderItem, getTmpBins } from "@/actions/scan-pack";
import { RefreshCw } from "lucide-react";

interface TmpBinRow {
  binLabel: string;
  sku: string;
  productName: string;
  scanned: number;
  max: number;
  remaining: number;
}

interface Props {
  packLogId: string;
  packLogName: string;
  initialBins: TmpBinRow[];
  initialScannedCount: number;
  totalCount: number;
}

export default function ScanPackClient({ packLogId, packLogName, initialBins, initialScannedCount, totalCount }: Props) {
  const [, startTransition] = useTransition();
  const [skuCode, setSkuCode] = useState("");
  const [tagLoopNumber, setTagLoopNumber] = useState("");
  const [bins, setBins] = useState<TmpBinRow[]>(initialBins);
  const [scannedCount, setScannedCount] = useState(initialScannedCount);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const skuInputRef = useRef<HTMLInputElement>(null);

  async function refreshBins() {
    const res = await getTmpBins(packLogId);
    if (res.success) {
      setBins(res.bins);
      setScannedCount(res.scannedCount);
    }
  }

  function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!skuCode.trim() || isSubmitting) return;

    setIsSubmitting(true);
    startTransition(async () => {
      const res = await scanOrderItem(packLogId, skuCode.trim(), tagLoopNumber.trim() || undefined);
      setIsSubmitting(false);
      if (res.success) {
        toast.success(`Scanned ${skuCode.trim()}`);
        setSkuCode("");
        setTagLoopNumber("");
        await refreshBins();
      } else {
        toast.error(res.error || "Scan failed.");
      }
      skuInputRef.current?.focus();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/seller/pack-logs" className="hover:underline">
            Pack Logs
          </Link>{" "}
          /{" "}
          <Link href={`/seller/pack-logs/${packLogId}`} className="hover:underline">
            {packLogName}
          </Link>{" "}
          / Scan & Pack
        </p>
        <h1 className="font-display text-3xl text-foreground mt-1">Scan & Pack Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scan the product SKU barcode (and Tag Loop number, if used) to pack each order in this batch.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <form onSubmit={handleScan} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Scan SKU Code</label>
            <input
              ref={skuInputRef}
              autoFocus
              value={skuCode}
              onChange={(e) => setSkuCode(e.target.value)}
              placeholder="Scan or type SKU code"
              className="w-full rounded-lg border border-input px-3 py-2 bg-muted/20 focus:border-accent focus:bg-background outline-none transition text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Tag Loop No. (optional)</label>
            <input
              value={tagLoopNumber}
              onChange={(e) => setTagLoopNumber(e.target.value)}
              placeholder="Scan or type Tag Loop number"
              className="w-full rounded-lg border border-input px-3 py-2 bg-muted/20 focus:border-accent focus:bg-background outline-none transition text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-stone-900 text-white hover:bg-stone-800 px-4 py-2 text-sm font-semibold disabled:opacity-50 cursor-pointer"
            >
              Scan
            </button>
          </div>
        </form>

        <div className="text-sm font-medium text-foreground">
          Scanned & Packed Orders: {scannedCount}/{totalCount}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-foreground">Tmp Bins</h2>
          <button onClick={refreshBins} className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline cursor-pointer">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm text-foreground">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">Bin</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Scanned</th>
                <th className="px-4 py-3 text-left">Max</th>
                <th className="px-4 py-3 text-left">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bins.map((b) => (
                <tr key={b.binLabel} className={b.remaining === 0 ? "bg-green-50/50" : ""}>
                  <td className="px-4 py-3 font-mono text-xs">{b.binLabel}</td>
                  <td className="px-4 py-3 text-xs font-medium">{b.sku}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{b.productName}</td>
                  <td className="px-4 py-3">{b.scanned}</td>
                  <td className="px-4 py-3">{b.max}</td>
                  <td className="px-4 py-3">{b.remaining}</td>
                </tr>
              ))}
              {bins.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No items in this pack log.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
