import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Link2, Search, FolderOpen } from "lucide-react";

interface AddPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const mockRecentDocs = [
  { id: "1", title: "API Rate Limiting Guide", lastModified: "2 hours ago" },
  { id: "2", title: "Webhook Integration", lastModified: "Yesterday" },
  { id: "3", title: "SDK Installation", lastModified: "3 days ago" },
];

export const AddPageDialog = ({ open, onOpenChange }: AddPageDialogProps) => {
  const [docUrl, setDocUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Add Page
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Link a Google Doc to this project. The document stays in Drive.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Paste URL */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">
              Paste Google Doc URL
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="url"
                  placeholder="https://docs.google.com/document/d/..."
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <Button variant="default" disabled={!docUrl}>
                Add
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or browse Drive</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Search Drive */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search your Google Drive..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Recent Docs */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">
              Recent documents
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {mockRecentDocs.map((doc) => (
                <button
                  key={doc.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left group"
                >
                  <div className="p-2 rounded-lg bg-secondary group-hover:bg-background">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {doc.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Modified {doc.lastModified}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Browse Folder */}
          <Button variant="outline" className="w-full gap-2">
            <FolderOpen className="w-4 h-4" />
            Browse project folder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
