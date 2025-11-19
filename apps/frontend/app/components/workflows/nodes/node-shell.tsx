import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { NodeTone, WorkflowNodeBadge, WorkflowNodeData, WorkflowNodeStatus } from "./types";

const TONE_STYLES: Record<
  NodeTone,
  {
    border: string;
    icon: string;
    badge: string;
    configuredPill: string;
  }
> = {
  primary: {
    border: "border-primary/40",
    icon: "bg-primary/10 text-primary",
    badge: "bg-primary/10 text-primary",
    configuredPill: "bg-primary/10 text-primary",
  },
  success: {
    border: "border-emerald-500/30",
    icon: "bg-emerald-500/10 text-emerald-600",
    badge: "bg-emerald-500/10 text-emerald-600",
    configuredPill: "bg-emerald-500/10 text-emerald-600",
  },
  warning: {
    border: "border-amber-500/40",
    icon: "bg-amber-500/10 text-amber-600",
    badge: "bg-amber-500/10 text-amber-700",
    configuredPill: "bg-amber-500/10 text-amber-700",
  },
  muted: {
    border: "border-border/70",
    icon: "bg-muted/70 text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
    configuredPill: "bg-muted/80 text-muted-foreground",
  },
  purple: {
    border: "border-purple-500/40",
    icon: "bg-purple-500/10 text-purple-600",
    badge: "bg-purple-500/10 text-purple-600",
    configuredPill: "bg-purple-500/10 text-purple-600",
  },
};

const STATUS_COLORS: Record<WorkflowNodeStatus, string> = {
  default: "bg-muted-foreground/40",
  warning: "bg-amber-500",
  error: "bg-destructive",
};

type NodeShellProps = {
  data: WorkflowNodeData;
  tone: NodeTone;
  fallbackIcon: LucideIcon;
  children?: React.ReactNode;
  selected?: boolean;
};

export function NodeShell({ data, tone, fallbackIcon: FallbackIcon, children, selected = false }: NodeShellProps) {
  const toneClasses = TONE_STYLES[tone];
  const Icon = data.icon ?? FallbackIcon;

  return (
    <div
      className={cn(
        "group/node relative flex min-w-[220px] max-w-[320px] flex-col gap-3 rounded-2xl border bg-background p-4 text-left shadow-sm transition-all duration-200",
        selected ? "border-primary shadow-lg" : toneClasses.border,
      )}
      data-selected={selected}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 shadow-sm",
            toneClasses.icon,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{data.label}</p>
            {data.isConfigured ? (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", toneClasses.configuredPill)}>
                Configured
              </span>
            ) : null}
          </div>
          {data.description ? (
            <p className="text-xs text-muted-foreground line-clamp-2">{data.description}</p>
          ) : null}
          {data.badges?.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {data.badges.map((badge, index) => (
                <WorkflowBadge key={`${badge.label}-${index}`} badge={badge} toneClasses={toneClasses} />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {children}

      {data.summary ? (
        <div className="mt-auto rounded-xl border border-dashed border-border/60 bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
          {data.summary}
        </div>
      ) : null}

      <StatusIndicator status={data.status ?? "default"} />
    </div>
  );
}

type WorkflowBadgeProps = {
  badge: WorkflowNodeBadge;
  toneClasses: (typeof TONE_STYLES)[NodeTone];
};

function WorkflowBadge({ badge, toneClasses }: WorkflowBadgeProps) {
  if (badge.tone === "warning") {
    return <Badge variant="secondary" className="bg-amber-500/10 text-amber-700">{badge.label}</Badge>;
  }
  if (badge.tone === "success") {
    return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700">{badge.label}</Badge>;
  }
  if (badge.tone === "muted") {
    return <Badge variant="outline" className="border-border/40 text-muted-foreground">{badge.label}</Badge>;
  }
  return (
    <Badge
      variant="secondary"
      className={cn("border border-transparent text-[10px] uppercase tracking-wide", toneClasses.badge)}
    >
      {badge.label}
    </Badge>
  );
}

function StatusIndicator({ status }: { status: WorkflowNodeStatus }) {
  return (
    <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", STATUS_COLORS[status] ?? STATUS_COLORS.default)} />
      <span>{status === "default" ? "Ready" : status === "warning" ? "Warning" : "Error"}</span>
    </div>
  );
}

