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
import type { CreateOvertimeRequestInput } from "@vibe/shared";

type OvertimeRequestDialogProps = {
  apiBaseUrl: string;
  session: { access_token: string } | null;
  onSuccess?: () => void;
  children: React.ReactNode;
};

export function OvertimeRequestDialog({ 
  apiBaseUrl, 
  session, 
  onSuccess, 
  children 
}: OvertimeRequestDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState<CreateOvertimeRequestInput>({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    estimated_hours: 2,
    reason: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/overtime/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create overtime request");
      }

      setOpen(false);
      setFormData({
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        estimated_hours: 2,
        reason: "",
      });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create overtime request");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CreateOvertimeRequestInput, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Calculate days between dates
  const daysBetween = React.useMemo(() => {
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    if (end < start) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }, [formData.start_date, formData.end_date]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Request Overtime</DialogTitle>
          <DialogDescription>
            Submit a request for pre-authorization of overtime hours. Your manager will review and approve or deny your request.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => handleInputChange("start_date", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => handleInputChange("end_date", e.target.value)}
                required
              />
            </div>
          </div>

          {daysBetween > 0 && (
            <div className="text-sm text-muted-foreground">
              Period: {daysBetween} day{daysBetween !== 1 ? 's' : ''}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="estimated_hours">Estimated Hours</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="estimated_hours"
                type="number"
                min="0.5"
                max="168"
                step="0.5"
                value={formData.estimated_hours}
                onChange={(e) => handleInputChange("estimated_hours", parseFloat(e.target.value) || 0)}
                className="flex-1"
                required
              />
              <div className="text-sm text-muted-foreground">
                hours
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Estimated total overtime hours for this period (max 168 hours)
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => handleInputChange("reason", e.target.value)}
              placeholder="Explain why you need to work overtime..."
              maxLength={1000}
              rows={4}
              required
            />
            <div className="text-xs text-muted-foreground">
              {formData.reason.length}/1000 characters
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
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
