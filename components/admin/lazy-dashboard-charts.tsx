"use client";

import dynamic from "next/dynamic";
import React from "react";

export const LazyDashboardCharts = dynamic(
  () => import("./dashboard-charts"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[220px] w-full flex items-center justify-center text-xs font-semibold text-stone-400 bg-white border border-stone-200 rounded-xl animate-pulse">
        Loading analytics charts...
      </div>
    ),
  }
);
