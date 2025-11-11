import * as React from "react";
import { LeaveApprovalsList } from "~/components/leave/leave-approvals-list";

export const meta = () => {
  return [
    { title: "Leave Approvals | Artemis" },
    { name: "description", content: "Review and approve team leave requests" },
  ];
};

export default function LeaveApprovalsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Leave Approvals</h1>
        <p className="text-muted-foreground">
          Review and approve leave requests from your team members
        </p>
      </div>

      {/* Approvals List */}
      <LeaveApprovalsList
      />
    </div>
  );
}
