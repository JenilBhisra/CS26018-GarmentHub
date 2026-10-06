You are joining an existing software project through Antigravity.

You currently have access only to the existing working folder and source code. You have no previous knowledge of the project’s original problem statement, business goals, completed phases, architectural decisions, or recent change in direction.

This message is the complete initial project handover.

============================================================
1. YOUR ROLE
============================================================

Act as all of the following:

1. Senior SaaS Product Architect
2. Senior Full-Stack Engineer
3. E-commerce Operations Specialist
4. OMS/WMS Solution Architect
5. Database and Integration Architect
6. UI/UX Product Designer
7. Security and Multi-Tenant SaaS Reviewer
8. Technical Project Manager
9. Critical Product Consultant

You are not expected to blindly follow every idea written below.

You are explicitly free to:

- Recommend better approaches.
- Point out weak or unrealistic requirements.
- Suggest features we have not considered.
- Recommend removing unnecessary existing features.
- Suggest redesigning workflows.
- Suggest different technical architecture.
- Recommend third-party services where building internally is inefficient.
- Identify API, legal, security, scalability, marketplace-policy or business limitations.
- Propose phased MVP, production and enterprise roadmaps.
- Compare our proposed system with established OMS platforms.
- Challenge our assumptions respectfully.

We would genuinely appreciate recommendations and constructive changes.

However, do not make destructive changes without approval.

============================================================
2. CRITICAL WORKING RULES
============================================================

Before editing code, you must first inspect the complete repository and understand the current system.

Do not immediately start coding.

Do not assume this is a fresh project.

Do not delete, rename or rewrite large parts of the application before understanding dependencies.

Do not discard completed work merely because the project goal has changed.

Do not run destructive database commands without explaining their effects.

Do not reset, drop or clear the existing database.

Do not expose or overwrite environment secrets.

Do not replace the current authentication system without a strong technical reason.

Do not invent marketplace API capabilities.

Marketplace capabilities, API eligibility and restrictions must eventually be verified against official documentation.

Before implementing any major change, first provide:

1. Repository audit
2. Existing architecture summary
3. Current features inventory
4. Database model analysis
5. Reusable versus replaceable components
6. Technical debt and risk report
7. Gap analysis
8. Recommended target architecture
9. Phased implementation plan
10. List of decisions requiring owner approval

Only begin implementation after I approve the plan.

============================================================
3. ORIGINAL PROJECT DIRECTION
============================================================

The project originally began as a broad garment marketplace and seller-management platform.

The repository may currently contain features such as:

- Customer-facing marketplace
- Seller onboarding
- Seller dashboard
- Admin dashboard
- Product listings
- Categories and variants
- Inventory-related functionality
- Orders
- Returns and refunds
- Payments
- Seller analytics
- Admin analytics
- Market intelligence
- Forecasting
- Seller intelligence
- Reporting
- Audit logs
- System logs
- Background jobs
- Rate limiting
- Database backup utilities
- Notification-related functions
- Permission and role handling
- Shipping-related features
- Seller account health indicators
- Other advanced modules added during previous development phases

Treat this list as historical context, not confirmed repository truth.

You must inspect and verify exactly what exists.

Some modules may be partially implemented, mocked, duplicated, disconnected, incomplete or only UI-level.

============================================================
4. MAJOR CHANGE IN PRODUCT DIRECTION
============================================================

The product goal has now changed significantly.

We no longer want the system to be mainly a standalone garment marketplace.

The new primary goal is to build a common multi-channel e-commerce operations platform where sellers can connect and manage their external marketplace seller accounts from one place.

Examples of channels include:

- Amazon
- Flipkart
- Meesho
- Myntra
- Our own website/storefront
- Additional marketplaces and commerce channels in the future

The platform should eventually work as a combination of:

- Multi-channel listing platform
- Product Information Management system
- Inventory Management System
- Order Management System
- Warehouse Management System
- Shipping operations platform
- Returns and refund management system
- Finance and reconciliation reporting platform
- Seller analytics platform
- Admin supervision platform

The platform should become the operational control centre.

External marketplaces should be treated as connected sales channels.

Conceptually:

Seller
  |
  v
Our Unified Platform
  |
  +-- Amazon
  +-- Flipkart
  +-- Meesho
  +-- Myntra
  +-- Own Website
  +-- Future Channels

============================================================
5. CORE BUSINESS PROBLEM
============================================================

Multi-channel sellers currently need to:

- Log in separately to each marketplace.
- Create the same product repeatedly.
- Maintain different marketplace-specific listing details.
- Manually synchronize stock.
- Process orders through separate dashboards.
- Download labels and invoices from different portals.
- Track packed and dispatched orders separately.
- Manage returns across channels.
- Calculate fees, taxes and settlement differences manually.
- Compare sales and returns using multiple reports.
- Monitor account health separately.
- Risk overselling because inventory is not synchronized.
- Maintain inconsistent SKUs and product data.
- Spend excessive time on repetitive operations.

Our platform should reduce this fragmentation by creating one unified operating system for sellers.

============================================================
6. CORE PRODUCT VISION
============================================================

A seller should be able to:

1. Register on our platform.
2. Create their organisation or business workspace.
3. Connect marketplace accounts through approved integrations.
4. Import existing listings, SKUs, orders and inventory where permitted.
5. Create or edit a central master product.
6. Select the marketplaces where that product should be published.
7. Enter marketplace-specific required information.
8. Publish to selected channels through their APIs.
9. Monitor listing success, failure or pending review.
10. Manage stock from one central inventory system.
11. Receive orders from all connected channels.
12. Accept, pack, label, dispatch and track orders.
13. Handle cancellations, returns and refunds.
14. Download documents and reports.
15. View consolidated analytics.
16. View marketplace-specific analytics.
17. Monitor account health, return rate, revenue and profitability.
18. Manage operations without repeatedly visiting every external portal.

============================================================
7. IMPORTANT MARKETPLACE API REALITY
============================================================

Do not assume every marketplace permits every operation.

For each marketplace, investigate and later document:

- Whether official seller APIs exist.
- Partner or developer approval requirements.
- OAuth or credential model.
- Listing creation support.
- Listing update support.
- Category and attribute APIs.
- Inventory APIs.
- Order APIs.
- Shipping and label APIs.
- Invoice APIs.
- Return and refund APIs.
- Settlement APIs.
- Advertising APIs.
- Analytics availability.
- Webhook/event support.
- Rate limits.
- Regional restrictions.
- Seller eligibility restrictions.
- Certification or partner-program requirements.

Design the software using an adapter-based architecture so channels can have different capabilities.

The system must not assume that all marketplaces implement an identical workflow.

For example:

interface MarketplaceConnector {
  authenticate()
  refreshCredentials()
  testConnection()

  importListings()
  createListing()
  updateListing()
  archiveListing()

  fetchCategories()
  fetchAttributes()
  validateListing()

  getInventory()
  updateInventory()

  getOrders()
  acceptOrder()
  cancelOrder()

  getShippingDocuments()
  createShipment()
  confirmDispatch()

  getReturns()
  getSettlements()
  getAccountHealth()

  handleWebhook()
}

This interface is only conceptual.

Recommend a more appropriate implementation based on the repository’s language and architecture.

Every connector must declare supported capabilities.

Example:

AMAZON:
- listing.create = true
- shipping.labelDownload = depends on fulfilment model
- orders.accept = depends on API workflow

MYNTRA:
- capabilities must be verified
- may require partner-level access

MEESHO:
- capabilities must be verified

FLIPKART:
- capabilities must be verified

The UI must hide or disable operations that a connected channel does not support.

============================================================
8. MULTI-TENANT SAAS REQUIREMENT
============================================================

The platform should be designed as a secure multi-tenant SaaS product.

Possible hierarchy:

Platform
  |
  +-- Organisation / Tenant
        |
        +-- Owner
        +-- Admin
        +-- Manager
        +-- Warehouse Staff
        +-- Accountant
        +-- Analyst
        +-- Support User
        |
        +-- Marketplace Accounts
        +-- Warehouses
        +-- Products
        +-- Orders
        +-- Inventory
        +-- Reports

Requirements:

- Every business record must be tenant-scoped.
- One tenant must never access another tenant’s data.
- Server-side authorization must be enforced.
- UI restrictions alone are insufficient.
- Marketplace credentials must be encrypted.
- Sensitive tokens must never be stored in plain text.
- Access tokens and refresh tokens require lifecycle management.
- Credential refresh failures must be surfaced.
- Every sensitive action should be auditable.
- Consider role-based permissions.
- Consider warehouse-level permissions.
- Consider marketplace-account-level permissions.
- Consider maker-checker approval for sensitive operations.

First verify whether the current data model is already tenant-safe.

============================================================
9. MARKETPLACE ACCOUNT CONNECTION MODULE
============================================================

Create or redesign a dedicated Integrations / Sales Channels module.

Potential user flow:

1. Open Sales Channels.
2. Click Connect Marketplace.
3. Select Amazon, Flipkart, Meesho, Myntra or another channel.
4. View required prerequisites.
5. Authenticate through OAuth or approved credential flow.
6. Select region, seller account and marketplace.
7. Run connection test.
8. Show status:
   - Connected
   - Action required
   - Token expiring
   - Expired
   - Sync failed
   - Rate limited
   - Disconnected
9. Select synchronization options.
10. Start initial import.

Each connection should include:

- Tenant
- Marketplace
- Region
- External seller/account ID
- Display name
- Authentication state
- Encrypted credentials
- Token expiry
- Granted permissions
- Connector version
- Sync settings
- Last successful sync
- Last failed sync
- Error summary
- Connection health
- Enable/disable status

Support multiple accounts of the same marketplace if technically possible.

Example:

- Amazon India account
- Amazon USA account
- Two Flipkart seller accounts
- Separate brand accounts

============================================================
10. CENTRAL PRODUCT CATALOG
============================================================

The platform needs one central product catalogue.

Distinguish between:

1. Product
2. Variant
3. SKU
4. Channel Listing
5. Channel Offer
6. Inventory Item
7. Bundle/Kit, if supported

A central product may contain:

- Product name
- Brand
- Description
- Base category
- Internal category
- Images
- Video
- HSN code
- GST rate
- Country of origin
- Manufacturer details
- Material
- Colour
- Size
- Style
- Gender
- Season
- Search tags
- Dimensions
- Weight
- Package dimensions
- Package weight
- Cost price
- MRP
- Selling price
- Tax rules
- Warranty
- Return eligibility
- Internal notes
- Status
- Variants
- SKUs

For garments, attributes vary by category.

Examples:

Shirts:
- fit
- sleeve
- collar
- fabric
- pattern
- size

Pants:
- waist
- inseam
- fit
- rise
- material

Kurtis:
- neck type
- sleeve
- fabric
- pattern
- occasion
- length

The product form must be category-aware and dynamic.

Do not build one oversized static form containing every possible field.

============================================================
11. MULTI-CHANNEL LISTING WORKFLOW
============================================================

This is one of the most important features.

Desired workflow:

1. Seller creates a master product in our platform.
2. Seller selects channels using checkboxes or channel cards.
3. Example selection:
   - Amazon checked
   - Myntra checked
   - Meesho checked
   - Flipkart unchecked
4. System shows channel-specific requirements.
5. Seller maps internal category to each marketplace category.
6. Seller completes missing marketplace-specific attributes.
7. System validates listing data.
8. Seller previews listing per marketplace.
9. Seller publishes.
10. Background jobs submit listings to selected channels.
11. Each channel receives an independent result:
    - Draft
    - Validation failed
    - Queued
    - Submitted
    - Processing
    - Published
    - Rejected
    - Suppressed
    - Update failed
    - Archived
12. Errors must be actionable.
13. Retrying one channel must not republish all channels.

We need a clear separation between:

- Central master product data
- Channel-specific overrides
- Channel listing status
- External listing IDs
- Channel-specific price
- Channel-specific inventory rules
- Channel-specific images
- Category mappings
- Attribute mappings
- Validation errors
- Publication attempts

Avoid storing marketplace-specific information directly inside one large Product table.

============================================================
12. CATEGORY AND ATTRIBUTE MAPPING
============================================================

A serious multi-channel platform needs mapping infrastructure.

Required concepts:

- Internal category taxonomy
- Marketplace category taxonomy
- Category mapping
- Marketplace attribute definition
- Internal attribute definition
- Attribute value mapping
- Required versus optional fields
- Allowed values
- Units
- Validation rules
- Dependency rules
- Region-specific differences

Example:

Internal category:
Men > Clothing > Shirts

Amazon category:
Shirts

Flipkart category:
Men's Shirts

Myntra category:
Apparel > Topwear > Shirts

The seller should not repeatedly map the same category.

Provide reusable mapping templates.

However, seller overrides may be required.

============================================================
13. PRODUCT IMPORT AND MATCHING
============================================================

Sellers may already have hundreds or thousands of listings.

The system should eventually support:

- Import from connected marketplace.
- Import from CSV/Excel.
- Bulk product creation.
- Existing listing import.
- SKU matching.
- Duplicate detection.
- Merge suggestions.
- Unmatched listing queue.
- Parent-child variation detection.
- Mapping external SKU to internal SKU.
- Conflict resolution.

Do not automatically merge records only because titles are similar.

Possible match signals:

- Exact SKU
- GTIN/EAN/UPC
- Brand
- Model number
- Variant combination
- External listing ID
- Seller-confirmed mapping

============================================================
14. INVENTORY MANAGEMENT
============================================================

Inventory must be treated as a ledger, not merely a quantity field.

Possible stock values:

- Physical stock
- Available stock
- Reserved stock
- Packed stock
- Damaged stock
- Return-pending stock
- Quality-check stock
- In-transit stock
- Safety stock
- Channel allocation
- Incoming stock

Conceptually:

Available =
Physical
- Reserved
- Packed
- Damaged
- Safety Stock
- Other Holds

Every inventory movement should create a transaction.

Examples:

- Purchase stock received
- Manual adjustment
- Order reservation
- Order cancellation release
- Pack confirmation
- Dispatch deduction
- Customer return received
- Return quality approved
- Return damaged
- Stock transfer
- Reconciliation correction

Requirements:

- Warehouse-level inventory
- SKU-level inventory
- Variant-level inventory
- Inventory ledger
- Adjustment reason
- User who performed adjustment
- Timestamp
- External source
- Idempotency reference
- Before and after quantity
- Audit trail

============================================================
15. MULTI-CHANNEL INVENTORY SYNCHRONIZATION
============================================================

The platform should prevent overselling.

When stock changes:

1. Central inventory is recalculated.
2. Channel allocation rules are applied.
3. Updates are queued for connected marketplaces.
4. Each marketplace result is logged.
5. Failures are retried.
6. Persistent failures generate alerts.

Possible allocation models:

- Shared inventory across all channels
- Fixed quantity by channel
- Percentage allocation
- Priority-based allocation
- Marketplace-specific buffer
- Warehouse-specific availability
- Maximum published quantity
- Safety stock

Example:

Physical stock = 20
Safety stock = 2
Amazon cap = 10
Flipkart cap = 8
Meesho cap = 5

Do not blindly publish 18 units to every marketplace.

Handle race conditions where simultaneous orders arrive from multiple channels.

Use idempotency, locking or transactional inventory reservation.

Recommend the best approach based on the current technology stack.

============================================================
16. UNIFIED ORDER MANAGEMENT
============================================================

Orders from all connected channels should appear in one dashboard.

Each order should preserve:

- Internal order ID
- Marketplace
- External order ID
- Marketplace account
- Customer details where legally/API permitted
- Order lines
- SKU
- Quantity
- Price
- Tax
- Discounts
- Shipping charge
- Payment method
- COD/prepaid status
- Fulfilment type
- Shipping address where permitted
- Billing address where permitted
- Order timestamps
- SLA deadlines
- Marketplace status
- Internal status
- Warehouse
- Return status
- Settlement status

Do not overwrite marketplace status with internal warehouse status.

Maintain both.

============================================================
17. ORDER TABS FROM THE REFERENCE WORKFLOW
============================================================

The desired order interface includes tabs or filters such as:

- New Orders
- Accepted Orders
- Packed
- Ready to Ship
- Dispatched
- Cancelled
- Returned
- All Orders
- Failed/Exception Orders, if needed

Exact names may change based on better UX recommendations.

The status model should be carefully designed.

Possible internal lifecycle:

NEW
→ ACCEPTED
→ ALLOCATED
→ PICKING
→ PACKING
→ PACKED
→ READY_TO_SHIP
→ DISPATCHED
→ IN_TRANSIT
→ DELIVERED

Exception states:

- CANCELLED
- ON_HOLD
- ADDRESS_ISSUE
- INVENTORY_SHORTAGE
- LABEL_FAILED
- SHIPMENT_FAILED
- RETURN_REQUESTED
- RETURN_IN_TRANSIT
- RETURN_RECEIVED
- REFUNDED

Not every marketplace follows the same state transitions.

Use marketplace adapters to map external states to internal normalized states.

============================================================
18. NEW ORDER ACCEPTANCE FLOW
============================================================

Reference workflow from the handwritten notes:

1. New marketplace orders arrive in New Orders.
2. User selects one or multiple orders.
3. User clicks Accept Orders.
4. Confirmation modal appears:
   “Are you sure you want to accept the selected orders?”
5. After confirmation, accepted orders move to the next stage.
6. Inventory is reserved.
7. SLA and warehouse assignment are updated.
8. The action is logged.
9. Marketplace acknowledgement is sent where supported.

This should support bulk operations.

Failures should be handled per order.

Example:

- 8 accepted successfully
- 1 failed due to inventory
- 1 failed because marketplace status changed

Do not make the entire batch fail because one order failed.

============================================================
19. PACK ORDER WORKFLOW
============================================================

Reference workflow:

1. User selects accepted/new orders that are eligible for packing.
2. User clicks Pack Orders.
3. Confirmation modal appears.
4. Orders move into packing.
5. User can download required documents.
6. After successful packing, orders move into Packed.

Potential documents:

- Shipping label
- Invoice
- Packing slip
- Manifest
- Pick list
- SKU summary
- Combined label PDF
- Channel-specific documents

The exact documents depend on marketplace APIs and fulfilment models.

The system must keep:

- Document type
- Document version
- Source
- Generated timestamp
- Related order or pack log
- Download status
- Generation failure
- Secure storage reference

Do not store sensitive permanent public URLs.

============================================================
20. BULK PACKING AND DOCUMENT DOWNLOAD
============================================================

When multiple orders are selected, the system may generate:

1. Pick list or shipping list containing:
   - SKU
   - Product
   - Quantity
   - Bin/location
   - Order reference

2. Combined PDF containing:
   - Shipping labels
   - Invoices
   - Other required documents

The UI should clearly show:

- Number of selected orders
- Number of labels
- Missing labels
- Invalid orders
- Channel grouping
- Warehouse grouping

Document generation must be asynchronous for large batches.

============================================================
21. READY-TO-SHIP AND DISPATCH FLOW
============================================================

Reference workflow:

1. Packed orders enter Ready to Ship.
2. User selects one or multiple orders.
3. User clicks Confirm Shipment or Dispatch.
4. User enters or confirms:
   - Courier
   - Tracking/AWB number
   - Package weight
   - Dimensions
   - Dispatch date
   - Pickup information
5. System submits dispatch confirmation to the marketplace where supported.
6. Order moves to Dispatched.
7. Tracking status is synchronized.
8. All Orders continues updating based on marketplace events.

Support marketplace-generated and externally generated AWBs.

Avoid marking an order dispatched internally before marketplace confirmation unless marked as pending synchronization.

============================================================
22. PACK LOGS
============================================================

The handwritten workflow includes a Pack Logs module.

A pack log represents one batch of selected orders processed together.

Pack log information may include:

- Pack log ID
- Tenant
- Warehouse
- Marketplace/account
- Created by
- Created date
- Number of orders
- Number of items
- Status
- Document status
- Shipping status
- Errors
- Notes
- Related orders

Inside Pack Log Details, show:

- Order ID
- External order ID
- Order date
- Buyer, where permitted
- SKU
- Quantity
- Status
- Courier
- AWB
- SLA date
- Label state
- Invoice state
- Pack state

Potential actions:

- View orders
- Re-download documents
- Retry failed document
- Scan and pack
- Confirm packing
- Print labels
- Export data

Recommend whether Pack Log, Pick Wave or Shipment Batch is a better model.

============================================================
23. SCAN AND PACK WORKFLOW
============================================================

The notes describe scanning SKUs during packing.

Desired flow:

1. User opens a pack log or scan-and-pack page.
2. System shows pending SKUs/orders.
3. User scans or enters a SKU barcode.
4. System identifies matching eligible order lines.
5. Quantity is incremented.
6. System prevents over-scanning.
7. Mismatched SKU triggers an alert.
8. Required items must be completely scanned before packing completes.
9. Shipping label becomes available or is downloaded.
10. Invoice may also be downloaded.
11. Packed status is updated.

Consider:

- Barcode scanner keyboard input
- Camera scanning
- Serial numbers
- Batch numbers
- Expiry dates
- Product images for verification
- Sound feedback
- Wrong-item alerts
- Partial packing
- Multi-box shipment
- Reprint protection

============================================================
24. BIN LOCATION / TEMP BIN WORKFLOW
============================================================

The handwritten notes mention “show temp bins” or refresh and selecting a SKU/order.

Please interpret and improve this requirement.

Possible warehouse flow:

- Orders are grouped into temporary picking bins.
- Each bin contains items for one or more orders.
- Staff scans SKU.
- Staff scans temporary bin.
- System links picked quantity to the bin.
- Packing staff later scans the bin to load its orders.
- Bin status becomes empty after packing.

Recommend whether temporary bins are needed for the MVP.

If implemented, model:

- Bin
- Bin type
- Warehouse
- Current assignment
- Order batch
- SKU quantities
- Created/cleared timestamps
- Scan history

============================================================
25. TAG LOOP FEATURE FOR RETURNS
============================================================

The notes mention a future “Tag Loop” feature used to verify returned products.

Interpretation:

- A unique tamper-evident tag or loop number is attached before dispatch.
- The tag number is associated with the order/item.
- During return inspection, the seller checks or scans the tag number.
- The system confirms whether the returned item matches the dispatched item.
- This helps reduce fraudulent returns.

Possible data:

- Tag identifier
- Order line
- SKU
- Assigned timestamp
- Assigned by
- Dispatch association
- Return scan
- Verification result
- Tampering status
- Notes
- Evidence images

This feature should be considered separately from ordinary barcode scanning.

Review privacy, operational practicality and cost.

Recommend whether this belongs in MVP, Phase 2 or Phase 3.

============================================================
26. RETURNS AND REFUNDS
============================================================

The existing repository may already contain a return/refund module.

Audit it before redesigning.

Required future capabilities:

- Import marketplace returns.
- Normalize return status.
- View return reason.
- Track return courier.
- Track return AWB.
- Receive returned package.
- Inspect condition.
- Verify SKU.
- Verify tag-loop number, if enabled.
- Record images/evidence.
- Mark sellable, damaged, wrong item or missing item.
- Restock approved quantity.
- Initiate or record refund.
- Track who funded the refund.
- Track shipping responsibility.
- Track marketplace claim/dispute.
- Preserve permanent return history.

Return states may include:

- REQUESTED
- APPROVED
- REJECTED
- PICKUP_SCHEDULED
- IN_TRANSIT
- RECEIVED
- INSPECTION_PENDING
- APPROVED_FOR_REFUND
- REFUND_INITIATED
- REFUNDED
- RESTOCKED
- DAMAGED
- DISPUTED
- CLOSED

============================================================
27. SHIPPING MANAGEMENT
============================================================

Shipping may occur through:

- Marketplace fulfilment
- Marketplace-assigned logistics
- Seller-selected courier
- Third-party shipping aggregator
- Our future shipping integration
- Manual AWB entry

Design a shipping abstraction.

Potential entities:

- Shipment
- Package
- ShipmentItem
- Courier
- ShippingProvider
- ShippingLabel
- TrackingEvent
- Pickup
- Manifest
- DeliveryException

Do not assume one order always equals one package.

Consider:

- Split shipment
- Multiple packages
- Partial dispatch
- RTO
- NDR
- Reattempt
- Lost shipment
- Damaged shipment
- Reverse shipment

============================================================
28. MAIN DASHBOARD
============================================================

The main seller dashboard should be much stronger than a simple sales graph.

The handwritten notes mention a net sold units graph.

Recommended dashboard sections may include:

Summary cards:
- Gross sales
- Net sales
- Orders
- Units sold
- Average order value
- Returns
- Cancellations
- Refunds
- Net revenue
- Estimated profit
- Pending orders
- Ready-to-ship orders
- Inventory alerts
- Listing errors

Charts:
- Net sold units over time
- Revenue over time
- Orders by channel
- Units by channel
- Returns over time
- Cancellation trend
- Top SKUs
- Low-stock SKUs
- Profit trend
- Marketplace fee trend

Operations:
- Orders approaching SLA
- Failed inventory synchronization
- Failed listing publication
- Expired integration credentials
- Return inspections pending
- Shipment exceptions
- Marketplace account alerts

Filters:
- Date range
- Marketplace
- Marketplace account
- Warehouse
- Brand
- Category
- SKU
- Product
- Region
- Order status

Every number must have a clear definition and data source.

============================================================
29. ADVANCED ANALYTICS
============================================================

The platform needs more powerful seller analytics.

Possible modules:

A. Sales Analytics
- Gross sales
- Net sales
- Units
- Orders
- AOV
- Discounts
- Shipping revenue
- Tax
- Channel contribution
- Product contribution
- Category contribution
- Growth rate

B. Product Analytics
- Views, if API available
- Conversion, if API available
- Sales
- Returns
- Cancellation rate
- Sell-through rate
- Days of inventory
- Stock-out periods
- Price history
- Channel comparison

C. Inventory Analytics
- Stock ageing
- Dead stock
- Fast-moving items
- Slow-moving items
- Inventory turnover
- Days cover
- Stock-out risk
- Overstock risk
- Reorder suggestions

D. Return Analytics
- Return rate
- Return reason
- SKU return rate
- Category return rate
- Marketplace return rate
- State/region return rate
- Refund value
- Damaged returns
- Suspected fraudulent returns

E. Profitability Analytics
- Revenue
- Cost of goods
- Marketplace commission
- Shipping cost
- Advertising cost
- Taxes
- Refund loss
- Return shipping
- Contribution margin
- Estimated profit

Do not call revenue “profit”.

============================================================
30. SEARCH AND ANALYTICS FILTERS
============================================================

The notes request search data and stronger search inside analytics.

Support global and module-level filters.

Potential search terms:

- Internal order ID
- Marketplace order ID
- SKU
- Product title
- Customer name where permitted
- AWB/tracking number
- Invoice number
- Pack log
- Return ID
- External listing ID
- Tag loop ID

For large datasets:

- Use server-side pagination.
- Use indexed filtering.
- Avoid loading all records in the browser.
- Avoid client-side filtering as the primary method.
- Export jobs should run asynchronously when large.

============================================================
31. SALES AND EARNINGS REPORTS
============================================================

The handwritten notes include Sales & Earnings reports.

Potential report fields:

- Date
- Marketplace
- Account
- Order
- SKU
- Quantity
- Item price
- Discounts
- Tax
- Shipping amount
- Marketplace commission
- Fixed fee
- Collection fee
- Shipping fee
- Advertising attribution
- Refund
- Return shipping
- TDS
- TCS
- GST components
- Settlement amount
- Estimated cost
- Estimated margin

Allow:

- Date filters
- Marketplace filters
- Account filters
- SKU filters
- CSV export
- Excel export
- Scheduled reports in later phases
- Report-generation history

Reports must state whether values are:

- Real-time estimates
- Marketplace-confirmed
- Settlement-confirmed
- User-entered
- Derived calculations

============================================================
32. ACCOUNT REPORTS
============================================================

The notes mention an Accounts area with Generate Report.

Potential account reports:

- Order report
- Sales report
- Settlement report
- Return report
- Refund report
- Fee report
- Tax report
- Inventory valuation report
- Marketplace reconciliation report
- Profitability report

Do not create one vague “Generate all records” button without clear report type and filters.

Recommend a scalable report centre.

============================================================
33. GST, TDS AND TCS
============================================================

The notes request maintaining:

- GST
- TDS
- TCS

This must be designed carefully.

Potential requirements:

- HSN code per product
- Product GST rate
- Marketplace tax deductions
- TCS records
- TDS records
- Seller GST details
- State-level tax handling
- Invoice data
- Settlement tax reconciliation
- Exportable tax reports
- Credit/debit note tracking

Do not present the software as formal tax advice.

All tax calculations must be configurable and reviewed by accounting professionals.

Audit what currently exists before implementing changes.

============================================================
34. DEMOGRAPHIC REPORTS
============================================================

The handwritten notes request demographic reporting showing where orders and returns originate.

Potential analytics:

- Orders by state
- Revenue by state
- Returns by state
- Cancellation by state
- Average order value by state
- Top cities
- RTO rate by region
- Delivery performance by region
- Marketplace contribution by region

Use only address/location data legally available through APIs.

Avoid storing more personal customer information than operationally necessary.

Consider aggregating data for analytics.

============================================================
35. SELLER ACCOUNT HEALTH
============================================================

The notes mention seller analytics in the admin dashboard, including:

- Account health
- Return/refund ratio
- Sales
- Ads
- Other performance data

Seller-facing account health may include:

- Cancellation rate
- Late dispatch rate
- Return rate
- Refund rate
- Order defect rate
- Listing error rate
- Inventory-sync failure rate
- SLA breaches
- Customer complaint data where available
- Channel-specific warnings

Admin-facing seller health may include:

- Integration connection status
- API failures
- Suspicious activity
- Excessive returns
- Operational compliance
- Subscription status
- Usage and limits
- Marketplace-sync performance
- Support history

Do not invent marketplace account-health metrics not supplied by their APIs.

Separate:

- Marketplace-reported metrics
- Our internally calculated metrics

============================================================
36. ADMIN DASHBOARD
============================================================

The platform admin should be able to supervise the SaaS system.

Possible modules:

- Tenants
- Users
- Subscriptions
- Marketplace connections
- Connector health
- Sync jobs
- Failed jobs
- Orders
- Returns
- Listings
- Inventory issues
- Audit logs
- System logs
- Background jobs
- Support cases
- Feature flags
- Usage limits
- Account health
- Billing
- Notifications
- Platform analytics

Admin must not casually access sensitive tenant data.

Implement appropriate permissions and audit trails.

Consider support impersonation only with explicit safeguards and logging.

============================================================
37. OWN STOREFRONT / EXISTING MARKETPLACE
============================================================

The existing project may already include a buyer-facing marketplace.

Do not automatically delete it.

Audit whether it should become:

Option A:
A first-party sales channel inside the multi-channel platform.

Option B:
An optional hosted storefront for each seller.

Option C:
A separate marketplace product.

Option D:
Removed or isolated if it creates unnecessary scope.

Recommend the best direction based on current implementation quality and business value.

============================================================
38. CHANNEL LISTING MANAGEMENT
============================================================

Product management should show channel-level listing status.

Example:

Product: Blue Cotton Shirt

Amazon:
- Published
- Price ₹999
- Stock 12
- External ID XYZ

Flipkart:
- Validation failed
- Missing sleeve type

Meesho:
- Pending review

Myntra:
- Not connected

Required actions:

- Publish
- Update
- Pause
- Archive
- Retry
- View errors
- Compare channel data
- Apply price override
- Apply stock rule
- Open marketplace listing where possible

============================================================
39. PRICING MANAGEMENT
============================================================

Support marketplace-specific pricing.

Potential model:

- Base price
- MRP
- Channel price
- Sale price
- Minimum price
- Cost price
- Marketplace fee estimate
- Desired margin
- Tax-inclusive/exclusive mode
- Scheduled price
- Bulk price updates

Possible future features:

- Rule-based pricing
- Competitor-based pricing, if legally/API available
- Automatic margin protection
- Promotional pricing
- Price history
- Approval before mass update

Do not implement automatic repricing without safeguards.

============================================================
40. BULK OPERATIONS
============================================================

Sellers may have thousands of products and orders.

Required bulk capabilities may include:

- Bulk product import
- Bulk category mapping
- Bulk attribute update
- Bulk price update
- Bulk inventory adjustment
- Bulk publish
- Bulk archive
- Bulk accept orders
- Bulk pack
- Bulk label download
- Bulk dispatch
- Bulk export

Every bulk job should show:

- Total
- Queued
- Processing
- Successful
- Failed
- Skipped
- Error details
- Retry option

============================================================
41. BACKGROUND JOB ARCHITECTURE
============================================================

External API synchronization must not depend on page rendering.

Use background jobs for:

- Initial marketplace import
- Incremental sync
- Listing publication
- Listing update
- Inventory update
- Order fetch
- Shipment confirmation
- Label/document generation
- Return sync
- Settlement sync
- Analytics aggregation
- Report export
- Retry handling

A job should include:

- Type
- Tenant
- Connector/account
- Entity
- Idempotency key
- Payload reference
- Status
- Attempts
- Next retry
- Error category
- Error message
- Started and completed timestamps
- Correlation ID

Implement:

- Retry with backoff
- Dead-letter handling
- Idempotency
- Rate-limit awareness
- Per-connector concurrency limits
- Observability
- Manual retry
- Cancellation where safe

Inspect the repository’s current background-job implementation and decide whether it is sufficient.

============================================================
42. SYNCHRONIZATION STRATEGY
============================================================

Use a combination of:

- Webhooks/events where available
- Incremental polling
- Scheduled reconciliation
- Manual sync
- Recovery jobs

Do not rely exclusively on webhooks.

Do not rely exclusively on full-table polling.

Track cursors or updated-since tokens where supported.

Every sync should be observable.

Possible sync log fields:

- Connector
- Resource type
- Direction
- Start/end
- Records received
- Records created
- Records updated
- Records skipped
- Errors
- Cursor
- Rate-limit data

============================================================
43. DATA OWNERSHIP AND SOURCE OF TRUTH
============================================================

Clearly define source of truth per field.

Examples:

Central platform may own:
- Internal SKU
- Internal product name
- Cost price
- Internal category
- Warehouse stock
- Safety stock
- Channel mapping

Marketplace may own:
- External order status
- Marketplace fees
- Marketplace settlement
- Channel-specific listing review status
- Channel-generated label
- Marketplace account warning

Some fields require conflict rules.

Do not allow endless update loops:

Marketplace update
→ platform update
→ marketplace update
→ platform update

Use source metadata and synchronization versioning.

============================================================
44. ERROR HANDLING
============================================================

Errors must be understandable to a business user.

Bad:
“HTTP 400”

Better:
“Amazon rejected this listing because the selected category requires Sleeve Type.”

Store:

- Raw external error securely
- Normalized error code
- User-facing explanation
- Suggested resolution
- Retryability
- Related field
- Timestamp
- Connector request correlation

Do not expose credentials or sensitive payload data.

============================================================
45. NOTIFICATIONS
============================================================

Potential notifications:

- Marketplace connection expired
- Listing rejected
- Listing publication failed
- Inventory sync failed
- New order
- Order approaching SLA
- Label generation failed
- Pickup missed
- Return received
- Refund pending
- Low stock
- Overselling risk
- Settlement mismatch
- Report completed

Potential channels:

- In-app
- Email
- Mobile push later
- WhatsApp/SMS later where appropriate

Implement notification preferences and deduplication.

============================================================
46. AUDITABILITY
============================================================

Sensitive actions should create audit logs.

Examples:

- Marketplace connected/disconnected
- Credentials refreshed
- Product published
- Price changed
- Inventory adjusted
- Order accepted
- Order packed
- Shipment confirmed
- Return approved
- Refund approved
- Report exported
- User role changed
- Admin viewed sensitive tenant data

Audit logs should include:

- Tenant
- User
- Action
- Entity
- Before/after summary
- IP/user-agent where appropriate
- Timestamp
- Correlation ID

Do not store secrets in logs.

============================================================
47. SECURITY REQUIREMENTS
============================================================

Review the current code for:

- Tenant isolation
- Authentication
- Authorization
- IDOR vulnerabilities
- Secret exposure
- Input validation
- SQL injection
- XSS
- CSRF
- File upload security
- Rate limiting
- Webhook signature verification
- API token encryption
- Log redaction
- Error leakage
- Unsafe admin actions
- Insecure report URLs
- Unprotected server actions
- Environment misconfiguration

Recommend immediate fixes for critical issues before large feature development.

============================================================
48. DATABASE DESIGN EXPECTATIONS
============================================================

Do not add dozens of fields blindly to existing tables.

Recommend normalized models for concepts such as:

- Organisation/Tenant
- Membership
- Role/Permission
- Marketplace
- MarketplaceAccount
- MarketplaceCredential
- ConnectorCapability
- SyncJob
- SyncCursor
- Product
- ProductVariant
- SKU
- ProductMedia
- InternalCategory
- InternalAttribute
- ChannelCategory
- CategoryMapping
- ChannelAttribute
- AttributeMapping
- ChannelListing
- ChannelListingVariant
- ListingValidationError
- Warehouse
- Bin
- InventoryBalance
- InventoryTransaction
- InventoryReservation
- ChannelInventoryRule
- Order
- OrderLine
- OrderAddress
- OrderStatusHistory
- Shipment
- ShipmentPackage
- TrackingEvent
- PackLog/PickWave
- PackLogOrder
- ScanEvent
- ShippingDocument
- Return
- ReturnItem
- ReturnInspection
- Refund
- Settlement
- SettlementLine
- MarketplaceFee
- TaxRecord
- ReportJob
- Notification
- AuditLog
- SystemLog

These names are suggestions.

First inspect the existing Prisma/database schema and reuse compatible models.

Provide a migration strategy instead of replacing everything at once.

============================================================
49. REPORTING AND ANALYTICS ARCHITECTURE
============================================================

Operational database queries may not scale for advanced analytics.

Recommend whether the project needs:

- Precomputed daily aggregates
- Materialized views
- Analytics tables
- Event-based metrics
- Separate reporting database later
- Data warehouse in enterprise phase
- Background forecast generation

For the current stage, avoid unnecessary overengineering.

However, do not build dashboard metrics using slow unindexed full-table scans.

============================================================
50. EXISTING FORECASTING FEATURES
============================================================

The repository may contain a deterministic forecasting and prediction engine, including market forecasts or seller forecasts.

Audit:

- What forecasts exist?
- Are they useful for the new product?
- Are formulas valid?
- Is the data real or mocked?
- Can they support:
  - Demand forecasting
  - Reorder suggestions
  - Stock-out prediction
  - Category growth
  - Sales forecasting
  - Return-risk prediction
  - Inventory ageing
- Should they be retained, redesigned or deferred?

Do not retain features only because code already exists.

============================================================
51. USER EXPERIENCE PRINCIPLES
============================================================

The system will be complex.

The UI must remain understandable for non-technical sellers.

Principles:

- Use progressive disclosure.
- Avoid showing every advanced feature simultaneously.
- Clearly separate Products, Orders, Inventory, Shipping, Returns, Analytics and Integrations.
- Make marketplace status visible.
- Use actionable error messages.
- Keep bulk operations safe.
- Provide confirmation for irreversible actions.
- Show previews before publishing.
- Show background-job progress.
- Preserve filters in URLs where useful.
- Support mobile-responsive monitoring, though warehouse scanning may need dedicated layouts.
- Use consistent status badges and terminology.
- Avoid duplicate dashboards that display the same data differently.

============================================================
52. SUGGESTED INFORMATION ARCHITECTURE
============================================================

This is a starting point, not a mandatory final structure.

Seller application:

1. Overview
2. Orders
   - All Orders
   - New
   - Accepted
   - Packing
   - Packed
   - Ready to Ship
   - Dispatched
   - Cancelled
   - Exceptions
3. Products
   - Master Catalog
   - Channel Listings
   - Drafts
   - Listing Errors
   - Bulk Import
4. Inventory
   - Stock Overview
   - Warehouses
   - Adjustments
   - Transfers
   - Inventory Ledger
   - Low Stock
5. Warehouse
   - Pick Waves / Pack Logs
   - Scan and Pack
   - Bins
   - Documents
6. Shipping
   - Shipments
   - Pickups
   - Tracking
   - Exceptions
7. Returns
   - Return Requests
   - In Transit
   - Inspection
   - Refunds
   - Return History
8. Analytics
   - Sales
   - Products
   - Inventory
   - Returns
   - Profitability
   - Demographics
9. Reports
10. Sales Channels
11. Settings
    - Organisation
    - Users and Roles
    - Warehouses
    - Tax
    - Notifications
    - Billing

Admin application:

1. Platform Overview
2. Organisations
3. Users
4. Integrations
5. Connector Health
6. Jobs
7. Orders/Returns Oversight
8. Subscriptions
9. Support
10. Audit Logs
11. System Logs
12. Feature Flags
13. Platform Settings

Review and improve this based on the existing application.

============================================================
53. WHAT TO DO WITH THE EXISTING CODE
============================================================

Classify existing code into:

A. Keep unchanged
B. Keep with minor changes
C. Refactor
D. Replace
E. Deprecate
F. Unknown until tested

Do this for:

- Pages/routes
- Components
- Server actions
- API routes
- Database models
- Authentication
- Permissions
- Product system
- Inventory
- Orders
- Returns
- Analytics
- Reports
- Admin
- Logging
- Background workers
- Notifications
- Tests
- Mock data
- Utilities
- Styling/design system

Do not assume visual completion means functional completion.

Trace UI actions to server logic and database persistence.

============================================================
54. REQUIRED REPOSITORY AUDIT
============================================================

Start by examining:

- package.json
- lockfile
- README
- environment example
- Prisma/database schema
- migrations
- app/routes
- pages
- components
- server actions
- API handlers
- authentication configuration
- middleware
- services
- hooks
- constants
- mocks
- background jobs
- logging
- tests
- scripts
- seed files
- configuration
- TypeScript configuration
- build configuration
- linting
- deployment configuration

Determine:

- Framework and version
- Runtime
- Database
- ORM
- Authentication
- UI library
- Validation library
- State management
- Queue system
- File storage
- Email system
- Payment system
- Testing stack
- Deployment assumptions

Run safe commands such as:

- dependency inspection
- type checking
- linting
- existing tests
- production build

Do not automatically upgrade all dependencies.

============================================================
55. REQUIRED OUTPUT BEFORE CODING
============================================================

After inspecting the repository, provide a formal audit containing:

SECTION 1 — Executive Summary
- What the current application actually is
- How complete it appears
- Whether it is suitable for the new direction

SECTION 2 — Current Technology Stack
- Frontend
- Backend
- Database
- Authentication
- Infrastructure
- Important dependencies

SECTION 3 — Current Folder Structure
- Explain important folders and files

SECTION 4 — Current Feature Inventory
For every major feature:
- UI exists?
- Backend exists?
- Database exists?
- Fully connected?
- Tested?
- Production-ready?
- Mocked or real?

SECTION 5 — Current Database Analysis
- Main models
- Relations
- Tenant model
- Potential schema issues
- Migration risks

SECTION 6 — Current Security Analysis
- Critical
- High
- Medium
- Low issues

SECTION 7 — Reusability Analysis
- What can be reused
- What needs refactoring
- What should be deprecated

SECTION 8 — Gap Analysis
Compare current project against the new multi-channel platform vision.

SECTION 9 — Recommended Product Scope
- MVP
- Phase 2
- Phase 3
- Enterprise/future

SECTION 10 — Recommended Target Architecture
Include a clear text diagram.

SECTION 11 — Data Model Proposal
Only conceptual at first; do not migrate yet.

SECTION 12 — Marketplace Integration Strategy
- Adapter architecture
- Capability matrix
- Mock connector strategy
- Sandbox strategy
- Approval dependencies

SECTION 13 — UI/Navigation Proposal
- Seller
- Warehouse
- Admin

SECTION 14 — Implementation Roadmap
- Ordered phases
- Dependencies
- Risk
- Acceptance criteria

SECTION 15 — Decisions Required From Owner
Ask only meaningful product questions.

SECTION 16 — Your Recommendations
Provide honest recommendations even if they differ from the requirements.

============================================================
56. RECOMMENDED PHASED APPROACH
============================================================

You may revise this plan.

Suggested Phase 0 — Audit and Stabilization
- Understand current system
- Fix critical build/type/security issues
- Identify reusable modules
- Establish tests
- Protect existing data

Suggested Phase 1 — Multi-Tenant Foundation
- Organisation/workspace
- Membership and permissions
- Tenant-safe queries
- Marketplace account model
- Integration health UI
- Connector framework
- Mock/demo connector

Suggested Phase 2 — Central Product Catalogue
- Products
- Variants
- SKUs
- Categories
- Dynamic attributes
- Images
- Bulk import
- Existing listing mapping

Suggested Phase 3 — Listing Orchestration
- Channel listings
- Category mapping
- Attribute mapping
- Validation
- Publish jobs
- Status/error management
- Start with one channel or mock adapter

Suggested Phase 4 — Inventory
- Warehouses
- Inventory ledger
- Reservations
- Adjustments
- Channel allocation rules
- Inventory synchronization

Suggested Phase 5 — Unified Orders
- Order ingestion
- Normalized statuses
- New/accepted/all orders
- Bulk acceptance
- SLA tracking
- Cancellation handling

Suggested Phase 6 — Warehouse and Packing
- Pick/pack batches
- Pack logs
- Scan and pack
- Documents
- Ready-to-ship
- Dispatch confirmation

Suggested Phase 7 — Returns
- Return ingestion
- Inspection
- Refund history
- Restocking
- Optional tag-loop feature

Suggested Phase 8 — Finance and Reports
- Fees
- Settlements
- GST/TDS/TCS data
- Reconciliation
- Exports

Suggested Phase 9 — Advanced Analytics
- Seller analytics
- Product analytics
- Inventory analytics
- Profitability
- Demographics
- Seller health
- Admin analytics

Suggested Phase 10 — Production Hardening
- Load testing
- Security audit
- Observability
- Queue resilience
- Backup and recovery
- Rate-limit tests
- Deployment documentation

============================================================
57. MVP RECOMMENDATION REQUEST
============================================================

We have not yet finalized exactly what should be built first.

You must recommend a realistic MVP.

The MVP should prove:

- One seller organisation
- One or two supported marketplace connectors, or one real plus one mock
- Product import/create
- Channel listing management
- Inventory synchronization
- Unified order ingestion
- Accept/pack/dispatch workflow
- Basic reports
- Integration and job monitoring

Do not recommend building Amazon, Flipkart, Myntra and Meesho fully at the same time unless technically and operationally justified.

Explain which channel should be first and why, after checking API accessibility.

============================================================
58. SCREENSHOT AND REFERENCE WORKFLOW CONTEXT
============================================================

We have reference screenshots from another order-management platform and handwritten workflow notes.

They are inspiration, not instructions to copy branding or proprietary UI exactly.

The important ideas extracted from them include:

- Main dashboard with net sold units
- Order tabs
- New order acceptance
- Bulk packing
- Shipping-label download
- Invoice download
- Pick/shipping list
- Dispatch confirmation
- All-orders history
- Pack logs
- Pack-log details
- SKU scanning
- Temporary bins
- Tag-loop verification
- Account reports
- Sales and earnings reports
- Demographic reports
- GST/TDS/TCS reporting
- Seller analytics visible to admin
- Account health
- Return/refund ratio
- Sales and advertising metrics

Improve these concepts instead of blindly cloning the reference.

============================================================
59. OPEN PRODUCT QUESTIONS
============================================================

We have not yet finalized:

- Exact brand/name of the platform
- Whether our own storefront remains primary
- Which marketplace integration comes first
- Whether shipping aggregator integration is required in MVP
- Whether tag-loop is MVP or future
- Whether temporary bins are necessary
- Subscription plans
- Usage limits
- Commission model
- Whether sellers can manage multiple legal entities
- Whether accounting reports are estimates or official books
- Whether mobile warehouse app is needed
- Whether B2B and offline orders should be included
- Whether purchase orders and supplier management are required
- Whether advertising management is included
- Whether AI recommendations are needed

Do not block the audit because these decisions are open.

Give recommendations.

============================================================
60. IMPORTANT PRODUCT RECOMMENDATIONS WE EXPECT FROM YOU
============================================================

Please specifically evaluate whether we should include:

- Purchase orders
- Supplier management
- Reorder automation
- Multi-warehouse transfers
- Barcode generation
- Bundle and kit inventory
- B2B/manual order creation
- Shopify/WooCommerce integration
- Shipping aggregators
- Accounting software integrations
- Settlement reconciliation
- Advertising analytics
- Subscription billing
- Seller onboarding checklist
- Workflow automation rules
- Approval workflows
- Mobile scanning interface
- AI-assisted listing generation
- AI-assisted category mapping
- AI demand forecasting
- Fraudulent-return detection

Classify each as:

- Essential for MVP
- Useful for Phase 2
- Future enhancement
- Not recommended

============================================================
61. CODING STANDARDS WHEN IMPLEMENTATION BEGINS
============================================================

Once a plan is approved:

- Use strict TypeScript where applicable.
- Avoid `any` unless justified.
- Validate all external data.
- Use clear service boundaries.
- Keep marketplace code out of UI components.
- Use transactions for critical inventory/order changes.
- Use idempotency keys for external events and retries.
- Add database indexes intentionally.
- Avoid N+1 queries.
- Add tenant filters to every tenant-owned query.
- Add tests for critical workflows.
- Add migration notes.
- Update documentation after each phase.
- Keep environment-specific values out of code.
- Add feature flags for unfinished integrations.
- Never represent mock data as live data.
- Do not silently swallow API failures.
- Avoid enormous files and components.
- Reuse the existing design system when good.
- Preserve backwards compatibility where reasonable.

============================================================
62. TESTING EXPECTATIONS
============================================================

Critical workflows require tests.

Examples:

- Tenant isolation
- Product/variant creation
- Channel listing mapping
- Idempotent order import
- Duplicate webhook handling
- Inventory reservation
- Simultaneous order race conditions
- Order cancellation stock release
- Pack confirmation
- Wrong SKU scan
- Shipment confirmation
- Return restocking
- Marketplace token refresh
- Failed-job retry
- Bulk-operation partial success
- Report access authorization
- Audit-log redaction

Recommend:

- Unit tests
- Integration tests
- End-to-end tests
- Connector contract tests
- Database transaction tests
- Load tests for sync and bulk operations

============================================================
63. SUCCESS CRITERIA
============================================================

The project is successful when a seller can realistically operate multiple sales channels without repeatedly using each marketplace dashboard for routine tasks.

Success means:

- Connected accounts remain healthy.
- Product data is centrally managed.
- Listings can be distributed safely.
- Inventory is synchronized reliably.
- Overselling risk is reduced.
- Orders are not duplicated.
- Packing and dispatch are auditable.
- Returns are traceable.
- Reports are understandable.
- Marketplace failures are actionable.
- Tenant data is secure.
- The application remains maintainable as connectors increase.

============================================================
64. YOUR FIRST RESPONSE
============================================================

Do not modify code in your first step.

Start by saying that you understand the changed project direction.

Then inspect the repository thoroughly.

After inspection, present the complete audit and recommended plan described above.

Be direct and honest.

Tell us:

- What is genuinely complete.
- What only looks complete.
- What is broken.
- What is missing.
- What should be kept.
- What should be removed.
- What should be built first.
- What architecture you recommend.
- What assumptions are unsafe.
- Which ideas should be changed.
- Which additional features would materially improve the product.

You have full permission to make recommendations.

We value a technically sound and commercially realistic platform more than strict adherence to our initial assumptions.

Do not begin a large implementation until we approve your audit and roadmap.