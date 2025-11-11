import * as React from "react";
import { Check, X, Clock, User, Calendar, AlertCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { format, parseISO, differenceInDays } from "date-fns";
import type { LeaveRequestEnhanced } from "@vibe/shared";
import { useApiContext } from "~/lib/api-context";
import { useToast } from "~/components/toast";

type LeaveApprovalsListProps = {
  className?: string;
};

export function LeaveApprovalsList({ className }: LeaveApprovalsListProps) {
  const { session, apiBaseUrl } = useApiContext();
  const toast = useToast();
  const [requests, setRequests] = React.useState<LeaveRequestEnhanced[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState<string | null>(null);
  const [denyDialogOpen, setDenyDialogOpen] = React.useState<string | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = React.useState<string | null>(null);
  const [denyReason, setDenyReason] = React.useState("");

  const loadPendingRequests = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = session?.access_token;
      const res = await fetch(`${apiBaseUrl}/api/leave/requests?status=pending`, {
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
      });
      
      const data = await res.json();
      if (res.ok) {
        setRequests(data.requests || []);
      } else {
        setError(data.error || "Failed to load requests");
      }
    } catch (err) {
      setError("Failed to load pending requests");
      console.error("Error loading requests:", err);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, session]);

  React.useEffect(() => {
    if (!session) return;
    
    loadPendingRequests();
  }, [session, loadPendingRequests]);

  const handleApproval = async (requestId: string, decision: "approve" | "deny", reason?: string) => {
    if (!session) return;
    
    setProcessing(requestId);
    
    try {
      const token = session.access_token;
      const res = await fetch(`${apiBaseUrl}/api/leave/requests/${requestId}/approve`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          decision,
          reason: reason || undefined,
        }),
      });
      
      const data = await res.json();
      if (res.ok) {
        // Remove the request from the list
        const request = requests.find(r => r.id === requestId);
        setRequests(prev => prev.filter(req => req.id !== requestId));
        setDenyDialogOpen(null);
        setApproveDialogOpen(null);
        setDenyReason("");
        
        // Show success toast
        if (decision === "approve") {
          toast.showToast(
            `Leave request from ${request?.employee_name || "employee"} has been approved`,
            "success"
          );
        } else {
          toast.showToast(
            `Leave request from ${request?.employee_name || "employee"} has been denied`,
            "info"
          );
        }
      } else {
        // Handle specific error cases
        let errorMessage = data.error || "Failed to process request";
        if (res.status === 400 && data.error) {
          errorMessage = data.error;
        } else if (res.status === 403) {
          errorMessage = "You don't have permission to approve this request";
        } else if (res.status === 404) {
          errorMessage = "Leave request not found";
        }
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error("Error processing request:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to process request";
      toast.showToast(errorMessage, "error");
      // Don't remove request from list on error so user can retry
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>;
      case "denied":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Denied</Badge>;
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

  const getUrgencyBadge = (startDate: string) => {
    const daysUntil = differenceInDays(new Date(startDate), new Date());
    
    if (daysUntil < 0) {
      return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
    } else if (daysUntil === 0) {
      return <Badge variant="destructive" className="text-xs">Starts Today</Badge>;
    } else if (daysUntil <= 3) {
      return <Badge variant="destructive" className="text-xs bg-red-100 text-red-800">Urgent ({daysUntil} day{daysUntil !== 1 ? 's' : ''})</Badge>;
    } else if (daysUntil <= 7) {
      return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">Soon ({daysUntil} days)</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">Starts in {daysUntil} days</Badge>;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[150px]" />
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
            <Clock className="h-5 w-5" />
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

  if (requests.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Approvals
          </CardTitle>
          <CardDescription>
            No pending leave requests to approve
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              All caught up! No pending leave requests at the moment.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Pending Approvals
        </CardTitle>
        <CardDescription>
          {requests.length} request{requests.length !== 1 ? 's' : ''} awaiting your approval
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="border rounded-lg p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{request.employee_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {request.employee_email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {getUrgencyBadge(request.start_date)}
                  {getStatusBadge(request.status)}
                  <div className="text-sm text-muted-foreground">
                    {format(parseISO(request.created_at), "MMM d, yyyy")}
                  </div>
                </div>
              </div>

              {/* Request Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Leave Type</div>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: request.leave_type_color }}
                    />
                    <span className="font-medium">{request.leave_type_name}</span>
                    {request.requires_certificate && (
                      <Badge variant="outline" className="text-xs">
                        Certificate Required
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Dates</div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {formatDateRange(
                        request.start_date, 
                        request.end_date, 
                        request.half_day_start, 
                        request.half_day_end
                      )}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Duration</div>
                  <div className="font-medium">
                    {request.days_count} working day{request.days_count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {request.note && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Notes</div>
                  <div className="text-sm bg-gray-50 p-3 rounded-md">
                    {request.note}
                  </div>
                </div>
              )}

              {/* Attachment */}
              {request.attachment_path && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Attachment</div>
                  <div className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
                    📎 {request.attachment_path}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Dialog open={denyDialogOpen === request.id} onOpenChange={(open) => {
                  if (!open) {
                    setDenyDialogOpen(null);
                    setDenyReason("");
                  } else {
                    setDenyDialogOpen(request.id);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={processing === request.id}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Deny
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Deny Leave Request</DialogTitle>
                      <DialogDescription>
                        Please provide a reason for denying this leave request.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Reason for denial *</label>
                        <Textarea
                          placeholder="Enter the reason for denying this request..."
                          value={denyReason}
                          onChange={(e) => setDenyReason(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setDenyDialogOpen(null);
                            setDenyReason("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleApproval(request.id, "deny", denyReason)}
                          disabled={!denyReason.trim() || processing === request.id}
                        >
                          {processing === request.id ? "Processing..." : "Deny Request"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={approveDialogOpen === request.id} onOpenChange={(open) => {
                  if (!open) {
                    setApproveDialogOpen(null);
                  } else {
                    setApproveDialogOpen(request.id);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      disabled={processing === request.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Approve Leave Request</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to approve this leave request? The employee's balance will be updated accordingly.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="text-sm text-muted-foreground">
                        <p><strong>Employee:</strong> {request.employee_name}</p>
                        <p><strong>Leave Type:</strong> {request.leave_type_name}</p>
                        <p><strong>Duration:</strong> {request.days_count} working day{request.days_count !== 1 ? 's' : ''}</p>
                        <p><strong>Dates:</strong> {formatDateRange(request.start_date, request.end_date, request.half_day_start, request.half_day_end)}</p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setApproveDialogOpen(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            setApproveDialogOpen(null);
                            handleApproval(request.id, "approve");
                          }}
                          disabled={processing === request.id}
                        >
                          {processing === request.id ? "Processing..." : "Confirm Approval"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
