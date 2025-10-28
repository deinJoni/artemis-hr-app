import * as React from "react";
import type { Route } from "./+types/time.approvals";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Check, X, Clock, User } from "lucide-react";
import type { PendingApproval, TimeEntryApprovalInput } from "@vibe/shared";

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
    { title: "Time Entry Approvals - Artemis" },
    { name: "description", content: "Review and approve team time entries" },
  ];
}

export default function TimeApprovals({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" });
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);

  const [approvals, setApprovals] = React.useState<PendingApproval[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState<Set<string>>(new Set());
  const [approvalReasons, setApprovalReasons] = React.useState<Record<string, string>>({});

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

        const res = await fetch(`${apiBaseUrl}/api/time/entries/pending`, {
          headers: { Authorization: `Bearer ${authSession.access_token}` },
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        
        if (!cancelled) setApprovals(data.approvals || []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load approvals");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true };
  }, [apiBaseUrl]);

  const handleApproval = async (entryId: string, decision: 'approve' | 'reject') => {
    if (processing.has(entryId)) return;

    setProcessing(prev => new Set(prev).add(entryId));
    
    try {
      const session = (await import("~/lib/supabase")).supabase.auth.getSession();
      const { data: { session: authSession } } = await session;
      
      if (!authSession?.access_token) {
        throw new Error("Not authenticated");
      }

      const approvalData: TimeEntryApprovalInput = {
        decision,
        reason: approvalReasons[entryId] || undefined,
      };

      const res = await fetch(`${apiBaseUrl}/api/time/entries/${entryId}/approve`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify(approvalData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);

      // Remove from list
      setApprovals(prev => prev.filter(approval => approval.id !== entryId));
      setApprovalReasons(prev => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to process approval");
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (timeString: string) => {
    return new Date(timeString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (minutes: number | null) => {
    if (minutes === null) return '—';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  };

  const getEntryTypeBadge = (type: string) => {
    switch (type) {
      case 'clock':
        return <Badge variant="outline" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Clock</Badge>;
      case 'manual':
        return <Badge variant="outline">Manual</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded w-64" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded" />
          ))}
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Time Entry Approvals</h1>
          <p className="text-muted-foreground">
            Review and approve pending time entries from your team
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {approvals.length} pending
        </Badge>
      </div>

      {approvals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Check className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-muted-foreground text-center">
              There are no pending time entry approvals at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <Card key={approval.id} className="border-l-4 border-l-yellow-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">{approval.employee_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {approval.employee_email} • {approval.employee_number}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getEntryTypeBadge(approval.entry_type)}
                    <Badge variant="secondary">Pending Approval</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <p className="font-medium">{formatDate(approval.clock_in_at)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Clock In</Label>
                    <p className="font-medium">{formatTime(approval.clock_in_at)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Clock Out</Label>
                    <p className="font-medium">
                      {approval.clock_out_at ? formatTime(approval.clock_out_at) : '—'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Duration</Label>
                    <p className="font-medium">{formatDuration(approval.duration_minutes)}</p>
                  </div>
                </div>

                {(approval.break_minutes > 0 || approval.project_task || approval.notes) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {approval.break_minutes > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Break</Label>
                        <p className="font-medium">{approval.break_minutes}m</p>
                      </div>
                    )}
                    {approval.project_task && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Project/Task</Label>
                        <p className="font-medium">{approval.project_task}</p>
                      </div>
                    )}
                    {approval.notes && (
                      <div className="md:col-span-3">
                        <Label className="text-xs text-muted-foreground">Notes</Label>
                        <p className="font-medium">{approval.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <Label htmlFor={`reason-${approval.id}`}>Approval Reason (optional)</Label>
                  <Textarea
                    id={`reason-${approval.id}`}
                    placeholder="Add a reason for your decision..."
                    value={approvalReasons[approval.id] || ''}
                    onChange={(e) => setApprovalReasons(prev => ({
                      ...prev,
                      [approval.id]: e.target.value
                    }))}
                    rows={2}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => handleApproval(approval.id, 'approve')}
                    disabled={processing.has(approval.id)}
                    className="flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    {processing.has(approval.id) ? 'Processing...' : 'Approve'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleApproval(approval.id, 'reject')}
                    disabled={processing.has(approval.id)}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    {processing.has(approval.id) ? 'Processing...' : 'Reject'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
