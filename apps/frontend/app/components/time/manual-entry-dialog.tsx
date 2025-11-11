import * as React from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import type { ManualTimeEntryInput, TimeEntry } from "@vibe/shared";
import { useToast } from "~/components/toast";
import { supabase } from "~/lib/supabase";

type ManualEntryDialogProps = {
  apiBaseUrl: string;
  session: { access_token: string } | null;
  onSuccess?: () => void;
  children: React.ReactNode;
  entry?: TimeEntry | null; // Optional entry for edit mode
  open?: boolean; // Controlled open state
  onOpenChange?: (open: boolean) => void; // Controlled open change handler
};

export function ManualEntryDialog({ 
  apiBaseUrl, 
  session, 
  onSuccess, 
  children,
  entry = null,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ManualEntryDialogProps) {
  const toast = useToast();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPastDate, setIsPastDate] = React.useState(false);
  const [changeReason, setChangeReason] = React.useState("");

  const isEditMode = Boolean(entry);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  // Initialize form data from entry if editing, otherwise use defaults
  const getInitialFormData = (): ManualTimeEntryInput => {
    if (entry && entry.clock_in_at) {
      const clockIn = new Date(entry.clock_in_at);
      const clockOut = entry.clock_out_at ? new Date(entry.clock_out_at) : null;
      
      return {
        date: clockIn.toISOString().split('T')[0],
        start_time: clockIn.toTimeString().slice(0, 5), // HH:mm format
        end_time: clockOut ? clockOut.toTimeString().slice(0, 5) : "17:00",
        break_minutes: entry.break_minutes || 0,
        project_task: entry.project_task || "",
        notes: entry.notes || "",
      };
    }
    
    return {
      date: new Date().toISOString().split('T')[0],
      start_time: "09:00",
      end_time: "17:00",
      break_minutes: 60,
      project_task: "",
      notes: "",
    };
  };

  const [formData, setFormData] = React.useState<ManualTimeEntryInput>(getInitialFormData());

  // Reset form when entry changes or dialog opens/closes
  React.useEffect(() => {
    if (open) {
      const initialData = entry && entry.clock_in_at ? (() => {
        const clockIn = new Date(entry.clock_in_at);
        const clockOut = entry.clock_out_at ? new Date(entry.clock_out_at) : null;
        
        return {
          date: clockIn.toISOString().split('T')[0],
          start_time: clockIn.toTimeString().slice(0, 5),
          end_time: clockOut ? clockOut.toTimeString().slice(0, 5) : "17:00",
          break_minutes: entry.break_minutes || 0,
          project_task: entry.project_task || "",
          notes: entry.notes || "",
        };
      })() : {
        date: new Date().toISOString().split('T')[0],
        start_time: "09:00",
        end_time: "17:00",
        break_minutes: 60,
        project_task: "",
        notes: "",
      };
      
      setFormData(initialData);
      setChangeReason("");
      setError(null);
    }
  }, [open, entry]);

  // Auto-open dialog when entry is provided (edit mode)
  React.useEffect(() => {
    if (entry && !open && controlledOpen === undefined) {
      setInternalOpen(true);
    }
  }, [entry, open, controlledOpen]);

  // Check if selected date is in the past
  React.useEffect(() => {
    const selectedDate = new Date(formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setIsPastDate(selectedDate < today);
  }, [formData.date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Always get fresh session to ensure we have a valid token
    // Supabase auto-refreshes tokens, so getSession() should return a valid token
    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      setError("Authentication error. Please log in again.");
      return;
    }
    
    if (!currentSession?.access_token) {
      setError("Not authenticated. Please log in again.");
      return;
    }
    
    const freshSession = currentSession;

    setLoading(true);
    setError(null);

    try {
      if (isEditMode && entry) {
        // Update existing entry
        const updateData: {
          start_time?: string;
          end_time?: string;
          break_minutes?: number;
          project_task?: string;
          notes?: string;
          change_reason?: string;
        } = {
          start_time: formData.start_time,
          end_time: formData.end_time,
          break_minutes: formData.break_minutes,
          project_task: formData.project_task || undefined,
          notes: formData.notes || undefined,
        };

        if (changeReason.trim()) {
          updateData.change_reason = changeReason.trim();
        }

        const res = await fetch(`${apiBaseUrl}/api/time/entries/${entry.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${freshSession.access_token}`,
          },
          body: JSON.stringify(updateData),
          credentials: "include", // Include credentials for CORS
        });

        if (!res.ok) {
          // Try to parse error response
          let errorMessage = "Failed to update time entry";
          try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // If JSON parsing fails, use status text
            errorMessage = res.statusText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        const data = await res.json();
        toast.showToast("Time entry updated successfully", "success");
      } else {
        // Create new entry
        const res = await fetch(`${apiBaseUrl}/api/time/entries`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${freshSession.access_token}`,
          },
          body: JSON.stringify(formData),
          credentials: "include", // Include credentials for CORS
        });

        if (!res.ok) {
          // Try to parse error response
          let errorMessage = "Failed to create time entry";
          try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorMessage;
            // Include details if available
            if (errorData.details) {
              errorMessage += `: ${errorData.details}`;
            }
            // If it's an auth error, suggest refreshing
            if (res.status === 401) {
              errorMessage += ". Please try refreshing the page or logging in again.";
            }
          } catch {
            // If JSON parsing fails, use status text
            errorMessage = res.statusText || errorMessage;
            if (res.status === 401) {
              errorMessage += ". Authentication failed. Please log in again.";
            }
          }
          throw new Error(errorMessage);
        }

        const data = await res.json();
        toast.showToast("Time entry created successfully", "success");
      }

      setOpen(false);
      setFormData(getInitialFormData());
      setChangeReason("");
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save time entry";
      setError(errorMessage);
      toast.showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen && isEditMode) {
      // Reset entry when closing edit dialog
      onSuccess?.();
    }
  };

  const handleInputChange = (field: keyof ManualTimeEntryInput, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Calculate total hours
  const calculateHours = () => {
    const start = new Date(`2000-01-01T${formData.start_time}`);
    const end = new Date(`2000-01-01T${formData.end_time}`);
    const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    const netMinutes = Math.max(0, totalMinutes - (formData.break_minutes || 0));
    return {
      total: totalMinutes / 60,
      net: netMinutes / 60,
    };
  };

  const hours = calculateHours();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Time Entry" : "Add Manual Time Entry"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Update your time entry details. Changes may require manager approval."
              : "Enter your work hours for a specific date. Past dates will require manager approval."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {isPastDate && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              ⚠️ This entry is for a past date and will require manager approval.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange("date", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Total Hours</Label>
              <div className="text-sm text-muted-foreground">
                {hours.total.toFixed(1)}h total, {hours.net.toFixed(1)}h net
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                step="900"
                value={formData.start_time}
                onChange={(e) => handleInputChange("start_time", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="time"
                step="900"
                value={formData.end_time}
                onChange={(e) => handleInputChange("end_time", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="break_minutes">Break Duration (minutes)</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="break_minutes"
                type="number"
                min="0"
                max="1440"
                value={formData.break_minutes}
                onChange={(e) => handleInputChange("break_minutes", parseInt(e.target.value) || 0)}
                className="flex-1"
              />
              <div className="text-sm text-muted-foreground">
                {Math.floor((formData.break_minutes || 0) / 60)}h {(formData.break_minutes || 0) % 60}m
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project_task">Project/Task (optional)</Label>
            <Input
              id="project_task"
              value={formData.project_task}
              onChange={(e) => handleInputChange("project_task", e.target.value)}
              placeholder="e.g., Project Alpha, Bug Fix, Meeting"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Additional details about this time entry..."
              maxLength={500}
              rows={3}
            />
            <div className="text-xs text-muted-foreground">
              {(formData.notes || "").length}/500 characters
            </div>
          </div>

          {isEditMode && (
            <div className="space-y-2">
              <Label htmlFor="change_reason">Reason for Change (optional)</Label>
              <Input
                id="change_reason"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Explain why you're making this change..."
                maxLength={200}
              />
              <div className="text-xs text-muted-foreground">
                {changeReason.length}/200 characters
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (isEditMode ? "Updating..." : "Creating...") : (isEditMode ? "Update Entry" : "Create Entry")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
