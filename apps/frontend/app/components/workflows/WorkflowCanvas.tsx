import * as React from "react";
import type {
  Connection,
  Edge,
  Node,
  NodeTypes,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  ReactFlowInstance,
} from "reactflow";
import {
  BackgroundVariant,
  Background,
  ConnectionLineType,
  Controls,
  MarkerType,
  MiniMap,
  PanOnScrollMode,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useViewport,
} from "reactflow";
import "reactflow/dist/style.css";

import { cn } from "~/lib/utils";

const DEFAULT_BACKGROUND = BackgroundVariant.Dots;
const DEFAULT_CONNECTION_LINE = ConnectionLineType.SmoothStep;

type WorkflowCanvasProps<Data = unknown> = {
  nodes: Node<Data>[];
  edges: Edge[];
  onNodesChange?: OnNodesChange;
  onEdgesChange?: OnEdgesChange;
  onConnect?: OnConnect;
  onInit?: (instance: ReactFlowInstance) => void;
  onSelectionChange?: (params: {
    nodes: Node<Data>[];
    edges: Edge[];
  }) => void;
  nodeTypes?: NodeTypes;
  className?: string;
  readOnly?: boolean;
  emptyState?: React.ReactNode;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  isValidConnection?: (connection: Connection) => boolean;
};

/**
 * WorkflowCanvas is a thin wrapper around React Flow with sensible defaults
 * for the Artemis workflow builder experience (grid background, minimap,
 * smooth connection lines, keyboard shortcuts, etc).
 */
export function WorkflowCanvas<Data = unknown>({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onInit,
  onSelectionChange,
  nodeTypes,
  className,
  readOnly = false,
  emptyState,
  onDrop,
  onDragOver,
  isValidConnection,
}: WorkflowCanvasProps<Data>) {
  const [reactFlowInstance, setReactFlowInstance] = React.useState<ReactFlowInstance | null>(null);

  const handleInit = React.useCallback(
    (instance: ReactFlowInstance) => {
      setReactFlowInstance(instance);
      if (nodes.length) {
        instance.fitView({ padding: 0.2, duration: 400 });
      }
      onInit?.(instance);
    },
    [nodes.length, onInit],
  );

  const handleSelectionChange = React.useCallback(
    (params: { nodes: Node<Data>[]; edges: Edge[] }) => {
      onSelectionChange?.(params);
    },
    [onSelectionChange],
  );

  const fitCanvas = React.useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
    }
  }, [reactFlowInstance]);

  return (
    <ReactFlowProvider>
      <div className={cn("relative h-full w-full overflow-hidden rounded-xl border bg-background", className)}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onInit={handleInit}
          onSelectionChange={handleSelectionChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          elementsSelectable={!readOnly}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          panOnScroll
          panOnScrollMode={PanOnScrollMode.Free}
          zoomOnScroll
          minZoom={0.3}
          maxZoom={1.5}
          defaultEdgeOptions={{
            type: DEFAULT_CONNECTION_LINE,
            markerEnd: { type: MarkerType.ArrowClosed },
            animated: false,
          }}
          connectionLineType={DEFAULT_CONNECTION_LINE}
          proOptions={{ hideAttribution: true }}
          elevateEdgesOnSelect
          translateExtent={[
            [-Infinity, -Infinity],
            [Infinity, Infinity],
          ]}
          deleteKeyCode={readOnly ? null : ["Delete", "Backspace"]}
          selectionKeyCode="Shift"
          multiSelectionKeyCode="Meta"
          onDrop={onDrop}
          onDragOver={onDragOver}
          isValidConnection={isValidConnection}
        >
          <Background
            id="workflow-canvas-background"
            variant={DEFAULT_BACKGROUND}
            gap={16}
            color="hsl(var(--muted-foreground) / 0.25)"
          />
          <MiniMap
            pannable
            zoomable
            maskColor="hsl(var(--background) / 0.9)"
            nodeStrokeColor={(node) => {
              if (node.selected) return "hsl(var(--primary))";
              if (node.type === "trigger") return "hsl(var(--primary))";
              if (node.type === "action") return "hsl(var(--success, 142 72% 29%))";
              if (node.type === "delay") return "hsl(var(--warning, 33 96% 45%))";
              if (node.type === "logic") return "hsl(var(--muted-foreground))";
              return "hsl(var(--border))";
            }}
            nodeColor={(node) => {
              if (node.type === "trigger") return "hsl(var(--primary) / 0.3)";
              if (node.type === "action") return "hsl(var(--success, 142 72% 45%) / 0.3)";
              if (node.type === "delay") return "hsl(var(--warning, 33 96% 55%) / 0.3)";
              if (node.type === "logic") return "hsl(var(--muted-foreground) / 0.25)";
              return "hsl(var(--muted) / 0.25)";
            }}
          />
          <Controls
            position="bottom-left"
            showInteractive={!readOnly}
            onFitView={fitCanvas}
            className="rounded-md border border-border/70 bg-background/80 shadow-sm backdrop-blur"
          />
          {emptyState ? <CanvasEmptyState>{emptyState}</CanvasEmptyState> : null}
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}

type CanvasEmptyStateProps = {
  children: React.ReactNode;
};

function CanvasEmptyState({ children }: CanvasEmptyStateProps) {
  const { zoom } = useViewport();
  const scale = Math.max(zoom, 1);

  return (
    <Panel position="top-center" className="pointer-events-none w-full">
      <div
        className="mx-auto mt-8 max-w-xl rounded-2xl border border-dashed border-border/70 bg-background/90 p-6 text-center text-sm text-muted-foreground shadow-sm backdrop-blur"
        style={{ transform: `scale(${1 / scale})`, transformOrigin: "top center" }}
      >
        {children}
      </div>
    </Panel>
  );
}

