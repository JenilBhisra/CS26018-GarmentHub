import { Suspense } from "react";
import ChatDashboard from "@/components/chat/lazy-chat-dashboard";

export default function AdminMessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-light text-stone-900">Admin Moderation & Support Inbox</h1>
        <p className="text-xs text-stone-500 mt-1">Audit customer conversations, handle reported threads, and interact with support queries.</p>
      </div>
      <Suspense fallback={<div className="h-[78vh] flex items-center justify-center text-stone-500 text-xs">Loading admin message board...</div>}>
        <ChatDashboard role="ADMIN" />
      </Suspense>
    </div>
  );
}
