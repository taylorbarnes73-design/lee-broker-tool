/**
 * Broker Profiles — unit tests for the localStorage helpers.
 *
 * These tests exercise the pure data-layer logic (load / save / CRUD) that
 * mirrors the client-side broker_profiles.js functions, implemented here as
 * server-side equivalents for testability.
 */

import { describe, it, expect, beforeEach } from "vitest";

// ── Minimal in-memory localStorage shim ──

class LocalStorageShim {
  private store: Record<string, string> = {};
  getItem(key: string) { return this.store[key] ?? null; }
  setItem(key: string, value: string) { this.store[key] = value; }
  removeItem(key: string) { delete this.store[key]; }
  clear() { this.store = {}; }
}

// ── Pure helper functions (mirrors broker_profiles.js logic) ──

const BP_KEY = "lee_broker_profiles";

interface BrokerProfile {
  name: string;
  title?: string;
  phone?: string;
  fax?: string;
  email: string;
  dre?: string;
  brokerDre?: string;
  company?: string;
  address?: string;
}

function bpLoad(storage: LocalStorageShim): BrokerProfile[] {
  try { return JSON.parse(storage.getItem(BP_KEY) || "[]"); }
  catch { return []; }
}

function bpSave(storage: LocalStorageShim, profiles: BrokerProfile[]) {
  storage.setItem(BP_KEY, JSON.stringify(profiles));
}

function bpAddProfile(storage: LocalStorageShim, profile: BrokerProfile): BrokerProfile[] {
  const profiles = bpLoad(storage);
  profiles.push(profile);
  bpSave(storage, profiles);
  return profiles;
}

function bpUpdateProfile(storage: LocalStorageShim, idx: number, profile: BrokerProfile): BrokerProfile[] {
  const profiles = bpLoad(storage);
  if (idx < 0 || idx >= profiles.length) throw new Error("Index out of range");
  profiles[idx] = profile;
  bpSave(storage, profiles);
  return profiles;
}

function bpDeleteProfile(storage: LocalStorageShim, idx: number): BrokerProfile[] {
  const profiles = bpLoad(storage);
  if (idx < 0 || idx >= profiles.length) throw new Error("Index out of range");
  profiles.splice(idx, 1);
  bpSave(storage, profiles);
  return profiles;
}

// ── Tests ──

describe("Broker Profiles — localStorage helpers", () => {
  let storage: LocalStorageShim;

  beforeEach(() => {
    storage = new LocalStorageShim();
  });

  it("returns empty array when no profiles are stored", () => {
    expect(bpLoad(storage)).toEqual([]);
  });

  it("returns empty array when stored data is invalid JSON", () => {
    storage.setItem(BP_KEY, "not-valid-json{{{");
    expect(bpLoad(storage)).toEqual([]);
  });

  it("adds a profile and persists it", () => {
    const profile: BrokerProfile = {
      name: "Nick Dumke",
      email: "ndumke@lee-associates.com",
      phone: "(949) 724-4755",
      title: "Associate",
      dre: "02123456",
      brokerDre: "01197433",
      company: "Lee & Associates\u00ae-Newport Beach",
      address: "100 Bayview Circle, Suite 600, Newport Beach, CA 92660",
    };
    const profiles = bpAddProfile(storage, profile);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("Nick Dumke");
    expect(profiles[0].email).toBe("ndumke@lee-associates.com");
    // Verify it round-trips through localStorage
    expect(bpLoad(storage)[0].dre).toBe("02123456");
  });

  it("adds multiple profiles", () => {
    bpAddProfile(storage, { name: "Nick Dumke", email: "ndumke@lee.com" });
    bpAddProfile(storage, { name: "Sarah Smith", email: "ssmith@lee.com" });
    expect(bpLoad(storage)).toHaveLength(2);
  });

  it("updates an existing profile by index", () => {
    bpAddProfile(storage, { name: "Nick Dumke", email: "ndumke@lee.com", phone: "(949) 111-0000" });
    bpUpdateProfile(storage, 0, { name: "Nick Dumke", email: "ndumke@lee.com", phone: "(949) 724-4755" });
    expect(bpLoad(storage)[0].phone).toBe("(949) 724-4755");
  });

  it("throws when updating an out-of-range index", () => {
    bpAddProfile(storage, { name: "Nick Dumke", email: "ndumke@lee.com" });
    expect(() => bpUpdateProfile(storage, 5, { name: "X", email: "x@x.com" })).toThrow("Index out of range");
  });

  it("deletes a profile by index", () => {
    bpAddProfile(storage, { name: "Nick Dumke", email: "ndumke@lee.com" });
    bpAddProfile(storage, { name: "Sarah Smith", email: "ssmith@lee.com" });
    const remaining = bpDeleteProfile(storage, 0);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe("Sarah Smith");
  });

  it("throws when deleting an out-of-range index", () => {
    expect(() => bpDeleteProfile(storage, 0)).toThrow("Index out of range");
  });

  it("preserves all optional fields on round-trip", () => {
    const profile: BrokerProfile = {
      name: "Taylor Barnes",
      title: "Transaction Coordinator",
      phone: "(949) 724-4755",
      fax: "(949) 724-4799",
      email: "tbarnes@lee-associates.com",
      dre: "01234567",
      brokerDre: "01197433",
      company: "Lee & Associates\u00ae-Newport Beach",
      address: "100 Bayview Circle, Suite 600, Newport Beach, CA 92660",
    };
    bpAddProfile(storage, profile);
    const loaded = bpLoad(storage)[0];
    expect(loaded.fax).toBe("(949) 724-4799");
    expect(loaded.brokerDre).toBe("01197433");
    expect(loaded.address).toContain("Bayview Circle");
  });
});
