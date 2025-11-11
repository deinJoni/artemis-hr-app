import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ManualEntryDialog } from "~/components/time/manual-entry-dialog";
import { OvertimeWidget } from "~/components/time/overtime-widget";
import type { TimeSummaryResponse, TimeEntry } from "@vibe/shared";
import { Plus, Clock, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "~/lib/utils";
import { useToast } from "~/components/toast";

type MyTimeWidgetProps = {
  apiBaseUrl: string;
  session: Session | null;
  onRequestTimeOff: () => void;
  onTimeEntrySuccess?: () => void;
};

export function MyTimeWidget({ apiBaseUrl, session, onRequestTimeOff, onTimeEntrySuccess }: MyTimeWidgetProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [summary, setSummary] = React.useState<TimeSummaryResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ticking, setTicking] = React.useState(0);
  const [todayEntries, setTodayEntries] = React.useState<TimeEntry[]>([]);
  const [showTodayEntries, setShowTodayEntries] = React.useState(false);
  const [loadingEntries, setLoadingEntries] = React.useState(false);

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

  // Load today's entries when expanded
  React.useEffect(() => {
    if (!showTodayEntries || !session) return;
    let cancelled = false;
    async function loadTodayEntries() {
      if (!session) return;
      setLoadingEntries(true);
      try {
        const token = session.access_token;
        const today = new Date().toISOString().split('T')[0];
        const res = await fetch(`${apiBaseUrl}/api/time/entries?start_date=${today}&end_date=${today}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.entries) {
          setTodayEntries(data.entries);
        }
      } catch {
        // Ignore errors
      } finally {
        if (!cancelled) setLoadingEntries(false);
      }
    }
    void loadTodayEntries();
    return () => {
      cancelled = true;
    };
  }, [showTodayEntries, session, apiBaseUrl]);

  const activeSince = React.useMemo(() => {
    if (!summary?.activeEntry?.clock_in_at) return null;
    const d = new Date(summary.activeEntry.clock_in_at);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [summary?.activeEntry?.clock_in_at]);

  const runningText = React.useMemo(() => {
    if (!activeSince) return "";
    void ticking;
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
      const errorMessage = (payload as any)?.error || res.statusText || "Action failed";
      setError(errorMessage);
      
      // Show user-friendly toast for specific error codes
      if (res.status === 409) {
        toast.showToast(
          isClockedIn 
            ? "You are not currently clocked in." 
            : "You are already clocked in. Please clock out first.",
          "warning"
        );
      } else {
        toast.showToast(errorMessage, "error");
      }
      return;
    }
    
    // Show success toast
    toast.showToast(
      isClockedIn ? "Clocked out successfully" : "Clocked in successfully",
      "success"
    );
    
    // Refresh summary
    const sum = await fetch(`${apiBaseUrl}/api/time/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const next = await sum.json().catch(() => ({}));
    if (sum.ok) setSummary(next as TimeSummaryResponse);
  };

  const isClockedIn = Boolean(summary?.activeEntry);
  const clockLabel = isClockedIn ? "Clock Out" : "Clock In";

  const totalTodayHours = React.useMemo(() => {
    return todayEntries.reduce((sum, entry) => {
      return sum + (entry.duration_minutes || 0);
    }, 0) / 60;
  }, [todayEntries]);

  return (
    <div className="space-y-4">
      <Card className="border border-border/60 bg-muted/40 rounded-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              My Time
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/time/entries")}
              className="h-8 text-xs"
            >
              View All
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
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
              className={cn(
                "flex-1",
                isClockedIn 
                  ? "bg-green-600 hover:bg-green-700 text-white" 
                  : "bg-primary hover:bg-primary/90"
              )}
            >
              <Clock className="h-4 w-4 mr-2" />
              {clockLabel}
            </Button>
            {isClockedIn && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
                <span className="text-sm font-medium text-green-900 dark:text-green-100">
                  {runningText || ""}
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border/60 bg-background p-3 hover:border-primary/20 transition-colors cursor-pointer" onClick={() => navigate("/time/entries")}>
              <div className="text-muted-foreground text-xs mb-1">Hours this week</div>
              <div className="text-lg font-semibold">
                {summary ? `${summary.hoursThisWeek} / ${summary.targetHours}` : "—"}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background p-3 hover:border-primary/20 transition-colors cursor-pointer" onClick={onRequestTimeOff}>
              <div className="text-muted-foreground text-xs mb-1">Available PTO</div>
              <div className="text-lg font-semibold">
                {summary ? `${summary.pto_balance_days.toFixed(1)} days` : "—"}
              </div>
            </div>
          </div>

          {/* Today's Entries Summary */}
          <div className="rounded-lg border border-border/60 bg-background">
            <button
              type="button"
              onClick={() => setShowTodayEntries(!showTodayEntries)}
              className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-lg"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Today&apos;s Entries</span>
                {todayEntries.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({totalTodayHours.toFixed(1)}h)
                  </span>
                )}
              </div>
              {showTodayEntries ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {showTodayEntries && (
              <div className="px-3 pb-3 space-y-2 border-t border-border/60 pt-3">
                {loadingEntries ? (
                  <div className="text-xs text-muted-foreground py-2">Loading...</div>
                ) : todayEntries.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">No entries today</div>
                ) : (
                  todayEntries.map((entry) => {
                    const start = new Date(entry.clock_in_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const end = entry.clock_out_at
                      ? new Date(entry.clock_out_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—';
                    const hours = entry.duration_minutes ? (entry.duration_minutes / 60).toFixed(1) : '0';
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between text-xs p-2 rounded hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => navigate("/time/entries")}
                      >
                        <div>
                          <span className="font-medium">{start}</span>
                          <span className="text-muted-foreground mx-1">→</span>
                          <span className="font-medium">{end}</span>
                        </div>
                        <span className="text-muted-foreground">{hours}h</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ManualEntryDialog 
              apiBaseUrl={apiBaseUrl} 
              session={session} 
              onSuccess={() => {
                onTimeEntrySuccess?.();
                setShowTodayEntries(true);
                // Refresh summary and entries
                const token = session?.access_token;
                if (token) {
                  fetch(`${apiBaseUrl}/api/time/summary`, {
                    headers: { Authorization: `Bearer ${token}` },
                  }).then(res => res.json()).then(data => {
                    setSummary(data as TimeSummaryResponse);
                  });
                  const today = new Date().toISOString().split('T')[0];
                  fetch(`${apiBaseUrl}/api/time/entries?start_date=${today}&end_date=${today}`, {
                    headers: { Authorization: `Bearer ${token}` },
                  }).then(res => res.json()).then(data => {
                    if (data.entries) setTodayEntries(data.entries);
                  });
                }
              }}
            >
              <Button variant="outline" size="sm" className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                Manual Entry
              </Button>
            </ManualEntryDialog>
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestTimeOff}
              className="flex-1"
            >
              Request Time Off
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Overtime Widget */}
      <OvertimeWidget 
        apiBaseUrl={apiBaseUrl} 
        session={session}
        onViewDetails={() => {
          navigate('/time/overtime');
        }}
      />
    </div>
  );
}

