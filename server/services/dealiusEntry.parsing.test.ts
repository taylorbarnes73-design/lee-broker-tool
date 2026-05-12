import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { __dealiusInternals } from "./dealiusEntry";

const { idFrom, listFrom, unwrapDealiusEntity, dealiusErrorDetail } = __dealiusInternals;

const FIXTURE_ROOT = path.resolve(import.meta.dirname, "__fixtures__", "dealius");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(FIXTURE_ROOT, name), "utf8"));
}

describe("unwrapDealiusEntity", () => {
  it("returns the value behind a PascalCase `Data` wrapper", () => {
    const body = loadFixture("property-create-data-wrapper-pascal.json");
    const inner = unwrapDealiusEntity(body) as Record<string, unknown>;
    expect(inner.PropertyID).toBe(90423);
    expect(inner.City).toBe("Rancho Cucamonga");
  });

  it("returns the value behind a camelCase `data` wrapper", () => {
    const body = loadFixture("property-create-data-wrapper-camel.json");
    const inner = unwrapDealiusEntity(body) as Record<string, unknown>;
    expect(inner.propertyId).toBe(90424);
  });

  it("returns the original object when there is no wrapper", () => {
    const body = { PropertyID: 1 };
    expect(unwrapDealiusEntity(body)).toBe(body);
  });

  it("leaves arrays untouched (treats them as already-listy bodies)", () => {
    const arr = [{ PropertyID: 1 }];
    expect(unwrapDealiusEntity(arr)).toBe(arr);
  });

  it("returns null/undefined unchanged", () => {
    expect(unwrapDealiusEntity(null)).toBeNull();
    expect(unwrapDealiusEntity(undefined)).toBeUndefined();
  });

  it("does NOT unwrap if `Data` is null (keeps original body so error envelopes are still readable)", () => {
    const body = { Data: null, Message: "Something exploded" };
    expect(unwrapDealiusEntity(body)).toBe(body);
  });
});

describe("idFrom — happy paths across PascalCase/camelCase/wrapped/bare shapes", () => {
  it("extracts PropertyID from a PascalCase top-level response", () => {
    const body = loadFixture("property-create-pascal.json");
    expect(idFrom(body, ["PropertyID", "ID", "id"])).toBe(90421);
  });

  it("extracts propertyId from a camelCase top-level response (case-insensitive key match)", () => {
    const body = loadFixture("property-create-camel.json");
    expect(idFrom(body, ["PropertyID", "ID", "id"])).toBe(90422);
  });

  it("extracts PropertyID from a `Data`-wrapped response", () => {
    const body = loadFixture("property-create-data-wrapper-pascal.json");
    expect(idFrom(body, ["PropertyID", "ID", "id"])).toBe(90423);
  });

  it("extracts propertyId from a camelCase `data`-wrapped response", () => {
    const body = loadFixture("property-create-data-wrapper-camel.json");
    expect(idFrom(body, ["PropertyID", "ID", "id"])).toBe(90424);
  });

  it("accepts a bare integer body", () => {
    const body = loadFixture("property-create-bare-int.json");
    expect(idFrom(body, ["PropertyID", "ID", "id"])).toBe(90425);
  });

  it("accepts a stringified integer body (Dealius occasionally returns IDs as strings)", () => {
    const body = loadFixture("property-create-string-int.json");
    expect(idFrom(body, ["PropertyID", "ID", "id"])).toBe(90426);
  });

  it("returns the bare integer even when keys list is empty", () => {
    expect(idFrom(42, [])).toBe(42);
  });
});

describe("idFrom — failure / edge cases", () => {
  it("returns null for an empty object", () => {
    const body = loadFixture("property-create-empty.json");
    expect(idFrom(body, ["PropertyID", "ID", "id"])).toBeNull();
  });

  it("returns null for a null body (HTTP 200 with no payload)", () => {
    const body = loadFixture("property-create-null.json");
    expect(idFrom(body, ["PropertyID", "ID", "id"])).toBeNull();
  });

  it("returns null for an HTTP-200 error envelope with no id field", () => {
    const body = loadFixture("property-create-error-envelope.json");
    expect(idFrom(body, ["PropertyID", "ID", "id"])).toBeNull();
  });

  it("returns null for an HTTP-200 error envelope wrapped under camelCase `data: null`", () => {
    const body = loadFixture("property-create-error-camel-data.json");
    expect(idFrom(body, ["PropertyID", "ID", "id"])).toBeNull();
  });

  it("treats 0 / negative ids as invalid (positiveInt-only)", () => {
    expect(idFrom({ PropertyID: 0 }, ["PropertyID"])).toBeNull();
    expect(idFrom({ PropertyID: -7 }, ["PropertyID"])).toBeNull();
  });

  it("ignores non-numeric string ids that aren't integers", () => {
    expect(idFrom({ PropertyID: "not-a-number" }, ["PropertyID"])).toBeNull();
  });

  it("returns null when value is an array of records (callers should use listFrom)", () => {
    expect(idFrom([{ PropertyID: 1 }], ["PropertyID"])).toBeNull();
  });
});

describe("listFrom — collection extraction", () => {
  it("returns a bare array unchanged", () => {
    const body = loadFixture("companies-search-pascal.json");
    const list = listFrom(body);
    expect(list).toHaveLength(2);
    expect(list[0].CompanyID).toBe(5511);
  });

  it("unwraps a PascalCase `Data` collection", () => {
    const body = loadFixture("companies-search-data-wrapper.json");
    const list = listFrom(body);
    expect(list).toHaveLength(2);
    expect(list[0].CompanyID).toBe(6620);
  });

  it("unwraps a camelCase `data` collection", () => {
    const body = loadFixture("companies-search-camel-data.json");
    const list = listFrom(body);
    expect(list).toHaveLength(2);
    expect(list[0].companyId).toBe(7700);
  });

  it("returns an empty array for `{ Data: [] }`", () => {
    const body = loadFixture("companies-search-empty-data-wrapper.json");
    expect(listFrom(body)).toEqual([]);
  });

  it("returns [] for null, undefined, primitives, and non-list objects", () => {
    expect(listFrom(null)).toEqual([]);
    expect(listFrom(undefined)).toEqual([]);
    expect(listFrom("hello")).toEqual([]);
    expect(listFrom(42)).toEqual([]);
    expect(listFrom({ PropertyID: 1 })).toEqual([]);
  });
});

describe("dealiusErrorDetail — surfaces useful diagnostics from 200 + error bodies", () => {
  it("pulls Message from a PascalCase error envelope", () => {
    const body = loadFixture("property-create-error-envelope.json");
    const msg = dealiusErrorDetail(body);
    expect(msg).toContain("Property could not be created");
  });

  it("pulls errorMessage from a camelCase wrapped error envelope", () => {
    const body = loadFixture("property-create-error-camel-data.json");
    const msg = dealiusErrorDetail(body);
    expect(msg).toContain("Duplicate property exists");
  });

  it("returns the string body verbatim when Dealius responds with a raw string", () => {
    expect(dealiusErrorDetail("  Bad Request  ")).toBe("Bad Request");
  });

  it("returns '' for null/undefined", () => {
    expect(dealiusErrorDetail(null)).toBe("");
    expect(dealiusErrorDetail(undefined)).toBe("");
  });

  it("returns a JSON dump for a body with no recognized message field", () => {
    const msg = dealiusErrorDetail({ foo: "bar", qux: 1 });
    expect(msg).toContain("foo");
    expect(msg).toContain("bar");
  });

  it("truncates very long bodies", () => {
    const msg = dealiusErrorDetail({ blob: "x".repeat(5000) });
    expect(msg.length).toBeLessThanOrEqual(401);
    expect(msg.endsWith("…")).toBe(true);
  });
});
