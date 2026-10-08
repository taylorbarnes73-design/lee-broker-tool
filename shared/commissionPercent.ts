function numeric(raw: unknown): { n: number; hasPercent: boolean } | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const hasPercent = text.includes("%");
  const normalized = text.replace(/[$,%]/g, "").replace(/,/g, "").trim();
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return { n, hasPercent };
}

/**
 * Percent points typed into a "%" field, as the fraction Excel percent cells store.
 * `4` → `0.04` (4%). `1` → `0.01` (1%). `100` → `1` (100%).
 */
export function percentPointsToFraction(raw: unknown): number | null {
  const parsed = numeric(raw);
  if (!parsed) return null;
  return parsed.n / 100;
}

/**
 * Commission rate as percent points.
 * `6`, `"6%"`, and `6` stay 6. A bare fraction below 1 (`0.06`) becomes 6.
 * Exact `1` stays 1: voucher and Dealius fee fields are percent points, so 1% must not become 100%.
 */
export function commissionPercentPoints(raw: unknown): number | null {
  const parsed = numeric(raw);
  if (!parsed || parsed.n <= 0) return null;
  if (parsed.hasPercent || parsed.n >= 1) return parsed.n;
  return parsed.n * 100;
}
