"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Heart, MapPin, Bell, User, RotateCcw, LayoutDashboard, BarChart3, MessageSquare } from "lucide-react";
import { CustomerLayout } from "@/components/site/layout";

export default AccountLayout;

const NAV = [
  { to: "/account", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/account/messages", label: "Messages", icon: MessageSquare },
  { to: "/account/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/account/orders", label: "Orders", icon: Package },
  { to: "/account/wishlist", label: "Wishlist", icon: Heart },
  { to: "/account/addresses", label: "Addresses", icon: MapPin },
  { to: "/account/notifications", label: "Notifications", icon: Bell },
  { to: "/account/profile", label: "Profile", icon: User },
  { to: "/account/returns", label: "Returns", icon: RotateCcw },
];

function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <CustomerLayout>
      <div className="container-page grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
        <aside>
          <div className="rounded-md border border-border p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Welcome</div>
            <div className="font-medium">Riya Sharma</div>
          </div>
          <nav className="mt-3 space-y-0.5 text-sm">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link key={n.to} href={n.to as never} className={`flex items-center gap-2 rounded-md px-3 py-2 ${active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div>{children}</div>
      </div>
    </CustomerLayout>
  );
}
