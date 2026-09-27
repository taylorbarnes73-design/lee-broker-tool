import { PDFParse } from "pdf-parse";

type FieldMap = Record<string, string>;

export type ListingFormSpace = {
  suite: string;
  sqft: number | null;
  askingRate?: number | null;
  availableDate?: string;
  comments?: string;
};

export type ParsedListingFormPdf = {
  propertyType: string;
  transactionType: string;
  listingTransaction: string;
  listingName: string;
  address: string;
  city: string;
  state?: string;
  zip: string;
  suite?: string;
  sqft: number | null;
  totalBldgSF: number | null;
  yearBuilt: number | null;
  askingRate?: number | null;
  askingPrice?: number | null;
  leaseType?: string;
  listingAgentName?: string;
  listingAgentEmail?: string;
  listingAgentPhone?: string;
  listingNotes?: string;
  spaces: ListingFormSpace[];
  _debug?: Record<string, unknown>;
};

function str(raw: unknown): string {
  return String(raw ?? "").trim();
}

function num(raw: unknown): number | null {
  const value = str(raw);
  if (!value) return null;
  const clean = value.replace(/[$,%]/g, "").replace(/,/g, "");
  const match = clean.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanMoneyOrRate(raw: unknown): number | null {
  return num(raw);
}

function checked(fields: FieldMap, name: string): boolean {
  return str(fields[name]).toLowerCase() === "on";
}

function first(fields: FieldMap, names: string[]): string {
  for (const name of names) {
    const value = str(fields[name]);
    if (value && value !== "Pick 1" && value.toLowerCase() !== "off") return value;
  }
  return "";
}

function selected(fields: FieldMap, names: string[]): string {
  return names.find(name => checked(fields, name)) ?? "";
}

function inferPropertyType(text: string, fields: FieldMap): string {
  const upper = text.toUpperCase();
  if (upper.includes("INDUSTRIAL LISTING ENTRY FORM")) return "Industrial";
  if (upper.includes("OFFICE LISTING ENTRY FORM")) return "Office";
  if (upper.includes("RETAIL LISTING ENTRY FORM")) return "Retail";
  if (checked(fields, "Vacant Land")) return "Land";
  return "Industrial";
}

function inferTransaction(fields: FieldMap): { transactionType: string; listingTransaction: string } {
  const lease = checked(fields, "Lease");
  const sale = checked(fields, "Sale");
  const saleLease = checked(fields, "Sale /Lease") || checked(fields, "Sale/Lease") || checked(fields, "Sale Lease");
  const sublease = checked(fields, "Sublease");
  if (sublease) return { transactionType: "Sublease", listingTransaction: "sublease" };
  if ((lease && sale) || saleLease) return { transactionType: "Sale or Lease", listingTransaction: "sale or lease" };
  if (sale) return { transactionType: "Sale", listingTransaction: "sale" };
  return { transactionType: "Lease", listingTransaction: "lease" };
}

function inferLeaseType(fields: FieldMap): string | undefined {
  const picked = selected(fields, ["NNN", "FSG", "MG", "G"]);
  if (!picked) return undefined;
  return picked === "G" ? "Gross" : picked;
}

function listingNameFor(_transactionType: string, address: string) {
  return address || "New Listing";
}

function collectSpaces(fields: FieldMap, propertyType: string): ListingFormSpace[] {
  const spaces: ListingFormSpace[] = [];
  for (let index = 1; index <= 12; index++) {
    const suite = first(fields, [`SUITE Row${index}`, `Suite Row${index}`, `FLR Row${index}`]);
    const sqft = num(first(fields, [`AVAIL SFRow${index}`, `AVAILABLE SFRow${index}`, `Avail SF Row${index}`]));
    const askingRate = cleanMoneyOrRate(first(fields, [`LEASE RATESFRow${index}`, `LEASE RATE/SFRow${index}`, `Lease Rate Row${index}`]));
    const availableDate = first(fields, [`DATE AVAILRow${index}`, `Date Avail Row${index}`]);
    const comments = first(fields, [`COMMENTSRow${index}`, `Comments Row${index}`]);
    if (suite || sqft != null || askingRate != null || comments) {
      spaces.push({ suite, sqft, askingRate, availableDate, comments });
    }
  }

  if (spaces.length === 0 && propertyType === "Industrial") {
    const sqft = num(fields.Size);
    if (sqft != null) spaces.push({ suite: "", sqft });
  }

  return spaces;
}

export function parseListingFormFields(fields: FieldMap, text = ""): ParsedListingFormPdf {
  const propertyType = inferPropertyType(text, fields);
  const transaction = inferTransaction(fields);
  const address = first(fields, ["Address", "Street Address"]);
  const city = first(fields, ["City"]);
  const state = first(fields, ["State"]) || "CA";
  const zip = first(fields, ["Zip", "ZIP"]);
  const spaces = collectSpaces(fields, propertyType);
  const spacesSqft = spaces.reduce((sum, space) => sum + (space.sqft ?? 0), 0);
  const totalBldgSF = num(first(fields, ["GLABldg SF", "Building SF", "Size"]));
  const sqft = spacesSqft > 0 ? spacesSqft : totalBldgSF;
  const suite = spaces.map(space => space.suite).filter(Boolean).join(", ");
  const askingRate = cleanMoneyOrRate(first(fields, ["SF", "LeaseMo"]));
  const askingPrice = cleanMoneyOrRate(first(fields, ["Sale Price"]));
  const rawAgents = [first(fields, ["Listing Agents 1"]), first(fields, ["Listing Agents 2"])];
  const listingAgentName = rawAgents
    .filter(Boolean)
    .filter(name => !name.toLowerCase().includes("lee & assoc") && !name.toLowerCase().includes("lee and assoc"))
    .join("; ");
  const listingNotes = [first(fields, ["Description"]), first(fields, ["Comments"])]
    .filter(Boolean)
    .join("\n\n");

  return {
    propertyType,
    ...transaction,
    listingName: listingNameFor(transaction.transactionType, address),
    address,
    city,
    state,
    zip,
    suite: suite || undefined,
    sqft,
    totalBldgSF,
    yearBuilt: num(first(fields, ["Year Built"])),
    askingRate,
    askingPrice,
    leaseType: inferLeaseType(fields),
    listingAgentName: listingAgentName || undefined,
    listingAgentEmail: first(fields, ["Email"]) || undefined,
    listingAgentPhone: first(fields, ["Phone"]) || undefined,
    listingNotes: listingNotes || undefined,
    spaces,
    _debug: {
      source: "listing_form_pdf",
      fieldCount: Object.keys(fields).length,
    },
  };
}

function setField(fields: FieldMap, key: string, raw: unknown) {
  const name = str(key);
  const value = Array.isArray(raw) ? raw.map(str).filter(Boolean).join(", ") : str(raw);
  if (!name || !value || value === "Off" || value === "Pick 1") return;
  if (fields[name] && fields[name] !== value) fields[name] = `${fields[name]}; ${value}`;
  else fields[name] = value;
}

export async function parseListingFormPdfBuffer(buffer: Buffer): Promise<ParsedListingFormPdf> {
  if (!buffer || buffer.length === 0) {
    throw new Error("PDF buffer is empty.");
  }
  // Verify the buffer actually looks like a PDF before we hand it to the parser –
  // many "PDF" uploads from browsers are actually HTML error pages or zero-byte files
  // and the underlying parser raises an unhelpful generic exception.
  const header = buffer.slice(0, 5).toString("latin1");
  if (!header.startsWith("%PDF-")) {
    throw new Error("File does not appear to be a valid PDF (missing %PDF header).");
  }

  const parser = new PDFParse({ data: buffer });
  try {
    // getText() internally calls load(); by awaiting it first we don't have to
    // touch the parser's private members. The returned text is also passed to the
    // form-field parser for property-type inference.
    const textResult = await parser.getText();
    const fields: FieldMap = {};
    // The pdfjs PDFDocumentProxy lives on the (private) `doc` field. We only read
    // it here, after getText() guarantees it is populated.
    const doc = (parser as unknown as { doc?: { numPages: number; getPage: (n: number) => Promise<unknown> } }).doc;

    if (doc && typeof doc.numPages === "number") {
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
        try {
          const page = (await doc.getPage(pageNumber)) as { getAnnotations: (o: { intent: string }) => Promise<unknown[]> };
          const annotations = await page.getAnnotations({ intent: "display" });
          for (const annotation of annotations as Array<{ fieldName?: string; fieldValue?: unknown }>) {
            if (annotation && annotation.fieldName) {
              setField(fields, annotation.fieldName, annotation.fieldValue);
            }
          }
        } catch {
          // Skip pages we can't read annotations from rather than aborting the whole parse.
        }
      }
    }

    return parseListingFormFields(fields, textResult.text ?? "");
  } finally {
    await parser.destroy?.();
  }
}

export function listingFormPatchFromParsed(parsed: ParsedListingFormPdf): Record<string, unknown> {
  const brokers = parsed.listingAgentName
    ? parsed.listingAgentName
        .split(";")
        .map(name => name.trim())
        .filter(Boolean)
        .map((name, index) => ({ name, pct: index === 0 ? 100 : "", lead: index === 0 }))
    : [];

  const patch: Record<string, unknown> = {
    listingName: parsed.listingName,
    propertyType: parsed.propertyType,
    transactionType: parsed.transactionType,
    listingTransaction: parsed.listingTransaction,
    address: parsed.address,
    city: parsed.city,
    state: parsed.state,
    zip: parsed.zip,
    propertyAddress: [parsed.address, parsed.city, parsed.state, parsed.zip].filter(Boolean).join(", "),
    suite: parsed.suite,
    sqft: parsed.sqft,
    totalBldgSF: parsed.totalBldgSF,
    bldgSF: parsed.totalBldgSF,
    yearBuilt: parsed.yearBuilt,
    askingRate: parsed.askingRate,
    leaseRate: parsed.askingRate,
    askingPrice: parsed.askingPrice,
    totalConsideration: parsed.askingPrice,
    leaseType: parsed.leaseType,
    listingAgentName: parsed.listingAgentName,
    listingAgentEmail: parsed.listingAgentEmail,
    listingAgentPhone: parsed.listingAgentPhone,
    listingNotes: parsed.listingNotes,
    spaces: parsed.spaces,
    brokers,
    listingFormImport: {
      importedAt: new Date().toISOString(),
      parser: "lee_listing_form_pdf_v1",
      debug: parsed._debug ?? null,
    },
  };

  // Blank optional PDF fields become `undefined`, `null`, or "". Callers that
  // shallow-merge this patch into an existing payload must not let JSON.stringify
  // drop or null out those keys and permanently erase prior values.
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}
