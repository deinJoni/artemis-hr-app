import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export function ActionItems({ apiBaseUrl, session }: { apiBaseUrl: string; session: Session | null }) {
  const [items, setItems] = React.useState<Array<{ id: string; display_name: string; start_date: string; end_date: string; leave_type: string }>>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

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
      const list = (payload.requests ?? []) as Array<any>;
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
    const res = await fetch(`${apiBaseUrl}/api/time-off/requests/${id}/approve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) {
      await load();
    }
  };

  return (
    <Card className="border border-border/60 bg-muted/40">
      <CardHeader className="space-y-1">
        <CardTitle>Action Items</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
        ) : null}
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No pending requests.</div>
        ) : (
          <ul className="space-y-3">
            {items.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-foreground">
                  Approve {r.display_name}'s {r.leave_type} request for {r.start_date} – {r.end_date}?
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide(r.id, "approve")}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => decide(r.id, "deny")}>Deny</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
