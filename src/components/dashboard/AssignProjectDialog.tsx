import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssignProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignProjectId: string;
  onProjectChange: (value: string) => void;
  assignTopicId: string;
  onTopicChange: (value: string) => void;
  projectOptions: Array<{ id: string; label: string }>;
  assignableTopics: Array<{ id: string; name: string }>;
  isAssigning: boolean;
  onAssign: () => void;
}

export const AssignProjectDialog = ({
  open,
  onOpenChange,
  assignProjectId,
  onProjectChange,
  assignTopicId,
  onTopicChange,
  projectOptions,
  assignableTopics,
  isAssigning,
  onAssign,
}: AssignProjectDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">Assign project</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Choose a project (or sub-project) for this page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Project</label>
            <Select
              value={assignProjectId}
              onValueChange={(value) => {
                onProjectChange(value);
              }}
            >
              <SelectTrigger className="bg-secondary">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projectOptions.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No projects found
                  </SelectItem>
                ) : (
                  projectOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {assignProjectId && assignableTopics.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Topic (optional)</label>
              <Select
                value={assignTopicId || "root"}
                onValueChange={(value) => onTopicChange(value === "root" ? "" : value)}
              >
                <SelectTrigger className="bg-secondary">
                  <SelectValue placeholder="Project root" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">
                    <span className="text-muted-foreground">Project root (no topic)</span>
                  </SelectItem>
                  {assignableTopics.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This list is scoped to the project's default version.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={onAssign} disabled={!assignProjectId || isAssigning} className="flex-1">
              {isAssigning ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
