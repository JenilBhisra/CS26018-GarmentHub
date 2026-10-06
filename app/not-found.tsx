import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Page Not Found — GarmentHub",
  description: "The page you are looking for does not exist.",
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-center mx-auto mb-6">
          <Compass className="w-8 h-8 text-stone-500 animate-spin" style={{ animationDuration: "12s" }} />
        </div>
        <h1 className="font-display text-4xl font-light text-stone-900 mb-3">404</h1>
        <h2 className="font-display text-xl font-light text-stone-700 mb-3">Page Not Found</h2>
        <p className="text-stone-500 text-sm leading-relaxed mb-8">
          The page you are looking for might have been removed, had its name changed,
          or is temporarily unavailable.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 bg-stone-900 text-white rounded-xl px-6 py-3 text-sm font-medium hover:bg-stone-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
