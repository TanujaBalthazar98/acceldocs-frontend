import { useState } from "react";
import { ExternalLink, MoreHorizontal, Settings, Send, CheckCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface OrgResourceItemProps {
  icon: React.ReactNode;
  label: string;
  isEnabled: boolean;
  previewUrl: string;
  isSelected?: boolean;
  onClick: () => void;
  onOpenSettings: () => void;
}

export const OrgResourceItem = ({
  icon,
  label,
  isEnabled,
  previewUrl,
  isSelected,
  onClick,
  onOpenSettings,
}: OrgResourceItemProps) => {
  if (!isEnabled) return null;

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
        isSelected
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      )}
      onClick={onClick}
    >
      {icon}
      <span className="flex-1 text-left truncate">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background transition-all"
          >
            <MoreHorizontal className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => window.open(previewUrl, "_blank")}>
            <Eye className="w-3 h-3 mr-2" />
            Preview
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenSettings}>
            <Settings className="w-3 h-3 mr-2" />
            Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
