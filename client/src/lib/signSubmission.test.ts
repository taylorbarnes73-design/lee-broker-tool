import { describe, expect, it } from "vitest";
import { buildSignOrderFormData, buildSignOrderSections, signOrderPropertyAddress } from "./signSubmission";

const phoenixInstall = {
  date: "2026-10-27",
  orderType: "installation",
  address: "1 E Washington St",
  city: "Phoenix",
  state: "AZ",
  zip: "85004",
  cross: "At 1st Ave",
  qty4x8: "1",
  qty6x8: "0",
  otherSize: "",
  otherQty: "0",
  bannerSize: "",
  bannerQty: "0",
  riderToggle: false,
  rider: "",
  placementToggle: false,
  requestedBy: "Taylor Barnes",
  access: "yes",
  accessContact: "Gate guard",
  comments: "",
  mapsPin: "https://maps.app.goo.gl/phoenix-pin",
  support: "df",
};

describe("sign order submission", () => {
  it("keeps state, zip, and the maps pin on the installer payload", () => {
    const sections = buildSignOrderSections(phoenixInstall);
    const details = sections.find(section => section.title === "Sign Order Details");
    const byLabel = Object.fromEntries((details?.fields ?? []).map(field => [field.label, field.value]));

    expect(byLabel.State).toBe("AZ");
    expect(byLabel.Zip).toBe("85004");
    expect(byLabel["Google Maps Pin"]).toBe("https://maps.app.goo.gl/phoenix-pin");
    expect(byLabel["Sign Configuration"]).toBe("Double Face (D/F)");

    const formData = buildSignOrderFormData(phoenixInstall, []);
    expect(formData["s-state"]).toBe("AZ");
    expect(formData["s-zip"]).toBe("85004");
    expect(formData["s-maps-pin"]).toBe("https://maps.app.goo.gl/phoenix-pin");
    expect(signOrderPropertyAddress(phoenixInstall)).toBe("1 E Washington St, Phoenix, AZ 85004");
  });
});
