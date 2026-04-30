import { trpc } from "@/lib/trpc";
import { Badge, Card, Icons, PageHeader } from "../design/index.jsx";

function formatDate(value: string | Date) {
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

function formatFormType(type: string) {
  switch (type) {
    case "listing":
      return { label: "Listing", tone: "slate" as const };
    case "voucher":
      return { label: "Voucher", tone: "crimson" as const };
    case "sign-request":
      return { label: "Sign", tone: "neutral" as const };
    case "comp":
      return { label: "Comp", tone: "ai" as const };
    default:
      return { label: type, tone: "neutral" as const };
  }
}

export default function QueueScreen() {
  const queueQuery = trpc.submissions.queueMine.useQuery({ limit: 50 });

  const totalPending = queueQuery.data?.totalPending ?? 0;
  const requests = queueQuery.data?.requests ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Broker Desk"
        title="Queue"
        description="Your pending submissions and your current position in the global processing line."
        right={
          <Badge tone="neutral" size="md" icon={<Icons.List size={14} />}>
            {requests.length} pending
          </Badge>
        }
      />

      <div style={{ padding: 32, display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {queueQuery.isLoading ? (
            <Card padding={20}>
              <div style={{ fontSize: 13, color: "var(--ink-600)" }}>Loading your queue…</div>
            </Card>
          ) : requests.length ? (
            requests.map(request => {
              const { label, tone } = formatFormType(request.formType);
              return (
                <Card key={request.id} padding={18} hoverable>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <Badge tone={tone} size="sm">
                          {label}
                        </Badge>
                        <span className="lee-mono" style={{ fontSize: 11, color: "var(--ink-400)" }}>
                          #{request.id}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--ink-500)" }}>
                          Submitted {formatDate(request.createdAt)}
                        </span>
                      </div>

                      <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: "var(--ink-900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {request.reference || "No property reference"}
                      </div>

                      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--ink-50)", borderRadius: 10, border: "1px solid var(--ink-200)" }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--warn-500)" }} />
                        <span style={{ fontSize: 12.5, color: "var(--ink-700)" }}>
                          <b>#{request.position}</b> in line
                        </span>
                        <span style={{ color: "var(--ink-300)" }}>·</span>
                        <span style={{ fontSize: 12.5, color: "var(--ink-500)" }}>
                          {request.aheadCount} ahead of you
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          ) : (
            <Card padding={20}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--ok-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icons.CheckCircle size={18} style={{ color: "var(--ok-600)" }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-900)" }}>No pending requests</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-500)", marginTop: 2 }}>
                    When you submit a listing, voucher, sign order, or comp entry, it will show up here until processed.
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 24 }}>
          <Card padding={20}>
            <div className="lee-eyebrow" style={{ marginBottom: 10 }}>
              Queue context
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div className="lee-mono" style={{ fontSize: 22, fontWeight: 700 }}>
                  {totalPending}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-500)" }}>Total pending (all brokers)</div>
              </div>
              <div>
                <div className="lee-mono" style={{ fontSize: 22, fontWeight: 700 }}>
                  {requests.length}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-500)" }}>Yours pending</div>
              </div>
            </div>
            <div style={{ marginTop: 14, fontSize: 12, color: "var(--ink-600)", lineHeight: 1.6 }}>
              Positions are computed by ordering <span className="lee-mono">pending</span> submissions by{" "}
              <span className="lee-mono">createdAt</span>, then <span className="lee-mono">id</span>.
            </div>
          </Card>

          {queueQuery.isError ? (
            <Card padding={20} style={{ borderColor: "rgba(180,35,24,.25)", background: "var(--err-100)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icons.Warn size={16} style={{ color: "var(--err-600)" }} />
                <div style={{ fontSize: 12.5, color: "var(--err-600)", fontWeight: 600 }}>
                  {queueQuery.error.message}
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

