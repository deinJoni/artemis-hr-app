import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { LeaveTypeEnum, type CreateTimeOffRequestInput } from "@vibe/shared";

type RequestDialogProps = {
  apiBaseUrl: string;
  session: Session | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
};

export function RequestTimeOffDialog({ apiBaseUrl, session, open, onOpenChange, onSubmitted }: RequestDialogProps) {
  const [form, setForm] = React.useState<CreateTimeOffRequestInput>({
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    leave_type: "vacation",
    note: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const daysRequested = React.useMemo(() => {
    const s = new Date(form.start_date);
    const e = new Date(form.end_date);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
    const ms = Math.max(e.getTime() - s.getTime(), 0);
    return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
  }, [form.start_date, form.end_date]);

  const submit = async () => {
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = session.access_token;
      const res = await fetch(`${apiBaseUrl}/api/time-off/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as any)?.error || res.statusText);
      onOpenChange(false);
      onSubmitted?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/60 p-4">
      <Card className="w-full max-w-md border border-border/60 bg-background">
        <CardHeader>
          <CardTitle>Request Time Off</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="grid gap-2">
            <label className="text-sm font-medium">Leave Type</label>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={form.leave_type}
              onChange={(e) => setForm((f) => ({ ...f, leave_type: e.target.value as typeof f.leave_type }))}
            >
              {LeaveTypeEnum.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Start Date</label>
            <input
              type="date"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">End Date</label>
            <input
              type="date"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            />
          </div>
          <div className="grid gap-1 text-sm text-muted-foreground">
            <span>Days requested: <span className="font-medium text-foreground">{daysRequested}</span></span>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Note (optional)</label>
            <textarea
              className="min-h-20 rounded-md border border-input bg-background p-2 text-sm"
              value={form.note ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Short note to your manager"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>Submit Request</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


