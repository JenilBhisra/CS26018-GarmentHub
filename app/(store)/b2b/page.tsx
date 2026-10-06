import { SmartImage } from "@/components/site/smart-image";
import Link from "next/link";
import { ArrowRight, Building2, Truck, Package, AlertCircle, Clock, XCircle } from "lucide-react";
import { CustomerLayout } from "@/components/site/layout";
import { LOCAL_STORES } from "@/lib/mock-data";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { B2BOffers } from "@/components/b2b/b2b-offers";
import { trackPageView } from "@/actions/analytics";

export default B2BPage;

async function B2BPage() {
  await trackPageView("B2B_PAGE");
  const session = await auth();
  
  let kycStatus = "NOT_SUBMITTED";
  let rejectionReason = "";

  if (session?.user?.role === "B2B_VENDOR") {
    const profile = await prisma.b2BProfile.findUnique({
      where: { userId: session.user.id },
      include: { kyc: true }
    });
    if (profile?.kyc) {
      kycStatus = profile.kyc.status;
      rejectionReason = profile.kyc.rejectionReason || "";
    }
  }

  // Fetch B2B products that are ACTIVE, B2B enabled, and B2B approved
  const dbProducts = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      isB2BEnabled: true,
      isB2BApproved: true,
    },
    include: {
      seller: true,
      variants: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const cats = ["Cotton Basics", "Ethnic Wear", "Denim", "Athleisure", "Children's Wear", "Accessories"];
  return (
    <CustomerLayout>
      {session?.user?.role === "B2B_VENDOR" && kycStatus !== "APPROVED" && (
        <div className="container-page mt-4">
          <div className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
            kycStatus === "NOT_SUBMITTED"
              ? "border-amber-200 bg-amber-50/50 text-amber-800"
              : kycStatus === "PENDING_REVIEW"
              ? "border-sky-200 bg-sky-50/50 text-sky-800"
              : "border-red-200 bg-red-50/50 text-red-800"
          }`}>
            <div className="flex gap-3">
              {kycStatus === "NOT_SUBMITTED" ? (
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              ) : kycStatus === "PENDING_REVIEW" ? (
                <Clock className="h-5 w-5 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
              )}
              <div>
                <h3 className="font-semibold text-sm">
                  {kycStatus === "NOT_SUBMITTED" && "KYC Verification Required"}
                  {kycStatus === "PENDING_REVIEW" && "KYC Status: Pending Review"}
                  {kycStatus === "REJECTED" && "KYC Verification Rejected"}
                </h3>
                <p className="text-xs mt-1">
                  {kycStatus === "NOT_SUBMITTED" && "Please submit your B2B Business KYC details to enable wholesale buying & custom quotations."}
                  {kycStatus === "PENDING_REVIEW" && "Your business details are under review. Verification typically takes 24-48 business hours."}
                  {kycStatus === "REJECTED" && `Your submission was rejected. Reason: ${rejectionReason || "Please verify your document details."}`}
                </p>
              </div>
            </div>
            <div>
              <Link
                href="/b2b/kyc"
                className={`inline-flex items-center text-xs font-semibold px-4 py-2 rounded-lg border transition-colors shrink-0 ${
                  kycStatus === "NOT_SUBMITTED"
                    ? "bg-amber-800 text-white border-amber-800 hover:bg-amber-900"
                    : kycStatus === "PENDING_REVIEW"
                    ? "bg-sky-800 text-white border-sky-800 hover:bg-sky-900"
                    : "bg-red-800 text-white border-red-800 hover:bg-red-900"
                }`}
              >
                {kycStatus === "NOT_SUBMITTED" && "Start Verification"}
                {kycStatus === "PENDING_REVIEW" && "View Details"}
                {kycStatus === "REJECTED" && "Resubmit Documents"}
              </Link>
            </div>
          </div>
        </div>
      )}

      <section className="bg-muted/30">
        <div className="container-page grid gap-8 py-12 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-accent font-semibold">B2B Wholesale</div>
            <h1 className="mt-2 font-display text-4xl sm:text-5xl">Source garments at factory prices</h1>
            <p className="mt-3 max-w-lg text-muted-foreground">Verified manufacturers, transparent MOQs, GST invoices and pan-India logistics — all on GarmentHub.</p>
            <div className="mt-6 flex gap-3">
              <Link href="/b2b/rfqs" className="rounded-full bg-stone-900 text-white hover:bg-stone-850 px-5 py-2.5 text-sm transition-colors">
                My RFQs & Quotes
              </Link>
              <Link href="/seller" className="rounded-full border border-foreground/20 px-5 py-2.5 text-sm hover:bg-foreground hover:text-background transition-all">
                Become a supplier
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4 text-sm">
              {[{Icon: Building2, t: "1,500+ suppliers"},{Icon: Package, t: "Custom MOQs"},{Icon: Truck, t: "Pan-India shipping"}].map(({Icon,t}) => (
                <div key={t} className="flex items-center gap-2"><Icon className="h-4 w-4 text-accent" />{t}</div>
              ))}
            </div>
          </div>
          <SmartImage src="https://images.unsplash.com/photo-1581338834647-b0fb40704e21?auto=format&fit=crop&w=1200&q=80" alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
        </div>
      </section>

      <section className="container-page mt-12">
        <h2 className="font-display text-2xl font-light text-stone-900">Bulk categories</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cats.map((c) => (
            <div key={c} className="rounded-xl border border-stone-200 bg-white px-4 py-5 text-sm hover:border-stone-500 transition-colors cursor-pointer text-center">{c}</div>
          ))}
        </div>
      </section>

      <section className="container-page mt-12">
        <div className="flex items-end justify-between mb-5">
          <h2 className="font-display text-2xl font-light text-stone-900">Wholesale offers</h2>
          <Link href="/b2b/rfqs" className="text-sm font-semibold text-stone-600 hover:text-stone-900 hover:underline transition-all">
            My RFQs & Quotes →
          </Link>
        </div>
        <B2BOffers products={dbProducts.map((p) => ({
          ...p,
          variants: p.variants.map((v) => ({
            ...v,
            sellingPrice: Number(v.sellingPrice),
            mrp: Number(v.mrp),
            bulkPrice: v.bulkPrice != null ? Number(v.bulkPrice) : null,
          })),
        }))} />
      </section>

      <section className="container-page mt-12">
        <h2 className="font-display text-2xl font-light text-stone-900">Verified suppliers</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {LOCAL_STORES.map((s) => (
            <div key={s.slug} className="rounded-xl border border-stone-200 bg-white p-3 text-sm flex flex-col justify-between">
              <div>
                <SmartImage src={s.image} alt={s.name} className="aspect-square w-full rounded-lg object-cover" />
                <div className="mt-2 font-semibold text-stone-800">{s.name}</div>
                <div className="text-xs text-stone-550">{s.loc}</div>
              </div>
              <Link
                href={session?.user?.role === "B2B_VENDOR" ? `/b2b/messages?sellerSlug=${s.slug}` : `/account/messages?sellerSlug=${s.slug}`}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                Contact <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page mt-16">
        <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-6 sm:p-10">
          <h2 className="font-display text-2xl font-light text-stone-900">Compare quotations from suppliers</h2>
          <p className="mt-1 text-sm text-stone-500">Send a single inquiry, receive proposals from multiple verified vendors, and pick the best fit.</p>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { n: "01", t: "Send inquiry", d: "Specify product, MOQ and timeline." },
              { n: "02", t: "Receive quotations", d: "Suppliers respond within 24 hours." },
              { n: "03", t: "Compare & order", d: "Side-by-side compare, then place." },
            ].map((s) => (
              <li key={s.n} className="rounded-xl bg-white border border-stone-150 p-5 shadow-sm">
                <div className="text-xs font-bold text-stone-400">{s.n}</div>
                <div className="mt-1.5 font-semibold text-stone-900">{s.t}</div>
                <div className="mt-1 text-xs text-stone-500 leading-relaxed">{s.d}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </CustomerLayout>
  );
}
