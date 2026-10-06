import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Forgot Password — GarmentHub",
  description: "Reset your GarmentHub account password.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white">
      <div className="w-full max-w-sm">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs text-stone-500 hover:text-stone-900 mb-8 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to sign in
        </Link>

        <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-6">
          <Mail className="w-6 h-6 text-stone-600" />
        </div>

        <h1 className="font-display text-3xl font-light text-stone-900 mb-2">Reset password</h1>
        <p className="text-stone-500 text-sm leading-relaxed mb-6">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>

        {/* TODO: Implement real password reset with email tokens */}
        <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-700 mb-6">
          Password reset via email is coming soon. Please contact support at{" "}
          <a href="mailto:support@garmenthub.in" className="underline">
            support@garmenthub.in
          </a>{" "}
          for assistance.
        </div>

        <form className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-stone-700 mb-1.5">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                id="email"
                name="email"
                type="email"
                disabled
                placeholder="you@example.com"
                className="w-full pl-9 pr-4 py-3 border border-stone-200 rounded-xl text-sm text-stone-400 placeholder:text-stone-300 bg-stone-50 cursor-not-allowed"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled
            className="w-full bg-stone-200 text-stone-400 rounded-xl px-4 py-3 text-sm font-medium cursor-not-allowed"
          >
            Send reset link (coming soon)
          </button>
        </form>
      </div>
    </div>
  );
}
