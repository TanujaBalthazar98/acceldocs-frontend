import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, Building2, Plus, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/api/client";

interface Organization {
  id: number;
  name: string;
  domain: string | null;
  member_count: number;
}

const API_URL = API_BASE_URL;

function getOAuthRedirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

function normalizeOrganization(raw: any): Organization | null {
  if (!raw) return null;
  const id = Number(raw.id ?? raw.organization_id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    name: String(raw.name ?? raw.title ?? "Unnamed Organization"),
    domain: raw.domain ? String(raw.domain) : null,
    member_count: Number(raw.member_count ?? raw.members ?? 0) || 0,
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    return payload?.detail || payload?.error || payload?.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export default function SignUp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [step, setStep] = useState<"search" | "create">("search");

  // Show message if redirected from login (no account found)
  useEffect(() => {
    if (searchParams.get("reason") === "no_account") {
      toast({
        title: "Account not found",
        description: "Please create or join an organization to get started.",
      });
    }
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Organization[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<number | null>(null);

  // Create new org form
  const [newOrgName, setNewOrgName] = useState("");
  const [rootFolderId, setRootFolderId] = useState("");
  const [creatingSignup, setCreatingSignup] = useState(false);

  const runOrganizationSearch = async (query: string): Promise<Organization[]> => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return [];

    const attempts: Array<{ url: string; method: "GET" | "POST"; body?: any }> = [
      { url: `${API_URL}/auth/search-organizations`, method: "POST", body: { query: normalizedQuery } },
      { url: `${API_URL}/auth/search-organizations?query=${encodeURIComponent(normalizedQuery)}`, method: "GET" },
      { url: `${API_URL}/api/organizations/search?query=${encodeURIComponent(normalizedQuery)}`, method: "GET" },
    ];

    for (const attempt of attempts) {
      try {
        const response = await fetch(attempt.url, {
          method: attempt.method,
          headers: attempt.method === "POST" ? { "Content-Type": "application/json" } : undefined,
          body: attempt.method === "POST" ? JSON.stringify(attempt.body) : undefined,
        });
        if (!response.ok) continue;
        const payload = await response.json();
        const source = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.organizations)
            ? payload.organizations
            : Array.isArray(payload?.data)
              ? payload.data
              : [];
        return source.map(normalizeOrganization).filter(Boolean) as Organization[];
      } catch {
        // Try next endpoint format.
      }
    }

    // Legacy fallback if search endpoint is not enabled on FastAPI yet.
    try {
      const response = await fetch(`${API_URL}/api/functions/search-organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalizedQuery }),
      });
      if (!response.ok) return [];
      const payload = await response.json();
      const source = Array.isArray(payload?.organizations) ? payload.organizations : [];
      return source.map(normalizeOrganization).filter(Boolean) as Organization[];
    } catch {
      return [];
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) {
      toast({
        title: "Query too short",
        description: "Please enter at least 2 characters",
        variant: "destructive",
      });
      return;
    }

    setSearching(true);
    try {
      const organizations = await runOrganizationSearch(searchQuery);
      setSearchResults(organizations);

      if (organizations.length === 0) {
        toast({
          title: "No organizations found",
          description: "Try a different search or create a new organization",
        });
      }
    } catch (err: any) {
      toast({
        title: "Search failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleJoinOrg = async () => {
    if (!selectedOrg) {
      toast({
        title: "No organization selected",
        description: "Please select an organization to join",
        variant: "destructive",
      });
      return;
    }

    setCreatingSignup(true);
    try {
      // Create signup token with org join info
      const response = await fetch(`${API_URL}/auth/prepare-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          org_id: selectedOrg,
        }),
      });

      if (!response.ok) throw new Error(await readErrorMessage(response));

      const { signup_token } = await response.json();

      // Get OAuth URL with signup token in state
      const redirectUri = getOAuthRedirectUri();
      const loginResponse = await fetch(
        `${API_URL}/auth/login?state=${encodeURIComponent(signup_token)}&redirect_uri=${encodeURIComponent(redirectUri)}`
      );
      if (!loginResponse.ok) throw new Error("Failed to get OAuth URL");
      const { url } = await loginResponse.json();
      window.location.href = url;
    } catch (err: any) {
      toast({
        title: "Signup failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setCreatingSignup(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) {
      toast({
        title: "Organization name required",
        description: "Please enter a name for your organization",
        variant: "destructive",
      });
      return;
    }

    if (!rootFolderId.trim()) {
      toast({
        title: "Root folder ID required",
        description: "Please enter your Google Drive root folder ID",
        variant: "destructive",
      });
      return;
    }

    setCreatingSignup(true);
    try {
      const existingOrgs = await runOrganizationSearch(newOrgName);
      const exists = existingOrgs.some((org) => org.name.toLowerCase() === newOrgName.trim().toLowerCase());
      if (exists) {
        setSearchQuery(newOrgName.trim());
        setSearchResults(existingOrgs);
        setStep("search");
        toast({
          title: "Workspace already exists",
          description: "An organization with this name already exists. Select it and continue.",
          variant: "destructive",
        });
        return;
      }

      // Create org via prepare-signup with signup token flow
      const response = await fetch(`${API_URL}/auth/prepare-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          org_name: newOrgName,
          drive_folder_id: rootFolderId,
        }),
      });

      if (!response.ok) {
        const msg = await readErrorMessage(response);
        if (
          response.status === 409 ||
          /already exists|duplicate|exists/i.test(msg)
        ) {
          setSearchQuery(newOrgName.trim());
          setSearchResults(await runOrganizationSearch(newOrgName));
          setStep("search");
          throw new Error("Workspace already exists. Search and join it instead.");
        }
        throw new Error(msg);
      }

      const { signup_token } = await response.json();
      const redirectUri = getOAuthRedirectUri();
      const loginResponse = await fetch(
        `${API_URL}/auth/login?state=${encodeURIComponent(signup_token)}&redirect_uri=${encodeURIComponent(redirectUri)}`
      );
      if (!loginResponse.ok) throw new Error("Failed to get OAuth URL");
      const { url } = await loginResponse.json();
      window.location.href = url;
    } catch (err: any) {
      toast({
        title: "Signup failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setCreatingSignup(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-background to-secondary/40 px-3 py-6 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/15 blur-3xl animate-pulse"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl animate-pulse"
          style={{ animationDuration: "10s", animationDelay: "2s" }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="mb-6 text-center sm:mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-gradient sm:text-4xl">
            Knowledge Workspace
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Create or join your documentation workspace
          </p>
        </div>

        {/* Main Card */}
        <Card className="border-border/80 bg-card/90 backdrop-blur-xl shadow-xl">
          <CardHeader className="px-4 pb-4 sm:px-8 sm:pb-6">
            <div className="flex items-center gap-2 mb-2">
              {step === "create" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep("search")}
                  disabled={creatingSignup}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
            </div>
            <CardTitle>
              {step === "search" ? "Find Your Organization" : "Create New Organization"}
            </CardTitle>
            <CardDescription>
              {step === "search"
                ? "Search for your organization to join, or create a new one"
                : "Set up your documentation workspace with Google Drive"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-4 pb-5 sm:px-8 sm:pb-8">
            {step === "search" ? (
              <>
                {/* Search Section */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex-1">
                      <Input
                        placeholder="Search by organization name or domain..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        disabled={searching}
                      />
                    </div>
                      <Button
                        onClick={handleSearch}
                        disabled={searching || searchQuery.trim().length < 2}
                        className="w-full sm:w-auto bg-primary text-primary-foreground hover:opacity-90"
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </Button>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      <Label>Select an organization to join:</Label>
                      <RadioGroup value={selectedOrg?.toString()} onValueChange={(val) => setSelectedOrg(Number(val))}>
                        {searchResults.map((org) => (
                          <div key={org.id} className="flex items-start space-x-2 border rounded-lg p-3 hover:bg-muted/50">
                            <RadioGroupItem value={org.id.toString()} id={`org-${org.id}`} />
                            <label htmlFor={`org-${org.id}`} className="flex-1 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <div className="font-medium">{org.name}</div>
                                  {org.domain && (
                                    <div className="text-sm text-muted-foreground">{org.domain}</div>
                                  )}
                                  <div className="text-xs text-muted-foreground">
                                    {org.member_count} {org.member_count === 1 ? "member" : "members"}
                                  </div>
                                </div>
                              </div>
                            </label>
                          </div>
                        ))}
                      </RadioGroup>

                      <Button
                        onClick={handleJoinOrg}
                        disabled={!selectedOrg || creatingSignup}
                        className="w-full bg-primary text-primary-foreground hover:opacity-90"
                      >
                        {creatingSignup ? "Redirecting..." : "Continue with Google"}
                      </Button>
                    </div>
                  )}

                  {/* Create New Option */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">or</span>
                    </div>
                  </div>

                  <Button variant="outline" onClick={() => setStep("create")} className="w-full" disabled={creatingSignup}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Organization
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Create New Organization Form */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">Organization Name *</Label>
                    <Input
                      id="org-name"
                      placeholder="Acme Inc."
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      disabled={creatingSignup}
                    />
                    <p className="text-sm text-muted-foreground">
                      This will be the name of your documentation workspace
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="folder-id">Google Drive Root Folder ID *</Label>
                    <Input
                      id="folder-id"
                      placeholder="1ABC123xyz..."
                      value={rootFolderId}
                      onChange={(e) => setRootFolderId(e.target.value)}
                      disabled={creatingSignup}
                    />
                    <p className="text-sm text-muted-foreground">
                      Open your Google Drive folder and copy the ID from the URL (the part after /folders/)
                    </p>
                  </div>

                  <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                    <p className="text-sm text-foreground">
                      <strong>Note:</strong> As the first user, you will become the Owner of this workspace.
                      The Google Drive folder you specify will be the root folder for all documentation.
                    </p>
                  </div>

                  <Button
                    onClick={handleCreateOrg}
                    disabled={creatingSignup || !newOrgName.trim() || !rootFolderId.trim()}
                    className="w-full bg-primary text-primary-foreground hover:opacity-90"
                  >
                    {creatingSignup ? "Creating..." : "Create & Sign In with Google"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-primary hover:underline font-medium"
              disabled={creatingSignup}
            >
              Log In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
