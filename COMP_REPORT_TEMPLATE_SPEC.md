# Comp Report Template Spec

This spec is based on these real source files:

- `LeeIrvine_Metropolis_CompData.xlsx`
- `Sale Comp Report - Jan - March 2026.pdf`
- `Lease Comp Report - Jan - March 2026.pdf`

## Source workbook shape

Canonical sheets:

- `LeeIrvine_LeaseComps`
- `LeeIrvine_SalesComps`

Observed scale:

- lease comps: about 79,176 rows
- sale comps: about 36,853 rows

Regional lease sheets also exist, but many are empty header-only tabs. For import, the safest canonical source is the two LeeIrvine master sheets above.

## Lease report layout

Observed report traits:

- landscape letter pages
- title block:
  - `LEASE COMPARABLES`
  - `Metropolis`
  - `Industrial with Small Pictures`
  - generation date
- repeating disclaimer/footer per page
- one comp card per numbered item
- fields shown in a consistent fixed order

Lease card field order from the sample:

- `Space Leased`
- `Office`
- `Trans. Date`
- `Prop. Type`
- `On Mrkt`
- `DH`
- `Sprk`
- `Lessee`
- `Rent/SqFt`
- `TI Allow`
- `Expir. Date`
- `Subtype`
- `Amps`
- `GL`
- `Rail`
- `Lessor`
- `Eff. Rent`
- `Free Rent`
- `Term`
- `Bldg. Class`
- `Mul-Ten`
- `POL`
- `Yrd`
- `Space Type`
- `Bldg SqFt`
- `NNN Chgs`
- `Occ Date`
- `Parking`
- `Yr Built`
- `HT`
- `Land`
- `Options/Rent Adj`

## Sale report layout

Observed report traits:

- landscape letter pages
- title block:
  - `SALE COMPARABLES`
  - `Metropolis`
  - `Industrial with Small Pictures`
  - generation date
- one comp card per numbered item
- same disclaimer/footer pattern

Sale card field order from the sample:

- `Bldg. SqFt`
- `Sale Price`
- `Trans. Date`
- `Prop. Type`
- `Yr Built`
- `DH`
- `Sprk`
- `Buyer`
- `Office SqFt`
- `Sale $/SF`
- `On Market`
- `Subtype`
- `Mul-Tnt`
- `GL`
- `RR`
- `Seller`
- `Land Size`
- `Trans. Type`
- `Cap Rate`
- `Bldg. Class`
- `Amps`
- `Clr`
- `Yard`
- `Buyer Previous Location`

## Build rule

The final production report generator should be deterministic:

1. filter normalized comp rows
2. map them into fixed lease/sale report cards
3. render a fixed HTML template matching the sample
4. export that rendered template to PDF

Do not generate the final report layout ad hoc with AI at request time.

AI can help us design the HTML/CSS template, but the production report should come from a locked template plus validated data mapping.

## Code added

The current normalization and report-card mapping lives in:

- [shared/comp-data.ts](C:/Users/TaylorBarnes/Documents/GitHub/lee-broker-tool/shared/comp-data.ts:1)

Supporting scripts:

- `corepack pnpm comp:analyze -- "C:\\path\\to\\workbook.xlsx"`
- `corepack pnpm comp:export -- "C:\\path\\to\\workbook.xlsx"`
- `corepack pnpm comp:import -- "C:\\path\\to\\workbook.xlsx"`

Server-backed import/search flow:

- [server/services/compData.ts](C:/Users/TaylorBarnes/Documents/GitHub/lee-broker-tool/server/services/compData.ts:1)
- [server/routers/compData.ts](C:/Users/TaylorBarnes/Documents/GitHub/lee-broker-tool/server/routers/compData.ts:1)
- [client/src/pages/Home.tsx](C:/Users/TaylorBarnes/Documents/GitHub/lee-broker-tool/client/src/pages/Home.tsx:1)
