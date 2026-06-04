import { useEffect, useState } from "react";

export type PublicBranding = {
  company_name: string;
  logo_url: string | null;
  primary_color: string;
  support_email: string;
};

const FALLBACK: PublicBranding = {
  company_name: "Broker Operations",
  logo_url: null,
  primary_color: "#98002E",
  support_email: "",
};

export function usePublicBranding() {
  const [branding, setBranding] = useState<PublicBranding | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/settings/public", { credentials: "include" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as Partial<PublicBranding>;
        if (cancelled) return;
        setBranding({
          company_name: typeof j.company_name === "string" && j.company_name ? j.company_name : FALLBACK.company_name,
          logo_url: typeof j.logo_url === "string" ? j.logo_url : j.logo_url === null ? null : FALLBACK.logo_url,
          primary_color:
            typeof j.primary_color === "string" && j.primary_color.trim()
              ? j.primary_color.trim()
              : FALLBACK.primary_color,
          support_email: typeof j.support_email === "string" ? j.support_email : FALLBACK.support_email,
        });
      } catch {
        if (!cancelled) setBranding(FALLBACK);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return branding ?? FALLBACK;
}
