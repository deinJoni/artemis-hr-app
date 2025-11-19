import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";
import { Hourglass } from "lucide-react";

import { NodeShell } from "./node-shell";
import type { WorkflowNodeData } from "./types";
import { cn } from "~/lib/utils";

const handleClass = "h-3 w-3 rounded-full border-2 border-background bg-amber-500 shadow";

export function DelayNode(props: NodeProps<WorkflowNodeData>) {
  const { data, selected } = props;
  const metadata = (data.metadata ?? {}) as { duration?: string; resume?: string };

  return (
    <div className="relative">
      <NodeShell data={data} tone="warning" fallbackIcon={Hourglass} selected={selected}>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900">
          <div>Wait for {metadata.duration ?? "configured duration"}</div>
          {metadata.resume ? <div className="text-amber-700/80">{metadata.resume}</div> : null}
        </div>
      </NodeShell>
      <Handle type="target" position={Position.Top} className={cn(handleClass, "left-1/2 -translate-x-1/2")} />
      <Handle type="source" position={Position.Bottom} className={cn(handleClass, "left-1/2 -translate-x-1/2")} />
    </div>
  );
}

