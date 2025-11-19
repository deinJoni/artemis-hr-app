import type { NodeTypes } from "reactflow";

import { ActionNode } from "./ActionNode";
import { DelayNode } from "./DelayNode";
import { LogicNode } from "./LogicNode";
import { TriggerNode } from "./TriggerNode";

export { ActionNode } from "./ActionNode";
export { DelayNode } from "./DelayNode";
export { LogicNode } from "./LogicNode";
export { TriggerNode } from "./TriggerNode";
export * from "./types";

export const workflowNodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  delay: DelayNode,
  logic: LogicNode,
};

