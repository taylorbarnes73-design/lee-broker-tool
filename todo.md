# Lee Broker Tool — TODO

- [x] Initial broker_tool.html with 4 tabs (Listing Entry, Sign Request, Commission Voucher, Comp Input)
- [x] PDF export for all 4 tabs
- [x] Upgrade to full-stack (web-db-user: Express + tRPC + MySQL + Manus Auth)
- [x] Add uploads table to database schema (drizzle/schema.ts)
- [x] Add files.upload tRPC procedure (server/routers.ts) — base64 → S3 → DB metadata
- [x] Add files.list tRPC procedure — list recent uploads with optional category/reference filter
- [x] Add files.getUrl tRPC procedure — get fresh download URL for a file key
- [x] Replace static file inputs in Listing Agreements & Disclosures with S3-backed upload zones
- [x] Add upload zone CSS styles
- [x] Add S3 upload JavaScript (initS3Uploads) in broker_tool.html
- [x] Write and pass vitest tests for files.upload, files.list, files.getUrl

## Voucher Page Changes
- [x] Add Representation Type dropdown (Tenant Rep, Landlord Rep, Buyer Rep, Seller Rep, Other) at top
- [x] Add "On Behalf Of" auto-filled agent name field at top
- [x] Remove: Size & Construction, Building Features, Parking & Expenses, Additional Comp Comments, Lease Transaction Details (Extended)
- [x] Keep Suite Number and Deal Type from Property Information, make them required and move to top
- [x] Rename all "Rate per SF" → "Rate per SF per Month"
- [x] Move Monthly & Free Rent Schedule directly after Commission section
- [x] Add Commission % editable field inside rent schedule
- [x] Auto-calculate: Lease Commission Due, Total Invoice, Total Consideration
- [x] Add "Add Agent" button for multiple internal agents
- [x] Add Outside Agents toggle (On/Off)
- [x] Add "Invoice To" selection (choose from entered parties)
- [x] Add "Third-Party Invoice" button for external invoicing party
- [x] Move Commission Distribution directly under Broker/Agent section
- [x] Add "Notify MLS" and "Remove Signs" action buttons post-submission
- [x] Restructure workflow order: Transaction Type → Upload Docs → Broker Info → Client+Property → Financial → Calculation → Summary → Submission

## Listing Page Changes
- [x] Split into "Add Listing" and "Listing Modification" sub-pages
- [x] Move Date Entered to top of Add Listing
- [x] Simplify Transaction Type to Lease / Sale only
- [x] Rename rate fields to "Rate per SF per Month"
- [x] Add "Negotiable" option to Term field
- [x] Add "Reveal Prices to MLS" toggle
- [x] Add Shared Expenses column to agents section
- [x] Add "Send to MLS" action button
- [x] Add summary/confirmation screen with "Create Sign Order?" prompt
- [x] Add Listing Modification sub-page (address + notes + which MLS to notify)

## Sign Order Page Changes
- [x] Auto-generate PO Number (remove manual entry)
- [x] Rename "Sign Support Configuration" → "Configuration"
- [x] Make V-shape selector a true visual "V" option
- [x] Add quantity steppers (+/- buttons) under Sign Specifications
- [x] Add Name Rider toggle (On/Off) with text field
- [x] Make Sign Placement Visual an optional toggle
