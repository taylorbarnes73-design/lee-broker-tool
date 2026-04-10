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

## Round 3 Changes

### Listing Entry
- [x] Rename "Industrial Details" → "Property Details"; show dynamically based on selected property type (Industrial / Office / Retail / Land / Other fields)
- [x] Move Property Details out of "Additional Details" — always visible in the main form flow
- [x] Review & Confirm: build as a full new page/view (hide the form, show a read-only summary of all inputs with edit buttons)
- [x] Review & Confirm: reveal "Submit to MLS" button only on the confirm page
- [x] After "Submit to MLS" is pressed: reveal "Create Sign Order?" prompt and "Download PDF" button

### Sign Request
- [x] Hide PO # field from the form (keep auto-generation in background)
- [x] Move Configuration section above Sign Specifications
- [x] Remove location dropdown next to sign size options (keep only the size/qty controls)
- [x] Mark Name Rider as "Optional"
- [x] Mark Sign Placement image upload as "Optional"
- [x] Rename "%" to "Shared Expense %" in Requested By section
- [x] Show Access and Comments fields always (not hidden in additional details)

### Commission Voucher
- [x] Move Property Address, City, Zip (with city/zip autofill) and Deal SF to the very top (Step 1 or Step 2)
- [x] Rename "On Behalf Of" → "Client Name"
- [x] Move Upload Documents to Step 8 (end of form)
- [x] Move Commission Distribution to Step 8 (end of form)

## Visual Design Overhaul

### Global CSS
- [x] Color palette: red reserved for header/primary buttons/active tab; charcoal #1A1A1A for section headers; warm gray #6B7280 for labels; cream #FAFAF8 background; green for success; amber for callouts
- [x] Typography: Inter font for UI, JetBrains Mono for numbers; section headers 14px all-caps 0.05em letter-spacing; labels 12-13px medium charcoal; inputs 15-16px near-black
- [x] Spacing: 24px between fields, 40px between sections, 16px input padding, 48px min input height
- [x] Input styles: editable = white bg + red focus border + red glow; auto-calc = #F3F4F6 bg + no border + "auto" label
- [x] Required fields: red asterisk + slightly stronger border only (no red background)
- [x] Focus states: 2px red border + box-shadow 0 0 0 3px rgba(183,28,28,0.1)
- [x] Button styles: primary = red bg/white text; secondary = white bg/gray border; disabled = light gray
- [x] Inline validation on blur: red border + "Required" text; amber for format errors; green checkmark flash on valid

### Progressive Disclosure Cards
- [x] Active card: white bg, shadow 0 2px 8px rgba(0,0,0,0.08), 4px red left border
- [x] Completed card: #F0FDF4 tint, green checkmark, collapsed to 1-line summary showing entered values
- [x] Locked card: #F3F4F6 bg, muted text, lock icon, visible but inactive
- [x] Optional sections: lighter gray left border, "Optional" tag instead of "REQUIRED"
- [x] Click completed card to expand/edit
- [x] Progress bar below tab nav: red fill, gray remaining, "Step X of Y — Z%"

### Table Visuals
- [x] Rent schedule: alternating row bg (white/#F9FAFB), totals row bold with heavier top border, right-aligned monospaced numbers, free rent rows yellow-highlighted
- [x] Commission distribution: colored side chips (Listing=blue, Procuring=green, Both=purple, Referral=amber), % total shows green ✓ or red ✗

### Sign Request
- [x] Selected config icon gets red border/bg highlight (not just checkmark)
- [x] Quantity +/- buttons minimum 44×44px tap targets
- [x] Active quantity rows subtly highlighted

### Mobile
- [x] All inputs full-width below 640px
- [x] Sticky tab bar
- [x] Sticky progress bar below tabs
- [x] Sticky bottom action buttons on mobile
- [x] Rent schedule table horizontal scroll with right-edge shadow
- [x] Optional sections collapsed by default on mobile

### Polish
- [x] Section expand/collapse transitions 200-300ms ease-out
- [x] Toast notification after successful submission (green, top-right, 4s)
- [x] Loading spinner on PDF generate / Dealius submit buttons
- [x] Admin Portal empty state illustration/message
- [x] Tab switch 200ms slide transition
- [x] Scrollable tab bar with right-edge gradient fade indicator

## Bug Fixes
- [x] Comp Input tab shows blank/empty when clicked — fixed (root cause: 2 unclosed divs in voucher tab nesting comp tab inside hidden voucher panel)

## Power Automate Custom Connector
- [ ] Add POST /api/submit/listing REST endpoint
- [ ] Add POST /api/submit/voucher REST endpoint
- [ ] Add POST /api/submit/sign-request REST endpoint
- [ ] Add POST /api/submit/comp REST endpoint
- [ ] Add GET /api/files/list REST endpoint
- [ ] Add GET /api/files/url/:key REST endpoint
- [ ] Generate OpenAPI 2.0 (Swagger) JSON definition for Power Automate import
- [ ] Write vitest tests for all new REST endpoints
