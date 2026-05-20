import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Plus, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface Request {
  id: string;
  type: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  date: string;
}

const statusConfig = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "text-yellow-600",
    bg: "bg-yellow-50",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  in_progress: {
    label: "In Progress",
    icon: AlertCircle,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
};

const priorityColors = {
  low: "text-gray-600",
  medium: "text-blue-600",
  high: "text-orange-600",
  urgent: "text-red-600",
};

export function RequestHubMyRequests() {
  const [requests, setRequests] = useState<Request[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("requests");
    if (stored) {
      setRequests(JSON.parse(stored));
    }
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="mb-2">My Requests</h1>
          <p className="text-muted-foreground">
            View and track all your submitted requests
          </p>
        </div>
        <Link
          href="/portal/request-hub/submit"
          className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
        >
          <Plus className="h-4 w-4" />
          New Request
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="bg-gradient-to-br from-card to-muted/20 border border-border rounded-2xl p-16 text-center shadow-sm">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 mx-auto mb-6 flex items-center justify-center">
            <Clock className="h-10 w-10 text-primary" />
          </div>
          <h2 className="mb-3">No requests yet</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            You haven't submitted any requests. Get started by creating your
            first request.
          </p>
          <Link
            href="/portal/request-hub/submit"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            Submit First Request
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const status =
              statusConfig[request.status as keyof typeof statusConfig] ||
              statusConfig.pending;
            const StatusIcon = status.icon;
            const priorityColor =
              priorityColors[request.priority as keyof typeof priorityColors];

            return (
              <div
                key={request.id}
                className="bg-card border border-border rounded-2xl p-6 hover:shadow-xl hover:shadow-primary/5 transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3>{request.subject}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}
                      >
                        <StatusIcon className="h-3 w-3 inline mr-1" />
                        {status.label}
                      </span>
                    </div>
                    <p className="text-muted-foreground mb-4">
                      {request.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-8 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium">{request.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Priority:</span>
                    <span className={`font-medium ${priorityColor}`}>
                      {request.priority.charAt(0).toUpperCase() +
                        request.priority.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Submitted:</span>
                    <span className="font-medium">{formatDate(request.date)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
