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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { supabase } from "~/lib/supabase";
import { useToast } from "~/components/toast";

type FormField = {
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  options?: Array<{ label: string; value: string }>;
};

type FormTaskDialogProps = {
  task: Task | null;
  apiBaseUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

const SUPPORTED_FIELD_TYPES = new Set(["text", "textarea", "date", "select", "checkbox", "number"]);

export function FormTaskDialog({
  task,
  apiBaseUrl,
  open,
  onOpenChange,
  onSuccess,
}: FormTaskDialogProps) {
  const { showToast } = useToast();
  const [notes, setNotes] = React.useState("");
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const payload = (task?.payload ?? null) as Record<string, unknown> | null;
  const fields = Array.isArray(payload?.fields) ? (payload?.fields as FormField[]) : [];
  const defaultValues =
    payload && typeof payload.defaultValues === "object" && payload.defaultValues !== null
      ? (payload.defaultValues as Record<string, unknown>)
      : {};

  React.useEffect(() => {
    if (open) {
      setValues(defaultValues);
      setNotes("");
      setError(null);
    }
  }, [open, defaultValues]);

  const setValue = (field: string, value: unknown) => {
    setValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getFieldId = (field: FormField, index: number) => {
    return field.name && field.name.length > 0 ? field.name : `field_${index}`;
  };

  const handleSubmit = async () => {
    if (!task) return;
    setSubmitting(true);
    setError(null);

    try {
      const missingRequired = fields
        .filter((field, index) => {
          const id = getFieldId(field, index);
          if (!field.required) return false;
          const value = values[id];
          if (field.type === "checkbox") {
            return !value;
          }
          return value === undefined || value === null || value === "";
        })
        .map((field, index) => field.label || getFieldId(field, index));

      if (missingRequired.length > 0) {
        throw new Error(`Please complete required fields: ${missingRequired.join(", ")}`);
      }

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        throw new Error("Missing access token");
      }

      const response = await fetch(`${apiBaseUrl}/api/tasks/${task.id}/complete`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          formResponse: values,
          notes: notes.trim().length > 0 ? notes.trim() : undefined,
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((json as { error?: string }).error || "Unable to submit form");
      }

      showToast("Form submitted successfully", "success");
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to submit form";
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField, index: number) => {
    const id = getFieldId(field, index);
    const label = field.label || `Field ${index + 1}`;
    const type = SUPPORTED_FIELD_TYPES.has(field.type ?? "") ? field.type : "text";
    const value = values[id];

    switch (type) {
      case "textarea":
        return (
          <div className="space-y-2" key={id}>
            <Label htmlFor={id}>{label}</Label>
            <Textarea
              id={id}
              rows={4}
              placeholder={field.placeholder}
              value={typeof value === "string" ? value : ""}
              onChange={(event) => setValue(id, event.target.value)}
              disabled={submitting}
            />
            {field.helperText ? (
              <p className="text-xs text-muted-foreground">{field.helperText}</p>
            ) : null}
          </div>
        );
      case "date":
        return (
          <div className="space-y-2" key={id}>
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              type="date"
              value={typeof value === "string" ? value : ""}
              onChange={(event) => setValue(id, event.target.value)}
              disabled={submitting}
            />
            {field.helperText ? (
              <p className="text-xs text-muted-foreground">{field.helperText}</p>
            ) : null}
          </div>
        );
      case "select":
        return (
          <div className="space-y-2" key={id}>
            <Label htmlFor={id}>{label}</Label>
            <Select
              value={typeof value === "string" ? value : ""}
              onValueChange={(val) => setValue(id, val)}
              disabled={submitting}
            >
              <SelectTrigger id={id}>
                <SelectValue placeholder={field.placeholder ?? "Select option"} />
              </SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.helperText ? (
              <p className="text-xs text-muted-foreground">{field.helperText}</p>
            ) : null}
          </div>
        );
      case "checkbox":
        return (
          <div className="flex items-start gap-3 rounded-md border border-border/60 p-3" key={id}>
            <Checkbox
              id={id}
              checked={Boolean(value)}
              onCheckedChange={(checked) => setValue(id, Boolean(checked))}
              disabled={submitting}
            />
            <div className="space-y-1">
              <Label htmlFor={id} className="font-medium">
                {label}
              </Label>
              {field.helperText ? (
                <p className="text-xs text-muted-foreground">{field.helperText}</p>
              ) : null}
            </div>
          </div>
        );
      case "number":
        return (
          <div className="space-y-2" key={id}>
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              type="number"
              value={typeof value === "number" || typeof value === "string" ? value : ""}
              onChange={(event) => setValue(id, event.target.value)}
              placeholder={field.placeholder}
              disabled={submitting}
            />
            {field.helperText ? (
              <p className="text-xs text-muted-foreground">{field.helperText}</p>
            ) : null}
          </div>
        );
      case "text":
      default:
        return (
          <div className="space-y-2" key={id}>
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              type="text"
              value={typeof value === "string" ? value : ""}
              onChange={(event) => setValue(id, event.target.value)}
              placeholder={field.placeholder}
              disabled={submitting}
            />
            {field.helperText ? (
              <p className="text-xs text-muted-foreground">{field.helperText}</p>
            ) : null}
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Complete form</DialogTitle>
          <DialogDescription>
            Provide the requested details to move this task forward.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {fields.length === 0 ? (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              This form doesn&apos;t have structured fields yet. Add notes below and submit to mark
              it as complete.
            </div>
          ) : (
            fields.map((field, index) => renderField(field, index))
          )}

          <div className="space-y-2">
            <Label htmlFor="form-task-notes">Notes (optional)</Label>
            <Textarea
              id="form-task-notes"
              rows={3}
              disabled={submitting}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add any context for reviewers"
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
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit form"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

