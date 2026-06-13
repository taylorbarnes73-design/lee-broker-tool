import { protectedProcedure, router } from "../_core/trpc";
import { brokerDirectory } from "@shared/brokerDirectory";
import { getDb } from "../db";
import { appUsers } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

type RosterEntry = {
  id: string;
  name: string;
  email: string;
  role: string;
  office: string;
};

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Broker roster (Lee & Associates Newport Beach).
 *
 * The static `shared/brokerDirectory.ts` is the seed/fallback. Active accounts
 * managed in the admin portal (Users page → `app_users`) are merged on top and
 * take precedence by email, so adding a user in the portal makes them appear in
 * the roster without a code change. When the database is unavailable the static
 * directory is returned on its own.
 *
 * Consumers:
 *   - /beta React pages (agent dropdowns, admin roster)
 *   - broker_tool.html (via the REST shim in server/_core/index.ts)
 */
export const brokersRouter = router({
  list: protectedProcedure.query(async () => {
    // Seed from the static directory, keyed by lowercase email.
    const byEmail = new Map<string, RosterEntry>();
    for (const e of brokerDirectory) {
      byEmail.set(e.email.trim().toLowerCase(), {
        id: e.id,
        name: e.name,
        email: e.email,
        role: e.roles,
        office: e.office,
      });
    }

    // Merge active accounts from the database. Portal-managed users win on conflict.
    try {
      const db = await getDb();
      if (db) {
        const rows = await db
          .select({
            id: appUsers.id,
            email: appUsers.email,
            fullName: appUsers.fullName,
            role: appUsers.role,
            office: appUsers.office,
          })
          .from(appUsers)
          .where(eq(appUsers.isActive, true));

        for (const row of rows) {
          const email = (row.email ?? "").trim().toLowerCase();
          if (!email) continue;
          const existing = byEmail.get(email);
          byEmail.set(email, {
            id: row.id,
            name: row.fullName || existing?.name || email,
            email: row.email,
            // Present DB "admin" as "Office Admin", everything else as "Broker",
            // unless the static directory already carried a more specific label.
            role: row.role === "admin" ? "Office Admin" : existing?.role ?? "Broker",
            office: row.office || existing?.office || "",
          });
        }
      }
    } catch (error) {
      console.error("[brokers.list] DB merge failed, returning static directory:", error);
    }

    // Brokers first, then admins; stable alphabetical within each group.
    const isBroker = (r: string) => /broker/i.test(r);
    const sorted = [...byEmail.values()].sort((a, b) => {
      const ab = isBroker(a.role);
      const bb = isBroker(b.role);
      if (ab !== bb) return ab ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return sorted.map(e => ({
      id: e.id,
      name: e.name,
      email: e.email,
      role: e.role,
      office: e.office,
      initials: initialsFor(e.name),
    }));
  }),
});
