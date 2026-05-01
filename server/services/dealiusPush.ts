import { DealiusClient, resolveBrokerContactId } from "./dealiusClient";
import { getDealiusUserDirectory } from "./dealiusUserDirectory";

type RentRowInput = { months: number; monthly?: number | null; free?: boolean };
type BrokerRowInput = { name: string; pct?: number | null };

function num(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const normalized = String(raw).replace(/[$,%]/g, "").replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(raw: unknown): string {
  return String(raw ?? "").trim();
}

function parseAddressParts(raw: string): { address?: string; city?: string; state?: string; zip?: string } {
  // Handles: "123 Main St, Costa Mesa, CA 92627" (and minor variations)
  const match = raw.match(
    /^\s*(.+?)(?:,\s*|\s+)([A-Za-z][A-Za-z.\- ]+?)(?:,\s*|\s+)([A-Za-z]{2}|California)(?:\s+(\d{5}(?:-\d{4})?))?\s*$/
  );
  if (!match) return {};
  const [, address, city, state, zip] = match;
  const st = state.toLowerCase() === "california" ? "CA" : state.toUpperCase();
  const zip5 = zip ? zip.replace(/\D/g, "").slice(0, 5) : undefined;
  return { address: address.trim(), city: city.trim(), state: st, zip: zip5 };
}

function feePercentFrom(raw: unknown): number | null {
  const n = num(raw);
  if (n == null) return null;
  // Treat <=1 as a fraction (0.03 -> 3%). Otherwise assume already a percent (3 -> 3%).
  if (n <= 0) return null;
  const pct = n <= 1 ? n * 100 : n;
  return Number.isFinite(pct) ? pct : null;
}

function feePercentFromPayload(p: Record<string, unknown>): number | null {
  // Prefer explicit fee/commission percent inputs. Many sources store these as strings.
  const candidates: unknown[] = [
    p.clientRepFee,
    p.oppositeSideRepFee,
    p.feePercent,
    p.feePct,
    (p as any).commissionRate,
    (p as any).commissionPct,
    (p as any).commRate,
    (p as any).commPct,
    (p as any).saleCommPct,
    (p as any).dx_saleCommPct,
    (p as any).voucherCommissionPct,
    (p as any).voucherCommissionRate,
  ];
  for (const c of candidates) {
    const pct = feePercentFrom(c);
    if (pct != null) return pct;
  }
  return null;
}

function asRentRows(raw: unknown): RentRowInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => ({
      months: Math.max(0, Math.round(num(r?.months) ?? 0)),
      monthly: num(r?.monthly),
      free: Boolean(r?.free) || (num(r?.monthly) ?? 0) === 0,
    }))
    .filter(r => r.months > 0);
}

function asBrokers(raw: unknown): BrokerRowInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b: any) => ({
      name: str(b?.name || b?.brokerName || b?.fullName),
      pct: num(b?.pct ?? b?.percent ?? b?.commissionPct),
    }))
    .filter(b => b.name);
}

function uniqNames(names: Array<string | undefined | null>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const v = String(n ?? "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function repTypeIdFrom(raw: unknown): number {
  // Matches Dealius rep type IDs used by the legacy tool:
  // 1 Buyer Rep, 2 Seller Rep, 3 Tenant Rep, 4 Landlord Rep.
  const v = str(raw).toLowerCase();
  if (!v) return 4;
  if (v.includes("tenant")) return 3;
  if (v.includes("landlord")) return 4;
  if (v.includes("buyer")) return 1;
  if (v.includes("seller")) return 2;
  return 4;
}

function propertyTypeIdFrom(raw: string) {
  const v = raw.toLowerCase();
  const map: Record<string, number> = {
    retail: 1,
    office: 2,
    industrial: 3,
    "multi-family": 4,
    multifamily: 4,
    land: 5,
    medical: 8,
  };
  return map[v] ?? 3;
}

function isLeaseLikePayload(p: Record<string, unknown>): boolean {
  const txn = str((p as any).transactionType ?? (p as any).txnType).toLowerCase();
  if (txn.includes("lease") || txn.includes("leasing")) return true;
  const rep = str((p as any).representationType).toLowerCase();
  if (rep.includes("tenant") || rep.includes("landlord")) return true;
  return false;
}

/** Same address / deal-name resolution as Dealius push (keeps validation in sync). */
export function resolveVoucherLocationForDealius(payload: Record<string, unknown>) {
  const p = payload ?? {};
  const rawAddress = str(p.address || p.propertyAddress || (p as any).property || "");
  const parts = parseAddressParts(rawAddress);
  const address = str(p.address || parts.address || rawAddress);
  const city = str(p.city || parts.city);
  const zip = str(p.zip || p.zipCode || parts.zip);
  const dealName =
    str(p.dealName) ||
    [str(p.transactionType || p.txnType || "Deal") + ":", address].filter(Boolean).join(" ");
  return { address, city, zip, dealName, rawAddress };
}

/**
 * Validates a voucher submission payload before calling Dealius.
 * Mirrors the portal pre-flight checklist; returns 400-friendly errors.
 */
export function validateVoucherPayloadForDealiusPush(
  payload: Record<string, unknown>
): { ok: true } | { ok: false; errors: string[] } {
  const p = payload ?? {};
  const { address, city, zip, dealName } = resolveVoucherLocationForDealius(p);
  const errors: string[] = [];

  if (!address) errors.push("Missing property address (address or propertyAddress).");
  if (!city) errors.push("Missing city (or could not parse from a single-line address).");
  if (!zip) errors.push("Missing zip (or could not parse from a single-line address).");
  if (!dealName) errors.push("Missing deal name (set dealName or transaction type + address).");

  const feePct = feePercentFromPayload(p);
  if (feePct == null || feePct <= 0) {
    errors.push("Missing fee percent (feePercent, commissionRate, or pass overrides.feePercent).");
  }

  if (isLeaseLikePayload(p)) {
    const rentRows = asRentRows(p.rentRows || (p as any).rentSchedule);
    if (rentRows.length === 0) {
      errors.push(
        "Lease-like deal requires at least one rent schedule row (rentRows or rentSchedule with months > 0)."
      );
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

export async function pushVoucherSubmissionToDealius(params: {
  payload: Record<string, unknown>;
}) {
  const p = params.payload ?? {};
  const { address, city, zip, dealName } = resolveVoucherLocationForDealius(p);
  const propType = str(p.propertyType || p.propType || "Industrial");

  const sqft = num(p.sqft || p.dealSF || p.leasedSqFt || p.squareFeet) ?? 1;

  const brokersRaw = asBrokers(p.brokers || (p as any).internalBrokers || (p as any).commissionBrokers);
  const brokerNameFallbacks = uniqNames([
    (p as any).listingAgentName,
    (p as any).procuringAgentName,
    (p as any).brokerName,
    (p as any).agentName,
    (p as any).submittedBy,
  ]).map(name => ({ name, pct: null }));
  const brokers = brokersRaw.length ? brokersRaw : brokerNameFallbacks;
  const rentRows = asRentRows(p.rentRows || (p as any).rentSchedule);
  const feePct = feePercentFromPayload(p);

  const missing: string[] = [];
  if (!address) missing.push("address");
  if (!city) missing.push("city");
  if (!zip) missing.push("zip");
  if (!dealName) missing.push("dealName");
  if (missing.length) {
    throw new Error(`Submission payload missing required field(s): ${missing.join(", ")}`);
  }

  const client = new DealiusClient();
  const token = await client.authenticate();
  const dealiusUserDirectory = getDealiusUserDirectory();

  // Step 1: Create property
  const CA_STATE_ID = 1004;
  const propTypeID = propertyTypeIdFrom(propType);
  const propPayload = {
    Name: address,
    AddressLine1: address,
    City: city || "Unknown",
    StateID: CA_STATE_ID,
    Zip: zip || "00000",
    PropertyTypeID: propTypeID,
    Latitude: 0,
    Longitude: 0,
    SquareFootage: Math.max(1, Math.round(sqft)),
    BuildingSizeSf: Math.max(1, Math.round(sqft)),
  };

  const propRes = await client.request<any>({ token, method: "POST", path: "/properties", data: propPayload });
  const propertyID = propRes.data?.PropertyID || propRes.data?.ID || null;
  if (!propertyID) {
    throw new Error(`Dealius property create failed (HTTP ${propRes.status}).`);
  }

  // Step 2: Create one space
  const spacePayload = {
    Name: address,
    SpaceTypeID: propTypeID,
    SpaceAvailableSf: Math.max(1, Math.round(sqft)),
    StreetAddress: address,
    City: city || "Unknown",
    StateID: CA_STATE_ID,
    Zip: zip || "00000",
  };

  const spRes = await client.request<any>({
    token,
    method: "POST",
    path: `/properties/${propertyID}/spaces`,
    data: spacePayload,
  });
  const propertySpaceID =
    typeof spRes.data === "number" ? spRes.data : spRes.data?.PropertySpaceID || spRes.data?.ID || null;

  // Step 3: Create deal (lease default)
  const repType = num(p.repTypeID || p.repType) ?? repTypeIdFrom((p as any).representationType); // default Landlord Rep
  const dealPayload: Record<string, unknown> = {
    DealName: dealName,
    RepresentationTypeID: repType,
    SpaceTypeID: propTypeID,
    EstimatedCloseDate: new Date().toISOString(),
    PropertyID: propertyID,
    ...(propertySpaceID ? { PropertySpaceID: propertySpaceID } : {}),
    ...(feePct != null ? { ClientRepFee: feePct, OppositeSideRepFee: feePct } : {}),
  };

  const dealRes = await client.request<any>({ token, method: "POST", path: "/deals", data: dealPayload });
  const dealID = dealRes.data?.DealID || dealRes.data?.ID || null;
  if (!dealID) {
    throw new Error(`Dealius deal create failed (HTTP ${dealRes.status}).`);
  }

  // Dealius rent schedule validation requires fee %s to be set on the deal.
  // POST /deals sometimes ignores fee fields depending on deal type; enforce via PUT before rents.
  if (feePct != null) {
    await client.request<any>({
      token,
      method: "PUT",
      path: "/deals",
      data: { DealID: dealID, ClientRepFee: feePct, OppositeSideRepFee: feePct },
    });
  }

  // Step 4: Rents (best-effort with fallback null->0)
  if (rentRows.length) {
    const rentsPrimary = rentRows.map((r, idx) => ({
      PeriodNo: idx + 1,
      Months: r.months,
      MonthlyRatePerSf: r.free ? null : Number(((Number(r.monthly ?? 0) / Math.max(1, sqft)) as number).toFixed(6)),
    }));

    const postRents = async (rents: any[]) =>
      client.request<any>({ token, method: "POST", path: "/deals/rents", data: { DealID: dealID, Rents: rents } });

    let rr = await postRents(rentsPrimary);
    if (rr.status < 200 || rr.status >= 300) {
      const rentsFallback = rentsPrimary.map(r => ({
        ...r,
        MonthlyRatePerSf: r.MonthlyRatePerSf == null ? 0 : r.MonthlyRatePerSf,
      }));
      rr = await postRents(rentsFallback);
      if (rr.status < 200 || rr.status >= 300) {
        // Keep going — rent schedule is the flaky part; admin can fix manually.
      }
    }
  }

  // Step 5: Brokers (best-effort with commission retry)
  if (brokers.length) {
    const rows: any[] = [];
    for (const b of brokers) {
      const contactId = await resolveBrokerContactId({
        client,
        token,
        name: b.name,
        directory: dealiusUserDirectory,
      });
      if (!contactId) continue;
      const pct = (b.pct ?? 0) > 1 ? (b.pct ?? 0) / 100 : b.pct ?? 0;
      rows.push({
        DealID: dealID,
        ContactID: contactId,
        IsLead: rows.length === 0,
        Commission: pct * 100,
      });
    }

    if (rows.length) {
      const postBrokers = async (payloadRows: any[]) =>
        client.request<any>({
          token,
          method: "POST",
          path: "/deals/brokers",
          data: { DealID: dealID, DealBrokers: payloadRows },
        });

      let br = await postBrokers(rows);
      if (br.status < 200 || br.status >= 300) {
        const frac = rows.map(r => ({ ...r, Commission: r.Commission != null ? r.Commission / 100 : r.Commission }));
        br = await postBrokers(frac);
      }
    }
  }

  return { dealID, propertyID, propertySpaceID };
}

