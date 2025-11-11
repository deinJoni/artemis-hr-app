import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Check, X, Clock, User, AlertCircle } from "lucide-react";
import type { PendingApproval, TimeEntryApprovalInput } from "@vibe/shared";
import { cn } from "~/lib/utils";
import { useApiContext } from "~/lib/api-context";
import { useToast } from "~/components/toast";

type TimeApprovalsListProps = {
  className?: string;
};

export function TimeApprovalsList({ className }: TimeApprovalsListProps) {
  const { session, apiBaseUrl } = useApiContext();
  const toast = useToast();
  const [approvals, setApprovals] = React.useState<PendingApproval[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState<Set<string>>(new Set());
  const [approvalReasons, setApprovalReasons] = React.useState<Record<string, string>>({});
  const [approveDialogOpen, setApproveDialogOpen] = React.useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState<string | null>(null);
  const [rejectReasonError, setRejectReasonError] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!session) return;

    const accessToken = session.access_token;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/api/time/entries/pending`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);

        if (!cancelled) setApprovals(data.approvals || []);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unable to load time approvals");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, session]);

  const handleApproval = React.useCallback(
    async (entryId: string, decision: "approve" | "reject") => {
      if (!session) return;
      if (processing.has(entryId)) return;

      // Validate rejection reason
      if (decision === "reject") {
        const reason = approvalReasons[entryId]?.trim();
        if (!reason) {
          setRejectReasonError((prev) => ({ ...prev, [entryId]: "Rejection reason is required" }));
          return;
        }
        setRejectReasonError((prev) => {
          const next = { ...prev };
          delete next[entryId];
          return next;
        });
      }

      setProcessing((prev) => new Set(prev).add(entryId));

      try {
        const approvalData: TimeEntryApprovalInput = {
          decision,
          reason: approvalReasons[entryId]?.trim() || undefined,
        };

        const res = await fetch(`${apiBaseUrl}/api/time/entries/${entryId}/approve`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(approvalData),
        });

        const data = await res.json();
        if (res.ok) {
          const approval = approvals.find((a) => a.id === entryId);
          setApprovals((prev) => prev.filter((approval) => approval.id !== entryId));
          setApprovalReasons((prev) => {
            const next = { ...prev };
            delete next[entryId];
            return next;
          });
          setApproveDialogOpen(null);
          setRejectDialogOpen(null);

          if (decision === "approve") {
            toast.showToast(
              `Time entry from ${approval?.employee_name || "employee"} has been approved`,
              "success"
            );
          } else {
            toast.showToast(
              `Time entry from ${approval?.employee_name || "employee"} has been rejected`,
              "info"
            );
          }
        } else {
          let errorMessage = data.error || "Failed to process approval";
          if (res.status === 400 && data.error) {
            errorMessage = data.error;
          } else if (res.status === 403) {
            errorMessage = "You don't have permission to approve this entry";
          } else if (res.status === 404) {
            errorMessage = "Time entry not found";
          }
          throw new Error(errorMessage);
        }
      } catch (e: unknown) {
        console.error("Error processing approval:", e);
        const errorMessage = e instanceof Error ? e.message : "Failed to process approval";
        toast.showToast(errorMessage, "error");
        // Don't remove entry from list on error so user can retry
      } finally {
        setProcessing((prev) => {
          const next = new Set(prev);
          next.delete(entryId);
          return next;
        });
      }
    },
    [apiBaseUrl, approvalReasons, approvals, processing, session, toast]
  );

  const formatTime = React.useCallback((timeString: string) => {
    return new Date(timeString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }, []);

  const formatDate = React.useCallback((timeString: string) => {
    return new Date(timeString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  const formatDuration = React.useCallback((minutes: number | null) => {
    if (minutes === null) return "—";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins.toString().padStart(2, "0")}m`;
  }, []);

  const getEntryTypeBadge = React.useCallback((type: string) => {
    switch (type) {
      case "clock":
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> Clock
          </Badge>
        );
      case "manual":
        return <Badge variant="outline">Manual</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  }, []);

  if (!session) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Time Entry Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Sign in to view pending approvals.</div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Time Entry Approvals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-6 w-40 rounded bg-muted animate-pulse" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-14 rounded bg-muted animate-pulse" />
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
          <CardTitle>Time Entry Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border border-border/60", className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1.5">
          <CardTitle>Time Entry Approvals</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review and approve pending time entries from your team
          </p>
        </div>
        <Badge variant="secondary" className="px-3 py-1 text-sm">
          {approvals.length} pending
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {approvals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Check className="h-10 w-10 text-green-500 mb-3" />
            <p className="text-sm text-muted-foreground">All caught up! No pending time entry approvals.</p>
          </div>
        ) : (
          approvals.map((approval) => (
            <div key={approval.id} className="rounded-lg border border-border/60">
              <div className="flex flex-col gap-4 border-b border-border/60 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center rounded-full bg-primary/10 p-2">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{approval.employee_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {approval.employee_email} • {approval.employee_number}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getEntryTypeBadge(approval.entry_type)}
                  <Badge variant="secondary">Pending</Badge>
                </div>
              </div>

              <div className="grid gap-4 px-4 py-4 md:grid-cols-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="text-sm font-medium">{formatDate(approval.clock_in_at)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Clock In</Label>
                  <p className="text-sm font-medium">{formatTime(approval.clock_in_at)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Clock Out</Label>
                  <p className="text-sm font-medium">
                    {approval.clock_out_at ? formatTime(approval.clock_out_at) : "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Duration</Label>
                  <p className="text-sm font-medium">{formatDuration(approval.duration_minutes)}</p>
                </div>
              </div>

              {(approval.break_minutes > 0 || approval.project_task || approval.notes) && (
                <div className="space-y-2 border-t border-border/60 px-4 py-3 text-sm">
                  {approval.break_minutes > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Break</span>
                      <p className="font-medium">{approval.break_minutes}m</p>
                    </div>
                  )}
                  {approval.project_task && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Project Task</span>
                      <p className="font-medium">{approval.project_task}</p>
                    </div>
                  )}
                  {approval.notes && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Notes</span>
                      <p className="font-medium">{approval.notes}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3 border-t border-border/60 bg-muted/20 px-4 py-4">
                <div>
                  <Label htmlFor={`reason-${approval.id}`} className="text-xs text-muted-foreground">
                    {approvalReasons[approval.id] ? "Approval Reason" : "Rejection Reason (required)"}
                  </Label>
                  <Textarea
                    id={`reason-${approval.id}`}
                    placeholder={approvalReasons[approval.id] ? "Add a reason for your decision..." : "Reason is required for rejection..."}
                    value={approvalReasons[approval.id] ?? ""}
                    onChange={(event) => {
                      setApprovalReasons((prev) => ({ ...prev, [approval.id]: event.target.value }));
                      if (rejectReasonError[approval.id]) {
                        setRejectReasonError((prev) => {
                          const next = { ...prev };
                          delete next[approval.id];
                          return next;
                        });
                      }
                    }}
                    rows={2}
                    className={rejectReasonError[approval.id] ? "border-destructive" : ""}
                  />
                  {rejectReasonError[approval.id] && (
                    <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {rejectReasonError[approval.id]}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Dialog open={rejectDialogOpen === approval.id} onOpenChange={(open) => {
                    if (!open) {
                      setRejectDialogOpen(null);
                    } else {
                      setRejectDialogOpen(approval.id);
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="sm:w-auto"
                        disabled={processing.has(approval.id)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reject Time Entry</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to reject this time entry? A reason is required.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                          <p><strong>Employee:</strong> {approval.employee_name}</p>
                          <p><strong>Date:</strong> {formatDate(approval.clock_in_at)}</p>
                          <p><strong>Duration:</strong> {formatDuration(approval.duration_minutes)}</p>
                          <p><strong>Type:</strong> {approval.entry_type === "clock" ? "Clock In/Out" : "Manual Entry"}</p>
                        </div>
                        <div>
                          <Label htmlFor={`reject-reason-${approval.id}`}>Rejection Reason *</Label>
                          <Textarea
                            id={`reject-reason-${approval.id}`}
                            placeholder="Enter reason for rejection..."
                            value={approvalReasons[approval.id] ?? ""}
                            onChange={(event) => {
                              setApprovalReasons((prev) => ({ ...prev, [approval.id]: event.target.value }));
                              if (rejectReasonError[approval.id]) {
                                setRejectReasonError((prev) => {
                                  const next = { ...prev };
                                  delete next[approval.id];
                                  return next;
                                });
                              }
                            }}
                            rows={3}
                            className={rejectReasonError[approval.id] ? "border-destructive" : ""}
                          />
                          {rejectReasonError[approval.id] && (
                            <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {rejectReasonError[approval.id]}
                            </p>
                          )}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setRejectDialogOpen(null)}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              setRejectDialogOpen(null);
                              void handleApproval(approval.id, "reject");
                            }}
                            disabled={processing.has(approval.id)}
                          >
                            {processing.has(approval.id) ? "Processing..." : "Confirm Rejection"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={approveDialogOpen === approval.id} onOpenChange={(open) => {
                    if (!open) {
                      setApproveDialogOpen(null);
                    } else {
                      setApproveDialogOpen(approval.id);
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        className="sm:w-auto"
                        disabled={processing.has(approval.id)}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Approve Time Entry</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to approve this time entry?
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                          <p><strong>Employee:</strong> {approval.employee_name}</p>
                          <p><strong>Date:</strong> {formatDate(approval.clock_in_at)}</p>
                          <p><strong>Clock In:</strong> {formatTime(approval.clock_in_at)}</p>
                          {approval.clock_out_at && (
                            <p><strong>Clock Out:</strong> {formatTime(approval.clock_out_at)}</p>
                          )}
                          <p><strong>Duration:</strong> {formatDuration(approval.duration_minutes)}</p>
                          <p><strong>Type:</strong> {approval.entry_type === "clock" ? "Clock In/Out" : "Manual Entry"}</p>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setApproveDialogOpen(null)}>
                            Cancel
                          </Button>
                          <Button
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              setApproveDialogOpen(null);
                              void handleApproval(approval.id, "approve");
                            }}
                            disabled={processing.has(approval.id)}
                          >
                            {processing.has(approval.id) ? "Processing..." : "Confirm Approval"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
