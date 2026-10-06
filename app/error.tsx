"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { useSession } from "next-auth/react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const { data: session } = useSession();
  const [showStack, setShowStack] = useState(false);

  useEffect(() => {
    // Log the error to system logs in production/development
    console.error("Unhandled System Error:", error);
  }, [error]);

  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <div className="max-w-2xl w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        
        <div>
          <h1 className="font-display text-3xl font-light text-stone-900 mb-2">Something Went Wrong</h1>
          <p className="text-stone-500 text-sm max-w-md mx-auto leading-relaxed">
            An unexpected application error occurred. We have logged this occurrence and our tech operations team will review it.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 bg-stone-900 text-white rounded-xl px-6 py-3 text-sm font-medium hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
          
          <Link
            href="/"
            className="flex items-center justify-center gap-2 border border-stone-200 text-stone-700 rounded-xl px-6 py-3 text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to homepage
          </Link>
        </div>

        {/* Audit Debugging panel for Administrators only */}
        {isAdmin && (
          <div className="mt-8 text-left bg-stone-50 border border-stone-200 rounded-xl p-6 max-w-xl mx-auto shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-3">
              <span className="text-xs uppercase tracking-wider text-stone-500 font-bold">Admin Diagnostic Console</span>
              <button
                onClick={() => setShowStack(!showStack)}
                className="text-xs text-stone-600 hover:text-stone-900 underline font-semibold cursor-pointer"
              >
                {showStack ? "Hide Stack Trace" : "Show Stack Trace"}
              </button>
            </div>
            
            <p className="text-xs font-mono text-red-650 font-bold mb-2">Error: {error.message || "Unknown error"}</p>
            {error.digest && <p className="text-[10px] text-stone-400 font-mono mb-2">Digest ID: {error.digest}</p>}
            
            {showStack && (
              <pre className="text-[10px] font-mono bg-stone-900 text-stone-200 rounded p-3 overflow-x-auto max-h-60 leading-normal">
                {error.stack || "Stack trace not available."}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
