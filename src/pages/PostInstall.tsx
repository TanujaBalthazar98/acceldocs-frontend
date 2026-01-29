import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import docspeareIcon from "@/assets/docspeare-icon.png";

const PostInstall = () => {
  return (
    <>
      <Helmet>
        <title>Post-install Tips | Docspeare</title>
        <meta
          name="description"
          content="Quick tips after installing the Docspeare Google Docs add-on."
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
          <h1 className="text-4xl font-bold text-foreground mb-4">Post‑install tips</h1>
          <p className="text-muted-foreground mb-10">
            A few quick steps to get the most out of the Docspeare add‑on.
          </p>

          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Pick a project and version</h2>
              </div>
              <p className="text-muted-foreground">
                In the add‑on, select the project and version you want to publish to, then save settings.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Preview before publishing</h2>
              </div>
              <p className="text-muted-foreground">
                Use <strong>Preview</strong> to verify layout and links, then publish when ready.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Keep the slug clean</h2>
              </div>
              <p className="text-muted-foreground">
                You can set a custom slug in the add‑on (Advanced section). Leave it blank to auto‑generate.
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default PostInstall;
