"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Heart, ShoppingBag, User, Menu, MapPin, LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { CATEGORIES } from "@/lib/mock-data";
import { useAuth } from "@/hooks/use-auth";
import { useWishlist } from "@/providers/wishlist-provider";
import { useCart } from "@/providers/cart-provider";
import { NotificationBell } from "@/components/site/notification-bell";

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const { user, isAuthenticated, logout } = useAuth();
  const { cartItemsCount } = useCart();
  const { wishlistCount } = useWishlist();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      {/* Announcement bar */}
      <div className="bg-primary text-primary-foreground">
        <div className="container-page flex h-8 items-center justify-between text-xs">
          <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Deliver to 560001</span>
          <div className="hidden gap-5 sm:flex">
            <Link href="/seller" className="opacity-80 hover:opacity-100">Sell on GarmentHub</Link>
            <Link href="/b2b" className="opacity-80 hover:opacity-100">B2B Wholesale</Link>
            <Link href="/admin" className="opacity-80 hover:opacity-100">Admin</Link>
          </div>
        </div>
      </div>

      <div className="container-page flex h-16 items-center gap-4">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted lg:hidden"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link href="/" className="shrink-0">
          <span className="font-display text-2xl tracking-tight">GarmentHub</span>
        </Link>

        <form onSubmit={handleSearch} className="relative ml-2 hidden flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for sarees, sneakers, brands…"
            className="h-10 w-full rounded-full border border-input bg-muted/40 pl-10 pr-4 text-sm outline-none transition focus:border-accent focus:bg-background"
          />
        </form>

        <nav className="ml-auto flex items-center gap-1">
          {/* Account dropdown */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setAccountMenuOpen((v) => !v)}
              className="flex h-10 items-center gap-1.5 rounded-md px-3 text-sm hover:bg-muted"
              aria-label="Account menu"
            >
              <User className="h-4 w-4" />
              <span>{isAuthenticated ? (user?.name?.split(" ")[0] ?? "Account") : "Sign in"}</span>
            </button>
            {accountMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAccountMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-border bg-background shadow-lg py-1.5 text-sm">
                  {isAuthenticated ? (
                    <>
                      <Link href="/account" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 hover:bg-muted">
                        <User className="h-4 w-4 text-muted-foreground" /> My Account
                      </Link>
                      <Link href="/account/orders" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 hover:bg-muted">
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" /> Orders
                      </Link>
                      <Link href="/account/wishlist" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 hover:bg-muted">
                        <Heart className="h-4 w-4 text-muted-foreground" /> Wishlist
                      </Link>
                      <div className="my-1 border-t border-border" />
                      <button
                        onClick={() => { setAccountMenuOpen(false); logout(); }}
                        className="flex w-full items-center gap-2 px-4 py-2 hover:bg-muted text-left text-red-600"
                      >
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 hover:bg-muted font-medium">
                        <LogIn className="h-4 w-4 text-muted-foreground" /> Sign in
                      </Link>
                      <Link href="/register" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 hover:bg-muted text-muted-foreground">
                        <User className="h-4 w-4" /> Create account
                      </Link>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {isAuthenticated && <NotificationBell />}
          <Link href="/account/wishlist" className="relative grid h-10 w-10 place-items-center rounded-md hover:bg-muted" aria-label="Wishlist">
            <Heart className="h-5 w-5" />
            {wishlistCount > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-foreground">{wishlistCount}</span>
            )}
          </Link>
          <Link href="/cart" className="relative grid h-10 w-10 place-items-center rounded-md hover:bg-muted" aria-label="Cart">
            <ShoppingBag className="h-5 w-5" />
            {cartItemsCount > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-foreground">{cartItemsCount}</span>
            )}
          </Link>
        </nav>
      </div>

      {/* Categories nav */}
      <div className="hidden border-t border-border lg:block">
        <div className="container-page flex h-11 items-center gap-7 text-sm">
          {CATEGORIES.map((c) => {
            const isActive = pathname === `/category/${c.slug}`;
            return (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className={`transition hover:text-foreground ${isActive ? "text-accent font-medium" : "text-foreground/80"}`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border lg:hidden">
          <div className="container-page space-y-2 py-3">
            <form onSubmit={handleSearch} className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products"
                className="h-10 w-full rounded-full border border-input bg-muted/40 pl-10 pr-4 text-sm outline-none"
              />
            </form>
            {/* Mobile auth links */}
            <div className="flex gap-2">
              {isAuthenticated ? (
                <>
                  <Link href="/account" onClick={() => setMobileOpen(false)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm">
                    <User className="h-4 w-4" /> Account
                  </Link>
                  <button
                    onClick={() => { setMobileOpen(false); logout(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-red-600"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-stone-900 text-white py-2 text-sm">
                    <LogIn className="h-4 w-4" /> Sign in
                  </Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm">
                    Register
                  </Link>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/category/${c.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  {c.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
