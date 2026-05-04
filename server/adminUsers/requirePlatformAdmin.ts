import type { RequestHandler } from "express";
import { resolvePlatformUserFromRequest } from "../auth/platformSession";
import { sendAdminError } from "./adminErrors";

/** Admin REST API: 401/403 use `{ error: { code, message } }` shape. */
export const requirePlatformAdmin: RequestHandler = async (req, res, next) => {
  const user = await resolvePlatformUserFromRequest(req);
  if (!user) {
    sendAdminError(res, 401, "UNAUTHORIZED", "Authentication required.");
    return;
  }
  if (user.role !== "admin") {
    sendAdminError(res, 403, "FORBIDDEN", "Administrator access is required for this resource.");
    return;
  }
  req.user = user;
  next();
};
