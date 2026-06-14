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
| `tab-sign` | `/portal/forms/sign` | `submissions.create`, `files.upload`, `aiAssist.*`/`contracts.extractContract` | **In progress** |
| `tab-listing` | `/portal/forms/listing` | `submissions.create`, `files.upload`, `aiAssist.extractListingDocument` | Pilot funnel only |
| `tab-voucher` | `/portal/forms/voucher` | `submissions.create`, `aiAssist.extractVoucherDocument`, `aiAssist.reviewVoucher` | Pilot funnel only |
| `tab-comp` (input) | TBD | `compData.submitComp` | Legacy only |
| `tab-comp-reports` | TBD | `compData.search`, `compData.latest` | Legacy only |
| `tab-contracts` (Convert) | `/portal/convert` | `contracts.extractContract` | Substantial React page exists (`PortalQuickConvert`) |
| `tab-marketing-request` | TBD | `submissions.create` | Legacy only |
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

## Order of work (smallest → largest)
1. **Sign Orders** ← current
2. Listing entry
3. Commission voucher
4. Comp input
5. Comp reports
6. Marketing request
7. Docs / Drafts (low complexity, do together)
8. Retire `broker_tool.html` + iframe wrapper once all tabs are native.
