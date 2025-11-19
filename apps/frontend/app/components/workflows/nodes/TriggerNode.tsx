import * as React from "react";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";
import { Zap } from "lucide-react";

import { NodeShell } from "./node-shell";
import type { WorkflowNodeData } from "./types";
import { cn } from "~/lib/utils";

const handleClass = "h-3 w-3 rounded-full border-2 border-background bg-primary shadow";

export function TriggerNode(props: NodeProps<WorkflowNodeData>) {
  const { data, selected } = props;
  const metadata = (data.metadata ?? {}) as { conditions?: unknown };
  const conditions = Array.isArray(metadata.conditions)
    ? metadata.conditions.filter((item): item is string => typeof item === "string")
    : [];

  return (
    <div className="relative">
      <NodeShell data={data} tone="primary" fallbackIcon={Zap} selected={selected}>
        {conditions.length ? (
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {conditions.slice(0, 3).map((condition, index) => (
              <li key={`${condition}-${index}`} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                <span className="line-clamp-1">{condition}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </NodeShell>

      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(handleClass, "left-1/2 -translate-x-1/2")}
      />
    </div>
  );
}

