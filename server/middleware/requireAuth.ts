import type { RequestHandler } from "express";
import { resolvePlatformUserFromRequest } from "../auth/platformSession";
import type { PlatformAuthUser, PlatformRole } from "../auth/platformAuthTypes";

export const requireAuth: RequestHandler = async (req, res, next) => {
  const user = await resolvePlatformUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  req.user = user;
  next();
};

export function requireRole(...allowedRoles: PlatformRole[]): RequestHandler {
  return (req, res, next) => {
    const user = req.user as PlatformAuthUser | undefined;
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (user.role === "admin") {
      next();
      return;
    }
    if (allowedRoles.includes(user.role)) {
      next();
      return;
    }
    res.status(403).json({ error: "Forbidden" });
  };
}
