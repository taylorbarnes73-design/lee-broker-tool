import { describe, expect, it } from "vitest";
import { agentHousesForVoucher, LEE_NEWPORT_HOUSE } from "./voucherAgentHouses";

const untouchedBothLee = {
  sameAgent: false,
  laHouse: LEE_NEWPORT_HOUSE,
  laHouseTouched: false,
  paHouse: LEE_NEWPORT_HOUSE,
  paHouseTouched: false,
};

describe("agentHousesForVoucher", () => {
  it("keeps Lee off the listing house for an untouched tenant-rep voucher", () => {
    expect(
      agentHousesForVoucher({ ...untouchedBothLee, repType: "Tenant Rep" })
    ).toEqual({
      laHouse: "",
      paHouse: LEE_NEWPORT_HOUSE,
    });
  });

  it("puts Lee on the listing house only for landlord and seller rep", () => {
    expect(
      agentHousesForVoucher({ ...untouchedBothLee, repType: "Landlord Rep" })
    ).toEqual({
      laHouse: LEE_NEWPORT_HOUSE,
      paHouse: "",
    });
    expect(
      agentHousesForVoucher({ ...untouchedBothLee, repType: "Seller Rep" })
    ).toEqual({
      laHouse: LEE_NEWPORT_HOUSE,
      paHouse: "",
    });
  });

  it("puts Lee on the procuring house for buyer rep", () => {
    expect(
      agentHousesForVoucher({ ...untouchedBothLee, repType: "Buyer Rep" })
    ).toEqual({
      laHouse: "",
      paHouse: LEE_NEWPORT_HOUSE,
    });
  });

  it("preserves a house the user edited", () => {
    expect(
      agentHousesForVoucher({
        ...untouchedBothLee,
        repType: "Tenant Rep",
        laHouse: "CBRE - Newport",
        laHouseTouched: true,
      })
    ).toEqual({
      laHouse: "CBRE - Newport",
      paHouse: LEE_NEWPORT_HOUSE,
    });
  });

  it("records dual agency on both houses", () => {
    expect(
      agentHousesForVoucher({
        ...untouchedBothLee,
        repType: "Tenant Rep",
        sameAgent: true,
        laHouse: "",
      })
    ).toEqual({
      laHouse: LEE_NEWPORT_HOUSE,
      paHouse: LEE_NEWPORT_HOUSE,
    });
  });
});
