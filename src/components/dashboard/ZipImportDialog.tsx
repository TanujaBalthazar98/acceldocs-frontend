import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ZipImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string | null;
  projectId?: string | null;
}

export const ZipImportDialog = ({ open, onOpenChange }: ZipImportDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Zip import is not available in Strapi mode yet.
        </p>
      </DialogContent>
    </Dialog>
  );
};
