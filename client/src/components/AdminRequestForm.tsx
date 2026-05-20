import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

interface RequestType {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
}

interface AdminRequestFormProps {
  requestType: RequestType;
  onBack: () => void;
}

export function AdminRequestForm({ requestType, onBack }: AdminRequestFormProps) {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    priority: "medium",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newRequest = {
      id: Date.now().toString(),
      type: requestType.title,
      subject: formData.subject,
      description: formData.description,
      priority: formData.priority,
      status: "pending",
      date: new Date().toISOString(),
    };

    const existingRequests = JSON.parse(
      localStorage.getItem("requests") || "[]"
    );
    localStorage.setItem(
      "requests",
      JSON.stringify([newRequest, ...existingRequests])
    );

    toast.success("Request submitted successfully!");
    setLocation("/portal/request-hub/my-requests");
  };

  const Icon = requestType.icon;

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="font-medium">Back to request types</span>
      </button>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
              <div
                className={`h-14 w-14 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg ${
                  requestType.id === "hr"
                    ? "from-blue-500 to-blue-600 shadow-blue-500/20"
                    : requestType.id === "finance"
                    ? "from-green-500 to-green-600 shadow-green-500/20"
                    : requestType.id === "it"
                    ? "from-purple-500 to-purple-600 shadow-purple-500/20"
                    : requestType.id === "facilities"
                    ? "from-orange-500 to-orange-600 shadow-orange-500/20"
                    : requestType.id === "scheduling"
                    ? "from-pink-500 to-pink-600 shadow-pink-500/20"
                    : "from-gray-500 to-gray-600 shadow-gray-500/20"
                }`}
              >
                <Icon className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="mb-1">{requestType.title}</h2>
                <p className="text-sm text-muted-foreground">{requestType.description}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="subject" className="block mb-2 font-medium">
                  Subject <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  id="subject"
                  required
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  placeholder="Brief description of your request"
                />
              </div>

              <div>
                <label htmlFor="description" className="block mb-2 font-medium">
                  Description <span className="text-primary">*</span>
                </label>
                <textarea
                  id="description"
                  required
                  rows={6}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none transition-all"
                  placeholder="Provide detailed information about your request"
                />
              </div>

              <div>
                <label htmlFor="priority" className="block mb-2 font-medium">
                  Priority <span className="text-primary">*</span>
                </label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onBack}
                  className="px-6 py-3 bg-secondary text-secondary-foreground border border-border rounded-xl font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  <Send className="h-4 w-4" />
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-card to-muted/20 border border-border rounded-2xl p-6 sticky top-8 shadow-sm">
            <h3 className="mb-6 pb-4 border-b border-border">Request Summary</h3>
            <div className="space-y-5">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Type</div>
                <div className="font-semibold">{requestType.title}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Priority</div>
                <div className="font-semibold capitalize">{formData.priority}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Status</div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                  Draft
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
