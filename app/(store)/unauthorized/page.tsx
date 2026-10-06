import Link from "next/link";
import { ShieldX, ArrowLeft } from "lucide-react";
import { logoutUser } from "@/actions/auth";

export const metadata = {
  title: "Unauthorized — GarmentHub",
  description: "You don't have permission to access this page.",
};

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="font-display text-3xl font-light text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500 text-sm leading-relaxed mb-8">
          You don&apos;t have permission to access this page. If you believe this is
          a mistake, please contact support.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 bg-stone-900 text-white rounded-xl px-6 py-3 text-sm font-medium hover:bg-stone-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to homepage
          </Link>
          <Link
            href="/account"
            className="flex items-center justify-center gap-2 border border-stone-200 text-stone-700 rounded-xl px-6 py-3 text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            Go to my account
          </Link>
          <form action={logoutUser} className="w-full">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 rounded-xl px-6 py-3 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Sign out / Switch account
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
