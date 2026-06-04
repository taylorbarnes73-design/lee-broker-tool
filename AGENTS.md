# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Lee Broker Tool is a full-stack TypeScript app: Express + tRPC backend, Vite + React frontend, Drizzle ORM + MySQL.
Single `package.json` (not a monorepo). Uses `pnpm@10.4.1` (corepack-managed).

### Prerequisites

- **Node.js 22** (available via nvm)
- **pnpm 10.4.1** (available via corepack)
- **MySQL 8.x** (run via Docker — see below)
- **Docker** (needed only for MySQL; install + start `dockerd` if not present)

### Starting MySQL (required service)

```bash
# Start dockerd if not running (in background):
sudo dockerd &

# Start or restart MySQL container:
docker start mysql 2>/dev/null || \
  docker run --name mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=leebrokertool -p 3306:3306 -d mysql:8

# Wait for it to be ready:
until docker exec mysql mysqladmin ping -h localhost -u root -proot --silent 2>/dev/null; do sleep 1; done
```

### Environment (.env)

Copy `.env.example` to `.env`. Minimum config for local dev:

```
DATABASE_URL=mysql://root:root@localhost:3306/leebrokertool
DATABASE_SSL_MODE=disabled
JWT_SECRET=dev-secret-replace-in-production
LOCAL_AUTH_ENABLED=true
LOCAL_AUTH_EMAIL_DOMAIN=lee-associates.com
VITE_ENABLE_AUTH_REDIRECT=false
CONNECTOR_API_KEY=dev-connector-api-key
SETTINGS_ENCRYPTION_KEY=dev-encryption-key
```

### Database schema sync

Use `drizzle-kit push --force` (not `pnpm db:push`) for fresh local databases — the migration SQL files have MySQL version-specific syntax (`ON UPDATE UTC_TIMESTAMP`) that fails on standard MySQL 8.x. `drizzle-kit push` directly syncs the Drizzle schema definition to the database.

### Key commands

| Action | Command |
|--------|---------|
| Install deps | `pnpm install` |
| Type check | `pnpm check` |
| Run tests | `pnpm test` |
| Dev server | `pnpm dev` (Express + Vite on port 3000) |
| Lint/format | `pnpm format` (Prettier) |
| Sync DB schema | `npx drizzle-kit push --force` |

### Dev server URLs

- `http://localhost:3000/portal` — React SPA (submissions portal, admin dashboard)
- `http://localhost:3000/tool` — Legacy broker tool HTML workspace
- `http://localhost:3000/health` — Health check endpoint

### Authentication (local dev)

With `LOCAL_AUTH_ENABLED=true`, the login page at `/portal` accepts usernames (e.g. `tbarnes`) from the built-in broker directory. First login auto-creates the user. Admin role is hardcoded to display names "Errissa Kat" and "Taylor Barnes".

### pnpm build scripts

The `.npmrc` in the repo must contain `onlyBuiltDependencies=@tailwindcss/oxide,esbuild` to allow native addon builds. The update script handles this.

### Gotchas

- The app gracefully handles missing `DATABASE_URL` (returns null from `getDb()`), so it starts without a DB but most features won't work.
- Tests (`pnpm test`) do NOT require a running database — they mock DB access.
- Optional services (AI/LLM, S3, SMTP, OAuth, Microsoft Graph, Dealius, Buildout, Google Maps) all degrade gracefully when unconfigured.
