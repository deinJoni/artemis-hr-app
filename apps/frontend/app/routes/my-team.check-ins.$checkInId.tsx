import * as React from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/my-team.check-ins.$checkInId";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { supabase } from "~/lib/supabase";
import type { CheckIn, Goal } from "@vibe/shared";
import { format, parseISO } from "date-fns";

export async function loader() {
  const baseUrl =
    (import.meta as any).env?.VITE_BACKEND_URL ??
    (typeof process !== "undefined"
      ? ((process.env?.VITE_BACKEND_URL as string | undefined) ?? undefined)
      : undefined) ??
    "http://localhost:8787";
  return { baseUrl };
}

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: "Check-in | Artemis" },
    { name: "description", content: `Collaborative check-in workspace for ${params.checkInId}` },
  ];
}

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; checkIn: CheckIn; goals: Goal[]; isManager: boolean; tenantId: string }
  | { status: "error"; message: string };

type AgendaDraft = {
  accomplishments: string;
  priorities: string;
  roadblocks: string;
};

const DEFAULT_AGENDA: AgendaDraft = {
  accomplishments: "",
  priorities: "",
  roadblocks: "",
};

export default function CheckInDetail({ loaderData, params }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);
  const checkInId = params.checkInId as string;
  const navigate = useNavigate();

  const [state, setState] = React.useState<FetchState>({ status: "idle" });
  const [agendaDraft, setAgendaDraft] = React.useState<AgendaDraft>(DEFAULT_AGENDA);
  const [privateNote, setPrivateNote] = React.useState<string>("");
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setState({ status: "loading" });
    setErrorMessage(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const userId = session?.user.id;
      if (!token || !userId) throw new Error("Missing access token");

      const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tenantJson = (await tenantRes.json()) as { id?: string };
      if (!tenantRes.ok || typeof tenantJson.id !== "string") throw new Error("Unable to resolve tenant");

      const checkInRes = await fetch(`${apiBaseUrl}/api/check-in/${checkInId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const checkInJson = (await checkInRes.json()) as CheckIn & { error?: string };
      if (!checkInRes.ok || typeof checkInJson?.id !== "string") {
        throw new Error(checkInJson.error || "Unable to load check-in");
      }

      const goalsRes = await fetch(`${apiBaseUrl}/api/my-team/${checkInJson.employeeId}/goals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const goalsJson = (await goalsRes.json()) as { goals?: Goal[]; error?: string };
      if (!goalsRes.ok || !Array.isArray(goalsJson.goals)) {
        throw new Error(goalsJson.error || "Unable to load goals");
      }

      setAgendaDraft({
        accomplishments: checkInJson.agenda?.accomplishments ?? "",
        priorities: checkInJson.agenda?.priorities ?? "",
        roadblocks: checkInJson.agenda?.roadblocks ?? "",
      });
      setPrivateNote(checkInJson.privateNote ?? "");

      setState({
        status: "ready",
        checkIn: checkInJson,
        goals: goalsJson.goals,
        isManager: checkInJson.managerUserId === userId,
        tenantId: tenantJson.id,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to load check-in";
      setState({ status: "error", message });
    }
  }, [apiBaseUrl, checkInId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAgendaFieldChange = React.useCallback(
    (field: keyof AgendaDraft, value: string) => {
      setAgendaDraft((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const sendUpdate = React.useCallback(
    async (updates: Partial<{ status: CheckIn["status"]; privateNote: string | null; agenda: AgendaDraft }>, mode: "save" | "complete" | "reopen") => {
      if (state.status !== "ready") return;
      setStatusMessage(null);
      setErrorMessage(null);
      if (mode === "complete") setCompleting(true);
      else setSaving(true);

      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");

        const payload = {
          tenantId: state.tenantId,
          ...updates,
        };

        const res = await fetch(`${apiBaseUrl}/api/check-ins/${state.checkIn.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || typeof json?.id !== "string") {
          throw new Error((json as { error?: string }).error || "Unable to update check-in");
        }

        setState({
          status: "ready",
          checkIn: json as CheckIn,
          goals: state.goals,
          isManager: state.isManager,
          tenantId: state.tenantId,
        });
        setAgendaDraft({
          accomplishments: (json as CheckIn).agenda?.accomplishments ?? "",
          priorities: (json as CheckIn).agenda?.priorities ?? "",
          roadblocks: (json as CheckIn).agenda?.roadblocks ?? "",
        });
        if (state.isManager) {
          setPrivateNote((json as CheckIn).privateNote ?? "");
        }
        setStatusMessage(
          mode === "complete"
            ? "Check-in completed."
            : mode === "reopen"
              ? "Check-in moved back to draft."
              : "Agenda saved."
        );
      } catch (error: unknown) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to update check-in");
      } finally {
        setSaving(false);
        setCompleting(false);
      }
    },
    [apiBaseUrl, state]
  );

  const handleSave = React.useCallback(() => {
    void sendUpdate(
      {
        agenda: agendaDraft,
        privateNote: state.status === "ready" && state.isManager ? privateNote : undefined,
      },
      "save"
    );
  }, [agendaDraft, privateNote, sendUpdate, state]);

  const handleComplete = React.useCallback(() => {
    void sendUpdate(
      {
        agenda: agendaDraft,
        privateNote: state.status === "ready" && state.isManager ? privateNote : undefined,
        status: "completed",
      },
      "complete"
    );
  }, [agendaDraft, privateNote, sendUpdate, state]);

  const handleReopen = React.useCallback(() => {
    void sendUpdate(
      {
        status: "draft",
      },
      "reopen"
    );
  }, [sendUpdate]);

  const handleExit = React.useCallback(() => {
    navigate("/my-team");
  }, [navigate]);

  if (state.status === "loading" || state.status === "idle") {
    return (
      <div className="rounded-md border border-border/60 bg-muted/40 px-4 py-16 text-center text-sm text-muted-foreground">
        Loading check-in…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-md border border-destructive/40 bg-destructive/10 px-6 py-12 text-center">
        <p className="text-sm text-destructive">{state.message}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadData()}>
            Try again
          </Button>
          <Button variant="ghost" onClick={handleExit}>
            Back to My Team
          </Button>
        </div>
      </div>
    );
  }

  const { checkIn, goals, isManager } = state;
  const completed = checkIn.status === "completed";
  const startedAt = parseISO(checkIn.createdAt);
  const completedAt = checkIn.completedAt ? parseISO(checkIn.completedAt) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Check-in workspace</h1>
            <p className="text-sm text-muted-foreground">
              Shared agenda for you and your teammate. Notes persist after completion so you can revisit conversations
              anytime.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleExit}>
              Back to My Team
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={saving || completing}>
              {saving ? "Saving…" : "Save agenda"}
            </Button>
            {completed ? (
              <Button variant="secondary" onClick={handleReopen} disabled={saving || completing}>
                Reopen draft
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={completing || saving}>
                {completing ? "Completing…" : "Complete check-in"}
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>
            Created{" "}
            {Number.isNaN(startedAt.getTime())
              ? "recently"
              : format(startedAt, "MMM d, yyyy 'at' h:mm a")}
          </span>
          {completedAt ? (
            <>
              <Separator orientation="vertical" className="h-4" />
              <span>Completed {format(completedAt, "MMM d, yyyy 'at' h:mm a")}</span>
            </>
          ) : null}
          <Separator orientation="vertical" className="h-4" />
          <span>Status: {completed ? "Completed" : "Draft"}</span>
        </div>
        {statusMessage ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600">
            {statusMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errorMessage}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="border border-border/60 bg-background">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Shared agenda</CardTitle>
            <p className="text-sm text-muted-foreground">
              Both the manager and employee can add notes here to prepare and follow up.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <AgendaSection
              label="Accomplishments"
              description="Wins, highlights, recognition since the last check-in."
              value={agendaDraft.accomplishments}
              onChange={(value) => handleAgendaFieldChange("accomplishments", value)}
              disabled={completing}
            />
            <AgendaSection
              label="Priorities"
              description="Focus items for the next sprint or two-week window."
              value={agendaDraft.priorities}
              onChange={(value) => handleAgendaFieldChange("priorities", value)}
              disabled={completing}
            />
            <AgendaSection
              label="Roadblocks"
              description="Any blockers the manager can help remove."
              value={agendaDraft.roadblocks}
              onChange={(value) => handleAgendaFieldChange("roadblocks", value)}
              disabled={completing}
            />
            {isManager ? (
              <div className="mt-2 flex flex-col gap-2 rounded-md border border-border/70 bg-muted/30 p-4">
                <div className="text-sm font-medium text-foreground">Private manager notes</div>
                <textarea
                  className="min-h-28 w-full resize-y rounded-md border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Capture follow-ups or sensitive notes visible only to you."
                  value={privateNote}
                  onChange={(event) => setPrivateNote(event.target.value)}
                  disabled={completing}
                />
                <p className="text-xs text-muted-foreground">
                  Private notes are visible only to the manager and tenant admins.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-background">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Active goals</CardTitle>
            <p className="text-sm text-muted-foreground">
              Quick snapshot of the employee&apos;s goals to provide context during the conversation.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {goals.length === 0 ? (
              <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
                No goals yet. Add one from the employee&apos;s Growth &amp; Goals tab.
              </div>
            ) : (
              goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type AgendaSectionProps = {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function AgendaSection({ label, description, value, onChange, disabled }: AgendaSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <textarea
        className="min-h-28 w-full resize-y rounded-md border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const dueDateLabel = React.useMemo(() => {
    if (!goal.dueDate) return "No due date";
    try {
      return format(parseISO(goal.dueDate), "MMM d, yyyy");
    } catch {
      return goal.dueDate;
    }
  }, [goal.dueDate]);

  const statusLabel = React.useMemo(() => {
    switch (goal.status) {
      case "completed":
        return "Completed";
      case "in_progress":
        return "In progress";
      default:
        return "To do";
    }
  }, [goal.status]);

  const progress = Math.min(100, Math.max(0, goal.progressPct ?? 0));

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-foreground">{goal.title}</div>
          {goal.description ? (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{goal.description}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {statusLabel}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-xs text-muted-foreground">Progress</div>
        <div className="relative h-2 w-full rounded-full bg-muted">
          <div
            className="absolute left-0 top-0 h-2 rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress)}%</span>
          <span>{dueDateLabel}</span>
        </div>
      </div>
    </div>
  );
}
