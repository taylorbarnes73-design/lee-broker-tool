import type { ReactNode } from "react";

export type HelpEntry = {
  title: string;
  body: ReactNode;
};

const quickConvert: HelpEntry = {
  title: "Quick convert — how this page works",
  body: (
    <>
      <p>
        Upload a document once, then pick a conversion: lease/agreement → commission voucher (AI prefill), exclusive
        right → sign request or listing entry form (industrial, office, retail, land), Word → PDF, or LANB letterhead
        PDF.
      </p>
      <h3>After AI prefill</h3>
      <p>
        Extracted fields open the broker tool on the voucher, sign, or listing tab with AI highlights. Review
        everything there, then download the official PDF or Excel voucher. Word → PDF and letterhead downloads complete
        on this page.
      </p>
      <h3>AI prefill workflows</h3>
      <p>
        Lease and exclusive flows require PDF in v1. Extracted fields open the broker tool on the voucher, sign, or
        listing tab with AI highlights — review everything, then download the official PDF or Excel voucher before
        submitting to the office queue.
      </p>
      <h3>PDF & letterhead</h3>
      <p>
        Word → PDF needs LibreOffice (<code>soffice</code>) on the server when the file is not already PDF. Letterhead
        prepends the bundled LANB <code>.dotx</code> template cover page to your document pages (Word or PDF upload).
      </p>
    </>
  ),
};

const dashboard: HelpEntry = {
  title: "Broker workspace — how this page works",
  body: (
    <>
      <p>
        Shared landing page after sign-in. <strong>Guided starts</strong> walk you through common tasks:
        submit a closed deal, add a listing, order a sign, or message the admin team.{" "}
        <strong>Workspace tools</strong> below open the full voucher, listing, sign, comp, and marketing
        workflows in one place.
      </p>
      <h3>Have the paperwork already?</h3>
      <p>
        Use the <strong>Upload a document</strong> banner — drop in a lease, exclusive, or agreement PDF and
        the system reads it and prefills the right form for you.
      </p>
      <h3>In progress summary</h3>
      <p>
        The banner shows how many of your submissions are still pending or being processed. Open{" "}
        <strong>My submissions</strong> for the full submission log and detail pages.
      </p>
    </>
  ),
};

const voucherForm: HelpEntry = {
  title: "Submit a closed deal — how this page works",
  body: (
    <>
      <p>
        Two steps. <strong>Step 1 (this page):</strong> deal basics — transaction type, client, property
        address, square footage. <strong>Step 2:</strong> commission splits, documents, and submit; your
        step-1 answers carry over automatically and show up highlighted.
      </p>
      <h3>What you'll need</h3>
      <ul>
        <li>Property address and client (tenant or buyer) name.</li>
        <li>Deal terms — rate, term, commencement date.</li>
        <li>Signed agreement and closing docs for upload in step 2.</li>
      </ul>
      <h3>Faster: upload the agreement</h3>
      <p>
        If you have the signed lease or purchase agreement as a PDF, use the <strong>Upload &amp;
        prefill</strong> banner — most fields fill in automatically.
      </p>
    </>
  ),
};

const listingForm: HelpEntry = {
  title: "Add a listing — how this page works",
  body: (
    <>
      <p>
        Two steps. <strong>Step 1 (this page):</strong> property type, location, and headline pricing.{" "}
        <strong>Step 2:</strong> expiration dates, contacts, and submit; your step-1 answers carry over
        automatically.
      </p>
      <h3>What you'll need</h3>
      <ul>
        <li>Property address and type.</li>
        <li>Lease rate or asking price.</li>
        <li>Listing agent name (prefilled with yours).</li>
      </ul>
      <h3>Faster: upload the exclusive</h3>
      <p>
        Got the signed exclusive or listing agreement? Use the <strong>Upload &amp; prefill</strong> banner
        and most fields fill in automatically.
      </p>
    </>
  ),
};

const signForm: HelpEntry = {
  title: "Order a sign — how this page works",
  body: (
    <>
      <p>
        Requests installation of a standard Lee &amp; Associates for-lease or for-sale sign at a property.
        Orders are typically fulfilled within 2–3 business days. <strong>Step 1 (this page):</strong>{" "}
        location and contact details. <strong>Step 2:</strong> sign types, quantities, placement photos, and
        submit.
      </p>
      <h3>Tips</h3>
      <ul>
        <li>A <strong>name rider</strong> is the small add-on strip with your name under the main sign.</li>
        <li>Include gate codes or an access contact so the installer can get on site.</li>
      </ul>
    </>
  ),
};

const adminRequest: HelpEntry = {
  title: "Message the admin team — how this page works",
  body: (
    <>
      <p>
        Sends a request or question directly to the admin team — no email app involved. Pick a category,
        write your message, and click <strong>Send to Admin</strong>.
      </p>
      <h3>After you send</h3>
      <ul>
        <li>The admin team receives your request by email immediately.</li>
        <li>It appears under <strong>My submissions</strong> so you can track it.</li>
        <li>Expect a response by email within 1–2 business days.</li>
      </ul>
    </>
  ),
};

const mySubmissions: HelpEntry = {
  title: "My submissions — how this page works",
  body: (
    <>
      <p>
        A chronological log of everything you've submitted to the office, newest first. Open any row for the full record,
        attached files, and current status.
      </p>
      <h3>Statuses</h3>
      <ul>
        <li><strong>Pending</strong> — submitted and waiting for the office to start review.</li>
        <li><strong>In progress</strong> — an admin claimed it and is actively working on it (Dealius, vendors, validation).</li>
        <li><strong>Complete</strong> — approved and processed.</li>
        <li><strong>Rejected</strong> — not accepted; check the detail page or contact admin.</li>
      </ul>
    </>
  ),
};

const submissionDetail: HelpEntry = {
  title: "Submission detail — how this page works",
  body: (
    <>
      <p>
        The full record for a single submission. Read what was submitted, see attached files, and follow the timeline.
      </p>
      <h3>Tabs</h3>
      <ul>
        <li><strong>Summary</strong> — key fields, current status, and what happens next.</li>
        <li><strong>Activity</strong> — status changes over time.</li>
        <li><strong>Files</strong> — uploads (signed forms, broker docs, photos).</li>
      </ul>
      <h3>In progress vs pending</h3>
      <p>
        <strong>Pending</strong> means your request was submitted and is waiting for review. <strong>In progress</strong> means an admin picked it up — you typically do not need to take action unless the office contacts you.
      </p>
      <h3>Admin actions</h3>
      <p>
        Admins can move status between pending, in progress, complete, and rejected from the detail page or
        use <strong>Claim</strong> on the queue list. Each change is recorded on the Activity tab and can email
        the broker when notifications are enabled.
      </p>
    </>
  ),
};

const adminSubmissions: HelpEntry = {
  title: "Admin queue — how this page works",
  body: (
    <>
      <p>
        The review queue for the Newport Beach office. New broker submissions land here, classified by
        form type (Listing, Sign Request, Commission Voucher, etc.). The default <strong>Needs action</strong> tab
        combines the submission queue with Broker Admin inbox email requests in one list.
      </p>
      <h3>Working the queue</h3>
      <ul>
        <li><strong>Needs action</strong> (default) — combined feed from the submission queue and shared inbox.</li>
        <li><strong>Submission queue</strong> — portal and broker-tool submissions (pending / in review).</li>
        <li><strong>Broker Admin Inbox</strong> — email requests; default filter shows items still needing triage.</li>
        <li>Use <strong>Claim</strong> on a queue row to assign it to yourself without opening the detail page.</li>
        <li>Pending items older than 48 hours show a <strong>Stale</strong> badge.</li>
        <li>Open a row for field summary, files, Dealius tools, and the activity timeline.</li>
      </ul>
      <h3>Source labels</h3>
      <p>
        <code>tool</code> (default) means the broker submitted from the HTML workspace or portal.
        <code>email_ingest</code> means it came from the Broker Admin shared inbox.
        <code>email_ingest_backfill</code> means it was imported from a backfill job.
      </p>
    </>
  ),
};

const brokerAdmin: HelpEntry = {
  title: "Broker Admin — how this page works",
  body: (
    <>
      <p>
        Inbox-driven requests from the shared BrokerAdmin mailbox. Anything a broker emails to
        <code> _NewportBeach-BrokerAdmin@lee-associates.com</code> shows up here.
      </p>
      <h3>How items arrive</h3>
      <ul>
        <li>The shared mailbox is polled every 5 minutes.</li>
        <li>Each email is smart-parsed — subject line drives the request type.</li>
        <li>Messages are deduped by <code>message_id</code>, so reprocessing is safe.</li>
      </ul>
      <h3>Statuses</h3>
      <p>
        New → Triaged → In progress → Done (or Cancelled). Triage means an admin has read it and decided
        which workflow it belongs in. Use waiting_on_broker / waiting_on_vendor when you're blocked
        outside the office.
      </p>
    </>
  ),
};

const outlookIngest: HelpEntry = {
  title: "Outlook ingest — how this page works",
  body: (
    <>
      <p>
        Connects the BrokerAdmin shared mailbox to the portal so requests sent by email show up the same
        way as portal submissions.
      </p>
      <h3>How it works</h3>
      <ul>
        <li>Source mailbox: <code>_NewportBeach-BrokerAdmin@lee-associates.com</code></li>
        <li>Poll interval: every 5 minutes (background job)</li>
        <li>Classification: by subject line keywords (sign request, voucher, listing, etc.)</li>
        <li>Dedupe: messages are uniquely keyed by their Microsoft Graph <code>message_id</code>; reruns are safe.</li>
      </ul>
      <h3>Sources you'll see</h3>
      <p>
        <code>source="email_ingest"</code> — pulled by the live poller.<br />
        <code>source="email_ingest_backfill"</code> — pulled from the admin backfill endpoint (manual reprocess of
        historical mail).
      </p>
    </>
  ),
};

const dealiusSettings: HelpEntry = {
  title: "Dealius API — how this page works",
  body: (
    <>
      <p>
        Stores the API credentials and base configuration used to push approved submissions into Dealius.
      </p>
      <h3>What's stored</h3>
      <ul>
        <li>Base URL: <code>https://leenewportbeach.dealius.com</code></li>
        <li>Header name: <code>X-API-KEY</code></li>
        <li>API key: <strong>encrypted at rest</strong>, write-only in this UI. You'll see
          <code> •••• saved</code> once a value is in place; you can replace it but you can't read it back.</li>
      </ul>
      <h3>Limits</h3>
      <p>
        Bulk import is currently disabled — pushes are one submission at a time, triggered from the
        submission detail page when an admin approves the record.
      </p>
    </>
  ),
};

const signRequest: HelpEntry = {
  title: "Sign Request — how this page works",
  body: (
    <>
      <p>
        Submits a request for a new property sign (For Lease, For Sale, etc.). Once submitted, the admin
        team picks it up from the queue, prepares vendor specs, and orders the sign.
      </p>
      <h3>Submitting</h3>
      <ul>
        <li>Fill in the property address, sign type, and any vendor notes.</li>
        <li>Attach photos or layouts if helpful.</li>
        <li>Click submit — there's no auto-scroll, and the submit button is guarded so a double-click
          won't create two submissions.</li>
      </ul>
      <h3>After submitting</h3>
      <p>
        You'll see the new submission on "My submissions" with status <em>Pending</em>. The admin team
        will move it to <em>In review</em>, then <em>Approved</em> once the order is placed.
      </p>
    </>
  ),
};

const commissionVoucher: HelpEntry = {
  title: "Commission Voucher — how this page works",
  body: (
    <>
      <p>
        Submits a commission voucher for a closed deal. Captures the deal terms, the brokers involved,
        commission splits, and the documents the office needs to process payment.
      </p>
      <h3>What you'll enter</h3>
      <ul>
        <li>Deal type (Lease, Sale, Sublease) and the parties.</li>
        <li>Each broker's split and the override / referral rules that apply.</li>
        <li>Deal terms — rent, term length, free rent, commencement date, etc.</li>
        <li>Attached signed agreement and closing statement.</li>
      </ul>
      <h3>After submitting</h3>
      <p>
        Submit guards against double-submission and does not auto-scroll. The voucher lands in the admin
        queue as <em>Pending</em>; admins validate it against Dealius before approving.
      </p>
    </>
  ),
};

const settings: HelpEntry = {
  title: "Settings — how this page works",
  body: (
    <>
      <p>
        Branding and workflow knobs for the portal. Most fields take effect site-wide and are read by the
        broker landing, login, and portal shell.
      </p>
      <h3>What you can change</h3>
      <ul>
        <li>Company name and logo URL (shown in the sidebar header and login).</li>
        <li>Primary brand color (used for the active nav tint and primary CTAs).</li>
        <li>Support email (shown when access is denied).</li>
      </ul>
    </>
  ),
};

const users: HelpEntry = {
  title: "Users — how this page works",
  body: (
    <>
      <p>
        Manage the brokers and admins who can sign into the portal. Only admins can see this page.
      </p>
      <h3>Roles</h3>
      <ul>
        <li><strong>Admin</strong> — full access including the admin queue, settings, and Dealius tools.</li>
        <li><strong>Agent</strong> — broker-facing view: their own submissions and the forms.</li>
      </ul>
      <p>
        Password resets are handled here. Audit-relevant changes are recorded on the audit log.
      </p>
    </>
  ),
};

const listingImport: HelpEntry = {
  title: "Listing import — how this page works",
  body: (
    <>
      <p>
        Upload a brochure or listing PDF and the parser extracts structured fields you can push to
        Buildout. Useful when you have an external listing PDF and don't want to retype it.
      </p>
      <h3>Workflow</h3>
      <ul>
        <li>Drop the PDF onto the upload zone (or paste the text).</li>
        <li>Review the parsed fields — anything missing or unclear is flagged.</li>
        <li>Push the cleaned record to Buildout from the workspace.</li>
      </ul>
    </>
  ),
};

const dealiusTools: HelpEntry = {
  title: "Dealius tools — how this page works",
  body: (
    <>
      <p>
        Admin workspace for pushing approved submissions into Dealius and managing the attachments that go
        with them.
      </p>
      <h3>Notes</h3>
      <ul>
        <li>API key is configured in Settings (encrypted at rest, write-only in the UI).</li>
        <li>Base URL: <code>https://leenewportbeach.dealius.com</code>; auth header is <code>X-API-KEY</code>.</li>
        <li>Bulk import is disabled — pushes happen one record at a time.</li>
      </ul>
    </>
  ),
};

const account: HelpEntry = {
  title: "Account — how this page works",
  body: (
    <>
      <p>
        Your signed-in profile. Platform users can change their password here. Role and permissions are managed by an
        admin from the Users page.
      </p>
    </>
  ),
};

const fallback: HelpEntry = {
  title: "About the Lee Broker Tool",
  body: (
    <>
      <p>
        Internal Newport Beach office tool for capturing listing forms, sign requests, and commission
        vouchers. Submissions route through admin review before they reach Dealius.
      </p>
      <h3>How work gets in</h3>
      <ul>
        <li><strong>Portal</strong> — brokers submit directly via the React forms.</li>
        <li><strong>BrokerAdmin emails</strong> — requests sent to the shared inbox are pulled in every
          5 minutes and dropped into the same queue.</li>
      </ul>
      <p>
        Click the help button on any page for a per-page explainer.
      </p>
    </>
  ),
};

const ROUTE_MAP: ReadonlyArray<{ match: RegExp; entry: HelpEntry }> = [
  { match: /^\/portal\/admin\/?$/, entry: adminSubmissions },
  { match: /^\/portal\/admin\/broker-admin/, entry: brokerAdmin },
  { match: /^\/portal\/admin\/submissions/, entry: adminSubmissions },
  { match: /^\/portal\/admin\/users/, entry: users },
  { match: /^\/portal\/admin\/settings/, entry: settings },
  { match: /^\/portal\/admin\/dealius-tools/, entry: dealiusTools },
  { match: /^\/portal\/admin\/listing-import/, entry: listingImport },
  { match: /^\/portal\/admin\/quick-convert/, entry: quickConvert },
  { match: /^\/portal\/account/, entry: account },
  { match: /^\/portal\/forms\/voucher/, entry: voucherForm },
  { match: /^\/portal\/forms\/listing/, entry: listingForm },
  { match: /^\/portal\/forms\/sign/, entry: signForm },
  { match: /^\/portal\/admin-request/, entry: adminRequest },
  { match: /^\/portal\/submissions\/[^/]+/, entry: submissionDetail },
  { match: /^\/portal\/submissions/, entry: mySubmissions },
  { match: /^\/portal\/convert/, entry: quickConvert },
  { match: /^\/portal\/workspace/, entry: dashboard },
  { match: /^\/portal\/new/, entry: dashboard },
  { match: /^\/portal\/home/, entry: dashboard },
  { match: /^\/portal\/?$/, entry: dashboard },
  { match: /^\/tool\/sign-request/i, entry: signRequest },
  { match: /^\/tool\/commission-voucher/i, entry: commissionVoucher },
  { match: /\/sign[-_]?request/i, entry: signRequest },
  { match: /\/(commission|voucher)/i, entry: commissionVoucher },
  { match: /\/outlook[-_]?ingest/i, entry: outlookIngest },
  { match: /\/email[-_]?ingest/i, entry: outlookIngest },
  { match: /\/dealius[-_]?(api|settings)/i, entry: dealiusSettings },
];

export function getHelpForRoute(pathname: string): HelpEntry {
  for (const { match, entry } of ROUTE_MAP) {
    if (match.test(pathname)) return entry;
  }
  return fallback;
}

export const fallbackHelpEntry = fallback;
