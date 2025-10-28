import * as React from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/my-team";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { supabase } from "~/lib/supabase";
import type { TeamMemberSummary } from "@vibe/shared";
import { formatDistanceToNow } from "date-fns";

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

// eslint-disable-next-line react-refresh/only-export-components
export function meta({}: Route.MetaArgs) {
  return [
    { title: "My Team | Artemis" },
    { name: "description", content: "Track team goals and run collaborative check-ins." },
  ];
}

type FetchState =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: TeamMemberSummary[] | null; error: null }
  | { status: "success"; data: TeamMemberSummary[]; error: null }
  | { status: "error"; data: TeamMemberSummary[] | null; error: string };

const DEFAULT_AGENDA = {
  accomplishments: "",
  priorities: "",
  roadblocks: "",
  notes: null,
};

export default function MyTeam({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);
  const navigate = useNavigate();

  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const [fetchState, setFetchState] = React.useState<FetchState>({ status: "idle", data: null, error: null });
  const [startingCheckInFor, setStartingCheckInFor] = React.useState<string | null>(null);
  const [startError, setStartError] = React.useState<string | null>(null);

  const loadTenantAndRoster = React.useCallback(async () => {
    setFetchState((prev) => ({ status: "loading", data: prev.data ?? null, error: null }));
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (!token) throw new Error("Missing access token");

      const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tenantJson = (await tenantRes.json()) as { id?: string };
      if (!tenantRes.ok || typeof tenantJson.id !== "string") throw new Error("Unable to resolve tenant");
      setTenantId(tenantJson.id);

      const teamRes = await fetch(`${apiBaseUrl}/api/my-team`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const teamJson = (await teamRes.json()) as { team?: TeamMemberSummary[]; error?: string };
      if (!teamRes.ok || !Array.isArray(teamJson.team)) {
        throw new Error(teamJson.error || "Unable to load team");
      }
      setFetchState({ status: "success", data: teamJson.team, error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to load team";
      setFetchState({ status: "error", data: null, error: message });
    }
  }, [apiBaseUrl]);

  React.useEffect(() => {
    void loadTenantAndRoster();
  }, [loadTenantAndRoster]);

  const handleStartCheckIn = React.useCallback(
    async (employeeId: string) => {
      setStartError(null);
      setStartingCheckInFor(employeeId);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");

        let ensuredTenantId = tenantId;
        if (!ensuredTenantId) {
          const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const tenantJson = (await tenantRes.json()) as { id?: string };
          if (!tenantRes.ok || typeof tenantJson.id !== "string") throw new Error("Unable to resolve tenant");
          ensuredTenantId = tenantJson.id;
          setTenantId(ensuredTenantId);
        }

        const payload = {
          tenantId: ensuredTenantId,
          employeeId,
          agenda: DEFAULT_AGENDA,
        };

        const res = await fetch(`${apiBaseUrl}/api/check-ins`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || typeof json?.id !== "string") {
          throw new Error((json as { error?: string }).error || "Unable to start check-in");
        }

        navigate(`/my-team/check-ins/${json.id}`);
      } catch (error: unknown) {
        setStartError(error instanceof Error ? error.message : "Unable to start check-in");
      } finally {
        setStartingCheckInFor(null);
      }
    },
    [apiBaseUrl, navigate, tenantId]
  );

  const handleRefresh = React.useCallback(() => {
    void loadTenantAndRoster();
  }, [loadTenantAndRoster]);

  const content = React.useMemo(() => {
    if (fetchState.status === "loading" || fetchState.status === "idle") {
      return (
        <div className="rounded-md border border-border/60 bg-muted/40 px-4 py-16 text-center text-sm text-muted-foreground">
          Loading your team…
        </div>
      );
    }
    if (fetchState.status === "error") {
      return (
        <div className="flex flex-col items-center gap-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-8 text-center">
          <div className="text-sm text-destructive">{fetchState.error}</div>
          <Button variant="outline" onClick={handleRefresh}>
            Try again
          </Button>
        </div>
      );
    }
    if ((fetchState.data ?? []).length === 0) {
      return (
        <div className="flex flex-col items-center gap-4 rounded-md border border-border/60 bg-muted/30 px-6 py-12 text-center">
          <div className="text-base font-medium text-foreground">No direct reports yet</div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Once employees are assigned to you as their manager, you&apos;ll see quick snapshots of their goals and last
            check-ins here.
          </p>
          <Button variant="outline" onClick={handleRefresh}>
            Refresh
          </Button>
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {fetchState.data?.map((member) => {
          const hasLastCheckIn = Boolean(member.lastCheckInAt);
          let lastCheckInLabel = "No check-ins yet";
          if (member.lastCheckInAt) {
            try {
              lastCheckInLabel = `${formatDistanceToNow(new Date(member.lastCheckInAt), { addSuffix: true })}`;
            } catch {
              lastCheckInLabel = "Recently";
            }
          }
          const total = member.totalGoals || 0;
          const completed = member.completedGoals || 0;
          const active = member.activeGoals || Math.max(total - completed, 0);
          const avgProgress = member.avgProgressPct || 0;
          const completionRatio = total > 0 ? Math.round((completed / total) * 100) : 0;

          return (
            <Card key={member.employeeId} className="flex flex-col border border-border/60 bg-background">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base font-semibold">
                  <span className="truncate">{member.employeeName}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {total} goal{total === 1 ? "" : "s"}
                  </span>
                </CardTitle>
                {member.employeeEmail ? (
                  <p className="truncate text-sm text-muted-foreground">{member.employeeEmail}</p>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Goal Progress</span>
                  <div className="flex items-center gap-2">
                    <div className="relative h-2 w-full rounded-full bg-muted">
                      <div
                        className="absolute left-0 top-0 h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, avgProgress))}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{Math.round(avgProgress)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{active} active</span>
                    <span>{completed} completed</span>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <span>Completion ratio</span>
                  <span>{completionRatio}%</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Last check-in</span>
                  <span>{hasLastCheckIn ? lastCheckInLabel : "—"}</span>
                </div>
                <div className="mt-auto flex flex-col gap-2 pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleStartCheckIn(member.employeeId)}
                    disabled={startingCheckInFor === member.employeeId}
                  >
                    {startingCheckInFor === member.employeeId ? "Starting…" : "Start a Check-in"}
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 text-left"
                    onClick={() => navigate(`/employees/${member.employeeId}/growth`)}
                  >
                    View Growth &amp; Goals
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }, [fetchState, handleRefresh, handleStartCheckIn, navigate, startingCheckInFor]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">My Team</h1>
          <Button onClick={() => handleRefresh()} variant="outline">
            Refresh
          </Button>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Keep a pulse on goals, prepare for conversations, and kick off check-ins with a single click. Shared agendas
          help you and your direct reports stay aligned between meetings.
        </p>
        {startError ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{startError}</div> : null}
      </div>
      {content}
    </div>
  );
}
