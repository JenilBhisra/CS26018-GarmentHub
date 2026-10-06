"use client";

import { useState } from "react";
import { SmartImage } from "@/components/site/smart-image";
import { RFQModal } from "./rfq-modal";

type DBProduct = {
  id: string;
  name: string;
  images: string[];
  seller: {
    storeName: string;
    pickupAddress: string;
  } | null;
  variants: {
    id: string;
    sellingPrice: number;
    moq: number | null;
    bulkPrice: number | null;
  }[];
};

type B2BOffersProps = {
  products: DBProduct[];
};

export function B2BOffers({ products }: B2BOffersProps) {
  const [selectedProduct, setSelectedProduct] = useState<DBProduct | null>(null);

  if (products.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
        <p className="text-sm text-stone-500 italic">No wholesale offers currently available.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const defaultVariant = p.variants?.[0];
          // Determine MOQ and Bulk Price
          const moq = defaultVariant?.moq || 50;
          const bulkPrice = defaultVariant?.bulkPrice || defaultVariant?.sellingPrice || 0;
          const imgUrl = p.images?.[0] || "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=400&q=80";

          return (
            <div key={p.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm flex flex-col justify-between hover:border-stone-400 transition-colors">
              <div>
                <div className="aspect-[4/3] w-full overflow-hidden relative bg-stone-100 shrink-0">
                  <SmartImage src={imgUrl} alt={p.name} className="h-full w-full object-cover" />
                </div>
                <div className="p-4">
                  <div className="text-xs font-semibold text-stone-400 tracking-wide uppercase">
                    {p.seller?.storeName || "Vendor"} · {p.seller?.pickupAddress || "India"}
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-stone-900 leading-snug">{p.name}</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-stone-50 border border-stone-150 px-2 py-1.5 flex flex-col">
                      <span className="text-[10px] text-stone-400 uppercase font-semibold">Min Order Qty</span>
                      <b className="text-stone-900 font-bold mt-0.5">{moq} pcs</b>
                    </div>
                    <div className="rounded-lg bg-stone-50 border border-stone-150 px-2 py-1.5 flex flex-col">
                      <span className="text-[10px] text-stone-400 uppercase font-semibold">Bulk Price</span>
                      <b className="text-stone-900 font-bold mt-0.5">₹{bulkPrice.toLocaleString("en-IN")}/pc</b>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 pt-0 flex gap-2">
                <button
                  onClick={() => setSelectedProduct(p)}
                  className="flex-1 rounded-lg bg-stone-900 hover:bg-stone-800 py-2.5 text-xs font-semibold text-white tracking-wide transition-colors"
                >
                  Request Quote
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedProduct && (
        <RFQModal
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          productImage={selectedProduct.images?.[0]}
          storeName={selectedProduct.seller?.storeName || "Vendor"}
          moq={selectedProduct.variants?.[0]?.moq || 50}
          bulkPrice={selectedProduct.variants?.[0]?.bulkPrice || selectedProduct.variants?.[0]?.sellingPrice || 0}
          isOpen={true}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
}
