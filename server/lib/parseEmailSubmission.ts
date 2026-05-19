export type FormType =
  | "voucher"
  | "sign"
  | "listing"
  | "psa"
  | "lease"
  | "price_change"
  | "amendment"
  | "docusign"
  | "invoice"
  | "offer"
  | "comp_request"
  | "activity_report"
  | "general";

export type ParsedEmail = {
  formType: FormType;
  propertyAddress: string | null;
  dollarAmount: string | null;
  contacts: string[];
  summary: string;
  parsedFields: {
    formType: FormType;
    propertyAddress: string | null;
    dollarAmounts: string[];
    contacts: string[];
    summary: string;
  };
};

export type EmailInput = {
  subject?: string | null;
  body?: string | null;
  from?: string | null;
  toEmails?: string[];
  ccEmails?: string[];
};

const BROKER_ADMIN_RE = /broker[\s_-]?admin/i;

export function classifyFormType(subject: string, body: string): FormType {
  const hay = `${subject}\n${body}`.toLowerCase();
  if (/\bcommission\b.*\b(voucher|split)\b|\b(voucher|split)\b.*\bcommission\b/i.test(hay)) return "voucher";
  if (/\bcommission\b/.test(hay) && /\bvoucher\b/.test(hay)) return "voucher";
  if (/\bvoucher\b/.test(hay) && /\bcomm/.test(hay)) return "voucher";
  if (/(sign request|sign order|signage)/.test(hay)) return "sign";
  if (/listing agreement/.test(hay)) return "listing";
  if (/(\bpsa\b|purchase and sale|purchase agreement)/.test(hay)) return "psa";
  if (/price reduction|price change/.test(hay)) return "price_change";
  if (/\bamendment\b/.test(hay)) return "amendment";
  if (/docusign/.test(hay)) return "docusign";
  if (/\binvoice\b/.test(hay)) return "invoice";
  if (/\blease\b/.test(hay)) return "lease";
  if (/\blisting\b/.test(hay)) return "listing";
  return "general";
}

const STREET_SUFFIXES =
  "(?:St(?:reet)?|Ave(?:nue)?|Blvd|Boulevard|Rd|Road|Dr(?:ive)?|Ln|Lane|Way|Pl(?:ace)?|Ct|Court|Cir(?:cle)?|Pkwy|Parkway|Hwy|Highway|Ter(?:race)?|Tr(?:ail)?|Sq(?:uare)?|Loop|Row|Path|Run|Trail|Trce|Walk|Crossing|Cove)";

const STREET_NAME = "[A-Z][A-Za-z'.]+(?:\\s+[A-Z][A-Za-z'.]+){0,4}";

const ADDRESS_RE = new RegExp(
  // Number (with optional range) + optional dir + name(s) + optional suffix + optional , City
  `(\\d{2,6}(?:[-–]\\d{2,6})?\\s+(?:[NSEW]\\.?\\s+)?${STREET_NAME}(?:\\s+${STREET_SUFFIXES}\\.?)?(?:\\s*,?\\s*(?:Suite|Ste|Unit|#)\\s*[\\w-]+)?(?:\\s*,\\s*[A-Z][A-Za-z .'-]+){0,2})`,
  "g"
);

function tidyAddress(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+\./g, ".")
    .trim()
    .replace(/[,;:.]+$/, "");
}

export function extractPropertyAddress(subject: string, body: string): string | null {
  for (const hay of [subject, body]) {
    if (!hay) continue;
    ADDRESS_RE.lastIndex = 0;
    const m = ADDRESS_RE.exec(hay);
    if (m && m[1]) {
      const addr = tidyAddress(m[1]);
      if (/^\d/.test(addr) && addr.length >= 6) return addr;
    }
  }
  return null;
}

const DOLLAR_RE = /\$\s?[\d]{1,3}(?:,\d{3})+(?:\.\d{2})?|\$\s?\d+(?:\.\d{2})?/g;

export function extractDollarAmounts(body: string, limit = 3): string[] {
  if (!body) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of body.matchAll(DOLLAR_RE)) {
    const v = m[0].replace(/\s+/g, "");
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
      if (out.length >= limit) break;
    }
  }
  return out;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export function extractContacts(body: string, exclude: string[] = []): string[] {
  if (!body) return [];
  const excl = new Set(exclude.filter(Boolean).map(s => s.toLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of body.matchAll(EMAIL_RE)) {
    const email = m[0].toLowerCase();
    if (excl.has(email)) continue;
    if (BROKER_ADMIN_RE.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

const SIGNATURE_CUE_RE =
  /^(thanks,?$|thank you,?$|best,?$|regards,?$|sincerely,?$|cheers,?$|sent from |get outlook |--\s*$|__+\s*$|broker admin\b|lee & associates|corporate id\b|errissa kat\b)/i;

export function buildSummary(body: string, maxLines = 2): string {
  if (!body) return "";
  const lines = body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(l => l.trim());
  const collected: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if (SIGNATURE_CUE_RE.test(line)) break;
    if (/^\[cid:|^<https?:|^https?:\/\/nam\d/.test(line)) continue;
    collected.push(line);
    if (collected.length >= maxLines) break;
  }
  return collected.join(" ").replace(/\s+/g, " ").trim();
}

export function parseEmailSubmission(email: EmailInput): ParsedEmail {
  const subject = email.subject ?? "";
  const body = email.body ?? "";
  const formType = classifyFormType(subject, body);
  const propertyAddress = extractPropertyAddress(subject, body);
  const dollarAmounts = extractDollarAmounts(body);
  const exclude = [email.from ?? "", ...(email.toEmails ?? []), ...(email.ccEmails ?? [])];
  const contacts = extractContacts(body, exclude);
  const summary = buildSummary(body);
  return {
    formType,
    propertyAddress,
    dollarAmount: dollarAmounts[0] ?? null,
    contacts,
    summary,
    parsedFields: {
      formType,
      propertyAddress,
      dollarAmounts,
      contacts,
      summary,
    },
  };
}
