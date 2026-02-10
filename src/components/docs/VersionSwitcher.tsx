import { ChevronDown, History } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ProjectVersion } from "@/types/dashboard";
import { cn } from "@/lib/utils";

interface VersionSwitcherProps {
  currentVersion: ProjectVersion | null;
  versions: ProjectVersion[];
  onVersionSelect: (version: ProjectVersion) => void;
  className?: string;
}

export const VersionSwitcher = ({
  currentVersion,
  versions,
  onVersionSelect,
  className,
}: VersionSwitcherProps) => {
  // Only show if there are multiple versions to switch between
  if (versions.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-2 px-2 text-muted-foreground hover:text-foreground border border-transparent hover:border-border bg-secondary/30", 
            className
          )}
        >
          <History className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">
            {currentVersion?.name || "Select Version"}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-1 bg-popover border-border">
        <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Versions
        </div>
        {versions.map((version) => (
          <DropdownMenuItem
            key={version.id}
            onClick={() => onVersionSelect(version)}
            className={cn(
              "flex flex-col items-start gap-0.5 py-2 cursor-pointer rounded-sm mb-0.5 last:mb-0",
              currentVersion?.id === version.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-semibold text-sm">{version.name}</span>
              {version.is_default && (
                <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm border border-primary/20">
                  DEFAULT
                </span>
              )}
            </div>
            <span className="text-[10px] opacity-70 font-mono">
              /{version.slug}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
