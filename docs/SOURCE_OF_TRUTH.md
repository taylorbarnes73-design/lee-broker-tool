# Broker Tool — Source of Truth

This document settles which files are canonical for each concern of the broker
tool, so edits happen in exactly one place. If you are about to change broker
tool behavior, find your concern in the table below and edit only the files
listed there.

## TL;DR

There is **one** live broker tool. The "standalone HTML" workspace is not a
separate app — it is served by this server at `/tool` and `/broker_tool.html`
(see `server/_core/vite.ts` and `server/_core/index.ts`). The React portal
(`client/src/pages/Portal*.tsx`) is the navigation/intake shell that hands off
to the workspace. Both share the same backend.

The drift risk came from **stale tracked copies** of the workspace, which have
now been removed from the repository (see "Removed duplicates" below).

## Canonical files by concern

| Concern | Source of truth | Notes |
| --- | --- | --- |
| Workspace UI layout (voucher, listing, sign, comp tabs) | `client/public/broker_tool.html` | Single-file HTML + inline JS, served at `/tool`. |
| Workspace UI patches (preflight, analyze panel, prefill banner) | `client/public/features_patch.js` | Loaded alongside `broker_tool.html`. |
| Workspace styling | `client/public/broker_tool.css`, `client/public/broker_ux.css` | Workspace-only; not shared with the React portal. |
| AI parsing / extraction (server) | `server/routers/aiAssist.ts` (+ `server/services/pdfTextScrape.ts`) | One backend used by BOTH the workspace and the portal. Procedures: `parse`, `smartComplete`, `extractDocument`, `extractVoucherDocument`, `extractListingDocument`, `scrapeBrochure`, `reviewVoucher`, `calculateDeal`. |
| Applying extracted fields to workspace inputs | `AI_FIELD_MAP` + `applyAiFields()` in `client/public/broker_tool.html` | Maps extraction keys → workspace element ids. Regression-tested in `server/brokerTool.test.ts`. |
| Portal → workspace prefill contract | `shared/quickConvert.ts` (`VOUCHER_AI_FIELD_KEYS`, `LISTING_AI_FIELD_KEYS`, `SIGN_AI_FIELD_KEYS`, sessionStorage payload) | These lists must stay a subset of `AI_FIELD_MAP` keys — enforced by tests. |
| Portal intake forms (step 1) | `client/src/pages/PortalVoucherForm.tsx`, `PortalListingForm.tsx`, `PortalSignForm.tsx` + `shared/*FormPilot.ts` | Thin wrappers; they collect basics and hand off to the workspace via the prefill payload. |
| Quick Convert (upload → parse → prefill) | `client/src/pages/PortalQuickConvert.tsx` + `server/routers/quickConvert.ts` + `shared/quickConvert.ts` | Calls the same `aiAssist` extraction procedures as the workspace. |
| Voucher calculations (lease/sale, totals, distribution) | `calcCommSummary()`, `calcVoucherLease()`, `calcVoucherSale()`, rent-row helpers in `client/public/broker_tool.html` | Regression-tested in `server/brokerTool.test.ts` and `e2e/smoke/broker-tool.spec.ts`. |
| Voucher Excel download | `voucherWorkbookApplyForm()` + JSZip pipeline in `client/public/broker_tool.html`; template at `client/public/templates/commission-voucher-template.xlsm` | Writes form values into the company's official Excel template, preserving its formulas/formatting. Cell map is snapshot-tested. |
| Voucher Excel *parsing* (uploaded vouchers → Dealius) | `server/services/voucherExcel.ts` | A reader, not a generator — separate concern from the download above. |
| Submission flow (send to admin) | `server/routers/email.ts` (`email.sendToAdmin`) | Used by both the workspace and the portal. |

## Removed duplicates (do not resurrect)

These were tracked copies that caused the drift and were deleted:

- `build_scratch/decoded.html` — a "Lee Broker Tool — Redesign" mockup decode
  artifact. It looked like a polished standalone tool but was never served by
  the app. Now gitignored via `build_scratch/`.
- `build_scratch/line179.txt` — decode scratch.
- `.deploy/artifact/dist/public/broker_tool.html` (+ `.css`, `.zip`) — a stale
  deploy snapshot ~8,000 lines behind the live file. `.deploy/` was already
  gitignored; the tracked files predated the ignore rule.

`dist/` on disk is build output (gitignored, untracked). Never edit it.

## Rules

1. **Never edit two copies.** All workspace changes go to
   `client/public/broker_tool.html` / `features_patch.js`.
2. **Don't fork the parsing.** Extraction behavior lives server-side in
   `aiAssist.ts`. Client-side, only the field *application* differs between
   portal (prefill payload) and workspace (`applyAiFields`).
3. **Keep the contract tests green.** If you add an extraction field, add it to
   `AI_FIELD_MAP` (workspace target) and, if the portal should carry it, to the
   key list in `shared/quickConvert.ts`. The tests in
   `server/brokerTool.test.ts` fail if the lists drift apart or if a mapped
   element id disappears from the HTML.
4. **The Excel template is the company's voucher.** Changes to the voucher
   download must keep `voucherWorkbookApplyForm`'s cell addresses aligned with
   `client/public/templates/commission-voucher-template.xlsm`.

## Known accepted gaps

- `LISTING_AI_FIELD_KEYS` in `shared/quickConvert.ts` includes `commissionRate`,
  but the listing tab has no commission input, so `AI_FIELD_MAP.listing` does
  not map it. The value survives extraction but is dropped on apply. Accepted
  for now (tracked as an allowlisted exception in the contract test); fix by
  either adding a listing commission field or removing the key.
- `AI_FIELD_MAP.listing.buildingType` is workspace-only (not carried by the
  portal prefill). That is fine — the contract requires shared keys ⊆ map keys,
  not equality.
- **Stale AI targets (found during consolidation, needs human confirmation):**
  nine `AI_FIELD_MAP` entries point at element ids that no longer exist, so
  those extracted values are silently dropped on apply:
  `listing.ownerName` (#l-owner-name — owner fields were removed from the
  listing form) and eight comp-tab targets (`c-deal-sf`, `c-lease-rate`,
  `c-commence`, `c-tenant`, `c-landlord`, `c-sale-price`, `c-price-psf`,
  `c-broker-name`). The likely current equivalents are `c-leased-sf`,
  `c-rent-sf`, `c-exec-date`/`c-occ-date`, `c-lessee`, `c-lessor`,
  `cs-sell-price`, `cs-psf-calc`, `c-list-brokerage`/`c-proc-brokerage` — but
  remapping changes behavior, so it was deliberately NOT done in the
  consolidation pass. The list is pinned in `server/brokerTool.test.ts`
  (`knownStaleTargets`); fixing a mapping requires removing it from that list.

## Manual verification checklist (run after touching any canonical file)

1. **Upload & parse (workspace):** `/tool` → Commission Voucher → upload a deal
   PDF → "Analyze" → confirm fields highlight with the AI badge and values land
   in the right inputs.
2. **Upload & parse (portal):** `/portal/quick-convert` → upload the same PDF →
   choose Voucher → confirm the workspace opens with the prefill banner
   ("Prefilled from your document") and the same fields populated.
3. **Voucher calculations:** enter Deal SF 10,000 / term 12 / rate $1.00 →
   Generate schedule → Commission Rate 4 → Total Invoice must read $4,800.00
   and consideration $120,000.
4. **Voucher download:** Review step → "Download Excel" → open the file →
   values must land in the company template (transaction type D4, address B9,
   rent schedule rows 53+, distribution rows 124+), with template formulas
   intact.
5. **Submission:** "Send to Admin" → confirm submission appears in
   `/portal/submissions` and the admin email is sent (check logs/queue in dev).

Automated coverage for 1–4 lives in `server/brokerTool.test.ts`,
`shared/quickConvert.test.ts`, `server/routers/aiAssist.test.ts`, and
`e2e/smoke/broker-tool.spec.ts`; the submission flow is covered by
`server/routers/email.test.ts`.
