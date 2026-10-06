"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerUser } from "@/actions/auth";
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, ShoppingBag, Check } from "lucide-react";

type Role = "CUSTOMER" | "SELLER" | "B2B_VENDOR";

const ROLE_OPTIONS: { value: Role; label: string; desc: string }[] = [
  { value: "CUSTOMER", label: "Customer", desc: "Shop & discover fashion" },
  { value: "SELLER", label: "Seller", desc: "List & sell your products" },
  { value: "B2B_VENDOR", label: "B2B Vendor", desc: "Wholesale & bulk orders" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>("CUSTOMER");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData(e.currentTarget);

    const password = fd.get("password") as string;
    const confirmPassword = fd.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    startTransition(async () => {
      const result = await registerUser({
        name: fd.get("name") as string,
        email: fd.get("email") as string,
        phone: (fd.get("phone") as string) || undefined,
        password,
        role: selectedRole,
      });

      if (result.success) {
        setSuccess(result.message);
        setTimeout(() => router.push("/login"), 2000);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-5/12 relative overflow-hidden bg-stone-950">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-950 to-black" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 30%, oklch(0.65 0.15 60), transparent 50%),
                             radial-gradient(circle at 75% 70%, oklch(0.45 0.12 200), transparent 50%)`,
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
              Join India&apos;s<br />fashion community
            </h2>
            <p className="text-stone-400 text-base leading-relaxed max-w-sm">
              Whether you&apos;re a shopper, seller, or wholesale buyer — GarmentHub has
              the right space for you.
            </p>
            <div className="mt-8 space-y-3">
              {[
                "Free to register — no hidden fees",
                "Seller approval within 24–48 hours",
                "Secure payments & buyer protection",
                "Pan-India shipping support",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-stone-400">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white overflow-y-auto">
        <div className="w-full max-w-sm py-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-lg font-medium">GarmentHub</span>
          </div>

          <div className="mb-6">
            <h1 className="font-display text-3xl font-light text-stone-900 mb-2">Create account</h1>
            <p className="text-stone-500 text-sm">
              Already have one?{" "}
              <Link href="/login" className="text-stone-900 underline underline-offset-2 hover:text-stone-700">
                Sign in
              </Link>
            </p>
          </div>

          {/* Role selector */}
          <div className="mb-6">
            <p className="text-xs font-medium text-stone-700 mb-2">I want to join as</p>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedRole(value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${
                    selectedRole === value
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
                  }`}
                >
                  <span className="text-xs font-semibold">{label}</span>
                  <span className={`text-[10px] leading-tight ${selectedRole === value ? "text-stone-300" : "text-stone-500"}`}>
                    {desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedRole !== "CUSTOMER" && (
            <div className="mb-5 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-800 leading-relaxed">
              {selectedRole === "SELLER"
                ? "Seller accounts require admin approval before you can list products. You'll receive an email once approved."
                : "B2B Vendor accounts require verification. You can log in after registration but B2B features will be unlocked after approval."}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-stone-700 mb-1.5">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Your full name"
                  className="w-full pl-9 pr-4 py-3 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-stone-700 mb-1.5">Email address</label>
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

            {/* Phone (optional) */}
            <div>
              <label htmlFor="phone" className="block text-xs font-medium text-stone-700 mb-1.5">
                Phone <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+91 9876543210"
                  className="w-full pl-9 pr-4 py-3 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-stone-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
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

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-stone-700 mb-1.5">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  className="w-full pl-9 pr-4 py-3 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            {/* Error / Success */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                {success} Redirecting to login…
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
                <>Create account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-stone-400">
            By registering, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-stone-700">Terms</Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-stone-700">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
