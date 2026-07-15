import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DealiusSubmissionWorkspace from "./DealiusSubmissionWorkspace";

Object.assign(globalThis, { React });

vi.mock("@/lib/trpc", () => ({
  trpc: {
    files: {
      upload: {
        useMutation: () => ({ mutateAsync: vi.fn() }),
      },
    },
    contracts: {
      extractContract: {
        useMutation: () => ({ mutateAsync: vi.fn() }),
      },
    },
  },
}));

describe("DealiusSubmissionWorkspace native voucher mapping", () => {
  it("prefills tenant representation and tenant-side client data from formData", () => {
    const html = renderToStaticMarkup(
      React.createElement(DealiusSubmissionWorkspace, {
        submission: {
          id: 101,
          formType: "voucher",
          status: "pending",
          reference: "1 Main St",
          submittedBy: "Test Broker",
          submittedByEmail: "broker@example.test",
          createdAt: "2026-07-15T08:00:00.000Z",
          updatedAt: "2026-07-15T08:00:00.000Z",
          payload: {
            formData: {
              txnType: "Lease",
              repType: "Tenant Rep",
              address: "1 Main St",
              city: "Irvine",
              zip: "92618",
              dealSf: "2500",
              lsCompany: "Big Landlord LLC",
              lbCompany: "Acme Tenant LLC",
              lCommRate: "5",
              rentRows: [{ months: 12, monthly: 7500, free: false }],
            },
          },
        },
        onRefresh: async () => undefined,
      })
    );

    expect(html).toMatch(/<option[^>]*value="3"[^>]*selected[^>]*>Tenant Rep<\/option>/);
    expect(html).toMatch(/Client company[\s\S]*value="Acme Tenant LLC"/);
    expect(html).toMatch(/Opposite company[\s\S]*value="Big Landlord LLC"/);
  });
});
