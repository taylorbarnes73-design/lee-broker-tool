# Comp Report Prep

This repo now has the first real comp-data layer in place, backed by the actual workbook structure and sample report files.

## What is live in code

1. The app can store a comp workbook import as a tracked dataset.
2. Lease and sale comps are normalized into searchable database rows.
3. The React broker workspace now has a `Comp Reports` area for:
   - viewing the active dataset
   - admin workbook import
   - searching lease/sale comps
   - previewing report-ready cards
4. A local bootstrap script exists for direct imports:
   - `corepack pnpm comp:import -- "C:\\path\\to\\workbook.xlsx"`

## Recommended approach from here

1. Store the original Excel workbook as a source artifact.
2. Keep parsing locked to the canonical master sheets.
3. Build reports from a fixed HTML/CSS template that matches your example exactly.
4. Export the final report to PDF from that deterministic template.

## Important design note

Use Claude or another design AI tool only for:

- first-pass layout ideas
- HTML/CSS structure exploration
- visual refinements against your sample report

Do not use AI to generate the final report on the fly from scratch.

For exact brokerage reports, the reliable path is:

- AI helps us design the template once
- our app renders the same template every time
- report content is filled from validated comp data

That is the only way to keep the report style exact and keep the numbers trustworthy.

## Next implementation step

1. lock the exact report header/footer/disclaimer layout from the sample PDFs
2. build the fixed HTML template for lease and sale report packets
3. add report filters like market, submarket, date range, and property type
4. add deterministic PDF export from that locked template
