import { buildSubmissionSummaryFields, type SubmissionSummaryField } from "@shared/submissionSummary";

type SubmissionFieldSummaryProps = {
  formType: string;
  payload: unknown;
  reference?: string | null;
};

export default function SubmissionFieldSummary({
  formType,
  payload,
  reference,
}: SubmissionFieldSummaryProps) {
  const fields: SubmissionSummaryField[] = buildSubmissionSummaryFields(formType, payload, reference);

  if (fields.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "var(--ink-500)", lineHeight: 1.5 }}>
        No structured fields were captured for this submission. Check the Files tab or ask an admin to review the
        raw payload.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 12,
      }}
    >
      {fields.map(field => (
        <div
          key={`${field.label}-${field.value}`}
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--ink-200)",
            background: "white",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)", letterSpacing: "0.06em" }}>
            {field.label}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--ink-900)",
              marginTop: 4,
              wordBreak: "break-word",
            }}
          >
            {field.value}
          </div>
        </div>
      ))}
    </div>
  );
}
