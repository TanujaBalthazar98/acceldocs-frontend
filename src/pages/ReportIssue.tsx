import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Bug, FileText, Mail, Send } from "lucide-react";
import docspeareIcon from "@/assets/docspeare-icon.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const ReportIssue = () => {
  const [email, setEmail] = useState("");
  const [workspaceUrl, setWorkspaceUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const buildMailTo = () => {
    const subject = encodeURIComponent(`Docspeare issue: ${summary || "New issue report"}`);
    const body = encodeURIComponent(
      [
        `Reporter: ${email || "Anonymous"}`,
        `Workspace URL: ${workspaceUrl || "N/A"}`,
        "",
        "Summary:",
        summary || "N/A",
        "",
        "Steps to reproduce:",
        steps || "N/A",
        "",
        "Expected result:",
        expected || "N/A",
        "",
        "Actual result:",
        actual || "N/A",
      ].join("\n")
    );

    return `mailto:hello@docspeare.io?subject=${subject}&body=${body}`;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    window.location.href = buildMailTo();
    setSubmitted(true);
  };

  return (
    <>
      <Helmet>
        <title>Report an Issue | Docspeare</title>
        <meta
          name="description"
          content="Report a problem with Docspeare and get help from support."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50">
          <div className="container mx-auto px-4 md:px-6 py-4">
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

        <main className="container mx-auto px-4 md:px-6 py-8 md:py-16 max-w-4xl">
          <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-4">Report an issue</h1>
          <p className="text-muted-foreground mb-10">
            The fastest way to resolve issues is to include steps, expected results, and screenshots.
          </p>

          <div className="grid gap-6">
            <section className="rounded-lg border border-border bg-card p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <Bug className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">What to include</h2>
              </div>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Steps to reproduce the issue</li>
                <li>What you expected to happen</li>
                <li>What actually happened</li>
                <li>Screenshots or screen recordings</li>
                <li>Your Workspace URL and project name (if applicable)</li>
              </ul>
            </section>

            <section className="rounded-lg border border-border bg-card p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <Send className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Submit a report</h2>
              </div>
              <p className="text-muted-foreground mb-6">
                Use the form below to prefill an email to our support team.
              </p>
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Your email</label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Workspace URL</label>
                  <Input
                    type="text"
                    placeholder="https://docs.example.com"
                    value={workspaceUrl}
                    onChange={(e) => setWorkspaceUrl(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Summary</label>
                  <Input
                    type="text"
                    placeholder="Short description of the issue"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Steps to reproduce</label>
                  <Textarea
                    placeholder="1. Go to… 2. Click…"
                    value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Expected result</label>
                  <Textarea
                    placeholder="What you expected to happen"
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Actual result</label>
                  <Textarea
                    placeholder="What actually happened"
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit">
                    Send report
                  </Button>
                  {submitted && (
                    <span className="text-sm text-muted-foreground">
                      Email draft opened in your mail client.
                    </span>
                  )}
                </div>
              </form>
            </section>

            <section className="rounded-lg border border-border bg-card p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Use email for now</h2>
              </div>
              <p className="text-muted-foreground">
                Email our support team at{" "}
                <a href="mailto:hello@docspeare.io" className="text-primary hover:underline">
                  hello@docspeare.io
                </a>{" "}
                and include the details above.
              </p>
              <p className="text-muted-foreground mt-3">
                We’ll respond with next steps or request more information if needed.
              </p>
            </section>

            <section className="rounded-lg border border-border bg-card p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Alternative</h2>
              </div>
              <p className="text-muted-foreground">
                If you can’t use email, send a message from your Docspeare account via your admin or workspace
                owner.
              </p>
            </section>
          </div>
        </main>
      </div>
    </>
  );
};

export default ReportIssue;
