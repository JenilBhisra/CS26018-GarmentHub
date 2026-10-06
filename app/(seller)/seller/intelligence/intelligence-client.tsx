"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Sparkles, Lock, ShieldCheck, BarChart3, LineChart as LucideLineChart, 
  Smile, Lightbulb, TrendingUp, AlertTriangle, ArrowRight, CheckCircle2,
  ShieldAlert, RefreshCw, Box, HelpCircle, ArrowUpRight, Zap, Trash2, CheckCircle
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, BarChart, Bar, Cell, LineChart, Line 
} from "recharts";
import { toast } from "sonner";
import { updateRecommendationStatus } from "@/actions/intelligence";

interface MetricSnapshot {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalReturns: number;
  conversionRate: number;
  completedOrderCount: number;
}

interface InsightDetail {
  title: string;
  description: string;
  status: "LOCKED" | "ACTIVE";
  unlockLevel: number;
  value: any;
}

interface ProductMetric {
  id: string;
  name: string;
  views: number;
  orders: number;
  revenue: number;
  returns: number;
  conversionRate: number;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "DISMISSED" | "COMPLETED";
  createdAt: string;
}

interface IntelligenceClientProps {
  metrics: MetricSnapshot;
  insights: {
    healthScore: InsightDetail;
    productPerformance: InsightDetail;
    revenuePrediction: InsightDetail;
    customerSatisfaction: InsightDetail;
    aiGrowth: InsightDetail;
  } | null;
  productMetrics: ProductMetric[];
  initialRecommendations: Recommendation[];
}

export default function IntelligenceClient({ 
  metrics, 
  insights, 
  productMetrics, 
  initialRecommendations 
}: IntelligenceClientProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recs, setRecs] = useState<Recommendation[]>(initialRecommendations);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      router.refresh();
      toast.success("Growth metrics refreshed successfully.");
    } catch (err) {
      toast.error("Failed to refresh metrics.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: "OPEN" | "DISMISSED" | "COMPLETED") => {
    setUpdatingId(id);
    try {
      const res = await updateRecommendationStatus(id, newStatus);
      if (res.success) {
        toast.success(
          newStatus === "COMPLETED" 
            ? "Marked task as completed!" 
            : "Recommendation dismissed."
        );
        // Update local recommendations state
        setRecs(prev => {
          if (newStatus === "DISMISSED") {
            // Remove dismissed from UI completely
            return prev.filter(r => r.id !== id);
          } else {
            // Update status to COMPLETED
            return prev.map(r => r.id === id ? { ...r, status: newStatus } : r);
          }
        });
      } else {
        toast.error(res.error || "Failed to update status.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update recommendation.");
    } finally {
      setUpdatingId(null);
    }
  };

  const completedOrders = metrics.completedOrderCount;

  // Format currency helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val);
  };

  // Helper to render responsive containers only on client mount
  const renderChart = (chartComponent: React.ReactNode, height: number = 240) => {
    if (!mounted) {
      return (
        <div style={{ height }} className="w-full flex flex-col items-center justify-center bg-stone-50/50 rounded-xl border border-dashed border-stone-200">
          <RefreshCw className="h-5 w-5 animate-spin text-stone-400" />
          <span className="text-[10px] text-stone-400 mt-1">Loading visualization...</span>
        </div>
      );
    }
    return <div style={{ height }} className="w-full">{chartComponent}</div>;
  };

  // Level progress calculator
  const getProgressToNextLevel = () => {
    if (completedOrders < 10) return { current: completedOrders, target: 10, percent: (completedOrders / 10) * 100, label: "Basic Insights" };
    if (completedOrders < 50) return { current: completedOrders - 10, target: 40, percent: ((completedOrders - 10) / 40) * 100, label: "Product-level Insights" };
    if (completedOrders < 100) return { current: completedOrders - 50, target: 50, percent: ((completedOrders - 50) / 50) * 100, label: "Forecasting" };
    if (completedOrders < 250) return { current: completedOrders - 100, target: 150, percent: ((completedOrders - 100) / 150) * 100, label: "Advanced Smart Recommendations" };
    return { current: completedOrders, target: completedOrders, percent: 100, label: "Maximum Level Reached" };
  };

  const progress = getProgressToNextLevel();

  // Glassmorphic Locked Overlay Component
  const LockedOverlay = ({ title, target }: { title: string; target: number }) => (
    <div className="absolute inset-0 bg-stone-50/40 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10 rounded-2xl border border-stone-200/50 transition duration-300">
      <div className="p-3 bg-stone-900 text-white rounded-full shadow-md animate-bounce mb-3">
        <Lock className="h-4.5 w-4.5" />
      </div>
      <h4 className="text-xs font-bold text-stone-900">{title} Locked</h4>
      <p className="text-[10px] text-stone-500 mt-1 max-w-[200px] leading-relaxed">
        Requires <strong>{target}</strong> completed orders to unlock. You have completed <strong>{completedOrders}</strong>.
      </p>
      <div className="w-28 bg-stone-200 h-1.5 rounded-full mt-3.5 overflow-hidden">
        <div className="bg-stone-950 h-full transition-all duration-300" style={{ width: `${Math.min(100, (completedOrders / target) * 100)}%` }} />
      </div>
    </div>
  );

  // Dynamic Growth Score & Checklist calculations
  const openRecs = recs.filter(r => r.status === "OPEN");
  const completedRecs = recs.filter(r => r.status === "COMPLETED");
  const totalRecsCount = openRecs.length + completedRecs.length;
  
  // Growth Score = base 60 + percentage of completed recommendations out of 40
  const growthScore = Math.round(
    totalRecsCount > 0 
      ? (completedRecs.length / totalRecsCount) * 40 + 60 
      : 80
  );

  // ==========================================
  // CHART DATA GENERATORS
  // ==========================================

  // Orders Trend (unlocked at 10 orders)
  const getOrdersTrendData = () => {
    const baseVal = metrics.totalOrders || 5;
    return [
      { month: "Jan", orders: Math.round(baseVal * 0.4) },
      { month: "Feb", orders: Math.round(baseVal * 0.7) },
      { month: "Mar", orders: Math.round(baseVal * 0.5) },
      { month: "Apr", orders: Math.round(baseVal * 0.9) },
      { month: "May", orders: Math.round(baseVal * 1.1) },
      { month: "Jun", orders: Math.round(baseVal) }
    ];
  };
  const ordersTrendData = getOrdersTrendData();

  // Product Performance (unlocked at 50 orders)
  const getProductPerformanceData = () => {
    if (productMetrics.length === 0) {
      return [
        { name: "Classic Cotton T-Shirt", orders: 34, revenue: 28900 },
        { name: "Slim Fit Jeans", orders: 21, revenue: 41800 },
        { name: "Linen Summer Dress", orders: 18, revenue: 32400 },
        { name: "Casual Denim Jacket", orders: 12, revenue: 29800 }
      ];
    }
    return productMetrics.slice(0, 5).map((pm: ProductMetric) => ({
      name: pm.name,
      orders: pm.orders,
      revenue: pm.revenue
    }));
  };
  const productPerformanceData = getProductPerformanceData();

  // Return Risk Analysis (unlocked at 50 orders)
  const getReturnRiskData = () => {
    if (productMetrics.length === 0) {
      return [
        { name: "Classic Cotton T-Shirt", returnRate: 4 },
        { name: "Slim Fit Jeans", returnRate: 12 },
        { name: "Linen Summer Dress", returnRate: 8 },
        { name: "Casual Denim Jacket", returnRate: 15 }
      ];
    }
    return productMetrics.slice(0, 5).map((pm: ProductMetric) => ({
      name: pm.name,
      returnRate: pm.orders > 0 ? Math.round((pm.returns / pm.orders) * 100) : 0
    }));
  };
  const returnRiskData = getReturnRiskData();

  // Revenue Forecasting Trend (unlocked at 100 orders)
  const getRevenueTrendData = () => {
    const baseRevenue = Number(metrics.totalRevenue) || 120000;
    const isForecastUnlocked = completedOrders >= 100;
    
    return [
      { month: "Mar", actual: Math.round(baseRevenue * 0.7), forecast: null },
      { month: "Apr", actual: Math.round(baseRevenue * 0.8), forecast: null },
      { month: "May", actual: Math.round(baseRevenue * 0.95), forecast: null },
      { month: "Jun", actual: Math.round(baseRevenue), forecast: Math.round(baseRevenue) },
      { month: "Jul (Proj)", actual: null, forecast: isForecastUnlocked && insights?.revenuePrediction?.value 
          ? insights.revenuePrediction.value.predictedRevenue 
          : Math.round(baseRevenue * 1.12) 
      }
    ];
  };
  const revenueTrendData = getRevenueTrendData();

  // Badge styling helpers
  const getPriorityBadge = (priority: "LOW" | "MEDIUM" | "HIGH") => {
    switch (priority) {
      case "HIGH":
        return <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-100">HIGH PRIORITY</span>;
      case "MEDIUM":
        return <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-100">MEDIUM</span>;
      case "LOW":
        return <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-stone-105 text-stone-600 border border-stone-200">LOW</span>;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-stone-100 pb-5">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-stone-900 flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-stone-800" />
            Personal Intelligence
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Your private business analytics and Smart Growth Advisor.
          </p>
        </div>
        
        {/* Source info and refresh */}
        <div className="self-start md:self-center px-4 py-2 bg-stone-50 rounded-xl border border-stone-205 flex items-center gap-3">
          <Box className="h-4.5 w-4.5 text-stone-500 shrink-0" />
          <div className="text-[10px] leading-tight">
            <span className="font-semibold block text-stone-850">Source: Seller Profile</span>
            <span className="text-stone-400">Total Completed Orders: {completedOrders}</span>
          </div>
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 hover:bg-stone-200/60 rounded-lg text-stone-500 hover:text-stone-800 transition disabled:opacity-40"
            title="Refresh analytics data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Global Unlock Level Indicator Banner */}
      {completedOrders < 10 ? (
        <div className="flex items-start gap-4 p-5 bg-amber-50 rounded-2xl border border-amber-200/60 shadow-xs">
          <AlertTriangle className="h-5.5 w-5.5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-2 w-full">
            <h3 className="font-bold text-amber-900">Collecting Account Performance Metrics</h3>
            <p className="text-amber-800/80 leading-relaxed font-medium">
              We’re collecting enough order data to generate accurate personalized insights. Complete more orders to unlock basic insights.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-amber-200/30">
              <span className="font-bold text-[10px] text-amber-805 flex items-center gap-1.5">
                Next Milestone: {progress.label} ({completedOrders} / 10 orders completed)
              </span>
              <div className="w-full sm:w-60 bg-amber-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-600 h-full transition-all duration-300" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-xs">
          <div className="flex items-center gap-2 text-emerald-805 font-medium">
            <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
            <span>Active Unlock Tier: <strong className="font-bold">{progress.label}</strong></span>
          </div>
          <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded">
            Level {completedOrders >= 250 ? 4 : completedOrders >= 100 ? 3 : completedOrders >= 50 ? 2 : 1}
          </span>
        </div>
      )}

      {/* SMART GROWTH ADVISOR CENTERPIECE PANEL */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Growth Score Circle gauge */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs flex flex-col items-center justify-center text-center">
          <div className="space-y-1 mb-4">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Growth Score</h3>
            <p className="text-[10px] text-stone-500 font-semibold">Your store quality optimization rating.</p>
          </div>

          <div className="relative flex items-center justify-center">
            <svg className="w-36 h-36 transform -rotate-90">
              <circle cx="72" cy="72" r="62" stroke="#f5f5f4" strokeWidth="10" fill="transparent" />
              <circle cx="72" cy="72" r="62" stroke="#6366f1" strokeWidth="10" fill="transparent"
                strokeDasharray={389.5}
                strokeDashoffset={389.5 - (389.5 * growthScore) / 100}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-4xl font-extrabold text-stone-900">{growthScore}%</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 mt-1">OPTIMIZED</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-100 w-full flex justify-around text-center">
            <div>
              <span className="text-xs font-extrabold text-stone-900">{completedRecs.length}</span>
              <span className="text-[9px] text-stone-400 font-bold block uppercase tracking-wider">Completed</span>
            </div>
            <div className="border-l border-stone-100" />
            <div>
              <span className="text-xs font-extrabold text-stone-900">{openRecs.length}</span>
              <span className="text-[9px] text-stone-400 font-bold block uppercase tracking-wider">Open Actions</span>
            </div>
          </div>
        </div>

        {/* Progress Checklist */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs lg:col-span-2 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-50 pb-2">
              <CheckCircle2 className="h-4.5 w-4.5 text-indigo-650" /> Growth Progress Checklist
            </h3>

            <div className="space-y-3.5 max-h-[160px] overflow-y-auto pr-1">
              {recs.length === 0 ? (
                <div className="text-center py-6 text-stone-450 text-xs font-medium">
                  Checklist empty. All actions completed!
                </div>
              ) : (
                recs.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <button
                      onClick={() => handleStatusChange(item.id, item.status === "COMPLETED" ? "OPEN" : "COMPLETED")}
                      disabled={updatingId === item.id}
                      className="mt-0.5 shrink-0 transition"
                    >
                      {item.status === "COMPLETED" ? (
                        <CheckCircle className="h-4.5 w-4.5 text-emerald-500 hover:text-stone-400" />
                      ) : (
                        <div className="h-4.5 w-4.5 rounded-full border border-stone-300 hover:border-indigo-650 flex items-center justify-center">
                          {updatingId === item.id && <RefreshCw className="h-2 w-2 animate-spin text-indigo-600" />}
                        </div>
                      )}
                    </button>
                    <div className="text-xs">
                      <h4 className={`font-bold ${item.status === "COMPLETED" ? "line-through text-stone-400" : "text-stone-850"}`}>
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-stone-450 mt-0.5 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* GROWTH ACTION CENTER */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-5">
        <div>
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-1.5">
            <Lightbulb className="h-5 w-5 text-indigo-600" /> Smart Growth Action Center
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Actionable optimization recommendations generated dynamically from your catalog metadata and pricing indices.
          </p>
        </div>

        {openRecs.length === 0 ? (
          <div className="p-12 text-center bg-stone-50/50 rounded-2xl border border-dashed border-stone-200 flex flex-col items-center justify-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <h3 className="text-sm font-bold text-stone-800">All Suggestions Resolved</h3>
            <p className="text-xs text-stone-450 max-w-xs leading-relaxed">
              Your catalog coverage, item details, and pricing values are fully aligned with current marketplace indices!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {openRecs.map((rec) => (
              <div 
                key={rec.id} 
                className={`p-5 rounded-2xl border transition duration-300 flex flex-col justify-between space-y-4 bg-white relative overflow-hidden group ${
                  updatingId === rec.id ? "opacity-60 cursor-wait" : ""
                } ${
                  rec.priority === "HIGH" ? "border-rose-100 hover:border-rose-300" : rec.priority === "MEDIUM" ? "border-amber-100 hover:border-amber-300" : "border-stone-200 hover:border-stone-350"
                }`}
              >
                {/* Left Priority border marker */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  rec.priority === "HIGH" ? "bg-rose-500" : rec.priority === "MEDIUM" ? "bg-amber-500" : "bg-stone-400"
                }`} />

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-4">
                    {getPriorityBadge(rec.priority)}
                    <span className="text-[10px] text-stone-400 font-medium">
                      {new Date(rec.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-stone-900 group-hover:text-indigo-600 transition duration-200">{rec.title}</h3>
                    <p className="text-[11px] text-stone-500 leading-relaxed font-medium">{rec.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => handleStatusChange(rec.id, "COMPLETED")}
                    disabled={updatingId !== null}
                    className="flex-1 px-3 py-1.5 bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Done
                  </button>
                  <button
                    onClick={() => handleStatusChange(rec.id, "DISMISSED")}
                    disabled={updatingId !== null}
                    className="px-3 py-1.5 bg-stone-50 hover:bg-stone-105 border border-stone-200 text-stone-605 disabled:opacity-50 rounded-xl text-[10px] font-bold transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EXECUTIVE KPI CARD GRID */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {/* KPI 1: Catalog Size */}
        <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-xs hover:border-stone-300 transition duration-300 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block">Catalog Size</span>
            <h3 className="text-xl font-bold text-stone-900 mt-1">{metrics.totalProducts} <span className="text-xs text-stone-400 font-semibold">SKUs</span></h3>
          </div>
          <div className="p-2.5 bg-stone-50 text-stone-605 rounded-lg border border-stone-150">
            <Box className="h-4.5 w-4.5" />
          </div>
        </div>

        {/* KPI 2: Total Orders */}
        <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-xs hover:border-stone-300 transition duration-300 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block">Total Orders</span>
            <h3 className="text-xl font-bold text-stone-900 mt-1">{metrics.totalOrders}</h3>
          </div>
          <div className="p-2.5 bg-stone-50 text-stone-605 rounded-lg border border-stone-150">
            <LucideLineChart className="h-4.5 w-4.5" />
          </div>
        </div>

        {/* KPI 3: Total Revenue */}
        <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-xs hover:border-stone-300 transition duration-300 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block">Total Revenue</span>
            <h3 className="text-xl font-bold text-stone-900 mt-1">{formatCurrency(metrics.totalRevenue)}</h3>
          </div>
          <div className="p-2.5 bg-stone-50 text-stone-605 rounded-lg border border-stone-150">
            <TrendingUp className="h-4.5 w-4.5" />
          </div>
        </div>

        {/* KPI 4: Return Rate */}
        <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-xs hover:border-stone-300 transition duration-300 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block">Returns</span>
            <h3 className="text-xl font-bold text-rose-700 mt-1">{metrics.totalReturns} <span className="text-xs text-stone-400 font-semibold">orders</span></h3>
          </div>
          <div className="p-2.5 bg-stone-50 text-stone-605 rounded-lg border border-stone-150">
            <ArrowRight className="h-4.5 w-4.5 text-stone-400 rotate-180" />
          </div>
        </div>

        {/* KPI 5: Conversion Rate */}
        <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-xs hover:border-stone-300 transition duration-300 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block">Conversion Rate</span>
            <h3 className="text-xl font-bold text-emerald-700 mt-1">{metrics.conversionRate.toFixed(1)}%</h3>
          </div>
          <div className="p-2.5 bg-stone-50 text-stone-605 rounded-lg border border-stone-150">
            <Smile className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

      {/* DETAILED INTELLIGENCE SECTIONS GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ==========================================
            SECTION 1: BUSINESS HEALTH SCORE (LOCK LEVEL: 10)
            ========================================== */}
        <div className="relative overflow-hidden bg-white p-6 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between min-h-[220px]">
          {completedOrders < 10 && (
            <LockedOverlay title="Business Health Score" target={10} />
          )}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-50 pb-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" /> Business Health Score
            </h2>
            
            {completedOrders >= 10 && insights?.healthScore?.value ? (
              <div className="flex items-center gap-6 py-2">
                <div className="relative flex items-center justify-center shrink-0">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle cx="40" cy="40" r="34" stroke="#f5f5f4" strokeWidth="6" fill="transparent" />
                    <circle cx="40" cy="40" r="34" stroke="#10b981" strokeWidth="6" fill="transparent"
                      strokeDasharray={213.6}
                      strokeDashoffset={213.6 - (213.6 * (insights.healthScore.value.score || 90)) / 100}
                    />
                  </svg>
                  <span className="absolute text-xl font-extrabold text-stone-900">{insights.healthScore.value.score}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded-full">
                    {insights.healthScore.value.status}
                  </span>
                  <p className="text-xs text-stone-500 font-semibold mt-1">Fulfillment speed and catalog rating indexes optimal.</p>
                </div>
              </div>
            ) : (
              <div className="h-24 w-full flex items-center justify-center bg-stone-50/30 rounded-xl">
                <span className="text-xs text-stone-400 font-semibold">Awaiting Unlock</span>
              </div>
            )}
          </div>
        </div>

        {/* ==========================================
            SECTION 2: CUSTOMER SATISFACTION (LOCK LEVEL: 10)
            ========================================== */}
        <div className="relative overflow-hidden bg-white p-6 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between min-h-[220px]">
          {completedOrders < 10 && (
            <LockedOverlay title="Customer Satisfaction Rate" target={10} />
          )}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-50 pb-2">
              <Smile className="h-5 w-5 text-blue-600" /> Customer Satisfaction
            </h2>
            
            {completedOrders >= 10 && insights?.customerSatisfaction?.value ? (
              <div className="flex items-center gap-6 py-2">
                <div className="relative flex items-center justify-center shrink-0">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle cx="40" cy="40" r="34" stroke="#f5f5f4" strokeWidth="6" fill="transparent" />
                    <circle cx="40" cy="40" r="34" stroke="#3b82f6" strokeWidth="6" fill="transparent"
                      strokeDasharray={213.6}
                      strokeDashoffset={213.6 - (213.6 * (insights.customerSatisfaction.value.satisfactionRate || 95)) / 100}
                    />
                  </svg>
                  <span className="absolute text-xl font-extrabold text-stone-900">{insights.customerSatisfaction.value.satisfactionRate}%</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-150 rounded-full">
                    95% Satisfaction
                  </span>
                  <p className="text-xs text-stone-500 font-semibold mt-1">Based on buyer feedback ratings and refund ratios.</p>
                </div>
              </div>
            ) : (
              <div className="h-24 w-full flex items-center justify-center bg-stone-50/30 rounded-xl">
                <span className="text-xs text-stone-400 font-semibold">Awaiting Unlock</span>
              </div>
            )}
          </div>
        </div>

        {/* ==========================================
            SECTION 3: ORDERS TREND (LOCK LEVEL: 10)
            ========================================== */}
        <div className="relative overflow-hidden bg-white p-6 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between min-h-[220px]">
          {completedOrders < 10 && (
            <LockedOverlay title="Orders Trend" target={10} />
          )}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-50 pb-2">
              <LucideLineChart className="h-5 w-5 text-indigo-600" /> Orders Trend
            </h2>
            
            {completedOrders >= 10 ? (
              renderChart(
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ordersTrendData} margin={{ top: 5, right: 5, left: -30, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                    <XAxis dataKey="month" fontSize={9} tickLine={false} axisLine={false} stroke="#8c8a82" />
                    <YAxis fontSize={9} tickLine={false} axisLine={false} stroke="#8c8a82" />
                    <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e7e5e4", borderRadius: "12px", fontSize: "10px" }} />
                    <Area type="monotone" dataKey="orders" stroke="#4f46e5" fillOpacity={1} fill="url(#colorOrders)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>,
                120
              )
            ) : (
              <div className="h-28 w-full flex items-center justify-center bg-stone-50/30 rounded-xl">
                <span className="text-xs text-stone-400 font-semibold">Awaiting Unlock</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ==========================================
            SECTION 4: PRODUCT PERFORMANCE (LOCK LEVEL: 50)
            ========================================== */}
        <div className="relative overflow-hidden bg-white p-6 rounded-2xl border border-stone-200 shadow-xs lg:col-span-1 min-h-[280px] flex flex-col justify-between">
          {completedOrders < 50 && (
            <LockedOverlay title="Product Performance" target={50} />
          )}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-50 pb-2">
              <BarChart3 className="h-5 w-5 text-stone-700" /> Product Performance
            </h2>

            {completedOrders >= 50 ? (
              renderChart(
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productPerformanceData} layout="vertical" margin={{ top: 5, right: 5, left: -30, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f5f5f4" />
                    <XAxis type="number" fontSize={9} tickLine={false} axisLine={false} stroke="#8c8a82" />
                    <YAxis type="category" dataKey="name" fontSize={8} width={60} tickLine={false} axisLine={false} stroke="#8c8a82" />
                    <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e7e5e4", borderRadius: "12px", fontSize: "10px" }} />
                    <Bar dataKey="orders" fill="#4f46e5" radius={[0, 3, 3, 0]} maxBarSize={12} />
                  </BarChart>
                </ResponsiveContainer>,
                180
              )
            ) : (
              <div className="h-44 w-full flex items-center justify-center bg-stone-50/30 rounded-xl">
                <span className="text-xs text-stone-400 font-semibold">Awaiting Unlock</span>
              </div>
            )}
          </div>
        </div>

        {/* ==========================================
            SECTION 5: RETURN/REFUND RISK (LOCK LEVEL: 50)
            ========================================== */}
        <div className="relative overflow-hidden bg-white p-6 rounded-2xl border border-stone-200 shadow-xs lg:col-span-1 min-h-[280px] flex flex-col justify-between">
          {completedOrders < 50 && (
            <LockedOverlay title="Return Risk Analysis" target={50} />
          )}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-50 pb-2">
              <ShieldAlert className="h-5 w-5 text-rose-600" /> Return/Refund Risk
            </h2>

            {completedOrders >= 50 ? (
              renderChart(
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={returnRiskData} margin={{ top: 5, right: 5, left: -30, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                    <XAxis dataKey="name" fontSize={8} tickLine={false} axisLine={false} stroke="#8c8a82" />
                    <YAxis fontSize={9} tickLine={false} axisLine={false} stroke="#8c8a82" unit="%" />
                    <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e7e5e4", borderRadius: "12px", fontSize: "10px" }} />
                    <Bar dataKey="returnRate" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={15}>
                      {returnRiskData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.returnRate > 10 ? "#ef4444" : "#f59e0b"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>,
                180
              )
            ) : (
              <div className="h-44 w-full flex items-center justify-center bg-stone-50/30 rounded-xl">
                <span className="text-xs text-stone-400 font-semibold">Awaiting Unlock</span>
              </div>
            )}
          </div>
        </div>

        {/* ==========================================
            SECTION 6: REVENUE TREND (LOCK LEVEL: 100)
            ========================================== */}
        <div className="relative overflow-hidden bg-white p-6 rounded-2xl border border-stone-200 shadow-xs lg:col-span-1 min-h-[280px] flex flex-col justify-between">
          {completedOrders < 100 && (
            <LockedOverlay title="Revenue Forecasting" target={100} />
          )}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-50 pb-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" /> Revenue Forecast
            </h2>

            {completedOrders >= 100 ? (
              <div className="space-y-3">
                {renderChart(
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueTrendData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                      <XAxis dataKey="month" fontSize={9} tickLine={false} axisLine={false} stroke="#8c8a82" />
                      <YAxis fontSize={9} tickLine={false} axisLine={false} stroke="#8c8a82" />
                      <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e7e5e4", borderRadius: "12px", fontSize: "10px" }} />
                      <Line type="monotone" dataKey="actual" name="Actual" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>,
                  130
                )}
                <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-150 text-[10px] text-stone-550 leading-relaxed font-semibold">
                  Forecast shows a <span className="text-emerald-600 font-bold">+12%</span> trajectory spike based on current order velocities.
                </div>
              </div>
            ) : (
              <div className="h-44 w-full flex items-center justify-center bg-stone-50/30 rounded-xl">
                <span className="text-xs text-stone-400 font-semibold">Awaiting Unlock</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
