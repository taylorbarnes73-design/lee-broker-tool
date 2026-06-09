import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import {
  buildBrokerToolTabUrl,
  QUICK_CONVERT_PREFILL_STORAGE_KEY,
  serializeQuickConvertPrefill,
} from "@shared/quickConvert";
import {
  buildVoucherPilotPrefill,
  EMPTY_VOUCHER_PILOT_FIELDS,
  validateVoucherPilotFields,
  VOUCHER_REPRESENTATION_TYPES,
  VOUCHER_TRANSACTION_TYPES,
  type VoucherPilotFields,
} from "@shared/voucherFormPilot";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, Field, Input, Select } from "../design/index.jsx";

export default function PortalVoucherForm() {
  const { user } = useAuth();
  const [fields, setFields] = useState<VoucherPilotFields>(EMPTY_VOUCHER_PILOT_FIELDS);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof VoucherPilotFields>(key: K, value: VoucherPilotFields[K]) {
    setFields(prev => ({ ...prev, [key]: value }));
  }

  function continueToWorkspace() {
    setError(null);
    const validation = validateVoucherPilotFields(fields);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    const payload = buildVoucherPilotPrefill(fields);
    sessionStorage.setItem(QUICK_CONVERT_PREFILL_STORAGE_KEY, serializeQuickConvertPrefill(payload));
    toast.success("Deal basics saved — finish commission details in the workspace.");
    window.location.href = buildBrokerToolTabUrl("voucher");
  }

  return (
    <AdminPortalShell
      section="new-submission"
      eyebrow="Forms"
      title="Commission voucher"
      description="Start deal basics in the portal, then continue in the broker workspace for splits, documents, and submit."
      actions={
        <LinkButton href="/portal/new" variant="secondary">
          Back to forms
        </LinkButton>
      }
    >
      <div style={{ marginTop: 14, display: "grid", gap: 12, maxWidth: 720 }}>
        <Card padding="lg">
          <div style={{ fontSize: 13, color: "var(--ink-600)", marginBottom: 16, lineHeight: 1.5 }}>
            Portal pilot — captures the first voucher section only. Commission splits, document upload, and
            send-to-admin still happen in the{" "}
            <a href="/tool?tab=voucher" style={{ color: "var(--ink-800)", fontWeight: 600 }}>
              broker tool workspace
            </a>
            .
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <Field label="Transaction type">
                <Select
                  value={fields.transactionType}
                  onChange={e => update("transactionType", e.target.value)}
                  options={[...VOUCHER_TRANSACTION_TYPES]}
                />
              </Field>
              <Field label="Representation">
                <Select
                  value={fields.representationType}
                  onChange={e => update("representationType", e.target.value)}
                  options={[...VOUCHER_REPRESENTATION_TYPES]}
                />
              </Field>
            </div>

            <Field label="Client name">
              <Input
                value={fields.clientName}
                onChange={e => update("clientName", e.target.value)}
                placeholder="Tenant or buyer entity"
              />
            </Field>

            <Field label="Property address">
              <Input
                value={fields.address}
                onChange={e => update("address", e.target.value)}
                placeholder="123 Main St"
              />
            </Field>

            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              }}
            >
              <Field label="City">
                <Input value={fields.city} onChange={e => update("city", e.target.value)} placeholder="Irvine" />
              </Field>
              <Field label="State">
                <Input value={fields.state} onChange={e => update("state", e.target.value)} placeholder="CA" />
              </Field>
              <Field label="Zip">
                <Input value={fields.zip} onChange={e => update("zip", e.target.value)} placeholder="92618" />
              </Field>
              <Field label="Property type">
                <Input
                  value={fields.propertyType}
                  onChange={e => update("propertyType", e.target.value)}
                  placeholder="Industrial"
                />
              </Field>
            </div>

            {error ? (
              <div role="alert" style={{ color: "var(--err-700)", fontSize: 13 }}>
                {error}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Button onClick={continueToWorkspace}>Continue in workspace</Button>
              {user?.name ? (
                <span style={{ fontSize: 12, color: "var(--ink-500)" }}>Signed in as {user.name}</span>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    </AdminPortalShell>
  );
}
