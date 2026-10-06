"use client";

import { useState, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from "recharts";
import { 
  TrendingUp, ShoppingBag, Users, Users2, Box, FileText, Tag, Star,
  RefreshCw
} from "lucide-react";
import { getAdminAnalytics } from "@/actions/analytics";
import { toast } from "sonner";

type ClientProps = {
  initialData: Awaited<ReturnType<typeof getAdminAnalytics>>;
  initialFilter: string;
};

export default function AdminAnalyticsClient({ initialData, initialFilter }: ClientProps) {
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
        const res = await getAdminAnalytics(newFilter);
        setData(res);
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch admin analytics data.");
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
      const res = await getAdminAnalytics("custom", customDates.start, customDates.end);
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
          <h1 className="font-display text-3xl font-light text-stone-900">Operations Analytics</h1>
          <p className="text-sm text-stone-500 mt-1">Cross-marketplace statistics on sales, users, uploads and RFQs.</p>
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9">
        {[
          { l: "Revenue", v: formatCurrency(Number(data.cards.revenue)), Icon: TrendingUp, c: "text-emerald-600 bg-emerald-50 border-emerald-100" },
          { l: "Orders", v: data.cards.orders, Icon: ShoppingBag, c: "text-blue-600 bg-blue-50 border-blue-100" },
          { l: "Customers", v: data.cards.customers, Icon: Users, c: "text-indigo-600 bg-indigo-50 border-indigo-100" },
          { l: "Sellers", v: data.cards.sellers, Icon: Users2, c: "text-violet-600 bg-violet-50 border-violet-100" },
          { l: "B2B Buyers", v: data.cards.b2bBuyers, Icon: Users2, c: "text-teal-600 bg-teal-50 border-teal-100" },
          { l: "Products", v: data.cards.products, Icon: Box, c: "text-pink-600 bg-pink-50 border-pink-100" },
          { l: "RFQs", v: data.cards.rfqs, Icon: FileText, c: "text-amber-600 bg-amber-50 border-amber-100" },
          { l: "Coupons Used", v: data.cards.couponsUsed, Icon: Tag, c: "text-rose-600 bg-rose-50 border-rose-100" },
          { l: "Reviews", v: data.cards.reviews, Icon: Star, c: "text-yellow-600 bg-yellow-50 border-yellow-100" },
        ].map((w, idx) => (
          <div key={idx} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm hover:shadow-md transition xl:col-span-1">
            <div className="flex items-center justify-between text-[10px] text-stone-500 font-bold uppercase tracking-wider">
              <span>{w.l}</span>
              <w.Icon className="h-3.5 w-3.5 text-stone-400" />
            </div>
            <div className="mt-2.5 font-display text-xl font-light text-stone-900">{w.v}</div>
          </div>
        ))}
      </div>

      {/* Main Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales & Orders Chart */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-semibold text-stone-850">Revenue & Orders Performance</h2>
            <span className="text-[10px] uppercase font-bold text-stone-400">Total Trends</span>
          </div>
          {renderChart(
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.charts}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f3f3" />
                  <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value, name) => [name === "revenue" ? formatCurrency(Number(value)) : value, name === "revenue" ? "Revenue" : "Orders"]} />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="revenue" name="revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Line yAxisId="right" type="monotone" dataKey="orders" name="orders" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Growth (Sellers & Customers) */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-semibold text-stone-850">Marketplace Growth</h2>
            <span className="text-[10px] uppercase font-bold text-stone-400">New Onboardings</span>
          </div>
          {renderChart(
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.charts}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f3f3" />
                  <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="customers" name="Customers" stroke="#6366f1" strokeWidth={2} />
                  <Line type="monotone" dataKey="sellers" name="Sellers" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Product Uploads & RFQ Trends */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-semibold text-stone-850">Inventory Uploads & Wholesale RFQs</h2>
            <span className="text-[10px] uppercase font-bold text-stone-400">Upload vs Inquiry Activity</span>
          </div>
          {renderChart(
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f3f3" />
                  <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="products" name="New Products" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rfqs" name="New RFQs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Top Lists Display */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-md font-semibold text-stone-850">Leaderboards</h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="font-bold text-stone-400 uppercase tracking-wider border-b border-stone-150 pb-1 mb-2">Top Sellers</div>
              <ul className="space-y-2">
                {data.topLists.sellers.map((s, idx) => (
                  <li key={idx} className="flex justify-between font-medium">
                    <span className="truncate max-w-[120px] text-stone-800">{s.storeName}</span>
                    <span className="font-bold text-stone-900">{formatCurrency(Number(s.revenue))}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-bold text-stone-400 uppercase tracking-wider border-b border-stone-150 pb-1 mb-2">Top Brands</div>
              <ul className="space-y-2">
                {data.topLists.brands.map((b, idx) => (
                  <li key={idx} className="flex justify-between font-medium">
                    <span className="text-stone-800">{b.brand}</span>
                    <span className="font-bold text-stone-900">{formatCurrency(b.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* Top Product / Category / Customer tables */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Selling Products */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-md font-semibold text-stone-850">Top Selling Products</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-150 text-stone-400 font-bold uppercase tracking-wider">
                  <th className="py-2">Product</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {data.topLists.products.map((p, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 font-semibold text-stone-900 truncate max-w-[120px]">{p.name}</td>
                    <td className="py-2.5 text-right">{p.qty}</td>
                    <td className="py-2.5 text-right font-bold text-stone-900">{formatCurrency(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Top Categories */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-md font-semibold text-stone-850">Top Categories</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-150 text-stone-400 font-bold uppercase tracking-wider">
                  <th className="py-2">Category</th>
                  <th className="py-2 text-right">Items Sold</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {data.topLists.categories.map((c, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 font-semibold text-stone-900">{c.name}</td>
                    <td className="py-2.5 text-right">{c.qty}</td>
                    <td className="py-2.5 text-right font-bold text-stone-900">{formatCurrency(Number(c.revenue))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Top Customers */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-md font-semibold text-stone-850">Top Spending Customers</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-150 text-stone-400 font-bold uppercase tracking-wider">
                  <th className="py-2">Customer</th>
                  <th className="py-2 text-right">Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {data.topLists.customers.map((c, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 font-semibold text-stone-900 truncate max-w-[150px]">{c.name}</td>
                    <td className="py-2.5 text-right font-bold text-stone-900">{formatCurrency(Number(c.spending))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
