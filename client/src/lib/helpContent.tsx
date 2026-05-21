import type { ReactNode } from "react";

export type HelpEntry = {
  title: string;
  body: ReactNode;
};

const dashboard: HelpEntry = {
  title: "Dashboard — how this page works",
  body: (
    <>
      <p>
        The dashboard is your entry point into the Lee Broker Tool. It shows the work that's currently in
        flight — your submissions, queue counts, and quick links to the forms you use most.
      </p>
      <h3>What to look for</h3>
      <ul>
        <li><strong>My submissions</strong> — your in-flight Listings, Sign Requests, and Commission Vouchers.</li>
        <li><strong>Admin queue</strong> — items awaiting admin review (admin only).</li>
        <li><strong>Broker Admin</strong> — requests that came in through the shared inbox (admin only).</li>
      </ul>
      <h3>Tips</h3>
      <p>
        Click any card to drill into the detail page. Use the help button on any page for a per-page
        explainer like this one.
      </p>
    </>
  ),
};

const mySubmissions: HelpEntry = {
  title: "My submissions — how this page works",
  body: (
    <>
      <p>
        Everything you've submitted to the office, with the latest status. Filter by status to narrow the
        list, or click a row to see the full record, files, and admin notes.
      </p>
      <h3>Statuses</h3>
      <ul>
        <li><strong>Pending</strong> — submitted, waiting for admin to pick up.</li>
        <li><strong>In review</strong> — an admin is working on it.</li>
        <li><strong>Approved</strong> — admin has approved; downstream tasks are running.</li>
        <li><strong>Closed</strong> — fully processed (Dealius pushed, voucher signed, etc.).</li>
        <li><strong>Waiting on broker</strong> — admin needs something from you to proceed.</li>
        <li><strong>Rejected</strong> — admin marked it as rejected. Open the detail to see why.</li>
      </ul>
    </>
  ),
};

const submissionDetail: HelpEntry = {
  title: "Submission detail — how this page works",
  body: (
    <>
      <p>
        The full record for a single submission. You can read what was submitted, see attached files, follow
        the timeline, and (admins) take action.
      </p>
      <h3>Tabs</h3>
      <ul>
        <li><strong>Summary</strong> — the structured data captured by the form.</li>
        <li><strong>Files</strong> — uploads (signed forms, broker docs, photos).</li>
        <li><strong>Activity</strong> — status changes, comments, and admin actions.</li>
      </ul>
      <h3>Admin actions</h3>
      <p>
        Admins can move the status between in_review, approved, rejected, waiting_on_broker, and closed.
        Each change is logged on the activity tab and can trigger a downstream task (Dealius push,
        voucher sign, etc.).
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
        form type (Listing, Sign Request, Commission Voucher, etc.).
      </p>
      <h3>Working the queue</h3>
      <ul>
        <li>Filter by status to focus on what needs you (pending or waiting_on_admin).</li>
        <li>Open a row to review the data, files, and any parser warnings.</li>
        <li>Move status to in_review when you pick it up, then approved or rejected when done.</li>
      </ul>
      <h3>Source labels</h3>
      <p>
        <code>source="portal"</code> means the broker submitted through the React tool.
        <code> source="email_ingest"</code> means it came from the BrokerAdmin shared inbox poll.
        <code> source="email_ingest_backfill"</code> means it was imported from the backfill endpoint.
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
        Your own profile. Update your name, password, and notification preferences here.
      </p>
      <p>
        Role and permissions are managed by an admin from the Users page.
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
  { match: /^\/portal\/account/, entry: account },
  { match: /^\/portal\/submissions\/[^/]+/, entry: submissionDetail },
  { match: /^\/portal\/submissions/, entry: mySubmissions },
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
