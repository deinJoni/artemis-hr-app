import * as React from "react";
import type { Task } from "@vibe/shared";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useToast } from "~/components/toast";
import { supabase } from "~/lib/supabase";

type DocumentTaskDialogProps = {
  task: Task | null;
  apiBaseUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function DocumentTaskDialog({
  task,
  apiBaseUrl,
  open,
  onOpenChange,
  onSuccess,
}: DocumentTaskDialogProps) {
  const { showToast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [description, setDescription] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const resetState = React.useCallback(() => {
    setFile(null);
    setDescription("");
    setNotes("");
    setError(null);
  }, []);

  React.useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  const payload = (task?.payload ?? null) as Record<string, unknown> | null;
  const documentType =
    payload && typeof payload.documentType === "string"
      ? (payload.documentType as string)
      : null;
  const instructions =
    payload && typeof payload.instructions === "string"
      ? (payload.instructions as string)
      : null;
  const category =
    payload && typeof payload.category === "string" ? (payload.category as string) : null;

  const handleSubmit = async () => {
    if (!task) return;
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        throw new Error("Missing access token");
      }

      const formData = new FormData();
      formData.append("file", file);
      if (description.trim().length > 0) {
        formData.append("description", description.trim());
      }
      if (notes.trim().length > 0) {
        formData.append("notes", notes.trim());
      }
      if (category) {
        formData.append("category", category);
      }

      const response = await fetch(`${apiBaseUrl}/api/tasks/${task.id}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((json as { error?: string }).error || "Unable to upload document");
      }

      showToast("Document uploaded successfully", "success");
      onSuccess?.();
      onOpenChange(false);
      resetState();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to upload document";
      setError(message);
      showToast(message, "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            {documentType
              ? `Upload the required "${documentType}" file to complete this task.`
              : "Upload the required document to complete this task."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {instructions ? (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {instructions}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="document-file">Document</Label>
            <Input
              id="document-file"
              type="file"
              disabled={uploading}
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Accepted formats: PDF, JPG, PNG, DOCX (max 10MB)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="document-description">Description (optional)</Label>
            <Input
              id="document-description"
              value={description}
              disabled={uploading}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="e.g., Signed contract"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="document-notes">Notes (optional)</Label>
            <Textarea
              id="document-notes"
              rows={4}
              disabled={uploading}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add any additional context for reviewers"
            />
          </div>

          {error ? (
            <div className="text-sm text-destructive" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={uploading || !file}>
            {uploading ? "Uploading…" : "Upload document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

