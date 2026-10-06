import { Suspense } from "react";
import ChatDashboard from "@/components/chat/lazy-chat-dashboard";
import { CustomerLayout } from "@/components/site/layout";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function B2BMessagesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  
  const isB2B = session.user.role === "B2B_VENDOR" || session.user.role === "ADMIN";
  if (!isB2B) {
    redirect("/unauthorized");
  }

  return (
    <CustomerLayout>
      <div className="container-page py-8 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-light text-stone-900">Wholesale Negotiations & RFQ Chats</h1>
          <p className="text-xs text-stone-500 mt-1">Communicate directly with garment manufacturers and bulk buyers regarding your custom inquiries.</p>
        </div>
        <Suspense fallback={<div className="h-[78vh] flex items-center justify-center text-stone-500 text-xs">Loading message board...</div>}>
          <ChatDashboard role="B2B" />
        </Suspense>
      </div>
    </CustomerLayout>
  );
}
