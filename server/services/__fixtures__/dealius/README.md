# Dealius response fixtures

JSON snapshots of representative HTTP-200 bodies the Dealius API returns from
the endpoints the broker tool calls (`/api/properties`, `/api/companies`,
`/api/contacts`, `/api/deals`, `/api/listings`, `/api/deals/brokers`, etc.).

The shapes intentionally cover the edge cases that previously broke `idFrom`
and `listFrom` in `server/services/dealiusEntry.ts`:

- PascalCase top-level (`{ "PropertyID": 12345 }`)
- camelCase top-level (`{ "propertyId": 12345 }`)
- PascalCase `Data` wrapper (`{ "Data": { "PropertyID": 12345 } }`)
- camelCase `data` wrapper (`{ "data": { "propertyId": 12345 } }`)
- Bare integer / numeric string (`12345`, `"12345"`)
- HTTP-200 error envelopes (`{ "Message": "...", "Errors": {...} }`)
- Empty / null responses (`{}`, `null`)
- List responses in both `Data: [...]` and bare-array form

Tests load these via `loadFixture()` in `dealiusFixtures.ts`.
