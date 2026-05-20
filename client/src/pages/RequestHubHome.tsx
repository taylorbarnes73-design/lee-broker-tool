import { Link } from "wouter";
import { ArrowRight, Sparkles, Clock, Shield } from "lucide-react";

export function RequestHubHome() {
  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      {/* Hero Section */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-6">
          <Sparkles className="h-4 w-4" />
          Welcome to Request Hub
        </div>
        <h1 className="mb-4">Streamline Your Administrative Requests</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-8">
          Submit, track, and manage all your administrative needs in one place.
          Fast, secure, and efficient.
        </p>
        <Link
          href="/portal/request-hub/submit"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 font-medium"
        >
          Submit New Request
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-xl hover:shadow-primary/5 transition-all hover:-translate-y-1">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h3 className="mb-2">Quick Submission</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Submit administrative requests quickly with our intuitive interface
            and pre-built templates.
          </p>
          <Link
            href="/portal/request-hub/submit"
            className="inline-flex items-center gap-2 text-primary text-sm font-medium hover:gap-3 transition-all"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-xl hover:shadow-primary/5 transition-all hover:-translate-y-1">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/20">
            <Clock className="h-7 w-7 text-white" />
          </div>
          <h3 className="mb-2">Real-Time Tracking</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Monitor request status in real-time with instant notifications and
            updates.
          </p>
          <Link
            href="/portal/request-hub/my-requests"
            className="inline-flex items-center gap-2 text-primary text-sm font-medium hover:gap-3 transition-all"
          >
            View Requests
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-xl hover:shadow-primary/5 transition-all hover:-translate-y-1">
          <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-500/20">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h3 className="mb-2">Secure & Reliable</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Enterprise-grade security ensures your requests are handled with
            complete confidentiality.
          </p>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gradient-to-br from-card to-muted/20 border border-border rounded-2xl p-8">
        <h2 className="mb-8">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="relative">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-semibold shadow-lg shadow-primary/30">
                1
              </div>
              <div>
                <h4 className="mb-2">Choose Type</h4>
                <p className="text-sm text-muted-foreground">
                  Select from HR, Finance, IT, Facilities, or other request
                  categories.
                </p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-semibold shadow-lg shadow-primary/30">
                2
              </div>
              <div>
                <h4 className="mb-2">Fill Details</h4>
                <p className="text-sm text-muted-foreground">
                  Provide comprehensive information and set priority levels for
                  your request.
                </p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-semibold shadow-lg shadow-primary/30">
                3
              </div>
              <div>
                <h4 className="mb-2">Track Progress</h4>
                <p className="text-sm text-muted-foreground">
                  Monitor status updates and communicate with the admin team
                  seamlessly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
