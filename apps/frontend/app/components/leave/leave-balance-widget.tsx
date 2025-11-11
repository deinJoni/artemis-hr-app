import * as React from "react";
import { Calendar, AlertCircle, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Skeleton } from "~/components/ui/skeleton";
import type { LeaveBalanceSummary } from "@vibe/shared";
import { useApiContext } from "~/lib/api-context";

type LeaveBalanceWidgetProps = {
  onRequestLeave?: () => void;
};

export function LeaveBalanceWidget({ 
  onRequestLeave 
}: LeaveBalanceWidgetProps) {
  const { session, apiBaseUrl } = useApiContext();
  const [balances, setBalances] = React.useState<LeaveBalanceSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!session) return;

    const loadBalances = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const token = session.access_token;
        const res = await fetch(`${apiBaseUrl}/api/leave/balances/my-balance`, {
          headers: { 
            "Content-Type": "application/json", 
            Authorization: `Bearer ${token}` 
          },
        });
        
        const data = await res.json();
        if (res.ok) {
          setBalances(data.balances || []);
        } else {
          setError(data.error || "Failed to load balances");
        }
      } catch (err) {
        setError("Failed to load leave balances");
        console.error("Error loading balances:", err);
      } finally {
        setLoading(false);
      }
    };

    loadBalances();
  }, [session, apiBaseUrl]);

  const totalBalance = balances.reduce((sum, balance) => sum + balance.remaining_balance, 0);
  const totalUsed = balances.reduce((sum, balance) => sum + balance.used_ytd, 0);
  const totalAllocated = balances.reduce((sum, balance) => sum + balance.balance_days, 0);

  const lowBalanceTypes = balances.filter(balance => 
    balance.remaining_balance < 5 && balance.remaining_balance > 0
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Leave Balances
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-2 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Leave Balances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (balances.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Leave Balances
          </CardTitle>
          <CardDescription>
            No leave balances configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-4">
              Contact your administrator to set up leave balances
            </p>
            {onRequestLeave && (
              <Button onClick={onRequestLeave} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Request Leave
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Leave Balances
        </CardTitle>
        <CardDescription>
          {totalBalance.toFixed(1)} days remaining across all leave types
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Total Balance</span>
            <span className="text-muted-foreground">
              {totalUsed.toFixed(1)} / {totalAllocated.toFixed(1)} days used
            </span>
          </div>
          <Progress 
            value={(totalUsed / totalAllocated) * 100} 
            className="h-2"
          />
        </div>

        {/* Individual Leave Types */}
        <div className="space-y-3">
          {balances.map((balance) => {
            const usagePercentage = (balance.used_ytd / balance.balance_days) * 100;
            const isLowBalance = balance.remaining_balance < 5 && balance.remaining_balance > 0;
            const isNegative = balance.remaining_balance < 0;

            return (
              <div 
                key={balance.id} 
                className="space-y-2 rounded-lg border border-border/60 bg-background p-3 hover:border-primary/20 transition-all cursor-pointer group"
                onClick={() => onRequestLeave?.()}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: balance.leave_type_color }}
                    />
                    <span className="text-sm font-medium">
                      {balance.leave_type_name}
                    </span>
                    {isLowBalance && (
                      <Badge variant="secondary" className="text-xs">
                        Low Balance
                      </Badge>
                    )}
                    {isNegative && (
                      <Badge variant="destructive" className="text-xs">
                        Negative
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {balance.remaining_balance.toFixed(1)} days
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestLeave?.();
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{balance.used_ytd.toFixed(1)} used</span>
                  <span>•</span>
                  <span>{balance.balance_days.toFixed(1)} total</span>
                  {balance.requires_certificate && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Certificate required
                      </span>
                    </>
                  )}
                </div>
                
                <Progress 
                  value={Math.min(100, usagePercentage)} 
                  className="h-1.5"
                />
              </div>
            );
          })}
        </div>

        {/* Low Balance Warning */}
        {lowBalanceTypes.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-amber-800">Low Balance Alert</div>
              <div className="text-amber-700">
                You have less than 5 days remaining for:{" "}
                {lowBalanceTypes.map(b => b.leave_type_name).join(", ")}
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        {onRequestLeave && (
          <div className="pt-2">
            <Button onClick={onRequestLeave} className="w-full" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Request Time Off
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
