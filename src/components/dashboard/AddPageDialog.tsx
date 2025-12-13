import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Search, Folder } from "lucide-react";

interface AddPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const mockFolderDocs = [
  { id: "1", title: "API Rate Limiting Guide", folder: "API Reference", lastModified: "2 hours ago" },
  { id: "2", title: "Webhook Integration", folder: "Guides", lastModified: "Yesterday" },
  { id: "3", title: "SDK Installation", folder: "Tutorials", lastModified: "3 days ago" },
  { id: "4", title: "Release Notes v2.1", folder: "Changelog", lastModified: "1 week ago" },
  { id: "5", title: "Authentication Best Practices", folder: "API Reference", lastModified: "2 weeks ago" },
];

export const AddPageDialog = ({ open, onOpenChange }: AddPageDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  const filteredDocs = mockFolderDocs.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.folder.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Add Page
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Select a Google Doc from your organization's root folder to add to this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Document List */}
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {filteredDocs.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No documents found</p>
              </div>
            ) : (
              filteredDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc.id === selectedDoc ? null : doc.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left ${
                    selectedDoc === doc.id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-secondary border border-transparent"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${selectedDoc === doc.id ? "bg-primary/20" : "bg-secondary"}`}>
                    <FileText className={`w-4 h-4 ${selectedDoc === doc.id ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {doc.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Folder className="w-3 h-3" />
                      <span>{doc.folder}</span>
                      <span>•</span>
                      <span>Modified {doc.lastModified}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={!selectedDoc}>
              Add Page
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
