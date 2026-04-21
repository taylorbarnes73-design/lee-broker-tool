import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, type ChangeEvent, type FormEvent } from "react";

const workspaceCards = [
  {
    label: "Broker Tool",
    title: "Listing, sign, voucher, and comp workflows",
    body: "Open the working tool, complete the required fields, and keep every submission inside one controlled system.",
    href: "/broker_tool.html",
  },
  {
    label: "Submission Tracking",
    title: "See what you sent and when",
    body: "Recent submissions stay attached to your session so brokers can follow up without asking admin to search manually.",
    href: "#my-submissions",
  },
  {
    label: "Comp Reports",
    title: "Search the active workbook",
    body: "Use the imported comp dataset to review report-ready lease and sale records in the same workspace.",
    href: "#comp-reports",
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
    <span className="inline-flex rounded-full border border-[#ecd4d8] bg-[#fff5f6] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#9d1e2d]">
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
    <article className="rounded-[1.25rem] border border-[#e2e1dc] bg-[#fbfbf8] p-5">
      <div className="border-b border-[#ecebe6] pb-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#9d1e2d]">
          Report Preview
        </p>
        <h3 className="mt-2 text-xl font-semibold leading-tight text-[#23272c]">{result.title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#5f666e]">
          {[result.address, [result.city, result.state, result.zipCode].filter(Boolean).join(" ")]
            .filter(Boolean)
            .join(", ")}
        </p>
        {result.metricLine ? (
          <p className="mt-2 text-xs font-medium text-[#394049]">{result.metricLine}</p>
        ) : null}
        {result.metaLine ? (
          <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-[#7a838c]">
            {result.metaLine}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {visibleFields.map(([label, value]) => (
          <div key={label} className="border-t border-[#efeee9] pt-3 first:border-t-0 first:pt-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#8a9198]">{label}</p>
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
      <header className="border-b border-[#dddcd6] bg-[#f7f7f3]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <img
              src="/lee-newport-beach-fullcolor.png"
              alt="Lee & Associates Newport Beach"
              className="h-auto w-[112px]"
            />
            <div>
              <a
                href="#sign-in"
                className="inline-flex items-center rounded-full border border-[#dddcd6] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#49515a] transition hover:border-[#d7bcc1] hover:text-[#9d1e2d]"
              >
                Sign In
              </a>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#7c858d]">
                Lee &amp; Associates Newport Beach
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#23272c]">
                Broker Workspace
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {user ? (
              <>
                <span className="inline-flex items-center rounded-full border border-[#dddcd6] bg-white px-4 py-2 text-sm font-medium text-[#49515a]">
                  Signed in as {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex items-center rounded-xl border border-[#d3d2cc] bg-white px-4 py-2 text-sm font-semibold text-[#2f343a] transition hover:border-[#9ea4ab]"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <a
                href="#sign-in"
                className="inline-flex items-center rounded-xl border border-[#d3d2cc] bg-white px-4 py-2 text-sm font-semibold text-[#2f343a] transition hover:border-[#9ea4ab]"
              >
                Broker Sign-In
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.75rem] border border-[#dddcd6] bg-[#f8f8f5] p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#7b858d]">
              Access and Workflow
            </p>
            <h2 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.04em] text-[#23272c]">
              One place to sign in, open the tool, and track broker submissions.
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#5e6670]">
              This workspace keeps broker identity inside the application, surfaces current comp
              reporting, and gives admins a cleaner operational handoff from intake to review.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {workspaceCards.map(card => (
                <a
                  key={card.title}
                  href={card.href}
                  className="rounded-[1.25rem] border border-[#e2e1dc] bg-white px-5 py-5 transition hover:border-[#d6c0c4]"
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#9d1e2d]">
                    {card.label}
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-[#20242a]">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#616972]">{card.body}</p>
                </a>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/broker_tool.html"
                className="inline-flex items-center justify-center rounded-xl bg-[#c32033] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a61b2b]"
              >
                Open Broker Tool
              </a>
              {user ? (
                <a
                  href="#my-submissions"
                  className="inline-flex items-center justify-center rounded-xl border border-[#d6d5cf] bg-white px-5 py-3 text-sm font-semibold text-[#2f343a] transition hover:border-[#bdbbb5]"
                >
                  View My Submissions
                </a>
              ) : null}
            </div>
          </div>

          <aside
            id="sign-in"
            className="rounded-[1.75rem] border border-[#dddcd6] bg-white p-7 shadow-[0_10px_24px_rgba(28,31,35,0.05)]"
          >
            {!user ? (
              <div className="flex h-full flex-col">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#7c858d]">
                  Broker Sign-In
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#23272c]">
                  Start a broker session
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#616972]">
                  Use your Lee email to open the tool and keep your submissions tied to your own
                  broker session.
                </p>

                <form className="mt-6 flex flex-col gap-4" onSubmit={handleLogin}>
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#6e7881]">
                      Your Name
                    </span>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="First Last"
                      required
                      className="h-12 w-full rounded-xl border border-[#d8d7d2] bg-white px-4 text-[15px] text-[#1f2328] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#6e7881]">
                      Lee Email
                    </span>
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@lee-associates.com"
                      type="email"
                      required
                      className="h-12 w-full rounded-xl border border-[#d8d7d2] bg-white px-4 text-[15px] text-[#1f2328] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={loginMutation.isPending || loading}
                    className="mt-2 inline-flex h-12 items-center justify-center rounded-xl bg-[#c32033] px-5 text-sm font-bold text-white transition hover:bg-[#a61b2b] disabled:cursor-not-allowed disabled:opacity-60"
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

                <div className="mt-6 rounded-[1.25rem] border border-[#e4e2db] bg-[#f7f7f3] px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#7d8790]">
                    Access Model
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#5d646d]">
                    Broker sessions stay inside this application. No Microsoft handoff is required
                    to access the tool.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#23272c] text-base font-bold text-white">
                    {getInitials(user.name)}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#7c858d]">
                      Signed In
                    </p>
                    <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#23272c]">
                      {user.name || "Lee Broker"}
                    </p>
                    <p className="text-sm text-[#616972]">{user.email}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3">
                  <a
                    href="/broker_tool.html"
                    className="inline-flex items-center justify-center rounded-xl bg-[#c32033] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a61b2b]"
                  >
                    Open Broker Tool
                  </a>
                  <a
                    href="#my-submissions"
                    className="inline-flex items-center justify-center rounded-xl border border-[#d3d2cc] bg-white px-5 py-3 text-sm font-semibold text-[#2e3339] transition hover:border-[#9ea4ab]"
                  >
                    Review My Submissions
                  </a>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.1rem] border border-[#e2e1dc] bg-[#f8f8f5] px-4 py-4">
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#7b8792]">
                      Session
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#20242a]">Broker authentication</p>
                  </div>
                  <div className="rounded-[1.1rem] border border-[#e2e1dc] bg-[#f8f8f5] px-4 py-4">
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#7b8792]">
                      Visibility
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#20242a]">Your submissions only</p>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </section>

        {user ? (
          <div className="mt-6 grid gap-6">
            <section
              id="my-submissions"
              className="overflow-hidden rounded-[1.5rem] border border-[#dcdcd6] bg-white"
            >
              <div className="border-b border-[#e2e1dc] bg-[#f7f7f3] px-6 py-5 sm:px-8">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#7c8792]">
                  Broker Activity
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#23272c]">
                  My Submissions
                </h2>
              </div>

              <div className="px-6 py-6 sm:px-8">
                {submissionsQuery.isLoading ? (
                  <div className="rounded-[1.25rem] border border-dashed border-[#d8d7d2] bg-[#f6f6f2] px-5 py-10 text-center text-sm text-[#6b737c]">
                    Loading your recent submissions...
                  </div>
                ) : recentSubmissions.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {recentSubmissions.map(submission => (
                      <article
                        key={submission.id}
                        className="rounded-[1.25rem] border border-[#e2e1dc] bg-[#fbfbf8] p-5"
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
                  <div className="rounded-[1.25rem] border border-dashed border-[#d8d7d2] bg-[#f6f6f2] px-5 py-10 text-center text-sm leading-7 text-[#6b737c]">
                    No submissions yet. Open the broker tool, save a form while signed in, and it
                    will appear here.
                  </div>
                )}
              </div>
            </section>

            <section
              id="comp-reports"
              className="overflow-hidden rounded-[1.5rem] border border-[#dcdcd6] bg-white"
            >
              <div className="border-b border-[#e2e1dc] bg-[#f7f7f3] px-6 py-5 sm:px-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#7c8792]">
                      Comp Reporting
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#23272c]">
                      Comp Reports
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#626a72]">
                      Search the active workbook and preview report-ready records against the Lee
                      Irvine / Metropolis structure.
                    </p>
                  </div>

                  {latestCompImport ? (
                    <div className="rounded-[1.1rem] border border-[#e4d4d7] bg-[#fff6f7] px-4 py-3 text-sm text-[#5d454a]">
                      <div className="font-semibold text-[#8e1f2d]">{latestCompImport.workbookName}</div>
                      <div className="mt-1 text-xs">
                        Active import · {latestCompImport.leaseCount.toLocaleString("en-US")} lease /{" "}
                        {latestCompImport.saleCount.toLocaleString("en-US")} sale ·{" "}
                        {formatCompactDate(latestCompImport.createdAt)}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="px-6 py-6 sm:px-8">
                <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
                  <div className="space-y-6">
                    <div className="rounded-[1.25rem] border border-[#e2e1dc] bg-[#fbfbf8] p-5">
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
                          <div className="rounded-[1rem] border border-[#ecebe6] bg-white px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a9198]">
                              Source workbook
                            </p>
                            <p className="mt-1 font-semibold text-[#20242a]">
                              {latestCompImport.sourceFilename || latestCompImport.workbookName}
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-[1rem] border border-[#ecebe6] bg-white px-4 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a9198]">
                                Lease comps
                              </p>
                              <p className="mt-1 text-lg font-semibold text-[#20242a]">
                                {latestCompImport.leaseCount.toLocaleString("en-US")}
                              </p>
                            </div>
                            <div className="rounded-[1rem] border border-[#ecebe6] bg-white px-4 py-3">
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
                        <div className="mt-4 rounded-[1rem] border border-dashed border-[#d8d7d2] bg-white px-4 py-6 text-sm leading-6 text-[#6a7179]">
                          No active comp workbook yet. Once an admin imports the workbook, brokers
                          can search and preview report-ready comps here.
                        </div>
                      )}
                    </div>

                    <div className="rounded-[1.25rem] border border-[#e2e1dc] bg-[#fbfbf8] p-5">
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
                              className="h-11 w-full rounded-xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
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
                              className="h-11 w-full rounded-xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                            />
                          </label>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            value={compCity}
                            onChange={e => setCompCity(e.target.value)}
                            placeholder="City"
                            className="h-11 w-full rounded-xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                          />
                          <input
                            value={compMarket}
                            onChange={e => setCompMarket(e.target.value)}
                            placeholder="Market"
                            className="h-11 w-full rounded-xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            value={compSubMarket}
                            onChange={e => setCompSubMarket(e.target.value)}
                            placeholder="Submarket"
                            className="h-11 w-full rounded-xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                          />
                          <input
                            value={compPropertyType}
                            onChange={e => setCompPropertyType(e.target.value)}
                            placeholder="Property type"
                            className="h-11 w-full rounded-xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            value={compDateFrom}
                            onChange={e => setCompDateFrom(e.target.value)}
                            type="date"
                            className="h-11 w-full rounded-xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                          />
                          <input
                            value={compDateTo}
                            onChange={e => setCompDateTo(e.target.value)}
                            type="date"
                            className="h-11 w-full rounded-xl border border-[#d8d7d2] bg-white px-4 text-sm text-[#20242a] outline-none transition focus:border-[#c32033] focus:ring-4 focus:ring-[#c32033]/10"
                          />
                        </div>
                      </div>
                    </div>

                    {user.role === "admin" ? (
                      <div className="rounded-[1.25rem] border border-[#e2e1dc] bg-[#fbfbf8] p-5">
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

                        <label className="mt-4 flex cursor-pointer flex-col rounded-[1rem] border border-dashed border-[#d4d2cc] bg-white px-4 py-5 text-sm text-[#5e6670] transition hover:border-[#c32033]">
                          <span className="font-semibold text-[#20242a]">Upload Excel workbook</span>
                          <span className="mt-1 text-xs leading-5">
                            Store the workbook in tool storage, import both canonical sheets, and
                            promote it to the active dataset.
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
                          <div className="mt-4 rounded-[1rem] border border-[#ecd8db] bg-[#fff6f7] px-4 py-3 text-sm text-[#8d2531]">
                            Importing workbook. This can take a minute because the full comp
                            dataset is being stored and indexed.
                          </div>
                        ) : null}

                        {importWorkbookMutation.isSuccess ? (
                          <div className="mt-4 rounded-[1rem] border border-[#d8e8dc] bg-[#f4fbf5] px-4 py-3 text-sm text-[#245b31]">
                            Workbook import completed successfully.
                          </div>
                        ) : null}

                        {uploadFileMutation.error || importWorkbookMutation.error ? (
                          <div className="mt-4 rounded-[1rem] border border-[#ecd8db] bg-[#fff6f7] px-4 py-3 text-sm text-[#8d2531]">
                            {uploadFileMutation.error?.message || importWorkbookMutation.error?.message}
                          </div>
                        ) : null}

                        {compImportsQuery.data?.length ? (
                          <div className="mt-4 space-y-2">
                            {compImportsQuery.data.map(item => (
                              <div
                                key={item.id}
                                className="rounded-[1rem] border border-[#ecebe6] bg-white px-4 py-3 text-sm text-[#55606a]"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-[#20242a]">{item.workbookName}</span>
                                  <span className="text-[11px] uppercase tracking-[0.18em] text-[#8b9198]">
                                    {item.status}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs">
                                  {item.leaseCount.toLocaleString("en-US")} lease /{" "}
                                  {item.saleCount.toLocaleString("en-US")} sale ·{" "}
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
                      <div className="rounded-[1.25rem] border border-dashed border-[#d8d7d2] bg-[#f6f6f2] px-5 py-12 text-center text-sm text-[#6b737c]">
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
                      <div className="rounded-[1.25rem] border border-dashed border-[#d8d7d2] bg-[#f6f6f2] px-5 py-12 text-center text-sm leading-7 text-[#6b737c]">
                        {latestCompImport
                          ? "No comps matched the current filters. Try widening the city, market, or date range."
                          : "Search results will appear here after the workbook is imported."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-6 rounded-[1.5rem] border border-[#dddcd6] bg-[#f8f8f5] px-6 py-6 text-sm leading-7 text-[#616972]">
            Sign in above to access broker-specific submissions, comp reporting, and the full tool.
          </div>
        )}
      </main>
    </div>
  );
}
