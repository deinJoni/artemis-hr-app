import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Clock, TrendingUp, AlertTriangle } from "lucide-react";
import type { OvertimeBalance } from "@vibe/shared";

type OvertimeWidgetProps = {
  apiBaseUrl: string;
  session: { access_token: string } | null;
  onViewDetails?: () => void;
};

export function OvertimeWidget({ apiBaseUrl, session, onViewDetails }: OvertimeWidgetProps) {
  const [balance, setBalance] = React.useState<OvertimeBalance | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!session) return;
    
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");
        
        const res = await fetch(`${apiBaseUrl}/api/overtime/balance`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        
        if (!cancelled) setBalance(data);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load overtime balance");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true };
  }, [session?.access_token, apiBaseUrl]);

  const getOvertimeStatus = () => {
    if (!balance) return { status: 'unknown', color: 'gray' };
    
    const totalOvertime = balance.overtime_hours + balance.carry_over_hours;
    
    if (totalOvertime === 0) return { status: 'none', color: 'green' };
    if (totalOvertime < 5) return { status: 'low', color: 'blue' };
    if (totalOvertime < 20) return { status: 'moderate', color: 'yellow' };
    return { status: 'high', color: 'red' };
  };

  const getStatusIcon = () => {
    const { status } = getOvertimeStatus();
    switch (status) {
      case 'none':
        return <Clock className="h-4 w-4 text-green-600" />;
      case 'low':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'moderate':
        return <TrendingUp className="h-4 w-4 text-yellow-600" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusText = () => {
    const { status } = getOvertimeStatus();
    switch (status) {
      case 'none': return 'No overtime';
      case 'low': return 'Low overtime';
      case 'moderate': return 'Moderate overtime';
      case 'high': return 'High overtime';
      default: return 'Unknown';
    }
  };

  const getStatusColor = () => {
    const { color } = getOvertimeStatus();
    switch (color) {
      case 'green': return 'bg-green-100 text-green-800';
      case 'blue': return 'bg-blue-100 text-blue-800';
      case 'yellow': return 'bg-yellow-100 text-yellow-800';
      case 'red': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card className="border border-border/60 bg-muted/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Overtime Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
            <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border border-border/60 bg-muted/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Overtime Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalOvertime = balance ? balance.overtime_hours + balance.carry_over_hours : 0;
  const regularHours = balance?.regular_hours || 0;

  return (
    <Card className="border border-border/60 bg-muted/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Overtime Balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Current Period</span>
          <Badge variant="outline" className={getStatusColor()}>
            {getStatusIcon()}
            <span className="ml-1">{getStatusText()}</span>
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Regular Hours</div>
            <div className="text-2xl font-bold">{regularHours.toFixed(1)}h</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Overtime Hours</div>
            <div className="text-2xl font-bold text-orange-600">{totalOvertime.toFixed(1)}h</div>
          </div>
        </div>

        {balance && balance.carry_over_hours > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              <span className="text-amber-800">
                {balance.carry_over_hours.toFixed(1)}h carried over from previous period
              </span>
            </div>
          </div>
        )}

        {balance && balance.overtime_multiplier !== 1.5 && (
          <div className="text-xs text-muted-foreground">
            Overtime multiplier: {balance.overtime_multiplier}x
          </div>
        )}

        {onViewDetails && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onViewDetails}
            className="w-full"
          >
            View Details
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
