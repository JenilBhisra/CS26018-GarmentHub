import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAdminRFQs } from "@/actions/b2b";
import { SmartImage } from "@/components/site/smart-image";
import { 
  Building2, MapPin, Layers, FileText, Inbox, 
  Calendar, User
} from "lucide-react";

export default async function AdminRFQsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const rfqs = await getAdminRFQs();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl">All Wholesale RFQs & Quotes</h1>
        <p className="text-sm text-muted-foreground">Monitor and audit B2B wholesale transactions, quotation requests, and vendor offers.</p>
      </div>

      {rfqs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-stone-200 bg-card rounded-xl text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
            <Inbox className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-850 text-md">No Wholesale RFQs</h3>
            <p className="text-xs text-muted-foreground mt-1">
              No quotation requests have been submitted on the platform yet.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {rfqs.map((rfq: any) => {
            const hasQuotes = rfq.quotes && rfq.quotes.length > 0;
            let statusBadge = "bg-amber-100 text-amber-800 border-amber-200";
            if (rfq.status === "RESPONDED") statusBadge = "bg-blue-50 text-blue-700 border-blue-150";
            else if (rfq.status === "CLOSED") statusBadge = "bg-stone-100 text-stone-550 border-stone-200";

            return (
              <div key={rfq.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:border-stone-300 transition-colors">
                
                {/* Header Information */}
                <div className="p-5 bg-stone-50 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex gap-4 items-start">
                    <div className="w-14 h-16 rounded overflow-hidden relative shrink-0 border border-stone-200 bg-white">
                      {rfq.product.images?.[0] ? (
                        <SmartImage src={rfq.product.images[0]} className="h-full w-full object-cover" alt="" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-stone-400 text-[10px]">No image</div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border ${statusBadge}`}>
                          {rfq.status}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono">RFQ ID: {rfq.id}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-stone-900 mt-1">{rfq.product.name}</h3>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-1 mt-0.5 text-xs text-stone-500 font-medium">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-stone-400" />
                          <span>B2B Buyer: <strong className="text-stone-750 font-semibold">{rfq.buyer.companyName} ({rfq.buyer.user.email})</strong></span>
                        </span>
                        <span className="hidden sm:inline text-stone-300">|</span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-stone-400" />
                          <span>Supplier: <strong className="text-stone-750 font-semibold">{rfq.product.seller?.storeName || "Unknown"}</strong></span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-stone-400 space-y-0.5 md:text-right font-mono shrink-0">
                    <div>Requested: {new Date(rfq.createdAt).toLocaleString("en-IN")}</div>
                    {rfq.respondedAt && <div>Responded: {new Date(rfq.respondedAt).toLocaleString("en-IN")}</div>}
                    {rfq.lastResponseAt && <div>Last Quote: {new Date(rfq.lastResponseAt).toLocaleString("en-IN")}</div>}
                    {rfq.closedAt && <div>Closed: {new Date(rfq.closedAt).toLocaleString("en-IN")}</div>}
                  </div>
                </div>

                {/* RFQ Demand Metrics */}
                <div className="p-5 border-b border-stone-150 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-stone-50 border border-stone-150 flex items-center justify-center text-stone-450">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-stone-400">Target Quantity</div>
                      <div className="text-xs font-bold text-stone-800 mt-0.5">{rfq.quantity} units</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-stone-50 border border-stone-150 flex items-center justify-center text-stone-450">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-stone-400">Target Unit Price</div>
                      <div className="text-xs font-bold text-stone-855 mt-0.5">₹{rfq.targetPrice}/pc</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-stone-50 border border-stone-150 flex items-center justify-center text-stone-450">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-stone-400">Delivery Location</div>
                      <div className="text-xs font-bold text-stone-850 mt-0.5">{rfq.deliveryCity}</div>
                    </div>
                  </div>
                </div>

                {/* Buyer Notes */}
                {rfq.notes && (
                  <div className="px-5 py-3 bg-stone-50/30 border-b border-stone-150 text-xs text-stone-600">
                    <strong>Buyer Notes:</strong> {rfq.notes}
                  </div>
                )}

                {/* Quotes Submissions list */}
                <div className="p-5 bg-white space-y-3">
                  <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Quotations Sent By Supplier</h4>
                  
                  {!hasQuotes ? (
                    <p className="text-xs text-stone-500 italic">No quotation offers submitted yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {rfq.quotes.map((quote: any) => {
                        const isExpired = new Date(quote.validityDate) <= new Date();

                        let quoteStatusBadge = "bg-amber-100 text-amber-800 border-amber-200";
                        if (quote.status === "ACCEPTED") quoteStatusBadge = "bg-emerald-50 text-emerald-700 border-emerald-100";
                        else if (quote.status === "REJECTED") quoteStatusBadge = "bg-red-50 text-red-750 border-red-100";
                        else if (quote.status === "EXPIRED" || isExpired) quoteStatusBadge = "bg-stone-100 text-stone-500 border-stone-200";

                        return (
                          <div key={quote.id} className="border border-stone-200 rounded-lg p-3 bg-stone-50/50 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.2 text-[9px] font-bold uppercase border ${quoteStatusBadge}`}>
                                  {isExpired ? "EXPIRED" : quote.status}
                                </span>
                                <span className="text-[10px] text-stone-400 font-mono">Sent: {new Date(quote.createdAt).toLocaleDateString("en-IN")}</span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-stone-600 mt-1">
                                <span>Offered: <strong className="text-stone-900 font-bold">₹{quote.price}/pc</strong></span>
                                <span>MOQ: <strong className="text-stone-850 font-semibold">{quote.moq} pcs</strong></span>
                                <span>Lead Time: <strong className="text-stone-850 font-semibold">{quote.leadTime}</strong></span>
                                <span className="flex items-center gap-1 font-mono text-[11px]">
                                  <Calendar className="h-3.5 w-3.5 text-stone-400" />
                                  Valid Until: {new Date(quote.validityDate).toLocaleDateString("en-IN")}
                                </span>
                              </div>
                              {quote.notes && (
                                <div className="text-stone-550 border-t border-stone-200/60 pt-1 mt-1 text-[11px]">
                                  <strong>Supplier Message:</strong> {quote.notes}
                                </div>
                              )}
                            </div>

                            <div className="self-start sm:self-center shrink-0 font-medium">
                              {quote.status === "ACCEPTED" && <span className="text-emerald-600 flex items-center gap-1 font-bold">Accepted</span>}
                              {quote.status === "REJECTED" && <span className="text-red-500 flex items-center gap-1 font-bold">Rejected</span>}
                              {quote.status === "SENT" && !isExpired && <span className="text-amber-600 flex items-center gap-1 font-bold">Awaiting Buyer Action</span>}
                              {isExpired && quote.status === "SENT" && <span className="text-stone-500 flex items-center gap-1">Expired</span>}
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
  );
}
