import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";
import { GitBranch } from "lucide-react";

import { NodeShell } from "./node-shell";
import type { WorkflowNodeData } from "./types";
import { cn } from "~/lib/utils";

const handleClass = "h-3 w-3 rounded-full border-2 border-background bg-purple-500 shadow";

export function LogicNode(props: NodeProps<WorkflowNodeData>) {
  const { data, selected } = props;
  const metadata = (data.metadata ?? {}) as { branches?: Record<string, string>; expression?: string };
  const branches = metadata.branches ?? {};

  return (
    <div className="relative">
      <NodeShell data={data} tone="purple" fallbackIcon={GitBranch} selected={selected}>
        {metadata.expression ? (
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-[11px] text-purple-900">
            {metadata.expression}
          </div>
        ) : null}
        {Object.keys(branches).length ? (
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-purple-900">
            {Object.entries(branches).map(([label, description]) => (
              <div key={label} className="rounded-lg border border-purple-500/20 bg-background/80 px-2 py-1">
                <div className="font-semibold uppercase tracking-wide text-purple-600">{label}</div>
                <div className="text-purple-900/70">{description}</div>
              </div>
            ))}
          </div>
        ) : null}
      </NodeShell>
      <Handle type="target" position={Position.Top} className={cn(handleClass, "left-1/2 -translate-x-1/2")} />
      <Handle
        id="logic-yes"
        type="source"
        position={Position.Bottom}
        className={cn(handleClass, "left-[30%] -translate-x-1/2")}
      />
      <Handle
        id="logic-no"
        type="source"
        position={Position.Bottom}
        className={cn(handleClass, "left-[70%] -translate-x-1/2")}
      />
    </div>
  );
}

