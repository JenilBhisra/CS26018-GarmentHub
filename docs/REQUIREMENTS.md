# Requirements

**Project:** GarmentHub — Garment Store and Inventory Management System (Team CS26018)

This document lists what the system must do (functional requirements) and how well it must do it (non-functional requirements). Each requirement has a status taken from the actual code in this repository:

- **Done** — working code exists.
- **Partial** — some of it exists; the missing part is described.
- **Planned** — not built yet.

Last checked against the code: 6 October 2026.

## 1. Users and roles

| Role | Description |
|---|---|
| Customer | Buys garments from the online store |
| Seller | Lists garments, manages stock, processes and ships orders, handles returns |
| Admin | Supervises sellers, products, orders, returns, refunds, payouts and reports |
| B2B Vendor | Bulk buyer using requests for quotation (an older module still in the code) |

Roles are stored in the `Role` enum in `prisma/schema.prisma`. Pages are protected by role in `middleware.ts`.

## 2. Functional requirements

### 2.1 Accounts and access

| ID | Requirement | Status | Where in code / notes |
|---|---|---|---|
| FR-01 | Users can register and log in with email and password | Done | `actions/auth.ts`, `auth.ts`, `app/(store)/login`, `app/(store)/register` |
| FR-02 | Users can optionally sign in with Google | Done (needs Google keys in `.env`) | `auth.ts` |
| FR-03 | Each page area is limited to the right role (customer, seller, admin, B2B) | Done | `middleware.ts` |
| FR-04 | A user can reset a forgotten password | **Planned** | `app/(store)/forgot-password/page.tsx` is only a placeholder ("coming soon") |
| FR-05 | A seller registers a store and uploads KYC documents; an admin approves or rejects them | Done | `actions/kyc.ts`, `app/(seller)/seller/kyc`, `app/(admin)/admin/kyc` |

### 2.2 Product catalogue and inventory

| ID | Requirement | Status | Where in code / notes |
|---|---|---|---|
| FR-06 | Admin manages product categories | Done | `actions/products.ts`, `app/(admin)/admin/categories` |
| FR-07 | Seller creates and edits products with name, brand, description, images, HSN code and GST rate | Done | `actions/products.ts`, `app/(seller)/seller/products/product-form.tsx` |
| FR-08 | Each product has variants with SKU, size, colour, MRP, selling price and stock | Done | `ProductVariant` model |
| FR-09 | Admin moderates (approves or rejects) products before they go live | Done | `moderateProduct()` in `actions/products.ts` |
| FR-10 | Seller can update stock for many variants at once | Done | `bulkUpdateInventorySeller()` in `actions/bulk.ts` |
| FR-11 | Every stock change is recorded in an inventory ledger with type, quantity before/after and reason | **Partial** | Sales, cancellations, return restocks and manual adjustments are recorded (`InventoryTransaction`). **Opening stock entered when a product is first created is not recorded.** |
| FR-12 | Seller sees low-stock and out-of-stock variants | Done | Seller dashboard (`app/(seller)/seller/page.tsx`) |

### 2.3 Customer store

| ID | Requirement | Status | Where in code / notes |
|---|---|---|---|
| FR-13 | Customer browses categories, searches and views product details with size/colour choice | Done | `app/(store)/` pages |
| FR-14 | Customer uses a cart and a wishlist | Done | `actions/cart.ts`, `actions/wishlist.ts` |
| FR-15 | Customer applies a coupon and places an order with a shipping address | Done | Cart page, `app/(store)/checkout/page.tsx`, `createOrders()` |
| FR-16 | Customer pays online | **Planned** | Only Cash on Delivery and manual payment work. `actions/payments.ts` is a Razorpay placeholder that throws "not implemented". |
| FR-17 | Customer views order history and requests a return | Done | `app/(account)/account/orders`, `requestReturn()` |
| FR-18 | Customer writes reviews and asks questions about products | Done | `actions/reviews.ts`, `actions/qa.ts` |
| FR-19 | Users receive notifications and email updates | **Partial** | In-app notifications work. **Emails are simulated**: `lib/email.ts` prints them to the server console. |

### 2.4 Order processing and fulfilment (seller)

| ID | Requirement | Status | Where in code / notes |
|---|---|---|---|
| FR-20 | Seller sees orders in tabs: New, Packed, Ready to Ship, Cancelled | Done | `lib/order-tabs.ts`, `app/(seller)/seller/orders` |
| FR-21 | Seller updates order status, one by one or in bulk; one failed order does not block the rest | Done | `updateOrderStatus()`, `bulkUpdateOrderStatusSeller()` |
| FR-22 | Seller groups New orders into a Pack Log (a packing batch) | Done | `createPackLogFromOrders()` in `actions/packlogs.ts` |
| FR-23 | During Scan and Pack the seller scans each item's SKU; the system rejects SKUs not in the batch or already scanned, and shows a temporary bin | Done | `scanOrderItem()`, `getTmpBins()` in `actions/scan-pack.ts`, scan page |
| FR-24 | A unique Tag Loop number can be recorded for each packed item | Done | `OrderItem.tagLoopNumber` (unique), scan page |
| FR-25 | Seller downloads a shipping label + tax invoice PDF (with Code 128 barcode and QR code) and a shipping list (Excel) | Done | `actions/documents.tsx`, `app/api/orders/documents/route.ts` |
| FR-26 | Seller marks packed orders Ready to Ship and confirms shipment | Done | `bulkMarkReadyToShip()`, `bulkConfirmShipment()` |
| FR-27 | Courier name and tracking number are recorded for each shipment | **Partial** | **Entered manually by the seller.** There is no courier company API. |

### 2.5 Returns and refunds

| ID | Requirement | Status | Where in code / notes |
|---|---|---|---|
| FR-28 | Return reasons are classified, and rules decide who pays (seller, customer or platform) | Done | `ReturnReasonRule` model, `classifyReturnReason()` in `lib/shipping.ts` |
| FR-29 | Seller and admin review return requests; admin finalises refunds, which update the seller wallet and the financial ledger | Done | `actions/returns.ts`, `finalizeRefundAdmin()`, `actions/ledger.ts` |
| FR-30 | Returned stock goes back into inventory and is recorded in the ledger | Done | `RETURN_RESTOCK` entries in `actions/returns.ts` |
| FR-31 | On return inspection, the seller or admin checks the returned item's Tag Loop number against the one recorded at packing | **Partial** | `verifyTagLoop()` and `getReturnRequestDetail()` exist in `actions/returns.ts`, but **no screen uses them yet**. |

### 2.6 Dashboards and reports

| ID | Requirement | Status | Where in code / notes |
|---|---|---|---|
| FR-32 | Seller dashboard shows net units sold (7 days), orders to ship and stock alerts | Done | `app/(seller)/seller/page.tsx`, `seller-client.tsx` |
| FR-33 | Seller and admin analytics with date filters and charts | Done | `actions/analytics.ts`, analytics pages (Recharts) |
| FR-34 | Reports for sales and returns, with export | Done | `getReportData()`, `actions/returns-report.ts`, `app/api/export/route.ts` |
| FR-35 | Seller wallet, payout requests and admin settlement | Done | `actions/wallets.ts`, `actions/payouts.ts` |

### 2.7 Sales channels and marketplace integration

| ID | Requirement | Status | Where in code / notes |
|---|---|---|---|
| FR-36 | The database can represent sales channels, a seller's channel accounts and per-channel listings | **Partial** | `SalesChannel`, `SellerChannelAccount`, `ChannelListing` models and migrations exist. Only the native "GarmentHub" channel is seeded. There are no screens for channels yet. |
| FR-37 | Orders record which channel they came from | **Partial** | `Order.channelId` and `Order.externalOrderId` fields exist. Nothing fills them for external channels yet. |
| FR-38 | Connect a seller's Amazon account and import orders/listings | **Planned** | **The Amazon connection is not implemented.** No Amazon API code exists. Amazon SP-API registration and seller authorisation are needed first. |

## 3. Non-functional requirements

| ID | Requirement | Status | Evidence / notes |
|---|---|---|---|
| NFR-01 | Passwords are stored only as bcrypt hashes | Done | `bcryptjs` in `actions/auth.ts` and `prisma/seed.ts` |
| NFR-02 | Secrets and demo passwords are kept out of source code (environment variables) | Done | `.env.example` has placeholders only; the seed requires `SEED_TEST_PASSWORD` and has no fallback |
| NFR-03 | Plaintext passwords are not written to server logs | Done | `next.config.ts` turns off logging of Server Function arguments |
| NFR-04 | A seller can only read or change their own products, orders and documents | Done | Ownership checks such as `requireSellerProfile()` and `fetchOwnedOrders()`; isolation tests in `actions/*.test.ts` |
| NFR-05 | KYC documents are not public files | Done | Served only through `app/api/kyc/[filename]/route.ts` with login and role checks |
| NFR-06 | Stock and ledger changes are saved together, or not at all | Done | Prisma transactions in orders, returns, products and bulk actions |
| NFR-07 | The financial ledger is double-entry and rejects unbalanced or duplicate entries | Done | `actions/ledger.ts`; 6 ledger tests passed on 6 Oct 2026 |
| NFR-08 | Repeated requests are limited on sensitive actions | Partial | `lib/rate-limit.ts` is used by login, KYC, products, reviews and more. It stores counts in server memory, so limits reset on restart and are not shared between servers. |
| NFR-09 | Important admin and seller actions are audit-logged | Done | `actions/audit.ts`, used by bulk actions, KYC, payouts, pack logs and more |
| NFR-10 | Code is type-checked | Done | TypeScript `strict` mode; `tsc --noEmit` gave 0 errors on 6 Oct 2026 |
| NFR-11 | Code passes the linter | **Not met** | `npm run lint` reports 224 errors and 108 warnings (see [CURRENT_STATUS.md](CURRENT_STATUS.md)) |
| NFR-12 | Automated tests never touch the normal development database | Done | `scripts/test-database-guard.ts`: tests only run on `TEST_DATABASE_URL` whose name ends in `_test` |
| NFR-13 | The UI works on desktop and mobile screen sizes | Not verified | Built with responsive Tailwind CSS; no formal device testing has been done |
| NFR-14 | Pages load quickly | Not measured | No performance testing has been done |

## 4. System requirements

**To run the project locally:**

| Item | Requirement |
|---|---|
| Runtime | Node.js 20 or newer (developed with Node.js 25.2.1) |
| Database | PostgreSQL (developed with PostgreSQL 18), with two databases: one for the app and one ending in `_test` for tests |
| Package manager | npm (uses the committed `package-lock.json`) |
| Browser | Any modern browser |
| Hardware | A normal laptop or desktop; about 1 GB of disk space for dependencies |

## 5. Constraints and assumptions

- Marketplace APIs (Amazon SP-API, Flipkart Seller API) need developer registration, approval and seller authorisation before any integration work can be tested.
- Online payment and real email sending need accounts with outside providers, which this project does not have yet.
- The project is developed and tested on a local machine; no production deployment exists.
