import { useMemo, useState } from "react";
import { ExternalLink, Server, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AutomationConsole = () => {
  const backendUrl = useMemo(
    () => (import.meta.env.VITE_AUTOMATION_BACKEND_URL as string) || "http://localhost:8000",
    [],
  );
  const docsUrl = useMemo(
    () => (import.meta.env.VITE_AUTOMATION_DOCS_URL as string) || "http://localhost:8003",
    [],
  );
  const [tab, setTab] = useState<"backend" | "docs">("backend");

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">Automation Console</h1>
            <p className="text-sm text-muted-foreground">
              Reused UI shell with new automation backend.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(backendUrl, "_blank")}>
              <Server className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Backend</span>
              <ExternalLink className="w-4 h-4 ml-1 sm:ml-2" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(docsUrl, "_blank")}>
              <BookOpen className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Rendered Docs</span>
              <ExternalLink className="w-4 h-4 ml-1 sm:ml-2" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Button
                variant={tab === "backend" ? "default" : "outline"}
                size="sm"
                onClick={() => setTab("backend")}
              >
                Control Panel
              </Button>
              <Button
                variant={tab === "docs" ? "default" : "outline"}
                size="sm"
                onClick={() => setTab("docs")}
              >
                Rendered Documentation
              </Button>
            </div>
            <CardTitle className="text-base pt-2">
              {tab === "backend" ? "Automation Backend" : "Zensical Docs"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <iframe
              title={tab === "backend" ? "Automation Backend" : "Rendered Documentation"}
              src={tab === "backend" ? backendUrl : docsUrl}
              className="w-full h-[60vh] sm:h-[78vh] border rounded-md bg-white"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AutomationConsole;

