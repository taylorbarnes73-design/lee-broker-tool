import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { fillMarketingRequestPdf } from "./marketingRequestPdf";

describe("fillMarketingRequestPdf", () => {
  it("fills the marketing request AcroForm template with submitted values", async () => {
    const bytes = await fillMarketingRequestPdf({
      requesterName: "Chris Barnett",
      email: "cbarnett@lee-associates.com",
      team: "Industrial",
      projectTitle: "6255 W Sunset listing flyer",
      requestType: "Flyer / brochure",
      priority: "High",
      propertyAddress: "6255 W Sunset Blvd",
      objective: "Create a polished listing flyer for tenant outreach.",
      deliverables: ["Print collateral", "Digital graphic"],
      finalSpecs: "8.5x11 PDF",
      dueDate: "2026-06-20",
      launchDate: "2026-06-25",
      dateFlexible: "Somewhat",
      timelineNotes: "Need broker review by June 18.",
      briefingTime: "2:30 PM",
      copyMessaging: "Approved headline and bullet points attached via link.",
      assetLinks: "https://example.com/assets",
      approverName: "Shannon Zacher",
      approverEmail: "szacher@lee-associates.com",
      targetAudience: "Tenants and brokers",
      market: "Los Angeles",
      distribution: "Email and print",
      additionalNotes: "Use updated brand colors.",
    });

    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();

    expect(form.getTextField("Email").getText()).toBe("cbarnett@lee-associates.com");
    expect(form.getTextField("Project title").getText()).toBe("6255 W Sunset listing flyer");
    expect(form.getDropdown("Project type").getSelected()[0]).toBe("Flyer / brochure");
    expect(form.getDropdown("Priority").getSelected()[0]).toBe("High");
    expect(form.getTextField("Project description").getText()).toContain("6255 W Sunset Blvd");
    expect(form.getCheckBox("Deliverable: Print collateral").isChecked()).toBe(true);
    expect(form.getCheckBox("Deliverable: Social media").isChecked()).toBe(false);
    expect(form.getTextField("Requested due date").getText()).toBe("06/20/2026");
    expect(form.getTextField("Timeline notes").getText()).toContain("2:30 PM");
  });
});
