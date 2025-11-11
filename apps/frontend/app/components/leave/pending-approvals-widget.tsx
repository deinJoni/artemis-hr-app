import * as React from "react";
import { Clock, UserCheck, ArrowRight, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Link } from "react-router";
import { format, parseISO, differenceInDays } from "date-fns";
import type { LeaveRequestEnhanced } from "@vibe/shared";
import { useApiContext } from "~/lib/api-context";

type PendingApprovalsWidgetProps = {
  className?: string;
  maxItems?: number;
};

export function PendingApprovalsWidget({ 
  className,
  maxItems = 5 
}: PendingApprovalsWidgetProps) {
  const { session, apiBaseUrl } = useApiContext();
  const [requests, setRequests] = React.useState<LeaveRequestEnhanced[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadPendingRequests = React.useCallback(async () => {
    if (!session) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = session.access_token;
      const res = await fetch(`${apiBaseUrl}/api/leave/requests?status=pending`, {
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
      });
      
      const data = await res.json();
      if (res.ok) {
        // Sort by urgency (days until start date) and take top items
        const sorted = (data.requests || []).sort((a: LeaveRequestEnhanced, b: LeaveRequestEnhanced) => {
          const daysA = differenceInDays(new Date(a.start_date), new Date());
          const daysB = differenceInDays(new Date(b.start_date), new Date());
          return daysA - daysB; // Most urgent first
        });
        setRequests(sorted.slice(0, maxItems));
      } else {
        setError(data.error || "Failed to load requests");
      }
    } catch (err) {
      setError("Failed to load pending requests");
      console.error("Error loading requests:", err);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, session, maxItems]);

  React.useEffect(() => {
    if (!session) return;
    loadPendingRequests();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadPendingRequests();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [session, loadPendingRequests]);

  const getUrgencyBadge = (startDate: string) => {
    const daysUntil = differenceInDays(new Date(startDate), new Date());
    
    if (daysUntil < 0) {
      return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
    } else if (daysUntil === 0) {
      return <Badge variant="destructive" className="text-xs">Today</Badge>;
    } else if (daysUntil <= 3) {
      return <Badge variant="destructive" className="text-xs bg-red-100 text-red-800">Urgent</Badge>;
    } else if (daysUntil <= 7) {
      return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">Soon</Badge>;
    }
    return null;
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = format(parseISO(startDate), "MMM d");
    const end = format(parseISO(endDate), "MMM d");
    return `${start} - ${end}`;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Pending Approvals
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

  const totalPending = requests.length;
  const hasMore = totalPending >= maxItems;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Pending Approvals
            </CardTitle>
            <CardDescription>
              {totalPending === 0 
                ? "No pending requests" 
                : `${totalPending} request${totalPending !== 1 ? 's' : ''} awaiting approval`
              }
            </CardDescription>
          </div>
          {totalPending > 0 && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              {totalPending}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {totalPending === 0 ? (
          <div className="text-center py-6">
            <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              All caught up! No pending leave requests.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-muted/40 transition-colors"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {request.employee_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateRange(request.start_date, request.end_date)}
                      </div>
                    </div>
                    {getUrgencyBadge(request.start_date)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: request.leave_type_color }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {request.leave_type_name} • {request.days_count} day{request.days_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  asChild
                >
                  <Link to="/approvals">
                    View all pending requests
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            )}
            {!hasMore && totalPending > 0 && (
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  asChild
                >
                  <Link to="/approvals">
                    Review all requests
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
