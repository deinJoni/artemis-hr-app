import { nanoid } from "nanoid";
import type { Edge, Node } from "reactflow";

import type { WorkflowNodeData } from "~/components/workflows/nodes";
import type { WorkflowNodeType } from "@vibe/shared";

export type PersistedWorkflowNode = {
  id: string;
  type: WorkflowNodeType | string;
  label?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  config?: Record<string, unknown>;
  ui?: {
    position?: {
      x: number;
      y: number;
    };
  };
};

export type PersistedWorkflowEdge = {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  metadata?: Record<string, unknown>;
};

export type WorkflowDefinitionValue = {
  nodes: PersistedWorkflowNode[];
  edges: PersistedWorkflowEdge[];
  metadata?: Record<string, unknown>;
};

const DEFAULT_POSITION = { x: 100, y: 100 };

const EMPTY_IMPORT_RESULT: ReactFlowImportResult = {
  nodes: [],
  edges: [],
  metadata: {},
};

export type ReactFlowImportResult = {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  metadata: Record<string, unknown>;
};

export type ReactFlowExportOptions = {
  metadata?: Record<string, unknown>;
};

export function definitionToReactFlow(input: unknown): ReactFlowImportResult {
  if (!input || typeof input !== "object") {
    return { ...EMPTY_IMPORT_RESULT };
  }

  const definition = normalizeDefinition(input);

  const nodes: Node<WorkflowNodeData>[] = definition.nodes.map((node, index) => {
    const position = normalizePosition(node.ui?.position) ?? {
      x: DEFAULT_POSITION.x + index * 80,
      y: DEFAULT_POSITION.y + index * 40,
    };

    const data: WorkflowNodeData = {
      label: node.label ?? `Node ${index + 1}`,
      summary: node.summary,
      metadata: node.metadata ?? {},
      config: node.config ?? {},
      kind: node.type,
      isConfigured: Boolean(node.config && Object.keys(node.config).length > 0),
    };

    return {
      id: node.id,
      type: node.type,
      data,
      position,
      draggable: true,
      selectable: true,
    };
  });

  const edges: Edge[] = definition.edges.map((edge) => ({
    id: edge.id ?? `edge-${edge.source}-${edge.target}-${nanoid(4)}`,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    label: edge.label,
    data: edge.metadata,
    type: "smoothstep",
  }));

  return {
    nodes,
    edges,
    metadata: definition.metadata ?? {},
  };
}

export function reactFlowToDefinition(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
  options?: ReactFlowExportOptions,
): WorkflowDefinitionValue {
  const persistedNodes: PersistedWorkflowNode[] = nodes.map((node) => ({
    id: node.id,
    type: node.type ?? node.data.kind ?? "action",
    label: node.data.label,
    summary: node.data.summary,
    metadata: node.data.metadata ?? {},
    config: node.data.config ?? {},
    ui: {
      position: {
        x: node.position.x,
        y: node.position.y,
      },
    },
  }));

  const persistedEdges: PersistedWorkflowEdge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    label: typeof edge.label === "string" ? edge.label : undefined,
    metadata: edge.data ?? {},
  }));

  return {
    nodes: persistedNodes,
    edges: persistedEdges,
    metadata: {
      ...(options?.metadata ?? {}),
    },
  };
}

function normalizeDefinition(input: unknown): WorkflowDefinitionValue {
  const safe = input as Partial<WorkflowDefinitionValue>;
  const nodes = Array.isArray(safe.nodes)
    ? safe.nodes.filter(isPersistedNode)
    : [];
  const edges = Array.isArray(safe.edges)
    ? safe.edges.filter(isPersistedEdge)
    : [];

  return {
    nodes,
    edges,
    metadata: typeof safe.metadata === "object" && safe.metadata !== null ? safe.metadata : {},
  };
}

function isPersistedNode(value: unknown): value is PersistedWorkflowNode {
  if (!value || typeof value !== "object") return false;
  const candidate = value as PersistedWorkflowNode;
  return typeof candidate.id === "string" && typeof candidate.type === "string";
}

function isPersistedEdge(value: unknown): value is PersistedWorkflowEdge {
  if (!value || typeof value !== "object") return false;
  const candidate = value as PersistedWorkflowEdge;
  return typeof candidate.source === "string" && typeof candidate.target === "string";
}

function normalizePosition(position?: { x?: number; y?: number } | null) {
  if (!position) return null;
  if (typeof position.x !== "number" || typeof position.y !== "number") {
    return null;
  }
  return { x: position.x, y: position.y };
}

