import { Suspense } from "react";
import ChatDashboard from "@/components/chat/lazy-chat-dashboard";

export default function CustomerMessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-light text-stone-900">Conversations</h1>
        <p className="text-xs text-stone-500 mt-1">Talk to sellers, request help on orders, or communicate with administrators.</p>
      </div>
      <Suspense fallback={<div className="h-[78vh] flex items-center justify-center text-stone-500 text-xs">Loading message board...</div>}>
        <ChatDashboard role="CUSTOMER" />
      </Suspense>
    </div>
  );
}
