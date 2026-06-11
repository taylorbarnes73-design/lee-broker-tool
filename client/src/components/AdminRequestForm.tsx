import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePublicBranding } from "@/hooks/usePublicBranding";
import { trpc } from "@/lib/trpc";
import {
  formatBrokerAdminInboxHint,
  getBrokerAdminRecipientEmail,
} from "@/lib/recipientEmail";

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
  const { user } = useAuth();
  const branding = usePublicBranding();
  const brokerAdminEmail = getBrokerAdminRecipientEmail(branding.support_email);
  const inboxHint = formatBrokerAdminInboxHint(branding.support_email);
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    priority: "medium",
  });

  const sendToAdmin = trpc.email.sendToAdmin.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sendToAdmin.isPending) return;

    try {
      const result = await sendToAdmin.mutateAsync({
        formType: "admin-request",
        brokerName: user?.name ?? "",
        propertyAddress: formData.subject,
        senderEmail: user?.email || undefined,
        sections: [
          {
            title: "Request",
            fields: [
              { label: "Request Type", value: requestType.title },
              { label: "Priority", value: formData.priority },
              { label: "Subject", value: formData.subject },
              { label: "Description", value: formData.description },
            ],
          },
        ],
        formData: {
          requestTypeId: requestType.id,
          priority: formData.priority,
        },
      });

      if (!result.success) {
        throw new Error(result.error || "Request could not be sent.");
      }

      toast.success("Request sent to the admin team — you'll hear back by email.");
      setLocation("/portal/submissions");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Request could not be sent.";
      toast.error(`${message} You can also email ${brokerAdminEmail} directly.`);
    }
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
                  requestType.id === "it"
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
                  disabled={sendToAdmin.isPending}
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
                  disabled={sendToAdmin.isPending}
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
                  disabled={sendToAdmin.isPending}
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

              <div
                className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
                role="note"
              >
                <p className="font-semibold text-foreground">{inboxHint}</p>
                <p className="mt-1">
                  Send delivers your request directly to the admin team — no email app needed. If you
                  have documents to share, mention them and the admin will follow up by email.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onBack}
                  disabled={sendToAdmin.isPending}
                  className="px-6 py-3 bg-secondary text-secondary-foreground border border-border rounded-xl font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendToAdmin.isPending}
                  className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {sendToAdmin.isPending ? "Sending..." : "Send to Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-card to-muted/20 border border-border rounded-2xl p-6 sticky top-8 shadow-sm">
            <h3 className="mb-6 pb-4 border-b border-border">What happens next</h3>
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
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">After you send</div>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4">
                  <li>The admin team gets your request by email immediately.</li>
                  <li>It appears under My Submissions so you can track it.</li>
                  <li>Expect a response within 1–2 business days.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
