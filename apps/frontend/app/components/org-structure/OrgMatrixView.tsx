import * as React from "react";
import { User, ArrowRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Link } from "react-router";
import type { ReportingLine, OrgStructureNode } from "@vibe/shared";

interface OrgMatrixViewProps {
  reportingLines: ReportingLine[];
  orgStructure: OrgStructureNode[];
}

export function OrgMatrixView({ reportingLines, orgStructure }: OrgMatrixViewProps) {
  const nodeMap = React.useMemo(() => {
    const map = new Map<string, OrgStructureNode>();
    orgStructure.forEach((node) => {
      map.set(node.employee_id, node);
    });
    return map;
  }, [orgStructure]);

  // Filter to only show employees with reporting relationships
  const employeesWithReporting = React.useMemo(() => {
    return reportingLines.filter((rl) => rl.manager_id || rl.dotted_line_manager_id);
  }, [reportingLines]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Direct Reporting Lines</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Employees with direct managers (solid reporting lines)
        </p>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Direct Manager</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeesWithReporting
                .filter((rl) => rl.manager_id)
                .map((rl) => {
                  const node = nodeMap.get(rl.employee_id);
                  return (
                    <TableRow key={rl.employee_id}>
                      <TableCell>
                        <Link
                          to={`/employees/${rl.employee_id}`}
                          className="font-medium hover:underline"
                        >
                          {node?.employee_name || rl.employee_id}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {node?.job_title || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {node?.department_name || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <Link
                            to={`/employees/${rl.manager_id}`}
                            className="hover:underline"
                          >
                            {rl.manager_name || rl.manager_id}
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Dotted-Line Reporting</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Employees with dotted-line managers (matrix organization relationships)
        </p>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Dotted-Line Manager</TableHead>
                <TableHead>Direct Manager</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeesWithReporting
                .filter((rl) => rl.dotted_line_manager_id)
                .map((rl) => {
                  const node = nodeMap.get(rl.employee_id);
                  return (
                    <TableRow key={rl.employee_id}>
                      <TableCell>
                        <Link
                          to={`/employees/${rl.employee_id}`}
                          className="font-medium hover:underline"
                        >
                          {node?.employee_name || rl.employee_id}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {node?.job_title || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {node?.department_name || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ArrowDownRight className="h-4 w-4 text-blue-600" />
                          <Link
                            to={`/employees/${rl.dotted_line_manager_id}`}
                            className="hover:underline text-blue-600"
                          >
                            {rl.dotted_line_manager_name || rl.dotted_line_manager_id}
                          </Link>
                          <Badge variant="outline" className="text-xs ml-2">
                            Dotted
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {rl.manager_id ? (
                          <div className="flex items-center gap-2">
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Link
                              to={`/employees/${rl.manager_id}`}
                              className="hover:underline"
                            >
                              {rl.manager_name || rl.manager_id}
                            </Link>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </div>

      {employeesWithReporting.filter((rl) => rl.dotted_line_manager_id).length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No dotted-line reporting relationships found. Dotted-line managers can be assigned in employee profiles.
        </div>
      )}
    </div>
  );
}

