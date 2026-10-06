"use client";

import { useState, useEffect } from "react";
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import { 
  TrendingUp, ShoppingBag, Box, Clock, Star, FileText, 
  ArrowUpRight, AlertCircle, RefreshCw
} from "lucide-react";
import { getSellerAnalytics } from "@/actions/analytics";
import { toast } from "sonner";

type ClientProps = {
  initialData: Awaited<ReturnType<typeof getSellerAnalytics>>;
  initialFilter: string;
};

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6b7280"];

export default function SellerAnalyticsClient({ initialData, initialFilter }: ClientProps) {
  const [filter, setFilter] = useState(initialFilter);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [customDates, setCustomDates] = useState({ start: "", end: "" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const handleFilterChange = async (newFilter: string) => {
    setFilter(newFilter);
    if (newFilter !== "custom") {
      setLoading(true);
      try {
        const res = await getSellerAnalytics(newFilter);
        setData(res);
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch analytics data.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDates.start || !customDates.end) {
      toast.error("Please select both start and end dates.");
      return;
    }
    setLoading(true);
    try {
      const res = await getSellerAnalytics("custom", customDates.start, customDates.end);
      setData(res);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch custom date analytics.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Safe client mounting check for Recharts responsive containers
  const renderChart = (chartComponent: React.ReactNode) => {
    if (!mounted) {
      return (
        <div className="h-[300px] w-full flex items-center justify-center bg-stone-50/50 rounded-lg border border-dashed border-stone-250">
          <RefreshCw className="h-5 w-5 animate-spin text-stone-400" />
        </div>
      );
    }
    return chartComponent;
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-light text-stone-900">Seller Analytics</h1>
          <p className="text-sm text-stone-500 mt-1">Detailed review of your sales, products, and customer behavior.</p>
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-stone-200 bg-white p-1 text-xs font-medium shadow-sm">
            {[
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "7days", label: "7 Days" },
              { id: "30days", label: "30 Days" },
              { id: "thisMonth", label: "This Month" },
              { id: "thisYear", label: "This Year" },
              { id: "custom", label: "Custom" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => handleFilterChange(f.id)}
                className={`rounded-md px-3 py-1.5 transition ${
                  filter === f.id
                    ? "bg-stone-900 text-white"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filter === "custom" && (
            <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg p-1.5 shadow-sm text-xs">
              <input
                type="date"
                value={customDates.start}
                onChange={(e) => setCustomDates({ ...customDates, start: e.target.value })}
                className="bg-transparent border-none outline-none text-stone-700"
              />
              <span className="text-stone-400">to</span>
              <input
                type="date"
                value={customDates.end}
                onChange={(e) => setCustomDates({ ...customDates, end: e.target.value })}
                className="bg-transparent border-none outline-none text-stone-700"
              />
              <button type="submit" className="bg-stone-900 text-white rounded px-2.5 py-1 hover:bg-stone-850">
                Go
              </button>
            </form>
          )}

          {loading && <RefreshCw className="h-4 w-4 animate-spin text-stone-500" />}
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { l: "Revenue", v: formatCurrency(Number(data.cards.revenue)), Icon: TrendingUp, c: "text-emerald-600 bg-emerald-50 border-emerald-100" },
          { l: "Total Orders", v: data.cards.orders, Icon: ShoppingBag, c: "text-blue-600 bg-blue-50 border-blue-100" },
          { l: "Products Sold", v: data.cards.productsSold, Icon: Box, c: "text-purple-600 bg-purple-50 border-purple-100" },
          { l: "Pending Orders", v: data.cards.pendingOrders, Icon: Clock, c: "text-amber-600 bg-amber-50 border-amber-100" },
          { l: "Average Rating", v: data.cards.averageRating.toFixed(1) + " ★", Icon: Star, c: "text-yellow-600 bg-yellow-50 border-yellow-100" },
          { l: "RFQs Received", v: data.cards.rfqsReceived, Icon: FileText, c: "text-stone-600 bg-stone-100 border-stone-200" },
        ].map((w, idx) => (
          <div key={idx} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
              <span>{w.l}</span>
              <div className={`p-1.5 rounded-lg border ${w.c}`}>
                <w.Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-light text-stone-900">{w.v}</div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales Trend (Line/Bar) */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-semibold text-stone-850">Sales Performance</h2>
            <span className="text-[10px] uppercase font-bold text-stone-400">Revenue & Orders</span>
          </div>
          {renderChart(
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.charts.salesTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f3f3" />
                  <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value, name) => [name === "sales" ? formatCurrency(Number(value)) : value, name === "sales" ? "Revenue" : "Orders"]} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="sales" name="sales" stroke="#10b981" strokeWidth={2.5} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="orders" name="orders" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Order Status Distribution */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-md font-semibold text-stone-850">Order Statuses</h2>
            <p className="text-xs text-stone-450 mt-0.5">Proportional distribution of order counts</p>
          </div>
          {renderChart(
            <div className="h-[230px] w-full relative flex items-center justify-center">
              {data.charts.statusDistribution.length === 0 ? (
                <div className="text-xs text-stone-400 font-medium">No order status records found</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.charts.statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {data.charts.statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-[10px] font-semibold text-stone-600">
            {data.charts.statusDistribution.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span>{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Tables Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Selling Products */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-semibold text-stone-850">Top Selling Products</h2>
            <ArrowUpRight className="h-4 w-4 text-stone-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-150 text-stone-400 font-bold uppercase tracking-wider">
                  <th className="py-2.5">Product</th>
                  <th className="py-2.5 text-right">Units Sold</th>
                  <th className="py-2.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {data.tables.topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-stone-400">No items sold within this period.</td>
                  </tr>
                ) : (
                  data.tables.topProducts.map((p, idx) => (
                    <tr key={idx}>
                      <td className="py-3 font-semibold text-stone-900">{p.name}</td>
                      <td className="py-3 text-right">{p.qty}</td>
                      <td className="py-3 text-right font-bold text-stone-900">{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Most Viewed Products */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-semibold text-stone-850">Product Analytics & Conversion</h2>
            <span className="text-[10px] uppercase font-bold text-stone-400">Lifetime Tracking</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-150 text-stone-400 font-bold uppercase tracking-wider">
                  <th className="py-2.5">Product</th>
                  <th className="py-2.5 text-right">Views</th>
                  <th className="py-2.5 text-right">Wishlist</th>
                  <th className="py-2.5 text-right">Purchases</th>
                  <th className="py-2.5 text-right">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {data.tables.mostViewed.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-stone-400">No product analytics recorded.</td>
                  </tr>
                ) : (
                  data.tables.mostViewed.map((p, idx) => (
                    <tr key={idx}>
                      <td className="py-3 font-semibold text-stone-900">{p.name}</td>
                      <td className="py-3 text-right">{p.views}</td>
                      <td className="py-3 text-right">{p.wishlist}</td>
                      <td className="py-3 text-right">{p.purchases}</td>
                      <td className="py-3 text-right font-bold text-emerald-600">{p.conversion}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Low Stock Alerts */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-semibold text-stone-850">Low Stock Indicators</h2>
            <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-150 text-stone-400 font-bold uppercase tracking-wider">
                  <th className="py-2.5">Product</th>
                  <th className="py-2.5 text-center">SKU</th>
                  <th className="py-2.5 text-center">Variant</th>
                  <th className="py-2.5 text-right">Current Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {data.tables.lowStock.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-stone-400">All products are healthy and in-stock!</td>
                  </tr>
                ) : (
                  data.tables.lowStock.map((v, idx) => (
                    <tr key={idx}>
                      <td className="py-3 font-semibold text-stone-900">{v.name}</td>
                      <td className="py-3 text-center text-stone-500 font-mono">{v.sku}</td>
                      <td className="py-3 text-center text-stone-500">{v.color} / {v.size}</td>
                      <td className="py-3 text-right">
                        <span className={`px-2 py-0.5 rounded font-bold ${v.stock === 0 ? "bg-red-150 text-red-700" : "bg-amber-150 text-amber-700"}`}>
                          {v.stock} left
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Top Customers */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-semibold text-stone-850">Top Buying Customers</h2>
            <span className="text-[10px] uppercase font-bold text-stone-400">By Selected Range</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-150 text-stone-400 font-bold uppercase tracking-wider">
                  <th className="py-2.5">Customer Name</th>
                  <th className="py-2.5">Email</th>
                  <th className="py-2.5 text-right">Total Spending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {data.tables.topCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-stone-400">No customer records in this date range.</td>
                  </tr>
                ) : (
                  data.tables.topCustomers.map((c, idx) => (
                    <tr key={idx}>
                      <td className="py-3 font-semibold text-stone-900">{c.name}</td>
                      <td className="py-3 text-stone-500 font-mono">{c.email}</td>
                      <td className="py-3 text-right font-bold text-stone-900">{formatCurrency(Number(c.spending))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
