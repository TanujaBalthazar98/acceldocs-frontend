import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Folder, ChevronRight, CornerLeftUp, Check } from "lucide-react";
import { useGoogleDrive, DriveFile } from "@/hooks/useGoogleDrive";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface DriveFolderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootFolderId: string;
  onSelect: (folder: { id: string; name: string }) => void;
  onOpenSettings?: () => void;
}

export const DriveFolderPickerDialog = ({
  open,
  onOpenChange,
  rootFolderId,
  onSelect,
  onOpenSettings,
}: DriveFolderPickerDialogProps) => {
  const { listFolder, getGoogleToken } = useGoogleDrive();
  const { signInWithGoogle } = useAuth();
  const [currentFolderId, setCurrentFolderId] = useState<string>(rootFolderId);
  // Need to track folder name for breadcrumbs or title? 
  // keeping it simple: just navigation stack
  const [history, setHistory] = useState<{ id: string; name: string }[]>([]);
  const [folders, setFolders] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [selectCurrent, setSelectCurrent] = useState(false);
  const hasToken = !!getGoogleToken();

  useEffect(() => {
    if (open) {
      loadFolder(currentFolderId);
    } else {
        // Reset when closed?
        setCurrentFolderId(rootFolderId);
        setHistory([]);
        setSelectedFolder(null);
        setSelectCurrent(false);
    }
  }, [open, currentFolderId]);

  const loadFolder = async (folderId: string) => {
    setIsLoading(true);
    try {
      if (!getGoogleToken()) {
        setFolders([]);
        return;
      }
      const { files } = await listFolder(folderId);
      if (files) {
        // Filter only folders
        const folderList = files.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
        setFolders(folderList);
      }
    } catch (error) {
      console.error("Failed to load folder", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (folder: DriveFile) => {
    setHistory((prev) => [...prev, { id: currentFolderId, name: "..." }]); // Name is hard without fetching it
    setCurrentFolderId(folder.id);
    setSelectedFolder(null); // Deselect when navigating? Or keep?
  };
  
  const handleUp = () => {
      if (history.length === 0) return;
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setCurrentFolderId(prev.id);
  }

  const handleConfirm = () => {
    if (selectedFolder) {
      onSelect(selectedFolder);
      onOpenChange(false);
      return;
    }
    if (selectCurrent) {
      onSelect({
        id: currentFolderId,
        name: currentFolderId === rootFolderId ? "Root (all folders)" : "Current folder",
      });
      onOpenChange(false);
    }
  };

  const handleReconnect = async () => {
    await signInWithGoogle();
  };

  // Special case: Selecting the CURRENT folder?
  // User might want to select the folder they are currently viewing.
  // But usually they pick a child.
  // Let's allow selecting a child from the list.
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>Select Drive Folder</DialogTitle>
          <DialogDescription>
            Choose existing folder to import content from.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-2">
            {history.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleUp} className="h-8 px-2">
                    <CornerLeftUp className="w-4 h-4 mr-1" />
                    Up
                </Button>
            )}
            <span className="text-sm text-muted-foreground truncate flex-1">
                {/* Check if currentFolderId matches root */}
                {currentFolderId === rootFolderId ? "Root" : "..." }
            </span>
        </div>

        {hasToken && (
          <button
            type="button"
            className={cn(
              "mb-3 flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
              selectCurrent ? "border-primary bg-primary/5 text-primary" : "border-border/60 text-muted-foreground"
            )}
            onClick={() => {
              setSelectCurrent((prev) => !prev);
              setSelectedFolder(null);
            }}
          >
            <span>
              {currentFolderId === rootFolderId ? "Use Root (all folders)" : "Use current folder"}
            </span>
            <Check className={cn("h-4 w-4", selectCurrent ? "opacity-100" : "opacity-0")} />
          </button>
        )}

        <ScrollArea className="h-[300px] border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : folders.length === 0 ? (
            <div className="flex items-center justify-center h-full px-6 text-center">
              {hasToken ? (
                <div className="text-sm text-muted-foreground">No folders found</div>
              ) : (
                <div className="w-full rounded-lg border border-dashed border-border/60 bg-muted/30 p-6 text-sm">
                  <div className="font-medium text-foreground">Drive isn’t connected</div>
                  <p className="mt-2 text-muted-foreground">
                    Add the Drive Folder ID in Settings, then reconnect Google to browse folders.
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Button
                      variant="outline"
                      onClick={() => {
                        onOpenChange(false);
                        onOpenSettings?.();
                      }}
                    >
                      Open Settings
                    </Button>
                    <Button onClick={handleReconnect}>Reconnect Google</Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-secondary/50 group",
                    selectedFolder?.id === folder.id && "bg-secondary"
                  )}
                  onClick={() => setSelectedFolder({ id: folder.id, name: folder.name })}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder className={cn("w-4 h-4", selectedFolder?.id === folder.id ? "text-blue-500" : "text-muted-foreground")} />
                    <span className="text-sm truncate max-w-[200px]">{folder.name}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleNavigate(folder);
                    }}
                  >
                      <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={(!selectedFolder && !selectCurrent) || !hasToken}>
            Select Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
