import * as React from "react";
import type { Route } from "./+types/approvals";
import { TimeApprovalsList } from "~/components/time/time-approvals-list";
import { LeaveApprovalsList } from "~/components/leave/leave-approvals-list";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Approvals - Artemis" },
    { name: "description", content: "Manage pending time and leave approvals in one place" },
  ];
}

export default function ApprovalsPage() {
  return (
    <div className="container mx-auto space-y-8 py-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Approvals</h1>
        <p className="text-muted-foreground">
          Review and action every pending approval for your team across time entries and leave.
        </p>
      </div>

      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle>Quick Guidance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Time Entry Approvals</span>
            <p>
              Verify clocked hours before payroll closes. Add a reason to capture context for
              approvals or rejections.
            </p>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Leave Requests</span>
            <p>
              Confirm available balances, certificates, and upcoming conflicts before approving or
              denying the request.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-8 xl:grid-cols-2">
        <TimeApprovalsList />
        <div className="space-y-6">
          <LeaveApprovalsList />
        </div>
      </div>

      <Separator />

      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          Need to handle these later? Bookmark this page or use the dashboard Action Items widget
          for a quick triage view.
        </p>
      </div>
    </div>
  );
}
