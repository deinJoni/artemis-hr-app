import * as React from "react";
import type { Route } from "./+types/workflows.$workflowId.builder";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from "reactflow";
import { nanoid } from "nanoid";
import { useNavigate, useRevalidator } from "react-router";
import { getAuthToken } from "~/lib/get-auth-token";
import { supabase } from "~/lib/supabase";
import { WorkflowDetailResponseSchema } from "@vibe/shared";
import { ArrowLeft, Loader2, Play, Redo2, Save, Undo2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { NodeConfigPanel } from "~/components/workflows/NodeConfigPanel";
import { NodeSidebar } from "~/components/workflows/NodeSidebar";
import { WorkflowCanvas } from "~/components/workflows/WorkflowCanvas";
import { workflowNodeTypes, type WorkflowNodeData } from "~/components/workflows/nodes";
import { definitionToReactFlow, reactFlowToDefinition } from "~/lib/workflows/definition-transformer";
import { getWorkflowNodeCategories, type WorkflowNodeTemplate } from "~/lib/workflows/node-types";
import { cn } from "~/lib/utils";

type GraphSnapshot = {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
};

const MAX_HISTORY = 20;

export async function loader({ params, request }: Route.LoaderArgs) {
  const { workflowId } = params;
  const baseUrl =
    (import.meta as any).env?.VITE_BACKEND_URL ??
    (typeof process !== "undefined"
      ? ((process.env?.VITE_BACKEND_URL as string | undefined) ?? undefined)
      : undefined) ??
    "http://localhost:8787";

  const token = await getAuthToken(request);

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
    const errorData = await workflowRes.json().catch(() => ({ error: "Unknown error" }));
    const errorMessage = errorData.error || "Workflow not found";
    console.error("[Workflow Builder] Failed to load workflow:", {
      workflowId,
      tenantId,
      status: workflowRes.status,
      error: errorMessage,
    });
    throw new Response(errorMessage, { status: workflowRes.status === 400 ? 404 : workflowRes.status });
  }

  const workflowData = await workflowRes.json();
  const parsed = WorkflowDetailResponseSchema.safeParse(workflowData);

  if (!parsed.success) {
    throw new Response("Invalid workflow data", { status: 500 });
  }

  const latestVersion = parsed.data.versions.reduce<{
    version_number: number;
    definition: unknown;
  } | null>((acc, version) => {
    if (!acc || version.version_number > acc.version_number) {
      return {
        version_number: version.version_number,
        definition: version.definition,
      };
    }
    return acc;
  }, null);

  return {
    baseUrl,
    tenantId,
    workflow: parsed.data.workflow,
    versions: parsed.data.versions,
    definition: latestVersion?.definition ?? { nodes: [], edges: [], metadata: {} },
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
  const { baseUrl, tenantId, workflow, definition } = loaderData ?? {
    baseUrl: "http://localhost:8787",
    tenantId: "",
    workflow: null,
    definition: { nodes: [], edges: [], metadata: {} },
  };
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  const initialGraph = React.useMemo(() => definitionToReactFlow(definition), [definition]);
  const [nodes, setNodes] = React.useState<Node<WorkflowNodeData>[]>(initialGraph.nodes);
  const [edges, setEdges] = React.useState<Edge[]>(initialGraph.edges);
  const [workflowName, setWorkflowName] = React.useState(workflow?.name ?? "");
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = React.useState(
    JSON.stringify(reactFlowToDefinition(initialGraph.nodes, initialGraph.edges)),
  );
  const [definitionMetadata] = React.useState<Record<string, unknown>>(initialGraph.metadata ?? {});
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = React.useState<ReactFlowInstance | null>(null);
  const historyRef = React.useRef<{ past: GraphSnapshot[]; future: GraphSnapshot[] }>({
    past: [],
    future: [],
  });
  const isApplyingHistory = React.useRef(false);
  const [historyStatus, setHistoryStatus] = React.useState({ canUndo: false, canRedo: false });

  const createSnapshot = React.useCallback(
    (currentNodes: Node<WorkflowNodeData>[], currentEdges: Edge[]): GraphSnapshot => ({
      nodes: currentNodes.map((node) => ({
        ...node,
        data: { ...node.data },
        position: { ...node.position },
      })),
      edges: currentEdges.map((edge) => ({ ...edge })),
    }),
    [],
  );

  const updateHistoryStatus = React.useCallback(() => {
    const { past, future } = historyRef.current;
    setHistoryStatus({ canUndo: past.length > 0, canRedo: future.length > 0 });
  }, []);

  const recordSnapshot = React.useCallback(
    (currentNodes: Node<WorkflowNodeData>[], currentEdges: Edge[]) => {
      if (isApplyingHistory.current) return;
      historyRef.current.past.push(createSnapshot(currentNodes, currentEdges));
      if (historyRef.current.past.length > MAX_HISTORY) {
        historyRef.current.past.shift();
      }
      historyRef.current.future = [];
      updateHistoryStatus();
    },
    [createSnapshot, updateHistoryStatus],
  );

  const handleUndo = React.useCallback(() => {
    const snapshot = historyRef.current.past.pop();
    if (!snapshot) return;
    historyRef.current.future.unshift(createSnapshot(nodes, edges));
    if (historyRef.current.future.length > MAX_HISTORY) {
      historyRef.current.future.pop();
    }
    isApplyingHistory.current = true;
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    requestAnimationFrame(() => {
      isApplyingHistory.current = false;
    });
    updateHistoryStatus();
  }, [createSnapshot, edges, nodes, updateHistoryStatus]);

  const handleRedo = React.useCallback(() => {
    const snapshot = historyRef.current.future.shift();
    if (!snapshot) return;
    historyRef.current.past.push(createSnapshot(nodes, edges));
    if (historyRef.current.past.length > MAX_HISTORY) {
      historyRef.current.past.shift();
    }
    isApplyingHistory.current = true;
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    requestAnimationFrame(() => {
      isApplyingHistory.current = false;
    });
    updateHistoryStatus();
  }, [createSnapshot, edges, nodes, updateHistoryStatus]);

  React.useEffect(() => {
    setNodes(initialGraph.nodes);
    setEdges(initialGraph.edges);
    setLastSavedSnapshot(JSON.stringify(reactFlowToDefinition(initialGraph.nodes, initialGraph.edges)));
    historyRef.current = { past: [], future: [] };
    updateHistoryStatus();
  }, [initialGraph.nodes, initialGraph.edges, updateHistoryStatus]);

  const nodeCategories = React.useMemo(
    () => getWorkflowNodeCategories(workflow?.kind ?? "onboarding"),
    [workflow?.kind],
  );

  const validateConnection = React.useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;

      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      if (!sourceNode || !targetNode) return false;
      if (targetNode.type === "trigger") return false;

      if (targetNode.type === "logic" && connection.targetHandle) {
        const handleTaken = edges.some(
          (edge) => edge.target === targetNode.id && edge.targetHandle === connection.targetHandle,
        );
        if (handleTaken) return false;
      }

      return true;
    },
    [edges, nodes],
  );

  const handleNodesChange = React.useCallback(
    (changes: NodeChange[]) => {
      if (changes.length === 0) return;
      const shouldRecord = changes.some(
        (change) => change.type !== "position" || (change.type === "position" && change.dragging === false),
      );
      if (shouldRecord) {
        recordSnapshot(nodes, edges);
      }
      setNodes((current) => applyNodeChanges(changes, current));
    },
    [edges, nodes, recordSnapshot],
  );

  const handleEdgesChange = React.useCallback(
    (changes: EdgeChange[]) => {
      if (changes.length > 0) {
        recordSnapshot(nodes, edges);
      }
      setEdges((current) => applyEdgeChanges(changes, current));
    },
    [edges, nodes, recordSnapshot],
  );

  const handleConnect = React.useCallback(
    (connection: Connection) => {
      if (!validateConnection(connection)) return;
      recordSnapshot(nodes, edges);

      const sourceNode = nodes.find((node) => node.id === connection.source);
      const label =
        sourceNode?.type === "logic"
          ? connection.sourceHandle === "logic-yes"
            ? "Yes"
            : connection.sourceHandle === "logic-no"
              ? "No"
              : undefined
          : undefined;

      const newEdge = {
        ...connection,
        id: `edge-${connection.source}-${connection.target}-${nanoid(4)}`,
        type: "smoothstep",
        markerEnd: { type: "arrowclosed" },
        label,
        style: { strokeWidth: 2 },
        animated: sourceNode?.type === "trigger",
      };

      setEdges((current) => addEdge(newEdge, current));
    },
    [edges, nodes, recordSnapshot, validateConnection],
  );

  const handleSelectionChange = React.useCallback((params: { nodes: Node[] }) => {
    setSelectedNodeId(params.nodes[0]?.id ?? null);
  }, []);

  const handleUpdateNode = React.useCallback(
    (nodeId: string, data: WorkflowNodeData) => {
      recordSnapshot(nodes, edges);
      setNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, data } : node)));
    },
    [edges, nodes, recordSnapshot],
  );

  const handleDeleteNode = React.useCallback(
    (nodeId: string) => {
      recordSnapshot(nodes, edges);
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setSelectedNodeId((current) => (current === nodeId ? null : current));
    },
    [edges, nodes, recordSnapshot],
  );

  const projectClientPoint = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const bounds = canvasRef.current?.getBoundingClientRect();
      if (!reactFlowInstance || !bounds) {
        return { x: event.clientX, y: event.clientY };
      }
      return reactFlowInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
    },
    [reactFlowInstance],
  );

  const addTemplateNode = React.useCallback(
    (template: WorkflowNodeTemplate, position: { x: number; y: number }) => {
      recordSnapshot(nodes, edges);
      const newNode: Node<WorkflowNodeData> = {
        id: `node-${nanoid(6)}`,
        type: template.kind,
        position,
        data: {
          label: template.label,
          description: template.description,
          summary: template.defaultData.summary ?? template.description,
          metadata: template.defaultData.metadata ?? {},
          config: template.defaultData.config ?? {},
          badges: template.defaultData.badges ?? [],
          kind: template.kind,
          isConfigured: false,
        },
      };
      setNodes((current) => [...current, newNode]);
    },
    [edges, nodes, recordSnapshot],
  );

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const templateData = event.dataTransfer.getData("application/reactflow/template");
      if (!templateData) return;
      try {
        const template: WorkflowNodeTemplate = JSON.parse(templateData);
        const position = projectClientPoint(event);
        addTemplateNode(template, position);
      } catch (error) {
        console.error("Unable to parse node template", error);
      }
    },
    [addTemplateNode, projectClientPoint],
  );

  const handleDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleTemplateClick = React.useCallback(
    (template: WorkflowNodeTemplate) => {
      const position = reactFlowInstance
        ? reactFlowInstance.project({ x: 400, y: 200 })
        : { x: 200, y: 200 };
      addTemplateNode(template, position);
    },
    [addTemplateNode, reactFlowInstance],
  );

  const currentDefinitionSnapshot = React.useMemo(
    () => JSON.stringify(reactFlowToDefinition(nodes, edges)),
    [nodes, edges],
  );

  const hasUnsavedChanges = lastSavedSnapshot !== currentDefinitionSnapshot || workflowName !== (workflow?.name ?? "");

  const showMessage = React.useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const handleSave = React.useCallback(
    async (silent = false) => {
      if (!workflow || !tenantId) return false;
    setIsSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error("Not authenticated");
      }

        const definitionPayload = reactFlowToDefinition(nodes, edges, {
          metadata: definitionMetadata,
        });

        const response = await fetch(`${baseUrl}/api/workflows/${tenantId}/${workflow.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: workflowName,
            definition: definitionPayload,
        }),
      });

        if (!response.ok) {
          const error = await response.json();
        throw new Error(error.error || "Failed to save workflow");
      }

        setLastSavedSnapshot(JSON.stringify(definitionPayload));
        if (!silent) {
          showMessage("success", "Workflow saved successfully");
        }
      revalidator.revalidate();
        return true;
    } catch (error) {
        if (!silent) {
          showMessage("error", error instanceof Error ? error.message : "Failed to save workflow");
        }
        return false;
    } finally {
      setIsSaving(false);
    }
    },
    [
      baseUrl,
      definitionMetadata,
      edges,
      nodes,
      revalidator,
      showMessage,
      tenantId,
      workflow,
      workflowName,
    ],
  );

  const handlePublish = React.useCallback(async () => {
    if (!workflow) return;
    if (!nodes.some((node) => node.type === "trigger")) {
      showMessage("error", "Add at least one trigger before publishing.");
      return;
    }

    setIsPublishing(true);
    const saved = hasUnsavedChanges ? await handleSave(true) : true;
    if (!saved) {
      setIsPublishing(false);
      return;
    }

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

      showMessage("success", "Workflow published successfully");
      setTimeout(() => navigate("/workflows"), 1200);
    } catch (error) {
      showMessage("error", error instanceof Error ? error.message : "Failed to publish workflow");
    } finally {
      setIsPublishing(false);
    }
  }, [baseUrl, handleSave, hasUnsavedChanges, navigate, nodes, showMessage, tenantId, workflow]);

  React.useEffect(() => {
    if (!hasUnsavedChanges) return;
    const timeout = setTimeout(() => {
      void handleSave(true);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [handleSave, hasUnsavedChanges]);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleRedo, handleUndo]);

  if (!workflow) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Workflow not found</h1>
        </div>
      </div>
    );
  }

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  return (
    <div className="flex flex-1 flex-col gap-6">
      {message && (
        <div
          className={cn(
            "rounded-md border px-4 py-3 text-sm",
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-destructive/50 bg-destructive/5 text-destructive",
          )}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/workflows")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">{workflow.name}</h1>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                  workflow.status === "published"
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-amber-500/10 text-amber-700",
                )}
              >
                {workflow.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Build and automate HR workflows</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleUndo} disabled={!historyStatus.canUndo}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleRedo} disabled={!historyStatus.canRedo}>
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" disabled={!hasUnsavedChanges || isSaving} onClick={() => void handleSave()}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {hasUnsavedChanges ? "Save Draft" : "Saved"}
          </Button>
          {workflow.status !== "published" ? (
            <Button onClick={() => void handlePublish()} disabled={isPublishing}>
              {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Publish
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Details</CardTitle>
          <CardDescription>Configure basic workflow information</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="workflow-name">Name</Label>
            <Input
              id="workflow-name"
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
              placeholder="Enter workflow name"
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="text-sm text-muted-foreground capitalize">{workflow.kind}</div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="text-sm text-muted-foreground capitalize">{workflow.status}</div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <NodeSidebar categories={nodeCategories} onTemplateClick={handleTemplateClick} className="lg:w-80" />
        <div className="flex-1" ref={canvasRef}>
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onSelectionChange={handleSelectionChange}
            nodeTypes={workflowNodeTypes}
            onInit={setReactFlowInstance}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            isValidConnection={validateConnection}
            emptyState={
              <div className="space-y-2">
                <p className="font-medium text-foreground">Drag blocks from the left to begin.</p>
                <p className="text-sm text-muted-foreground">
                  Add at least one trigger, then connect actions, delays, and logic nodes to automate your HR process.
            </p>
          </div>
            }
          />
        </div>
        <NodeConfigPanel
          node={selectedNode}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          className="lg:w-[360px]"
        />
      </div>
    </div>
  );
}
