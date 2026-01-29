import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ShieldCheck, Building2, CheckCircle2 } from "lucide-react";
import docspeareIcon from "@/assets/docspeare-icon.png";

const AdminConfig = () => {
  return (
    <>
      <Helmet>
        <title>Admin Configuration | Docspeare</title>
        <meta
          name="description"
          content="Administrator steps for enabling the Docspeare Google Docs add-on."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link to="/auth" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden">
                  <img src={docspeareIcon} alt="Docspeare" className="w-full h-full object-cover" />
                </div>
                <span className="text-xl font-semibold text-foreground">Docspeare</span>
              </Link>
              <Link
                to="/auth"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-16 max-w-4xl">
          <h1 className="text-4xl font-bold text-foreground mb-4">Admin configuration</h1>
          <p className="text-muted-foreground mb-10">
            If your organization restricts Marketplace apps, an admin may need to approve or install the add‑on.
          </p>

          <div className="space-y-6">
            <section className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Marketplace access</h2>
              </div>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Open the Google Admin console and navigate to Marketplace apps.</li>
                <li>Allowlist or install the Docspeare add‑on for your organization.</li>
                <li>Confirm that users are permitted to install Marketplace add‑ons.</li>
              </ul>
            </section>

            <section className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Permissions</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Docspeare requests Google Docs access to read content and a secure external request scope
                to call Docspeare APIs. These scopes are required for publishing and preview.
              </p>
            </section>

            <section className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Verify setup</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                After approval, users should open the add‑on, paste their Docspeare token, and refresh projects.
                If they see “Not connected,” ask them to regenerate a token and try again.
              </p>
            </section>
          </div>
        </main>
      </div>
    </>
  );
};

export default AdminConfig;
