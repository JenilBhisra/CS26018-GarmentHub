"use client";

import { useState, useEffect } from "react";
import { 
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from "recharts";
import { ShoppingBag, Coins, Heart, Star, RefreshCw } from "lucide-react";
import { getCustomerAnalytics } from "@/actions/analytics";

type ClientProps = {
  initialData: Awaited<ReturnType<typeof getCustomerAnalytics>>;
};

export default function CustomerAnalyticsClient({ initialData }: ClientProps) {
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
        <h1 className="font-display text-3xl font-light text-stone-900">My Purchase Analytics</h1>
        <p className="text-sm text-stone-500 mt-1">Personal dashboard reflecting your orders, wishlist items and submitted reviews.</p>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Total Orders", v: data.cards.totalOrders, Icon: ShoppingBag, c: "text-blue-600 bg-blue-50 border-blue-100" },
          { l: "Total Spending", v: formatCurrency(Number(data.cards.totalSpending)), Icon: Coins, c: "text-emerald-600 bg-emerald-50 border-emerald-100" },
          { l: "Wishlist Items", v: data.cards.wishlistItems, Icon: Heart, c: "text-rose-600 bg-rose-50 border-rose-100" },
          { l: "Reviews Submitted", v: data.cards.reviewsSubmitted, Icon: Star, c: "text-yellow-600 bg-yellow-50 border-yellow-100" },
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

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Spending Trends */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-semibold text-stone-850">Spending Patterns</h2>
            <span className="text-[10px] uppercase font-bold text-stone-400">Total Purchase Value</span>
          </div>
          {renderChart(
            <div className="h-[250px] w-full">
              {data.charts.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-stone-450">No spending history recorded.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts}>
                    <defs>
                      <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f3f3" />
                    <XAxis dataKey="month" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Spending"]} />
                    <Area type="monotone" dataKey="spending" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </section>

        {/* Order Count Trends */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-semibold text-stone-850">Order Volume</h2>
            <span className="text-[10px] uppercase font-bold text-stone-400">Total Orders Placed</span>
          </div>
          {renderChart(
            <div className="h-[250px] w-full">
              {data.charts.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-stone-450">No order logs recorded.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f3f3" />
                    <XAxis dataKey="month" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="orders" name="Orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
