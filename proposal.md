# Project Proposal

### GarmentHub — Unified Multi-Channel Commerce Operations Platform

*Prepared by:* `<Your Name(s) & Roll Number(s)>`
*Date:* August 2026

---

## Problem Definition Statement

Independent apparel sellers who want to sell across multiple channels — Amazon, Flipkart, Meesho, Myntra, and their own online store — today have to operate every channel as a separate, disconnected business. They log in to each marketplace separately, re-create the same product listing multiple times with slightly different fields for each platform, manually keep stock counts in sync across channels (risking **overselling** the moment one channel sells a unit that was already committed elsewhere), and reconcile orders, returns, and payouts from each portal by hand, usually in spreadsheets. As a seller adds more channels, this manual overhead grows faster than their revenue — and every mistake (wrong stock shown, a missed order, inconsistent pricing) directly costs money and marketplace reputation.

The problem this project addresses is:

> *"How can a small-to-mid-size apparel seller manage products, inventory, orders, and returns across multiple sales channels — including their own storefront — from one unified operational system, without separate logins, spreadsheets, or manual reconciliation for every channel?"*

**How this differs from existing solutions.** Commercial multi-channel order-management tools (e.g. Unicommerce, EasyEcom, Increff) exist, but they are typically pure "glue" layers that assume the seller already has channels to connect — they don't give the seller an owned storefront of their own, they use one generic product form for every category of goods, and they largely assume every connected marketplace supports the same set of actions (which isn't true in practice, and causes silent failures when it isn't). GarmentHub is different in three concrete ways:

1. **An owned storefront is Channel #1, built-in** — sellers get a working direct-to-customer store as part of the platform itself, not just a hub that connects to channels they already have elsewhere.
2. **Capability-aware connectors, not one-size-fits-all** — every marketplace integration explicitly declares what it can and can't do (e.g. label download, order acceptance flow), so the interface only ever offers actions a channel genuinely supports, instead of quietly failing when it doesn't.
3. **A garment-specific product model and a real financial core** — category-aware attributes (size, fabric, fit, colour) instead of one bloated generic form, plus a genuine double-entry ledger for commissions, payouts, and refunds that is already implemented and covered by automated tests — not an afterthought pushed to spreadsheets later.

---

## 1. Product Overview

### 1.1 Users

1. **Seller (Multi-Channel Merchant)** — the primary user. Connects marketplace accounts, manages one central product catalog, monitors inventory, and fulfils orders from a single dashboard regardless of which channel they came from.
2. **Platform Admin** — supervises the platform itself: seller onboarding and KYC approval, monitoring integration health across every seller's connected channels, and platform-wide financial reconciliation.

### 1.2 Functionality

- Connect and manage multiple external marketplace accounts (Amazon, Flipkart, Meesho, Myntra) alongside an owned storefront, each represented as an independent **channel** behind a common connector interface.
- Maintain one central product catalog (Product → Variant → SKU) with category-aware, garment-specific attributes instead of a single oversized static form.
- Publish and update listings per channel independently, with a clear status per channel (Published / Pending / Rejected / Not connected) and per-channel price and stock overrides.
- Track inventory as a running **ledger** (physical, reserved, packed, damaged, safety stock) rather than a single quantity field, with configurable per-channel allocation caps to prevent overselling.
- Ingest orders from every connected channel into one queue, with a consistent internal status pipeline (New → Accepted → Packed → Dispatched → Delivered) regardless of source channel.
- Handle returns and refunds with a configurable, rule-based responsibility engine (who bears return shipping cost, whether commission is reversed) backed by a full double-entry financial ledger.
- Provide seller-facing analytics (sales, returns, inventory health) and an admin console for platform-wide oversight, KYC approval, and system health monitoring.

### 1.3 Features

- **Sales Channels module** — connect/disconnect marketplace accounts, see per-connector capability support and live connection health (Connected / Token expiring / Sync failed, etc.).
- **Central Product Catalog** with per-channel listing overrides, so one product can have a different price, description, or status per marketplace without duplicating the core record.
- **Adapter-based Marketplace Connector architecture** — every channel implements the same interface but declares its own supported capabilities, so the UI never promises an action a channel can't actually perform.
- **Inventory ledger** with per-channel allocation rules and safety stock, preventing the same unit of stock from being sold twice across two channels at once.
- **Unified Order Management** with bulk accept/pack/dispatch actions and per-order failure isolation — one failed order in a batch never blocks the rest.
- **Returns & Refund engine** with a configurable responsibility-rule table and an audited, double-entry financial ledger — already implemented and covered by automated tests.
- **Seller and Admin analytics dashboards** built on real, computed metrics rather than simulated numbers.

---

## 2. Proposed Solution

The project starts from a working foundation rather than a blank slate: a functioning single-channel storefront — product catalog, checkout, order management, a seller wallet/commission/payout ledger, KYC verification, and a rule-based returns engine — already built on Next.js (App Router), PostgreSQL via Prisma, and NextAuth. This becomes **Channel #1 ("Own Storefront")** rather than being discarded. The remaining work is delivered in phases:

- **Phase 0 — Stabilization (complete):** security-hardened the existing codebase, removed unauthenticated/destructive debug routes, and added automated test coverage for the financial ledger engine.
- **Phase 1 — Multi-Tenant & Connector Foundation:** introduce a seller-organisation model and a `MarketplaceConnector` interface, validated first against a Mock Connector before any real marketplace integration.
- **Phase 2 — Central Catalog & First Real Connector:** a category-aware product/variant/SKU model with dynamic attributes, plus the first real external connector — starting with a marketplace offering open, low-friction API access, ahead of the Indian marketplaces that require seller/partner-program approval.
- **Phase 3 — Inventory Ledger & Unified Orders:** a warehouse-level inventory ledger with per-channel allocation, and one unified order queue with an accept → pack → dispatch workflow spanning every connected channel.
- **Phase 4 onward:** generalize returns across channels, add GST/tax reporting, and add further marketplace connectors as partner API access is confirmed.

Every connector declares its own supported capabilities (for example `listing.create`, `shipping.labelDownload`) so the interface can honestly hide or disable actions a given channel doesn't support, instead of assuming every marketplace behaves identically.

---

## 3. Expected Outcome & Future Plan

### 3.1 Expected Outcome

- A seller can connect at least one real external channel plus their own storefront, and manage products, stock, and orders for both from a single dashboard.
- Inventory changes on one channel are reflected as allocation limits on every other connected channel, preventing the same stock from being oversold twice.
- Orders from multiple channels appear in one unified queue with a consistent accept/pack/dispatch workflow.
- The existing financial ledger and returns-rule engine is extended to work per channel, so payouts and refunds stay accurate as more channels are added.

### 3.2 Future Plan

Once the core multi-channel loop is proven with one real connector, the plan is to add further marketplace connectors (Flipkart, Meesho, Myntra, Amazon) as their partner/seller API access is confirmed, add warehouse tools such as scan-and-pack and pick lists, and extend analytics into genuine demand forecasting and reorder suggestions once enough real historical order data exists.

---

## 4. Challenges

- **Marketplace API access is not guaranteed or immediate.** Amazon, Flipkart, Meesho and Myntra each require seller/partner-program approval before their APIs can be used, and their exact capabilities (listing, inventory, shipping, returns) differ and must be verified against current official documentation rather than assumed.
- **Preventing overselling under concurrent orders.** When the same SKU can be sold from two channels at once, inventory reservation must be handled with transactional safety — this is genuinely non-trivial to get right.
- **No two marketplaces share the same order/return state machine.** External states must be mapped to one consistent internal model without losing information.
- **Data-ownership conflicts.** Some fields (e.g. order status) can be updated by both the platform and the marketplace; without clear rules this can create update loops.
- **Security and multi-tenant data isolation.** As the platform grows to serve multiple seller organisations, every query must be scoped so one seller can never see another's data — this has to be enforced at the foundation, not added later.

---

## 5. References (if any)

- This project's own audited codebase (Next.js 16, Prisma, PostgreSQL, NextAuth) — the problem definition and phased plan above are grounded in an actual repository audit, not a purely hypothetical green-field plan.
- Marketplace seller API documentation — Amazon SP-API, Flipkart Seller API, Meesho Supplier API, Myntra Partner API (access and capability details pending confirmation from each marketplace's partner program).
- Comparable commercial multi-channel OMS platforms — Unicommerce, EasyEcom, Increff, Zoho Inventory (reviewed for feature comparison and differentiation, see above).
