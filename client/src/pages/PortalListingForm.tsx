import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import {
  buildBrokerToolTabUrl,
  QUICK_CONVERT_PREFILL_STORAGE_KEY,
  serializeQuickConvertPrefill,
} from "@shared/quickConvert";
import {
  buildListingPilotPrefill,
  EMPTY_LISTING_PILOT_FIELDS,
  LISTING_PROPERTY_TYPES,
  LISTING_TRANSACTION_TYPES,
  validateListingPilotFields,
  type ListingPilotFields,
} from "@shared/listingFormPilot";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";
import { useEffect, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { Button, Card, Field, Input, Select } from "../design/index.jsx";

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

export default function PortalListingForm() {
  const { user } = useAuth();
  const [fields, setFields] = useState<ListingPilotFields>(EMPTY_LISTING_PILOT_FIELDS);
  const [error, setError] = useState<string | null>(null);
  const isLease = fields.transactionType.toLowerCase() === "lease";

  useEffect(() => {
    const name = user?.name?.trim();
    if (!name) return;
    setFields(prev => (prev.listingAgentName ? prev : { ...prev, listingAgentName: name }));
  }, [user?.name]);

  function update<K extends keyof ListingPilotFields>(key: K, value: ListingPilotFields[K]) {
    setFields(prev => ({ ...prev, [key]: value }));
  }

  function continueToWorkspace() {
    setError(null);
    const validation = validateListingPilotFields(fields);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    const payload = buildListingPilotPrefill(fields);
    sessionStorage.setItem(QUICK_CONVERT_PREFILL_STORAGE_KEY, serializeQuickConvertPrefill(payload));
    toast.success("Listing basics saved — finish pricing and notifications in the workspace.");
    window.location.href = buildBrokerToolTabUrl("listing");
  }

  return (
    <AdminPortalShell
      section="new-submission"
      eyebrow="Forms"
      title="Listing entry"
      description="Start property and pricing basics in the portal, then continue in the broker workspace for service notifications and submit."
      actions={
        <LinkButton href="/portal/new" variant="secondary">
          Back to forms
        </LinkButton>
      }
    >
      <div style={{ marginTop: 14, display: "grid", gap: 12, maxWidth: 720 }}>
        <Card padding="lg">
          <div style={{ fontSize: 13, color: "var(--ink-600)", marginBottom: 16, lineHeight: 1.5 }}>
            Portal pilot — captures property type, location, and headline pricing only. Expiration dates,
            landlord contacts, and send-to-admin still happen in the{" "}
            <a href="/tool?tab=listing" style={{ color: "var(--ink-800)", fontWeight: 600 }}>
              broker tool workspace
            </a>
            .
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              }}
            >
              <Field label="Property type">
                <Select
                  value={fields.propertyType}
                  onChange={e => update("propertyType", e.target.value)}
                  options={[...LISTING_PROPERTY_TYPES]}
                />
              </Field>
              <Field label="Transaction type">
                <Select
                  value={fields.transactionType}
                  onChange={e => update("transactionType", e.target.value)}
                  options={[...LISTING_TRANSACTION_TYPES]}
                />
              </Field>
            </div>

            <Field label="Property address">
              <AddressAutocompleteInput
                value={fields.address}
                onChange={v => update("address", v)}
                onSelect={s => {
                  update("address", s.address);
                  if (s.city) update("city", s.city);
                  if (s.state) update("state", s.state);
                  if (s.zip) update("zip", s.zip);
                }}
                placeholder="1450 Von Karman Ave"
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
                <Input value={fields.zip} onChange={e => update("zip", e.target.value)} placeholder="92612" />
              </Field>
              <Field label="Building SF">
                <Input
                  value={fields.buildingSf}
                  onChange={e => update("buildingSf", e.target.value)}
                  placeholder="52,000"
                  inputMode="numeric"
                />
              </Field>
            </div>

            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              }}
            >
              {isLease ? (
                <Field label="Rate $/SF/mo">
                  <Input
                    value={fields.rateSfMo}
                    onChange={e => update("rateSfMo", e.target.value)}
                    placeholder="1.15"
                    inputMode="decimal"
                  />
                </Field>
              ) : (
                <Field label="Asking price">
                  <Input
                    value={fields.askingPrice}
                    onChange={e => update("askingPrice", e.target.value)}
                    placeholder="8,200,000"
                    inputMode="decimal"
                  />
                </Field>
              )}
              <Field label="Owner name" optional>
                <Input
                  value={fields.ownerName}
                  onChange={e => update("ownerName", e.target.value)}
                  placeholder="Landlord or seller entity"
                />
              </Field>
              <Field label="Listing agent">
                <Input
                  value={fields.listingAgentName}
                  onChange={e => update("listingAgentName", e.target.value)}
                  placeholder="Broker name"
                />
              </Field>
            </div>

            <Field label="Comments" optional>
              <textarea
                value={fields.comments}
                onChange={e => update("comments", e.target.value)}
                placeholder="Cross streets, suite mix, or other notes for admin"
                style={textareaStyle}
              />
            </Field>

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
