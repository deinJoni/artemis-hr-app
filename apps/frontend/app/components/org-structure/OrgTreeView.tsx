import * as React from "react";
import { ChevronRight, ChevronDown, User, Building2, MapPin } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { OrgHierarchyNode } from "@vibe/shared";
import { Link } from "react-router";

interface OrgTreeViewProps {
  hierarchy: OrgHierarchyNode | null;
  onNodeClick?: (nodeId: string) => void;
}

export function OrgTreeView({ hierarchy, onNodeClick }: OrgTreeViewProps) {
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set());

  const toggleExpanded = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const renderNode = (node: OrgHierarchyNode, level: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const indent = level * 24;

    return (
      <div key={node.id} className="py-1">
        <div
          className={cn(
            "flex items-start gap-2 py-2 px-3 rounded-md hover:bg-gray-50 transition-colors",
            level > 0 && "ml-4"
          )}
          style={{ paddingLeft: `${indent + 12}px` }}
        >
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleExpanded(node.id)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <div className="w-6" />
          )}

          <User className="h-4 w-4 text-muted-foreground mt-0.5" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {onNodeClick ? (
                <button
                  onClick={() => onNodeClick(node.id)}
                  className="font-medium text-sm hover:underline text-left"
                >
                  {node.name}
                </button>
              ) : (
                <Link
                  to={`/employees/${node.id}`}
                  className="font-medium text-sm hover:underline"
                >
                  {node.name}
                </Link>
              )}
            </div>
            {node.job_title && (
              <p className="text-xs text-muted-foreground truncate">{node.job_title}</p>
            )}
            {node.department_name && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Building2 className="h-3 w-3" />
                <span>{node.department_name}</span>
              </div>
            )}
          </div>

          {hasChildren && (
            <Badge variant="secondary" className="text-xs">
              {node.children?.length || 0}
            </Badge>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {node.children?.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!hierarchy) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No organizational hierarchy data available
      </div>
    );
  }

  // Handle root node with children
  if (hierarchy.id === "root" && hierarchy.children) {
    return (
      <div className="space-y-1">
        {hierarchy.children.map((child) => renderNode(child, 0))}
      </div>
    );
  }

  return <div className="space-y-1">{renderNode(hierarchy, 0)}</div>;
}

