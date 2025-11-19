import type { LucideIcon } from "lucide-react";
import type { WorkflowNodeType } from "@vibe/shared";

export type NodeTone = "primary" | "success" | "warning" | "muted" | "purple";

export type WorkflowNodeBadge = {
  label: string;
  tone?: "default" | "muted" | "warning" | "success";
};

export type WorkflowNodeStatus = "default" | "warning" | "error";

export type WorkflowNodeData = {
  /**
   * Display label shown inside the node card.
   */
  label: string;
  /**
   * Optional description or subtext.
   */
  description?: string;
  /**
   * Workflow node kind (trigger, action, delay, logic, etc).
   */
  kind?: WorkflowNodeType | string;
  /**
   * Optional icon rendered in the node header.
   */
  icon?: LucideIcon;
  /**
   * Node configuration payload persisted with the workflow definition.
   */
  config?: Record<string, unknown>;
  /**
   * Whether the node has been configured.
   */
  isConfigured?: boolean;
  /**
   * Short summary string rendered near the footer (e.g., duration, recipient).
   */
  summary?: string;
  /**
   * Additional metadata.
   */
  metadata?: Record<string, unknown>;
  /**
   * Badges rendered under the title.
   */
  badges?: WorkflowNodeBadge[];
  /**
   * Optional status color used for outlines / bullet indicator.
   */
  status?: WorkflowNodeStatus;
};

