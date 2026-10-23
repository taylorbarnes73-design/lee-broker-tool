import { vi, describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const FIXTURE_ROOT = path.resolve(import.meta.dirname, "__fixtures__", "dealius");
function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(FIXTURE_ROOT, name), "utf8"));
}

// ──────────────────────────────────────────────────────────────────────────────
// Fake DealiusClient — replaces the real axios-backed client.
// Supports two modes:
//   • `scripts`: a strict FIFO of responses (good for createProperty-only tests).
//   • `routes`: a list of (path/method matcher → reply) used by the e2e push test.
// ──────────────────────────────────────────────────────────────────────────────

type RequestCall = { method: string; path: string; data?: unknown };
type Reply = { status: number; data: unknown };
type ReplyFn = (call: RequestCall) => Reply;
type Route = { match: (call: RequestCall) => boolean; reply: ReplyFn };

class FakeDealiusClient {
  public calls: RequestCall[] = [];
  public scripts: ReplyFn[] = [];
  public routes: Route[] = [];

  request(params: { token: string; method: string; path: string; data?: unknown }): Promise<Reply> {
    const call: RequestCall = { method: params.method, path: params.path, data: params.data };
    this.calls.push(call);

    if (this.scripts.length) {
      const fn = this.scripts.shift()!;
      return Promise.resolve(fn(call));
    }
    for (const r of this.routes) {
      if (r.match(call)) return Promise.resolve(r.reply(call));
    }
    throw new Error(`No fake response configured for ${params.method} ${params.path}`);
  }
}

let currentClient: FakeDealiusClient;
const resolveBrokerContactIdMock = vi.fn();

// ──────────────────────────────────────────────────────────────────────────────
// Module mocks. Hoisted by Vitest so they apply to the dealiusEntry import.
// ──────────────────────────────────────────────────────────────────────────────
vi.mock("./dealiusClient", () => ({
  DealiusClient: vi.fn().mockImplementation(() => currentClient),
  resolveBrokerContactId: (args: { name: string }) => resolveBrokerContactIdMock(args),
}));

vi.mock("./dealiusAuth", () => ({
  authenticateConfiguredDealius: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("./dealiusUserDirectory", () => ({
  getDealiusUserDirectory: vi.fn().mockReturnValue([]),
}));

// Imports must come AFTER vi.mock declarations, but Vitest hoists vi.mock so this is fine.
import {
  __dealiusInternals,
  pushDealEntryToDealius,
  pushListingEntryToDealius,
} from "./dealiusEntry";

const { createProperty, resolveCompanyId } = __dealiusInternals;

beforeEach(() => {
  currentClient = new FakeDealiusClient();
  resolveBrokerContactIdMock.mockReset();
  resolveBrokerContactIdMock.mockImplementation(async ({ name }: { name: string }) => 99000 + (name.length % 100));
});

// ──────────────────────────────────────────────────────────────────────────────
// createProperty — directly exercise the helper that parses the create response.
// ──────────────────────────────────────────────────────────────────────────────
describe("createProperty — happy paths", () => {
  it("extracts PropertyID from a PascalCase HTTP 200 body", async () => {
    currentClient.scripts.push(() => ({ status: 200, data: loadFixture("property-create-pascal.json") }));
    const id = await createProperty({
      client: currentClient as any,
      token: "test-token",
      address: "1652 Deere Ave",
      city: "Irvine",
      zip: "92606",
      propertyTypeID: 3,
      sqft: 12500,
      totalBldgSF: 45000,
      yearBuilt: 1998,
      log: { warnings: [], steps: [] },
    });
    expect(id).toBe(90421);
    expect(currentClient.calls).toHaveLength(1);
    expect(currentClient.calls[0]).toMatchObject({ method: "POST", path: "/properties" });
  });

  it("extracts propertyId from a camelCase HTTP 200 body (case-insensitive)", async () => {
    currentClient.scripts.push(() => ({ status: 200, data: loadFixture("property-create-camel.json") }));
    const id = await createProperty({
      client: currentClient as any,
      token: "test-token",
      address: "1401 Dove St",
      city: "Newport Beach",
      zip: "92660",
      propertyTypeID: 2,
      sqft: 4500,
      totalBldgSF: 60000,
      yearBuilt: null,
      log: { warnings: [], steps: [] },
    });
    expect(id).toBe(90422);
  });

  it("extracts PropertyID from a `Data`-wrapped success response", async () => {
    currentClient.scripts.push(() => ({ status: 201, data: loadFixture("property-create-data-wrapper-pascal.json") }));
    const id = await createProperty({
      client: currentClient as any,
      token: "test-token",
      address: "8400 Central Ave",
      city: "Rancho Cucamonga",
      zip: "91730",
      propertyTypeID: 3,
      sqft: 12000,
      totalBldgSF: 45000,
      yearBuilt: 2005,
      log: { warnings: [], steps: [] },
    });
    expect(id).toBe(90423);
  });

  it("extracts propertyId from a camelCase `data`-wrapped success response", async () => {
    currentClient.scripts.push(() => ({ status: 200, data: loadFixture("property-create-data-wrapper-camel.json") }));
    const id = await createProperty({
      client: currentClient as any,
      token: "test-token",
      address: "2200 E Orangewood Ave",
      city: "Anaheim",
      zip: "92806",
      propertyTypeID: 3,
      sqft: 22400,
      totalBldgSF: 22400,
      yearBuilt: 1998,
      log: { warnings: [], steps: [] },
    });
    expect(id).toBe(90424);
  });
});

describe("createProperty — conflict & failure paths", () => {
  it("on HTTP 409, falls back to a SearchTerm GET and returns the existing property id (with warning)", async () => {
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/properties",
      reply: () => ({ status: 409, data: { Message: "Property already exists." } }),
    });
    currentClient.routes.push({
      match: c => c.method === "GET" && c.path.startsWith("/properties?SearchTerm="),
      reply: () => ({ status: 200, data: [{ PropertyID: 70000, Name: "Existing" }] }),
    });

    const log = { warnings: [] as string[], steps: [] as any[] };
    const id = await createProperty({
      client: currentClient as any,
      token: "test-token",
      address: "100 Existing Way",
      city: "Irvine",
      zip: "92618",
      propertyTypeID: 3,
      sqft: 1000,
      totalBldgSF: 1000,
      yearBuilt: null,
      log,
    });
    expect(id).toBe(70000);
    expect(log.warnings.some(w => w.includes("Using existing Dealius property 70000"))).toBe(true);
    expect(currentClient.calls).toHaveLength(2);
  });

  it("throws with Dealius error detail when the create response is an HTTP-200 error envelope", async () => {
    currentClient.scripts.push(() => ({ status: 200, data: loadFixture("property-create-error-envelope.json") }));
    await expect(
      createProperty({
        client: currentClient as any,
        token: "test-token",
        address: "Bad Address",
        city: "Irvine",
        zip: "92618",
        propertyTypeID: 3,
        sqft: 1000,
        totalBldgSF: 1000,
        yearBuilt: null,
        log: { warnings: [], steps: [] },
      })
    ).rejects.toThrow(/Property could not be created/);
  });

  it("throws on HTTP 500 with a generic error", async () => {
    currentClient.scripts.push(() => ({ status: 500, data: "" }));
    await expect(
      createProperty({
        client: currentClient as any,
        token: "test-token",
        address: "Failing",
        city: "Irvine",
        zip: "92618",
        propertyTypeID: 3,
        sqft: 1000,
        totalBldgSF: 1000,
        yearBuilt: null,
        log: { warnings: [], steps: [] },
      })
    ).rejects.toThrow(/HTTP 500/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// resolveCompanyId — exercises listFrom & idFrom in a higher-level workflow.
// ──────────────────────────────────────────────────────────────────────────────
describe("resolveCompanyId", () => {
  it("returns an exact-name match from a PascalCase `Data`-wrapped search", async () => {
    currentClient.routes.push({
      match: c => c.method === "GET" && c.path.startsWith("/companies?"),
      reply: () => ({ status: 200, data: loadFixture("companies-search-data-wrapper.json") }),
    });
    const id = await resolveCompanyId({
      client: currentClient as any,
      token: "test-token",
      name: "Diamond Realty Group",
      log: { warnings: [], steps: [] },
    });
    expect(id).toBe(6620);
    // Should NOT have attempted a POST since we found an exact match.
    expect(currentClient.calls.filter(c => c.method === "POST")).toHaveLength(0);
  });

  it("creates a new company when search returns an empty Data wrapper", async () => {
    currentClient.routes.push({
      match: c => c.method === "GET" && c.path.startsWith("/companies?"),
      reply: () => ({ status: 200, data: loadFixture("companies-search-empty-data-wrapper.json") }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/companies",
      reply: () => ({ status: 201, data: { CompanyID: 80808, Name: "Brand New LLC" } }),
    });
    const id = await resolveCompanyId({
      client: currentClient as any,
      token: "test-token",
      name: "Brand New LLC",
      log: { warnings: [], steps: [] },
    });
    expect(id).toBe(80808);
    expect(currentClient.calls.find(c => c.method === "POST")?.data).toMatchObject({ Name: "Brand New LLC" });
  });

  it("returns null with a warning when both search and create fail", async () => {
    currentClient.routes.push({
      match: c => c.method === "GET" && c.path.startsWith("/companies?"),
      reply: () => ({ status: 500, data: "boom" }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/companies",
      reply: () => ({ status: 500, data: { Message: "internal error" } }),
    });
    const log = { warnings: [] as string[], steps: [] as any[] };
    const id = await resolveCompanyId({
      client: currentClient as any,
      token: "test-token",
      name: "Unresolvable Co",
      log,
    });
    expect(id).toBeNull();
    expect(log.warnings.some(w => w.includes('Could not resolve company "Unresolvable Co"'))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// pushDealEntryToDealius — end-to-end happy path with scripted routes.
// ──────────────────────────────────────────────────────────────────────────────
describe("pushDealEntryToDealius — end-to-end happy path", () => {
  it("walks the full property → space → company → contact → deal → financial → rents → brokers flow", async () => {
    // Property + space
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/properties",
      reply: () => ({ status: 200, data: loadFixture("property-create-pascal.json") }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && /\/properties\/\d+\/spaces/.test(c.path),
      reply: () => ({ status: 200, data: { PropertySpaceID: 4444 } }),
    });

    // Companies (both client + opposite). Use camelCase wrapper for the search to flex listFrom.
    currentClient.routes.push({
      match: c => c.method === "GET" && c.path.startsWith("/companies?"),
      reply: () => ({ status: 200, data: { data: [] } }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/companies",
      reply: c => {
        const name = (c.data as any)?.Name as string;
        return {
          status: 200,
          data: name.includes("Pacific")
            ? { CompanyID: 5511 }
            : { data: { companyId: 5522 } }, // exercise camelCase wrapper on create
        };
      },
    });

    // Contacts
    currentClient.routes.push({
      match: c => c.method === "GET" && c.path.startsWith("/contacts?"),
      reply: () => ({ status: 200, data: [] }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/contacts",
      reply: c => {
        const first = (c.data as any)?.FirstName as string;
        return {
          status: 200,
          data: { ContactID: first === "Lessee" ? 88002 : 88001 },
        };
      },
    });

    // Deal create + link + financial PUT
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/deals",
      reply: () => ({ status: 200, data: loadFixture("deal-create-pascal.json") }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/deals/contacts/add",
      reply: () => ({ status: 200, data: { Success: true } }),
    });
    currentClient.routes.push({
      match: c => c.method === "PUT" && c.path === "/deals",
      reply: () => ({ status: 200, data: { Success: true } }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/deals/rents",
      reply: () => ({ status: 200, data: { Success: true } }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/deals/brokers",
      reply: () => ({ status: 200, data: { Success: true } }),
    });

    const result = await pushDealEntryToDealius({
      entry: {
        dealName: "Leased: 1652 Deere Ave",
        address: "1652 Deere Ave",
        city: "Irvine",
        zip: "92606",
        transactionType: "Lease",
        representationType: "Tenant Rep",
        propertyType: "Industrial",
        sqft: 12500,
        feePercent: 6,
        clientCo: "Pacific Industrial Partners LLC",
        oppositeCo: "Other Side LLC",
        clientContactName: "Lessor Contact",
        clientContactEmail: "lessor@example.com",
        oppositeContactName: "Lessee Contact",
        oppositeContactEmail: "lessee@example.com",
        askingRate: 1.25,
        totalNNN: 4.8,
        rentRows: [{ months: 12, monthly: 12500, free: false }],
        brokers: [{ name: "Tim Arguello", pct: 0.5, lead: true }],
      },
    });

    expect(result.entryMode).toBe("deal");
    expect(result.dealID).toBe(333111);
    expect(result.propertyID).toBe(90421);
    expect(result.propertySpaceID).toBe(4444);
    expect(result.warnings).toEqual([]);

    // Verify the call sequence touched each required Dealius endpoint at least once.
    const paths = new Set(currentClient.calls.map(c => `${c.method} ${c.path.split("?")[0]}`));
    expect(paths.has("POST /properties")).toBe(true);
    expect(paths.has("POST /deals")).toBe(true);
    expect(paths.has("PUT /deals")).toBe(true);
    expect(paths.has("POST /deals/rents")).toBe(true);
    expect(paths.has("POST /deals/brokers")).toBe(true);

    const createPayload = currentClient.calls.find(c => c.method === "POST" && c.path === "/deals")?.data as any;
    expect(createPayload).toMatchObject({
      OppositeSideID: 5522,
      OppositeSide: "Other Side LLC",
      LesseeID: 5511,
      LessorID: 5522,
    });

    const rentPayload = currentClient.calls.find(c => c.method === "POST" && c.path === "/deals/rents")?.data as any;
    expect(rentPayload.RentPerSfType).toBe(1);

    // askingRate is $/SF/month (voucher "Rate/SF/Mo", listing "$1.15/SF/Mo").
    // NNN stays annual because that field is entered as $/SF/yr.
    const financialPayload = currentClient.calls.find(c => c.method === "PUT" && c.path === "/deals")?.data as any;
    expect(financialPayload.LeaseAskingRatePerSf).toBe(1.25);
    expect(financialPayload.LeaseAskingRatePerSfType).toBe(1);
    expect(financialPayload.LeaseNNNPerSF).toBe(4.8);
    expect(financialPayload.LeaseNNNPerSFType).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// pushDealEntryToDealius — diagnostic: warnings include BOTH attempt statuses
// (previously the retry path lost the retry status and reported the first one).
// ──────────────────────────────────────────────────────────────────────────────
describe("pushDealEntryToDealius — financial PUT failure reporting", () => {
  it("reports both the original and retry status when the financial PUT fails twice", async () => {
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/properties",
      reply: () => ({ status: 200, data: { PropertyID: 90421 } }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && /\/properties\/\d+\/spaces/.test(c.path),
      reply: () => ({ status: 200, data: { PropertySpaceID: 4444 } }),
    });
    currentClient.routes.push({
      match: c => c.method === "GET" && c.path.startsWith("/companies?"),
      reply: () => ({ status: 200, data: { Data: [] } }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/companies",
      reply: () => ({ status: 200, data: { CompanyID: 5511 } }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/deals",
      reply: () => ({ status: 200, data: { DealID: 333111 } }),
    });
    currentClient.routes.push({
      match: c => c.method === "PUT" && c.path === "/deals",
      reply: () => ({ status: 500, data: { Message: "boom" } }),
    });
    // No rent rows, no brokers — keep the test focused on the PUT retry warning.

    const result = await pushDealEntryToDealius({
      entry: {
        dealName: "Sold: 1 Main St",
        address: "1 Main St",
        city: "Irvine",
        zip: "92618",
        transactionType: "Sale",
        representationType: "Seller Rep",
        clientCo: "Client LLC",
        feePercent: 3,
        sqft: 1000,
      },
    });

    expect(result.warnings.some(w => /Financial update returned HTTP 500 \(retry HTTP 500\)/.test(w))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// pushListingEntryToDealius — sanity end-to-end happy path.
// Confirms that the camelCase `data: { listingId }` wrapper resolves to a real id.
// ──────────────────────────────────────────────────────────────────────────────
describe("pushDealEntryToDealius - referral deals", () => {
  it("canonicalizes referral name and sends flat commission amount with 100% internal fee", async () => {
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/properties",
      reply: () => ({ status: 200, data: { PropertyID: 90421 } }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && /\/properties\/\d+\/spaces/.test(c.path),
      reply: () => ({ status: 200, data: { PropertySpaceID: 4444 } }),
    });
    currentClient.routes.push({
      match: c => c.method === "GET" && c.path.startsWith("/companies?"),
      reply: () => ({ status: 200, data: { Data: [] } }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/companies",
      reply: () => ({ status: 200, data: { CompanyID: 5511 } }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/deals",
      reply: () => ({ status: 200, data: { DealID: 333111 } }),
    });
    currentClient.routes.push({
      match: c => c.method === "PUT" && c.path === "/deals",
      reply: () => ({ status: 200, data: { Success: true } }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/deals/brokers",
      reply: () => ({ status: 200, data: { Success: true } }),
    });

    const result = await pushDealEntryToDealius({
      entry: {
        dealName: "Referred: 1652 Deere Ave. SEBCO Extra",
        address: "1652 Deere Ave.",
        city: "Irvine",
        zip: "92606",
        transactionType: "Referral",
        repTypeID: 5,
        clientCo: "SEBCO",
        sqft: 15802,
        paymentAmount: 10307.88,
        brokers: [{ name: "WEST, THOMAS", pct: 1, lead: true }],
      },
    });

    expect(result.dealName).toBe("Referred: 1652 Deere Ave.");

    const createPayload = currentClient.calls.find(c => c.method === "POST" && c.path === "/deals")?.data as any;
    expect(createPayload).toMatchObject({
      DealName: "Referred: 1652 Deere Ave.",
      RepresentationTypeID: 5,
      DealTypeID: 3,
      DealStatusID: 1,
      Probability: 100,
      ClientID: 5511,
      Client: "SEBCO",
      ClientRepFee: 100,
      OppositeSideRepFee: 100,
      PaymentAmount: 10307.88,
    });

    const financialPayload = currentClient.calls.find(c => c.method === "PUT" && c.path === "/deals")?.data as any;
    expect(financialPayload).toMatchObject({
      DealName: "Referred: 1652 Deere Ave.",
      ClientRepFee: 100,
      OppositeSideRepFee: 100,
      PaymentAmount: 10307.88,
    });

    const brokerPayload = currentClient.calls.find(c => c.method === "POST" && c.path === "/deals/brokers")?.data as any;
    expect(brokerPayload.DealBrokers[0]).toMatchObject({ Commission: 100 });
  });
});

describe("pushListingEntryToDealius — end-to-end happy path", () => {
  it("creates property, spaces, and listing; resolves listingId from camelCase wrapper", async () => {
    currentClient.routes.push({
      match: c => c.method === "GET" && c.path.startsWith("/companies?"),
      reply: () => ({ status: 200, data: { Data: [] } }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/companies",
      reply: () => ({ status: 200, data: { CompanyID: 5611 } }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/properties",
      reply: () => ({ status: 200, data: { PropertyID: 91000 } }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && /\/properties\/\d+\/spaces/.test(c.path),
      reply: () => ({ status: 200, data: { PropertySpaceID: 4501 } }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && c.path === "/listings",
      reply: () => ({ status: 200, data: loadFixture("listing-create-camel-wrapper.json") }),
    });
    currentClient.routes.push({
      match: c => c.method === "POST" && /\/listings\/\d+\/brokers/.test(c.path),
      reply: () => ({ status: 200, data: { Success: true } }),
    });

    const result = await pushListingEntryToDealius({
      entry: {
        listingName: "For Lease: 9861 Irvine Center Dr",
        address: "9861 Irvine Center Dr",
        city: "Irvine",
        zip: "92618",
        propertyType: "Office",
        sqft: 2400,
        askingRate: 1.15,
        ownerCompany: "Acme Holdings",
        brokers: [{ name: "Taylor Barnes", pct: 6, lead: true }],
      },
    });

    expect(result.entryMode).toBe("listing");
    expect(result.listingID).toBe(12345);
    expect(result.propertyID).toBe(91000);
    expect(result.propertySpaceIDs).toContain(4501);

    const listingPayload = currentClient.calls.find(c => c.method === "POST" && c.path === "/listings")?.data as any;
    expect(listingPayload.AskingRate).toBe(1.15);
    expect(listingPayload.AskingRateType).toBe(1);
  });
});
