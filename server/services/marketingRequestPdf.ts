import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

export type MarketingRequestFormData = {
  requesterName?: string;
  email?: string;
  team?: string;
  projectTitle?: string;
  requestType?: string;
  priority?: string;
  propertyAddress?: string;
  objective?: string;
  deliverables?: string[];
  finalSpecs?: string;
  dueDate?: string;
  launchDate?: string;
  dateFlexible?: string;
  timelineNotes?: string;
  briefingTime?: string;
  copyMessaging?: string;
  assetLinks?: string;
  approverName?: string;
  approverEmail?: string;
  targetAudience?: string;
  market?: string;
  distribution?: string;
  additionalNotes?: string;
};

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "server/assets/marketing-project-request-fillable.pdf"
);

const DELIVERABLE_CHECKBOXES: Record<string, string> = {
  "Print collateral": "Deliverable: Print collateral",
  "Digital graphic": "Deliverable: Digital graphic",
  "Email / Constant Contact": "Deliverable: Email / Constant Contact",
  "Social media": "Deliverable: Social media",
  Presentation: "Deliverable: Presentation",
  "Website / listing": "Deliverable: Website / listing",
  "Map / aerial": "Deliverable: Map / aerial",
  Other: "Deliverable: Other",
};

function formatDisplayDate(value: string | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    return `${match[2]}/${match[3]}/${match[1]}`;
  }
  return trimmed;
}

function setTextField(form: ReturnType<PDFDocument["getForm"]>, name: string, value: string | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return;
  try {
    form.getTextField(name).setText(text);
  } catch {
    // Skip missing or incompatible fields rather than failing the whole export.
  }
}

function setDropdownField(form: ReturnType<PDFDocument["getForm"]>, name: string, value: string | undefined) {
  const selected = String(value ?? "").trim();
  if (!selected) return;
  try {
    form.getDropdown(name).select(selected);
  } catch {
    // Skip values that do not match a PDF option.
  }
}

function setCheckboxField(form: ReturnType<PDFDocument["getForm"]>, name: string, checked: boolean) {
  try {
    const field = form.getCheckBox(name);
    if (checked) field.check();
    else field.uncheck();
  } catch {
    // Ignore missing checkbox fields.
  }
}

function buildProjectDescription(data: MarketingRequestFormData): string {
  const parts = [String(data.objective ?? "").trim()];
  const propertyAddress = String(data.propertyAddress ?? "").trim();
  if (propertyAddress) {
    parts.push(`Related property / address: ${propertyAddress}`);
  }
  return parts.filter(Boolean).join("\n\n");
}

function buildTimelineNotes(data: MarketingRequestFormData): string {
  const parts = [String(data.timelineNotes ?? "").trim()];
  const briefingTime = String(data.briefingTime ?? "").trim();
  if (briefingTime) {
    parts.push(`Scheduled briefing: ${briefingTime}`);
  }
  return parts.filter(Boolean).join("\n\n");
}

export async function fillMarketingRequestPdf(data: MarketingRequestFormData): Promise<Uint8Array> {
  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const doc = await PDFDocument.load(templateBytes);
  const form = doc.getForm();

  setDropdownField(form, "Requester name", data.requesterName);
  setTextField(form, "Email", data.email);
  setTextField(form, "Broker Team Department", data.team);
  setTextField(form, "Date of request", formatDisplayDate(new Date().toISOString().slice(0, 10)));
  setTextField(form, "Project title", data.projectTitle);
  setDropdownField(form, "Project type", data.requestType);
  setDropdownField(form, "Priority", data.priority);
  setTextField(form, "Project description", buildProjectDescription(data));
  setTextField(form, "Final size format specs", data.finalSpecs);
  setTextField(form, "Requested due date", formatDisplayDate(data.dueDate));
  setTextField(form, "Event launch date", formatDisplayDate(data.launchDate));
  setDropdownField(form, "Date flexible", data.dateFlexible);
  setTextField(form, "Timeline notes", buildTimelineNotes(data));
  setTextField(form, "Copy messaging", data.copyMessaging);
  setTextField(form, "Asset links", data.assetLinks);
  setTextField(form, "Approver name", data.approverName);
  setTextField(form, "Approver email", data.approverEmail);
  setTextField(form, "Target audience", data.targetAudience);
  setTextField(form, "Geography market", data.market);
  setTextField(form, "Distribution details", data.distribution);
  setTextField(form, "Additional notes", data.additionalNotes);

  const selectedDeliverables = new Set((data.deliverables ?? []).map(value => value.trim()).filter(Boolean));
  for (const [formValue, fieldName] of Object.entries(DELIVERABLE_CHECKBOXES)) {
    setCheckboxField(form, fieldName, selectedDeliverables.has(formValue));
  }

  form.updateFieldAppearances();
  return doc.save();
}
