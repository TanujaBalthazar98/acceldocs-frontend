import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuthNew";
import { Button } from "@/components/ui/button";
import docspeareIcon from "@/assets/docspeare-icon.png";
import { BRAND, resolveBrandUrl } from "@/lib/brand";
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Folder,
  GitBranch,
  Globe,
  LayoutGrid,
  Lock,
  Menu,
  RefreshCw,
  Search,
  Sparkles,
  Workflow,
  X,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Landing page for Docspeare                                        */
/*  Marketing-grade, fully responsive, self-contained.                */
/*  Keeps existing routing: /signup, /login                           */
/* ------------------------------------------------------------------ */

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <TopNav
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        navigate={navigate}
      />

      <main>
        <Hero navigate={navigate} />
        <Problem />
        <Features />
        <HowItWorks />
        <Comparison />
        <Faq />
        <FinalCta navigate={navigate} />
      </main>

      <SiteFooter />
    </div>
  );
};

export default Index;

/* ============================================================== */
/*  NAVBAR                                                         */
/* ============================================================== */

type NavProps = {
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
};

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#compare", label: "Why Docspeare" },
  { href: "#faq", label: "FAQ" },
];

const TopNav = ({ mobileOpen, setMobileOpen, navigate }: NavProps) => {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a
          href="#top"
          className="flex items-center gap-2.5"
          aria-label="Docspeare home"
        >
          <div className="h-8 w-8 overflow-hidden rounded-lg ring-1 ring-border/60">
            <img
              src={docspeareIcon}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            docspeare
          </span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/login")}
          >
            Log in
          </Button>
          <Button
            variant="hero"
            size="sm"
            onClick={() => navigate("/signup")}
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border/60 bg-background lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-4">
              <Button
                variant="ghost"
                className="w-full justify-center"
                onClick={() => navigate("/login")}
              >
                Log in
              </Button>
              <Button
                variant="hero"
                className="w-full justify-center"
                onClick={() => navigate("/signup")}
              >
                Get started free
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

/* ============================================================== */
/*  HERO                                                           */
/* ============================================================== */

const Hero = ({
  navigate,
}: {
  navigate: ReturnType<typeof useNavigate>;
}) => (
  <section id="top" className="relative overflow-hidden">
    {/* Ambient background */}
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-[140px]" />
      <div className="absolute -left-40 top-40 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute -right-40 top-80 h-[360px] w-[360px] rounded-full bg-primary/10 blur-[120px]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse at 50% 0%, black 30%, transparent 70%)",
        }}
      />
    </div>

    <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-20 lg:px-8 lg:pb-28 lg:pt-28">
      <div className="mx-auto max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          The docs platform for teams who live in Google Drive
        </div>

        <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Ship documentation as fast as you{" "}
          <span className="text-gradient">ship product.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
          Docspeare turns your Google Drive into a polished knowledge base —
          with structured reviews, role‑based publishing, and an AI helper
          you can ask about any page. No migrations. No duplicate sources of
          truth. Just docs your team can keep up with.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            variant="hero"
            size="xl"
            className="w-full sm:w-auto"
            onClick={() => navigate("/signup")}
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="glass"
            size="xl"
            className="w-full sm:w-auto"
            onClick={() =>
              document
                .getElementById("how-it-works")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            See how it works
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-muted-foreground sm:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Free to sign up
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Folder className="h-4 w-4 text-primary" />
            Stays in your Google Drive
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-primary" />
            Connect in minutes
          </span>
        </div>
      </div>

      {/* Product screenshot / mockup */}
      <div className="relative mx-auto mt-16 max-w-6xl sm:mt-20">
        <div className="absolute -inset-x-10 -top-10 -bottom-10 rounded-[32px] bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-3xl" />
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-glow-intense backdrop-blur">
          <DashboardMock />
        </div>
      </div>
    </div>
  </section>
);

/* ---- Inline dashboard mockup — mirrors the real app layout ---- */
const DashboardMock = () => (
  <div className="grid grid-cols-12 gap-0 text-left">
    {/* Sidebar */}
    <aside className="col-span-12 border-b border-border/60 bg-background/60 p-4 sm:col-span-3 sm:border-b-0 sm:border-r sm:p-5">
      <div className="mb-5 flex items-center gap-2">
        <div className="h-6 w-6 overflow-hidden rounded-md ring-1 ring-border/60">
          <img
            src={docspeareIcon}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <span className="text-sm font-semibold tracking-tight">
          Your workspace
        </span>
      </div>
      <nav className="space-y-1 text-sm">
        {[
          { icon: LayoutGrid, label: "Dashboard", active: true },
          { icon: FileText, label: "Documentation" },
          { icon: Workflow, label: "Approvals", badge: "2" },
          { icon: GitBranch, label: "Version", tag: "v1.0" },
          { icon: Lock, label: "Project settings" },
        ].map((it) => (
          <div
            key={it.label}
            className={`flex items-center justify-between rounded-md px-2.5 py-1.5 ${
              it.active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <it.icon className="h-4 w-4" />
              {it.label}
            </span>
            {it.badge && (
              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {it.badge}
              </span>
            )}
            {it.tag && (
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {it.tag}
              </span>
            )}
          </div>
        ))}
      </nav>
    </aside>

    {/* Main */}
    <div className="col-span-12 bg-background/30 p-4 sm:col-span-9 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Welcome back</div>
          <div className="text-base font-semibold sm:text-lg">
            Documentation overview
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-border/70 bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            Search docs…
          </div>
          <div className="rounded-md bg-gradient-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            Publish
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            icon: Folder,
            k: "Projects",
            v: "Connected to Drive",
          },
          {
            icon: Workflow,
            k: "Approvals",
            v: "2 waiting on you",
          },
          {
            icon: RefreshCw,
            k: "Sync",
            v: "Up to date",
          },
        ].map((s) => (
          <div
            key={s.k}
            className="rounded-lg border border-border/70 bg-card/50 p-3"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <s.icon className="h-3.5 w-3.5" />
              {s.k}
            </div>
            <div className="mt-1 text-sm font-medium">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border/70 bg-card/50">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5 text-xs font-medium text-muted-foreground">
          <span>Recent activity</span>
          <span className="hidden sm:inline">Status</span>
        </div>
        <ul className="divide-y divide-border/60 text-sm">
          {[
            {
              t: "Getting started",
              a: "Approved",
              tone: "ok" as const,
            },
            {
              t: "API reference",
              a: "In review",
              tone: "pending" as const,
            },
            {
              t: "Release notes",
              a: "Draft synced from Drive",
              tone: "muted" as const,
            },
          ].map((r) => (
            <li
              key={r.t}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{r.t}</span>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                  r.tone === "ok"
                    ? "bg-primary/15 text-primary"
                    : r.tone === "pending"
                      ? "bg-amber-500/15 text-amber-500"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {r.a}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

/* ============================================================== */
/*  PROBLEM / STORY                                                */
/* ============================================================== */

const Problem = () => (
  <section className="py-20 sm:py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          Your docs are somewhere.{" "}
          <span className="text-muted-foreground">
            Just not where your customers are.
          </span>
        </h2>
        <p className="mt-5 text-base text-muted-foreground sm:text-lg">
          Product teams write in Google Docs. Engineers write in Notion.
          Support writes in a help center. Three systems, zero alignment —
          and customers pay the price in stale, contradictory docs.
        </p>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Docs go stale the moment they’re published",
            body: "Copy-pasting from Docs into a CMS means every edit triggers another sync. Nobody does it. Docs rot.",
          },
          {
            title: "Reviews happen in comments, not a workflow",
            body: "Google comments aren’t approvals. You don’t know what’s ready, what’s blocked, or who signed off.",
          },
          {
            title: "Migrating platforms costs weeks you don’t have",
            body: "Importers break formatting, lose history, and force your writers into a tool they didn’t choose.",
          },
        ].map((p) => (
          <div
            key={p.title}
            className="rounded-2xl border border-border/70 bg-card/60 p-6"
          >
            <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <X className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {p.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ============================================================== */
/*  FEATURES                                                        */
/* ============================================================== */

const features = [
  {
    icon: Folder,
    title: "Drive-native authoring",
    body: "Keep your folder hierarchy as the source of truth. Projects, versions, and visibility are inferred from Drive — no restructuring.",
  },
  {
    icon: Workflow,
    title: "Structured review & approval",
    body: "Move a doc from draft → in review → approved with reviewer assignments, comments, and a full audit trail on every change.",
  },
  {
    icon: RefreshCw,
    title: "Continuous sync",
    body: "Docspeare watches Drive and pulls in edits automatically. What you write in Docs is what appears in your docs site — no copy-paste.",
  },
  {
    icon: Bot,
    title: "Ask AI about any page",
    badge: "Beta",
    body: "Bring your own key for Anthropic, Gemini, Groq, or any OpenAI‑compatible model, and ask questions against the page you're reading. A full drafting & restructuring agent is coming soon.",
  },
  {
    icon: Lock,
    title: "Role-based access control",
    body: "Admins, reviewers, writers, and viewers. Separate public and internal portals so the right people see the right docs.",
  },
  {
    icon: Globe,
    title: "Clean public portals",
    body: "Fast, SEO-ready documentation on your own domain. Full-text search, dark mode, and an API reference renderer built in.",
  },
];

const Features = () => (
  <section id="features" className="border-t border-border/60 bg-card/30 py-20 sm:py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Everything you need
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          A knowledge platform that meets your team{" "}
          <span className="text-gradient">where they already write.</span>
        </h2>
        <p className="mt-5 text-base text-muted-foreground sm:text-lg">
          Purpose-built for companies that treat documentation as a product,
          not an afterthought.
        </p>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-6 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-glow"
          >
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <f.icon className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{f.title}</h3>
              {"badge" in f && f.badge ? (
                <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {f.badge}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {f.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ============================================================== */
/*  HOW IT WORKS                                                    */
/* ============================================================== */

const steps = [
  {
    icon: Folder,
    title: "Connect your Drive",
    body: "Point Docspeare at a Drive folder. We mirror the structure — projects, versions, everything — without moving a single file.",
  },
  {
    icon: Workflow,
    title: "Write, review, approve",
    body: "Your team keeps writing in Google Docs. Docspeare surfaces drafts, tracks changes, and routes each doc through an approval flow.",
  },
  {
    icon: Globe,
    title: "Publish to your portal",
    body: "Approved docs go live on your own domain — searchable, indexed, and on-brand. Public for customers, private for internal teams.",
  },
];

const HowItWorks = () => (
  <section id="how-it-works" className="py-20 sm:py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          How it works
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          From first Google Doc to published in{" "}
          <span className="text-gradient">under 10 minutes.</span>
        </h2>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={s.title}
            className="relative rounded-2xl border border-border/70 bg-card/60 p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <s.icon className="h-5 w-5" />
              </div>
              <span className="text-5xl font-bold leading-none text-muted-foreground/20">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <h3 className="text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ============================================================== */
/*  COMPARISON                                                      */
/* ============================================================== */

const rows: Array<{
  label: string;
  docspeare: string | boolean;
  legacy: string | boolean;
  drive: string | boolean;
}> = [
  { label: "Write in Google Docs", docspeare: true, legacy: false, drive: true },
  {
    label: "Structured approval workflow",
    docspeare: true,
    legacy: true,
    drive: false,
  },
  { label: "Continuous sync from Drive", docspeare: true, legacy: false, drive: false },
  { label: "Public portal on your domain", docspeare: true, legacy: true, drive: false },
  { label: "Role-based access control", docspeare: true, legacy: true, drive: "Partial" },
  { label: "Ask AI about your docs (BYOK)", docspeare: "Beta", legacy: "Add-on", drive: false },
  { label: "Without migrating your docs", docspeare: true, legacy: false, drive: true },
];

const cell = (v: string | boolean, accent = false) => {
  if (v === true)
    return (
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
          accent ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
        }`}
      >
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  if (v === false)
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <X className="h-3.5 w-3.5" />
      </span>
    );
  return (
    <span className="text-sm text-muted-foreground">{v as string}</span>
  );
};

const Comparison = () => (
  <section id="compare" className="py-20 sm:py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Why Docspeare
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          The speed of Google Docs.{" "}
          <span className="text-gradient">The rigor of a real CMS.</span>
        </h2>
      </div>

      <div className="mt-12 overflow-hidden rounded-2xl border border-border/70 bg-card/60">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-card/80 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-4 font-medium">Capability</th>
                <th className="px-5 py-4 font-medium text-primary">
                  Docspeare
                </th>
                <th className="px-5 py-4 font-medium">Legacy CMS</th>
                <th className="px-5 py-4 font-medium">Drive alone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((r) => (
                <tr key={r.label} className="align-middle">
                  <td className="px-5 py-4 font-medium">{r.label}</td>
                  <td className="px-5 py-4">{cell(r.docspeare, true)}</td>
                  <td className="px-5 py-4">{cell(r.legacy)}</td>
                  <td className="px-5 py-4">{cell(r.drive)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
);

/* ============================================================== */
/*  FAQ                                                             */
/* ============================================================== */

const faqs = [
  {
    q: "Do I need to migrate my docs out of Google Drive?",
    a: "No. Docspeare reads directly from Drive. Your folder structure, comments, and revision history stay exactly where they are. Nothing is duplicated and nothing is locked in.",
  },
  {
    q: "How does the review & approval workflow work?",
    a: "Each document moves through draft → in review → approved. Reviewers can be assigned per project, with comments and a full history on every change. Only approved docs are published to your portal.",
  },
  {
    q: "Can I publish on my own domain?",
    a: "Yes. Docspeare renders a portal on your own domain with SEO, theming, and full-text search. You can run a public portal for customers and a separate private portal for internal docs.",
  },
  {
    q: "Which AI providers does Docspeare support?",
    a: "Today you can bring your own key for Anthropic, Google Gemini, Groq, or any OpenAI-compatible endpoint (Ollama, vLLM, LiteLLM) and ask questions about the page you're reading. A fuller agent that drafts, restructures, and cleans up docs across your workspace is in active development. Docspeare never uses your content to train a shared model.",
  },
  {
    q: "How long does setup take?",
    a: "Most setups take a few minutes: sign in with Google, point Docspeare at a Drive folder, invite reviewers, publish. No migration, no rewrites.",
  },
  {
    q: "Is my data secure?",
    a: "Docspeare uses least-privilege Google Drive access, encrypts data at rest and in transit, and supports role-based access control. Documents stay in your Drive until you explicitly publish them.",
  },
];

const Faq = () => (
  <section id="faq" className="py-20 sm:py-24">
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          FAQ
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          Questions, answered.
        </h2>
      </div>

      <div className="mt-12 space-y-3">
        {faqs.map((f) => (
          <details
            key={f.q}
            className="group rounded-xl border border-border/70 bg-card/60 p-5 open:border-primary/40"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-medium marker:content-[''] sm:text-lg">
              {f.q}
              <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 group-open:text-primary" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </div>
  </section>
);

/* ============================================================== */
/*  FINAL CTA                                                       */
/* ============================================================== */

const FinalCta = ({
  navigate,
}: {
  navigate: ReturnType<typeof useNavigate>;
}) => (
  <section className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
    <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border/70 bg-card/70 px-6 py-16 text-center shadow-glow sm:px-12 sm:py-20">
      <div
        className="absolute inset-0 opacity-60"
        aria-hidden
        style={{ background: "var(--gradient-glow)" }}
      />
      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Built for teams who already live in Google Drive
        </div>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          Stop migrating docs.{" "}
          <span className="text-gradient">Start shipping them.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Docspeare plugs into the Drive you already have. Sign in with
          Google, point it at a folder, and start publishing.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            variant="hero"
            size="xl"
            className="w-full sm:w-auto"
            onClick={() => navigate("/signup")}
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="glass"
            size="xl"
            className="w-full sm:w-auto"
            onClick={() => navigate("/login")}
          >
            I already have an account
          </Button>
        </div>
      </div>
    </div>
  </section>
);

/* ============================================================== */
/*  FOOTER                                                          */
/* ============================================================== */

const SiteFooter = () => (
  <footer className="border-t border-border/60 bg-card/40 py-14">
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
      <div className="md:col-span-1">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 overflow-hidden rounded-lg ring-1 ring-border/60">
            <img
              src={docspeareIcon}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            docspeare
          </span>
        </div>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
          Ship documentation as fast as you ship product. The docs platform
          built for teams who live in Google Drive.
        </p>
      </div>

      <div>
        <h4 className="text-sm font-semibold">Product</h4>
        <ul className="mt-4 space-y-2.5 text-sm">
          <li>
            <a
              href="#features"
              className="text-muted-foreground hover:text-foreground"
            >
              Features
            </a>
          </li>
          <li>
            <a
              href="#how-it-works"
              className="text-muted-foreground hover:text-foreground"
            >
              How it works
            </a>
          </li>
          <li>
            <a
              href="#compare"
              className="text-muted-foreground hover:text-foreground"
            >
              Why Docspeare
            </a>
          </li>
          <li>
            <a
              href="#faq"
              className="text-muted-foreground hover:text-foreground"
            >
              FAQ
            </a>
          </li>
        </ul>
      </div>

      <div>
        <h4 className="text-sm font-semibold">Resources</h4>
        <ul className="mt-4 space-y-2.5 text-sm">
          <li>
            <a
              href={resolveBrandUrl(BRAND.urls.help)}
              className="text-muted-foreground hover:text-foreground"
            >
              Help center
            </a>
          </li>
          <li>
            <a
              href={resolveBrandUrl(BRAND.urls.contact)}
              className="text-muted-foreground hover:text-foreground"
            >
              Contact
            </a>
          </li>
          <li>
            <a
              href={resolveBrandUrl(BRAND.urls.privacy)}
              className="text-muted-foreground hover:text-foreground"
            >
              Privacy
            </a>
          </li>
          <li>
            <a
              href={resolveBrandUrl(BRAND.urls.terms)}
              className="text-muted-foreground hover:text-foreground"
            >
              Terms
            </a>
          </li>
        </ul>
      </div>

      <div>
        <h4 className="text-sm font-semibold">Stay in the loop</h4>
        <p className="mt-4 text-sm text-muted-foreground">
          Product updates, playbooks, and occasional alpha invites.
        </p>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="mt-4 flex gap-2"
        >
          <input
            type="email"
            required
            placeholder="you@company.com"
            className="h-10 flex-1 rounded-md border border-border/70 bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary"
          />
          <Button type="submit" variant="hero" size="sm">
            Notify me
          </Button>
        </form>
      </div>
    </div>

    <div className="mx-auto mt-12 max-w-7xl border-t border-border/60 px-4 pt-6 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Docspeare. All rights reserved.</p>
        <p>Made for teams who write in Google Drive.</p>
      </div>
    </div>
  </footer>
);
