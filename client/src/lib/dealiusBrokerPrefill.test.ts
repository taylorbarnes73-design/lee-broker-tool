import { describe, expect, it } from "vitest";
import { prefillDealBrokers } from "./dealiusBrokerPrefill";

describe("prefillDealBrokers", () => {
  it("does not add the submitter again beside two named agents", () => {
    const brokers = prefillDealBrokers({
      sections: [
        {
          title: "Agents",
          fields: [
            { label: "Listing Agent", value: "Jane Doe — Lee & Associates" },
            { label: "Procuring Agent", value: "John Smith — CBRE" },
          ],
        },
      ],
      submittedBy: "Jane Doe",
    });

    expect(brokers).toEqual([
      { name: "Jane Doe", side: "", pct: "50", lead: true },
      { name: "John Smith", side: "", pct: "50", lead: false },
    ]);
  });

  it("collapses a same-agent voucher to one 100% share", () => {
    const brokers = prefillDealBrokers({
      sections: [
        {
          title: "Agents",
          fields: [
            { label: "Listing Agent", value: "Jane Doe — Lee & Associates" },
            { label: "Procuring Agent", value: "(same as listing)" },
          ],
        },
      ],
      submittedBy: "Jane Doe",
    });

    expect(brokers).toEqual([{ name: "Jane Doe", side: "", pct: "100", lead: true }]);
  });

  it("uses the commission distribution the broker entered", () => {
    const brokers = prefillDealBrokers({
      sections: [
        {
          title: "Agents",
          fields: [{ label: "Listing Agent", value: "Jane Doe — Lee & Associates" }],
        },
        {
          title: "Commission Distribution",
          fields: [
            { label: "Jane Doe (Listing)", value: "60%" },
            { label: "John Smith (Procuring)", value: "40%" },
          ],
        },
      ],
      submittedBy: "Taylor Barnes",
    });

    expect(brokers).toEqual([
      { name: "Jane Doe", side: "Listing", pct: "60", lead: true },
      { name: "John Smith", side: "Procuring", pct: "40", lead: false },
    ]);
  });

  it("keeps an explicit broker list, including a fractional excel share", () => {
    const brokers = prefillDealBrokers({
      brokers: [{ name: "Jane Doe", side: "Listing", pct: 0.6, lead: true }],
      submittedBy: "Taylor Barnes",
    });

    expect(brokers).toEqual([{ name: "Jane Doe", side: "Listing", pct: "60", lead: true }]);
  });

  it("uses the submitter only when no agent was named", () => {
    expect(prefillDealBrokers({ submittedBy: "Jane Doe" })).toEqual([
      { name: "Jane Doe", side: "", pct: "100", lead: true },
    ]);
  });
});
