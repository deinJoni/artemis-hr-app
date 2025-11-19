import * as React from "react";
import { Laptop, GraduationCap, TrendingUp, User, Clock, Check, X, AlertCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";
import { useApiContext } from "~/lib/api-context";
import { useToast } from "~/components/toast";
import type { ApprovalRequest } from "@vibe/shared";

const CATEGORY_META = {
  equipment: {
    label: "Equipment Requests",
    description: "Laptops, badges, ergonomic gear, and IT accessories",
    icon: Laptop,
    accent: "text-blue-600",
  },
  training: {
    label: "Training & Development",
    description: "Certifications, conferences, and learning stipends",
    icon: GraduationCap,
    accent: "text-purple-600",
  },
  salary_change: {
    label: "Salary & Compensation",
    description: "Promotions, band adjustments, and comp plan updates",
    icon: TrendingUp,
    accent: "text-emerald-600",
  },
} as const;

type CategoryKey = keyof typeof CATEGORY_META;

const ORDERED_CATEGORIES: CategoryKey[] = ["equipment", "training", "salary_change"];

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const formatCurrency = (amount?: number | null, currency?: string | null) => {
  if (amount === null || amount === undefined) return "—";
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  });
  return formatter.format(amount);
};

export function CrossFunctionalApprovalsList() {
  const { session, apiBaseUrl } = useApiContext();
  const toast = useToast();
  const [requests, setRequests] = React.useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState<Set<string>>(new Set());
  const [approveDialog, setApproveDialog] = React.useState<string | null>(null);
  const [denyDialog, setDenyDialog] = React.useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = React.useState<Record<string, string>>({});
  const [denyErrors, setDenyErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!session) return;
    const accessToken = session.access_token;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/api/approvals/requests?status=pending`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (!cancelled) {
          if (res.ok) {
            setRequests(data.approvals || []);
          } else {
            setError(data.error || "Unable to load approval requests");
          }
        }
      } catch {
        if (!cancelled) setError("Unable to load approval requests");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, session]);

  const grouped = React.useMemo(() => {
    return requests.reduce<Record<CategoryKey, ApprovalRequest[]>>((acc, req) => {
      acc[req.category as CategoryKey] = acc[req.category as CategoryKey] || [];
      acc[req.category as CategoryKey].push(req);
      return acc;
    }, { equipment: [], training: [], salary_change: [] });
  }, [requests]);

  const resetState = React.useCallback((requestId: string) => {
    setDecisionNotes((prev) => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
    setDenyErrors((prev) => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
    setApproveDialog((current) => (current === requestId ? null : current));
    setDenyDialog((current) => (current === requestId ? null : current));
  }, []);

  const handleDecision = React.useCallback(async (
    request: ApprovalRequest,
    decision: "approve" | "deny"
  ) => {
    if (!session) return;
    if (processing.has(request.id)) return;

    if (decision === "deny") {
      const note = decisionNotes[request.id]?.trim();
      if (!note) {
        setDenyErrors((prev) => ({ ...prev, [request.id]: "Reason is required" }));
        return;
      }
      setDenyErrors((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
    }

    setProcessing((prev) => new Set(prev).add(request.id));
    try {
      const payload: { decision: "approve" | "deny"; reason?: string } = {
        decision,
      };
      const note = decisionNotes[request.id]?.trim();
      if (note) payload.reason = note;

      const res = await fetch(`${apiBaseUrl}/api/approvals/requests/${request.id}/decision`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setRequests((prev) => prev.filter((item) => item.id !== request.id));
        resetState(request.id);
        toast.showToast(
          `${request.title} ${decision === "approve" ? "approved" : "denied"}`,
          decision === "approve" ? "success" : "info"
        );
      } else {
        throw new Error(data.error || "Unable to process decision");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to process decision";
      toast.showToast(message, "error");
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(request.id);
        return next;
      });
    }
  }, [apiBaseUrl, decisionNotes, processing, resetState, session, toast]);

  const renderDetails = (request: ApprovalRequest) => {
    switch (request.category) {
      case "equipment": {
        const details = request.details;
        return (
          <dl className="grid gap-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <dt className="text-muted-foreground">Requested Item</dt>
              <dd className="font-medium">{details.itemType}</dd>
            </div>
            {details.specification && (
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-muted-foreground">Specification</dt>
                <dd>{details.specification}</dd>
              </div>
            )}
            {details.estimatedCost !== undefined && (
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-muted-foreground">Estimated Cost</dt>
                <dd>{formatCurrency(details.estimatedCost, details.currency)}</dd>
              </div>
            )}
            {request.needed_by && (
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-muted-foreground">Needed By</dt>
                <dd>{formatDate(request.needed_by)}</dd>
              </div>
            )}
          </dl>
        );
      }
      case "training": {
        const details = request.details;
        return (
          <dl className="grid gap-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <dt className="text-muted-foreground">Course</dt>
              <dd className="font-medium">{details.courseName}</dd>
            </div>
            {details.provider && (
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-muted-foreground">Provider</dt>
                <dd>{details.provider}</dd>
              </div>
            )}
            {details.schedule && (
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-muted-foreground">Schedule</dt>
                <dd>{formatDate(details.schedule)}</dd>
              </div>
            )}
            {details.estimatedCost !== undefined && (
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-muted-foreground">Tuition</dt>
                <dd>{formatCurrency(details.estimatedCost, details.currency)}</dd>
              </div>
            )}
          </dl>
        );
      }
      case "salary_change": {
        const details = request.details;
        const delta = details.proposedSalary - details.currentSalary;
        const pct = details.increasePercent ?? delta / details.currentSalary;
        return (
          <dl className="grid gap-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <dt className="text-muted-foreground">Current Salary</dt>
              <dd>{formatCurrency(details.currentSalary, details.currency)}</dd>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <dt className="text-muted-foreground">Proposed Salary</dt>
              <dd className="font-medium">{formatCurrency(details.proposedSalary, details.currency)}</dd>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <dt className="text-muted-foreground">Change</dt>
              <dd>{formatCurrency(delta, details.currency)} ({(pct * 100).toFixed(1)}%)</dd>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <dt className="text-muted-foreground">Effective Date</dt>
              <dd>{formatDate(details.effectiveDate)}</dd>
            </div>
          </dl>
        );
      }
      default:
        return null;
    }
  };

  if (!session) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Equipment & Other Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Sign in to review pending approvals.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Equipment & Other Approvals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6">
            {ORDERED_CATEGORIES.map((key) => (
              <div key={key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="space-y-2">
                  {[0, 1].map((item) => (
                    <Skeleton key={item} className="h-16 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border border-border/60">
      <CardHeader>
        <CardTitle>Equipment & Other Approvals</CardTitle>
        {error && (
          <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-8">
        {ORDERED_CATEGORIES.map((category) => {
          const config = CATEGORY_META[category];
          const Icon = config.icon;
          const list = grouped[category];
          return (
            <section key={category} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${config.accent}`} />
                    <h3 className="text-lg font-semibold">{config.label}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                </div>
                <Badge variant="secondary">{list.length} pending</Badge>
              </div>
              {!list.length ? (
                <div className="rounded border border-dashed border-muted-foreground/40 bg-muted/30 p-6 text-sm text-muted-foreground">
                  Nothing waiting here right now.
                </div>
              ) : (
                <div className="space-y-4">
                  {list.map((request) => (
                    <div key={request.id} className="rounded-lg border border-border/60 bg-card shadow-sm">
                      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {request.category.replace("_", " ")}
                            </Badge>
                            {request.needed_by && (
                              <Badge variant="secondary" className="bg-amber-50 text-amber-800">
                                Needed by {formatDate(request.needed_by)}
                              </Badge>
                            )}
                          </div>
                          <h4 className="text-lg font-semibold leading-tight">{request.title}</h4>
                          {request.summary && (
                            <p className="text-sm text-muted-foreground">{request.summary}</p>
                          )}
                          {renderDetails(request)}
                          <Separator className="my-3" />
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <User className="h-4 w-4" />
                              <span>
                                {request.requestor_name || "Unknown requester"}
                                {request.requestor_job_title && ` • ${request.requestor_job_title}`}
                                {request.department_name && ` (${request.department_name})`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span>Submitted {formatDate(request.requested_at)}</span>
                            </div>
                          </div>
                          {request.justification && (
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Business justification</p>
                              <p className="text-sm">{request.justification}</p>
                            </div>
                          )}
                          {request.attachments && request.attachments.length > 0 && (
                            <div className="text-sm">
                              <p className="text-xs uppercase text-muted-foreground">Attachments</p>
                              <ul className="list-inside list-disc">
                                {request.attachments.map((attachment) => (
                                  <li key={attachment.name}>{attachment.name}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <div className="w-full space-y-3 md:w-48">
                          <Dialog open={approveDialog === request.id} onOpenChange={(open) => !open && setApproveDialog(null)}>
                            <DialogTrigger asChild>
                              <Button
                                className="w-full"
                                variant="default"
                                onClick={() => setApproveDialog(request.id)}
                                disabled={processing.has(request.id)}
                              >
                                <Check className="mr-2 h-4 w-4" /> Approve
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Approve {request.title}?</DialogTitle>
                                <DialogDescription>
                                  Optionally capture context for the audit trail.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-3">
                                <Label htmlFor={`approve-note-${request.id}`}>Approval note</Label>
                                <Textarea
                                  id={`approve-note-${request.id}`}
                                  rows={3}
                                  placeholder="Add optional context"
                                  value={decisionNotes[request.id] || ""}
                                  onChange={(event) =>
                                    setDecisionNotes((prev) => ({ ...prev, [request.id]: event.target.value }))
                                  }
                                />
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => void handleDecision(request, "approve")}
                                    disabled={processing.has(request.id)}
                                  >
                                    Confirm Approval
                                  </Button>
                                  <Button variant="outline" onClick={() => resetState(request.id)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Dialog open={denyDialog === request.id} onOpenChange={(open) => !open && setDenyDialog(null)}>
                            <DialogTrigger asChild>
                              <Button
                                className="w-full"
                                variant="outline"
                                onClick={() => setDenyDialog(request.id)}
                                disabled={processing.has(request.id)}
                              >
                                <X className="mr-2 h-4 w-4" /> Deny
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Deny {request.title}?</DialogTitle>
                                <DialogDescription>
                                  Provide a reason so the requester knows what to do next.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-3">
                                <Label htmlFor={`deny-note-${request.id}`}>Denial reason</Label>
                                <Textarea
                                  id={`deny-note-${request.id}`}
                                  rows={4}
                                  value={decisionNotes[request.id] || ""}
                                  onChange={(event) =>
                                    setDecisionNotes((prev) => ({ ...prev, [request.id]: event.target.value }))
                                  }
                                />
                                {denyErrors[request.id] && (
                                  <p className="text-sm text-destructive">{denyErrors[request.id]}</p>
                                )}
                                <div className="flex gap-2">
                                  <Button
                                    variant="destructive"
                                    onClick={() => void handleDecision(request, "deny")}
                                    disabled={processing.has(request.id)}
                                  >
                                    Send Denial
                                  </Button>
                                  <Button variant="outline" onClick={() => resetState(request.id)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
