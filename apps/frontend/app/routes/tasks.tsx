import * as React from "react";
import type { Route } from "./+types/tasks";
import { supabase } from "~/lib/supabase";
import type { Task } from "@vibe/shared";
import { TaskListResponseSchema } from "@vibe/shared";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Loader2, ListChecks, RefreshCcw, UploadCloud, FileText, CheckCircle2 } from "lucide-react";
import { useToast } from "~/components/toast";
import { DocumentTaskDialog } from "~/components/tasks/document-task-dialog";
import { FormTaskDialog } from "~/components/tasks/form-task-dialog";
import { cn } from "~/lib/utils";

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
    { title: "Tasks & Checklists | Artemis" },
    {
      name: "description",
      content: "Track onboarding and workflow tasks across your workspace.",
    },
  ];
}

type TaskView = "all" | "mine" | "documents" | "forms" | "completed";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; tasks: Task[] };

const VIEW_FILTERS: Array<{ key: TaskView; label: string; description: string }> = [
  { key: "all", label: "Active tasks", description: "Open items for every workflow" },
  { key: "mine", label: "Assigned to me", description: "Items assigned directly to you" },
  { key: "documents", label: "Documents", description: "Upload requested paperwork" },
  { key: "forms", label: "Forms", description: "Complete outstanding forms" },
  { key: "completed", label: "Recently completed", description: "Audit the latest completions" },
];

type AuthContext = {
  token: string;
  tenantId: string;
  userId: string;
};

export default function TasksRoute({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const { showToast } = useToast();

  const [state, setState] = React.useState<LoadState>({ status: "idle" });
  const [view, setView] = React.useState<TaskView>("all");
  const [authContext, setAuthContext] = React.useState<AuthContext | null>(null);
  const [docTask, setDocTask] = React.useState<Task | null>(null);
  const [formTask, setFormTask] = React.useState<Task | null>(null);
  const [completingTaskId, setCompletingTaskId] = React.useState<string | null>(null);

  const ensureAuthContext = React.useCallback(async (): Promise<AuthContext> => {
    if (authContext) return authContext;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      throw new Error("Missing access token");
    }

    const tenantRes = await fetch(`${baseUrl}/api/tenants/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const tenantJson = await tenantRes.json();
    if (!tenantRes.ok || typeof tenantJson?.id !== "string") {
      throw new Error("Unable to resolve tenant");
    }

    const ctx: AuthContext = {
      token,
      tenantId: tenantJson.id,
      userId: data.session?.user?.id ?? "",
    };
    setAuthContext(ctx);
    return ctx;
  }, [authContext, baseUrl]);

  const buildQueryForView = React.useCallback(
    (ctx: AuthContext, selectedView: TaskView) => {
      const params = new URLSearchParams({ tenantId: ctx.tenantId });
      const openStatuses = ["pending", "waiting_input", "in_progress"].join(",");

      switch (selectedView) {
        case "mine":
          if (ctx.userId) {
            params.set("assignedToId", ctx.userId);
          }
          params.set("status", openStatuses);
          break;
        case "documents":
          params.set("taskType", "document");
          params.set("status", openStatuses);
          break;
        case "forms":
          params.set("taskType", "form");
          params.set("status", openStatuses);
          break;
        case "completed":
          params.set("status", "completed");
          break;
        case "all":
        default:
          params.set("status", openStatuses);
          break;
      }

      return params;
    },
    [],
  );

  const loadTasks = React.useCallback(
    async (options?: { view?: TaskView }) => {
      setState({ status: "loading" });
      try {
        const ctx = await ensureAuthContext();
        const activeView = options?.view ?? view;
        const params = buildQueryForView(ctx, activeView);

        const response = await fetch(`${baseUrl}/api/tasks?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${ctx.token}`,
          },
        });

        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((json as { error?: string }).error || "Unable to load tasks");
        }

        const parsed = TaskListResponseSchema.safeParse(json);
        if (!parsed.success) {
          throw new Error("Unexpected tasks response shape");
        }

        setState({ status: "ready", tasks: parsed.data.tasks });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load tasks";
        setState({ status: "error", message });
        showToast(message, "error");
      }
    },
    [baseUrl, buildQueryForView, ensureAuthContext, showToast, view],
  );

  React.useEffect(() => {
    void loadTasks();
  }, [loadTasks, view]);

  const handleFilterChange = (nextView: TaskView) => {
    setView(nextView);
    void loadTasks({ view: nextView });
  };

  const handleComplete = async (taskId: string) => {
    setCompletingTaskId(taskId);
    try {
      const ctx = await ensureAuthContext();
      const response = await fetch(`${baseUrl}/api/tasks/${taskId}/complete`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((json as { error?: string }).error || "Unable to complete task");
      }
      showToast("Task completed", "success");
      await loadTasks();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to complete task";
      showToast(message, "error");
    } finally {
      setCompletingTaskId(null);
    }
  };

  const tasks = state.status === "ready" ? state.tasks : [];
  const openCount = tasks.filter((task) => task.status !== "completed").length;
  const completedCount = tasks.filter((task) => task.status === "completed").length;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Tasks & Checklists</h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Monitor workflow tasks for onboarding, offboarding, and automation. Upload documents,
            complete forms, and keep your queue clear.
          </p>
        </div>
        <Button variant="outline" onClick={() => loadTasks()} disabled={state.status === "loading"}>
          {state.status === "loading" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Open items" value={openCount} icon={ListChecks} />
        <SummaryCard label="Completed" value={completedCount} icon={CheckCircle2} />
        <SummaryCard label="Documents" value={tasks.filter((t) => t.task_type === "document").length} icon={UploadCloud} />
        <SummaryCard label="Forms" value={tasks.filter((t) => t.task_type === "form").length} icon={FileText} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {VIEW_FILTERS.map((filter) => (
          <button
            key={filter.key}
            className={cn(
              "rounded-lg border p-4 text-left transition-colors",
              view === filter.key
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40",
            )}
            onClick={() => handleFilterChange(filter.key)}
          >
            <div className="font-semibold">{filter.label}</div>
            <div className="text-sm text-muted-foreground">{filter.description}</div>
          </button>
        ))}
      </div>

      {state.status === "loading" ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 px-6 py-20 text-muted-foreground">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Loading tasks…
        </div>
      ) : state.status === "error" ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.message}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 px-6 py-20 text-muted-foreground">
          No tasks found for this view.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              completingTaskId={completingTaskId}
              onComplete={handleComplete}
              onDocument={setDocTask}
              onForm={setFormTask}
            />
          ))}
        </div>
      )}

      <DocumentTaskDialog
        task={docTask}
        apiBaseUrl={baseUrl}
        open={Boolean(docTask)}
        onOpenChange={(open) => {
          if (!open) setDocTask(null);
        }}
        onSuccess={() => {
          setDocTask(null);
          void loadTasks();
        }}
      />

      <FormTaskDialog
        task={formTask}
        apiBaseUrl={baseUrl}
        open={Boolean(formTask)}
        onOpenChange={(open) => {
          if (!open) setFormTask(null);
        }}
        onSuccess={() => {
          setFormTask(null);
          void loadTasks();
        }}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function TaskCard({
  task,
  completingTaskId,
  onComplete,
  onDocument,
  onForm,
}: {
  task: Task;
  completingTaskId: string | null;
  onComplete: (taskId: string) => void;
  onDocument: (task: Task) => void;
  onForm: (task: Task) => void;
}) {
  const isCompleted = task.status === "completed";
  const isDocument = task.task_type === "document";
  const isForm = task.task_type === "form";

  const payload = (task.payload ?? null) as Record<string, unknown> | null;
  const instructions =
    payload && typeof payload.instructions === "string"
      ? (payload.instructions as string)
      : null;

  const dueLabel = task.due_at ? formatRelativeTime(task.due_at) : "No due date";

  return (
    <Card className={cn(isCompleted ? "opacity-70" : undefined)}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          {task.payload && typeof task.payload === "object" && "title" in task.payload
            ? ((task.payload as Record<string, unknown>).title as string)
            : "Workflow task"}
          <Badge variant={isCompleted ? "secondary" : "outline"}>
            {isCompleted ? "Completed" : "Open"}
          </Badge>
          <Badge>{task.task_type}</Badge>
        </CardTitle>
        <CardDescription>
          Due {dueLabel} • {task.status}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {instructions ? (
          <p className="text-sm text-muted-foreground">{instructions}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {isDocument ? (
            <Button
              onClick={() => onDocument(task)}
              variant="default"
              className="inline-flex items-center gap-2"
            >
              <UploadCloud className="h-4 w-4" />
              Upload document
            </Button>
          ) : isForm ? (
            <Button
              onClick={() => onForm(task)}
              variant="default"
              className="inline-flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Fill form
            </Button>
          ) : (
            <Button
              onClick={() => onComplete(task.id)}
              disabled={isCompleted || completingTaskId === task.id}
              className="inline-flex items-center gap-2"
            >
              {completingTaskId === task.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ListChecks className="h-4 w-4" />
              )}
              Mark complete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "No due date";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }
  return formatter.format(diffDays, "day");
}


