import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ManualEntryDialog } from "~/components/time/manual-entry-dialog";
import { OvertimeWidget } from "~/components/time/overtime-widget";
import type { TimeSummaryResponse } from "@vibe/shared";
import { Plus, Clock } from "lucide-react";

type MyTimeWidgetProps = {
  apiBaseUrl: string;
  session: Session | null;
  onRequestTimeOff: () => void;
  onTimeEntrySuccess?: () => void;
};

export function MyTimeWidget({ apiBaseUrl, session, onRequestTimeOff, onTimeEntrySuccess }: MyTimeWidgetProps) {
  const [summary, setSummary] = React.useState<TimeSummaryResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ticking, setTicking] = React.useState(0);

  React.useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");
        const res = await fetch(`${apiBaseUrl}/api/time/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await res.json().catch(() => ({}))) as Partial<TimeSummaryResponse>;
        if (!res.ok) throw new Error((payload as any).error || res.statusText);
        if (!cancelled) setSummary(payload as TimeSummaryResponse);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load time summary");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const interval = window.setInterval(() => setTicking((n) => n + 1), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, apiBaseUrl]);

  const activeSince = React.useMemo(() => {
    if (!summary?.activeEntry?.clock_in_at) return null;
    const d = new Date(summary.activeEntry.clock_in_at);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [summary?.activeEntry?.clock_in_at]);

  const runningText = React.useMemo(() => {
    if (!activeSince) return "";
    const now = new Date();
    const ms = Math.max(now.getTime() - activeSince.getTime(), 0);
    const totalMinutes = Math.floor(ms / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  }, [activeSince, ticking]);

  const handleClock = async () => {
    if (!session) return;
    const token = session.access_token;
    const isClockedIn = Boolean(summary?.activeEntry);
    const endpoint = isClockedIn ? "/api/time/clock-out" : "/api/time/clock-in";
    const res = await fetch(`${apiBaseUrl}${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((payload as any)?.error || res.statusText || "Action failed");
      return;
    }
    // Refresh summary
    const sum = await fetch(`${apiBaseUrl}/api/time/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const next = await sum.json().catch(() => ({}));
    if (sum.ok) setSummary(next as TimeSummaryResponse);
  };

  const isClockedIn = Boolean(summary?.activeEntry);
  const clockLabel = isClockedIn ? "Clock Out" : "Clock In";

  return (
    <div className="space-y-4">
      <Card className="border border-border/60 bg-muted/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            My Time
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <Button
              disabled={loading}
              onClick={handleClock}
              className={isClockedIn ? "bg-muted text-foreground hover:bg-muted/80" : undefined}
            >
              {clockLabel}
            </Button>
            {isClockedIn ? (
              <span className="text-sm text-muted-foreground">{runningText || ""}</span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-border/60 bg-background p-3">
              <div className="text-muted-foreground">Hours this week</div>
              <div className="text-lg font-semibold">
                {summary ? `${summary.hoursThisWeek} / ${summary.targetHours}` : "—"}
              </div>
            </div>
            <div className="rounded-md border border-border/60 bg-background p-3">
              <div className="text-muted-foreground">Available PTO</div>
              <div className="text-lg font-semibold">
                {summary ? `${summary.pto_balance_days.toFixed(1)} days` : "—"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ManualEntryDialog 
              apiBaseUrl={apiBaseUrl} 
              session={session} 
              onSuccess={() => {
                onTimeEntrySuccess?.();
                // Refresh summary
                const token = session?.access_token;
                if (token) {
                  fetch(`${apiBaseUrl}/api/time/summary`, {
                    headers: { Authorization: `Bearer ${token}` },
                  }).then(res => res.json()).then(data => {
                    if (res.ok) setSummary(data as TimeSummaryResponse);
                  });
                }
              }}
            >
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Manual Entry
              </Button>
            </ManualEntryDialog>
            <button
              type="button"
              onClick={onRequestTimeOff}
              className="text-sm font-medium text-primary hover:underline"
            >
              + Request Time Off
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Overtime Widget */}
      <OvertimeWidget 
        apiBaseUrl={apiBaseUrl} 
        session={session}
        onViewDetails={() => {
          // Navigate to overtime page
          window.location.href = '/time/overtime';
        }}
      />
    </div>
  );
}


