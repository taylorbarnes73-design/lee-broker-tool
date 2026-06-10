## Lee Broker Tool (local dev)

TypeScript **Node/Express** API with a **Vite + React** portal and the legacy **`/tool`** HTML workspace for broker forms. Persistence uses **Drizzle ORM + MySQL**.

### Main URLs

| URL | Purpose |
|-----|---------|
| `/` | Public landing (sign in or open tool) |
| `/tool` | Broker forms workspace (listing, voucher, sign, comp, contracts) |
| `/login` | Portal / platform sign-in |
| `/portal/submissions` | Submission queue (brokers see their own; admins see all) |

### Setup

1. Install dependencies:

```bash
pnpm install
```

On Windows without `pnpm` on PATH:

```bash
corepack prepare pnpm@10.4.1 --activate
corepack pnpm install
```

2. Copy `.env.example` → `.env` and set at minimum:

- `DATABASE_URL` — MySQL connection string
- `JWT_SECRET` — session signing
- `LOCAL_AUTH_ENABLED=true` — password login for brokers/admins
- `ADMIN_EMAIL` — office inbox for send-to-admin emails (defaults to `_NewportBeach-BrokerAdmin@lee-associates.com`)
- `MARKETING_EMAIL` — marketing project request inbox (defaults to `fperkins@lee-associates.com`)
- `SMTP_HOST`, `SMTP_FROM` (and credentials if required) — broker notification emails

Optional:

- `LOCAL_ADMIN_EMAILS` — comma-separated emails treated as admin
- `LOCAL_ADMIN_NAMES` — comma-separated display names treated as admin
- `PUBLIC_APP_URL` — absolute links in broker notification emails (e.g. `http://localhost:3000`)
- `BUILT_IN_FORGE_API_URL` + `BUILT_IN_FORGE_API_KEY` — AI assist and maps proxy

3. Apply schema (fresh local MySQL):

```bash
npx drizzle-kit push --force
```

For environments that already have migration history applied, use `pnpm db:push` instead.

4. Start dev:

```bash
pnpm dev
```

### Admin access

Admins are resolved by `isAdminByPolicy` in `server/auth/isAdminByPolicy.ts`:

1. `LOCAL_ADMIN_EMAILS` (email or Lee username)
2. `LOCAL_ADMIN_NAMES` (display name, case-insensitive)
3. Broker directory entries with **Office Admin** role

Legacy cookie sessions also honor the `admin` role on the `users` table when set.

### Portal features (submissions)

- **Queue** with filters, sort-by-queue, **Claim** from the list, and stale badges for pending items older than 48 hours
- **Detail** tabs: Summary (human-readable fields), Activity (audit timeline), Files, and admin-only Dealius / Payload
- **Email notifications** when `notifications.email_on_submission` and `notifications.email_on_status_change` are enabled in Settings (requires SMTP)

### Broker tool → portal flow

After **Submit to Queue** in `/tool`, brokers get a **Track in portal** link and optional queue position. Receipt and status emails go to `submittedByEmail` when SMTP is configured.

### AI / Deal Assist

`aiAssist` uses an OpenAI-compatible backend (Forge proxy preferred, or `OPENAI_API_KEY`). PDF brochure scrape extracts text server-side before calling the model.

### Quick convert (portal)

Brokers: **`/portal/convert`** (also linked from broker home).

| Action | Behavior |
|--------|----------|
| Lease/agreement → voucher | PDF → `contracts.extractContract` → broker tool voucher tab with AI highlights |
| Exclusive → sign | PDF → `aiAssist.extractDocument` (sign) → broker tool sign tab |
| Exclusive → listing entry | PDF → `aiAssist.extractListingDocument` → broker tool listing tab (industrial/office/retail/land) |
| Convert to PDF | Word/PDF → PDF download (LibreOffice `soffice` for `.doc`/`.docx`) |
| LANB letterhead | Prepends letterhead cover page to your PDF (see `server/assets/templates/README.md`) |

Letterhead template path: `server/assets/templates/lanb-letterhead.dotx` (copy from OneDrive Blank Forms if missing).

Optional env: `QUICK_CONVERT_SOFFICE_PATH` — full path to `soffice` when not on PATH.

### Tests

```bash
pnpm test
```
