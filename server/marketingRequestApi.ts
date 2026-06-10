import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "./middleware/requireAuth";
import { fillMarketingRequestPdf } from "./services/marketingRequestPdf";

const marketingRequestSchema = z.object({
  requesterName: z.string().optional(),
  email: z.string().optional(),
  team: z.string().optional(),
  projectTitle: z.string().optional(),
  requestType: z.string().optional(),
  priority: z.string().optional(),
  propertyAddress: z.string().optional(),
  objective: z.string().optional(),
  deliverables: z.array(z.string()).optional(),
  finalSpecs: z.string().optional(),
  dueDate: z.string().optional(),
  launchDate: z.string().optional(),
  dateFlexible: z.string().optional(),
  timelineNotes: z.string().optional(),
  briefingTime: z.string().optional(),
  copyMessaging: z.string().optional(),
  assetLinks: z.string().optional(),
  approverName: z.string().optional(),
  approverEmail: z.string().optional(),
  targetAudience: z.string().optional(),
  market: z.string().optional(),
  distribution: z.string().optional(),
  additionalNotes: z.string().optional(),
});

export const marketingRequestApiRouter = Router();

marketingRequestApiRouter.post("/pdf", requireAuth, async (req, res) => {
  const parsed = marketingRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "Invalid marketing request payload." });
    return;
  }

  try {
    const pdfBytes = await fillMarketingRequestPdf(parsed.data);
    const safeTitle = String(parsed.data.projectTitle ?? "marketing-project-request")
      .replace(/[\r\n\x00-\x1F\x7F"]/g, "")
      .trim()
      .slice(0, 80);
    const filename = `${safeTitle || "marketing-project-request"}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(pdfBytes.length));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("[marketing-request.pdf] Failed to fill template:", error);
    res.status(500).json({ success: false, error: "Could not generate marketing request PDF." });
  }
});
