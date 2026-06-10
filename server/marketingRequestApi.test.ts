import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("./middleware/requireAuth", () => ({
  requireAuth: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    req.user = {
      id: "1",
      email: "broker@lee-associates.com",
      username: "broker",
      fullName: "Test Broker",
      role: "broker",
    };
    next();
  },
}));

import { marketingRequestApiRouter } from "./marketingRequestApi";

function isPdfBuffer(bytes: Buffer): boolean {
  return bytes.length >= 4 && bytes.subarray(0, 4).toString("utf8") === "%PDF";
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/marketing-request", marketingRequestApiRouter);
  return app;
}

describe("marketingRequestApiRouter", () => {
  it("returns a filled PDF attachment for valid authenticated requests", async () => {
    const res = await request(buildApp())
      .post("/api/marketing-request/pdf")
      .send({
        requesterName: "Test Broker",
        email: "broker@lee-associates.com",
        projectTitle: "Export smoke test",
        requestType: "Flyer / brochure",
        priority: "Normal",
        objective: "Verify export route",
        dueDate: "2026-06-20",
      })
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", chunk => chunks.push(Buffer.from(chunk)));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"]).toLowerCase()).toContain("application/pdf");
    expect(String(res.headers["content-disposition"])).toContain("attachment");
    expect(isPdfBuffer(res.body as Buffer)).toBe(true);
  });

  it("accepts minimal payloads and still returns a PDF", async () => {
    const res = await request(buildApp())
      .post("/api/marketing-request/pdf")
      .send({ projectTitle: "Minimal export" })
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", chunk => chunks.push(Buffer.from(chunk)));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(isPdfBuffer(res.body as Buffer)).toBe(true);
  });
});
