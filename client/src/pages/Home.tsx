import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, type FormEvent } from "react";

const highlights = [
  {
    label: "No Microsoft handoff",
    title: "Broker-owned identity",
    body: "Sign in with your Lee email. Submissions are attached to your broker record — not to an IT-managed Microsoft account.",
  },
  {
    label: "One-click access",
    title: "Open the tool instantly",
    body: "Click through to Listing Entry, Commission Voucher, Sign Request, or Comp Input without any additional login step.",
  },
  {
    label: "Real-time tracking",
    title: "Your submissions, your view",
    body: "Every form you submit while signed in appears in your activity feed here for quick follow-up and status tracking.",
  },
];

function formatSubmissionDate(value: string | Date) {
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value.toString();
  }
}

function getSubmissionLabel(submission: {
  reference: string | null;
  payload: unknown;
}) {
  if (submission.reference) return submission.reference;
  if (
    submission.payload &&
    typeof submission.payload === "object" &&
    "address" in submission.payload &&
    typeof submission.payload.address === "string"
  ) {
    return submission.payload.address;
  }
  return "No property reference";
}

function getInitials(name?: string | null) {
  if (!name) return "LA";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase() ?? "").join("") || "LA";
}

function FormTypeChip({ type }: { type: string }) {
  const labels: Record<string, string> = {
    listing: "Listing",
    voucher: "Voucher",
    "sign-request": "Sign",
    comp: "Comp",
  };
  return (
    <span className="inline-block rounded-full bg-[#c10f4d]/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#c10f4d]">
      {labels[type] ?? type}
    </span>
  );
}

export default function Home() {
  const { user, loading, logout, refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async result => {
      if (result.success) await refresh();
    },
  });

  const submissionsQuery = trpc.submissions.mine.useQuery(
    { limit: 10 },
    { enabled: Boolean(user) }
  );

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loginMutation.mutateAsync({ name, email });
  };

  const recentSubmissions = submissionsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-[#f7f2eb] text-[#1d252d]">
      {/* ── Hero card ── */}
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2.25rem] bg-[#082f42] shadow-[0_32px_80px_rgba(6,20,32,0.26)]">
          {/* subtle overlay */}
          <div className="pointer-events-none absolute inset-0 rounded-[2.25rem] bg-[radial-gradient(circle_at_top_right,rgba(193,15,77,0.22),transparent_32%)]" />

          <div className="relative isolate grid gap-0 lg:grid-cols-[1.4fr_0.85fr]">
            {/* ── Left: brand + description ── */}
            <div className="space-y-8 px-8 py-10 lg:px-12 lg:py-12">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <img
                  src="/lee-newport-beach-white.png"
                  alt="Lee & Associates Newport Beach"
                  className="h-auto w-full max-w-[220px]"
                />
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-white/70">
                  Broker Ops Hub
                </span>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-[#f5b8cd]">
                  Lee &amp; Associates Newport Beach
                </p>
                <h1 className="max-w-xl font-[var(--font-serif)] text-4xl font-semibold leading-[1.05] text-white sm:text-5xl">
                  Your submissions.<br />Your identity.<br />Your tool.
                </h1>
                <p className="max-w-lg text-base leading-7 text-white/72">
                  A secure front door for Newport Beach brokers — sign in with your Lee email and open the full submission tool without any IT handoff.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="/broker_tool.html"
                  className="inline-flex items-center justify-center rounded-full bg-[#c10f4d] px-6 py-3 text-sm font-bold text-white shadow-[0_16px_32px_rgba(193,15,77,0.3)] transition hover:bg-[#a60d42]"
                >
                  Open Broker Tool →
                </a>
                {user ? (
                  <a
                    href="#my-submissions"
                    className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/18"
                  >
                    My Submissions
                  </a>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Listing Entry", icon: "🏢" },
                  { label: "Commission Voucher", icon: "📋" },
                  { label: "Comp Input", icon: "📊" },
                ].map(item => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-white/7 px-4 py-3 backdrop-blur-sm"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <p className="mt-1 text-sm font-semibold text-white">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right: auth card ── */}
            <div className="flex items-stretch">
              <div className="m-4 w-full rounded-[1.75rem] bg-[#f7f2eb] p-6 text-[#1e262c] shadow-[0_24px_60px_rgba(0,0,0,0.22)] sm:m-6 sm:p-8 lg:m-5 lg:p-7">
                {!user ? (
                  <div className="flex h-full flex-col space-y-5">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#7b8792]">
                        Broker Sign-In
                      </p>
                      <h2 className="font-[var(--font-serif)] text-2xl leading-tight text-[#082f42]">
                        Sign in to track your activity
                      </h2>
                      <p className="text-sm leading-6 text-[#5c6771]">
                        Use your Lee email to create a broker session and keep your submissions organized.
                      </p>
                    </div>

                    <form className="flex flex-col gap-4" onSubmit={handleLogin}>
                      <label className="block space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#6a757f]">
                          Your Name
                        </span>
                        <input
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="First Last"
                          required
                          className="h-12 w-full rounded-2xl border border-[#d4cac0] bg-white px-4 text-[15px] text-[#13212a] outline-none transition focus:border-[#c10f4d] focus:ring-4 focus:ring-[#c10f4d]/12"
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#6a757f]">
                          Lee Email
                        </span>
                        <input
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="name@lee-associates.com"
                          type="email"
                          required
                          className="h-12 w-full rounded-2xl border border-[#d4cac0] bg-white px-4 text-[15px] text-[#13212a] outline-none transition focus:border-[#c10f4d] focus:ring-4 focus:ring-[#c10f4d]/12"
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={loginMutation.isPending || loading}
                        className="mt-1 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#082f42] px-5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(8,47,66,0.22)] transition hover:bg-[#0d425b] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loginMutation.isPending ? "Signing in…" : "Sign In"}
                      </button>

                      {loginMutation.data && !loginMutation.data.success ? (
                        <p className="rounded-2xl border border-[#efc5cf] bg-[#fff1f4] px-4 py-3 text-sm text-[#9b2147]">
                          {loginMutation.data.error}
                        </p>
                      ) : null}

                      {loginMutation.error ? (
                        <p className="rounded-2xl border border-[#efc5cf] bg-[#fff1f4] px-4 py-3 text-sm text-[#9b2147]">
                          {loginMutation.error.message}
                        </p>
                      ) : null}
                    </form>

                    <p className="mt-auto rounded-2xl border border-[#ddd1c4] bg-[#f5efe8] px-4 py-3 text-xs leading-5 text-[#5d676f]">
                      Access is for Lee brokers only. Your identity stays inside this app — no Microsoft account required.
                    </p>
                  </div>
                ) : (
                  <div className="flex h-full flex-col space-y-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#082f42] text-base font-bold text-white">
                        {getInitials(user.name)}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#7b8792]">
                          Signed In
                        </p>
                        <p className="font-[var(--font-serif)] text-xl text-[#082f42]">
                          {user.name || "Lee Broker"}
                        </p>
                        <p className="text-xs text-[#5c6771]">{user.email}</p>
                      </div>
                    </div>

                    <a
                      href="/broker_tool.html"
                      className="inline-flex w-full items-center justify-center rounded-full bg-[#c10f4d] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(193,15,77,0.25)] transition hover:bg-[#a60d42]"
                    >
                      Open Broker Tool →
                    </a>

                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="inline-flex w-full items-center justify-center rounded-full border border-[#c8bbb0] bg-white px-5 py-2.5 text-sm font-semibold text-[#234054] transition hover:border-[#082f42]"
                    >
                      Sign Out
                    </button>

                    <div className="mt-auto grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-[#ddd2c7] bg-white px-3 py-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#7b8792]">Session</p>
                        <p className="mt-1 text-xs font-semibold text-[#13212a]">Broker auth</p>
                      </div>
                      <div className="rounded-2xl border border-[#ddd2c7] bg-white px-3 py-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#7b8792]">Scope</p>
                        <p className="mt-1 text-xs font-semibold text-[#13212a]">Your submissions</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Feature highlights ── */}
      <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {highlights.map(item => (
            <section
              key={item.title}
              className="rounded-[1.75rem] border border-[rgba(8,56,76,0.09)] bg-white/90 p-6 shadow-[0_12px_32px_rgba(17,36,51,0.06)] backdrop-blur"
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-[#c10f4d]">
                {item.label}
              </p>
              <h3 className="mt-2.5 font-[var(--font-serif)] text-xl text-[#082f42]">
                {item.title}
              </h3>
              <p className="mt-2.5 text-sm leading-7 text-[#5f6770]">{item.body}</p>
            </section>
          ))}
        </div>
      </div>

      {/* ── Submission history ── */}
      {user ? (
        <section
          id="my-submissions"
          className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8"
        >
          <div className="overflow-hidden rounded-[1.75rem] border border-[rgba(8,56,76,0.1)] bg-white/94 shadow-[0_16px_44px_rgba(17,36,51,0.08)]">
            <div className="border-b border-[rgba(8,56,76,0.08)] bg-[linear-gradient(90deg,rgba(8,47,66,0.05),rgba(193,15,77,0.03))] px-6 py-6 sm:px-8">
              <p className="text-[9px] font-bold uppercase tracking-[0.34em] text-[#7c8792]">
                Broker Activity
              </p>
              <h2 className="mt-2 font-[var(--font-serif)] text-2xl text-[#082f42]">
                My Submissions
              </h2>
            </div>

            <div className="px-6 py-6 sm:px-8">
              {submissionsQuery.isLoading ? (
                <div className="rounded-3xl border border-dashed border-[#d4c9be] bg-[#faf6f0] px-5 py-10 text-center text-sm text-[#6b737c]">
                  Loading your recent submissions…
                </div>
              ) : recentSubmissions.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {recentSubmissions.map(submission => (
                    <article
                      key={submission.id}
                      className="rounded-[1.25rem] border border-[rgba(8,56,76,0.08)] bg-[#fbf8f4] p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <FormTypeChip type={submission.formType} />
                        <p className="text-[11px] text-[#75808a]">
                          {formatSubmissionDate(submission.createdAt)}
                        </p>
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-[#0f2533]">
                        {getSubmissionLabel(submission)}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-[#60717a]">
                        Submission #{submission.id}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-[#d4c9be] bg-[#faf6f0] px-5 py-10 text-center text-sm leading-7 text-[#6b737c]">
                  No submissions yet. Open the broker tool, save a form while signed in, and it will appear here.
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <div className="pb-16" />
      )}
    </div>
  );
}
