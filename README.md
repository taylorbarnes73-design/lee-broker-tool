## Lee Broker Tool (local dev)

This repo is a **TypeScript Node/Express** server that serves a **Vite + React** frontend. It uses **Drizzle ORM + MySQL** for persistence.

### What was added (auth + RBAC + submissions portal)

- **Password-based local auth** (bcrypt hashing) layered onto the existing signed-cookie session system.
- **Role-based access control**:
  - **Admins**: only users whose **display name** is exactly **"Errissa Kat"** or **"Taylor Barnes"** (case-insensitive match)
  - **Agents**: everyone else (non-admin)
- **Submissions API** with authorization rules:
  - Agents can only see/manage their own submissions
  - Admins can see/manage all submissions
- A simple UI at `/portal` for:
  - Login
  - Dashboard
  - My submissions list + detail
  - Admin: all submissions

### Setup

1) Install deps

```bash
pnpm install
```

On Windows without `pnpm` on PATH, you can run it via `corepack`:

```bash
corepack prepare pnpm@10.4.1 --activate
corepack pnpm install
```

2) Configure env

- Copy `.env.example` → `.env`
- Set at minimum:
  - `DATABASE_URL` (MySQL connection string)
  - `JWT_SECRET`
  - `LOCAL_AUTH_ENABLED=true`
  - (No admin allowlist env vars; admin names are fixed in code)

#### AI / “Deal Assist” setup

The `aiAssist` endpoints (parse, brochure scrape, smart complete, voucher review) use an **OpenAI-compatible** backend.

- Preferred (managed proxy): set `BUILT_IN_FORGE_API_URL` + `BUILT_IN_FORGE_API_KEY`
- Fallback (direct OpenAI): set `OPENAI_API_KEY` (optional: `OPENAI_MODEL`, `OPENAI_API_URL`)

Notes:
- `aiAssist.parse` uses text-only prompts.
- `aiAssist.scrapeBrochure` supports both images and PDFs. **PDFs are parsed to text server-side** before being sent to the model for extraction.
- `aiAssist.smartComplete` and `aiAssist.reviewVoucher` are deterministic and do not call the LLM.

#### Google Maps photos (Comp Reports)

Comp report previews can automatically populate a property photo (Street View) when a comp record has no stored `photo`.

- This uses the same Forge proxy credentials as the AI features:
  - `BUILT_IN_FORGE_API_URL`
  - `BUILT_IN_FORGE_API_KEY`
- If those are not set, the app will simply omit photos (no errors).

3) Run migrations (Drizzle)

```bash
pnpm db:push
```

4) Start dev server (API + Vite)

```bash
pnpm dev
```

Then open:

- `http://localhost:3000/portal` (submissions portal)
- `http://localhost:3000/beta` (existing “beta” UI)
- `http://localhost:3000/` (redirects to `/tool` when authenticated)

### Auth behavior (local)

- Login uses **email + password**.
- If the user doesn’t exist yet (or has no stored password), the first successful login **creates** (or sets) the password hash.
- **Admin role** is assigned only when the normalized display name equals **"errissa kat"** or **"taylor barnes"**.

### Admin identification

Admins are **hardcoded** to exactly:

- `Errissa Kat`
- `Taylor Barnes`

