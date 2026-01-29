import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, KeyRound, ClipboardCheck, Zap } from "lucide-react";
import docspeareIcon from "@/assets/docspeare-icon.png";

const AddonSetup = () => {
  return (
    <>
      <Helmet>
        <title>Docs Add-on Setup | Docspeare</title>
        <meta
          name="description"
          content="Set up the Docspeare Google Docs add-on and publish from Google Docs."
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
          <h1 className="text-4xl font-bold text-foreground mb-4">Google Docs add-on setup</h1>
          <p className="text-muted-foreground mb-10">
            Connect the Docs add-on to your Docspeare workspace so you can publish directly from Google Docs.
          </p>

          <div className="grid gap-6">
            <section className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <KeyRound className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">1) Generate an add-on token</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                In Docspeare, go to <strong>Integrations → Docs Add-on</strong> and generate a short‑lived
                token. This token is used only by the add-on to load your projects and publish.
              </p>
            </section>

            <section className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">2) Paste the token in Google Docs</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Open a Google Doc, launch the Docspeare add‑on, paste your token, and click <strong>Refresh</strong>.
                Select a project, version, and optional topic, then save settings.
              </p>
            </section>

            <section className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">3) Publish, preview, or unpublish</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Use the add‑on actions to publish, preview, or unpublish the current document.
                The add‑on keeps a link to the latest result so you can open it quickly.
              </p>
            </section>
          </div>
        </main>
      </div>
    </>
  );
};

export default AddonSetup;
