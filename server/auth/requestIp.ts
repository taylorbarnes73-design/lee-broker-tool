import type { Request } from "express";

export function getRequestIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0]?.trim() || "unknown";
  }
  if (Array.isArray(xf) && xf[0]) return xf[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}
