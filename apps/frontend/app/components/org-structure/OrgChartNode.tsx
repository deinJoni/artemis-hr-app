import * as React from "react";
import { User, Building2 } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { Link } from "react-router";
import type { OrgStructureNode } from "@vibe/shared";

interface OrgChartNodeProps {
  node: OrgStructureNode;
  onClick?: (nodeId: string) => void;
  className?: string;
}

export function OrgChartNode({ node, onClick, className }: OrgChartNodeProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(node.employee_id);
    }
  };

  return (
    <Card
      className={cn(
        "w-64 min-w-[256px] cursor-pointer transition-all hover:shadow-lg hover:scale-105",
        className
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
              {node.employee_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {onClick ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClick();
                    }}
                    className="font-semibold text-sm hover:underline text-left block truncate"
                  >
                    {node.employee_name}
                  </button>
                ) : (
                  <Link
                    to={`/employees/${node.employee_id}`}
                    className="font-semibold text-sm hover:underline block truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {node.employee_name}
                  </Link>
                )}
                {node.job_title && (
                  <p className="text-xs text-muted-foreground truncate mt-1">{node.job_title}</p>
                )}
              </div>
            </div>
            {node.department_name && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{node.department_name}</span>
              </div>
            )}
            {node.location_name && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <span className="truncate">{node.location_name}</span>
              </div>
            )}
            {node.direct_reports && node.direct_reports.length > 0 && (
              <Badge variant="secondary" className="mt-2 text-xs">
                {node.direct_reports.length} direct report{node.direct_reports.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

