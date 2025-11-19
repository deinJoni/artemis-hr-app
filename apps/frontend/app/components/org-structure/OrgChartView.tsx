import * as React from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { OrgChartNode } from "./OrgChartNode";
import { OrgChartControls } from "./OrgChartControls";
import type { OrgHierarchyNode } from "@vibe/shared";
import { cn } from "~/lib/utils";

interface OrgChartViewProps {
  hierarchy: OrgHierarchyNode | null;
  onNodeClick?: (nodeId: string) => void;
}

export function OrgChartView({ hierarchy, onNodeClick }: OrgChartViewProps) {
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const renderNode = (node: OrgHierarchyNode, level: number = 0, index: number = 0, parentWidth: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const childrenCount = node.children?.length || 0;
    const nodeWidth = 280; // Card width + margin
    const nodeHeight = 120;
    const horizontalSpacing = 320;
    const verticalSpacing = 200;

    // Calculate position
    let x = 0;
    let y = level * verticalSpacing;

    if (level === 0) {
      // Root node centered
      x = parentWidth / 2 - nodeWidth / 2;
    } else {
      // Calculate position based on sibling index
      const siblingsCount = parentWidth / horizontalSpacing;
      const startX = (parentWidth - (siblingsCount - 1) * horizontalSpacing) / 2;
      x = startX + index * horizontalSpacing - nodeWidth / 2;
    }

    const childrenWidth = childrenCount * horizontalSpacing;

    return (
      <g key={node.id} transform={`translate(${x}, ${y})`}>
        <foreignObject width={nodeWidth} height={nodeHeight}>
          <div className="flex justify-center">
            <OrgChartNode
              node={{
                employee_id: node.id,
                tenant_id: "",
                employee_name: node.name,
                email: node.email,
                job_title: node.job_title,
                employee_number: null,
                status: "active" as const,
                manager_id: null,
                dotted_line_manager_id: null,
                department_id: null,
                department_name: node.department_name,
                office_location_id: null,
                location_name: null,
                manager_name: null,
                manager_email: null,
                dotted_line_manager_name: null,
                dotted_line_manager_email: null,
                teams: [],
                direct_reports: node.children?.map((c) => c.id) || [],
              }}
              onClick={onNodeClick}
            />
          </div>
        </foreignObject>

        {/* Render connection lines to children */}
        {hasChildren && node.children && (
          <>
            {/* Vertical line from parent to children */}
            <line
              x1={nodeWidth / 2}
              y1={nodeHeight}
              x2={nodeWidth / 2}
              y2={verticalSpacing - nodeHeight}
              stroke="#e5e7eb"
              strokeWidth="2"
            />
            {/* Horizontal line connecting children */}
            {childrenCount > 1 && (
              <line
                x1={nodeWidth / 2 - (childrenCount - 1) * horizontalSpacing / 2}
                y1={verticalSpacing - nodeHeight}
                x2={nodeWidth / 2 + (childrenCount - 1) * horizontalSpacing / 2}
                y2={verticalSpacing - nodeHeight}
                stroke="#e5e7eb"
                strokeWidth="2"
              />
            )}
            {/* Vertical lines from horizontal line to each child */}
            {node.children.map((_, idx) => {
              const childX = (idx - (childrenCount - 1) / 2) * horizontalSpacing;
              return (
                <line
                  key={idx}
                  x1={nodeWidth / 2 + childX}
                  y1={verticalSpacing - nodeHeight}
                  x2={nodeWidth / 2 + childX}
                  y2={verticalSpacing - nodeHeight + 20}
                  stroke="#e5e7eb"
                  strokeWidth="2"
                />
              );
            })}
          </>
        )}

        {/* Render children recursively */}
        {hasChildren &&
          node.children?.map((child, idx) => {
            const childGroup = renderNode(child, level + 1, idx, childrenWidth);
            return (
              <g key={child.id} transform={`translate(${(idx - (childrenCount - 1) / 2) * horizontalSpacing}, 0)`}>
                {childGroup}
              </g>
            );
          })}
      </g>
    );
  };

  if (!hierarchy) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No organizational hierarchy data available
      </div>
    );
  }

  // Calculate total width needed
  const calculateWidth = (node: OrgHierarchyNode): number => {
    if (!node.children || node.children.length === 0) return 280;
    return Math.max(node.children.length * 320, 280);
  };

  const totalWidth = calculateWidth(hierarchy);
  const totalHeight = 400; // Approximate, will be calculated based on depth

  return (
    <div className="relative w-full h-full">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2 bg-white rounded-lg shadow-lg p-2">
        <Button variant="outline" size="sm" onClick={handleZoomIn} title="Zoom In">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset} title="Reset View">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <OrgChartControls chartRef={chartRef} />
      </div>

      {/* Chart container */}
      <div
        ref={chartRef}
        className="relative"
      >
        <div
          ref={containerRef}
          className={cn(
            "w-full h-[600px] overflow-hidden border rounded-lg bg-gray-50",
            isDragging && "cursor-grabbing"
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
        <svg
          width="100%"
          height="100%"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          <g>
            {hierarchy.id === "root" && hierarchy.children
              ? hierarchy.children.map((child, idx) => renderNode(child, 0, idx, totalWidth))
              : renderNode(hierarchy, 0, 0, totalWidth)}
          </g>
        </svg>
        </div>
      </div>
    </div>
  );
}

