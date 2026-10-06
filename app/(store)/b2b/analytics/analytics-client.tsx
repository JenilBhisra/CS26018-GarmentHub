"use client";

import { useState, useEffect } from "react";
import { 
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from "recharts";
import { FileText, Mail, CheckCircle2, ShoppingBag, Coins, RefreshCw } from "lucide-react";
import { getB2BAnalytics } from "@/actions/analytics";

type ClientProps = {
  initialData: Awaited<ReturnType<typeof getB2BAnalytics>>;
};

export default function B2BAnalyticsClient({ initialData }: ClientProps) {
  const [data] = useState(initialData);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const renderChart = (chartComponent: React.ReactNode) => {
    if (!mounted) {
      return (
        <div className="h-[250px] w-full flex items-center justify-center bg-stone-50/50 rounded-lg border border-dashed border-stone-250">
          <RefreshCw className="h-5 w-5 animate-spin text-stone-400" />
        </div>
      );
    }
    return chartComponent;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-light text-stone-900">B2B Buyer Analytics</h1>
        <p className="text-sm text-stone-500 mt-1">Review your corporate procurement activity and bulk order transactions.</p>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { l: "RFQs Submitted", v: data.cards.rfqsSubmitted, Icon: FileText, c: "text-amber-600 bg-amber-50 border-amber-100" },
          { l: "Quotes Received", v: data.cards.quotesReceived, Icon: Mail, c: "text-blue-600 bg-blue-50 border-blue-100" },
          { l: "Approved Quotes", v: data.cards.approvedQuotes, Icon: CheckCircle2, c: "text-emerald-600 bg-emerald-50 border-emerald-100" },
          { l: "Orders Created", v: data.cards.ordersCreated, Icon: ShoppingBag, c: "text-purple-600 bg-purple-50 border-purple-100" },
          { l: "Total Spending", v: formatCurrency(Number(data.cards.totalSpending)), Icon: Coins, c: "text-stone-600 bg-stone-100 border-stone-200" },
        ].map((w, idx) => (
          <div key={idx} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
              <span>{w.l}</span>
              <div className={`p-1.5 rounded-lg border ${w.c}`}>
                <w.Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-xl font-light text-stone-900">{w.v}</div>
          </div>
        ))}
      </div>

      {/* Charts section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Spending Trends */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-semibold text-stone-850">Spending Trends</h2>
            <span className="text-[10px] uppercase font-bold text-stone-400">Total Purchase Value</span>
          </div>
          {renderChart(
            <div className="h-[250px] w-full">
              {data.charts.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-stone-450">No spend logs recorded.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts}>
                    <defs>
                      <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f3f3" />
                    <XAxis dataKey="month" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Spending"]} />
                    <Area type="monotone" dataKey="spending" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </section>

        {/* RFQ Activity Trends */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-semibold text-stone-850">Inquiry Activity</h2>
            <span className="text-[10px] uppercase font-bold text-stone-400">Total RFQs Submitted</span>
          </div>
          {renderChart(
            <div className="h-[250px] w-full">
              {data.charts.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-stone-450">No RFQ records found.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f3f3" />
                    <XAxis dataKey="month" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="rfqs" name="RFQs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
