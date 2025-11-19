import type { LucideIcon } from "lucide-react";
import { Bell, Clock, FileSignature, GitBranch, Mail, UsersRound, Zap } from "lucide-react";
import type { WorkflowKind } from "@vibe/shared";

import type { NodeTone, WorkflowNodeData } from "~/components/workflows/nodes";

export type WorkflowNodeTemplate = {
  id: string;
  label: string;
  description?: string;
  kind: string;
  icon: LucideIcon;
  tone: NodeTone;
  tags?: string[];
  defaultData: Partial<WorkflowNodeData>;
};

export type WorkflowNodeCategory = {
  id: string;
  label: string;
  description?: string;
  templates: WorkflowNodeTemplate[];
};

export function getWorkflowNodeCategories(kind: WorkflowKind | string = "onboarding"): WorkflowNodeCategory[] {
  return [
    {
      id: "triggers",
      label: "Triggers",
      description: "Events that kick off workflows",
      templates: buildTriggerTemplates(kind),
    },
    {
      id: "actions",
      label: "Actions",
      description: "Automated steps executed by the workflow",
      templates: buildActionTemplates(kind),
    },
    {
      id: "timers",
      label: "Delays",
      description: "Pause execution between steps",
      templates: [buildDelayTemplate()],
    },
    {
      id: "logic",
      label: "Logic",
      description: "Conditional branching & approvals",
      templates: [buildLogicTemplate()],
    },
  ];
}

function buildTriggerTemplates(kind: WorkflowKind | string): WorkflowNodeTemplate[] {
  const shared: WorkflowNodeTemplate[] = [
    {
      id: "contract-expiring",
      label: "Contract expiring",
      description: "Start workflows X days before a contract ends.",
      kind: "trigger",
      icon: FileSignature,
      tone: "primary",
      tags: ["contracts", "renewals"],
      defaultData: {
        summary: "Contract expiring trigger",
        metadata: {
          conditions: ["Contract end date approaching"],
        },
        config: {
          event: "contract_expiring",
        },
      },
    },
    {
      id: "probation-ending",
      label: "Probation ending",
      description: "Launch review journeys when probation ends.",
      kind: "trigger",
      icon: UsersRound,
      tone: "primary",
      tags: ["probation"],
      defaultData: {
        summary: "Probation ending trigger",
        metadata: {
          conditions: ["Probation end date reached"],
        },
        config: {
          event: "probation_ending",
        },
      },
    },
    {
      id: "salary-review",
      label: "Salary review due",
      description: "Kick off compensation workflows before review cycles.",
      kind: "trigger",
      icon: Bell,
      tone: "primary",
      tags: ["compensation"],
      defaultData: {
        summary: "Salary review trigger",
        metadata: {
          conditions: ["Salary review cycle approaching"],
        },
        config: {
          event: "salary_review",
        },
      },
    },
  ];

  if (kind === "onboarding") {
    shared.unshift({
      id: "new-hire",
      label: "New hire added",
      description: "Automatically start onboarding journeys when a new hire is created.",
      kind: "trigger",
      icon: Zap,
      tone: "primary",
      tags: ["onboarding"],
      defaultData: {
        summary: "New hire trigger",
        metadata: {
          conditions: ["Employee status = New hire"],
        },
        config: {
          event: "new_hire",
        },
      },
    });
  } else if (kind === "offboarding") {
    shared.unshift({
      id: "termination",
      label: "Termination scheduled",
      description: "Start offboarding workflows before an employee leaves.",
      kind: "trigger",
      icon: Zap,
      tone: "primary",
      tags: ["offboarding"],
      defaultData: {
        summary: "Offboarding trigger",
        metadata: {
          conditions: ["Termination date confirmed"],
        },
        config: {
          event: "termination_scheduled",
        },
      },
    });
  }

  return shared;
}

function buildActionTemplates(kind: WorkflowKind | string): WorkflowNodeTemplate[] {
  const templates: WorkflowNodeTemplate[] = [
    {
      id: "send-email",
      label: "Send email",
      description: "Notify employees, managers, or HR partners.",
      kind: "action",
      icon: Mail,
      tone: "success",
      tags: ["communication"],
      defaultData: {
        summary: "Send templated email",
        metadata: {
          steps: ["Send templated email"],
        },
        config: {
          action: "send_email",
          recipients: [],
        },
      },
    },
    {
      id: "assign-task",
      label: "Assign task",
      description: "Create follow-up tasks with due dates.",
      kind: "action",
      icon: UsersRound,
      tone: "success",
      tags: ["tasks"],
      defaultData: {
        summary: "Assign task",
        metadata: {
          steps: ["Create task assignment"],
        },
        config: {
          action: "assign_task",
        },
      },
    },
    {
      id: "request-approval",
      label: "Request approval",
      description: "Route for approval before continuing.",
      kind: "action",
      icon: GitBranch,
      tone: "success",
      tags: ["approvals"],
      defaultData: {
        summary: "Approval request",
        metadata: {
          steps: ["Send approval request"],
        },
        config: {
          action: "request_approval",
        },
      },
    },
  ];

  if (kind === "onboarding") {
    templates.push({
      id: "collect-documents",
      label: "Collect documents",
      description: "Request contracts, IDs, or policy acknowledgements.",
      kind: "action",
      icon: FileSignature,
      tone: "success",
      tags: ["documents"],
      defaultData: {
        summary: "Document collection",
        metadata: {
          steps: ["Request signed paperwork"],
        },
        config: {
          action: "collect_documents",
        },
      },
    });
  }

  if (kind === "offboarding") {
    templates.push({
      id: "revoke-access",
      label: "Revoke access",
      description: "Notify IT to disable accounts and reclaim equipment.",
      kind: "action",
      icon: Bell,
      tone: "success",
      tags: ["security"],
      defaultData: {
        summary: "Revoke systems access",
        metadata: {
          steps: ["Notify IT to disable access"],
        },
        config: {
          action: "revoke_access",
        },
      },
    });
  }

  return templates;
}

function buildDelayTemplate(): WorkflowNodeTemplate {
  return {
    id: "delay",
    label: "Wait duration",
    description: "Pause before continuing the workflow.",
    kind: "delay",
    icon: Clock,
    tone: "warning",
    tags: ["timing"],
    defaultData: {
      summary: "Wait for set duration",
      metadata: {
        duration: "1 days",
      },
      config: {
        value: 1,
        unit: "days",
      },
    },
  };
}

function buildLogicTemplate(): WorkflowNodeTemplate {
  return {
    id: "if-else",
    label: "If / Else branch",
    description: "Route employees down different paths.",
    kind: "logic",
    icon: GitBranch,
    tone: "purple",
    tags: ["conditions"],
    defaultData: {
      summary: "Conditional branch",
      metadata: {
        branches: {
          Yes: "Condition met",
          No: "Condition not met",
        },
      },
      config: {
        expression: "",
        positiveLabel: "Yes",
        negativeLabel: "No",
      },
    },
  };
}

