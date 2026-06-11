import { useState } from "react";
import { Calendar, FileText, Package, Settings } from "lucide-react";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import { AdminRequestForm } from "@/components/AdminRequestForm";

const requestTypes = [
  {
    id: "general",
    title: "General Request",
    description: "Anything you need from the admin team",
    icon: FileText,
    color: "text-gray-600",
  },
  {
    id: "it",
    title: "IT / System Issue",
    description: "Technical issues, software access",
    icon: Settings,
    color: "text-purple-600",
  },
  {
    id: "facilities",
    title: "Facilities",
    description: "Office maintenance, equipment",
    icon: Package,
    color: "text-orange-600",
  },
  {
    id: "scheduling",
    title: "Scheduling",
    description: "Meeting rooms, events",
    icon: Calendar,
    color: "text-pink-600",
  },
] as const;

export default function PortalAdminRequest() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const activeType = selectedType
    ? requestTypes.find(t => t.id === selectedType)
    : undefined;

  return (
    <AdminPortalShell
      section="forms"
      eyebrow="Broker Portal"
      title={activeType ? activeType.title : "Message the admin team"}
      description={
        activeType
          ? "Fill in the details and click Send — your request goes directly to the admin team and shows up under My Submissions."
          : "Send a message directly to the admin team and get a response by email, usually within 1–2 business days. Takes about a minute."
      }
      actions={
        activeType ? (
          <LinkButton href="/portal/workspace" variant="secondary">
            Back to workspace
          </LinkButton>
        ) : (
          <LinkButton href="/portal/workspace" variant="secondary">
            Back to workspace
          </LinkButton>
        )
      }
    >
      {activeType ? (
        <AdminRequestForm
          requestType={activeType}
          onBack={() => setSelectedType(null)}
        />
      ) : (
        <div className="admin-portal-card">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {requestTypes.map(type => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type.id)}
                  className="bg-card border border-border rounded-xl p-6 text-left hover:border-primary hover:shadow-xl hover:shadow-primary/5 transition-all hover:-translate-y-1 group"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-lg transition-transform group-hover:scale-110 ${
                        type.id === "it"
                          ? "from-purple-500 to-purple-600 shadow-purple-500/20"
                          : type.id === "facilities"
                            ? "from-orange-500 to-orange-600 shadow-orange-500/20"
                            : type.id === "scheduling"
                              ? "from-pink-500 to-pink-600 shadow-pink-500/20"
                              : "from-gray-500 to-gray-600 shadow-gray-500/20"
                      }`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="mb-1 group-hover:text-primary transition-colors">{type.title}</h3>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </AdminPortalShell>
  );
}
