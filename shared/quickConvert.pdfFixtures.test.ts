import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  mapContractExtractionToVoucherFields,
  normalizeSignExtractFields,
} from "./quickConvert";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8")) as T;
}

function fieldDiff(
  mapped: Record<string, string>,
  expected: Record<string, string>
): { correct: string[]; wrong: { field: string; got: string; want: string }[]; missing: string[] } {
  const correct: string[] = [];
  const wrong: { field: string; got: string; want: string }[] = [];
  const missing: string[] = [];
  for (const [field, want] of Object.entries(expected)) {
    const got = mapped[field] ?? "";
    if (!got) {
      missing.push(field);
    } else if (got === want) {
      correct.push(field);
    } else {
      wrong.push({ field, got, want });
    }
  }
  return { correct, wrong, missing };
}

describe("quickConvert PDF-derived fixtures", () => {
  it("maps KAEV lease extraction to voucher fields (lease → voucher)", () => {
    const extract = loadJson<Record<string, unknown>>("quickConvert-kaev-lease-extract.json");
    const expected = loadJson<Record<string, string>>("quickConvert-kaev-lease-expected.json");
    const mapped = mapContractExtractionToVoucherFields(extract);
    const diff = fieldDiff(mapped, expected);

    expect(diff.wrong, JSON.stringify(diff.wrong)).toEqual([]);
    expect(diff.missing, JSON.stringify(diff.missing)).toEqual([]);
    expect(diff.correct.length).toBe(Object.keys(expected).length);
    expect(mapped.commissionRate).toBeUndefined();
    expect(mapped.procuringAgentName).toBeUndefined();
  });

  it("maps Bake exclusive extraction to sign fields (exclusive → sign)", () => {
    const extract = loadJson<Record<string, unknown>>("quickConvert-bake-exclusive-sign-extract.json");
    const expected = loadJson<Record<string, string>>("quickConvert-bake-exclusive-expected.json");
    const mapped = normalizeSignExtractFields(extract);
    const diff = fieldDiff(mapped, expected);

    expect(diff.wrong, JSON.stringify(diff.wrong)).toEqual([]);
    expect(diff.missing, JSON.stringify(diff.missing)).toEqual([]);
    expect(diff.correct.length).toBe(Object.keys(expected).length);
    expect(mapped.state).toBeUndefined();
    expect(mapped.zip).toBeUndefined();
  });
});
