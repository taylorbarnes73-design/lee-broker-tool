import { DealiusClient, resolveBrokerContactId } from "./dealiusClient";

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

export async function pushVoucherSubmissionToDealius(params: {
  payload: Record<string, unknown>;
}) {
  const p = params.payload ?? {};
  const address = str(p.address || p.propertyAddress);
  const city = str(p.city);
  const zip = str(p.zip || p.zipCode);
  const propType = str(p.propertyType || p.propType || "Industrial");

  const sqft = num(p.sqft || p.dealSF || p.leasedSqFt || p.squareFeet) ?? 1;
  const dealName =
    str(p.dealName) ||
    [str(p.transactionType || p.txnType || "Deal") + ":", address].filter(Boolean).join(" ");

  const brokers = asBrokers(p.brokers || (p as any).internalBrokers || (p as any).commissionBrokers);
  const rentRows = asRentRows(p.rentRows || (p as any).rentSchedule);

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
  const repType = num(p.repTypeID || p.repType) ?? 4; // default Landlord Rep
  const dealPayload: Record<string, unknown> = {
    DealName: dealName,
    RepresentationTypeID: repType,
    SpaceTypeID: propTypeID,
    EstimatedCloseDate: new Date().toISOString(),
    PropertyID: propertyID,
    ...(propertySpaceID ? { PropertySpaceID: propertySpaceID } : {}),
  };

  const dealRes = await client.request<any>({ token, method: "POST", path: "/deals", data: dealPayload });
  const dealID = dealRes.data?.DealID || dealRes.data?.ID || null;
  if (!dealID) {
    throw new Error(`Dealius deal create failed (HTTP ${dealRes.status}).`);
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
      const contactId = await resolveBrokerContactId({ client, token, name: b.name });
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

