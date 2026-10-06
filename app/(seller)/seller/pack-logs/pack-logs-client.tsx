"use client";

import Link from "next/link";
import type { PackLog } from "@prisma/client";

export default function PackLogsClient({ packLogs }: { packLogs: PackLog[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-foreground">Pack Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every batch of orders packed together, with its scan-and-pack progress and dispatch status.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm text-foreground">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Orders</th>
              <th className="px-4 py-3 text-left">Total Qty</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {packLogs.map((pl) => (
              <tr key={pl.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-mono font-medium text-xs">{pl.name}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(pl.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </td>
                <td className="px-4 py-3">{pl.orderCount}</td>
                <td className="px-4 py-3">{pl.totalQty}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
                      pl.status === "DISPATCHED"
                        ? "bg-green-100 border-green-200 text-green-800"
                        : "bg-stone-100 border-stone-200 text-stone-800"
                    }`}
                  >
                    {pl.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/seller/pack-logs/${pl.id}`} className="text-xs font-semibold text-accent hover:underline">
                    View Details
                  </Link>
                </td>
              </tr>
            ))}
            {packLogs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No pack logs yet. Pack orders from the Orders page to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
