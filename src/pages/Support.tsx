import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, LifeBuoy, Mail, FileText } from "lucide-react";
import docspeareIcon from "@/assets/docspeare-icon.png";

const Support = () => {
  return (
    <>
      <Helmet>
        <title>Support | Docspeare</title>
        <meta
          name="description"
          content="Get help with Docspeare, the Google Docs publishing workspace."
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
          <h1 className="text-4xl font-bold text-foreground mb-4">Support</h1>
          <p className="text-muted-foreground mb-10">
            Need help getting set up or publishing from Google Docs? Use the options below.
          </p>

          <div className="grid gap-6">
            <section className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Help center</h2>
              </div>
              <p className="text-muted-foreground">
                Start with the Help Center for onboarding, publishing, and permissions.
              </p>
              <div className="mt-4">
                <Link to="/help" className="text-primary hover:underline">
                  Open Help Center →
                </Link>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <LifeBuoy className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Report an issue</h2>
              </div>
              <p className="text-muted-foreground">
                If something isn’t working, submit a report with steps and screenshots.
              </p>
              <div className="mt-4">
                <Link to="/support/report-issue" className="text-primary hover:underline">
                  Report an issue →
                </Link>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Email support</h2>
              </div>
              <p className="text-muted-foreground">
                Prefer email? Reach us at{" "}
                <a href="mailto:hello@docspeare.io" className="text-primary hover:underline">
                  hello@docspeare.io
                </a>.
              </p>
            </section>
          </div>
        </main>
      </div>
    </>
  );
};

export default Support;
