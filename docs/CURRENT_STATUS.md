# Current Status

**Project:** GarmentHub — Garment Store and Inventory Management System (Team CS26018)
**Status date:** 6 October 2026

## 1. Summary

GarmentHub is a working web application, but it is **not complete**. The store, catalogue, inventory ledger, order processing, Scan and Pack, shipping documents, dispatch, returns and reports all have working code. Some features are partial or planned, and the code does not pass the linter yet.

**Completion estimate: about 75%.** This figure comes from the team's Week 9 progress report. It is an approximate overall development estimate, **not a verified measurement**. We kept it after comparing it with the code:

- Weeks 3–8 of the plan have working code (see [PROJECT_TIMELINE.md](PROJECT_TIMELINE.md)).
- Week 9 (testing, fixes and Amazon preparation) is only partly done.
- The limitations in Section 3 are real gaps, so a higher figure would not be justified.

## 2. What works (implemented)

- Registration and login with email/password, optional Google sign-in, and four roles (Customer, Seller, B2B Vendor, Admin) with role-based page protection.
- Seller onboarding with KYC document upload and admin approval.
- Product catalogue: categories, products, and variants with SKU, size, colour, MRP, selling price and stock. Products are moderated by the admin.
- Customer store: browse, search, product page, cart, wishlist, coupons, checkout (Cash on Delivery / manual payment), order history, return requests, reviews, and product questions.
- Inventory ledger for sales, cancellations, return restocks and manual adjustments (product edit and bulk update).
- Seller order management with New / Packed / Ready to Ship / Cancelled tabs and bulk actions.
- Seller dashboard with net units sold (last 7 days), orders to ship, and low/out-of-stock alerts.
- **Pack Logs and Scan and Pack:** batch packing, SKU scanning with checks, temporary bins, and a unique Tag Loop number per item.
- **Shipping documents:** a shipping label and tax invoice PDF with Code 128 barcode and QR code, and a shipping list in Excel.
- **Dispatch:** mark Ready to Ship, confirm shipment.
- Returns with rule-based responsibility (seller, customer or platform fault), admin refund finalisation, and a double-entry financial ledger.
- Seller wallet, payout requests, admin settlements.
- Seller and admin analytics and reports, with export.
- Database tables for sales channels, seller channel accounts and channel listings (only the native "GarmentHub" channel is seeded).
- Protection that stops automated tests from running against the normal development database.

**Other modules in the code from earlier development phases** (present and building, but not re-checked feature by feature for this status report): B2B requests for quotation, buyer–seller chat, promotions, disputes, market-intelligence CSV upload and insights, admin banners, trending products, tasks, accounting and system logs.

## 3. Known limitations (partial or not implemented)

| Limitation | Current state |
|---|---|
| **Amazon connection** | **Not implemented.** Only the database tables for channels exist. There is no Amazon API code, and no Amazon SP-API developer registration has been done. |
| **Tag Loop check on returns** | **Server logic exists, screen is missing.** `verifyTagLoop()` and `getReturnRequestDetail()` are in `actions/returns.ts`, but no page uses them. |
| **Forgot password** | **Placeholder only.** The page says "coming soon"; no reset email or token is sent. |
| **Payment** | **Simulated.** Only Cash on Delivery and manual payment work. Online payment (`actions/payments.ts`) is a Razorpay placeholder. |
| **Email** | **Simulated.** `lib/email.ts` prints emails to the server console instead of sending them. |
| **Courier details** | **Entered manually** by the seller. No courier company API is connected. |
| **Opening product stock** | **Not recorded in stock history.** Stock entered when a product is first created does not create an inventory ledger entry. Later changes are recorded. |
| Channel screens | No pages yet to view or connect sales channels. |
| Rate limiting | Kept in server memory only, so it resets on restart. |

## 4. Check results

All checks were run on **6 October 2026** in a clean copy of the project, with a fresh `npm ci`, against a separate local test database (`garmenthub_test`). The normal development database was not used.

| Check | Command | Result |
|---|---|---|
| Install dependencies | `npm ci` | ✅ Passed (644 packages) |
| Generate Prisma client | `npx prisma generate` | ✅ Passed. **Note:** this step is required after `npm ci`; it does not run automatically. |
| Schema validation | `npx prisma validate` | ✅ Passed |
| Apply migrations to an empty database | `npx prisma migrate deploy` | ✅ Passed (3 migrations) |
| Migrations match schema | `npx prisma migrate diff --from-url <test db> --to-schema-datamodel prisma/schema.prisma --exit-code` | ✅ No difference |
| Seed test database | `npx prisma db seed` | ✅ Passed (8 categories, 6 seller stores, 48 products, 608 variants) |
| Type check | `npx tsc --noEmit` | ✅ Passed (0 errors) |
| Production build | `npm run build` | ✅ Passed, with warnings (see Section 5) |
| Lint | `npm run lint` | ❌ Failed: 224 errors, 108 warnings |
| Automated tests | `npm test` | ⚠️ **9 passed, 5 failed** (14 tests in 4 files) |
| Manual script: Pack Log / Scan and Pack / Tag Loop | `scripts/test-pack-fulfillment.ts` | ✅ "All pack fulfillment tests passed" |
| Manual script: wallet, ledger, refunds, payouts | `scripts/test-financials.ts` | ✅ All checks passed |
| Manual script: payouts, returns, disputes | `scripts/test-marketplace-integration.ts` | ✅ "All integration tests passed" |

### Test details

| Test file | Result |
|---|---|
| `actions/ledger.test.ts` (double-entry ledger) | 6 of 6 passed |
| `actions/packlogs.test.ts` (Pack Log workflow) | 1 of 1 passed |
| `actions/inventory-ledger.test.ts` | 2 of 3 passed |
| `actions/product-inventory-ledger.test.ts` | 0 of 4 passed |

**Why 5 tests fail:** these tests need the demo seller `seller@garmenthub.local` to own at least one product. The seed script gives products only to the six demo stores and none to this seller, so on a freshly seeded database the tests stop with "Seeded seller must own at least one product variant". As a check, we temporarily gave one product to that seller in the test database, and all 7 tests in these two files passed. The failures are therefore caused by missing test data, not by a confirmed bug in the stock code. The test data still needs to be fixed (see Section 6).

### Lint details

| Rule | Count |
|---|---|
| `@typescript-eslint/no-explicit-any` (error) | 190 |
| `react/no-unescaped-entities` (error) | 14 |
| `react-hooks/set-state-in-effect` (error) | 8 |
| `react-hooks/static-components` (error) | 6 |
| `prefer-const` (error) | 3 |
| `react-hooks/purity` (error) | 2 |
| `react-hooks/immutability` (error) | 1 |
| `@typescript-eslint/no-unused-vars` (warning) | 102 |
| `react-hooks/exhaustive-deps` (warning) | 4 |
| `jsx-a11y/alt-text` (warning) | 2 |

Most errors are in the admin pages (73) and seller pages (61). These were not fixed for this submission, so that the code would not be changed in bulk.

## 5. Other technical notes

- **Build warnings:**
  - Next.js 16 says the `middleware.ts` file convention is deprecated and should be renamed to `proxy`.
  - Turbopack reports that a file-system call in the import trace of `next.config.ts` caused the whole project to be traced.
  - During the build, page-view tracking logs "Dynamic server usage" messages for `/` and `/b2b`. The build still succeeds.
- **Prisma:** the `prisma` section in `package.json` is deprecated and should move to a `prisma.config.ts` file before Prisma 7.
- **`dotenv`:** it is imported by `scripts/test-database-guard.ts` (and so by `vitest.setup.ts`) but is not listed in `package.json`. It currently works because another package installs it.
- **Test safety:** `scripts/test-marketplace-integration.ts` deletes transaction tables and resets wallets. It, the other `scripts/test-*.ts` files and all Vitest tests now refuse to run unless `TEST_DATABASE_URL` points to a database whose name ends in `_test`.
- **Demo accounts:** the seed reads the demo password from `SEED_TEST_PASSWORD` in `.env`. Running the seed sets that password on the four demo accounts, even if they already exist.

## 6. Remaining work

Remaining tasks are tracked as GitHub issues, grouped into milestones:

| Milestone | Task |
|---|---|
| Fulfilment and Returns Completion | Add the Tag Loop verification screen to return inspection |
| Fulfilment and Returns Completion | Record opening stock in the inventory ledger when a product is created |
| Quality, Testing and Security | Fix the test data so all 14 Vitest tests pass on a freshly seeded test database |
| Quality, Testing and Security | Fix ESLint errors so `npm run lint` passes |
| Quality, Testing and Security | Rename `middleware.ts` to the Next.js 16 `proxy` convention and fix the other build/config warnings |
| Accounts and Integrations | Implement forgot-password (reset by email) |
| Accounts and Integrations | Replace simulated email and payment with real providers |
| Accounts and Integrations | Add a courier integration, or a clearer manual courier workflow |
| Amazon Integration Preparation | Prepare the Amazon SP-API connection (registration, connector design, mock connector) |
