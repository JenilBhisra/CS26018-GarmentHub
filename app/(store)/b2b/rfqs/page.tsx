import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CustomerLayout } from "@/components/site/layout";
import { getBuyerRFQs, closeRFQ, updateQuoteStatus } from "@/actions/b2b";
import { SmartImage } from "@/components/site/smart-image";
import Link from "next/link";
import { 
  FileText, Clock, MapPin, Inbox, Check, X,
  Calendar, ShieldAlert
} from "lucide-react";

export default async function BuyerRFQsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "B2B_VENDOR") {
    redirect("/b2b");
  }

  const rfqs = await getBuyerRFQs();

  return (
    <CustomerLayout>
      <div className="container-page py-10 space-y-8">
        {/* Breadcrumb / Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-200 pb-5">
          <div>
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-widest flex items-center gap-1.5">
              <Link href="/b2b" className="hover:text-stone-900 transition-colors">B2B Portal</Link>
              <span>/</span>
              <span className="text-stone-900 font-bold">My Inquiries</span>
            </div>
            <h1 className="font-display text-3xl font-light text-stone-900 mt-2">B2B Buyer Dashboard</h1>
            <p className="text-sm text-stone-500 mt-1">Track your bulk requests, compare price quotes, and manage transactions.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/b2b/messages"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-stone-300 text-stone-700 bg-white hover:bg-stone-50 transition-colors text-sm font-semibold tracking-wide"
            >
              Negotiations & Chat
            </Link>
            <Link
              href="/b2b/analytics"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-stone-300 text-stone-700 bg-white hover:bg-stone-50 transition-colors text-sm font-semibold tracking-wide"
            >
              Analytics Dashboard
            </Link>
            <Link
              href="/b2b"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-stone-950 text-white hover:bg-stone-850 transition-colors text-sm font-semibold tracking-wide"
            >
              Explore B2B Catalog
            </Link>
          </div>
        </div>

        {/* RFQs List */}
        {rfqs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-stone-200 bg-stone-50/50 rounded-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
              <Inbox className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-800 text-md">No Quotation Requests Found</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm">
                You haven&apos;t submitted any Requests for Quotes yet. Go to the B2B catalog to source items.
              </p>
            </div>
            <Link
              href="/b2b"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 text-xs font-semibold"
            >
              Browse Catalog
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {rfqs.map((rfq: any) => {
              const hasQuotes = rfq.quotes && rfq.quotes.length > 0;
              let rfqStatusClass = "bg-amber-100 text-amber-800 border-amber-200";
              if (rfq.status === "RESPONDED") rfqStatusClass = "bg-blue-50 text-blue-700 border-blue-100";
              else if (rfq.status === "CLOSED") rfqStatusClass = "bg-stone-100 text-stone-550 border-stone-200";

              return (
                <div key={rfq.id} className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
                  {/* RFQ Header / Details */}
                  <div className="p-6 bg-stone-50 border-b border-stone-150 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex gap-4 items-start">
                      <div className="w-16 h-20 overflow-hidden rounded bg-stone-100 border border-stone-200 relative shrink-0">
                        {rfq.product.images?.[0] ? (
                          <SmartImage src={rfq.product.images[0]} className="h-full w-full object-cover" alt="" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-stone-400 text-[10px]">No img</div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${rfqStatusClass}`}>
                            {rfq.status}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">ID: {rfq.id}</span>
                        </div>
                        <h2 className="text-md font-semibold text-stone-900 mt-1">{rfq.product.name}</h2>
                        <div className="text-xs text-stone-500 font-medium">
                          Supplier: <strong className="text-stone-700 font-semibold">{rfq.product.seller?.storeName || "Unknown"}</strong>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-stone-500 items-center">
                          <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5 text-stone-400" /> Qty: <strong className="text-stone-700 font-semibold">{rfq.quantity} units</strong></span>
                          <span className="flex items-center gap-1">₹ Target Price: <strong className="text-stone-700 font-semibold">₹{rfq.targetPrice}/pc</strong></span>
                          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-stone-400" /> Dest: <strong className="text-stone-700 font-semibold">{rfq.deliveryCity}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 lg:text-right lg:items-end">
                      {/* Audit Timestamps */}
                      <div className="text-[10px] text-stone-400 space-y-0.5 pr-2 font-mono">
                        <div>Created: {new Date(rfq.createdAt).toLocaleString("en-IN")}</div>
                        {rfq.respondedAt && <div>Responded: {new Date(rfq.respondedAt).toLocaleString("en-IN")}</div>}
                        {rfq.lastResponseAt && <div>Last Updated: {new Date(rfq.lastResponseAt).toLocaleString("en-IN")}</div>}
                        {rfq.closedAt && <div>Closed: {new Date(rfq.closedAt).toLocaleString("en-IN")}</div>}
                      </div>

                      {rfq.status !== "CLOSED" && (
                        <form
                          action={async () => {
                            "use server";
                            await closeRFQ(rfq.id);
                          }}
                        >
                          <button
                            type="submit"
                            className="w-full sm:w-auto h-9 px-3 rounded-lg border border-red-200 text-red-650 hover:bg-red-50 text-xs font-semibold transition-colors"
                          >
                            Close Inquiry
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {rfq.notes && (
                    <div className="px-6 py-3 bg-stone-50/50 border-b border-stone-150 text-xs text-stone-600">
                      <strong>My Notes:</strong> {rfq.notes}
                    </div>
                  )}

                  {/* Seller Quotations Section */}
                  <div className="p-6">
                    <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Supplier Quotations</h3>
                    
                    {!hasQuotes ? (
                      <div className="flex items-center gap-2 p-4 border border-stone-150 rounded-xl bg-stone-50/50 text-stone-500 text-xs">
                        <Clock className="h-4 w-4 shrink-0 text-stone-400" />
                        <span>Awaiting supplier quote response. We will notify you once they write back.</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {rfq.quotes.map((quote: any) => {
                          const isExpired = new Date(quote.validityDate) <= new Date();
                          
                          let quoteStatusBadge = "bg-amber-100 text-amber-800 border-amber-200";
                          if (quote.status === "ACCEPTED") quoteStatusBadge = "bg-emerald-50 text-emerald-700 border-emerald-100";
                          else if (quote.status === "REJECTED") quoteStatusBadge = "bg-red-50 text-red-700 border-red-100";
                          else if (quote.status === "EXPIRED" || isExpired) quoteStatusBadge = "bg-stone-150 text-stone-500 border-stone-200";

                          return (
                            <div 
                              key={quote.id} 
                              className={`border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                                quote.status === "ACCEPTED" ? "border-emerald-250 bg-emerald-50/10" : "border-stone-200"
                              }`}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border ${quoteStatusBadge}`}>
                                    {isExpired ? "EXPIRED" : quote.status}
                                  </span>
                                  <span className="text-[10px] text-stone-450 font-mono">Quote ID: {quote.id}</span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                                  <div className="flex flex-col">
                                    <span className="text-[9px] uppercase font-bold text-stone-400">Offered Price</span>
                                    <span className="text-sm font-bold text-stone-900 mt-0.5">₹{quote.price}/pc</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] uppercase font-bold text-stone-400">Min Order Qty</span>
                                    <span className="text-xs font-semibold text-stone-700 mt-0.5">{quote.moq} pcs</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] uppercase font-bold text-stone-400">Lead Time</span>
                                    <span className="text-xs font-semibold text-stone-700 mt-0.5">{quote.leadTime}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] uppercase font-bold text-stone-400">Valid Until</span>
                                    <span className="text-xs font-mono text-stone-700 mt-0.5 flex items-center gap-1">
                                      <Calendar className="h-3 w-3 text-stone-400" />
                                      {new Date(quote.validityDate).toLocaleDateString("en-IN")}
                                    </span>
                                  </div>
                                </div>

                                {quote.notes && (
                                  <div className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-lg border border-stone-150 mt-2">
                                    <strong>Supplier Message:</strong> {quote.notes}
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-2 shrink-0 md:self-center">
                                {quote.status === "SENT" && !isExpired && rfq.status !== "CLOSED" ? (
                                  <div className="flex gap-2 w-full md:w-auto">
                                    <form
                                      action={async () => {
                                        "use server";
                                        await updateQuoteStatus(quote.id, "ACCEPTED");
                                      }}
                                    >
                                      <button
                                        type="submit"
                                        className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-1"
                                      >
                                        <Check className="h-3.5 w-3.5" /> Accept Quote
                                      </button>
                                    </form>

                                    <form
                                      action={async () => {
                                        "use server";
                                        await updateQuoteStatus(quote.id, "REJECTED");
                                      }}
                                    >
                                      <button
                                        type="submit"
                                        className="h-9 px-3 rounded-lg border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 text-xs font-semibold transition-colors flex items-center gap-1"
                                      >
                                        <X className="h-3.5 w-3.5" /> Reject
                                      </button>
                                    </form>
                                  </div>
                                ) : (
                                  <div className="text-xs text-stone-400 font-medium">
                                    {quote.status === "ACCEPTED" && <span className="text-emerald-600 font-semibold flex items-center gap-1"><Check className="h-4 w-4" /> Accepted</span>}
                                    {quote.status === "REJECTED" && <span className="text-red-500 font-semibold flex items-center gap-1"><X className="h-4 w-4" /> Rejected</span>}
                                    {isExpired && quote.status === "SENT" && <span className="text-stone-500 flex items-center gap-1"><ShieldAlert className="h-4 w-4" /> Expired</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
