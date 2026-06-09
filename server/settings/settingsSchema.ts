import { z } from "zod/v4";

export type SettingsCategory = "branding" | "workflow" | "notifications" | "integrations" | "security";

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a #RRGGBB hex color.")
  .default("#A6192E");

const optionalUrl = z.preprocess(
  v => (v === "" || v === undefined ? null : v),
  z.union([z.string().url(), z.null()]).optional()
);

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be "HH:MM" in 24h format.')
  .default("08:00");

const testResultSchema = z.enum(["success", "failed"]).nullable().default(null);

export const MASKED_SECRET = "•••••••• (set)";

export type SettingKey =
  | "branding.company_name"
  | "branding.support_email"
  | "branding.logo_url"
  | "branding.primary_color"
  | "branding.letterhead_template_url"
  | "workflow.confidential_warning_enabled"
  | "workflow.confidential_warning_text"
  | "workflow.auto_save_interval_seconds"
  | "workflow.default_listing_term_months"
  | "workflow.commission_split_must_sum_100"
  | "workflow.require_voucher_attachment"
  | "notifications.email_on_submission"
  | "notifications.email_on_status_change"
  | "notifications.email_on_dealius_success"
  | "notifications.admin_digest_enabled"
  | "notifications.admin_digest_time"
  | "integrations.dealius.username"
  | "integrations.dealius.password"
  | "integrations.dealius.last_test_at"
  | "integrations.dealius.last_test_result"
  | "integrations.buildout.api_key"
  | "integrations.buildout.api_base_url"
  | "integrations.buildout.default_company_id"
  | "integrations.buildout.last_test_at"
  | "integrations.buildout.last_test_result"
  | "integrations.broker_admin_ingest.enabled"
  | "integrations.broker_admin_ingest.mailbox"
  | "integrations.broker_admin_ingest.tenant_id"
  | "integrations.broker_admin_ingest.client_id"
  | "integrations.broker_admin_ingest.client_secret"
  | "integrations.broker_admin_ingest.last_test_at"
  | "integrations.broker_admin_ingest.last_test_result"
  | "integrations.dealius_api.enabled"
  | "integrations.dealius_api.base_url"
  | "integrations.dealius_api.api_key"
  | "integrations.dealius_api.last_test_at"
  | "integrations.dealius_api.last_test_result"
  | "security.session_timeout_hours";

export const SETTING_KEYS = [
  "branding.company_name",
  "branding.support_email",
  "branding.logo_url",
  "branding.primary_color",
  "branding.letterhead_template_url",
  "workflow.confidential_warning_enabled",
  "workflow.confidential_warning_text",
  "workflow.auto_save_interval_seconds",
  "workflow.default_listing_term_months",
  "workflow.commission_split_must_sum_100",
  "workflow.require_voucher_attachment",
  "notifications.email_on_submission",
  "notifications.email_on_status_change",
  "notifications.email_on_dealius_success",
  "notifications.admin_digest_enabled",
  "notifications.admin_digest_time",
  "integrations.dealius.username",
  "integrations.dealius.password",
  "integrations.dealius.last_test_at",
  "integrations.dealius.last_test_result",
  "integrations.buildout.api_key",
  "integrations.buildout.api_base_url",
  "integrations.buildout.default_company_id",
  "integrations.buildout.last_test_at",
  "integrations.buildout.last_test_result",
  "integrations.broker_admin_ingest.enabled",
  "integrations.broker_admin_ingest.mailbox",
  "integrations.broker_admin_ingest.tenant_id",
  "integrations.broker_admin_ingest.client_id",
  "integrations.broker_admin_ingest.client_secret",
  "integrations.broker_admin_ingest.last_test_at",
  "integrations.broker_admin_ingest.last_test_result",
  "integrations.dealius_api.enabled",
  "integrations.dealius_api.base_url",
  "integrations.dealius_api.api_key",
  "integrations.dealius_api.last_test_at",
  "integrations.dealius_api.last_test_result",
  "security.session_timeout_hours",
] as const satisfies readonly SettingKey[];

export type SettingKeyConst = (typeof SETTING_KEYS)[number];

export type SettingDef = {
  key: SettingKey;
  category: SettingsCategory;
  sensitive: boolean;
  /** Zod schema used to validate PATCH values (defaults applied when loading missing keys). */
  valueSchema: z.ZodTypeAny;
  defaultValue: unknown;
  description?: string;
};

const defs: SettingDef[] = [
  {
    key: "branding.company_name",
    category: "branding",
    sensitive: false,
    valueSchema: z.string().min(1).max(100),
    defaultValue: "Lee & Associates Newport Beach",
    description: "Public-facing company name",
  },
  {
    key: "branding.support_email",
    category: "branding",
    sensitive: false,
    valueSchema: z.string().email(),
    defaultValue: "_NewportBeach-BrokerAdmin@lee-associates.com",
  },
  {
    key: "branding.logo_url",
    category: "branding",
    sensitive: false,
    valueSchema: optionalUrl,
    defaultValue: null,
  },
  {
    key: "branding.primary_color",
    category: "branding",
    sensitive: false,
    valueSchema: hexColor,
    defaultValue: "#A6192E",
  },
  {
    key: "branding.letterhead_template_url",
    category: "branding",
    sensitive: false,
    valueSchema: optionalUrl,
    defaultValue: null,
  },
  {
    key: "workflow.confidential_warning_enabled",
    category: "workflow",
    sensitive: false,
    valueSchema: z.boolean(),
    defaultValue: true,
  },
  {
    key: "workflow.confidential_warning_text",
    category: "workflow",
    sensitive: false,
    valueSchema: z.string().min(1).max(2000),
    defaultValue:
      "Confidential deals follow restricted handling per the deal team's instructions.",
  },
  {
    key: "workflow.auto_save_interval_seconds",
    category: "workflow",
    sensitive: false,
    valueSchema: z.coerce.number().int().min(10).max(300),
    defaultValue: 30,
  },
  {
    key: "workflow.default_listing_term_months",
    category: "workflow",
    sensitive: false,
    valueSchema: z.coerce.number().int().min(1).max(60),
    defaultValue: 12,
  },
  {
    key: "workflow.commission_split_must_sum_100",
    category: "workflow",
    sensitive: false,
    valueSchema: z.boolean(),
    defaultValue: true,
  },
  {
    key: "workflow.require_voucher_attachment",
    category: "workflow",
    sensitive: false,
    valueSchema: z.boolean(),
    defaultValue: true,
  },
  {
    key: "notifications.email_on_submission",
    category: "notifications",
    sensitive: false,
    valueSchema: z.boolean(),
    defaultValue: true,
  },
  {
    key: "notifications.email_on_status_change",
    category: "notifications",
    sensitive: false,
    valueSchema: z.boolean(),
    defaultValue: true,
  },
  {
    key: "notifications.email_on_dealius_success",
    category: "notifications",
    sensitive: false,
    valueSchema: z.boolean(),
    defaultValue: true,
  },
  {
    key: "notifications.admin_digest_enabled",
    category: "notifications",
    sensitive: false,
    valueSchema: z.boolean(),
    defaultValue: false,
  },
  {
    key: "notifications.admin_digest_time",
    category: "notifications",
    sensitive: false,
    valueSchema: hhmm,
    defaultValue: "08:00",
  },
  {
    key: "integrations.dealius.username",
    category: "integrations",
    sensitive: true,
    valueSchema: z.string().max(320),
    defaultValue: "",
  },
  {
    key: "integrations.dealius.password",
    category: "integrations",
    sensitive: true,
    valueSchema: z.string().max(512),
    defaultValue: "",
  },
  {
    key: "integrations.dealius.last_test_at",
    category: "integrations",
    sensitive: false,
    valueSchema: z.union([z.string().min(4), z.null()]),
    defaultValue: null,
  },
  {
    key: "integrations.dealius.last_test_result",
    category: "integrations",
    sensitive: false,
    valueSchema: testResultSchema,
    defaultValue: null,
  },
  {
    key: "integrations.buildout.api_key",
    category: "integrations",
    sensitive: true,
    valueSchema: z.string().max(256),
    defaultValue: "",
    description: "Buildout API key (URL path token)",
  },
  {
    key: "integrations.buildout.api_base_url",
    category: "integrations",
    sensitive: false,
    valueSchema: optionalUrl,
    defaultValue: null,
    description: "Optional Buildout API base (default https://buildout.com/api/v1)",
  },
  {
    key: "integrations.buildout.default_company_id",
    category: "integrations",
    sensitive: false,
    valueSchema: z.preprocess(
      v => (v === "" || v === undefined ? null : v),
      z.union([z.null(), z.coerce.number().int().positive()])
    ),
    defaultValue: null,
    description: "Optional company_id filter when sampling properties from Buildout",
  },
  {
    key: "integrations.buildout.last_test_at",
    category: "integrations",
    sensitive: false,
    valueSchema: z.union([z.string().min(4), z.null()]),
    defaultValue: null,
  },
  {
    key: "integrations.buildout.last_test_result",
    category: "integrations",
    sensitive: false,
    valueSchema: testResultSchema,
    defaultValue: null,
  },
  {
    key: "integrations.broker_admin_ingest.enabled",
    category: "integrations",
    sensitive: false,
    valueSchema: z.boolean(),
    defaultValue: false,
    description: "Enable 5-minute polling of the BrokerAdmin shared mailbox via Microsoft Graph.",
  },
  {
    key: "integrations.broker_admin_ingest.mailbox",
    category: "integrations",
    sensitive: false,
    valueSchema: z.string().trim().max(320),
    defaultValue: "_NewportBeach-BrokerAdmin@lee-associates.com",
    description: "Shared mailbox UPN polled for inbound submissions.",
  },
  {
    key: "integrations.broker_admin_ingest.tenant_id",
    category: "integrations",
    sensitive: false,
    valueSchema: z.string().trim().max(128),
    defaultValue: "",
    description: "Azure AD tenant id (Directory ID).",
  },
  {
    key: "integrations.broker_admin_ingest.client_id",
    category: "integrations",
    sensitive: false,
    valueSchema: z.string().trim().max(128),
    defaultValue: "",
    description: "Azure AD app (client) id.",
  },
  {
    key: "integrations.broker_admin_ingest.client_secret",
    category: "integrations",
    sensitive: true,
    valueSchema: z.string().max(512),
    defaultValue: "",
    description: "Azure AD app client secret value.",
  },
  {
    key: "integrations.broker_admin_ingest.last_test_at",
    category: "integrations",
    sensitive: false,
    valueSchema: z.union([z.string().min(4), z.null()]),
    defaultValue: null,
  },
  {
    key: "integrations.broker_admin_ingest.last_test_result",
    category: "integrations",
    sensitive: false,
    valueSchema: testResultSchema,
    defaultValue: null,
  },
  {
    key: "integrations.dealius_api.enabled",
    category: "integrations",
    sensitive: false,
    valueSchema: z.boolean(),
    defaultValue: false,
    description: "Enable Dealius REST API integration (separate from legacy username/password session flow).",
  },
  {
    key: "integrations.dealius_api.base_url",
    category: "integrations",
    sensitive: false,
    valueSchema: z.string().trim().min(1).max(512),
    defaultValue: "https://leenewportbeach.dealius.com",
    description: "Dealius tenant base URL (no trailing slash).",
  },
  {
    key: "integrations.dealius_api.api_key",
    category: "integrations",
    sensitive: true,
    valueSchema: z.string().max(512),
    defaultValue: "",
    description: "Dealius API key (sent as X-API-KEY header).",
  },
  {
    key: "integrations.dealius_api.last_test_at",
    category: "integrations",
    sensitive: false,
    valueSchema: z.union([z.string().min(4), z.null()]),
    defaultValue: null,
  },
  {
    key: "integrations.dealius_api.last_test_result",
    category: "integrations",
    sensitive: false,
    valueSchema: testResultSchema,
    defaultValue: null,
  },
  {
    key: "security.session_timeout_hours",
    category: "security",
    sensitive: false,
    valueSchema: z.coerce.number().int().min(1).max(72),
    defaultValue: 12,
  },

];

export const SETTINGS_BY_KEY = Object.fromEntries(defs.map(d => [d.key, d])) as Record<SettingKey, SettingDef>;

export const SETTINGS_KEYS_SET = new Set<string>(SETTING_KEYS);

export function isSettingKey(key: string): key is SettingKey {
  return SETTINGS_KEYS_SET.has(key);
}

export function getDef(key: string): SettingDef {
  if (!isSettingKey(key)) {
    throw new Error(`Unknown setting key: ${key}`);
  }
  return SETTINGS_BY_KEY[key];
}

export function categoryForKey(key: SettingKey): SettingsCategory {
  return SETTINGS_BY_KEY[key].category;
}
