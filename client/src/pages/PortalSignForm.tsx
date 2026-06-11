import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import {
  buildBrokerToolTabUrl,
  QUICK_CONVERT_PREFILL_STORAGE_KEY,
  serializeQuickConvertPrefill,
} from "@shared/quickConvert";
import {
  buildSignPilotPrefill,
  EMPTY_SIGN_PILOT_FIELDS,
  validateSignPilotFields,
  type SignPilotFields,
} from "@shared/signFormPilot";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";
import { useEffect, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { Button, Card, Field, Input } from "../design/index.jsx";

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 72,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--ink-200)",
  fontSize: 14,
  fontFamily: "inherit",
  resize: "vertical",
  boxSizing: "border-box",
};

export default function PortalSignForm() {
  const { user } = useAuth();
  const [fields, setFields] = useState<SignPilotFields>(EMPTY_SIGN_PILOT_FIELDS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const name = user?.name?.trim();
    if (!name) return;
    setFields(prev => (prev.requestedBy ? prev : { ...prev, requestedBy: name }));
  }, [user?.name]);

  function update<K extends keyof SignPilotFields>(key: K, value: SignPilotFields[K]) {
    setFields(prev => ({ ...prev, [key]: value }));
  }

  function continueToWorkspace() {
    setError(null);
    const validation = validateSignPilotFields(fields);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    const payload = buildSignPilotPrefill(fields);
    sessionStorage.setItem(QUICK_CONVERT_PREFILL_STORAGE_KEY, serializeQuickConvertPrefill(payload));
    toast.success("Sign basics saved — finish quantities and placement in the workspace.");
    window.location.href = buildBrokerToolTabUrl("sign");
  }

  return (
    <AdminPortalShell
      section="new-submission"
      eyebrow="Need a sign?"
      title="Order a sign"
      description="Takes about 2 minutes. We install a standard Lee & Associates for-lease or for-sale sign at the property — orders are typically fulfilled within 2–3 business days."
      actions={
        <LinkButton href="/portal/new" variant="secondary">
          Back to home
        </LinkButton>
      }
    >
      <div style={{ marginTop: 14, display: "grid", gap: 12, maxWidth: 720 }}>
        <Card padding="lg">
          <div style={{ fontSize: 13, color: "var(--ink-600)", marginBottom: 16, lineHeight: 1.5 }}>
            <strong>Step 1 of 2:</strong> location and contact details here. <strong>Step 2:</strong> sign
            types, quantities, placement photos, and submit — the next screen carries these answers over
            automatically.
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <Field label="Property address">
              <AddressAutocompleteInput
                value={fields.propertyAddress}
                onChange={v => update("propertyAddress", v)}
                onSelect={s => {
                  update("propertyAddress", s.address);
                  if (s.city) update("city", s.city);
                }}
                placeholder="500 Anton Blvd"
              />
            </Field>

            <Field label="City">
              <Input
                value={fields.city}
                onChange={e => update("city", e.target.value)}
                placeholder="Costa Mesa"
              />
            </Field>

            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              }}
            >
              <Field label="Name rider">
                <Input
                  value={fields.nameRider}
                  onChange={e => update("nameRider", e.target.value)}
                  placeholder="Building or suite name on sign"
                />
              </Field>
              <Field label="Requested by">
                <Input
                  value={fields.requestedBy}
                  onChange={e => update("requestedBy", e.target.value)}
                  placeholder="Broker name"
                />
              </Field>
            </div>

            <Field label="Special instructions" optional>
              <textarea
                value={fields.specialInstructions}
                onChange={e => update("specialInstructions", e.target.value)}
                placeholder="Sign types, sizes, or branding notes for admin"
                style={textareaStyle}
              />
            </Field>

            <Field label="Gate code or access contact" optional>
              <textarea
                value={fields.accessInstructions}
                onChange={e => update("accessInstructions", e.target.value)}
                placeholder="Gate codes, who to contact for site access, placement constraints"
                style={textareaStyle}
              />
            </Field>

            {error ? (
              <div role="alert" style={{ color: "var(--err-700)", fontSize: 13 }}>
                {error}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Button onClick={continueToWorkspace}>Continue to sign details →</Button>
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
