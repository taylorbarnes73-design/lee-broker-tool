/** Default house stamped by the commission voucher form. */
export const LEE_NEWPORT_HOUSE = "Lee & Associates Newport Beach";

export type VoucherRepresentedSide = "listing" | "procuring";

export type VoucherAgentHouseInput = {
  repType: string;
  sameAgent: boolean;
  laHouse: string;
  laHouseTouched: boolean;
  paHouse: string;
  paHouseTouched: boolean;
};

/**
 * Lee on the listing house means landlord/seller. Lee on the procuring house
 * means tenant/buyer. Lee on both means the firm represents both sides.
 * The form's untouched defaults must follow the representation dropdown.
 * A house the user edited is kept as entered.
 */
export function agentHousesForVoucher(input: VoucherAgentHouseInput): {
  laHouse: string;
  paHouse: string;
} {
  if (input.sameAgent) {
    const house = input.laHouse.trim() || LEE_NEWPORT_HOUSE;
    return { laHouse: house, paHouse: house };
  }

  const side = representedSide(input.repType);
  switch (side) {
    case "listing":
      return {
        laHouse: input.laHouseTouched ? input.laHouse : LEE_NEWPORT_HOUSE,
        paHouse: input.paHouseTouched ? input.paHouse : "",
      };
    case "procuring":
      return {
        laHouse: input.laHouseTouched ? input.laHouse : "",
        paHouse: input.paHouseTouched ? input.paHouse : LEE_NEWPORT_HOUSE,
      };
    case null:
      return { laHouse: input.laHouse, paHouse: input.paHouse };
    default: {
      const _exhaustive: never = side;
      return _exhaustive;
    }
  }
}

export function representedSide(
  repType: string
): VoucherRepresentedSide | null {
  const v = repType.trim().toLowerCase();
  if (v.includes("landlord") || v.includes("seller")) return "listing";
  if (v.includes("tenant") || v.includes("buyer")) return "procuring";
  return null;
}
