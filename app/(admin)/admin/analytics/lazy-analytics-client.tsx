"use client";

import dynamic from "next/dynamic";

const AdminAnalyticsClient = dynamic(() => import("./analytics-client"), {
  ssr: false,
  loading: () => (
    <div className="h-96 rounded-xl border border-border bg-card animate-pulse" />
  ),
});

export default AdminAnalyticsClient;
