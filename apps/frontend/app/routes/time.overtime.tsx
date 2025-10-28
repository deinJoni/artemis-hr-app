import * as React from "react";
import type { Route } from "./+types/time.overtime";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { OvertimeWidget } from "~/components/time/overtime-widget";
import { Clock, TrendingUp, Calendar, AlertTriangle } from "lucide-react";
import type { OvertimeBalance } from "@vibe/shared";

// eslint-disable-next-line react-refresh/only-export-components
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
  const [selectedPeriod, setSelectedPeriod] = React.useState<string>("current");

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const session = (await import("~/lib/supabase")).supabase.auth.getSession();
        const { data: { session: authSession } } = await session;
        
        if (!authSession?.access_token) {
          throw new Error("Not authenticated");
        }

        // Load current period balance
        const currentRes = await fetch(`${apiBaseUrl}/api/overtime/balance`, {
          headers: { Authorization: `Bearer ${authSession.access_token}` },
        });
        
        const currentData = await currentRes.json();
        if (!currentRes.ok) throw new Error(currentData.error || currentRes.statusText);
        
        if (!cancelled) setCurrentBalance(currentData);

        // Load historical balances (last 12 periods)
        const historicalRes = await fetch(`${apiBaseUrl}/api/overtime/balance?period=historical`, {
          headers: { Authorization: `Bearer ${authSession.access_token}` },
        });
        
        const historicalData = await historicalRes.json();
        if (!historicalRes.ok) throw new Error(historicalData.error || historicalRes.statusText);
        
        if (!cancelled) setHistoricalBalances(historicalData.balances || []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load overtime data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true };
  }, [apiBaseUrl]);

  const getCurrentPeriod = () => {
    const now = new Date();
    const year = now.getFullYear();
    const week = getWeekNumber(now);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  };

  const getWeekNumber = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const formatPeriod = (period: string) => {
    const match = period.match(/(\d{4})-W(\d{2})/);
    if (!match) return period;
    const [, year, week] = match;
    return `Week ${parseInt(week)}, ${year}`;
  };

  const getOvertimeTrend = () => {
    if (historicalBalances.length < 2) return 'stable';
    
    const recent = historicalBalances.slice(0, 4); // Last 4 periods
    const totalOvertime = recent.map(b => b.overtime_hours + b.carry_over_hours);
    
    const isIncreasing = totalOvertime.every((val, i) => i === 0 || val >= totalOvertime[i - 1]);
    const isDecreasing = totalOvertime.every((val, i) => i === 0 || val <= totalOvertime[i - 1]);
    
    if (isIncreasing) return 'increasing';
    if (isDecreasing) return 'decreasing';
    return 'stable';
  };

  const getTrendIcon = () => {
    const trend = getOvertimeTrend();
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decreasing':
        return <TrendingUp className="h-4 w-4 text-green-500 rotate-180" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTrendText = () => {
    const trend = getOvertimeTrend();
    switch (trend) {
      case 'increasing':
        return 'Overtime is increasing';
      case 'decreasing':
        return 'Overtime is decreasing';
      default:
        return 'Overtime is stable';
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
          session={null}
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
              <div className="text-muted-foreground">8.0 hours per day</div>
            </div>
            <div className="text-sm">
              <div className="font-medium mb-2">Weekly Threshold</div>
              <div className="text-muted-foreground">40.0 hours per week</div>
            </div>
            <div className="text-sm">
              <div className="font-medium mb-2">Overtime Multiplier</div>
              <div className="text-muted-foreground">1.5x for overtime hours</div>
            </div>
            <div className="text-xs text-muted-foreground mt-4">
              Overtime is calculated automatically based on your approved time entries.
            </div>
          </CardContent>
        </Card>
      </div>

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
