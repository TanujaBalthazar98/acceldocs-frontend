import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api/client";
import { ChevronsUpDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OrgItem {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  domain: string | null;
  user_role: string;
}

interface WorkspaceSwitcherProps {
  /** Current org, rendered as the trigger label */
  currentOrg: { id: number; name: string; logo_url?: string | null; primary_color?: string | null } | null;
  onWorkspaceChange: (orgId: number) => void;
  collapsed?: boolean;
}

const ORG_KEY = "acceldocs_current_org_id";

export function getStoredOrgId(): number | null {
  const val = localStorage.getItem(ORG_KEY);
  return val ? parseInt(val, 10) : null;
}

export function setStoredOrgId(id: number): void {
  localStorage.setItem(ORG_KEY, String(id));
}

/**
 * Inline workspace switcher that wraps the org name in the sidebar header.
 * When only one org exists it renders as a plain label (no dropdown).
 * When multiple orgs exist it renders as a dropdown trigger.
 */
export const WorkspaceSwitcher = ({
  currentOrg,
  onWorkspaceChange,
  collapsed = false,
}: WorkspaceSwitcherProps) => {
  const [organizations, setOrganizations] = useState<OrgItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchOrgs = useCallback(async () => {
    try {
      const resp = await apiFetch<{ ok: boolean; organizations: OrgItem[] }>(
        "/api/org/list",
      );
      if (!resp.error && resp.data?.organizations) {
        setOrganizations(resp.data.organizations);
      }
    } catch {
      // silently ignore — single-org fallback
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  // Not yet loaded or single org — just render the org name as-is (no switcher chrome)
  if (!loaded || organizations.length <= 1) {
    return (
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm leading-tight truncate">
          {currentOrg?.name ?? "Workspace"}
        </p>
      </div>
    );
  }

  const orgInitials = (org: OrgItem) =>
    org.name?.slice(0, 2).toUpperCase() ?? "??";

  if (collapsed) {
    // Collapsed sidebar — icon-only trigger
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="min-w-0 flex-1 text-left focus:outline-none"
            title="Switch workspace"
          >
            <p className="font-semibold text-sm leading-tight truncate">
              {currentOrg?.name ?? "Workspace"}
            </p>
          </button>
        </DropdownMenuTrigger>
        <OrgDropdownContent
          organizations={organizations}
          currentOrgId={currentOrg?.id ?? null}
          onSelect={(orgId) => {
            setStoredOrgId(orgId);
            onWorkspaceChange(orgId);
          }}
          orgInitials={orgInitials}
        />
      </DropdownMenu>
    );
  }

  // Expanded sidebar — name + subtle chevron
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="min-w-0 flex-1 flex items-center gap-1 text-left group focus:outline-none">
          <p className="font-semibold text-sm leading-tight truncate">
            {currentOrg?.name ?? "Workspace"}
          </p>
          <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
        </button>
      </DropdownMenuTrigger>
      <OrgDropdownContent
        organizations={organizations}
        currentOrgId={currentOrg?.id ?? null}
        onSelect={(orgId) => {
          setStoredOrgId(orgId);
          onWorkspaceChange(orgId);
        }}
        orgInitials={orgInitials}
      />
    </DropdownMenu>
  );
};

/** Shared dropdown content */
function OrgDropdownContent({
  organizations,
  currentOrgId,
  onSelect,
  orgInitials,
}: {
  organizations: OrgItem[];
  currentOrgId: number | null;
  onSelect: (orgId: number) => void;
  orgInitials: (org: OrgItem) => string;
}) {
  return (
    <DropdownMenuContent align="start" sideOffset={8} className="w-60">
      <div className="px-2 py-1.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          Workspaces
        </p>
      </div>
      <DropdownMenuSeparator />
      {organizations.map((org) => (
        <DropdownMenuItem
          key={org.id}
          onClick={() => onSelect(org.id)}
          className="flex items-center gap-2.5 py-2 cursor-pointer"
        >
          {org.logo_url ? (
            <img
              src={org.logo_url}
              alt=""
              className="w-6 h-6 rounded-md object-contain shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">
              {orgInitials(org)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{org.name}</p>
            <p className="text-[11px] text-muted-foreground capitalize">
              {org.user_role}
            </p>
          </div>
          {org.id === currentOrgId && (
            <Check className="h-3.5 w-3.5 text-primary shrink-0" />
          )}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );
}
