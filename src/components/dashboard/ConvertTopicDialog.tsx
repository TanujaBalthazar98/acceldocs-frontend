import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FolderPlus, Copy, Scissors } from "lucide-react";

interface ConvertTopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  topicName: string;
  projectId: string;
  organizationId: string;
  onSuccess?: () => void;
}

export function ConvertTopicDialog({
  open,
  onOpenChange,
  topicId,
  topicName,
  projectId,
  organizationId,
  onSuccess,
}: ConvertTopicDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"move" | "copy">("copy");
  const [projectName, setProjectName] = useState(topicName);
  const [isConverting, setIsConverting] = useState(false);

  const handleConvert = async () => {
    if (!projectName.trim()) return;
    toast({
      title: "Conversion unavailable",
      description: "Topic conversion is not available in Strapi mode yet.",
      variant: "destructive",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-primary" />
            Convert Topic to Project
          </DialogTitle>
          <DialogDescription>
            Convert "{topicName}" and all its contents into a standalone project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="projectName">New Project Name</Label>
            <Input
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name"
              className="bg-secondary"
            />
          </div>

          {/* Mode Selection */}
          <div className="space-y-3">
            <Label>Conversion Mode</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "move" | "copy")}>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                <RadioGroupItem value="copy" id="copy" className="mt-0.5" />
                <Label htmlFor="copy" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium">
                    <Copy className="h-4 w-4 text-primary" />
                    Copy (Keep Original)
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a new project with copies of all pages and subtopics. 
                    The original topic remains unchanged.
                  </p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                <RadioGroupItem value="move" id="move" className="mt-0.5" />
                <Label htmlFor="move" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium">
                    <Scissors className="h-4 w-4 text-amber-500" />
                    Move (Delete Original)
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a new project and remove the original topic. 
                    This cannot be undone.
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConverting}>
            Cancel
          </Button>
          <Button 
            onClick={handleConvert} 
            disabled={isConverting || !projectName.trim()}
          >
            {isConverting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <FolderPlus className="h-4 w-4 mr-2" />
                {mode === "move" ? "Move to Project" : "Copy to Project"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
