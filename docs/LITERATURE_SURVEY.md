# Literature Survey

**Project:** GarmentHub — Garment Store and Inventory Management System (Team CS26018)

## 1. Purpose and method

Before building GarmentHub we studied existing order and inventory management systems used by online sellers in India, plus the official seller APIs of two large marketplaces. The goals were to:

- understand which features sellers already expect,
- find the gap that a small garment seller still faces, and
- learn what is needed before a marketplace such as Amazon can be connected.

**Sources:** official product websites and official developer documentation, listed in Section 7. All pages were accessed on 5 October 2026.

**Limitations:**

- Product websites are marketing material. The features below are what each company *says* its product offers. We did not buy or test these products.
- A dash (–) in the comparison table means the feature was **not stated on the page we reviewed**. It does not mean the product lacks it.
- We have not included research papers in this version. Any paper added later must be a real, checkable publication.

## 2. Existing systems reviewed

### 2.1 Unicommerce [1]

Unicommerce describes itself as a multichannel order management system. Its website states that it:

- brings orders from apps, websites and marketplaces into one dashboard,
- syncs inventory across channels and locations to prevent overselling and stockouts,
- integrates with Amazon, Flipkart, Myntra, Shopify, WooCommerce and many more (290+ integrations claimed),
- supports order routing, picking, packing, and printing of invoices and labels,
- handles returns with quality checks and restocking, for both courier returns (RTO) and customer returns.

It is aimed at e-commerce brands and sellers handling large order volumes.

### 2.2 EasyEcom [2]

EasyEcom presents itself as an operating system for commerce. Its website lists:

- multi-channel order management (Amazon, Flipkart, Shopify and others),
- warehouse management with pick paths, wave picking and bin-level tracking,
- inventory sync with stock pooling across channels,
- payment reconciliation,
- returns and dispute management with video evidence linked to order IDs,
- connectors to ERP systems such as SAP and Oracle.

### 2.3 Zoho Inventory [3]

Zoho Inventory is general inventory software, not only for fashion. Its website lists:

- serial and batch tracking,
- integrations with Amazon, Etsy, Shopify and WooCommerce to sync stock,
- sales and purchase order management, invoices and bills,
- multi-warehouse stock control,
- barcode generation and scanning,
- shipping carrier integrations (for example Shiprocket, Delhivery and Blue Dart),
- inventory reports such as ageing and valuation.

### 2.4 OMS Guru [4]

OMS Guru is a multichannel inventory and order management system. Its website lists:

- integration with Amazon, eBay, Flipkart, Snapdeal, Magento and Shopify,
- a single platform for order processing, with 3PL shipping integrations for labels,
- inventory sync across marketplaces and websites,
- a returns reconciliation tool with mobile app support,
- profit and loss by product and channel, payment reconciliation, and GST reports with Tally and Busy integration.

GarmentHub's order tabs, Pack Logs, Scan and Pack and Tag Loop ideas were inspired by the seller workflow of this kind of tool. We studied the workflow and did not copy its design or branding.

### 2.5 Odoo Barcode (with Odoo Inventory) [5]

Odoo's official documentation describes a Barcode app for warehouse work. It assigns barcodes to products and packagings, tracks stock movements by scanning, processes receipts and deliveries (including picking and packing) by scanning, and supports lot and serial numbers. It shows how scanning can confirm that the right item is being moved or packed. GarmentHub's Scan and Pack uses the same idea.

## 3. Marketplace APIs reviewed

### 3.1 Amazon Selling Partner API (SP-API) [6]

The SP-API is Amazon's REST-based API for sellers and vendors. The official documentation covers orders, listings, inventory, fulfilment (FBA and merchant-fulfilled), feeds, reports, pricing, finances and notifications.

**Before any API call**, a developer must complete SP-API registration and be approved, and each seller must authorise the application to access their account.

**What this means for GarmentHub:** a live Amazon connection cannot be built only by writing code. It first needs developer registration, a seller account to authorise the app, and approval from Amazon. For this reason the project has only prepared its database (sales channels, seller channel accounts and channel listings) and has not connected to Amazon.

### 3.2 Flipkart Marketplace Seller APIs [7]

Flipkart's official API documentation (v3.0) says sellers can search orders, print shipping labels and invoices, manage listings and inventory, and track shipments. To use the API, a seller registers on the Flipkart seller portal, then creates an application in the Developer Access section. Authentication uses OAuth: client credentials for a seller's own app, or authorization code flow for third-party partners. Access tokens expire after about 60 days.

This confirms that each marketplace has its own access process and token rules. A future GarmentHub connector would have to store and refresh credentials for each seller account.

## 4. Comparison

✔ = stated on the reviewed source. – = not stated on the reviewed source. For GarmentHub, the status comes from our own code (see [CURRENT_STATUS.md](CURRENT_STATUS.md)).

| Feature | Unicommerce [1] | EasyEcom [2] | Zoho Inventory [3] | OMS Guru [4] | Odoo Barcode [5] | GarmentHub (this project) |
|---|---|---|---|---|---|---|
| Orders from several marketplaces in one place | ✔ | ✔ | ✔ (via integrations) | ✔ | – | Planned (data model only) |
| Inventory sync across channels | ✔ | ✔ | ✔ | ✔ | – | Planned |
| Own online store included | – | – | – | – | – | ✔ |
| Size/colour variants with SKU-level stock | – | – | – | – | – | ✔ |
| Stock movement history (ledger) | – | – | – | – | ✔ (stock movements) | ✔ |
| Barcode / SKU scanning while packing | ✔ (picking and packing) | ✔ (warehouse) | ✔ (barcode scanning) | – | ✔ | ✔ (Scan and Pack) |
| Shipping labels and invoices | ✔ | – | – | ✔ (labels via 3PL) | – | ✔ (PDF with barcode/QR) |
| Returns handling | ✔ | ✔ | – | ✔ | – | ✔ |
| Return item verification | ✔ (quality check) | ✔ (video evidence) | – | – | – | Partial (Tag Loop, server logic only) |
| Reports / analytics | – | ✔ | ✔ | ✔ | – | ✔ |
| Courier / shipping partner integration | ✔ | – | ✔ | ✔ | – | Planned (manual entry today) |
| Payment reconciliation | – | ✔ | – | ✔ | – | Partial (internal ledger, no gateway) |

## 5. Findings and research gap

1. **Mature tools exist, but they are large products for high-volume sellers.** Unicommerce and EasyEcom focus on many channels, warehouses and ERP connections, which is more than a small garment seller starting out needs.
2. **Most tools assume the seller already sells somewhere else.** They connect to existing channels. None of the reviewed pages described a built-in online store. GarmentHub includes its own store as the first sales channel.
3. **Scanning while packing is a common, proven idea** (Unicommerce, EasyEcom, Zoho, Odoo). It is worth having even in a small system, because wrong-size and wrong-colour shipments are expensive for garment sellers.
4. **Return verification is becoming important.** Unicommerce mentions quality checks and EasyEcom mentions video evidence. GarmentHub's Tag Loop records a tag number at packing so it can be compared when the item comes back.
5. **Marketplace integration depends on approval, not just code.** Both Amazon and Flipkart require registration, app authorisation and token handling. A student project should prepare a clean data model and connector design first, then integrate after access is granted.

**Gap addressed by GarmentHub:** a simpler, garment-focused system that combines an own store, size/colour SKU stock with a ledger, Scan and Pack with Tag Loop, and shipping documents in one place, with a data model ready for marketplace integration later.

## 6. How the survey shaped GarmentHub

| Learning from survey | Where it appears in GarmentHub |
|---|---|
| Central order queue with stages | Seller Orders page with New / Packed / Ready to Ship / Cancelled tabs (`lib/order-tabs.ts`) |
| Scanning during packing | Pack Logs and Scan and Pack (`actions/packlogs.ts`, `actions/scan-pack.ts`) |
| Labels and invoices from order data | `actions/documents.tsx`, `app/api/orders/documents/route.ts` |
| Return checks | Return rules (`lib/shipping.ts`), Tag Loop fields and `verifyTagLoop` (`actions/returns.ts`) |
| Stock history | `InventoryTransaction` model and ledger writes in orders, returns, product edit and bulk update |
| Channels need separate credentials and status | `SalesChannel`, `SellerChannelAccount`, `ChannelListing` models in `prisma/schema.prisma` |

## 7. References

All accessed on 5 October 2026.

1. Unicommerce, "Best Multichannel Order Management System | Unicommerce." https://www.unicommerce.com/multichannel-order-management-system/
2. EasyEcom, "EasyEcom — The operating system for modern commerce." https://www.easyecom.io/
3. Zoho Corporation, "Inventory Management Software | Online Inventory Management – Zoho Inventory." https://www.zoho.com/inventory/
4. OMSGuru, "Multichannel Inventory and Order Management System | OMSGuru." https://www.omsguru.com/
5. Odoo S.A., "Barcode," Odoo 18.0 documentation. https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/barcode.html
6. Amazon, "Selling Partner API" developer documentation. https://developer-docs.amazon.com/sp-api/
7. Flipkart, "Flipkart Marketplace Seller APIs — Developer API v3.0 documentation." https://seller.flipkart.com/api-docs/FMSAPI.html
