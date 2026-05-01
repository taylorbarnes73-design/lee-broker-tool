# Broker Admin Inbox → Lee Broker Tool (Power Automate)

This doc describes how to wire the **shared Broker Admin mailbox** into the `lee-broker-tool` so every email becomes a trackable request *with attachments*, and completed DocuSigns automatically:
- store the executed PDF in the tool, and
- attach it to **both** the Dealius **Deal** + **Listing** profiles (when IDs are known).

## Prereqs
- Tool is reachable at a stable URL (local dev is fine for testing).
- Set `CONNECTOR_API_KEY` on the tool server.
- Power Automate can call:
  - `POST /api/v1/inbox/email`
  - `POST /api/v1/docusign/completed`
  with header `x-api-key: <CONNECTOR_API_KEY>`

## Flow A — New email → Create Request in Tool (with attachments)

**Trigger**
- Outlook: “When a new email arrives in a shared mailbox (V3)”
- Mailbox: Broker Admin

**Actions**
1) **Get email (V3)** (optional but helpful for body preview)
2) **Get attachments** and loop
3) **Build a JSON payload**:

```json
{
  "messageId": "<Message Id>",
  "internetMessageId": "<Internet Message Id>",
  "subject": "<Subject>",
  "from": "<From (Address)>",
  "receivedAt": "<DateTimeReceived>",
  "bodyPreview": "<Body preview or trimmed body>",
  "category": "<optional: voucher|docusign|listing|contract|...>",
  "docusignEnvelopeId": "<optional>",
  "dealiusDealId": "<optional>",
  "dealiusListingId": "<optional>",
  "reference": "<optional: address or deal name>",
  "attachments": [
    { "filename": "file.pdf", "mimeType": "application/pdf", "base64Data": "<base64>" }
  ]
}
```

4) **HTTP** → POST to:
- URL: `https://<your-tool-host>/api/v1/inbox/email`
- Headers:
  - `Content-Type: application/json`
  - `x-api-key: ...`
- Body: JSON above

**Result**
- Tool creates a `submission` with `formType=email-request`
- Tool uploads each attachment into its storage and returns `savedAttachments`

## Flow D — DocuSign Completed email → Store executed PDF + attach to Dealius deal + listing

**Trigger**
- Outlook: “When a new email arrives in a shared mailbox (V3)”
- Add a condition for DocuSign “Completed” emails (sender domain + subject contains “Completed”)

**Actions**
1) Extract the executed PDF attachment (DocuSign typically includes it as an attachment).
2) Determine `dealiusDealId` and `dealiusListingId`:
   - Best case: these are already known on the request (Envelope ID match)
   - Fallback: your flow can look up the request in the tool first (future enhancement), or you can pass them when known.
3) HTTP → POST:
- URL: `https://<your-tool-host>/api/v1/docusign/completed`
- Headers:
  - `Content-Type: application/json`
  - `x-api-key: ...`
- Body:

```json
{
  "submissionId": 1234,
  "docusignEnvelopeId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "dealiusDealId": "56789",
  "dealiusListingId": "98765",
  "filename": "Executed_Listing_Agreement.pdf",
  "mimeType": "application/pdf",
  "base64Pdf": "<base64>",
  "documentType": "ListingAgreement"
}
```

**Result**
- Tool stores the PDF in its uploads table (category `docusign-executed`).
- Tool uploads the PDF into Dealius:
  - `POST /api/deals/{DealiusDealId}/documents?token=...`
  - `POST /api/listings/{DealiusListingId}/documents?token=...`

## Notes / gotchas
- Payload size: executed PDFs can be large. Keep the tool server JSON limit at 50MB (it already is).
- If you frequently exceed 50MB, switch the flow to upload the file to SharePoint first and send the URL to the tool (we can add a “fetch-from-URL” endpoint).

