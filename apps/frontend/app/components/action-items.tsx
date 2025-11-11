import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "~/lib/utils";
import { useKeyboardShortcuts } from "~/hooks/use-keyboard-shortcuts";
import { useToast } from "~/components/toast";

type RequestItem = {
  id: string;
  display_name: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  note?: string;
  days?: number;
};

export function ActionItems({ apiBaseUrl, session }: { apiBaseUrl: string; session: Session | null }) {
  const toast = useToast();
  const [items, setItems] = React.useState<RequestItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = React.useState<Set<string>>(new Set());

  const load = React.useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/time-off/requests/pending`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as any)?.error || res.statusText);
      const list = (payload.requests ?? []) as RequestItem[];
      setItems(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to load action items");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, session]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, decision: "approve" | "deny") => {
    if (!session) return;
    setProcessingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`${apiBaseUrl}/api/time-off/requests/${id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        // Optimistic update
        setItems((prev) => prev.filter((item) => item.id !== id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.showToast(
          `Request ${decision === "approve" ? "approved" : "denied"} successfully`,
          decision === "approve" ? "success" : "info"
        );
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.showToast(
          (data as any)?.error || `Failed to ${decision} request`,
          "error"
        );
      }
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const bulkDecide = async (decision: "approve" | "deny") => {
    if (!session || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setProcessingIds(new Set(ids));
    try {
      await Promise.all(ids.map((id) => decide(id, decision)));
      setSelectedIds(new Set());
    } finally {
      setProcessingIds(new Set());
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Keyboard shortcuts for approve/deny
  useKeyboardShortcuts({
    enabled: items.length > 0,
    shortcuts: [
      {
        key: "a",
        handler: () => {
          if (selectedIds.size > 0) {
            bulkDecide("approve");
          } else if (items[0]) {
            decide(items[0].id, "approve");
          }
        },
        description: "Approve selected or first item",
      },
      {
        key: "d",
        handler: () => {
          if (selectedIds.size > 0) {
            bulkDecide("deny");
          } else if (items[0]) {
            decide(items[0].id, "deny");
          }
        },
        description: "Deny selected or first item",
      },
    ],
  });

  return (
    <Card className="border border-border/60 bg-muted/40 rounded-xl">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle>Action Items</CardTitle>
          {items.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {items.length} pending {items.length === 1 ? "request" : "requests"}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">No pending requests.</div>
        ) : (
          <>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex-1 text-sm font-medium">
                  {selectedIds.size} selected
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => bulkDecide("approve")}
                    disabled={processingIds.size > 0}
                    className="h-8"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Approve All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkDecide("deny")}
                    disabled={processingIds.size > 0}
                    className="h-8"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    Deny All
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedIds(new Set())}
                    className="h-8"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <Checkbox
                checked={selectedIds.size === items.length && items.length > 0}
                onCheckedChange={toggleSelectAll}
                id="select-all"
              />
              <label htmlFor="select-all" className="text-xs font-medium text-muted-foreground cursor-pointer">
                Select all
              </label>
            </div>
            <ul className="space-y-2">
              {items.map((r) => {
                const isSelected = selectedIds.has(r.id);
                const isExpanded = expandedIds.has(r.id);
                const isProcessing = processingIds.has(r.id);
                const days = r.days ?? (() => {
                  const s = new Date(r.start_date);
                  const e = new Date(r.end_date);
                  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
                  const ms = Math.max(e.getTime() - s.getTime(), 0);
                  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
                })();

                return (
                  <li
                    key={r.id}
                    className={cn(
                      "rounded-lg border border-border/60 bg-background transition-all",
                      isSelected && "border-primary/40 bg-primary/5",
                      isProcessing && "opacity-50 pointer-events-none"
                    )}
                  >
                    <div className="flex items-start gap-3 p-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(r.id)}
                        id={`select-${r.id}`}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {r.display_name}'s {r.leave_type} request
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {r.start_date} – {r.end_date} ({days} {days === 1 ? "day" : "days"})
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => decide(r.id, "approve")}
                              disabled={isProcessing}
                              className="h-8 bg-green-600 hover:bg-green-700 text-white"
                              title="Approve (A)"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => decide(r.id, "deny")}
                              disabled={isProcessing}
                              className="h-8 text-destructive hover:text-destructive"
                              title="Deny (D)"
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1.5" />
                              Deny
                            </Button>
                            {(r.note || days > 1) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleExpand(r.id)}
                                className="h-8 w-8 p-0"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                            {r.note && (
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1">Note:</div>
                                <div className="text-sm text-foreground">{r.note}</div>
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              Press <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono">A</kbd> to approve or{" "}
                              <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono">D</kbd> to deny
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
