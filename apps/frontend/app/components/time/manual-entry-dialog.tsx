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
import type { ManualTimeEntryInput } from "@vibe/shared";

type ManualEntryDialogProps = {
  apiBaseUrl: string;
  session: { access_token: string } | null;
  onSuccess?: () => void;
  children: React.ReactNode;
};

export function ManualEntryDialog({ 
  apiBaseUrl, 
  session, 
  onSuccess, 
  children 
}: ManualEntryDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPastDate, setIsPastDate] = React.useState(false);

  const [formData, setFormData] = React.useState<ManualTimeEntryInput>({
    date: new Date().toISOString().split('T')[0],
    start_time: "09:00",
    end_time: "17:00",
    break_minutes: 60,
    project_task: "",
    notes: "",
  });

  // Check if selected date is in the past
  React.useEffect(() => {
    const selectedDate = new Date(formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setIsPastDate(selectedDate < today);
  }, [formData.date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/time/entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create time entry");
      }

      setOpen(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        start_time: "09:00",
        end_time: "17:00",
        break_minutes: 60,
        project_task: "",
        notes: "",
      });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create time entry");
    } finally {
      setLoading(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Manual Time Entry</DialogTitle>
          <DialogDescription>
            Enter your work hours for a specific date. Past dates will require manager approval.
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
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Additional details about this time entry..."
              maxLength={500}
              rows={3}
            />
            <div className="text-xs text-muted-foreground">
              {formData.notes.length}/500 characters
            </div>
          </div>

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
              {loading ? "Creating..." : "Create Entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
