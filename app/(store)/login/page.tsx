"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loginUser, loginWithGoogle } from "@/actions/auth";
import { Eye, EyeOff, Mail, Lock, ArrowRight, ShoppingBag } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await loginUser({
        email: fd.get("email") as string,
        password: fd.get("password") as string,
        callbackUrl,
      });

      if (result.success) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  async function handleGoogleLogin() {
    startTransition(async () => {
      await loginWithGoogle(callbackUrl);
    });
  }

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-stone-950">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-950 to-black" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 20%, oklch(0.65 0.15 60), transparent 50%),
                             radial-gradient(circle at 80% 80%, oklch(0.45 0.12 200), transparent 50%)`,
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-xl font-medium tracking-tight">GarmentHub</span>
          </div>
          <div>
            <h2 className="font-display text-4xl font-light leading-tight mb-4">
              India&apos;s curated<br />fashion marketplace
            </h2>
            <p className="text-stone-400 text-base leading-relaxed max-w-sm">
              Discover independent garment stores, designer brands, and B2B
              wholesalers across India — all in one place.
            </p>
            <div className="mt-8 flex gap-6">
              <div>
                <div className="text-2xl font-display font-light text-white">500+</div>
                <div className="text-xs text-stone-500 mt-0.5">Verified Sellers</div>
              </div>
              <div className="w-px bg-stone-800" />
              <div>
                <div className="text-2xl font-display font-light text-white">10k+</div>
                <div className="text-xs text-stone-500 mt-0.5">Products</div>
              </div>
              <div className="w-px bg-stone-800" />
              <div>
                <div className="text-2xl font-display font-light text-white">50+</div>
                <div className="text-xs text-stone-500 mt-0.5">Cities</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-lg font-medium">GarmentHub</span>
          </div>

          <div className="mb-8">
            <h1 className="font-display text-3xl font-light text-stone-900 mb-2">Welcome back</h1>
            <p className="text-stone-500 text-sm">
              New here?{" "}
              <Link href="/register" className="text-stone-900 underline underline-offset-2 hover:text-stone-700">
                Create an account
              </Link>
            </p>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-3 border border-stone-200 rounded-xl px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors mb-6 disabled:opacity-60"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-stone-400">or sign in with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
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
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-4 py-3 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-medium text-stone-700">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-stone-500 hover:text-stone-700">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-3 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-stone-800 active:bg-stone-950 transition-colors disabled:opacity-60"
            >
              {isPending ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-stone-400">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-stone-700">Terms</Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-stone-700">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
