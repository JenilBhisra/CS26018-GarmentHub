"use client";

import React from "react";

interface ChartData {
  label: string;
  value: number;
}

interface DashboardChartsProps {
  revenueTrend: ChartData[];
  refundReasons: ChartData[];
  categorySales: ChartData[];
}

export default function DashboardCharts({ revenueTrend, refundReasons, categorySales }: DashboardChartsProps) {
  // 1. Line Chart coordinates calculator for Revenue Trend
  const maxRevenue = Math.max(...revenueTrend.map(d => d.value), 100);
  const width = 500;
  const height = 150;
  const padding = 20;

  const points = revenueTrend.map((d, index) => {
    const x = padding + (index * (width - padding * 2)) / (revenueTrend.length - 1);
    const y = height - padding - (d.value * (height - padding * 2)) / maxRevenue;
    return `${x},${y}`;
  }).join(" ");

  // 2. Ring Chart (Donut) parameters for Refund Reasons
  const totalRefunds = refundReasons.reduce((acc, curr) => acc + curr.value, 0) || 1;
  let cumulativeAngle = 0;
  const colors = ["#ef4444", "#3b82f6", "#a855f7", "#eab308"];

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {/* Revenue Trend Line Chart */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">Revenue Trend (Last 7 Days)</h4>
          <p className="text-[10px] text-stone-400 mt-0.5">Live billed transaction flow</p>
        </div>
        <div className="my-4">
          <svg className="w-full h-[150px]" viewBox={`0 0 ${width} ${height}`}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Grid Lines */}
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#f3f4f6" strokeWidth="1" />
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4" />
            
            {/* Gradient Area */}
            {points && (
              <polygon
                points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
                fill="url(#revenueGrad)"
              />
            )}
            
            {/* Trend Line */}
            {points && (
              <polyline
                fill="none"
                stroke="#22c55e"
                strokeWidth="2.5"
                points={points}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Dots */}
            {revenueTrend.map((d, index) => {
              const x = padding + (index * (width - padding * 2)) / (revenueTrend.length - 1);
              const y = height - padding - (d.value * (height - padding * 2)) / maxRevenue;
              return (
                <g key={d.label} className="group cursor-pointer">
                  <circle cx={x} cy={y} r="4" fill="#ffffff" stroke="#22c55e" strokeWidth="2" />
                  <circle cx={x} cy={y} r="8" fill="#22c55e" fillOpacity="0.1" className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex justify-between text-[10px] text-stone-500 font-semibold border-t border-stone-100 pt-2.5">
          {revenueTrend.map(d => (
            <span key={d.label}>{d.label}</span>
          ))}
        </div>
      </div>

      {/* Refund Reasons Donut Chart */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">Refund Claims Split</h4>
          <p className="text-[10px] text-stone-400 mt-0.5">Reason-based category fault share</p>
        </div>
        <div className="flex items-center justify-around my-2">
          {totalRefunds === 1 && refundReasons.every(r => r.value === 0) ? (
            <div className="text-xs text-stone-400 py-12">No refund data logged.</div>
          ) : (
            <>
              <svg className="w-[100px] h-[100px]" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f3f4f6" strokeWidth="5.5" />
                {refundReasons.map((d, index) => {
                  if (d.value === 0) return null;
                  const percentage = (d.value / totalRefunds) * 100;
                  const strokeDashoffset = 100 - cumulativeAngle;
                  cumulativeAngle += percentage;
                  return (
                    <circle
                      key={d.label}
                      cx="21"
                      cy="21"
                      r="15.915"
                      fill="transparent"
                      stroke={colors[index % colors.length]}
                      strokeWidth="5.5"
                      strokeDasharray={`${percentage} ${100 - percentage}`}
                      strokeDashoffset={strokeDashoffset}
                      transform="rotate(-90 21 21)"
                    />
                  );
                })}
              </svg>
              <div className="space-y-1.5 text-xs text-stone-600 font-semibold">
                {refundReasons.map((d, index) => (
                  <div key={d.label} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                    <span>{d.label}: {d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="border-t border-stone-100 pt-2.5 text-center text-[10px] text-stone-400">
          Proportional split of returns mediation
        </div>
      </div>

      {/* Category Sales Bar Chart */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">Top Categories</h4>
          <p className="text-[10px] text-stone-400 mt-0.5">Order subtotal sales distributions</p>
        </div>
        <div className="space-y-2.5 my-2">
          {categorySales.length === 0 ? (
            <div className="text-xs text-stone-400 py-12 text-center">No categories sales logged.</div>
          ) : (
            categorySales.map((c) => {
              const maxVal = Math.max(...categorySales.map(d => d.value), 1);
              const percentage = (c.value / maxVal) * 100;
              return (
                <div key={c.label} className="space-y-1">
                  <div className="flex justify-between text-xs text-stone-600 font-semibold">
                    <span>{c.label}</span>
                    <span>₹{c.value.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-stone-900 rounded-full" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="border-t border-stone-100 pt-2.5 text-[10px] text-stone-400 text-center">
          Aggregated category values
        </div>
      </div>
    </div>
  );
}
