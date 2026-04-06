# Lee Broker Tool — TODO

- [x] Initial broker_tool.html with 4 tabs (Listing Entry, Sign Request, Commission Voucher, Comp Input)
- [x] PDF export for all 4 tabs
- [x] Upgrade to full-stack (web-db-user: Express + tRPC + MySQL + Manus Auth)
- [x] Add uploads table to database schema (drizzle/schema.ts)
- [x] Add files.upload tRPC procedure (server/routers.ts) — base64 → S3 → DB metadata
- [x] Add files.list tRPC procedure — list recent uploads with optional category/reference filter
- [x] Add files.getUrl tRPC procedure — get fresh download URL for a file key
- [x] Replace static file inputs in Listing Agreements & Disclosures with S3-backed upload zones
- [x] Add upload zone CSS styles
- [x] Add S3 upload JavaScript (initS3Uploads) in broker_tool.html
- [x] Write and pass vitest tests for files.upload, files.list, files.getUrl
