import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import { Button, Card, Icons, Badge, Field, Input } from "../design/index.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const TOAST_MS = 4000;
const PAGE_SIZE = 25;

type PlatformRole = "admin" | "broker" | "readonly";

type AppUserRow = {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: PlatformRole;
  office: string | null;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  created_by_name: string | null;
};

type ListResponse = {
  users: AppUserRow[];
  total: number;
  page: number;
  page_size: number;
  active_admin_count: number;
};

type MeResponse =
  | { id: string; email: string; username: string; full_name: string; role: PlatformRole; office: string | null }
  | { success?: boolean; data?: { user?: { openId?: string; name?: string; email?: string; role?: string } } };

function isUuidMe(r: MeResponse): r is Extract<MeResponse, { id: string }> {
  return typeof (r as { id?: string }).id === "string" && (r as { id: string }).id.includes("-");
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 14) return `${day} day${day === 1 ? "" : "s"} ago`;
  const wk = Math.floor(day / 7);
  if (wk < 8) return `${wk} week${wk === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function fullTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

const inputBar: CSSProperties = {
  width: 360,
  maxWidth: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--ink-200)",
  background: "white",
  fontSize: 13,
};

const selectBar: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--ink-200)",
  background: "white",
  fontSize: 13,
  minWidth: 160,
};

async function adminFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: { code: string; message: string; field?: string } }> {
  const headers: Record<string, string> = {
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const r = await fetch(path, { credentials: "include", ...init, headers });
  const ct = r.headers.get("content-type") ?? "";
  const b = ct.includes("application/json") ? await r.json() : {};
  if (!r.ok) {
    const err = b?.error;
    return {
      ok: false,
      status: r.status,
      error: {
        code: typeof err?.code === "string" ? err.code : "ERROR",
        message: typeof err?.message === "string" ? err.message : r.statusText || "Request failed",
        field: typeof err?.field === "string" ? err.field : undefined,
      },
    };
  }
  return { ok: true, data: b as T };
}

function roleLabel(role: PlatformRole): string {
  if (role === "admin") return "Admin";
  if (role === "broker") return "Broker";
  return "Read-Only";
}

function RolePill({ role }: { role: PlatformRole }) {
  if (role === "admin") return <Badge tone="crimson">{roleLabel(role)}</Badge>;
  if (role === "broker")
    return (
      <Badge tone="slate" style={{ background: "var(--lee-slate-wash)", color: "var(--lee-slate)", borderColor: "rgba(87,90,116,.25)" }}>
        {roleLabel(role)}
      </Badge>
    );
  return <Badge tone="neutral">{roleLabel(role)}</Badge>;
}

export default function PortalAdminUsers() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const [platformMe, setPlatformMe] = useState<{ id: string; role: PlatformRole } | null>(null);
  const [inviteEmailOk, setInviteEmailOk] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | PlatformRole>("");
  const [statusFilter, setStatusFilter] = useState<"true" | "false" | "">("true");
  const [sort, setSort] = useState<"name_asc" | "recent" | "last_login">("recent");
  const [page, setPage] = useState(1);

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUserRow | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<AppUserRow | null>(null);

  const [highlightId, setHighlightId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (loading) return;
    if (user?.role !== "admin") {
      toast.error("Admin access required.", { duration: TOAST_MS });
      setLocation("/dashboard");
    }
  }, [loading, user?.role, setLocation]);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.json().then((j: MeResponse) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!alive || !ok) return;
        if (isUuidMe(j)) {
          setPlatformMe({ id: j.id, role: j.role });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const loadConfig = useCallback(async () => {
    const r = await adminFetch<{ invite_email_configured: boolean }>("/api/admin/users/config");
    if (r.ok) setInviteEmailOk(Boolean(r.data.invite_email_configured));
  }, []);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("page_size", String(PAGE_SIZE));
    params.set("sort", sort);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("is_active", statusFilter);

    const r = await adminFetch<ListResponse>(`/api/admin/users?${params.toString()}`);
    setListLoading(false);
    if (!r.ok) {
      setList(null);
      setListError(r.error.message);
      return;
    }
    setList(r.data);
  }, [page, sort, debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    void loadConfig();
  }, [user?.role, loadConfig]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    void loadList();
  }, [user?.role, loadList]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, statusFilter, sort]);

  useEffect(() => {
    if (!highlightId) return;
    const row = rowRefs.current[highlightId];
    // Use "auto" (instant) instead of smooth so the page doesn’t appear to
    // scroll on its own after an edit — it just lands on the row.
    row?.scrollIntoView({ block: "nearest", behavior: "auto" });
    const t = window.setTimeout(() => setHighlightId(null), 2600);
    return () => window.clearTimeout(t);
  }, [highlightId, list?.users]);

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setRoleFilter("");
    setStatusFilter("true");
    setSort("recent");
    setPage(1);
  };

  const rangeLabel = useMemo(() => {
    if (!list || list.total === 0) return "Showing 0 of 0";
    const start = (list.page - 1) * list.page_size + 1;
    const end = Math.min(list.page * list.page_size, list.total);
    return `Showing ${start}–${end} of ${list.total}`;
  }, [list]);

  if (loading || user?.role !== "admin") {
    return (
      <AdminPortalShell section="users" title="Users" description="Manage brokers, admins, and read-only accounts.">
        <Card padding="lg">
          <div style={{ color: "var(--ink-500)", fontSize: 13 }}>Checking access…</div>
        </Card>
      </AdminPortalShell>
    );
  }

  const activeAdminCount = list?.active_admin_count ?? 0;

  return (
    <AdminPortalShell
      section="users"
      title="Users"
      description="Brokers submit deals; admins manage the queue, settings, and accounts. Read-only users can view without editing."
      actions={
        <Button type="button" variant="primary" icon={<Icons.Plus size={16} />} onClick={() => setAddOpen(true)}>
          + Add User
        </Button>
      }
    >
      <div style={{ marginTop: 14 }}>
        <Card padding="lg">
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, username, or email"
              style={inputBar}
              aria-label="Search users"
            />
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as "" | PlatformRole)} style={selectBar} aria-label="Filter by role">
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="broker">Broker</option>
              <option value="readonly">Read-Only</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as "true" | "false" | "")} style={selectBar} aria-label="Filter by status">
              <option value="true">Active</option>
              <option value="false">Deactivated</option>
              <option value="">All</option>
            </select>
            <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} style={selectBar} aria-label="Sort users">
              <option value="name_asc">Name A–Z</option>
              <option value="recent">Recently Added</option>
              <option value="last_login">Last Login</option>
            </select>
            <div style={{ fontSize: 12, color: "var(--ink-500)", marginLeft: "auto" }}>{rangeLabel}</div>
          </div>

          {listError && (
            <div style={{ color: "var(--err-700)", fontSize: 13, marginBottom: 12 }} role="alert">
              {listError}
            </div>
          )}

          {listLoading && !list ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  aria-hidden
                  style={{
                    height: 48,
                    borderRadius: 8,
                    background: "var(--ink-100)",
                    border: "1px solid var(--ink-200)",
                  }}
                />
              ))}
            </div>
          ) : list && list.users.length === 0 ? (
            <div
              style={{
                padding: 24,
                borderRadius: 12,
                border: "1px dashed var(--ink-300)",
                background: "var(--ink-50)",
                textAlign: "center",
                fontSize: 13,
                color: "var(--ink-600)",
              }}
            >
              No users match your filters.{" "}
              <button
                type="button"
                onClick={clearFilters}
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
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div
                style={{
                  border: "1px solid var(--ink-200)",
                  borderRadius: 10,
                  overflow: "auto",
                  opacity: listLoading ? 0.65 : 1,
                  transition: "opacity .15s",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--ink-50)", color: "var(--ink-500)", textAlign: "left" }}>
                      {["Name", "Username", "Email", "Role", "Office", "Last Login", "Status", ""].map(h => (
                        <th
                          key={h}
                          style={{
                            padding: "12px 16px",
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            borderBottom: "1px solid var(--ink-200)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list?.users.map(u => (
                      <tr
                        key={u.id}
                        ref={el => {
                          rowRefs.current[u.id] = el;
                        }}
                        data-user-id={u.id}
                        style={{
                          background: highlightId === u.id ? "var(--lee-crimson-wash)" : "var(--ink-0)",
                          transition: "background 0.4s ease",
                          borderBottom: "1px solid var(--ink-150)",
                        }}
                      >
                        <td style={{ padding: "14px 16px", fontWeight: 600, color: "var(--ink-900)" }}>{u.full_name}</td>
                        <td style={{ padding: "14px 16px", fontFamily: "var(--font-mono)", fontSize: 12 }}>{u.username}</td>
                        <td style={{ padding: "14px 16px", color: "var(--ink-700)" }}>{u.email}</td>
                        <td style={{ padding: "14px 16px" }}>
                          <RolePill role={u.role} />
                        </td>
                        <td style={{ padding: "14px 16px", color: "var(--ink-600)", maxWidth: 160 }}>{u.office || "—"}</td>
                        <td style={{ padding: "14px 16px", color: "var(--ink-600)" }} title={fullTimestamp(u.last_login_at)}>
                          {formatRelative(u.last_login_at)}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          {u.is_active ? (
                            <Badge tone="success">Active</Badge>
                          ) : (
                            <Badge tone="neutral">Deactivated</Badge>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Actions for ${u.full_name}`}
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 8,
                                  border: "1px solid var(--ink-200)",
                                  background: "var(--ink-0)",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "var(--ink-600)",
                                }}
                              >
                                <Icons.MoreV size={18} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[180px]">
                              <DropdownMenuItem onClick={() => setEditUser(u)}>Edit</DropdownMenuItem>
                              {u.is_active ? (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeactivateUser(u)}
                                >
                                  Deactivate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-[var(--ok-600)] focus:text-[var(--ok-600)]"
                                  onClick={async () => {
                                    const r = await adminFetch<AppUserRow>(`/api/admin/users/${u.id}/reactivate`, { method: "POST" });
                                    if (!r.ok) {
                                      toast.error(r.error.message, { duration: TOAST_MS });
                                      return;
                                    }
                                    toast.success(`${u.full_name} is active again.`, { duration: TOAST_MS });
                                    await loadList();
                                  }}
                                >
                                  Reactivate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
                <div style={{ fontSize: 12, color: "var(--ink-500)" }}>{rangeLabel}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="secondary" size="sm" disabled={!list || list.page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!list || list.page * list.page_size >= list.total}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <UserFormDialog
        mode="add"
        open={addOpen}
        onOpenChange={setAddOpen}
        inviteEmailOk={inviteEmailOk}
        platformActorId={platformMe?.id ?? null}
        activeAdminCount={activeAdminCount}
        onSuccess={async (createdId, fullName) => {
          setAddOpen(false);
          toast.success(`User added. ${fullName} can now log in.`, { duration: TOAST_MS });
          setPage(1);
          await loadList();
          setHighlightId(createdId);
        }}
      />

      {editUser && (
        <UserFormDialog
          mode="edit"
          user={editUser}
          open
          onOpenChange={o => !o && setEditUser(null)}
          inviteEmailOk={inviteEmailOk}
          platformActorId={platformMe?.id ?? null}
          activeAdminCount={activeAdminCount}
          onUpdated={async () => {
            setEditUser(null);
            toast.success("User updated.", { duration: TOAST_MS });
            await loadList();
          }}
        />
      )}

      <DeactivateDialog
        user={deactivateUser}
        onClose={() => setDeactivateUser(null)}
        onDone={async () => {
          const u = deactivateUser;
          setDeactivateUser(null);
          if (!u) return;
          await loadList();
          toast.success("User deactivated.", {
            duration: 10_000,
            action: {
              label: "Undo",
              onClick: async () => {
                const r = await adminFetch<AppUserRow>(`/api/admin/users/${u.id}/reactivate`, { method: "POST" });
                if (!r.ok) {
                  toast.error(r.error.message, { duration: TOAST_MS });
                  return;
                }
                toast.success(`${u.full_name} is active again.`, { duration: TOAST_MS });
                await loadList();
              },
            },
          });
        }}
      />


    </AdminPortalShell>
  );
}

function UserFormDialog({
  mode,
  open,
  onOpenChange,
  user,
  inviteEmailOk,
  platformActorId,
  activeAdminCount,
  onSuccess,
  onUpdated,
}: {
  mode: "add" | "edit";
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user?: AppUserRow;
  inviteEmailOk: boolean;
  platformActorId: string | null;
  activeAdminCount: number;
  onSuccess?: (id: string, fullName: string) => void;
  onUpdated?: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PlatformRole>("broker");
  const [office, setOffice] = useState("");
  const [phone, setPhone] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && user) {
      setFullName(user.full_name);
      setUsername(user.username);
      setEmail(user.email);
      setRole(user.role);
      setOffice(user.office ?? "");
      setPhone(user.phone ?? "");
      setSendInvite(false);
    } else {
      setFullName("");
      setUsername("");
      setEmail("");
      setRole("broker");
      setOffice("");
      setPhone("");
      setSendInvite(inviteEmailOk);
    }
    setFieldErrors({});
    setFormError(null);
  }, [open, mode, user, inviteEmailOk]);

  const self = mode === "edit" && user && platformActorId && user.id === platformActorId;
  const lastAdminRoleLock =
    mode === "edit" && user && user.role === "admin" && user.is_active && activeAdminCount <= 1;

  const roleTitleSelf = "You can't change your own role. Ask another admin.";
  const roleTitleLast = "This is the last active admin. Add another admin before changing this role.";

  const handleSubmit = async () => {
    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      if (mode === "add") {
        const r = await adminFetch<{ user: AppUserRow }>("/api/admin/users", {
          method: "POST",
          body: JSON.stringify({
            full_name: fullName.trim(),
            username: username.trim().toLowerCase(),
            email: email.trim(),
            role,
            office: office.trim() || null,
            phone: phone.trim() || null,
            send_invite: sendInvite && inviteEmailOk,
          }),
        });
        setSubmitting(false);
        if (!r.ok) {
          if (r.error.field) setFieldErrors({ [r.error.field]: r.error.message });
          else setFormError(r.error.message);
          return;
        }
        onSuccess?.(r.data.user.id, r.data.user.full_name);
        return;
      }

      if (!user) return;
      const body: Record<string, unknown> = {
        full_name: fullName.trim(),
        email: email.trim(),
        office: office.trim() || null,
        phone: phone.trim() || null,
      };
      if (!self) body.role = role;
      const r = await adminFetch<AppUserRow>(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setSubmitting(false);
      if (!r.ok) {
        if (r.error.field) setFieldErrors({ [r.error.field]: r.error.message });
        else setFormError(r.error.message);
        return;
      }
      onUpdated?.();
    } catch {
      setSubmitting(false);
      setFormError("Something went wrong. Try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]"
        style={{ fontFamily: "var(--font-sans)" }}
        onPointerDownOutside={e => {
          if (submitting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add a New User" : "Edit User"}</DialogTitle>
          <DialogDescription style={{ color: "var(--ink-500)" }}>
            {mode === "add" ? "Create a platform login for a broker or admin." : "Update profile and permissions. Username stays fixed for audit history."}
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Full Name" required error={fieldErrors.full_name}>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} disabled={submitting} placeholder="Taylor Barnes" />
          </Field>
          <Field
            label="Username"
            required
            help={mode === "add" ? "Lowercase: first initial + last name, e.g., tbarnes" : undefined}
            error={fieldErrors.username}
          >
            <Input
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase())}
              readOnly={mode === "edit"}
              disabled={submitting}
              inputStyle={mode === "edit" ? { color: "var(--ink-500)" } : undefined}
            />
          </Field>
          <Field label="Email" required error={fieldErrors.email}>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={submitting} />
          </Field>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 8 }}>Role</div>
            <div title={self ? roleTitleSelf : lastAdminRoleLock ? roleTitleLast : undefined}>
              <RadioGroup value={role} onValueChange={v => setRole(v as PlatformRole)} className="gap-3">
                {(
                  [
                    ["admin", "Admin: full access to everything including settings and other users."],
                    ["broker", "Broker: can submit vouchers, listings, sign requests, and contracts. Sees their own queue."],
                    ["readonly", "Read-Only: can view but cannot edit anything."],
                  ] as const
                ).map(([value, desc]) => {
                  const itemDisabled =
                    submitting ||
                    self ||
                    (lastAdminRoleLock && value !== "admin");
                  return (
                    <label
                      key={value}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        padding: 12,
                        borderRadius: 10,
                        border: `1px solid ${role === value ? "var(--lee-crimson)" : "var(--ink-200)"}`,
                        background: role === value ? "var(--lee-crimson-wash)" : "var(--ink-0)",
                        cursor: itemDisabled ? "not-allowed" : "pointer",
                        opacity: itemDisabled ? 0.6 : 1,
                      }}
                    >
                      <RadioGroupItem value={value} id={`role-${value}`} style={{ marginTop: 2 }} disabled={itemDisabled} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{value === "admin" ? "Admin" : value === "broker" ? "Broker" : "Read-Only"}</div>
                        <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>{desc}</div>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>
            {(self || lastAdminRoleLock) && (
              <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 6 }}>{self ? roleTitleSelf : roleTitleLast}</div>
            )}
          </div>

          <Field label="Office" optional error={fieldErrors.office}>
            <Input value={office} onChange={e => setOffice(e.target.value)} disabled={submitting} placeholder="Newport Beach" />
          </Field>
          <Field label="Phone" optional error={fieldErrors.phone}>
            <Input value={phone} onChange={e => setPhone(e.target.value)} disabled={submitting} placeholder="(949) 555-0100" />
          </Field>

          {mode === "add" && (
            <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, color: "var(--ink-700)" }}>
              <Checkbox checked={sendInvite && inviteEmailOk} disabled={!inviteEmailOk || submitting} onCheckedChange={c => setSendInvite(c === true)} />
              <span>Email login instructions to this user</span>
            </label>
          )}
          {mode === "add" && !inviteEmailOk && (
            <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
              Outbound email is not configured on the server, so login instructions cannot be sent automatically.
            </div>
          )}

          {formError && (
            <div style={{ fontSize: 13, color: "var(--err-700)", padding: 10, borderRadius: 8, background: "var(--err-50)", border: "1px solid var(--err-200)" }}>
              {formError}
            </div>
          )}
          {fieldErrors.role && <div style={{ fontSize: 12, color: "var(--err-600)" }}>{fieldErrors.role}</div>}
        </div>

        <DialogFooter style={{ gap: 8, marginTop: 8 }}>
          <Button type="button" variant="secondary" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="primary" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? (mode === "add" ? "Adding…" : "Saving…") : mode === "add" ? "Add User" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeactivateDialog({
  user,
  onClose,
  onDone,
}: {
  user: AppUserRow | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const open = Boolean(user);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    const r = await adminFetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error.message, { duration: TOAST_MS });
      return;
    }
    await onDone();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]" style={{ fontFamily: "var(--font-sans)" }}>
        <DialogHeader>
          <DialogTitle>Deactivate {user?.full_name ?? "user"}?</DialogTitle>
          <DialogDescription>
            {user?.full_name} will no longer be able to log in. Their submissions and audit history will be preserved. You can reactivate them later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter style={{ gap: 8 }}>
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="danger" disabled={busy} onClick={() => void submit()}>
            {busy ? "Deactivating…" : "Deactivate User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


