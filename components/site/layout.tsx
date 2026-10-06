import { SiteHeader } from "./header";

export { SiteHeader };

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-muted/30">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div>
          <div className="font-display text-2xl">GarmentHub</div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            A curated marketplace connecting independent garment stores, brands and wholesalers with shoppers across India.
          </p>
        </div>
        {[
          { title: "Shop", links: ["Women", "Men", "Kids", "Indian Wear", "Accessories"] },
          { title: "Sell", links: ["Become a Seller", "B2B Wholesale", "Seller Help", "Brand Partnerships"] },
          { title: "Company", links: ["About", "Careers", "Press", "Contact", "Privacy"] },
        ].map((col) => (
          <div key={col.title}>
            <div className="text-sm font-medium">{col.title}</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {col.links.map((l) => (
                <li key={l}><a href="#" className="hover:text-foreground">{l}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} GarmentHub. All rights reserved.</span>
          <span>Made in India</span>
        </div>
      </div>
    </footer>
  );
}

export function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

