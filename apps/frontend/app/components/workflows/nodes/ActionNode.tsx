import * as React from "react";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";
import { Workflow } from "lucide-react";

import { NodeShell } from "./node-shell";
import type { WorkflowNodeData } from "./types";
import { cn } from "~/lib/utils";

const inputHandleClass = "h-3 w-3 rounded-full border-2 border-background bg-emerald-500 shadow";
const outputHandleClass = "h-3 w-3 rounded-full border-2 border-background bg-emerald-500 shadow";

export function ActionNode(props: NodeProps<WorkflowNodeData>) {
  const { data, selected } = props;
  const metadata = (data.metadata ?? {}) as { steps?: unknown };
  const steps = Array.isArray(metadata.steps)
    ? metadata.steps.filter((item): item is string => typeof item === "string")
    : [];

  return (
    <div className="relative">
      <NodeShell data={data} tone="success" fallbackIcon={Workflow} selected={selected}>
        {steps.length ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            {steps.slice(0, 2).map((step, index) => (
              <div
                key={`${step}-${index}`}
                className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[11px] text-emerald-900"
              >
                {step}
              </div>
            ))}
            {steps.length > 2 ? (
              <p className="text-[11px] text-muted-foreground">+{steps.length - 2} more actions</p>
            ) : null}
          </div>
        ) : null}
      </NodeShell>
      <Handle type="target" position={Position.Top} className={cn(inputHandleClass, "left-1/2 -translate-x-1/2")} />
      <Handle type="source" position={Position.Bottom} className={cn(outputHandleClass, "left-1/2 -translate-x-1/2")} />
    </div>
  );
}

