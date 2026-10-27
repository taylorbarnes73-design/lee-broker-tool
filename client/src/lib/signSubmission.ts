export type SignOrderFields = {
  date: string;
  orderType: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  cross: string;
  qty4x8: string;
  qty6x8: string;
  otherSize: string;
  otherQty: string;
  bannerSize: string;
  bannerQty: string;
  riderToggle: boolean;
  rider: string;
  placementToggle: boolean;
  requestedBy: string;
  access: string;
  accessContact: string;
  comments: string;
  mapsPin: string;
  support: string;
};

export type SignOrderSection = {
  title: string;
  fields: Array<{ label: string; value: string }>;
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  installation: "Installation",
  removal: "Removal",
  maintenance: "Maintenance",
};

const ACCESS_LABELS: Record<string, string> = { no: "No", yes: "Yes" };

const SUPPORT_LABELS: Record<string, string> = {
  sf: "Single Face (S/F)",
  df: "Double Face (D/F)",
  vshape: "V-Shape",
};

export function signOrderPropertyAddress(
  fields: Pick<SignOrderFields, "address" | "city" | "state" | "zip">
): string {
  const stateZip = [fields.state, fields.zip]
    .map(part => part.trim())
    .filter(Boolean)
    .join(" ");
  return [fields.address, fields.city, stateZip]
    .map(part => part.trim())
    .filter(Boolean)
    .join(", ");
}

/** Sections stored on the submission and printed on the installer PDF. */
export function buildSignOrderSections(fields: SignOrderFields): SignOrderSection[] {
  const location: Array<{ label: string; value: string }> = [
    { label: "Date", value: fields.date },
    { label: "Order Type", value: ORDER_TYPE_LABELS[fields.orderType] ?? fields.orderType },
    { label: "Property Address", value: fields.address },
    { label: "City", value: fields.city },
    { label: "State", value: fields.state },
    { label: "Zip", value: fields.zip },
    { label: "Cross Streets / Building Name", value: fields.cross },
  ];
  const mapsPin = fields.mapsPin.trim();
  if (mapsPin) location.push({ label: "Google Maps Pin", value: mapsPin });
  const support = fields.support.trim();
  if (support) {
    location.push({ label: "Sign Configuration", value: SUPPORT_LABELS[support] ?? support });
  }

  return [
    { title: "Sign Order Details", fields: location },
    {
      title: "Sign Quantities",
      fields: [
        { label: "4x8 Signs", value: fields.qty4x8 },
        { label: "6x8 Signs", value: fields.qty6x8 },
        { label: "Other Size", value: fields.otherSize },
        { label: "Other Qty", value: fields.otherQty },
        { label: "Banner Size", value: fields.bannerSize },
        { label: "Banner Qty", value: fields.bannerQty },
      ],
    },
    {
      title: "Rider & Placement",
      fields: [
        { label: "Name Rider", value: fields.riderToggle ? "Yes" : "No" },
        { label: "Rider Text", value: fields.rider },
        { label: "Custom Placement", value: fields.placementToggle ? "Yes" : "No" },
      ],
    },
    {
      title: "Contact & Access",
      fields: [
        { label: "Requested By", value: fields.requestedBy },
        { label: "Access Necessary", value: ACCESS_LABELS[fields.access] ?? fields.access },
        { label: "Access Contact", value: fields.accessContact },
        { label: "Comments", value: fields.comments },
      ],
    },
  ];
}

/** Machine-readable payload. Location keys are included with the legacy sign ids. */
export function buildSignOrderFormData(
  fields: SignOrderFields,
  agents: Array<{ name: string; pct: string }>
): Record<string, unknown> {
  return {
    "s-date": fields.date,
    "s-order-type": fields.orderType,
    "s-address": fields.address,
    "s-city": fields.city,
    "s-state": fields.state,
    "s-zip": fields.zip,
    "s-cross": fields.cross,
    "s-maps-pin": fields.mapsPin,
    "s-4x8-qty": fields.qty4x8,
    "s-6x8-qty": fields.qty6x8,
    "s-other-size": fields.otherSize,
    "s-other-qty": fields.otherQty,
    "s-banner-size": fields.bannerSize,
    "s-banner-qty": fields.bannerQty,
    "s-rider": fields.rider,
    "s-access": fields.access,
    "s-access-contact": fields.accessContact,
    "s-comments": fields.comments,
    "s-rider-toggle": fields.riderToggle,
    "s-placement-toggle": fields.placementToggle,
    "s-support": fields.support,
    "s-requested-by": fields.requestedBy,
    signAgents: agents
      .filter(agent => agent.name.trim() || agent.pct.trim())
      .map(agent => ({ name: agent.name, pct: agent.pct })),
  };
}
