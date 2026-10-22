function transactionText(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

/** "Sublease" contains the substring "sale", so callers must exclude it before a sale check. */
export function isSubleaseTransaction(raw: unknown): boolean {
  const value = transactionText(raw);
  return (
    value.includes("sublease") ||
    value.includes("sub-lease") ||
    value.includes("sub lease")
  );
}

export function isSaleTransaction(raw: unknown): boolean {
  const value = transactionText(raw);
  if (!value || isSubleaseTransaction(value)) return false;
  return value.includes("sale") || value.includes("sold");
}

/** Deal workspace labels. A sublease is a lease, not a sale. */
export function inferPortalDealTransactionType(
  raw: unknown
): "Consulting" | "Renewal" | "Sale" | "Lease" {
  const value = transactionText(raw);
  if (value.includes("consult")) return "Consulting";
  if (value.includes("renew")) return "Renewal";
  if (isSubleaseTransaction(value)) return "Lease";
  if (isSaleTransaction(value)) return "Sale";
  return "Lease";
}

export function transactionDealNamePrefix(
  raw: unknown
): "Consulting" | "Renewed" | "Sold" | "Leased" {
  const value = transactionText(raw);
  if (value.includes("consult")) return "Consulting";
  if (value.includes("renew")) return "Renewed";
  if (isSubleaseTransaction(value)) return "Leased";
  if (isSaleTransaction(value) || value.includes("purchase")) return "Sold";
  return "Leased";
}
