import * as React from "react";
import { Plus, Calendar, Clock, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { LeaveRequestDialog } from "~/components/leave/leave-request-dialog";
import { LeaveBalanceWidget } from "~/components/leave/leave-balance-widget";
import { format, parseISO } from "date-fns";
import type { LeaveRequestEnhanced } from "@vibe/shared";
import { useApiContext } from "~/lib/api-context";
import { useToast } from "~/components/toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "~/components/ui/dialog";

export const meta = () => {
  return [
    { title: "My Leave Requests | Artemis" },
    { name: "description", content: "View and manage your leave requests" },
  ];
};

export default function LeaveRequestsPage() {
  const { session, apiBaseUrl } = useApiContext();
  const toast = useToast();
  const [requestDialogOpen, setRequestDialogOpen] = React.useState(false);
  const [requests, setRequests] = React.useState<LeaveRequestEnhanced[]>([]);
  const [pagination, setPagination] = React.useState({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState<string | null>(null);

  const loadRequests = React.useCallback(async () => {
    if (!session) return;

    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${apiBaseUrl}/api/leave/requests`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load leave requests");
      }
      setRequests(data.requests || []);
      setPagination(
        data.pagination || { page: 1, page_size: 20, total: 0, total_pages: 0 }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, session]);

  React.useEffect(() => {
    if (!session) return;
    void loadRequests();
  }, [session, loadRequests]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "denied":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>;
      case "denied":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Denied</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDateRange = (startDate: string, endDate: string, halfDayStart?: boolean, halfDayEnd?: boolean) => {
    const start = format(parseISO(startDate), "MMM d");
    const end = format(parseISO(endDate), "MMM d");
    
    let result = `${start} - ${end}`;
    if (halfDayStart) result += " (½ day start)";
    if (halfDayEnd) result += " (½ day end)";
    
    return result;
  };

  const handleRequestSubmitted = () => {
    void loadRequests();
  };

  const handleCancelRequest = async (requestId: string) => {
    if (!session) return;
    
    setCancellingId(requestId);
    
    try {
      const res = await fetch(`${apiBaseUrl}/api/leave/requests/${requestId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.showToast("Leave request cancelled successfully", "success");
        void loadRequests();
      } else {
        throw new Error(data.error || "Failed to cancel request");
      }
    } catch (err) {
      toast.showToast(
        err instanceof Error ? err.message : "Failed to cancel request",
        "error"
      );
    } finally {
      setCancellingId(null);
    }
  };

  if (error && !loading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Leave Requests</h1>
          <p className="text-muted-foreground">
            View and manage your time off requests
          </p>
        </div>
        <Button onClick={() => setRequestDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Request Time Off
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leave Balance Widget */}
        <div className="lg:col-span-1">
          <LeaveBalanceWidget
            onRequestLeave={() => setRequestDialogOpen(true)}
          />
        </div>

        {/* Requests List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Recent Requests
              </CardTitle>
              <CardDescription>
                {pagination.total} total request{pagination.total !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3 animate-pulse">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                      <Skeleton className="h-3 w-64" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ))}
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No leave requests yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Submit your first time off request to get started
                  </p>
                  <Button onClick={() => setRequestDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Request Time Off
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {requests.map((request: any) => (
                    <div
                      key={request.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(request.status)}
                          <div>
                            <div className="font-medium">
                              {request.leave_type_name || "Leave Request"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDateRange(
                                request.start_date, 
                                request.end_date, 
                                request.half_day_start, 
                                request.half_day_end
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(request.status)}
                          <div className="text-sm text-muted-foreground">
                            {format(parseISO(request.created_at), "MMM d, yyyy")}
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Duration</div>
                          <div className="font-medium">
                            {request.days_count} working day{request.days_count !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Leave Type</div>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: request.leave_type_color }}
                            />
                            <span>{request.leave_type_name}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Status</div>
                          <div className="font-medium">
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      {request.note && (
                        <div className="text-sm bg-gray-50 p-3 rounded-md">
                          <div className="font-medium text-muted-foreground mb-1">Notes:</div>
                          {request.note}
                        </div>
                      )}

                      {/* Denial Reason */}
                      {request.denial_reason && (
                        <div className="text-sm bg-red-50 border border-red-200 p-3 rounded-md">
                          <div className="font-medium text-red-800 mb-1">Denial Reason:</div>
                          <div className="text-red-700">{request.denial_reason}</div>
                        </div>
                      )}

                      {/* Attachment */}
                      {request.attachment_path && (
                        <div className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
                          📎 {request.attachment_path}
                        </div>
                      )}

                      {/* Cancel Button for Pending Requests */}
                      {request.status === "pending" && (
                        <div className="pt-2 border-t">
                          <Dialog open={cancelDialogOpen === request.id} onOpenChange={(open) => {
                            if (!open) {
                              setCancelDialogOpen(null);
                            } else {
                              setCancelDialogOpen(request.id);
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                disabled={cancellingId === request.id}
                              >
                                {cancellingId === request.id ? (
                                  <>
                                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                                    Cancelling...
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancel Request
                                  </>
                                )}
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Cancel Leave Request</DialogTitle>
                                <DialogDescription>
                                  Are you sure you want to cancel this leave request? This action cannot be undone.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setCancelDialogOpen(null)}
                                >
                                  Keep Request
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => {
                                    setCancelDialogOpen(null);
                                    handleCancelRequest(request.id);
                                  }}
                                  disabled={cancellingId === request.id}
                                >
                                  Cancel Request
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Leave Request Dialog */}
      <LeaveRequestDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        onSubmitted={handleRequestSubmitted}
      />
    </div>
  );
}
