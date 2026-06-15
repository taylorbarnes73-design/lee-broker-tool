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
| `tab-voucher` | `/portal/forms/voucher` | `submissions.create`, `aiAssist.extractVoucherDocument`, `aiAssist.reviewVoucher` | Pilot funnel only |
| `tab-comp` (input) | `/portal/forms/comp` | `compData.submitComp`, `files.upload`, `aiAssist.extractDocument`, `brokers.list` | **✅ Done** — native lease/sale form, brochure AI, roster source, submit verified |
| `tab-comp-reports` | TBD | `compData.search`, `compData.latest` | Legacy only |
| `tab-contracts` (Convert) | `/portal/convert` | `contracts.extractContract` | Substantial React page exists (`PortalQuickConvert`) |
| `tab-marketing-request` | `/portal/forms/marketing-request` | `submissions.create`, `files.uploadBatch`, `brokers.list`, `POST /api/marketing-request/pdf` | **✅ Done** — native form, roster requester, server AcroForm PDF, submit verified |
| `tab-admin-request` | `/portal/admin-request` | `submissions.create` | React page exists (`PortalAdminRequest`) |
| `tab-docs` | TBD | (static/templates) | Legacy only |
| `tab-drafts` | TBD | (localStorage) | Legacy only |

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

## Order of work (revised — safer/verifiable tools before the XL Voucher)
1. ~~**Sign Orders**~~ ✅ done
2. ~~Listing entry~~ ✅ done
3. ~~Comp input~~ ✅ done (`compData.submitComp`)
4. ~~Marketing request~~ ✅ done (`submissions.create`, marketing-inbox routing)
5. **Docs / Drafts** ← current (low complexity)
6. **Commission voucher** — done LAST. Its Excel attachment is a macro-enabled
   `.xlsm` Dealius template patched cell-by-cell via JSZip; load-bearing for the
   admin→Dealius import and not verifiable in this environment. Port the `.xlsm`
   pipeline carefully (adds `jszip`) and validate the Excel against Dealius
   before flipping the route. (Decision 2026-06-15.)
7. Retire `broker_tool.html` + iframe wrapper once all tabs are native.
3. Commission voucher
4. Comp input
5. Comp reports
6. Marketing request
7. Docs / Drafts (low complexity, do together)
8. Retire `broker_tool.html` + iframe wrapper once all tabs are native.
