"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Package, ShoppingBag, MessageSquare, Wallet, BarChart3, Settings, LogOut,
  UserCheck, Users, Users2, FolderTree, CreditCard, Coins, Percent, Image, Sparkles, AlertTriangle, FileText,
  Star, HelpCircle, Tag, CornerUpLeft, Search, Loader2, CheckSquare, Boxes
} from "lucide-react";

import { useState, useEffect, type ComponentType } from "react";
import { NotificationBell } from "@/components/site/notification-bell";
import { executeGlobalSearch, type SearchResult } from "@/actions/search";

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }> };

export function PortalShell({
  brand,
  brandTag,
  nav,
  children,
}: {
  brand: string;
  brandTag: string;
  nav: NavItem[];
  children?: React.ReactNode;
}) {
  const pathname = usePathname();

  // Global Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const delay = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await executeGlobalSearch(searchQuery);
        setSearchResults(res);
      } catch (err) {
        console.error("Portal shell search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [searchQuery]);

  return (
    <div className="flex min-h-screen bg-muted/30 w-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <div className="mb-6">
          <Link href="/">
            <div className="font-display text-xl text-sidebar-foreground">{brand}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{brandTag}</div>
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 text-sm overflow-y-auto pr-1">
          {nav.map((n) => {
            const active = pathname === n.to || (n.to !== "/seller" && n.to !== "/admin" && pathname.startsWith(n.to));
            return (
              <Link key={n.to} href={n.to} className={`flex items-center gap-2 rounded-md px-3 py-2 ${active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`}>
                <n.icon className="className?: h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/" className="mt-4 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60">
          <LogOut className="h-4 w-4" /> Back to store
        </Link>
      </aside>
      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Horizontal Top Bar for Desktop */}
        <header className="hidden lg:flex h-16 items-center justify-between border-b border-border bg-background px-8 shrink-0">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search orders, products, customers, refunds..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-stone-200 bg-stone-50/50 py-1.5 pl-10 pr-10 text-xs font-medium placeholder:text-stone-400 focus:bg-background focus:border-stone-400 focus:outline-none transition-all"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-400" />
            )}
            
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-stone-200 bg-white p-2 shadow-lg divide-y divide-stone-50">
                {searchResults.map((item) => (
                  <Link
                    key={item.id}
                    href={item.route}
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="block rounded-md px-3 py-2 hover:bg-stone-50 transition"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-stone-800 text-xs">{item.label}</span>
                      <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">{item.type}</span>
                    </div>
                    {item.sublabel && (
                      <div className="text-[10px] text-stone-500 font-mono mt-0.5">{item.sublabel}</div>
                    )}
                  </Link>
                ))}
              </div>
            )}
            {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-stone-200 bg-white p-4 shadow-lg text-center text-xs text-stone-400">
                No matching records found.
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>

        {/* Mobile Header */}
        <div className="border-b border-border bg-background p-3 lg:hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="font-display text-lg">{brand} · <span className="text-xs uppercase tracking-widest text-muted-foreground">{brandTag}</span></div>
            <NotificationBell />
          </div>
          <div className="-mx-1 flex gap-1 overflow-x-auto pb-1 hide-scrollbar">
            {nav.map((n) => {
              const active = pathname === n.to || (n.to !== "/seller" && n.to !== "/admin" && pathname.startsWith(n.to));
              return (
                <Link key={n.to} href={n.to} className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${active ? "bg-foreground text-background" : "bg-muted"}`}>
                  {n.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="p-5 sm:p-8 flex-1">{children}</div>
      </main>
    </div>
  );
}

export const SELLER_NAV: NavItem[] = [
  { to: "/seller", label: "Dashboard", icon: LayoutDashboard },
  { to: "/seller/tasks", label: "Task Center", icon: CheckSquare },
  { to: "/seller/kyc", label: "KYC Verification", icon: FileText },
  { to: "/seller/products", label: "Products", icon: Package },
  { to: "/seller/orders", label: "Orders", icon: ShoppingBag },
  { to: "/seller/pack-logs", label: "Pack Logs", icon: Boxes },
  { to: "/seller/returns", label: "Returns / Refunds", icon: CornerUpLeft },
  { to: "/seller/intelligence", label: "Personal Intelligence", icon: Sparkles },
  { to: "/seller/market-intelligence", label: "Market Intelligence", icon: BarChart3 },
  { to: "/seller/rfqs", label: "Wholesale RFQs", icon: FileText },
  { to: "/seller/promotions", label: "Promotions", icon: Percent },
  { to: "/seller/reviews", label: "Customer Reviews", icon: Star },
  { to: "/seller/qa", label: "Product Q&A", icon: HelpCircle },
  { to: "/seller/messages", label: "Messages", icon: MessageSquare },
  { to: "/seller/wallet", label: "Wallet", icon: Wallet },
  { to: "/seller/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/seller/reports", label: "Reports", icon: FileText },
  { to: "/seller/settings", label: "Settings", icon: Settings },
];

export const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/tasks", label: "Task Center", icon: CheckSquare },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/kyc", label: "KYC Verification", icon: FileText },
  { to: "/admin/requests", label: "Vendor Requests", icon: UserCheck },
  { to: "/admin/sellers", label: "Sellers", icon: Users2 },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: FolderTree },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/coupons", label: "Coupons", icon: Tag },
  { to: "/admin/promotions", label: "Promotions", icon: Percent },
  { to: "/admin/rfqs", label: "Wholesale RFQs", icon: FileText },
  { to: "/admin/reviews", label: "Reviews Moderation", icon: Star },
  { to: "/admin/qa", label: "Q&A Moderation", icon: HelpCircle },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/wallets", label: "Wallets", icon: Wallet },
  { to: "/admin/settlements", label: "Settlements", icon: Coins },
  { to: "/admin/accounting", label: "Accounting", icon: Coins },
  { to: "/admin/return-refund-management", label: "Return Rules", icon: CornerUpLeft },
  { to: "/admin/return-refund-history", label: "Refund History", icon: FileText },
  { to: "/admin/market-intelligence", label: "Market Intelligence", icon: BarChart3 },
  { to: "/admin/commissions", label: "Commissions", icon: Percent },
  { to: "/admin/banners", label: "Banners", icon: Image },
  { to: "/admin/trending", label: "Trending", icon: Sparkles },
  { to: "/admin/disputes", label: "Disputes", icon: AlertTriangle },
  { to: "/admin/reports", label: "Reports", icon: FileText },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/system", label: "System Config", icon: Settings },
];
