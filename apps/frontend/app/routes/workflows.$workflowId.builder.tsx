import * as React from "react";
import type { Route } from "./+types/workflows.$workflowId.builder";
import { useNavigate, useRevalidator } from "react-router";
import { supabase } from "~/lib/supabase";
import { WorkflowDetailResponseSchema } from "@vibe/shared";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Save, Play, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

export async function loader({ params }: Route.LoaderArgs) {
  const { workflowId } = params;
  const baseUrl =
    (import.meta as any).env?.VITE_BACKEND_URL ??
    (typeof process !== "undefined"
      ? ((process.env?.VITE_BACKEND_URL as string | undefined) ?? undefined)
      : undefined) ??
    "http://localhost:8787";

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Get tenant ID
  const tenantRes = await fetch(`${baseUrl}/api/tenants/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!tenantRes.ok) {
    throw new Response("Unable to resolve tenant", { status: 400 });
  }

  const tenantData = await tenantRes.json();
  const tenantId = tenantData.id;

  // Get workflow detail
  const workflowRes = await fetch(`${baseUrl}/api/workflows/${tenantId}/${workflowId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!workflowRes.ok) {
    throw new Response("Workflow not found", { status: 404 });
  }

  const workflowData = await workflowRes.json();
  const parsed = WorkflowDetailResponseSchema.safeParse(workflowData);

  if (!parsed.success) {
    throw new Response("Invalid workflow data", { status: 500 });
  }

  return {
    baseUrl,
    tenantId,
    workflow: parsed.data.workflow,
    versions: parsed.data.versions,
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Workflow Builder | Artemis" },
    {
      name: "description",
      content: "Build and configure workflow automation.",
    },
  ];
}

export default function WorkflowBuilder({ loaderData }: Route.ComponentProps) {
  const { baseUrl, tenantId, workflow } = loaderData ?? {
    baseUrl: "http://localhost:8787",
    tenantId: "",
    workflow: null,
  };
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [workflowName, setWorkflowName] = React.useState(workflow?.name || "");
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(`${baseUrl}/api/workflows/${tenantId}/${workflow.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: workflowName,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save workflow");
      }

      setMessage({ type: "success", text: "Workflow saved successfully" });
      setTimeout(() => setMessage(null), 3000);
      revalidator.revalidate();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to save workflow" });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(`${baseUrl}/api/workflows/${tenantId}/${workflow.id}/publish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to publish workflow");
      }

      setMessage({ type: "success", text: "Workflow published successfully" });
      setTimeout(() => {
        revalidator.revalidate();
        navigate(`/workflows`);
      }, 1000);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to publish workflow" });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsPublishing(false);
    }
  };

  if (!workflow) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Workflow not found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Message Banner */}
      {message && (
        <div
          className={cn(
            "rounded-md border px-4 py-3 text-sm",
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/workflows")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Workflow Builder</h1>
            <p className="text-muted-foreground">
              {workflow.status === "published" ? "Published" : "Draft"} workflow
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Draft
          </Button>
          {workflow.status !== "published" && (
            <Button onClick={handlePublish} disabled={isPublishing}>
              {isPublishing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Publish
            </Button>
          )}
        </div>
      </div>

      {/* Workflow Details */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Details</CardTitle>
          <CardDescription>Configure basic workflow information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workflow-name">Name</Label>
            <Input
              id="workflow-name"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Enter workflow name"
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="text-sm text-muted-foreground capitalize">
              {workflow.kind}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="text-sm text-muted-foreground capitalize">
              {workflow.status}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Builder Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Canvas</CardTitle>
          <CardDescription>
            Visual workflow builder coming soon. For now, workflows are created from templates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-12 text-center">
            <p className="text-muted-foreground">
              The visual workflow builder with drag-and-drop canvas will be available in a future update.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Current workflows are created from templates and can be published directly.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
