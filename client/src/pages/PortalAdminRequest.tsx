import { useState } from "react";
import {
  Calendar,
  CreditCard,
  FileText,
  Package,
  Settings,
  Users,
} from "lucide-react";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import { AdminRequestForm } from "@/components/AdminRequestForm";

const requestTypes = [
  {
    id: "hr",
    title: "HR Request",
    description: "Employee records, benefits, time off",
    icon: Users,
    color: "text-blue-600",
  },
  {
    id: "finance",
    title: "Finance Request",
    description: "Expenses, reimbursements, invoices",
    icon: CreditCard,
    color: "text-green-600",
  },
  {
    id: "it",
    title: "IT Support",
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
  {
    id: "general",
    title: "General Request",
    description: "Other administrative needs",
    icon: FileText,
    color: "text-gray-600",
  },
] as const;

export default function PortalAdminRequest() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const activeType = selectedType
    ? requestTypes.find(t => t.id === selectedType)
    : undefined;

  return (
    <AdminPortalShell
      section="new-submission"
      eyebrow="Broker Portal"
      title={activeType ? activeType.title : "Admin request"}
      description={
        activeType
          ? "Submit opens a mail draft to the broker admin inbox — attach documents before sending."
          : "Send a general request to the broker admin inbox. Choose a category, then submit to open a mail draft."
      }
      actions={
        activeType ? (
          <LinkButton href="/portal/new" variant="secondary">
            Back to forms
          </LinkButton>
        ) : (
          <LinkButton href="/portal/new" variant="secondary">
            Back to home
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
                        type.id === "hr"
                          ? "from-blue-500 to-blue-600 shadow-blue-500/20"
                          : type.id === "finance"
                            ? "from-green-500 to-green-600 shadow-green-500/20"
                            : type.id === "it"
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
