import * as React from "react";
import type { Route } from "./+types/time.overtime";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { OvertimeWidget } from "~/components/time/overtime-widget";
import { OvertimeRequestDialog } from "~/components/time/overtime-request-dialog";
import { Clock, TrendingUp, Calendar, AlertTriangle, Plus } from "lucide-react";
import type { OvertimeBalance, OvertimeRule, OvertimeRequest } from "@vibe/shared";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "~/lib/supabase";

export async function loader() {
  const baseUrl =
    (import.meta as any).env?.VITE_BACKEND_URL ??
    (typeof process !== "undefined"
      ? ((process.env?.VITE_BACKEND_URL as string | undefined) ?? undefined)
      : undefined) ??
    "http://localhost:8787";
  return { baseUrl };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Overtime Tracking - Artemis" },
    { name: "description", content: "View your overtime balance and history" },
  ];
}

export default function TimeOvertime({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" });
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);

  const [currentBalance, setCurrentBalance] = React.useState<OvertimeBalance | null>(null);
  const [historicalBalances, setHistoricalBalances] = React.useState<OvertimeBalance[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [defaultRule, setDefaultRule] = React.useState<OvertimeRule | null>(null);
  const [requests, setRequests] = React.useState<OvertimeRequest[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();

        if (!authSession?.access_token) {
          throw new Error("Not authenticated");
        }

        if (!cancelled) setSession(authSession);

        // Load current period balance
        const headers = { Authorization: `Bearer ${authSession.access_token}` };
        const currentRes = await fetch(`${apiBaseUrl}/api/overtime/balance`, { headers });

        const currentData = await currentRes.json();
        if (!currentRes.ok) throw new Error(currentData.error || currentRes.statusText);

        if (!cancelled) setCurrentBalance(currentData);

        // Load overtime rules to display current thresholds
        try {
          const rulesRes = await fetch(`${apiBaseUrl}/api/overtime/rules`, { headers });
          const rulesData = await rulesRes.json().catch(() => ({}));
          if (rulesRes.ok && Array.isArray(rulesData.rules)) {
            const preferredRule =
              rulesData.rules.find((rule: OvertimeRule) => rule.is_default) ??
              rulesData.rules[0] ??
              null;
            if (!cancelled) setDefaultRule(preferredRule);
          }
        } catch (rulesError) {
          console.warn("Failed to load overtime rules", rulesError);
        }

        // Load overtime requests
        try {
          const requestsRes = await fetch(`${apiBaseUrl}/api/overtime/requests?status=pending`, { headers });
          const requestsData = await requestsRes.json().catch(() => ({}));
          if (requestsRes.ok && Array.isArray(requestsData.requests)) {
            if (!cancelled) setRequests(requestsData.requests);
          }
        } catch (requestsError) {
          console.warn("Failed to load overtime requests", requestsError);
        }

        if (!cancelled) setHistoricalBalances([]);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load overtime data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true };
  }, [apiBaseUrl]);

  const formatPeriod = (period: string) => {
    const match = period.match(/(\d{4})-W(\d{2})/);
    if (!match) return period;
    const [, year, week] = match;
    return `Week ${parseInt(week)}, ${year}`;
  };

  const getOvertimeTrend = () => {
    if (historicalBalances.length < 2) return "stable";

    const recent = historicalBalances.slice(0, 4); // Last 4 periods
    const totalOvertime = recent.map((b) => b.overtime_hours + b.carry_over_hours);

    const isIncreasing = totalOvertime.every((val, i) => i === 0 || val >= totalOvertime[i - 1]);
    const isDecreasing = totalOvertime.every((val, i) => i === 0 || val <= totalOvertime[i - 1]);

    if (isIncreasing) return "increasing";
    if (isDecreasing) return "decreasing";
    return "stable";
  };

  const getTrendIcon = () => {
    const trend = getOvertimeTrend();
    switch (trend) {
      case "increasing":
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "decreasing":
        return <TrendingUp className="h-4 w-4 text-green-500 rotate-180" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTrendText = () => {
    const trend = getOvertimeTrend();
    switch (trend) {
      case "increasing":
        return "Overtime is increasing";
      case "decreasing":
        return "Overtime is decreasing";
      default:
        return "Overtime is stable";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-48 bg-muted animate-pulse rounded" />
          <div className="h-48 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </div>
    );
  }

  const totalOvertime = currentBalance ? currentBalance.overtime_hours + currentBalance.carry_over_hours : 0;
  const regularHours = currentBalance?.regular_hours || 0;
  const dailyThreshold = defaultRule?.daily_threshold ?? 8;
  const weeklyThreshold = defaultRule?.weekly_threshold ?? 40;
  const multiplier = defaultRule?.weekly_multiplier ?? 1.5;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Overtime Tracking</h1>
          <p className="text-muted-foreground">
            Monitor your overtime balance and work patterns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OvertimeRequestDialog
            apiBaseUrl={apiBaseUrl}
            session={session}
            onSuccess={() => {
              // Reload requests after creating one
              if (session?.access_token) {
                fetch(`${apiBaseUrl}/api/overtime/requests?status=pending`, {
                  headers: { Authorization: `Bearer ${session.access_token}` },
                })
                  .then((res) => res.json())
                  .then((data) => {
                    if (Array.isArray(data.requests)) {
                      setRequests(data.requests);
                    }
                  })
                  .catch(() => {});
              }
            }}
          >
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Request Overtime
            </Button>
          </OvertimeRequestDialog>
          <Badge variant="outline" className="flex items-center gap-1">
            {getTrendIcon()}
            {getTrendText()}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Current Balance */}
        <OvertimeWidget
          apiBaseUrl={apiBaseUrl}
          session={session}
        />

        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Current Period Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{regularHours.toFixed(1)}h</div>
                <div className="text-sm text-muted-foreground">Regular Hours</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{totalOvertime.toFixed(1)}h</div>
                <div className="text-sm text-muted-foreground">Overtime Hours</div>
              </div>
            </div>

            {currentBalance && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Current Period Overtime:</span>
                  <span className="font-medium">{currentBalance.overtime_hours.toFixed(1)}h</span>
                </div>
                {currentBalance.carry_over_hours > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Carried Over:</span>
                    <span className="font-medium">{currentBalance.carry_over_hours.toFixed(1)}h</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium">
                  <span>Total Overtime:</span>
                  <span>{totalOvertime.toFixed(1)}h</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overtime Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Overtime Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <div className="font-medium mb-2">Daily Threshold</div>
              <div className="text-muted-foreground">{dailyThreshold.toFixed(1)} hours per day</div>
            </div>
            <div className="text-sm">
              <div className="font-medium mb-2">Weekly Threshold</div>
              <div className="text-muted-foreground">{weeklyThreshold.toFixed(1)} hours per week</div>
            </div>
            <div className="text-sm">
              <div className="font-medium mb-2">Overtime Multiplier</div>
              <div className="text-muted-foreground">{multiplier.toFixed(2)}x for overtime hours</div>
            </div>
            <div className="text-xs text-muted-foreground mt-4">
              Overtime is calculated automatically based on your approved time entries.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Overtime Requests */}
      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Overtime Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {requests.map((request) => {
                const startDate = new Date(request.start_date).toLocaleDateString();
                const endDate = new Date(request.end_date).toLocaleDateString();
                return (
                  <div key={request.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex-1">
                      <div className="font-medium">{startDate} - {endDate}</div>
                      <div className="text-sm text-muted-foreground mt-1">{request.reason}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Estimated: {request.estimated_hours}h
                      </div>
                    </div>
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Data */}
      {historicalBalances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Overtime History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {historicalBalances.slice(0, 12).map((balance, index) => {
                const totalOvertime = balance.overtime_hours + balance.carry_over_hours;
                return (
                  <div key={balance.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium">
                        {formatPeriod(balance.period)}
                      </div>
                      {index === 0 && (
                        <Badge variant="secondary" className="text-xs">Current</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-medium">{balance.regular_hours.toFixed(1)}h</div>
                        <div className="text-muted-foreground">Regular</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-orange-600">{totalOvertime.toFixed(1)}h</div>
                        <div className="text-muted-foreground">Overtime</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
