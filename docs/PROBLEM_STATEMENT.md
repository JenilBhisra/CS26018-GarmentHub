# Problem Statement

**Project:** GarmentHub — Garment Store and Inventory Management System
**Subject:** SGP / Project-I (CEUP301), Semester V
**Team ID:** CS26018
**Student:** Jenil Bhisra (24CS010)

## 1. Background

Small and medium garment sellers sell many versions of the same item. One shirt design in 5 sizes and 4 colours is already 20 different stock items (SKUs), and each one needs its own stock count, price and packing check.

Many small sellers manage this with spreadsheets, paper notes and the separate seller panels of each marketplace. This causes everyday problems:

- **Wrong stock figures.** Stock is updated by hand, so the shown quantity often does not match what is on the shelf. This leads to overselling or lost sales.
- **Packing mistakes.** When many orders are packed together, it is easy to pick the wrong size or colour. The customer then returns the item, and the seller pays for shipping both ways.
- **No record of why stock changed.** A spreadsheet shows the current number but not whether it changed because of a sale, a cancellation, a return or a correction.
- **Paperwork for every order.** Shipping labels, tax invoices and pick lists are prepared by hand or downloaded from different places.
- **Returns are hard to verify.** Sellers find it difficult to prove whether the returned item is the same one they sent.
- **Selling on several channels multiplies the work.** A seller on their own website and on marketplaces such as Amazon has to repeat product, stock and order work in each place.

## 2. Problem statement

> Small garment sellers do not have one simple system to manage a size- and colour-wise product catalogue, keep stock accurate with a clear history, process and pack orders without mistakes, produce shipping documents, and verify returns. They depend on manual and scattered tools, which cause stock errors, wrong shipments and extra work.

## 3. Proposed solution

GarmentHub is a web application with an online garment store and a seller back office:

- A product catalogue where each product has variants with SKU, size, colour, MRP, selling price and stock.
- An inventory ledger that records the reason for each stock change, such as a sale, cancellation, return restock or manual adjustment.
- Order management with clear stages: New, Packed, Ready to Ship and Shipped.
- **Scan and Pack:** orders are grouped into a Pack Log. The packer scans each item's SKU, so the system stops wrong or extra items from being packed. A Tag Loop number can be recorded for each item.
- Shipping label, tax invoice and shipping list generation.
- Returns handling with rules that decide who is responsible for a return, and an admin refund process backed by a financial ledger.
- Dashboards and reports for the seller and the admin.
- A database design that already has "sales channels", so marketplaces such as Amazon can be connected later.

## 4. Objectives

1. Build a garment catalogue that supports sizes, colours and SKU-level stock.
2. Keep a history of stock changes so that every sale, cancellation, return restock and manual adjustment can be traced.
3. Provide an order workflow from new order to dispatch, with bulk actions for sellers.
4. Lower packing errors with SKU scanning against the order contents.
5. Generate shipping labels with barcodes, tax invoices and shipping lists from order data.
6. Support returns with verification and a clear refund process.
7. Give sellers and admins dashboards with sales, stock and return information.
8. Prepare the data model for future marketplace integration, starting with Amazon.

## 5. Users

| User | Main needs |
|---|---|
| Customer | Browse garments, choose size and colour, order, track orders, request returns |
| Seller | Manage products and stock, process and pack orders, print documents, handle returns, view reports |
| Admin | Approve sellers (KYC), moderate products, supervise orders, returns, refunds and payouts, view platform reports |
| B2B Vendor / buyer | Bulk buying through requests for quotation (an older module that is still in the codebase) |

## 6. Scope

**In scope for this project:**

- Web application for customer, seller and admin
- Product catalogue with variants (size, colour, SKU)
- Inventory ledger
- Order management, Pack Logs, Scan and Pack, dispatch
- Shipping label, invoice and shipping list generation
- Returns, refund rules and Tag Loop verification
- Seller and admin dashboards and reports
- Database preparation for sales channels (Amazon and others)

**Out of scope for now (future work):**

- Live connection to Amazon, Flipkart or other marketplaces. These APIs need developer registration and seller approval.
- Online payment gateway. Checkout currently supports Cash on Delivery and manual payment only.
- Courier company API integration. Courier name and tracking number are entered by hand.
- Real email or SMS sending. Emails are currently simulated.
- Password reset by email. The forgot-password page is currently a placeholder.
- Multiple warehouses and bin locations.

## 7. Expected outcome

A working web application where a seller can list garments with sizes and colours, keep accurate stock with a history, process and pack orders with scanning, print shipping documents, dispatch orders and handle returns from one place. The project should also leave a clear base for future marketplace integration.
