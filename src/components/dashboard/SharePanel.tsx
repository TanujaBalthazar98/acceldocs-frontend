import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Globe,
  Lock,
  Users,
  Copy,
  Check,
  Link2,
  ChevronDown,
  UserPlus,
  Mail,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SharePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageTitle: string;
}

type Visibility = "internal" | "external" | "public";

const visibilityConfig = {
  internal: {
    icon: Lock,
    label: "Internal Only",
    description: "Only team members can view",
    color: "text-muted-foreground",
  },
  external: {
    icon: Users,
    label: "External (Authenticated)",
    description: "Anyone with login can view",
    color: "text-primary",
  },
  public: {
    icon: Globe,
    label: "Public",
    description: "Anyone on the internet can view",
    color: "text-state-active",
  },
};

const mockSharedWith = [
  { name: "Sarah Kim", email: "sarah@company.com", role: "Owner", avatar: "S" },
  { name: "Mike Rodriguez", email: "mike@company.com", role: "Editor", avatar: "M" },
  { name: "Alex Morgan", email: "alex@company.com", role: "Viewer", avatar: "A" },
];

export const SharePanel = ({ open, onOpenChange, pageTitle }: SharePanelProps) => {
  const [visibility, setVisibility] = useState<Visibility>("internal");
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");

  const currentVisibility = visibilityConfig[visibility];
  const VisibilityIcon = currentVisibility.icon;

  const handleCopyLink = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Share "{pageTitle}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Visibility Selector */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">
              Visibility
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-secondary border border-border hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-background ${currentVisibility.color}`}>
                      <VisibilityIcon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">
                        {currentVisibility.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {currentVisibility.description}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-80">
                {(Object.entries(visibilityConfig) as [Visibility, typeof visibilityConfig.internal][]).map(
                  ([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => setVisibility(key)}
                        className="flex items-center gap-3 p-3 cursor-pointer"
                      >
                        <div className={`p-2 rounded-lg bg-secondary ${config.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{config.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {config.description}
                          </p>
                        </div>
                      </DropdownMenuItem>
                    );
                  }
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Invite Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">
              Invite people
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="Enter email address..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex-1 flex items-center justify-between px-4 py-2.5 rounded-lg bg-secondary border border-border hover:border-primary/30 transition-colors">
                      <span className="text-sm text-foreground">Viewer</span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem className="flex flex-col items-start">
                      <span className="font-medium">Viewer</span>
                      <span className="text-xs text-muted-foreground">Can view only</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex flex-col items-start">
                      <span className="font-medium">Editor</span>
                      <span className="text-xs text-muted-foreground">Can edit pages</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex flex-col items-start">
                      <span className="font-medium">Admin</span>
                      <span className="text-xs text-muted-foreground">Can manage settings</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="default" className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  Invite
                </Button>
              </div>
            </div>
          </div>

          {/* People with access */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">
              People with access
            </label>
            <div className="space-y-2">
              {mockSharedWith.map((person) => (
                <div
                  key={person.email}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {person.avatar}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {person.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {person.email}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-background transition-colors flex items-center gap-1">
                        {person.role}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Owner</DropdownMenuItem>
                      <DropdownMenuItem>Editor</DropdownMenuItem>
                      <DropdownMenuItem>Viewer</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </div>

          {/* Copy Link */}
          <div className="pt-2 border-t border-border">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-state-active" />
                  <span className="text-state-active">Link copied!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  Copy link
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
