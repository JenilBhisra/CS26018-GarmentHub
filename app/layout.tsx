import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/providers/session-provider";
import { CartProvider } from "@/providers/cart-provider";
import { WishlistProvider } from "@/providers/wishlist-provider";
import { Toaster } from "sonner";
import { auth } from "@/auth";
import { validateEnvironment } from "@/lib/env-check";


const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "GarmentHub — India's curated fashion marketplace",
  description: "Discover independent garment stores, fashion brands and B2B wholesalers across India on GarmentHub.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  validateEnvironment();
  const session = await auth();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionProvider session={session}>
          <CartProvider>
            <WishlistProvider>
              {children}
              <Toaster position="bottom-right" richColors />
            </WishlistProvider>
          </CartProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

