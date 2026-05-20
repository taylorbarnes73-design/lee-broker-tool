import { useState } from "react";
import {
  Users,
  CreditCard,
  Settings,
  FileText,
  Calendar,
  Package,
} from "lucide-react";
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
];

export function RequestHubSubmit() {
  const [selectedType, setSelectedType] = useState<string | null>(null);

  if (selectedType) {
    const type = requestTypes.find((t) => t.id === selectedType);
    return (
      <AdminRequestForm
        requestType={type!}
        onBack={() => setSelectedType(null)}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="mb-3">Submit a Request</h1>
        <p className="text-muted-foreground">
          Select the type of request you would like to submit
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {requestTypes.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
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
  );
}
