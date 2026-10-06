# GarmentHub — Garment Store and Inventory Management System

GarmentHub is a web application for small garment sellers. It combines an online garment store with the back-office tools a seller needs every day: a product catalogue with sizes and colours, stock (inventory) tracking, order processing, Scan and Pack, shipping documents, dispatch, and returns.

The aim is to replace spreadsheets and manual stock counting with one system, and to lower packing mistakes such as sending the wrong size or colour.

> **Project status:** Work in progress. The team's Week 9 report estimated about **75% completion**. This is an estimate, not a measured figure. See [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md) for what is done, what is partial and what is still planned.

## Project details

| Item | Details |
|---|---|
| Project | GarmentHub — Garment Store and Inventory Management System |
| Subject | SGP / Project-I (CEUP301) |
| Semester | V |
| Team ID | CS26018 |
| Student | Jenil Bhisra (24CS010) |

## Documents

| Document | What it contains |
|---|---|
| [Problem Statement](docs/PROBLEM_STATEMENT.md) | The problem, objectives, users and scope |
| [Literature Survey](docs/LITERATURE_SURVEY.md) | Comparison with existing systems, with references |
| [Requirements](docs/REQUIREMENTS.md) | Functional and non-functional requirements, with status |
| [Project Timeline](docs/PROJECT_TIMELINE.md) | Week 3 to Week 9 reporting stages and actual Git history |
| [Current Status](docs/CURRENT_STATUS.md) | Implemented, partial and planned features, check results, remaining work |

## Technology stack

These are the technologies actually used in the code (see `package.json`).

| Area | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, Turbopack) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4, Radix UI components, Lucide icons |
| Charts | Recharts |
| Forms and validation | React Hook Form, Zod |
| Database | PostgreSQL |
| ORM and migrations | Prisma 6 |
| Login and roles | Auth.js (NextAuth v5 beta): email/password and optional Google sign-in, JWT sessions, bcrypt password hashing |
| Documents | `@react-pdf/renderer` (label and invoice PDFs), `bwip-js` (Code 128 barcodes and QR codes), `xlsx` (shipping list) |
| Testing | Vitest (database-backed tests), plus manual ts-node scripts |
| Code quality | ESLint 9 with `eslint-config-next` |

## Main features

Status labels: **Done** = working code exists, **Partial** = some parts missing, **Planned** = not built yet. Details are in [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md).

| Feature | Status |
|---|---|
| User registration and login with roles (Customer, Seller, B2B Vendor, Admin) | Done |
| Role-based page protection (`middleware.ts`) | Done |
| Seller onboarding with KYC document upload and admin approval | Done |
| Product catalogue with categories, variants, SKU, size, colour, MRP, price and stock | Done |
| Inventory ledger: sales, cancellations, return restocks and manual stock adjustments are recorded with a reason | Done |
| Customer store: browse, search, product page, cart, wishlist, checkout (COD / manual payment) | Done |
| Seller order management with tabs (New, Packed, Ready to Ship, Cancelled) and bulk actions | Done |
| Seller dashboard (net units sold, low stock, orders to ship) | Done |
| Pack Logs and Scan and Pack (scan SKU, temporary bins, Tag Loop number) | Done (Pack Log test and script passed on 6 Oct 2026) |
| Shipping documents: shipping label + tax invoice PDF with barcode/QR, shipping list (Excel) | Done |
| Dispatch: mark Ready to Ship, confirm shipment with courier and tracking number | Done (manual courier entry) |
| Returns and refunds with rule-based responsibility and a double-entry financial ledger | Done |
| Tag Loop check on returned items | Partial (server logic only, no screen yet) |
| Reports and analytics for seller and admin | Done |
| Sales channel data model (GarmentHub, and later Amazon and others) | Partial (database only) |
| Live Amazon integration | Planned (no API connection exists) |
| Forgot password / password reset | Planned (the page is a placeholder) |
| Online payment gateway (Razorpay) | Planned (placeholder only) |
| Real email sending | Planned (emails are printed to the console) |
| Opening stock recorded in the inventory ledger when a product is created | Planned |

The codebase also has other modules from earlier phases (B2B requests for quotation, chat, coupons and promotions, reviews and Q&A, disputes, seller wallet and payouts, market intelligence). They are listed in [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md).

## Setup (local development)

### Prerequisites

- Node.js 20 or newer (developed with Node.js 25)
- npm (comes with Node.js)
- PostgreSQL (developed with PostgreSQL 18)

### Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/JenilBhisra/CS26018-GarmentHub.git
   cd CS26018-GarmentHub
   ```

2. **Install dependencies and generate the Prisma client** (uses the committed `package-lock.json`)

   ```bash
   npm ci
   npx prisma generate
   ```

   `npx prisma generate` is required. It does not run automatically after `npm ci`.

3. **Create your environment file**

   ```bash
   cp .env.example .env
   ```

   Open `.env` and fill in:
   - `DATABASE_URL`: your local PostgreSQL database for the app
   - `AUTH_SECRET`: any long random string, for example from `openssl rand -base64 32`
   - `SEED_TEST_PASSWORD`: a password of your choice for the demo accounts (required by the seed; there is no default)
   - `TEST_DATABASE_URL`: a **separate** database for tests, whose name must end in `_test`

   Google sign-in is optional. Never commit `.env`.

4. **Create an empty PostgreSQL database**, for example `garmenthub`.

5. **Create the tables** from the committed migrations

   ```bash
   npx prisma migrate deploy
   ```

   > If your database was created earlier with `prisma db push`, before the `prisma/migrations` folder existed, mark the baseline as already applied first: `npx prisma migrate resolve --applied 20260816080000_baseline`. Then run `npx prisma migrate deploy`.

6. **Add demo data** (categories, demo stores, products and one demo account per role)

   ```bash
   npx prisma db seed
   ```

   Demo accounts: `admin@garmenthub.local`, `seller@garmenthub.local`, `customer@garmenthub.local` and `b2b@garmenthub.local`. They all use the password you set in `SEED_TEST_PASSWORD`. **Running the seed again sets this password on these accounts, even if they already exist.** Use demo accounts only on a local database.

7. **Start the app**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

## Running the tests

The tests create, change and delete real database rows. To protect your normal data, they **only run against a separate database whose name ends in `_test`**, set in `TEST_DATABASE_URL`. If this is missing or wrongly named, the tests stop before connecting.

```bash
# one-time setup of the test database (example name: garmenthub_test)
DATABASE_URL="<your TEST_DATABASE_URL>" npx prisma migrate deploy
DATABASE_URL="<your TEST_DATABASE_URL>" npx prisma db seed

# run the tests
npm test
```

(On Windows PowerShell, set the variable first with `$env:DATABASE_URL="..."` and then run the command.)

The latest results are in [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md): on a freshly seeded test database, 9 of 14 tests pass. The other 5 need test data that the seed does not create yet.

## Available commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint (currently reports errors, see Current Status) |
| `npm test` | Run the Vitest tests against `TEST_DATABASE_URL` (see "Running the tests") |
| `npx prisma validate` | Check the database schema file |
| `npx prisma generate` | Regenerate the Prisma client after schema changes |
| `npx prisma migrate deploy` | Apply committed migrations to a database |
| `npx prisma migrate dev --name <change>` | Create a new migration during development (local database only) |
| `npx prisma db seed` | Load demo data (needs `SEED_TEST_PASSWORD`) |
| `npx ts-node -r tsconfig-paths/register -P tsconfig.test.json scripts/test-pack-fulfillment.ts` | Manual end-to-end check of Pack Log / Scan and Pack / Tag Loop on the seeded **test** database. `scripts/test-financials.ts` and `scripts/test-marketplace-integration.ts` run the same way. **These scripts reset wallets and delete transaction data**, so they also refuse to run unless `TEST_DATABASE_URL` ends in `_test`. |

## Folder structure

```
app/            Pages and API routes (Next.js App Router)
  (store)/      Customer-facing store: home, category, product, cart, checkout, login
  (account)/    Customer account: orders, returns, wishlist, profile
  (seller)/     Seller portal: dashboard, products, orders, pack logs, returns, reports
  (admin)/      Admin console: sellers, KYC, orders, returns, settlements, reports
  api/          API routes (auth, order documents, uploads, export, health)
actions/        Server Actions (business logic) and *.test.ts Vitest tests
components/     Shared UI components
lib/            Helpers: Prisma client, shipping rules, rate limiting, order tabs
prisma/         schema.prisma, migrations/, seed.ts
scripts/        Manual integration test scripts and test mocks
docs/           Project documentation for submission
```

`CLAUDE.md` and `AGENTS.md` hold project handover notes and instructions written for AI coding assistants used during development. `proposal.md` is the earlier project proposal.

## Git workflow (branches and pull requests)

After the first upload, all changes go through branches and pull requests:

1. Pick or open a GitHub issue for the task.
2. Update `main` and create a branch named after the issue:
   ```bash
   git checkout main
   git pull
   git checkout -b feature/<issue-number>-short-name   # use fix/... for bug fixes
   ```
3. Make small commits with clear messages, for example `Add Tag Loop check screen for returns`.
4. Before pushing, run `npm run build`, and `npm test` if a database is available.
5. Push the branch and open a pull request into `main`. Write `Closes #<issue-number>` in the description so the issue closes on merge.
6. Review the changes on GitHub (check that no `.env`, uploads or screenshots are included), then merge.

Never commit `.env`, uploaded files (`public/uploads`, `kyc-documents`), database dumps, or screenshots that show real customer data.

## Notes

- **About this repository:** it was created on 6 October 2026 from a clean copy of the project for submission. Earlier development history, uploaded test files and private reference material were deliberately not imported. See [docs/PROJECT_TIMELINE.md](docs/PROJECT_TIMELINE.md).
- **Amazon and other marketplaces:** the database has tables for sales channels and channel listings. There is no live connection to Amazon or any other marketplace. Amazon's Selling Partner API needs developer registration and seller authorisation first (see [Literature Survey](docs/LITERATURE_SURVEY.md)).
- **Reference screenshots:** workflow ideas such as Pack Logs, Tag Loop and order tabs were studied from screenshots of an existing order management tool. Those screenshots are not in this repository because they contain real buyer and order details.
