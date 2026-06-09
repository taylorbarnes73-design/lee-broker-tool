import { protectedProcedure, router } from "../_core/trpc";
import { brokerDirectory } from "@shared/brokerDirectory";

/**
 * Broker roster (Lee & Associates Newport Beach).
 *
 * Single source of truth is `shared/brokerDirectory.ts`. Consumers:
 *   - /beta React pages (agent dropdowns, admin roster)
 *   - broker_tool.html (via the REST shim in server/_core/index.ts)
 */
export const brokersRouter = router({
  list: protectedProcedure.query(() => {
    // Brokers first, then admins; stable alphabetical within each group.
    const isBroker = (r: string) => /broker/i.test(r);
    const sorted = [...brokerDirectory].sort((a, b) => {
      const ab = isBroker(a.roles);
      const bb = isBroker(b.roles);
      if (ab !== bb) return ab ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return sorted.map(e => ({
      id: e.id,
      name: e.name,
      email: e.email,
      role: e.roles,
      office: e.office,
      initials: e.name
        .split(/\s+/)
        .map(s => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    }));
  }),
});
