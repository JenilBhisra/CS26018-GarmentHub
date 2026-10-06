# Project Timeline

**Project:** GarmentHub — Garment Store and Inventory Management System (Team CS26018)

> **Important: this is a retrospective reporting breakdown.**
> The weekly stages below show how the work was divided for our weekly progress reports (Week 3 to Week 9). They were written after the work was done, by matching each reporting stage to the code that exists now.
> They are **not** proof of weekly GitHub activity. Much of the work was done locally and committed in a few large commits (see Section 2). Report dates are left blank where we do not know them.

## 1. Weekly reporting stages

Status key: **Done** = working code exists. **Partial** = some parts are missing. **In progress** = still being worked on.

| Week | Reporting stage | Report date | Main work covered | Evidence in the repository | Status |
|---|---|---|---|---|---|
| 3 | Requirements and workflow planning | | Problem study, user roles, order/pack/return workflow study from an existing order management tool | `proposal.md`, `CLAUDE.md` (requirements and workflow notes), [docs/REQUIREMENTS.md](REQUIREMENTS.md) | Done |
| 4 | Project structure, database design and user access | | Next.js project structure, PostgreSQL + Prisma schema, login and registration, roles, protected routes, seller KYC | `app/` route groups, `prisma/schema.prisma`, `auth.ts`, `middleware.ts`, `actions/kyc.ts` | Done |
| 5 | Product catalogue, sizes, colours and inventory | | Categories, products, variants (SKU, size, colour, MRP, price, stock), seller product form, inventory ledger | `Product` / `ProductVariant` / `InventoryTransaction` models, `actions/products.ts`, `actions/bulk.ts`, `app/(seller)/seller/products/` | Done (see notes) |
| 6 | Order management and seller dashboard | | Checkout and order creation, seller order tabs, bulk status updates, seller dashboard | `actions/orders.ts`, `lib/order-tabs.ts`, `app/(seller)/seller/orders/`, `app/(seller)/seller/page.tsx` | Done |
| 7 | Scan and Pack, packing logs, shipping documents and dispatch | | Pack Logs, SKU scanning, temporary bins, Tag Loop number at packing, label + invoice PDF, shipping list, Ready to Ship, confirm shipment | `actions/packlogs.ts`, `actions/scan-pack.ts`, `actions/documents.tsx`, `app/(seller)/seller/pack-logs/`, `app/api/orders/documents/route.ts` | Done (Pack Log test and script passed on 6 Oct 2026) |
| 8 | Returns verification and dashboard reporting | | Return requests, return rules, refunds with financial ledger, Tag Loop verification logic, seller/admin reports and analytics | `actions/returns.ts`, `lib/shipping.ts`, `actions/ledger.ts`, `actions/analytics.ts`, `actions/returns-report.ts`, report pages | Partial (Tag Loop verification has no screen yet) |
| 9 | Testing, fixes and Amazon integration preparation | | Vitest tests, test configuration fixes, Prisma migrations, sales channel models | `actions/*.test.ts`, `vitest.config.ts`, `scripts/test-*.ts`, `prisma/migrations/`, `SalesChannel` / `SellerChannelAccount` / `ChannelListing` models | In progress |

### Notes per stage

- **Week 5:** opening stock entered when a product is first created is not yet written to the inventory ledger. Later changes (sales, cancellations, return restocks, edits and bulk updates) are recorded.
- **Week 7:** courier name and tracking number are typed in by the seller. There is no courier company API.
- **Week 8:** `verifyTagLoop()` and `getReturnRequestDetail()` exist in `actions/returns.ts`, but no page uses them yet.
- **Week 9:**
  - 4 Vitest test files with 14 tests and 3 manual test scripts exist.
  - On 6 October 2026, on a separate test database: 9 of 14 tests passed, and the 5 failures need test data the seed does not create. All 3 manual scripts passed. Details are in [CURRENT_STATUS.md](CURRENT_STATUS.md).
  - `npm run lint` currently fails.
  - Amazon preparation is **database design only**. There is no Amazon API code and no SP-API registration.
- **Completion estimate:** the Week 9 report estimated about 75% completion. This is an estimate. [CURRENT_STATUS.md](CURRENT_STATUS.md) explains how it compares with the code.

## 2. Actual Git history

### 2.1 This repository

This repository was created on **6 October 2026** from a clean copy of the project for submission. Its commits were made on that day with the actual date. They group the existing files by type (repository setup, configuration, database, application code, tests, documentation). They do **not** show when the work was originally done.

The earlier development history was deliberately **not imported**. That history contains files that should not be published, such as personal test uploads.

### 2.2 Earlier development history (not imported)

The project was first developed in a separate local Git repository. For reference, its commits were (dates are commit dates):

| # | Date | Message |
|---|---|---|
| 1 | 2026-06-24 | Initial commit from Create Next App |
| 2 | 2026-06-24 | Initial marketplace frontend |
| 3 | 2026-06-24 | Phase 2 - Prisma schema and database foundation |
| 4 | 2026-06-24 | Phase 3 - Authentication and role based access |
| 5 | 2026-06-25 | Fix NextAuth admin login and redirect flow |
| 6 | 2026-06-25 | Complete Phase 7 KYC verification system |
| 7 | 2026-06-26 | Complete Phase 15 production hardening |
| 8 | 2026-08-10 | Phase 0 stabilization: financial ledger, returns/disputes, market intelligence, admin ops |

The "Phase" numbers in these messages come from an earlier internal plan. They do not match the Week 3–9 reporting stages above.

**Work that was never committed in the earlier repository:** the Pack Logs, Scan and Pack, shipping documents, Tag Loop, inventory ledger, sales channel models, Prisma migrations and related tests were developed locally after the last of these commits (10 August 2026) but not committed there. The Prisma migration folders carry timestamps from 16 August 2026, which Prisma generated when the migrations were created. This work first appears in Git in this repository, with October 2026 commit dates.

**Changes made during submission preparation (6 October 2026):** the demo-account password was moved from source code into the `SEED_TEST_PASSWORD` environment variable, logging of Server Function arguments (which could include passwords) was turned off, a guard was added so tests only run on a separate `_test` database, and the documentation in `docs/` was written. No commits were backdated.

## 3. Next stages (planned)

These are planned and have not started. Dates are not fixed. Each is tracked as a GitHub milestone with issues.

| Stage | Planned work |
|---|---|
| Fulfilment and Returns Completion | Tag Loop verification screen for returns, opening-stock ledger entry |
| Quality, Testing and Security | Fix test data so all tests pass, make `npm run lint` pass, follow the Next.js 16 `proxy` file convention |
| Accounts and Integrations | Forgot-password, real email and payment providers, courier integration |
| Amazon Integration Preparation | SP-API developer registration, connector interface and mock connector, first read-only order import after approval |
