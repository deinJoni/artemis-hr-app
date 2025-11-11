import * as React from "react";
import type { Route } from "./+types/journeys.$shareToken";
import { useRevalidator } from "react-router";
import { supabase } from "~/lib/supabase";
import { TaskListResponseSchema, type Task } from "@vibe/shared";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export async function loader({ params }: Route.LoaderArgs) {
  const { shareToken } = params;
  const baseUrl =
    (import.meta as any).env?.VITE_BACKEND_URL ??
    (typeof process !== "undefined"
      ? ((process.env?.VITE_BACKEND_URL as string | undefined) ?? undefined)
      : undefined) ??
    "http://localhost:8787";

  // Get journey view by share token
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Get employee journey view
  const journeyRes = await fetch(`${baseUrl}/api/journeys/${shareToken}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!journeyRes.ok) {
    throw new Response("Journey not found", { status: 404 });
  }

  const journeyData = await journeyRes.json();

  // Get tasks for this journey
  const tasksRes = await fetch(
    `${baseUrl}/api/onboarding/tasks/${journeyData.employeeId}?tenantId=${journeyData.tenantId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  let tasks: Task[] = [];
  if (tasksRes.ok) {
    const tasksData = await tasksRes.json();
    const parsed = TaskListResponseSchema.safeParse(tasksData);
    if (parsed.success) {
      tasks = parsed.data.tasks;
    }
  }

  return {
    baseUrl,
    journey: journeyData,
    tasks,
    employee: journeyData.employee,
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Your Onboarding Journey | Artemis" },
    {
      name: "description",
      content: "Complete your onboarding tasks and get started.",
    },
  ];
}

export default function Journey({ loaderData }: Route.ComponentProps) {
  const { baseUrl, journey, tasks, employee } = loaderData ?? {
    baseUrl: "http://localhost:8787",
    journey: null,
    tasks: [],
    employee: null,
  };
  const revalidator = useRevalidator();
  const [completingTaskId, setCompletingTaskId] = React.useState<string | null>(null);

  const completedTasks = tasks.filter((t) => t.status === "completed");
  const pendingTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "waiting_input" || t.status === "in_progress"
  );
  const progressPercentage =
    tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const handleCompleteTask = async (taskId: string) => {
    setCompletingTaskId(taskId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(`${baseUrl}/api/onboarding/tasks/${taskId}/complete`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to complete task");
      }

      revalidator.revalidate();
    } catch (error) {
      console.error("Error completing task:", error);
      alert(error instanceof Error ? error.message : "Failed to complete task");
    } finally {
      setCompletingTaskId(null);
    }
  };

  if (!journey) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Journey not found</h1>
          <p className="mt-2 text-muted-foreground">
            This onboarding journey link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            {journey.hero_copy || `Welcome, ${employee?.name || "there"}!`}
          </h1>
          <p className="text-lg text-muted-foreground">
            {journey.description ||
              "You're starting your journey with us. Let's get you set up!"}
          </p>
        </div>

        {/* Progress Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Your Progress</CardTitle>
            <CardDescription>
              {completedTasks.length} of {tasks.length} tasks completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={progressPercentage} className="h-3" />
              <div className="text-center text-2xl font-semibold">
                {progressPercentage}%
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Section */}
        {tasks.length > 0 ? (
          <div className="space-y-4">
            {pendingTasks.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Your Tasks</h2>
                <div className="space-y-3">
                  {pendingTasks.map((task) => {
                    const payload = task.payload as {
                      title?: string;
                      description?: string;
                      instructions?: string;
                    } | null;
                    const title = payload?.title || "Complete task";
                    const isCompleting = completingTaskId === task.id;

                    return (
                      <Card key={task.id} className="border-l-4 border-l-primary">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg flex items-center gap-2">
                                <Circle className="h-5 w-5 text-muted-foreground" />
                                {title}
                              </CardTitle>
                              {payload?.description && (
                                <CardDescription className="mt-2">
                                  {payload.description}
                                </CardDescription>
                              )}
                              {payload?.instructions && (
                                <div className="mt-2 text-sm text-muted-foreground">
                                  <strong>Instructions:</strong> {payload.instructions}
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleCompleteTask(task.id)}
                              disabled={isCompleting}
                            >
                              {isCompleting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Mark Complete"
                              )}
                            </Button>
                          </div>
                        </CardHeader>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {completedTasks.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Completed Tasks</h2>
                <div className="space-y-3">
                  {completedTasks.map((task) => {
                    const payload = task.payload as { title?: string } | null;
                    const title = payload?.title || "Task completed";

                    return (
                      <Card key={task.id} className="opacity-75">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="line-through">{title}</span>
                          </CardTitle>
                          {task.completed_at && (
                            <CardDescription>
                              Completed{" "}
                              {new Date(task.completed_at).toLocaleDateString()}
                            </CardDescription>
                          )}
                        </CardHeader>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No tasks assigned yet. Check back soon!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
