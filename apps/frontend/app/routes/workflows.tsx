import * as React from "react";
import type { Route } from "./+types/workflows";
import {
  WorkflowListResponseSchema,
  type WorkflowListItem,
  type WorkflowKind,
  type WorkflowStatus,
} from "@vibe/shared";
import { supabase } from "~/lib/supabase";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Loader2, Plus } from "lucide-react";

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
    { title: "Workflows | Artemis" },
    {
      name: "description",
      content:
        "Design onboarding and offboarding journeys with Artemis workflows.",
    },
  ];
}

type WorkflowsLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; workflows: WorkflowListItem[] };

const STATUS_LABELS: Record<WorkflowStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const STATUS_COLORS: Record<WorkflowStatus, string> = {
  draft: "bg-amber-100 text-amber-700",
  published: "bg-emerald-100 text-emerald-700",
  archived: "bg-muted text-muted-foreground",
};

const KIND_LABELS: Record<WorkflowKind, string> = {
  onboarding: "Onboarding",
  offboarding: "Offboarding",
};

export default function Workflows({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as {
    baseUrl: string;
  };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);

  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const [state, setState] = React.useState<WorkflowsLoadState>({
    status: "idle",
  });

  const resolveTenantId = React.useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      throw new Error("Missing access token");
    }
    const res = await fetch(`${apiBaseUrl}/api/tenants/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok || typeof json?.id !== "string") {
      throw new Error("Unable to resolve tenant");
    }
    return { token, tenantId: json.id as string };
  }, [apiBaseUrl]);

  const loadWorkflows = React.useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { token, tenantId: resolvedTenantId } = await resolveTenantId();
      setTenantId(resolvedTenantId);

      const res = await fetch(
        `${apiBaseUrl}/api/workflows/${resolvedTenantId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const json = await res.json();
      const parsed = WorkflowListResponseSchema.safeParse(json);
      if (!res.ok || !parsed.success) {
        throw new Error("Unable to load workflows");
      }
      setState({ status: "ready", workflows: parsed.data.workflows });
    } catch (error: unknown) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Unable to load workflows",
      });
    }
  }, [apiBaseUrl, resolveTenantId]);

  React.useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  const workflows =
    state.status === "ready" ? state.workflows : ([] as WorkflowListItem[]);

  const hasDrafts = workflows.some((workflow) => workflow.status === "draft");
  const hasPublished = workflows.some(
    (workflow) => workflow.status === "published"
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Workflows
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Automate onboarding and offboarding journeys with visual workflows.
            Templates are ready—connect actions, publish, and give employees a
            guided experience.
          </p>
        </div>
        <Button
          variant="default"
          className="inline-flex items-center gap-2"
          disabled
          title="Builder coming soon"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create workflow
        </Button>
      </div>

      {state.status === "loading" ? (
        <Placeholder message="Loading workflows..." showSpinner />
      ) : state.status === "error" ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </div>
      ) : workflows.length === 0 ? (
        <Placeholder message="No workflows yet. Templates will appear here once your workspace syncs." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((workflow) => (
            <WorkflowCard key={workflow.id} workflow={workflow} />
          ))}
        </div>
      )}

      <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-6 text-sm text-muted-foreground md:grid md:grid-cols-2 md:gap-6">
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">
            What&apos;s live
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Workflow domain schema, permissions, and seed templates</li>
            <li>API endpoints for listing, creating, updating, publishing</li>
            <li>Frontend list connected to live data</li>
          </ul>
        </div>
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">
            Coming soon
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Visual builder and template picker</li>
            <li>Workflow engine runtime and employee journeys</li>
            <li>Launch-ready onboarding/offboarding automation</li>
          </ul>
        </div>
      </div>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <div>
          {tenantId ? `Tenant: ${tenantId}` : "Resolving workspace access..."}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Drafts:{" "}
            <strong className="text-foreground">
              {hasDrafts ? "Yes" : "No"}
            </strong>
          </span>
          <span>
            Published:{" "}
            <strong className="text-foreground">
              {hasPublished ? "Yes" : "No"}
            </strong>
          </span>
        </div>
      </footer>
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: WorkflowListItem }) {
  const latest = workflow.latestVersion;
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="truncate">{workflow.name}</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_COLORS[workflow.status]}`}
          >
            {STATUS_LABELS[workflow.status]}
          </span>
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] uppercase tracking-wide text-secondary-foreground">
            {KIND_LABELS[workflow.kind]}
          </span>
          <span className="text-muted-foreground">
            Updated {formatRelativeTime(workflow.updated_at)}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Slug:{" "}
          <span className="font-medium text-foreground">{workflow.slug}</span>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div className="space-y-1">
            <dt className="uppercase tracking-wide opacity-70">Version</dt>
            <dd className="font-medium text-foreground">
              {latest ? `v${latest.version_number}` : "Not published"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="uppercase tracking-wide opacity-70">
              Published at
            </dt>
            <dd className="font-medium text-foreground">
              {latest?.published_at
                ? formatRelativeTime(latest.published_at)
                : "—"}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function Placeholder({
  message,
  showSpinner = false,
}: {
  message: string;
  showSpinner?: boolean;
}) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-6 py-16 text-sm text-muted-foreground">
      {showSpinner ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : null}
      <span>{message}</span>
    </div>
  );
}

function formatRelativeTime(iso: string) {
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
