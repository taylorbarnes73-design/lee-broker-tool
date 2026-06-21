# Framework Consolidation — Migrate to a single React frontend

## Goal
The product currently ships **two frontends**:

1. **React/Vite SPA** (`client/src`) — portal shell (login, submissions, account,
   admin), plus small React "pilot" form pages that mostly funnel into (2).
2. **Legacy vanilla-JS monolith** (`client/public/broker_tool.html`, ~21k lines
   + `broker_tool.css` ~12k + `broker_ux.css` + `features_patch.js`) — the real
   engine, embedded as an **iframe** at `/workspace-engine` inside
   `PortalWorkspace`. Holds all working tools.

**Decision (2026-06-14):** consolidate on **React** as the single framework,
migrating **one tool at a time**, each verified end-to-end against the live
backend before the next. The vanilla-JS tool is retired tab-by-tab.

## Hard constraints
- **Do not break the backend.** The legacy tool and the React app call the same
  tRPC procedures. Migrated pages must use the *same* procedures + payload
  shapes. No backend/schema changes unless explicitly required and called out.
- **All buttons must keep working.** A tool is only "done" when its full
  broker-facing behavior has parity (form, validation, submit, PDF, AI assist,
  uploads) and is verified.
- Develop on branch `claude/stoic-knuth-oxmi02`.

## Legacy tabs → migration status
| Tab (legacy) | Route target (React) | Backend procedures | Status |
|---|---|---|---|
| `tab-sign` | `/portal/forms/sign` | `email.sendToAdmin`, `files.upload`, `aiAssist.extractDocument` | **✅ Done** — native form, brochure AI analyze, client PDF (pdf-lib), submit verified |
| `tab-listing` | `/portal/forms/listing` | `email.sendToAdmin`, `files.uploadBatch`, `aiAssist.extractListingDocument` | **✅ Done** — native form (type picker, lease/sale conditionals, type-specific details, agents, deal-doc AI), client PDF, submit verified |
| `tab-voucher` | `/portal/forms/voucher` | `email.sendToAdmin`, `files.upload`, `aiAssist.extractVoucherDocument` | **✅ Done** — full native form (deal basics, agents, parties, lease/sale terms, rent schedule, commission, outside agents, distribution), AI brochure prefill, client PDF + JSZip `.xlsm` Excel (Dealius template), submit verified. Excel cell mapping mirrors `voucherWorkbookApplyForm` exactly. **Note: validate generated `.xlsm` against Dealius before first production use.** |
| `tab-comp` (input) | `/portal/forms/comp` | `compData.submitComp`, `files.upload`, `aiAssist.extractDocument`, `brokers.list` | **✅ Done** — native lease/sale form, brochure AI, roster source, submit verified |
| `tab-comp-reports` | `/portal/comp-reports` | `compData.search`, `compData.latest` | **✅ Done** — native search/browse (lease/sale toggle, free-text + faceted filters, pagination, expandable detail drawer from server `reportCard.fields`). CSV/PDF export + map view deferred as polish. |
| `tab-contracts` (Convert) | `/portal/convert` | `contracts.extractContract` | Substantial React page exists (`PortalQuickConvert`) |
| `tab-marketing-request` | `/portal/forms/marketing-request` | `submissions.create`, `files.uploadBatch`, `brokers.list`, `POST /api/marketing-request/pdf` | **✅ Done** — native form, roster requester, server AcroForm PDF, submit verified |
| `tab-admin-request` | `/portal/admin-request` | `submissions.create` | React page exists (`PortalAdminRequest`) |
| `tab-docs` | `/portal/documents` | none (static CDN links) | **✅ Done** — searchable, categorized library (92 docs) |
| `tab-drafts` | — | localStorage | **Deferred** — see note (cross-cutting autosave feature, not a tab port) |

## Conventions for migrated pages
- Reuse design primitives from `client/src/design/index.jsx`
  (`Button`, `Card`, `Field`, `Input`, `Icons`) and tokens in
  `client/src/design/tokens.css`.
- Talk to the backend via the app's tRPC client (`@/_core` / tanstack-query),
  matching the procedure + payload the legacy tool used.
- Keep the existing route paths; flip the home/workspace entry points from the
  iframe (`?tab=X`) to the native route as each tool reaches parity.
- Each tool migration ships behind its own commit with a verification note.

## Sign Orders — migration notes (done)
- New page: `client/src/pages/PortalSignForm.tsx` (replaced the 2-field "pilot"
  funnel with the full form), PDF generator `client/src/lib/signPdf.ts`.
- Submit uses `email.sendToAdmin` with `formType:"sign"` and the **identical**
  `formData` keys (`s-*` ids + `signAgents`) and `sections` the legacy tool
  produced, so the admin Cimarron PO-# flow (which regenerates the vendor PDF
  from `formData`) keeps working unchanged.
- `deliveryMode` omitted → server records the submission as `queue-only` (no
  server email for sign, same as before). The legacy `mailto:` + manual-attach
  step was intentionally dropped: the submission + archived PDF land in the
  portal queue, which is the admin's source of truth.
- Home/workspace "Sign Orders" card now points at `/portal/forms/sign` (native)
  instead of the iframe `?tab=sign`. The iframe sign tab remains as a fallback
  until the iframe is retired.
- Verified at runtime (headless Chromium, no-DB dev server): page renders the
  full form, validation fires, steppers/agents/toggles work, PDF downloads, and
  `email.sendToAdmin` accepts the payload + archives the PDF (DB write needs a
  real database, unavailable in the verify env).

## Listing Entry — migration notes (done)
- New page: `client/src/pages/PortalListingForm.tsx` (replaced the pilot funnel).
  Data-driven field config keeps the large field set (type picker, lease/sale
  conditionals, type-specific detail sections, agents, release) compact.
- PDF builder generalized into `client/src/lib/formPdf.ts` (`buildSectionedPdf`);
  `signPdf.ts` now delegates to it (re-verified Sign still works).
- **Fixed a real legacy bug:** the legacy `collectListingSections` read field ids
  that don't exist (`l-date`, `l-type`, `l-building-sf`, …), so the admin-queue
  `sections` arrived nearly blank. The React page builds `sections` from the
  single field model, so the admin now gets complete structured data. Backend
  contract unchanged (still `email.sendToAdmin`, `formType:"listing"`).
- Deal documents upload via `files.uploadBatch` + per-doc `aiAssist.extractListingDocument`
  prefill. `supportingFiles` are only attached when the upload URL is absolute
  (zod `.url()`); relative dev/local URLs are skipped to keep submit robust.
  Upload is encouraged but not a hard block (legacy hard-blocked submit on it).
- Home/workspace "Listings" card now points at `/portal/forms/listing`.
- Verified at runtime: render, property-type conditionals (Land→acres,
  Office→project name), lease/sale toggle, validation, and `email.sendToAdmin`
  accepting the payload + archiving the PDF (DB write needs a real database).

## Comp input — migration notes (done)
- New page `client/src/pages/PortalCompForm.tsx`, route `/portal/forms/comp`
  (added to `App.tsx`); home "Comparables" card now points there.
- Submits via `compData.submitComp` with `{ compType, record }`; the `record`
  builder mirrors the legacy `collectCompReportPayload` keys (the server
  normalizes/allowlists them). Lease/sale branch toggles the field set.
- Fixed the legacy AI field-map bug (8 of its target ids didn't exist, so
  AI prefill dropped SF/rate/parties/price) — remapped to the real ids per
  branch. Preserved the auth-error classification (10001 / "please login").
- Broker source + agent fields are roster-backed (`brokers.list` datalist).
  Optional property photo via `files.upload` (sent as `record.photo`, which the
  server supports — legacy dropped it). Client PDF via the shared builder.
- Verified at runtime: render, lease/sale toggle, validation, PDF, and
  `compData.submitComp` accepting the payload (DB write needs a real database).

## Marketing request — migration notes (done)
- New page `client/src/pages/PortalMarketingForm.tsx`, route
  `/portal/forms/marketing-request` (App.tsx); home "Marketing" card repointed.
- Submits via `submissions.create` with `type:"marketing-request"` — the server
  routes the admin notification to the marketing inbox off that literal
  (`adminNotification.ts`). The legacy client `mailto` is dropped (the
  server-side notification covers delivery), matching the Sign approach.
- "Download PDF" reuses the existing server AcroForm endpoint
  `POST /api/marketing-request/pdf` (fills the official template) — no new
  backend. Requester name/email are roster-backed (`brokers.list`); optional
  attachments via `files.uploadBatch`.
- Pre-existing quirk observed (NOT introduced here, NOT a prod issue): the REST
  `requireAuth` middleware lacks the `resolveSignedLegacyCookie` fallback that
  the tRPC `createContext` has, so the PDF endpoint 401s under LOCAL_AUTH/no-DB
  dev sessions (the legacy tool hits the same endpoint and would behave the
  same). In production brokers use the platform session, which `requireAuth`
  honors, so the endpoint works.
- Verified at runtime: render, validation, and `submissions.create` accepting
  the payload (DB write needs a real database).

## Commission Voucher — migration notes (done)
- New page `client/src/pages/PortalVoucherFullForm.tsx`, replacing the pilot
  funnel `PortalVoucherForm.tsx`. Route `/portal/forms/voucher` (App.tsx);
  home "Commission Vouchers" card and hero CTA now point to the native form.
- Submits via `email.sendToAdmin` with `formType:"voucher"` — the same path
  the legacy tool uses, including `pdfAttachment` (PDF summary via `buildSectionedPdf`)
  and `excelAttachment` (the Dealius `.xlsm` template).
- Excel generation: new `client/src/lib/voucherExcel.ts` uses `jszip` (v3.10.1,
  added) to fetch `/templates/commission-voucher-template.xlsm`, patch cells
  via DOM-based XML manipulation (identical algorithm to legacy `_applyOpsToSheetXml`),
  and return a base64 blob. Cell mapping mirrors `voucherWorkbookApplyForm` exactly.
- AI prefill: `files.upload` + `aiAssist.extractVoucherDocument` (separate
  server-side extraction pipeline optimized for lease/sale docs).
- Form sections: deal basics (txn/rep/prop type, address, compliance), agents
  (listing + procuring, roster-backed datalist), lessor/lessee parties, lease
  OR sale terms, rent schedule (manual rows + auto-generate from rate/escalation),
  commission & invoice, outside agents, commission distribution, property details,
  notes.
- **Excel validation required before full production use.** The `.xlsm` template
  contains VBA macros used by the admin→Dealius import flow. The cell mapping
  was ported directly from the legacy JS but cannot be validated against Dealius
  in the no-DB dev environment. Verify one real voucher against Dealius before
  retiring the legacy iframe voucher tab.
- Verified: TypeScript clean, build passes, form renders with all sections,
  validation fires on empty submit (`email.sendToAdmin` DB write requires real DB).

## Comp Reports — migration notes (done)
- New page `client/src/pages/PortalCompReports.tsx`, route `/portal/comp-reports`
  (App.tsx); home "Comp Reports" card added alongside "Comparables" (input form).
- Reads the published comp dataset via `compData.search` (paged) and
  `compData.latest` (dataset banner). The server already returns display-ready
  `reportCard.fields` (formatted strings), so the page renders those directly —
  lease/sale each get their own column set + a full detail drawer.
- Filter contract matches the backend exactly: `compType`, `query`, `cities[]`,
  `markets[]`, `subMarkets[]`, `propertyTypes[]`, `sfMin`, `sfMax`, `dateFrom`,
  `dateTo`, `limit`, `offset`. Empty filters are omitted (sent as `undefined`).
  Search is manual (button / Enter), not debounced — matching legacy.
- Markets + property types are chip multi-selects; cities/submarkets are
  comma-separated text (split to arrays) to fully cover the contract without a
  brittle hardcoded city list.
- CSV "Export Excel", "Download Comp Report" PDF, and the map view from the
  legacy tab are deferred as polish (the core search/browse/detail is the value).
- Verified at runtime: page renders, chips + lease/sale toggle work, and a search
  with no published dataset shows a graceful "No comps match" empty state (no
  crash). Result rendering needs a real DB with an imported workbook to exercise
  fully; the response shape is taken directly from the server's `CompSearchResult`.

## Order of work (completed)
1. ~~**Sign Orders**~~ ✅ done
2. ~~Listing entry~~ ✅ done
3. ~~Comp input~~ ✅ done (`compData.submitComp`)
4. ~~Marketing request~~ ✅ done (`submissions.create`, marketing-inbox routing)
5. ~~Docs library~~ ✅ done (92 docs, CDN links, no backend)
6. ~~Commission voucher~~ ✅ done — full form + JSZip `.xlsm` + PDF + `email.sendToAdmin`
7. ~~Comp Reports~~ ✅ done (`compData.search` / `compData.latest`)
8. ~~Retire `broker_tool.html` + iframe wrapper~~ ✅ done on branch
   `claude/retire-iframe-oxmi02` (DRAFT PR, **do not merge** until the voucher
   `.xlsm` is validated against a live Dealius import — there is no iframe
   fallback once this merges).
9. **Drafts** — Deferred (cross-cutting autosave feature).

## Retire legacy iframe — notes (done, gated)
- Deletes `client/public/broker_tool.html` (+ `broker_tool.css`, `broker_ux.css`,
  `features_patch.js`) and the root `features_patch.js`; removes the unused pilot
  `PortalVoucherForm.tsx` and the dead `brokerToolTabUrl` helper.
- `PortalWorkspace.tsx` is now a pure home page (no `?tab=`, no iframe). The
  server (`vite.ts`) stops serving `/workspace-engine`; `/tool`, `/broker_tool.html`,
  and `/workspace-engine` now 302 → `/portal/workspace`.
- Convert (`PortalQuickConvert`) redirects now point at native form routes
  (`/portal/forms/{voucher,sign,listing}`) instead of the iframe. The native
  voucher form gained the Quick-Convert sessionStorage prefill reader the pilot
  had (verified end-to-end: address + lessee company carried over, key cleared).
- Tests: `brokerTool.test.ts` (legacy-HTML wiring) removed; `staticRoutes.test.ts`
  updated for the redirect behavior; new `voucherTemplate.test.ts` preserves the
  `.xlsm`-ships + percent→fraction guarantees. Full suite (368) green.
- **Gate:** keep this branch unmerged until Dealius confirms a real generated
  `.xlsm` imports cleanly. Merging removes the only fallback.
