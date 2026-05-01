type ContractPdfRef = {
  url?: string;
  fileKey?: string;
  filename?: string;
};

type ContractRevision = {
  revisionId: string;
  revisionNumber: number;
  extractedAt: string;
  contractType: string;
  pdf: ContractPdfRef | null;
  data: Record<string, unknown>;
};

type ContractMergeParams = {
  payload: Record<string, unknown> | null | undefined;
  contract: unknown;
  pdf?: ContractPdfRef | null;
  contractType: string;
  now?: Date;
};

function str(raw: unknown): string {
  return String(raw ?? "").trim();
}

function feePercentFrom(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const normalized = String(raw).replace(/[$,%]/g, "").replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed <= 1 ? parsed * 100 : parsed;
}

function feePercentFromCommAmount(raw: unknown): number | null {
  const match = str(raw).match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? feePercentFrom(match[1]) : null;
}

function getCurrentContractExtraction(payload: Record<string, unknown>): Record<string, unknown> | null {
  const aiExtract = payload.aiExtract;
  if (!aiExtract || typeof aiExtract !== "object") return null;
  const contract = (aiExtract as Record<string, unknown>).contract;
  if (!contract || typeof contract !== "object") return null;
  const data = (contract as Record<string, unknown>).data;
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

function derivedFields(contract: Record<string, unknown>): Record<string, unknown> {
  const propAddress = str(contract.propAddress);
  const propCity = str(contract.propCity);
  const propState = str(contract.propState);
  const propZip = str(contract.propZip);
  const fields: Record<string, unknown> = {};

  if (propAddress) fields.address = propAddress;
  if (propCity) fields.city = propCity;
  if (propState) fields.state = propState;
  if (propZip) fields.zip = propZip;
  if (propAddress || propCity || propState || propZip) {
    const addr = [propAddress, propCity, propState].filter(Boolean).join(", ");
    fields.propertyAddress = addr + (propZip ? ` ${propZip}` : "");
  }

  const lessor = str(contract.mlLessor) || str(contract.party1Name);
  const lessee = str(contract.mlLessee);
  if (lessor) fields.lessorName = lessor;
  if (lessee) fields.lesseeName = lessee;
  if (contract.termStart) fields.commencementDate = String(contract.termStart);
  if (contract.termEnd) fields.expirationDate = String(contract.termEnd);

  const pct = feePercentFromCommAmount(contract.commAmount);
  if (pct != null) {
    fields.feePercent = pct;
    fields.commissionRate = String(pct);
  }

  return fields;
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || left === undefined || right === null || right === undefined) return false;
  return String(left).trim() === String(right).trim();
}

function shouldReplaceField(
  currentValue: unknown,
  previousDerivedValue: unknown,
): boolean {
  if (currentValue === undefined || currentValue === null || currentValue === "") return true;
  if (previousDerivedValue !== undefined && sameValue(currentValue, previousDerivedValue)) return true;
  return false;
}

function applyDerivedFields(
  payload: Record<string, unknown>,
  currentFields: Record<string, unknown>,
  previousFields: Record<string, unknown>,
) {
  const allKeys = new Set([...Object.keys(previousFields), ...Object.keys(currentFields)]);
  for (const key of allKeys) {
    const nextValue = currentFields[key];
    const previousValue = previousFields[key];
    if (nextValue !== undefined) {
      if (shouldReplaceField(payload[key], previousValue)) payload[key] = nextValue;
      continue;
    }

    // Contract revisions are full snapshots. If a value came from the previous
    // extraction and is absent from the new revision, remove the stale copy.
    if (previousValue !== undefined && sameValue(payload[key], previousValue)) {
      delete payload[key];
    }
  }
}

function normalizeExistingRevisions(contractRecord: unknown): ContractRevision[] {
  if (!contractRecord || typeof contractRecord !== "object") return [];
  const record = contractRecord as Record<string, unknown>;
  if (Array.isArray(record.revisions)) return record.revisions.filter(r => r && typeof r === "object") as ContractRevision[];
  if (record.data && typeof record.data === "object") {
    return [
      {
        revisionId: String(record.currentRevisionId || "legacy-1"),
        revisionNumber: 1,
        extractedAt: String(record.extractedAt || ""),
        contractType: String(record.contractType || ""),
        pdf: (record.pdf as ContractPdfRef | null | undefined) ?? null,
        data: record.data as Record<string, unknown>,
      },
    ];
  }
  return [];
}

export function mergeVoucherFromContractExtraction(params: ContractMergeParams): Record<string, unknown> {
  const { payload, contract, pdf, contractType, now = new Date() } = params;
  const next: Record<string, unknown> = { ...(payload || {}) };
  const safeContract = contract && typeof contract === "object" ? (contract as Record<string, unknown>) : {};
  const previousContract = getCurrentContractExtraction(next);

  applyDerivedFields(next, derivedFields(safeContract), previousContract ? derivedFields(previousContract) : {});

  const aiExtract = next.aiExtract && typeof next.aiExtract === "object" ? (next.aiExtract as Record<string, unknown>) : {};
  const existingContractRecord = aiExtract.contract;
  const revisions = normalizeExistingRevisions(existingContractRecord);
  const extractedAt = now.toISOString();
  const revisionNumber = revisions.length + 1;
  const revisionId = `${extractedAt}-${revisionNumber}`;
  const currentRevision: ContractRevision = {
    revisionId,
    revisionNumber,
    extractedAt,
    contractType,
    pdf: pdf ?? null,
    data: safeContract,
  };

  next.aiExtract = {
    ...aiExtract,
    contract: {
      ...currentRevision,
      currentRevisionId: revisionId,
      revisions: [...revisions, currentRevision],
    },
  };

  return next;
}
