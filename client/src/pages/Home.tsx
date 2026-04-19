import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, type ChangeEvent, type FormEvent } from "react";

const highlights = [
  {
    label: "No Microsoft handoff",
    title: "Broker-owned access",
    body: "Sign in with your Lee email and keep identity inside this app instead of handing brokers into a separate Microsoft flow.",
  },
  {
    label: "Direct workspace",
    title: "Open the full tool immediately",
    body: "Listing Entry, Commission Voucher, Sign Request, and Comp Input stay one click away with a cleaner working surface.",
  },
  {
    label: "Personal visibility",
    title: "Your submissions stay with you",
    body: "Everything you save while signed in appears in your own submission feed for quick follow-up and status checks.",
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

function formatCompactDate(value: string | Date) {
  try {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
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

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const payload = result.includes(",") ? result.split(",")[1] : result;
      resolve(payload);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function FormTypeChip({ type }: { type: string }) {
  const labels: Record<string, string> = {
    listing: "Listing",
    voucher: "Voucher",
    "sign-request": "Sign",
    comp: "Comp",
  };

  return (
    <span className="inline-block rounded-full bg-[#c32033]/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#c32033]">
      {labels[type] ?? type}
    </span>
  );
}

function CompReportCard({
  result,
}: {
  result: {
    title: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    metricLine: string;
    metaLine: string;
    reportCard: {
      comments: string;
      fields: Record<string, string>;
    };
  };
}) {
  const visibleFields = Object.entries(result.reportCard.fields)
    .filter(([, value]) => Boolean(value))
    .slice(0, 12);

  return (
    <article className="rounded-[1.5rem] border border-[#e2e1dc] bg-[#fbfbf9] p-5 shadow-[0_12px_24px_rgba(26,29,33,0.04)]">
      <div className="space-y-2 border-b border-[#ecebe6] pb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#c32033]">
          Report Preview
        </p>
        <h3 className="font-[var(--font-serif)] text-xl leading-tight text-[#272b30]">
          {result.title}
        </h3>
        <p className="text-sm leading-6 text-[#5f666e]">
          {[result.address, [result.city, result.state, result.zipCode].filter(Boolean).join(" ")]
            .filter(Boolean)
            .join(", ")}
        </p>
        {result.metricLine ? (
          <p className="text-xs font-medium text-[#394049]">{result.metricLine}</p>
        ) : null}
        {result.metaLine ? (
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#7a838c]">{result.metaLine}</p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {visibleFields.map(([label, value]) => (
          <div key={label} className="border-b border-[#efeee9] pb-2 last:border-b-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#8a9198]">{label}</p>
            <p className="mt-1 text-sm font-medium text-[#20242a]">{value}</p>
          </div>
        ))}
      </div>

      {result.reportCard.comments ? (
        <div className="mt-4 rounded-2xl border border-[#e8e6e1] bg-white px-4 py-3 text-sm leading-6 text-[#59616a]">
          {result.reportCard.comments}
        </div>
      ) : null}
    </article>
  );
}

export default function Home() {
  const { user, loading, logout, refresh } = useAuth();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [compType, setCompType] = useState<"lease" | "sale">("lease");
  const [compQuery, setCompQuery] = useState("");
  const [compCity, setCompCity] = useState("");
  const [compMarket, setCompMarket] = useState("");
  const [compSubMarket, setCompSubMarket] = useState("");
  const [compPropertyType, setCompPropertyType] = useState("");
  const [compDateFrom, setCompDateFrom] = useState("");
  const [compDateTo, setCompDateTo] = useState("");
  const [selectedWorkbookName, setSelectedWorkbookName] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async result => {
      if (result.success) await refresh();
    },
  });
  const uploadFileMutation = trpc.files.upload.useMutation();
  const importWorkbookMutation = trpc.compData.importWorkbook.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.compData.latest.invalidate(),
        utils.compData.search.invalidate(),
        utils.compData.listImports.invalidate(),
      ]);
    },
  });

  const submissionsQuery = trpc.submissions.mine.useQuery(
    { limit: 10 },
    { enabled: Boolean(user) }
  );
  const latestCompImportQuery = trpc.compData.latest.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const compSearchQuery = trpc.compData.search.useQuery(
    {
      compType,
      query: compQuery || undefined,
      city: compCity || undefined,
      market: compMarket || undefined,
      subMarket: compSubMarket || undefined,
      propertyType: compPropertyType || undefined,
      dateFrom: compDateFrom || undefined,
      dateTo: compDateTo || undefined,
      limit: 12,
    },
    { enabled: Boolean(user) }
  );
  const compImportsQuery = trpc.compData.listImports.useQuery(
    { limit: 6 },
    { enabled: user?.role === "admin" }
  );

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loginMutation.mutateAsync({ name, email });
  };

  const handleWorkbookUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || user.role !== "admin") return;

    setSelectedWorkbookName(file.name);
    const base64Data = await fileToBase64(file);
    const uploadResult = await uploadFileMutation.mutateAsync({
      filename: file.name,
      mimeType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64Data,
      category: "comp_workbook",
      reference: "comp-report-dataset",
      uploaderName: user.name ?? user.email ?? "Lee Admin",
    });

    await importWorkbookMutation.mutateAsync({
      fileKey: uploadResult.fileKey,
      filename: file.name,
    });

    event.target.value = "";
  };

  const recentSubmissions = submissionsQuery.data ?? [];
  const latestCompImport = latestCompImportQuery.data;
  const compResults = compSearchQuery.data?.results ?? [];

  return (
    <div className="min-h-screen bg-[#f2f2ef] text-[#1f2328]">
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-[#d9d8d2] bg-[#f8f8f5] shadow-[0_18px_38px_rgba(23,27,31,0.08)]">
          <div className="relative isolate grid gap-0 lg:grid-cols-[1.35fr_0.85fr]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(195,32,51,0.06),transparent_26%)]" />

            <div className="relative space-y-8 px-8 py-10 lg:px-12 lg:py-12">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <img
                  src="/lee-newport-beach-fullcolor.png"
                  alt="Lee & Associates Newport Beach"
                  className="h-auto w-full max-w-[150px]"
                />
                <span className="rounded-full border border-[#e7c6cb] bg-[#fff3f4] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#b51f31]">
                  Broker Workspace
                </span>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#848b93]">
                  Lee &amp; Associates Newport Beach
                </p>
                <h1 className="max-w-2xl font-[var(--font-serif)] text-3xl font-semibold leading-[1.08] text-[#272b30] sm:text-4xl">
                  Broker submissions, organized in one place.
                </h1>
                <p className="max-w-2xl text-[15px] leading-7 text-[#5f666e]">
                  Sign in with your Lee email, open the working tool immediately, and keep your own submissions visible without handing brokers into a separate Microsoft login flow.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="/broker_tool.html"
                  className="inline-flex items-center justify-center rounded-full bg-[#c32033] px-6 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(195,32,51,0.18)] transition hover:bg-[#a61b2b]"
                >
                  Open Broker Tool
                </a>
                {user ? (
                  <>
                    <a
                      href="#my-submissions"
                      className="inline-flex items-center justify-center rounded-full border border-[#d6d5cf] bg-white px-6 py-3 text-sm font-semibold text-[#2f343a] transition hover:border-[#bdbbb5]"
                    >
                      My Submissions
                    </a>
                    <a
                      href="#comp-reports"
                      className="inline-flex items-center justify-center rounded-full border border-[#e2c7cb] bg-[#fff4f5] px-6 py-3 text-sm font-semibold text-[#9f1e2e] transition hover:border-[#d8a3ab]"
                    >
                      Comp Reports
                    </a>
                  </>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Listing Entry", meta: "Property intake" },
                  { label: "Commission Voucher", meta: "Deal review" },
                  { label: "Comp Input", meta: "Market data" },
                ].map(item => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-[#e1e0db] bg-white px-4 py-3"
                  >
                    <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#8b9198]">
                      {item.meta}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#1f2328]">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex items-stretch">
              <div className="m-4 w-full rounded-[1.75rem] border border-[#e1e0db] bg-white p-6 text-[#1f2328] shadow-[0_16px_36px_rgba(0,0,0,0.06)] sm:m-6 sm:p-8 lg:m-5 lg:p-7">
                {!user ? (
                  <div className="flex h-full flex-col space-y-5">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#7b8792]">
                        Broker Sign-In
                      </p>
                      <h2 className="font-[var(--font-serif)] text-2xl leading-tight text-[#272b30]">
                        Sign in to track your activity
                      </h2>
                      <p className="text-sm leading-6 text-[#646a72]">
                        Use your Lee email to start a broker session and keep your submissions organized inside the tool.
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
                          className="h-12 w-full rounded-2xl border border-[#d8d7d2] bg-white px-4 text-[15px] text-[#1f2328] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/12"
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
                          className="h-12 w-full rounded-2xl border border-[#d8d7d2] bg-white px-4 text-[15px] text-[#1f2328] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/12"
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={loginMutation.isPending || loading}
                        className="mt-1 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#c32033] px-5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(195,32,51,0.22)] transition hover:bg-[#a61b2b] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loginMutation.isPending ? "Signing in..." : "Sign In"}
                      </button>

                      {loginMutation.data && !loginMutation.data.success ? (
                        <p className="rounded-2xl border border-[#ecc9ce] bg-[#fff2f3] px-4 py-3 text-sm text-[#8d2531]">
                          {loginMutation.data.error}
                        </p>
                      ) : null}

                      {loginMutation.error ? (
                        <p className="rounded-2xl border border-[#ecc9ce] bg-[#fff2f3] px-4 py-3 text-sm text-[#8d2531]">
                          {loginMutation.error.message}
                        </p>
                      ) : null}
                    </form>

                    <p className="mt-auto rounded-2xl border border-[#d9d8d2] bg-[#eeeeea] px-4 py-3 text-xs leading-5 text-[#5d636b]">
                      Access is for Lee brokers only. Identity stays in this app and does not require a Microsoft account.
                    </p>
                  </div>
                ) : (
                  <div className="flex h-full flex-col space-y-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2b2e33] text-base font-bold text-white">
                        {getInitials(user.name)}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#7b8792]">
                          Signed In
                        </p>
                        <p className="font-[var(--font-serif)] text-xl text-[#272b30]">
                          {user.name || "Lee Broker"}
                        </p>
                        <p className="text-xs text-[#5f666e]">{user.email}</p>
                      </div>
                    </div>

                    <a
                      href="/broker_tool.html"
                      className="inline-flex w-full items-center justify-center rounded-full bg-[#c32033] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(195,32,51,0.25)] transition hover:bg-[#a61b2b]"
                    >
                      Open Broker Tool
                    </a>

                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="inline-flex w-full items-center justify-center rounded-full border border-[#d1d0cb] bg-white px-5 py-2.5 text-sm font-semibold text-[#2e3339] transition hover:border-[#2b2e33]"
                    >
                      Sign Out
                    </button>

                    <div className="mt-auto grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-[#d8d7d2] bg-white px-3 py-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#7b8792]">
                          Session
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#1f2328]">Broker auth</p>
                      </div>
                      <div className="rounded-2xl border border-[#d8d7d2] bg-white px-3 py-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#7b8792]">
                          Scope
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#1f2328]">Your submissions</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {highlights.map(item => (
            <section
              key={item.title}
              className="rounded-[1.75rem] border border-[#ddddd8] bg-white/92 p-6 shadow-[0_12px_28px_rgba(26,29,33,0.05)]"
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-[#c32033]">
                {item.label}
              </p>
              <h3 className="mt-2.5 font-[var(--font-serif)] text-xl text-[#272b30]">
                {item.title}
              </h3>
              <p className="mt-2.5 text-sm leading-7 text-[#5f666e]">{item.body}</p>
            </section>
          ))}
        </div>
      </div>

      {user ? (
        <>
          <section id="my-submissions" className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[1.75rem] border border-[#dcdcd6] bg-white/96 shadow-[0_16px_40px_rgba(26,29,33,0.07)]">
              <div className="border-b border-[#e2e1dc] bg-[linear-gradient(90deg,rgba(31,35,40,0.03),rgba(195,32,51,0.04))] px-6 py-6 sm:px-8">
                <p className="text-[9px] font-bold uppercase tracking-[0.34em] text-[#7c8792]">
                  Broker Activity
                </p>
                <h2 className="mt-2 font-[var(--font-serif)] text-2xl text-[#272b30]">
                  My Submissions
                </h2>
              </div>

              <div className="px-6 py-6 sm:px-8">
                {submissionsQuery.isLoading ? (
                  <div className="rounded-3xl border border-dashed border-[#d8d7d2] bg-[#f6f6f2] px-5 py-10 text-center text-sm text-[#6b737c]">
                    Loading your recent submissions...
                  </div>
                ) : recentSubmissions.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {recentSubmissions.map(submission => (
                      <article
                        key={submission.id}
                        className="rounded-[1.25rem] border border-[#e2e1dc] bg-[#fbfbf9] p-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <FormTypeChip type={submission.formType} />
                          <p className="text-[11px] text-[#75808a]">
                            {formatSubmissionDate(submission.createdAt)}
                          </p>
                        </div>
                        <h3 className="mt-3 text-base font-semibold text-[#20242a]">
                          {getSubmissionLabel(submission)}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-[#626a72]">
                          Submission #{submission.id}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-[#d8d7d2] bg-[#f6f6f2] px-5 py-10 text-center text-sm leading-7 text-[#6b737c]">
                    No submissions yet. Open the broker tool, save a form while signed in, and it will appear here.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section id="comp-reports" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[1.75rem] border border-[#dcdcd6] bg-white/96 shadow-[0_16px_40px_rgba(26,29,33,0.07)]">
              <div className="border-b border-[#e2e1dc] bg-[linear-gradient(90deg,rgba(31,35,40,0.03),rgba(195,32,51,0.05))] px-6 py-6 sm:px-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.34em] text-[#7c8792]">
                      Comp Reporting
                    </p>
                    <h2 className="mt-2 font-[var(--font-serif)] text-2xl text-[#272b30]">
                      Comp Reports
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#626a72]">
                      Search the active comp workbook and preview report-ready records against the Lee Irvine / Metropolis structure.
                    </p>
                  </div>

                  {latestCompImport ? (
                    <div className="rounded-2xl border border-[#e4d4d7] bg-[#fff6f7] px-4 py-3 text-sm text-[#5d454a]">
                      <div className="font-semibold text-[#8e1f2d]">{latestCompImport.workbookName}</div>
                      <div className="mt-1 text-xs">
                        Active import • {latestCompImport.leaseCount.toLocaleString("en-US")} lease /{" "}
                        {latestCompImport.saleCount.toLocaleString("en-US")} sale •{" "}
                        {formatCompactDate(latestCompImport.createdAt)}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="px-6 py-6 sm:px-8">
                <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
                  <div className="space-y-6">
                    <div className="rounded-[1.5rem] border border-[#e2e1dc] bg-[#fbfbf9] p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#7d8790]">
                            Active Dataset
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-[#20242a]">Workbook status</h3>
                        </div>
                        <span className="rounded-full border border-[#e4d4d7] bg-[#fff4f5] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a11e2f]">
                          {latestCompImport ? "Ready" : "Awaiting import"}
                        </span>
                      </div>

                      {latestCompImport ? (
                        <div className="mt-4 space-y-3 text-sm text-[#5c646d]">
                          <div className="rounded-2xl border border-[#ecebe6] bg-white px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a9198]">
                              Source workbook
                            </p>
                            <p className="mt-1 font-semibold text-[#20242a]">
                              {latestCompImport.sourceFilename || latestCompImport.workbookName}
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-[#ecebe6] bg-white px-4 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a9198]">
                                Lease comps
                              </p>
                              <p className="mt-1 text-lg font-semibold text-[#20242a]">
                                {latestCompImport.leaseCount.toLocaleString("en-US")}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-[#ecebe6] bg-white px-4 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a9198]">
                                Sale comps
                              </p>
                              <p className="mt-1 text-lg font-semibold text-[#20242a]">
                                {latestCompImport.saleCount.toLocaleString("en-US")}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-[#d8d7d2] bg-white px-4 py-6 text-sm leading-6 text-[#6a7179]">
                          No active comp workbook yet. Once an admin imports the workbook, brokers can search and preview report-ready comps here.
                        </div>
                      )}
                    </div>

                    <div className="rounded-[1.5rem] border border-[#e2e1dc] bg-[#fbfbf9] p-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#7d8790]">
                        Search Filters
                      </p>
                      <div className="mt-4 grid gap-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#7c8792]">
                              Comp type
                            </span>
                            <select
                              value={compType}
                              onChange={e => setCompType(e.target.value as "lease" | "sale")}
                              className="h-11 w-full rounded-2xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                            >
                              <option value="lease">Lease comps</option>
                              <option value="sale">Sale comps</option>
                            </select>
                          </label>

                          <label className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#7c8792]">
                              Search
                            </span>
                            <input
                              value={compQuery}
                              onChange={e => setCompQuery(e.target.value)}
                              placeholder="Address, project, market"
                              className="h-11 w-full rounded-2xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                            />
                          </label>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            value={compCity}
                            onChange={e => setCompCity(e.target.value)}
                            placeholder="City"
                            className="h-11 w-full rounded-2xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                          />
                          <input
                            value={compMarket}
                            onChange={e => setCompMarket(e.target.value)}
                            placeholder="Market"
                            className="h-11 w-full rounded-2xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            value={compSubMarket}
                            onChange={e => setCompSubMarket(e.target.value)}
                            placeholder="Submarket"
                            className="h-11 w-full rounded-2xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                          />
                          <input
                            value={compPropertyType}
                            onChange={e => setCompPropertyType(e.target.value)}
                            placeholder="Property type"
                            className="h-11 w-full rounded-2xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            value={compDateFrom}
                            onChange={e => setCompDateFrom(e.target.value)}
                            type="date"
                            className="h-11 w-full rounded-2xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                          />
                          <input
                            value={compDateTo}
                            onChange={e => setCompDateTo(e.target.value)}
                            type="date"
                            className="h-11 w-full rounded-2xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                          />
                        </div>
                      </div>
                    </div>

                    {user.role === "admin" ? (
                      <div className="rounded-[1.5rem] border border-[#e2e1dc] bg-[#fbfbf9] p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#7d8790]">
                              Admin Import
                            </p>
                            <h3 className="mt-2 text-lg font-semibold text-[#20242a]">
                              Replace the active workbook
                            </h3>
                          </div>
                          <span className="rounded-full border border-[#e4d4d7] bg-[#fff4f5] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a11e2f]">
                            Admin only
                          </span>
                        </div>

                        <label className="mt-4 flex cursor-pointer flex-col rounded-2xl border border-dashed border-[#d4d2cc] bg-white px-4 py-5 text-sm text-[#5e6670] transition hover:border-[#c32033]">
                          <span className="font-semibold text-[#20242a]">Upload Excel workbook</span>
                          <span className="mt-1 text-xs leading-5">
                            Store the workbook in tool storage, import both canonical sheets, and promote it to the active dataset.
                          </span>
                          <input
                            type="file"
                            accept=".xlsx,.xlsm,.xls"
                            onChange={event => void handleWorkbookUpload(event)}
                            className="sr-only"
                          />
                        </label>

                        {selectedWorkbookName ? (
                          <p className="mt-3 text-xs text-[#6d757d]">Selected workbook: {selectedWorkbookName}</p>
                        ) : null}

                        {uploadFileMutation.isPending || importWorkbookMutation.isPending ? (
                          <div className="mt-4 rounded-2xl border border-[#ecd8db] bg-[#fff6f7] px-4 py-3 text-sm text-[#8d2531]">
                            Importing workbook. This can take a minute because the full comp dataset is being stored and indexed.
                          </div>
                        ) : null}

                        {importWorkbookMutation.isSuccess ? (
                          <div className="mt-4 rounded-2xl border border-[#d8e8dc] bg-[#f4fbf5] px-4 py-3 text-sm text-[#245b31]">
                            Workbook import completed successfully.
                          </div>
                        ) : null}

                        {uploadFileMutation.error || importWorkbookMutation.error ? (
                          <div className="mt-4 rounded-2xl border border-[#ecd8db] bg-[#fff6f7] px-4 py-3 text-sm text-[#8d2531]">
                            {uploadFileMutation.error?.message || importWorkbookMutation.error?.message}
                          </div>
                        ) : null}

                        {compImportsQuery.data?.length ? (
                          <div className="mt-4 space-y-2">
                            {compImportsQuery.data.map(item => (
                              <div
                                key={item.id}
                                className="rounded-2xl border border-[#ecebe6] bg-white px-4 py-3 text-sm text-[#55606a]"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-[#20242a]">{item.workbookName}</span>
                                  <span className="text-[11px] uppercase tracking-[0.18em] text-[#8b9198]">
                                    {item.status}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs">
                                  {item.leaseCount.toLocaleString("en-US")} lease /{" "}
                                  {item.saleCount.toLocaleString("en-US")} sale •{" "}
                                  {formatCompactDate(item.createdAt)}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    {compSearchQuery.isLoading ? (
                      <div className="rounded-3xl border border-dashed border-[#d8d7d2] bg-[#f6f6f2] px-5 py-12 text-center text-sm text-[#6b737c]">
                        Loading comp results...
                      </div>
                    ) : compResults.length > 0 ? (
                      <>
                        <p className="text-sm text-[#626a72]">
                          Showing {compResults.length} {compType} comp{compResults.length === 1 ? "" : "s"}
                        </p>
                        <div className="grid gap-4">
                          {compResults.map(result => (
                            <CompReportCard key={`${result.compType}-${result.id}`} result={result} />
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-3xl border border-dashed border-[#d8d7d2] bg-[#f6f6f2] px-5 py-12 text-center text-sm leading-7 text-[#6b737c]">
                        {latestCompImport
                          ? "No comps matched the current filters. Try widening the city, market, or date range."
                          : "Search results will appear here after the workbook is imported."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="pb-16" />
      )}
    </div>
  );
}
