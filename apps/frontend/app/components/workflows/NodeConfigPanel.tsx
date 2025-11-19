import * as React from "react";
import type { Node } from "reactflow";
import { Trash2, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import type { WorkflowNodeData } from "./nodes";

type ConfigurableNode = Node<WorkflowNodeData>;

type NodeConfigPanelProps = {
  node?: ConfigurableNode;
  onUpdateNode: (nodeId: string, data: WorkflowNodeData) => void;
  onDeleteNode?: (nodeId: string) => void;
  onClose?: () => void;
  className?: string;
};

const TRIGGER_OPTIONS = [
  { value: "contract_expiring", label: "Contract expiring" },
  { value: "probation_ending", label: "Probation ending" },
  { value: "salary_review", label: "Salary review due" },
  { value: "custom_date", label: "Custom date field" },
];

const ACTION_OPTIONS = [
  { value: "send_email", label: "Send email" },
  { value: "assign_task", label: "Assign task" },
  { value: "update_field", label: "Update employee field" },
  { value: "request_approval", label: "Request approval" },
];

const DURATION_UNITS = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
];

const LOGIC_BRANCH_DEFAULTS = {
  positive: "Yes",
  negative: "No",
};

type TriggerFormState = {
  event: string;
  conditionsRaw: string;
};

type ActionFormState = {
  action: string;
  recipientsRaw: string;
  instructions: string;
};

type DelayFormState = {
  value: number;
  unit: string;
  resumeNote: string;
};

type LogicFormState = {
  expression: string;
  positiveLabel: string;
  negativeLabel: string;
};

const defaultTriggerForm: TriggerFormState = { event: TRIGGER_OPTIONS[0]?.value ?? "", conditionsRaw: "" };
const defaultActionForm: ActionFormState = { action: ACTION_OPTIONS[0]?.value ?? "", recipientsRaw: "", instructions: "" };
const defaultDelayForm: DelayFormState = { value: 1, unit: "days", resumeNote: "" };
const defaultLogicForm: LogicFormState = { expression: "", positiveLabel: LOGIC_BRANCH_DEFAULTS.positive, negativeLabel: LOGIC_BRANCH_DEFAULTS.negative };

export function NodeConfigPanel({
  node,
  onUpdateNode,
  onDeleteNode,
  onClose,
  className,
}: NodeConfigPanelProps) {
  const nodeType = node?.type ?? node?.data.kind;
  const [label, setLabel] = React.useState(node?.data.label ?? "");
  const [summary, setSummary] = React.useState(node?.data.summary ?? "");
  const [triggerForm, setTriggerForm] = React.useState<TriggerFormState>(defaultTriggerForm);
  const [actionForm, setActionForm] = React.useState<ActionFormState>(defaultActionForm);
  const [delayForm, setDelayForm] = React.useState<DelayFormState>(defaultDelayForm);
  const [logicForm, setLogicForm] = React.useState<LogicFormState>(defaultLogicForm);

  React.useEffect(() => {
    if (!node) return;
    setLabel(node.data.label ?? "");
    setSummary(node.data.summary ?? "");

    const config = (node.data.config ?? {}) as Record<string, unknown>;

    if ((node.type ?? node.data.kind) === "trigger") {
      setTriggerForm({
        event: typeof config.event === "string" ? config.event : defaultTriggerForm.event,
        conditionsRaw: Array.isArray(config.conditions)
          ? (config.conditions as string[]).join("\n")
          : typeof config.conditions === "string"
            ? config.conditions
            : "",
      });
    }

    if ((node.type ?? node.data.kind) === "action") {
      setActionForm({
        action: typeof config.action === "string" ? config.action : defaultActionForm.action,
        recipientsRaw: Array.isArray(config.recipients)
          ? (config.recipients as string[]).join(", ")
          : typeof config.recipients === "string"
            ? (config.recipients as string)
            : "",
        instructions: typeof config.instructions === "string" ? config.instructions : "",
      });
    }

    if ((node.type ?? node.data.kind) === "delay") {
      setDelayForm({
        value: typeof config.value === "number" ? config.value : defaultDelayForm.value,
        unit: typeof config.unit === "string" ? config.unit : defaultDelayForm.unit,
        resumeNote: typeof config.resumeNote === "string" ? config.resumeNote : "",
      });
    }

    if ((node.type ?? node.data.kind) === "logic") {
      setLogicForm({
        expression: typeof config.expression === "string" ? config.expression : "",
        positiveLabel: typeof config.positiveLabel === "string" ? config.positiveLabel : LOGIC_BRANCH_DEFAULTS.positive,
        negativeLabel: typeof config.negativeLabel === "string" ? config.negativeLabel : LOGIC_BRANCH_DEFAULTS.negative,
      });
    }
  }, [node]);

  const computedConfig = React.useMemo(() => {
    if (!nodeType) return {};
    switch (nodeType) {
      case "trigger":
        return {
          event: triggerForm.event,
          conditions: triggerForm.conditionsRaw
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        };
      case "action":
        return {
          action: actionForm.action,
          recipients: actionForm.recipientsRaw
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          instructions: actionForm.instructions,
        };
      case "delay":
        return {
          value: delayForm.value,
          unit: delayForm.unit,
          resumeNote: delayForm.resumeNote,
        };
      case "logic":
        return {
          expression: logicForm.expression,
          positiveLabel: logicForm.positiveLabel || LOGIC_BRANCH_DEFAULTS.positive,
          negativeLabel: logicForm.negativeLabel || LOGIC_BRANCH_DEFAULTS.negative,
        };
      default:
        return node?.data.config ?? {};
    }
  }, [node?.data.config, nodeType, triggerForm, actionForm, delayForm, logicForm]);

  const metadataPreview = React.useMemo(() => {
    if (!nodeType) return node?.data.metadata ?? {};
    switch (nodeType) {
      case "trigger": {
        return {
          conditions: (computedConfig.conditions as string[]) ?? [],
        };
      }
      case "action": {
        const steps: string[] = [];
        if (computedConfig.action === "send_email") {
          steps.push("Send templated email");
        } else if (computedConfig.action === "assign_task") {
          steps.push("Create assignment");
        } else if (computedConfig.action === "update_field") {
          steps.push("Apply data update");
        } else if (computedConfig.action === "request_approval") {
          steps.push("Request approval");
        }
        if ((computedConfig.recipients as string[])?.length) {
          steps.push(`Recipients: ${(computedConfig.recipients as string[]).join(", ")}`);
        }
        return { steps };
      }
      case "delay":
        return {
          duration: `${computedConfig.value} ${computedConfig.unit}`,
          resume: computedConfig.resumeNote,
        };
      case "logic":
        return {
          branches: {
            [computedConfig.positiveLabel as string]: "Condition met",
            [computedConfig.negativeLabel as string]: "Condition not met",
          },
          expression: computedConfig.expression,
        };
      default:
        return node?.data.metadata ?? {};
    }
  }, [computedConfig, node?.data.metadata, nodeType]);

  const summaryPreview = React.useMemo(() => {
    if (summary) return summary;
    if (!nodeType) return node?.data.summary ?? "";
    switch (nodeType) {
      case "trigger":
        return TRIGGER_OPTIONS.find((option) => option.value === computedConfig.event)?.label ?? "Trigger";
      case "action":
        return ACTION_OPTIONS.find((option) => option.value === computedConfig.action)?.label ?? "Action";
      case "delay":
        return `Wait ${computedConfig.value} ${computedConfig.unit}`;
      case "logic":
        return "Conditional branch";
      default:
        return node?.data.summary ?? "";
    }
  }, [summary, node?.data.summary, nodeType, computedConfig]);

  const baselineSnapshot = React.useMemo(() => {
    if (!node) return "";
    return JSON.stringify({
      label: node.data.label ?? "",
      summary: node.data.summary ?? "",
      config: node.data.config ?? {},
    });
  }, [node]);

  const currentSnapshot = React.useMemo(
    () =>
      JSON.stringify({
        label,
        summary: summaryPreview,
        config: computedConfig,
      }),
    [label, summaryPreview, computedConfig],
  );

  const isDirty = baselineSnapshot !== currentSnapshot;

  const handleSave = () => {
    if (!node) return;
    const updatedData: WorkflowNodeData = {
      ...node.data,
      label: label || node.data.label,
      summary: summaryPreview,
      metadata: metadataPreview,
      config: computedConfig,
      isConfigured: true,
    };
    onUpdateNode(node.id, updatedData);
  };

  const handleDelete = () => {
    if (node && onDeleteNode) {
      onDeleteNode(node.id);
    }
  };

  if (!node) {
    return (
      <aside
        className={cn(
          "flex h-full w-96 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/30 p-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        Select a block to configure it.
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "flex h-full w-96 flex-col gap-4 rounded-xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{node.data.label}</p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{nodeType}</p>
        </div>
        <div className="flex items-center gap-2">
          {onDeleteNode ? (
            <Button size="icon" variant="ghost" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          ) : null}
          {onClose ? (
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <Separator />

      <div className="space-y-4 overflow-y-auto pr-1">
        <section className="space-y-3">
          <Label htmlFor="node-label">Display name</Label>
          <Input
            id="node-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. Contract renewal trigger"
          />
          <div className="space-y-2">
            <Label htmlFor="node-summary">Summary</Label>
            <Input
              id="node-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Optional short summary"
            />
            <p className="text-xs text-muted-foreground">Leave empty to auto-generate.</p>
          </div>
        </section>

        <Separator />

        {nodeType === "trigger" ? (
          <TriggerConfigSection state={triggerForm} onChange={setTriggerForm} />
        ) : null}

        {nodeType === "action" ? (
          <ActionConfigSection state={actionForm} onChange={setActionForm} />
        ) : null}

        {nodeType === "delay" ? <DelayConfigSection state={delayForm} onChange={setDelayForm} /> : null}

        {nodeType === "logic" ? <LogicConfigSection state={logicForm} onChange={setLogicForm} /> : null}
      </div>

      <Separator />

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={handleSave} disabled={!isDirty}>
          Save changes
        </Button>
      </div>
    </aside>
  );
}

type TriggerSectionProps = {
  state: TriggerFormState;
  onChange: React.Dispatch<React.SetStateAction<TriggerFormState>>;
};

function TriggerConfigSection({ state, onChange }: TriggerSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-semibold">Trigger Settings</p>
        <p className="text-xs text-muted-foreground">Define what starts this workflow.</p>
      </div>
      <div className="space-y-2">
        <Label>Event</Label>
        <Select value={state.event} onValueChange={(value) => onChange((prev) => ({ ...prev, event: value }))}>
          <SelectTrigger>
            <SelectValue placeholder="Choose event" />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Conditions</Label>
        <Textarea
          value={state.conditionsRaw}
          onChange={(event) => onChange((prev) => ({ ...prev, conditionsRaw: event.target.value }))}
          placeholder={"Department = Sales\nContract Type = Fixed-term"}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">One condition per line.</p>
      </div>
    </section>
  );
}

type ActionSectionProps = {
  state: ActionFormState;
  onChange: React.Dispatch<React.SetStateAction<ActionFormState>>;
};

function ActionConfigSection({ state, onChange }: ActionSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-semibold">Action Settings</p>
        <p className="text-xs text-muted-foreground">Define what happens when this step runs.</p>
      </div>
      <div className="space-y-2">
        <Label>Action type</Label>
        <Select value={state.action} onValueChange={(value) => onChange((prev) => ({ ...prev, action: value }))}>
          <SelectTrigger>
            <SelectValue placeholder="Choose action" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Recipients</Label>
        <Input
          value={state.recipientsRaw}
          onChange={(event) => onChange((prev) => ({ ...prev, recipientsRaw: event.target.value }))}
          placeholder="e.g. hiring.manager@company.com, hr@company.com"
        />
        <p className="text-xs text-muted-foreground">Comma separated list of emails or role tokens.</p>
      </div>
      <div className="space-y-2">
        <Label>Instructions</Label>
        <Textarea
          value={state.instructions}
          onChange={(event) => onChange((prev) => ({ ...prev, instructions: event.target.value }))}
          placeholder="Provide onboarding checklist and introduction email."
          rows={3}
        />
      </div>
    </section>
  );
}

type DelaySectionProps = {
  state: DelayFormState;
  onChange: React.Dispatch<React.SetStateAction<DelayFormState>>;
};

function DelayConfigSection({ state, onChange }: DelaySectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-semibold">Delay Settings</p>
        <p className="text-xs text-muted-foreground">Pause the workflow for a set duration.</p>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="space-y-2">
          <Label htmlFor="delay-value">Duration</Label>
          <Input
            id="delay-value"
            type="number"
            min={1}
            value={state.value}
            onChange={(event) => onChange((prev) => ({ ...prev, value: Number(event.target.value) }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Unit</Label>
          <Select value={state.unit} onValueChange={(value) => onChange((prev) => ({ ...prev, unit: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              {DURATION_UNITS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Resume note</Label>
        <Textarea
          value={state.resumeNote}
          onChange={(event) => onChange((prev) => ({ ...prev, resumeNote: event.target.value }))}
          placeholder="Resume when employee submits equipment checklist."
          rows={3}
        />
      </div>
    </section>
  );
}

type LogicSectionProps = {
  state: LogicFormState;
  onChange: React.Dispatch<React.SetStateAction<LogicFormState>>;
};

function LogicConfigSection({ state, onChange }: LogicSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-semibold">Logic Settings</p>
        <p className="text-xs text-muted-foreground">Define branching logic using simple expressions.</p>
      </div>
      <div className="space-y-2">
        <Label>Expression</Label>
        <Textarea
          value={state.expression}
          onChange={(event) => onChange((prev) => ({ ...prev, expression: event.target.value }))}
          placeholder='Example: employee.department == "Sales" && employee.location == "Berlin"'
          rows={3}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Positive path</Label>
          <Input
            value={state.positiveLabel}
            onChange={(event) => onChange((prev) => ({ ...prev, positiveLabel: event.target.value }))}
            placeholder="Yes"
          />
        </div>
        <div className="space-y-2">
          <Label>Negative path</Label>
          <Input
            value={state.negativeLabel}
            onChange={(event) => onChange((prev) => ({ ...prev, negativeLabel: event.target.value }))}
            placeholder="No"
          />
        </div>
      </div>
    </section>
  );
}

