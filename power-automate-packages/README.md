# Power Automate import packages (recommended path)

Power Automate “package (.zip)” imports are picky: the `definition.json` must match the exact connector/runtime schema for your tenant, and small mistakes make the import fail.

The most reliable way to get an importable package for these flows is:

1) In Power Automate, create the flow manually once (5–10 minutes) using the steps in `docs/power-automate/broker-admin-inbox-flows.md`.
2) Export: **My flows → … → Export → Package (.zip)**.
3) Keep that ZIP as your golden template for other environments.

## Why I’m not committing a hand-authored `.zip` here

Hand-written `definition.json` files are fragile across tenants/connectors. Exporting from the UI guarantees:

- correct trigger metadata for **shared mailbox** in your org
- correct `Office 365 Outlook` connection wiring
- correct `HTTP` action schema for your environment

If you still want a repo-hosted ZIP, paste an exported package here (or attach it in chat) and we can safely redact secrets and version it.
