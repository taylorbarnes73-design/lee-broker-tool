import { ENV } from "../_core/env";
import { getSetting } from "../settings/settingsStore";
import type { DealiusClient } from "./dealiusClient";

export async function getConfiguredDealiusCredentials(): Promise<
  { email: string; password: string } | undefined
> {
  let settingsEmail = "";
  let settingsPassword = "";

  try {
    settingsEmail = String((await getSetting("integrations.dealius.username")) ?? "").trim();
    settingsPassword = String((await getSetting("integrations.dealius.password")) ?? "").trim();
  } catch {
    // Settings can be unavailable during tests or bootstrap. Fall back to env.
  }

  const email = settingsEmail || ENV.dealiusEmail.trim();
  const password = settingsPassword || ENV.dealiusPassword.trim();

  if (!email || !password) return undefined;
  return { email, password };
}

export async function authenticateConfiguredDealius(client: DealiusClient): Promise<string> {
  const credentials = await getConfiguredDealiusCredentials();
  return client.authenticate(credentials);
}
