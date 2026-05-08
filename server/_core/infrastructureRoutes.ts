import type { Express } from "express";

export function registerInfrastructureRoutes(app: Express) {
  // Redirect legacy URL to canonical clean URL.
  app.get("/broker_tool.html", (_req, res) => {
    res.redirect(301, "/tool");
  });

  // Health check endpoint for AWS Application Load Balancer.
  app.get(["/health", "/api/health"], (_req, res) => {
    res.status(200).send("OK");
  });

  // Make the broker surface a single-purpose tool while allowing the
  // integrated React admin portal to own /portal and /login.
  app.get(["/", "/beta", "/beta/*", "/404"], (req, res) => {
    const ua = req.headers["user-agent"] || "";
    if (ua.toLowerCase().includes("elb-healthchecker")) {
      res.status(200).send("OK");
      return;
    }
    res.redirect(302, "/tool");
  });
}
