# Azure AD app setup for BrokerAdmin email ingest

The BrokerAdmin email ingest reads new messages from the
`_NewportBeach-BrokerAdmin@lee-associates.com` shared mailbox using Microsoft
Graph and the OAuth2 **client_credentials** flow. This requires a one-time
Azure AD app registration that a tenant administrator has consented to.

## 1. Register the app

1. Go to <https://portal.azure.com> → **Azure Active Directory** → **App
   registrations** → **New registration**.
2. **Name**: `Lee Broker Tool — BrokerAdmin Ingest`
3. **Supported account types**: *Accounts in this organizational directory
   only (single tenant)*.
4. **Redirect URI**: leave blank.
5. Click **Register**.
6. After creation, copy:
   - **Application (client) ID**
   - **Directory (tenant) ID**

## 2. Create a client secret

1. In the app, go to **Certificates & secrets** → **Client secrets** → **New
   client secret**.
2. Description: `Lee Broker Tool BrokerAdmin Ingest`. Expires: **24 months**
   (rotate before expiry).
3. Click **Add**.
4. **Immediately** copy the **Value** column (not Secret ID) — it is shown
   only once.

## 3. Grant Mail.Read application permission

1. **API permissions** → **Add a permission** → **Microsoft Graph** →
   **Application permissions**.
2. Search for **Mail.Read** → check it → **Add permissions**.
3. Click **Grant admin consent for [tenant]** (requires a tenant admin).

> Note: `Mail.Read` (application) grants access to **every** mailbox in the
> tenant unless you scope it with an application access policy (next step).
> Always scope it.

## 4. (Strongly recommended) Restrict to the BrokerAdmin mailbox

In Exchange Online PowerShell, run:

```powershell
Connect-ExchangeOnline

New-ApplicationAccessPolicy `
  -AppId <ClientId> `
  -PolicyScopeGroupId _NewportBeach-BrokerAdmin@lee-associates.com `
  -AccessRight RestrictAccess `
  -Description "Lee Broker Tool ingest, BrokerAdmin only"

Test-ApplicationAccessPolicy `
  -Identity _NewportBeach-BrokerAdmin@lee-associates.com `
  -AppId <ClientId>
```

`Test-ApplicationAccessPolicy` should return `AccessCheckResult: Granted`. Try
it against another mailbox; it should return `Denied`.

## 5. Configure the tool

1. Open the portal → **Admin** → **Settings** → **Integrations**.
2. Scroll to **Email Ingest — BrokerAdmin shared mailbox**.
3. Paste:
   - **Mailbox address** — defaults to `_NewportBeach-BrokerAdmin@lee-associates.com`.
   - **Tenant ID** (from step 1).
   - **Client ID** (from step 1).
   - **Client Secret** (from step 2 — the *value*, not the secret ID).
4. Toggle **Enabled** to on.
5. Click **Save settings** → **Test connection**. A success toast confirms
   the credentials and Mail.Read consent are working.
6. Click **Run now** to ingest the current backlog (last 24h on first run).

The scheduled poller runs every 5 minutes and dedupes via the Graph
`message id` + `Internet Message-ID`.

## Troubleshooting

- **401/403 on Test connection** — Mail.Read application permission was not
  granted, admin consent has not been clicked, or the client secret expired.
- **Empty result set** — the BrokerAdmin mailbox has no messages received
  since the last poll; rotate the start of the test window with **Run now**.
- **403 on a single mailbox but the app works elsewhere** — the application
  access policy in step 4 is not scoped to include this mailbox. Re-run
  `Test-ApplicationAccessPolicy`.
