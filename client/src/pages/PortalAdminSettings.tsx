import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import { usePublicBranding } from "@/hooks/usePublicBranding";
import { Button, Card, Icons, Field, Input, Toggle } from "../design/index.jsx";
import { trpc } from "@/lib/trpc";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const TOAST_MS = 4000;
const MASKED_SECRET = "•••••••• (set)";

type SettingsCategory = "branding" | "workflow" | "notifications" | "integrations" | "security";

type GroupedSettings = Record<SettingsCategory, Record<string, unknown>>;

const SIDEBAR: ReadonlyArray<{ id: SettingsCategory; label: string }> = [
  { id: "branding", label: "Branding" },
  { id: "workflow", label: "Workflow" },
  { id: "notifications", label: "Notifications" },
  { id: "integrations", label: "Integrations" },
  { id: "security", label: "Security" },
];

const COMING_SOON: ReadonlyArray<{ name: string }> = [
  { name: "DocuSign" },
  { name: "CoStar / CARETS" },
  { name: "LoopNet" },
  { name: "CREXi" },
  { name: "Buildout" },
  { name: "Outlook / Microsoft 365" },
];

const rowGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(200px, 1fr) minmax(220px, 1fr)",
  gap: "var(--s-4)",
  alignItems: "start",
  padding: "var(--s-4) 0",
  borderBottom: "1px solid var(--ink-150)",
};

async function adminJson<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: { message: string; field?: string } }> {
  const headers: HeadersInit = {
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
    ...(init?.headers as Record<string, string>),
  };
  const r = await fetch(path, { credentials: "include", ...init, headers });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) {
    return {
      ok: false,
      error: { message: b?.error?.message ?? r.statusText ?? "Request failed", field: b?.error?.field },
    };
  }
  return { ok: true, data: b as T };
}

function getDeep(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function hasDealiusCredentials(integrations: Record<string, unknown>): boolean {
  const u = getDeep(integrations, ["dealius", "username"]);
  const p = getDeep(integrations, ["dealius", "password"]);
  const has = (v: unknown) =>
    v === MASKED_SECRET || (typeof v === "string" && v.trim().length > 0 && v !== "null");
  return has(u) || has(p);
}

type FieldSaveState = "idle" | "saving" | "saved" | "error";

export default function PortalAdminSettings() {
  const { user, loading } = useAuth();
  const publicBranding = usePublicBranding();
  const [, setLocation] = useLocation();
  const uploadMutation = trpc.files.upload.useMutation();

  const [category, setCategory] = useState<SettingsCategory>("branding");
  const [grouped, setGrouped] = useState<GroupedSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [meta, setMeta] = useState<{ invite_email_configured: boolean } | null>(null);

  const [fieldState, setFieldState] = useState<Record<string, FieldSaveState>>({});
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const debouncers = useRef<Record<string, number>>({});

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const [dealiusModal, setDealiusModal] = useState(false);
  const [dealiusUser, setDealiusUser] = useState("");
  const [dealiusPass, setDealiusPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [dealiusBusy, setDealiusBusy] = useState(false);
  const [dealiusPhase, setDealiusPhase] = useState<"verify" | "patch">("verify");
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [testBusy, setTestBusy] = useState(false);

  const [uploadKey, setUploadKey] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);

  const [emailHelpOpen, setEmailHelpOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user?.role !== "admin") {
      toast.error("Admin access required.", { duration: TOAST_MS });
      setLocation("/dashboard");
    }
  }, [loading, user?.role, setLocation]);

  const loadAll = useCallback(async () => {
    setLoadingSettings(true);
    setLoadError(null);
    const [g, m] = await Promise.all([
      adminJson<GroupedSettings>("/api/admin/settings"),
      adminJson<{ invite_email_configured: boolean }>("/api/admin/settings/meta"),
    ]);
    setLoadingSettings(false);
    if (!g.ok) {
      setGrouped(null);
      setLoadError(g.error.message);
      return;
    }
    setGrouped(g.data);
    if (m.ok) setMeta(m.data);
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") return;
    void loadAll();
  }, [user?.role, loadAll]);

  const patchKey = useCallback(
    async (key: string, value: unknown) => {
      setFieldState(s => ({ ...s, [key]: "saving" }));
      setFieldError(s => {
        const n = { ...s };
        delete n[key];
        return n;
      });
      const r = await adminJson<GroupedSettings>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
      if (!r.ok) {
        setFieldState(s => ({ ...s, [key]: "error" }));
        setFieldError(s => ({ ...s, [key]: r.error.message }));
        toast.error(r.error.message, { duration: TOAST_MS });
        await loadAll();
        return false;
      }
      setGrouped(r.data);
      setFieldState(s => ({ ...s, [key]: "saved" }));
      window.setTimeout(() => {
        setFieldState(s => (s[key] === "saved" ? { ...s, [key]: "idle" } : s));
      }, 2000);
      return true;
    },
    [loadAll]
  );

  const schedulePatch = useCallback(
    (key: string, value: unknown, delayMs: number) => {
      const prev = debouncers.current[key];
      if (prev) window.clearTimeout(prev);
      debouncers.current[key] = window.setTimeout(() => {
        void patchKey(key, value);
        delete debouncers.current[key];
      }, delayMs);
    },
    [patchKey]
  );

  const dealius = useMemo(() => {
    const int = grouped?.integrations ?? {};
    return {
      username: getDeep(int, ["dealius", "username"]),
      password: getDeep(int, ["dealius", "password"]),
      last_test_at: getDeep(int, ["dealius", "last_test_at"]),
      last_test_result: getDeep(int, ["dealius", "last_test_result"]),
    };
  }, [grouped]);

  const dealiusConnected = useMemo(() => {
    if (!grouped?.integrations) return false;
    return hasDealiusCredentials(grouped.integrations as Record<string, unknown>);
  }, [grouped]);

  const dealiusStatus = useMemo(() => {
    if (!dealiusConnected) return { tone: "neutral" as const, label: "Not Connected" };
    if (dealius.last_test_result === "failed") return { tone: "danger" as const, label: "Error" };
    if (dealius.last_test_result === "success") return { tone: "success" as const, label: "Connected" };
    return { tone: "neutral" as const, label: "Not Connected" };
  }, [dealiusConnected, dealius.last_test_result]);

  const runTestConnection = async () => {
    setTestBusy(true);
    const r = await adminJson<{ success: boolean; message: string; tested_at: string }>(
      "/api/admin/settings/integrations/dealius/test",
      { method: "POST" }
    );
    setTestBusy(false);
    if (!r.ok) {
      toast.error(r.error.message, { duration: TOAST_MS });
      return;
    }
    toast[r.data.success ? "success" : "error"](r.data.message, { duration: TOAST_MS });
    await loadAll();
  };

  const saveDealiusModal = async () => {
    setDealiusBusy(true);
    setDealiusPhase("verify");
    const v = await adminJson<{ success: boolean; message: string }>("/api/admin/settings/integrations/dealius/verify", {
      method: "POST",
      body: JSON.stringify({ username: dealiusUser.trim(), password: dealiusPass }),
    });
    if (!v.ok || !v.data.success) {
      setDealiusBusy(false);
      toast.error(v.ok ? v.data.message : v.error.message, { duration: TOAST_MS });
      return;
    }
    setDealiusPhase("patch");
    const p = await adminJson<GroupedSettings>("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({
        "integrations.dealius.username": dealiusUser.trim().toLowerCase(),
        "integrations.dealius.password": dealiusPass,
      }),
    });
    setDealiusBusy(false);
    if (!p.ok) {
      toast.error(p.error.message, { duration: TOAST_MS });
      await loadAll();
      return;
    }
    setGrouped(p.data);
    setDealiusModal(false);
    setDealiusPass("");
    toast.success("Dealius credentials saved.", { duration: TOAST_MS });
    await adminJson("/api/admin/settings/integrations/dealius/test", { method: "POST" });
    await loadAll();
  };

  const disconnectDealius = async () => {
    setDisconnectOpen(false);
    const r = await adminJson<GroupedSettings>("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({
        "integrations.dealius.username": "",
        "integrations.dealius.password": "",
      }),
    });
    if (!r.ok) {
      toast.error(r.error.message, { duration: TOAST_MS });
      return;
    }
    setGrouped(r.data);
    toast.success("Dealius disconnected.", { duration: TOAST_MS });
  };

  const uploadToSetting = async (key: string, file: File, categoryFolder: string) => {
    setUploadKey(key);
    setUploadPct(5);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = e => {
          if (e.lengthComputable) setUploadPct(5 + Math.round((e.loaded / e.total) * 85));
        };
        reader.onload = () => {
          const dataUrl = String(reader.result ?? "");
          const comma = dataUrl.indexOf(",");
          if (comma === -1) return reject(new Error("Could not read file"));
          resolve(dataUrl.slice(comma + 1));
        };
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      setUploadPct(92);
      const up = await uploadMutation.mutateAsync({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        base64Data,
        category: categoryFolder,
        reference: "admin-settings",
        uploaderName: user?.name || undefined,
      });
      if (!up?.success || !up?.url) throw new Error("Upload failed");
      setUploadPct(100);
      const ok = await patchKey(key, up.url);
      if (!ok) throw new Error("Could not save setting");
      toast.success("File uploaded and saved.", { duration: TOAST_MS });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed", { duration: TOAST_MS });
      await loadAll();
    } finally {
      setUploadKey(null);
      setUploadPct(0);
    }
  };

  const revokeSessions = async () => {
    setRevokeBusy(true);
    const r = await adminJson<{ cleared: number }>("/api/admin/settings/actions/revoke-all-sessions", { method: "POST" });
    setRevokeBusy(false);
    setRevokeOpen(false);
    if (!r.ok) {
      toast.error(r.error.message, { duration: TOAST_MS });
      return;
    }
    toast.success(`Signed out all users (${r.data.cleared} session${r.data.cleared === 1 ? "" : "s"} cleared).`, {
      duration: TOAST_MS,
    });
  };

  const SaveHint = ({ k }: { k: string }) => {
    const st = fieldState[k];
    if (st === "saving") return <span style={{ fontSize: 11, color: "var(--ink-500)" }}>Saving…</span>;
    if (st === "saved") return <span style={{ fontSize: 11, color: "var(--ok-600)", fontWeight: 600 }}>Saved ✓</span>;
    if (st === "error") return <span style={{ fontSize: 11, color: "var(--err-600)" }}>{fieldError[k] ?? "Error"}</span>;
    return null;
  };

  if (loading || user?.role !== "admin") {
    return (
      <AdminPortalShell section="settings" title="Settings" description="">
        <Card padding="lg">
          <div style={{ color: "var(--ink-500)", fontSize: 13 }}>Checking access…</div>
        </Card>
      </AdminPortalShell>
    );
  }

  const b = grouped?.branding ?? {};
  const w = grouped?.workflow ?? {};
  const n = grouped?.notifications ?? {};
  const s = grouped?.security ?? {};

  return (
    <AdminPortalShell
      section="settings"
      title="Settings"
      description="Configure branding, workflow rules, broker notifications, integrations, and security for the broker operations portal."
    >
      <div style={{ marginTop: 14, display: "flex", gap: 24, alignItems: "flex-start" }}>
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            position: "sticky",
            top: 16,
            alignSelf: "flex-start",
            borderRadius: 12,
            border: "1px solid var(--ink-200)",
            background: "var(--ink-0)",
            padding: "var(--s-2)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="lee-eyebrow" style={{ padding: "8px 10px", marginBottom: 4 }}>
            Categories
          </div>
          {SIDEBAR.map(tab => {
            const active = tab.id === category;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategory(tab.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  marginBottom: 4,
                  border: "none",
                  borderRadius: 8,
                  background: active ? "var(--lee-crimson-wash)" : "transparent",
                  borderLeft: active ? "3px solid var(--lee-crimson)" : "3px solid transparent",
                  fontWeight: active ? 700 : 500,
                  fontSize: 14,
                  color: active ? "var(--lee-crimson-ink)" : "var(--ink-700)",
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </aside>

        <div style={{ flex: 1, minWidth: 0 }}>
          {loadError && (
            <Card padding="md" style={{ marginBottom: 12, borderColor: "var(--err-200)", background: "var(--err-50)" }}>
              <div style={{ color: "var(--err-700)", fontSize: 13 }}>{loadError}</div>
            </Card>
          )}
          {loadingSettings || !grouped ? (
            <Card padding="lg">
              <div style={{ color: "var(--ink-500)", fontSize: 13 }}>Loading settings…</div>
            </Card>
          ) : (
            <Card padding="lg">
              {category === "branding" && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "var(--ink-900)" }}>Branding</h2>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Company name</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>Shown on the sign-in page and public-facing surfaces.</div>
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Input
                          value={String(b.company_name ?? "")}
                          onChange={e => {
                            const v = e.target.value;
                            setGrouped(g =>
                              g ? { ...g, branding: { ...g.branding, company_name: v } } : g
                            );
                            schedulePatch("branding.company_name", v, 800);
                          }}
                          onBlur={() => {
                            const v = String(b.company_name ?? "");
                            void patchKey("branding.company_name", v);
                          }}
                        />
                        <SaveHint k="branding.company_name" />
                      </div>
                    </div>
                  </div>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Support email</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>Brokers reach your team here for deal desk questions.</div>
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Input
                          type="email"
                          value={String(b.support_email ?? "")}
                          onChange={e => {
                            const v = e.target.value;
                            setGrouped(g =>
                              g ? { ...g, branding: { ...g.branding, support_email: v } } : g
                            );
                            schedulePatch("branding.support_email", v, 800);
                          }}
                          onBlur={() => void patchKey("branding.support_email", String(b.support_email ?? ""))}
                        />
                        <SaveHint k="branding.support_email" />
                      </div>
                    </div>
                  </div>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Logo</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>PNG or SVG recommended. Stored as a secure URL.</div>
                    </div>
                    <div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={<Icons.Upload size={14} />}
                            disabled={uploadMutation.isPending}
                            onClick={() => {
                              const inp = document.createElement("input");
                              inp.type = "file";
                              inp.accept = "image/png,image/jpeg,image/svg+xml,image/webp";
                              inp.onchange = () => {
                                const f = inp.files?.[0];
                                if (f) void uploadToSetting("branding.logo_url", f, "admin/branding");
                              };
                              inp.click();
                            }}
                          >
                            Upload logo
                          </Button>
                          <SaveHint k="branding.logo_url" />
                        </div>
                        {uploadKey === "branding.logo_url" && <Progress value={uploadPct} className="h-1.5" />}
                        {b.logo_url ? (
                          <div style={{ fontSize: 12, color: "var(--ink-600)", wordBreak: "break-all" }}>{String(b.logo_url)}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Primary color</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>Accent color for buttons and highlights (hex).</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <input
                        type="color"
                        value={(() => {
                          const raw = String(b.primary_color ?? publicBranding.primary_color).trim();
                          const hex = raw.startsWith("#") ? raw : `#${raw}`;
                          return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : publicBranding.primary_color;
                        })()}
                        onChange={e => {
                          const hex = e.target.value.toUpperCase();
                          setGrouped(g =>
                            g ? { ...g, branding: { ...g.branding, primary_color: hex } } : g
                          );
                          schedulePatch("branding.primary_color", hex, 800);
                        }}
                        onBlur={() =>
                          void patchKey(
                            "branding.primary_color",
                            String(b.primary_color ?? publicBranding.primary_color).toUpperCase()
                          )
                        }
                        style={{ width: 48, height: 40, padding: 0, border: "1px solid var(--ink-200)", borderRadius: 8, cursor: "pointer" }}
                        aria-label="Pick primary color"
                      />
                      <span
                        title="Preview"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: String(b.primary_color ?? publicBranding.primary_color),
                          border: "1px solid var(--ink-200)",
                          boxShadow: "var(--shadow-sm)",
                        }}
                      />
                      <SaveHint k="branding.primary_color" />
                    </div>
                  </div>
                  <div style={{ ...rowGrid, borderBottom: "none" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Letterhead template</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>PDF or Word template for deal packages (stored URL).</div>
                    </div>
                    <div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={<Icons.Upload size={14} />}
                            disabled={uploadMutation.isPending}
                            onClick={() => {
                              const inp = document.createElement("input");
                              inp.type = "file";
                              inp.accept = ".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                              inp.onchange = () => {
                                const f = inp.files?.[0];
                                if (f) void uploadToSetting("branding.letterhead_template_url", f, "admin/branding");
                              };
                              inp.click();
                            }}
                          >
                            Upload template
                          </Button>
                          <SaveHint k="branding.letterhead_template_url" />
                        </div>
                        {uploadKey === "branding.letterhead_template_url" && <Progress value={uploadPct} className="h-1.5" />}
                        {b.letterhead_template_url ? (
                          <div style={{ fontSize: 12, color: "var(--ink-600)", wordBreak: "break-all" }}>{String(b.letterhead_template_url)}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {category === "workflow" && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "var(--ink-900)" }}>Workflow</h2>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Confidential deal warning</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>Show a banner when a submission is marked confidential.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Toggle
                        on={Boolean(w.confidential_warning_enabled)}
                        onClick={() => {
                          const next = !Boolean(w.confidential_warning_enabled);
                          setGrouped(g =>
                            g ? { ...g, workflow: { ...g.workflow, confidential_warning_enabled: next } } : g
                          );
                          void patchKey("workflow.confidential_warning_enabled", next);
                        }}
                      />
                      <SaveHint k="workflow.confidential_warning_enabled" />
                    </div>
                  </div>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Confidential warning text</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>Copy brokers see next to confidential deals.</div>
                    </div>
                    <div>
                      <textarea
                        disabled={!Boolean(w.confidential_warning_enabled)}
                        value={String(w.confidential_warning_text ?? "")}
                        onChange={e => {
                          const v = e.target.value;
                          setGrouped(g =>
                            g ? { ...g, workflow: { ...g.workflow, confidential_warning_text: v } } : g
                          );
                          if (w.confidential_warning_enabled) schedulePatch("workflow.confidential_warning_text", v, 800);
                        }}
                        onBlur={() => {
                          if (w.confidential_warning_enabled) void patchKey("workflow.confidential_warning_text", String(w.confidential_warning_text ?? ""));
                        }}
                        rows={4}
                        style={{
                          width: "100%",
                          padding: 12,
                          fontSize: 14,
                          borderRadius: 8,
                          border: "1px solid var(--ink-200)",
                          fontFamily: "var(--font-sans)",
                          opacity: w.confidential_warning_enabled ? 1 : 0.55,
                        }}
                      />
                      <div style={{ marginTop: 6 }}>
                        <SaveHint k="workflow.confidential_warning_text" />
                      </div>
                    </div>
                  </div>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Auto-save interval</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>How often drafts save while brokers work.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={String(w.auto_save_interval_seconds ?? 30)}
                        onChange={e => {
                          const v = Number(e.target.value);
                          setGrouped(g =>
                            g ? { ...g, workflow: { ...g.workflow, auto_save_interval_seconds: v } } : g
                          );
                          schedulePatch("workflow.auto_save_interval_seconds", v, 800);
                        }}
                        onBlur={() => void patchKey("workflow.auto_save_interval_seconds", Number(w.auto_save_interval_seconds ?? 30))}
                        suffix={<span style={{ fontSize: 13, color: "var(--ink-500)" }}>seconds</span>}
                      />
                      <SaveHint k="workflow.auto_save_interval_seconds" />
                    </div>
                  </div>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Default listing term</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>Starting term when creating new listing submissions.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={String(w.default_listing_term_months ?? 12)}
                        onChange={e => {
                          const v = Number(e.target.value);
                          setGrouped(g =>
                            g ? { ...g, workflow: { ...g.workflow, default_listing_term_months: v } } : g
                          );
                          schedulePatch("workflow.default_listing_term_months", v, 800);
                        }}
                        onBlur={() =>
                          void patchKey("workflow.default_listing_term_months", Number(w.default_listing_term_months ?? 12))
                        }
                        suffix={<span style={{ fontSize: 13, color: "var(--ink-500)" }}>months</span>}
                      />
                      <SaveHint k="workflow.default_listing_term_months" />
                    </div>
                  </div>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Commission splits must sum to 100%</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>Validates voucher commission math before submission.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Toggle
                        on={Boolean(w.commission_split_must_sum_100 ?? true)}
                        onClick={() => {
                          const next = !Boolean(w.commission_split_must_sum_100 ?? true);
                          setGrouped(g =>
                            g ? { ...g, workflow: { ...g.workflow, commission_split_must_sum_100: next } } : g
                          );
                          void patchKey("workflow.commission_split_must_sum_100", next);
                        }}
                      />
                      <SaveHint k="workflow.commission_split_must_sum_100" />
                    </div>
                  </div>
                  <div style={{ ...rowGrid, borderBottom: "none" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Require voucher attachment</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>Brokers must attach a voucher file before sending to admin.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Toggle
                        on={Boolean(w.require_voucher_attachment ?? true)}
                        onClick={() => {
                          const next = !Boolean(w.require_voucher_attachment ?? true);
                          setGrouped(g =>
                            g ? { ...g, workflow: { ...g.workflow, require_voucher_attachment: next } } : g
                          );
                          void patchKey("workflow.require_voucher_attachment", next);
                        }}
                      />
                      <SaveHint k="workflow.require_voucher_attachment" />
                    </div>
                  </div>
                </div>
              )}

              {category === "notifications" && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "var(--ink-900)" }}>Notifications</h2>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Email broker on submission</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>When a broker queues a new deal package.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Toggle
                        on={Boolean(n.email_on_submission ?? true)}
                        onClick={() => {
                          const next = !Boolean(n.email_on_submission ?? true);
                          setGrouped(g =>
                            g ? { ...g, notifications: { ...g.notifications, email_on_submission: next } } : g
                          );
                          void patchKey("notifications.email_on_submission", next);
                        }}
                      />
                      <SaveHint k="notifications.email_on_submission" />
                    </div>
                  </div>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Email broker on status change</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>When admin updates queue status on their submission.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Toggle
                        on={Boolean(n.email_on_status_change ?? true)}
                        onClick={() => {
                          const next = !Boolean(n.email_on_status_change ?? true);
                          setGrouped(g =>
                            g ? { ...g, notifications: { ...g.notifications, email_on_status_change: next } } : g
                          );
                          void patchKey("notifications.email_on_status_change", next);
                        }}
                      />
                      <SaveHint k="notifications.email_on_status_change" />
                    </div>
                  </div>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Email broker on Dealius success</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>After a voucher is accepted into Dealius.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Toggle
                        on={Boolean(n.email_on_dealius_success ?? true)}
                        onClick={() => {
                          const next = !Boolean(n.email_on_dealius_success ?? true);
                          setGrouped(g =>
                            g ? { ...g, notifications: { ...g.notifications, email_on_dealius_success: next } } : g
                          );
                          void patchKey("notifications.email_on_dealius_success", next);
                        }}
                      />
                      <SaveHint k="notifications.email_on_dealius_success" />
                    </div>
                  </div>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Daily Admin Digest</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>Summary email for the deal desk team.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Toggle
                        on={Boolean(n.admin_digest_enabled)}
                        onClick={() => {
                          const next = !Boolean(n.admin_digest_enabled);
                          setGrouped(g =>
                            g ? { ...g, notifications: { ...g.notifications, admin_digest_enabled: next } } : g
                          );
                          void patchKey("notifications.admin_digest_enabled", next);
                        }}
                      />
                      <SaveHint k="notifications.admin_digest_enabled" />
                    </div>
                  </div>
                  <div style={{ ...rowGrid, borderBottom: "none" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Digest send time</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>24-hour clock in brokerage local time (server).</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="time"
                        disabled={!Boolean(n.admin_digest_enabled)}
                        value={String(n.admin_digest_time ?? "08:00").slice(0, 5)}
                        onChange={e => {
                          const v = e.target.value;
                          setGrouped(g =>
                            g ? { ...g, notifications: { ...g.notifications, admin_digest_time: v } } : g
                          );
                          if (n.admin_digest_enabled) schedulePatch("notifications.admin_digest_time", v, 800);
                        }}
                        onBlur={() => {
                          if (n.admin_digest_enabled) void patchKey("notifications.admin_digest_time", String(n.admin_digest_time ?? "08:00"));
                        }}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "1px solid var(--ink-200)",
                          fontSize: 14,
                          opacity: n.admin_digest_enabled ? 1 : 0.55,
                        }}
                      />
                      <SaveHint k="notifications.admin_digest_time" />
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 20,
                      padding: 14,
                      borderRadius: 10,
                      background: "var(--ink-50)",
                      border: "1px solid var(--ink-200)",
                      fontSize: 13,
                      color: "var(--ink-700)",
                    }}
                  >
                    Email is currently{" "}
                    <strong>{meta?.invite_email_configured ? "connected" : "not connected"}</strong>.
                    {!meta?.invite_email_configured && (
                      <>
                        {" "}
                        <button
                          type="button"
                          onClick={() => setEmailHelpOpen(true)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "var(--lee-crimson)",
                            fontWeight: 600,
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          Configure email
                        </button>
                      </>
                    )}
                  </div>

                  <Dialog open={emailHelpOpen} onOpenChange={setEmailHelpOpen}>
                    <DialogContent className="sm:max-w-md" style={{ fontFamily: "var(--font-sans)" }}>
                      <DialogHeader>
                        <DialogTitle>Configure outbound email</DialogTitle>
                        <DialogDescription>
                          Set <code className="lee-mono text-xs">SMTP_HOST</code>, <code className="lee-mono text-xs">SMTP_FROM</code>, and optional auth
                          variables in your server environment, then redeploy. Broker notification toggles only send when this is connected.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button type="button" variant="primary" onClick={() => setEmailHelpOpen(false)}>
                          Close
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {category === "integrations" && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "var(--ink-900)" }}>Integrations</h2>

                  <div
                    style={{
                      border: "1px solid var(--ink-200)",
                      borderRadius: 12,
                      padding: 20,
                      marginBottom: 20,
                      background: "var(--ink-0)",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 10,
                            background: "var(--lee-slate-wash)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--lee-slate)",
                            fontWeight: 800,
                            fontSize: 14,
                          }}
                        >
                          D
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16 }}>Dealius</div>
                          <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>Push approved deals and vouchers from the Dealius Entry workspace.</div>
                          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                            <BadgeIntegration tone={dealiusStatus.tone} label={dealiusStatus.label} />
                            {dealius.last_test_at ? (
                              <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                                Last tested: {new Date(String(dealius.last_test_at)).toLocaleString()}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--ink-500)" }}>Last tested: —</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <Button type="button" variant="secondary" size="sm" icon={<Icons.Lock size={14} />} onClick={() => setDealiusModal(true)}>
                          Configure
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={testBusy || !dealiusConnected}
                          onClick={() => void runTestConnection()}
                        >
                          {testBusy ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <span
                                className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                                aria-hidden
                              />
                              Testing…
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <Icons.CheckCircle size={14} />
                              Test connection
                            </span>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          icon={<Icons.X size={14} />}
                          disabled={!dealiusConnected}
                          onClick={() => setDisconnectOpen(true)}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="lee-eyebrow" style={{ marginBottom: 10 }}>
                    Coming soon (read-only)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                    {COMING_SOON.map(c => (
                      <div
                        key={c.name}
                        title="Not currently available."
                        style={{
                          padding: 14,
                          borderRadius: 10,
                          border: "1px solid var(--ink-200)",
                          background: "var(--ink-100)",
                          color: "var(--ink-400)",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "not-allowed",
                        }}
                      >
                        {c.name}
                      </div>
                    ))}
                  </div>

                  <Dialog open={dealiusModal} onOpenChange={setDealiusModal}>
                    <DialogContent className="sm:max-w-md" style={{ fontFamily: "var(--font-sans)" }}>
                      <DialogHeader>
                        <DialogTitle>Configure Dealius</DialogTitle>
                        <DialogDescription>Used by the Dealius Entry workspace to push approved deals automatically.</DialogDescription>
                      </DialogHeader>
                      <Field label="Username">
                        <Input value={dealiusUser} onChange={e => setDealiusUser(e.target.value)} placeholder="Dealius login email" />
                      </Field>
                      <Field label="Password">
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <Input
                            type={showPass ? "text" : "password"}
                            value={dealiusPass}
                            onChange={e => setDealiusPass(e.target.value)}
                            placeholder="••••••••"
                          />
                          <Button type="button" variant="ghost" size="sm" onClick={() => setShowPass(v => !v)}>
                            {showPass ? "Hide" : "Show"}
                          </Button>
                        </div>
                      </Field>
                      <DialogFooter style={{ gap: 8 }}>
                        <Button type="button" variant="secondary" onClick={() => setDealiusModal(false)}>
                          Cancel
                        </Button>
                        <Button type="button" variant="primary" disabled={dealiusBusy} onClick={() => void saveDealiusModal()}>
                          {dealiusBusy ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <span
                                className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
                                aria-hidden
                              />
                              {dealiusPhase === "patch" ? "Saving…" : "Testing…"}
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <Icons.CheckCircle size={14} />
                              Test & Save
                            </span>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Dealius?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Stored credentials will be removed. Automated pushes will stop until you configure Dealius again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-[var(--err-600)] text-white hover:bg-[#9A1A10]"
                          onClick={() => void disconnectDealius()}
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

              {category === "security" && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "var(--ink-900)" }}>Security</h2>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Session timeout</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>Platform sign-in sessions expire after this many hours.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Input
                        type="number"
                        value={String(s.session_timeout_hours ?? 12)}
                        onChange={e => {
                          const v = Number(e.target.value);
                          setGrouped(g =>
                            g ? { ...g, security: { ...g.security, session_timeout_hours: v } } : g
                          );
                          schedulePatch("security.session_timeout_hours", v, 800);
                        }}
                        onBlur={() => void patchKey("security.session_timeout_hours", Number(s.session_timeout_hours ?? 12))}
                        suffix={<span style={{ fontSize: 13, color: "var(--ink-500)" }}>hours</span>}
                      />
                      <SaveHint k="security.session_timeout_hours" />
                    </div>
                  </div>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Minimum password length</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>Applies to broker and admin platform passwords.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Input
                        type="number"
                        value={String(s.password_min_length ?? 12)}
                        onChange={e => {
                          const v = Number(e.target.value);
                          setGrouped(g =>
                            g ? { ...g, security: { ...g.security, password_min_length: v } } : g
                          );
                          schedulePatch("security.password_min_length", v, 800);
                        }}
                        onBlur={() => void patchKey("security.password_min_length", Number(s.password_min_length ?? 12))}
                      />
                      <SaveHint k="security.password_min_length" />
                    </div>
                  </div>
                  <div style={{ ...rowGrid, borderBottom: "none" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Require password change every</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>Set to 0 to disable scheduled password rotation.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Input
                        type="number"
                        value={String(s.require_password_change_days ?? 0)}
                        onChange={e => {
                          const v = Number(e.target.value);
                          setGrouped(g =>
                            g ? { ...g, security: { ...g.security, require_password_change_days: v } } : g
                          );
                          schedulePatch("security.require_password_change_days", v, 800);
                        }}
                        onBlur={() =>
                          void patchKey("security.require_password_change_days", Number(s.require_password_change_days ?? 0))
                        }
                        suffix={<span style={{ fontSize: 13, color: "var(--ink-500)" }}>days (0 = off)</span>}
                      />
                      <SaveHint k="security.require_password_change_days" />
                    </div>
                  </div>

                  <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--ink-150)" }}>
                    <Button type="button" variant="danger" icon={<Icons.Lock size={14} />} onClick={() => setRevokeOpen(true)}>
                      Force-log-out all users
                    </Button>
                    <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 8, maxWidth: 520 }}>
                      Ends every platform session (including yours). Brokers and admins must sign in again.
                    </div>
                  </div>

                  <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Sign out everyone?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This clears all rows in the sessions table. All brokers and admins lose active sign-ins immediately, including you.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={revokeBusy}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-[var(--err-600)] text-white hover:bg-[#9A1A10]"
                          disabled={revokeBusy}
                          onClick={e => {
                            e.preventDefault();
                            void revokeSessions();
                          }}
                        >
                          {revokeBusy ? "Signing out…" : "Sign out all users"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </AdminPortalShell>
  );
}

function BadgeIntegration({ tone, label }: { tone: "success" | "danger" | "neutral"; label: string }) {
  const bg =
    tone === "success"
      ? "var(--ok-100)"
      : tone === "danger"
        ? "var(--err-100)"
        : "var(--ink-100)";
  const color =
    tone === "success" ? "var(--ok-700)" : tone === "danger" ? "var(--err-700)" : "var(--ink-600)";
  const border =
    tone === "success"
      ? "rgba(15,122,63,.25)"
      : tone === "danger"
        ? "rgba(180,35,24,.25)"
        : "var(--ink-200)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
        background: bg,
        color,
        border: `1px solid ${border}`,
      }}
    >
      {label}
    </span>
  );
}
