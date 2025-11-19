import * as React from "react";
import type { Route } from "./+types/employees.$employeeId.growth";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { supabase } from "~/lib/supabase";
import type { Goal, CheckInHistoryItem } from "@vibe/shared";
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
    { title: "Growth & Goals | Artemis" },
    { name: "description", content: `Growth workspace for employee ${params.employeeId}` },
  ];
}

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; goals: Goal[]; history: CheckInHistoryItem[]; tenantId: string }
  | { status: "error"; message: string };

type GoalEditorState =
  | { mode: "create"; open: boolean }
  | { mode: "edit"; open: boolean; goal: Goal };

type GoalFormData = {
  title: string;
  description: string;
  dueDate: string;
  progressPct: number;
  status: Goal["status"];
};

const DEFAULT_FORM: GoalFormData = {
  title: "",
  description: "",
  dueDate: "",
  progressPct: 0,
  status: "todo",
};

const STATUS_COLUMNS: Array<{ id: Goal["status"]; title: string; description: string }> = [
  { id: "todo", title: "To Do", description: "Ideas and commitments you plan to tackle." },
  { id: "in_progress", title: "In Progress", description: "Goals actively being worked on." },
  { id: "completed", title: "Completed", description: "Celebrate the wins and close the loop." },
];

export default function EmployeeGrowth({ loaderData, params }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);
  const employeeId = params.employeeId as string;
  const navigate = useNavigate();

  const [state, setState] = React.useState<FetchState>({ status: "idle" });
  const [goalEditor, setGoalEditor] = React.useState<GoalEditorState>({ mode: "create", open: false });
  const [goalForm, setGoalForm] = React.useState<GoalFormData>(DEFAULT_FORM);
  const [goalFormError, setGoalFormError] = React.useState<string | null>(null);
  const [draggingGoalId, setDraggingGoalId] = React.useState<string | null>(null);
  const [progressDrafts, setProgressDrafts] = React.useState<Record<string, number>>({});
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setState({ status: "loading" });
    setErrorMessage(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (!token) throw new Error("Missing access token");

      const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tenantJson = (await tenantRes.json()) as { id?: string };
      if (!tenantRes.ok || typeof tenantJson.id !== "string") throw new Error("Unable to resolve tenant");

      const goalsRes = await fetch(`${apiBaseUrl}/api/my-team/${employeeId}/goals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const goalsJson = (await goalsRes.json()) as { goals?: Goal[]; error?: string };
      if (!goalsRes.ok || !Array.isArray(goalsJson.goals)) {
        throw new Error(goalsJson.error || "Unable to load goals");
      }

      const historyRes = await fetch(`${apiBaseUrl}/api/check-ins/${employeeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const historyJson = (await historyRes.json()) as { items?: CheckInHistoryItem[]; error?: string };
      if (!historyRes.ok || !Array.isArray(historyJson.items)) {
        throw new Error(historyJson.error || "Unable to load check-in history");
      }

      setState({
        status: "ready",
        goals: goalsJson.goals,
        history: historyJson.items,
        tenantId: tenantJson.id,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to load goals";
      setState({ status: "error", message });
    }
  }, [apiBaseUrl, employeeId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateGoal = React.useCallback(() => {
    setGoalForm(DEFAULT_FORM);
    setGoalEditor({ mode: "create", open: true });
  }, []);

  const openEditGoal = React.useCallback((goal: Goal) => {
    setGoalForm({
      title: goal.title,
      description: goal.description ?? "",
      dueDate: goal.dueDate ?? "",
      progressPct: goal.progressPct ?? 0,
      status: goal.status,
    });
    setGoalEditor({ mode: "edit", goal, open: true });
  }, []);

  const closeGoalEditor = React.useCallback(() => {
    setGoalEditor((prev) => ({ ...prev, open: false }));
    setGoalFormError(null);
  }, []);

  const handleGoalFormChange = React.useCallback(
    (field: keyof GoalFormData, value: string | number) => {
      setGoalForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const saveGoal = React.useCallback(
    async (mode: "create" | "update") => {
      if (state.status !== "ready") return;
      setGoalFormError(null);
      setStatusMessage(null);
      try {
        if (!goalForm.title.trim()) {
          setGoalFormError("Title is required");
          return;
        }

        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");

        if (mode === "create") {
          const payload = {
            tenantId: state.tenantId,
            employeeId,
            title: goalForm.title.trim(),
            description: goalForm.description.trim() || null,
            dueDate: goalForm.dueDate ? new Date(goalForm.dueDate).toISOString().slice(0, 10) : null,
            progressPct: goalForm.progressPct,
            status: goalForm.status,
          };

          const res = await fetch(`${apiBaseUrl}/api/goals`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          const json = await res.json().catch(() => ({}));
          if (!res.ok || typeof json?.id !== "string") {
            throw new Error((json as { error?: string }).error || "Unable to create goal");
          }

          setState((prevState) =>
            prevState.status !== "ready"
              ? prevState
              : {
                  ...prevState,
                  goals: [...prevState.goals, json as Goal],
                }
          );
          setStatusMessage("Goal added successfully.");
        } else if (goalEditor.mode === "edit" && goalEditor.goal) {
          const payload = {
            tenantId: state.tenantId,
            goalId: goalEditor.goal.id,
            title: goalForm.title.trim(),
            description: goalForm.description.trim() || null,
            dueDate: goalForm.dueDate ? new Date(goalForm.dueDate).toISOString().slice(0, 10) : null,
            progressPct: goalForm.progressPct,
            status: goalForm.status,
          };

          const res = await fetch(`${apiBaseUrl}/api/goals/${goalEditor.goal.id}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          const json = await res.json().catch(() => ({}));
          if (!res.ok || typeof json?.id !== "string") {
            throw new Error((json as { error?: string }).error || "Unable to update goal");
          }

          setState((prevState) =>
            prevState.status !== "ready"
              ? prevState
              : {
                  ...prevState,
                  goals: prevState.goals.map((goal) => (goal.id === json.id ? (json as Goal) : goal)),
                }
          );
          setStatusMessage("Goal updated successfully.");
        }

        closeGoalEditor();
      } catch (error: unknown) {
        setGoalFormError(error instanceof Error ? error.message : "Unable to save goal");
      }
    },
    [apiBaseUrl, closeGoalEditor, employeeId, goalEditor, goalForm, state]
  );

  const deleteGoal = React.useCallback(
    async (goalId: string) => {
      if (state.status !== "ready") return;
      setErrorMessage(null);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");

        const res = await fetch(`${apiBaseUrl}/api/goals/${goalId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok && res.status !== 204) {
          const payload = await res.json().catch(() => ({}));
          throw new Error((payload as { error?: string }).error || "Unable to delete goal");
        }

        setState((prevState) =>
          prevState.status !== "ready"
            ? prevState
            : {
                ...prevState,
                goals: prevState.goals.filter((goal) => goal.id !== goalId),
              }
        );
        setStatusMessage("Goal removed.");
      } catch (error: unknown) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to delete goal");
      }
    },
    [apiBaseUrl, state]
  );

  const updateGoalPartial = React.useCallback(
    async (goalId: string, updates: Partial<Goal>, successMessage: string) => {
      if (state.status !== "ready") return;
      setStatusMessage(null);
      setErrorMessage(null);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");

        const payload = {
          tenantId: state.tenantId,
          goalId,
          ...updates,
        };

        const res = await fetch(`${apiBaseUrl}/api/goals/${goalId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || typeof json?.id !== "string") {
          throw new Error((json as { error?: string }).error || "Unable to update goal");
        }

        setState((prevState) =>
          prevState.status !== "ready"
            ? prevState
            : {
                ...prevState,
                goals: prevState.goals.map((goal) => (goal.id === json.id ? (json as Goal) : goal)),
              }
        );
        setStatusMessage(successMessage);
      } catch (error: unknown) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to update goal");
      }
    },
    [apiBaseUrl, state]
  );

  const handleDrop = React.useCallback(
    (status: Goal["status"]) => {
      if (!draggingGoalId) return;
      void updateGoalPartial(draggingGoalId, { status }, "Goal status updated.");
      setDraggingGoalId(null);
    },
    [draggingGoalId, updateGoalPartial]
  );

  const setProgressDraft = React.useCallback((goalId: string, value: number) => {
    setProgressDrafts((prev) => ({ ...prev, [goalId]: value }));
  }, []);

  const commitProgress = React.useCallback(
    (goalId: string, value: number) => {
      void updateGoalPartial(goalId, { progressPct: value }, "Progress updated.");
    },
    [updateGoalPartial]
  );

  if (state.status === "loading" || state.status === "idle") {
    return (
      <div className="rounded-md border border-border/60 bg-muted/40 px-4 py-16 text-center text-sm text-muted-foreground">
        Loading Growth &amp; Goals…
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
          <Button variant="ghost" onClick={() => navigate("/employees")}>
            Back to employees
          </Button>
        </div>
      </div>
    );
  }

  const { goals, history } = state;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Growth &amp; Goals</h1>
            <p className="text-sm text-muted-foreground">
              Track progress, celebrate wins, and keep goals aligned with business priorities.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadData()}>
              Refresh
            </Button>
            <Button onClick={openCreateGoal}>Add a new goal</Button>
          </div>
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

      <div className="grid gap-4 lg:grid-cols-3">
        {STATUS_COLUMNS.map((column) => {
          const columnGoals = goals.filter((goal) => goal.status === column.id);
          return (
            <div
              key={column.id}
              className="flex min-h-[280px] flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-4"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const goalId = event.dataTransfer.getData("text/plain") || draggingGoalId;
                if (goalId) {
                  setDraggingGoalId(goalId);
                  handleDrop(column.id);
                }
              }}
            >
              <div>
                <div className="text-sm font-medium text-foreground">{column.title}</div>
                <p className="text-xs text-muted-foreground">{column.description}</p>
              </div>
              <Separator />
              {columnGoals.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border/60 bg-background/70 px-3 py-6 text-center text-xs text-muted-foreground">
                  Drag goals here to move them.
                </div>
              ) : (
                columnGoals.map((goal) => {
                  const draftValue = progressDrafts[goal.id];
                  const progress = draftValue ?? goal.progressPct ?? 0;
                  return (
                    <div
                      key={goal.id}
                      className="flex flex-col gap-3 rounded-md border border-border/60 bg-background p-4 shadow-sm"
                      draggable
                      onDragStart={(event) => {
                        setDraggingGoalId(goal.id);
                        event.dataTransfer.setData("text/plain", goal.id);
                      }}
                      onDragEnd={() => setDraggingGoalId(null)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-foreground">{goal.title}</div>
                          {goal.description ? (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{goal.description}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Button variant="link" size="sm" className="px-0" onClick={() => openEditGoal(goal)}>
                            Edit details
                          </Button>
                          <Button variant="ghost" size="sm" className="px-0 text-destructive" onClick={() => deleteGoal(goal.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-muted-foreground" htmlFor={`progress-${goal.id}`}>
                          Progress ({Math.round(progress)}%)
                        </label>
                        <input
                          id={`progress-${goal.id}`}
                          type="range"
                          min={0}
                          max={100}
                          value={progress}
                          onChange={(event) => setProgressDraft(goal.id, Number(event.target.value))}
                          onMouseUp={(event) => commitProgress(goal.id, Number(event.currentTarget.value))}
                          onTouchEnd={(event) => commitProgress(goal.id, Number((event.currentTarget as HTMLInputElement).value))}
                        />
                        <div className="text-xs text-muted-foreground">
                          Due {goal.dueDate ? safeFormatDate(goal.dueDate) : "—"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      <Card className="border border-border/60 bg-background">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Check-in history</CardTitle>
          <p className="text-sm text-muted-foreground">
            A timeline of past check-ins keeps commitments and context at your fingertips.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {history.length === 0 ? (
            <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
              No check-ins yet. Start one from the My Team hub.
            </div>
          ) : (
            history.map((item) => (
              <div key={item.checkIn.id} className="rounded-md border border-border/60 bg-background px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-foreground">
                  <span>{safeFormatDate(item.checkIn.createdAt)}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {item.checkIn.status === "completed" ? "Completed" : "Draft"}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                  <div>
                    <div className="font-semibold text-foreground">Accomplishments</div>
                    <p>{item.agenda?.accomplishments || "—"}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Priorities</div>
                    <p>{item.agenda?.priorities || "—"}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Roadblocks</div>
                    <p>{item.agenda?.roadblocks || "—"}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {goalEditor.open ? (
        <GoalModal
          mode={goalEditor.mode}
          formData={goalForm}
          onFieldChange={handleGoalFormChange}
          onClose={closeGoalEditor}
          onSubmit={() => void saveGoal(goalEditor.mode === "create" ? "create" : "update")}
          error={goalFormError}
        />
      ) : null}
    </div>
  );
}

function safeFormatDate(value: string) {
  try {
    return format(parseISO(value), "MMM d, yyyy");
  } catch {
    return value;
  }
}

type GoalModalProps = {
  mode: "create" | "edit";
  formData: GoalFormData;
  onFieldChange: (field: keyof GoalFormData, value: string | number) => void;
  onClose: () => void;
  onSubmit: () => void;
  error: string | null;
};

function GoalModal({ mode, formData, onFieldChange, onClose, onSubmit, error }: GoalModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border/70 bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {mode === "create" ? "Create a goal" : "Edit goal"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Define clear outcomes and a target date to stay accountable.
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="flex flex-col gap-4 px-6 py-4">
          <label className="flex flex-col gap-1 text-sm text-foreground">
            Title
            <input
              type="text"
              value={formData.title}
              onChange={(event) => onFieldChange("title", event.target.value)}
              className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Launch customer onboarding playbook"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-foreground">
            Description
            <textarea
              value={formData.description}
              onChange={(event) => onFieldChange("description", event.target.value)}
              className="min-h-28 resize-y rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Add context, milestones, or what success looks like."
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-foreground">
              Due date
              <input
                type="date"
                value={formData.dueDate}
                onChange={(event) => onFieldChange("dueDate", event.target.value)}
                className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-foreground">
              Status
              <Select
                value={formData.status}
                onValueChange={(value) => onFieldChange("status", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To do</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-foreground">
            Progress ({formData.progressPct}%)
            <input
              type="range"
              min={0}
              max={100}
              value={formData.progressPct}
              onChange={(event) => onFieldChange("progressPct", Number(event.target.value))}
            />
          </label>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border/60 px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>{mode === "create" ? "Create goal" : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}
