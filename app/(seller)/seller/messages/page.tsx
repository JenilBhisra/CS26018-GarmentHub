import { Suspense } from "react";
import ChatDashboard from "@/components/chat/lazy-chat-dashboard";
import { ensureKycApproved } from "@/actions/kyc";

export default async function SellerMessagesPage() {
  await ensureKycApproved();
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-light text-stone-900">Seller Messages</h1>
        <p className="text-xs text-stone-500 mt-1">Communicate with customers, discuss customized bulk orders or resolve customer disputes.</p>
      </div>
      <Suspense fallback={<div className="h-[78vh] flex items-center justify-center text-stone-500 text-xs">Loading message board...</div>}>
        <ChatDashboard role="SELLER" />
      </Suspense>
    </div>
  );
}
