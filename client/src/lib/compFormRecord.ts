export type CompFormValues = Record<string, string>;

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function value(vals: CompFormValues, id: string) {
  return (vals[id] || "").trim();
}

function brokerLine(vals: CompFormValues, prefix: string) {
  return [vals[`${prefix}-brokerage`], vals[`${prefix}-agent1`], vals[`${prefix}-agent2`]]
    .map(part => (part || "").trim())
    .filter(Boolean)
    .join(" - ");
}

/** Sale price per square foot, matching the read-only field on the comp form. */
export function compSalePricePerSf(priceRaw: string | undefined, sfRaw: string | undefined): string {
  const price = parseFloat((priceRaw || "").replace(/[^0-9.]/g, ""));
  const sf = parseFloat((sfRaw || "").replace(/[^0-9.]/g, ""));
  if (!price || !sf) return "";
  return (price / sf).toFixed(2);
}

/**
 * Payload for `compData.submitComp`. Keys match `manualLeaseRecord` / `manualSaleRecord`.
 * State and zip are the values on the form. A blank state stays California.
 */
export function buildCompSubmissionRecord(params: {
  vals: CompFormValues;
  isSale: boolean;
  sourceFallback: string;
  photoUrl?: string | null;
}): Record<string, unknown> {
  const { vals, isSale, sourceFallback, photoUrl } = params;
  const v = (id: string) => value(vals, id);
  const common: Record<string, unknown> = {
    office: "Lee & Associates Newport Beach",
    address: v("c-address"),
    city: v("c-city"),
    state: v("c-state") || "CA",
    zipCode: v("c-zip"),
    market: v("c-market"),
    subMarket: v("c-submarket"),
    projectName: v("c-project"),
    propertyType: v("c-prop-type") || "Industrial",
    propertySubType: v("c-subtype"),
    buildingClass: v("c-bldg-class"),
    constructionType: v("c-const-type"),
    dhDoors: v("c-dh"),
    glDoors: v("c-gl"),
    clearHeight: v("c-clearance"),
    amperage: v("c-amps"),
    sprinklers: v("c-sprinklers"),
    rail: v("c-rail"),
    yard: v("c-yard"),
    source: v("c-source") || sourceFallback || "Broker Submission",
    verifiedBy: v("c-source") || sourceFallback || "Broker Submission",
    lastUpdated: v("c-date") || todayISO(),
    comments: v("c-comments"),
    ...(photoUrl ? { photo: photoUrl } : {}),
  };
  if (isSale) {
    return {
      ...common,
      sourceSheet: "Broker-Comp-Input-Sale",
      yearBuilt: v("cs-year-built"),
      parkingRatio: v("cs-parking"),
      multiTenant: v("cs-multi-ten"),
      listBroker: brokerLine(vals, "cs-list"),
      procBroker: brokerLine(vals, "cs-proc"),
      monthsOnMarket: v("cs-mkt-months"),
      transactionDate: v("cs-txn-date") || v("c-date"),
      buildingSqFt: v("cs-bldg-sf"),
      landSqFt: v("cs-land-sf"),
      officeSqFt: v("cs-office-sf"),
      salePrice: v("cs-sell-price"),
      salePricePerSqFt: compSalePricePerSf(vals["cs-sell-price"], vals["cs-bldg-sf"]),
      capRate: v("cs-cap-rate"),
      transactionType: v("cs-txn-type"),
      buyer: v("cs-buyer"),
      seller: v("cs-seller"),
      askingPrice: v("cs-sell-price"),
    };
  }
  return {
    ...common,
    sourceSheet: "Broker-Comp-Input-Lease",
    yearBuilt: v("c-year-built"),
    parkingRatio: v("c-parking"),
    spaceType: v("c-space-type"),
    multiTenant: v("c-multi-tenant"),
    pol: v("c-pol"),
    listBroker: brokerLine(vals, "c-list"),
    procBroker: brokerLine(vals, "c-proc"),
    monthsOnMarket: v("c-mkt-months"),
    transactionDate: v("c-exec-date") || v("c-date"),
    occupancyDate: v("c-occ-date"),
    expirationDate: v("c-expire-date"),
    leasedSqFt: v("c-leased-sf"),
    rentPerSqFt: v("c-rent-sf"),
    rentType: v("c-rent-type"),
    termInMonths: v("c-term"),
    effectiveRent: v("c-eff-rent"),
    freeRentMonths: v("c-free-rent"),
    rentAdjustments: v("c-escalations"),
    options: v("c-options"),
    tia: v("c-ti"),
    lessee: v("c-lessee"),
    lessor: v("c-lessor"),
    buildingSqFt: v("c-bldg-sf"),
    officeSqFt: v("c-office-sf"),
    nnnCharges: v("c-nnn"),
    landSqFt: v("c-land-sf"),
  };
}
