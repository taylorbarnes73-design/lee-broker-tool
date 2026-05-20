import { CheckCircle2, Clock, AlertCircle, FileText, MessageSquare, ThumbsUp } from "lucide-react";

export function RequestHubWorkflow() {
  const steps = [
    {
      id: 1,
      title: "Request Submitted",
      description: "Your request has been received and is awaiting review",
      status: "completed",
      icon: FileText,
      timestamp: "May 20, 2026 at 9:30 AM",
      details: "Request #12345 has been successfully submitted to the admin team.",
    },
    {
      id: 2,
      title: "Under Review",
      description: "Admin team is currently reviewing your request",
      status: "current",
      icon: Clock,
      timestamp: "May 20, 2026 at 10:15 AM",
      details: "Your request is being evaluated by the admin team.",
    },
    {
      id: 3,
      title: "Additional Information",
      description: "Waiting for clarification or additional documents",
      status: "pending",
      icon: MessageSquare,
      timestamp: "Pending",
      details: "Admin may request additional information if needed.",
    },
    {
      id: 4,
      title: "Processing",
      description: "Request is being processed by the relevant department",
      status: "pending",
      icon: AlertCircle,
      timestamp: "Pending",
      details: "Once approved, your request will be processed accordingly.",
    },
    {
      id: 5,
      title: "Completed",
      description: "Request has been fulfilled and closed",
      status: "pending",
      icon: ThumbsUp,
      timestamp: "Pending",
      details: "You will be notified once your request is completed.",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="mb-2">Request Workflow</h1>
        <p className="text-muted-foreground">
          Track your request as it moves through each stage of the process
        </p>
      </div>

      {/* Timeline View */}
      <div className="mb-12">
        <div className="relative">
          {/* Connecting Line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            {steps.map((step) => {
              const Icon = step.icon;
              const isCompleted = step.status === "completed";
              const isCurrent = step.status === "current";

              return (
                <div key={step.id} className="relative flex gap-6">
                  {/* Step Icon */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                        isCompleted
                          ? "bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/30"
                          : isCurrent
                          ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30 ring-4 ring-blue-500/20"
                          : "bg-muted"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-8 w-8 text-white" />
                      ) : (
                        <Icon
                          className={`h-8 w-8 ${
                            isCurrent ? "text-white" : "text-muted-foreground"
                          }`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Step Content Card */}
                  <div className="flex-1">
                    <div
                      className={`bg-card border rounded-2xl p-6 transition-all ${
                        isCurrent
                          ? "border-blue-500 shadow-xl shadow-blue-500/10"
                          : "border-border hover:shadow-lg hover:shadow-primary/5"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="mb-1">{step.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {step.description}
                          </p>
                        </div>
                        {isCurrent && (
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                            In Progress
                          </span>
                        )}
                        {isCompleted && (
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                            Completed
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">
                        {step.details}
                      </p>

                      <div className="text-xs text-muted-foreground">
                        {step.timestamp}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Card Grid View */}
      <div className="mb-8">
        <h2 className="mb-6">Process Overview</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {steps.map((step) => {
            const Icon = step.icon;
            const isCompleted = step.status === "completed";
            const isCurrent = step.status === "current";

            return (
              <div
                key={step.id}
                className={`bg-card border rounded-2xl p-6 transition-all hover:-translate-y-1 ${
                  isCurrent
                    ? "border-blue-500 shadow-xl shadow-blue-500/10"
                    : "border-border hover:shadow-xl hover:shadow-primary/5"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isCompleted
                        ? "bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/20"
                        : isCurrent
                        ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20"
                        : "bg-muted"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-6 w-6 text-white" />
                    ) : (
                      <Icon
                        className={`h-6 w-6 ${
                          isCurrent ? "text-white" : "text-muted-foreground"
                        }`}
                      />
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-muted-foreground/30">
                      {step.id}
                    </div>
                  </div>
                </div>

                <h4 className="mb-2">{step.title}</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {step.description}
                </p>

                {isCurrent && (
                  <div className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    In Progress
                  </div>
                )}
                {isCompleted && (
                  <div className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold inline-flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3" />
                    Completed
                  </div>
                )}
                {!isCurrent && !isCompleted && (
                  <div className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-semibold">
                    Pending
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
