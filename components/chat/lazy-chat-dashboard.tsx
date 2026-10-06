"use client";

import dynamic from "next/dynamic";

const ChatDashboard = dynamic(() => import("./chat-dashboard"), {
  ssr: false,
  loading: () => (
    <div className="h-[78vh] flex items-center justify-center text-stone-550 text-xs">
      Loading message board...
    </div>
  ),
});

export default ChatDashboard;
