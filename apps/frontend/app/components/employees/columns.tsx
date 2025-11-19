import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Trash2 } from "lucide-react";
import type { Employee, EmployeeCustomFieldDef } from "@vibe/shared";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export type EmployeeTableMeta = {
  onRemove: (employee: Employee) => void;
  removingId: string | null;
  selectedEmployees?: Set<string>;
  onSelectEmployee?: (employeeId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  canDelete?: boolean;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const formatCurrency = (value: unknown) => {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : null;
  if (numeric === null || Number.isNaN(numeric)) return null;
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const formatFrequency = (value?: string | null) =>
  value ? value.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";

const maskSensitiveValue = (value?: string | null) => {
  if (!value) return "—";
  const trimmed = value.trim();
  if (trimmed.length <= 4) return trimmed;
  return `••••${trimmed.slice(-4)}`;
};

export const employeeColumns: ColumnDef<Employee>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        onChange={(e) => table.getToggleAllPageRowsSelectedHandler()?.(e)}
        className="h-4 w-4 rounded border-input"
      />
    ),
    cell: ({ row, table }) => {
      const meta = table.options.meta as EmployeeTableMeta;
      const isSelected = meta.selectedEmployees?.has(row.original.id) || false;
      return (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => meta.onSelectEmployee?.(row.original.id, e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="px-0"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const name = row.getValue<string>("name");
      const email = row.original.email;
      return (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{name}</span>
          <span className="text-muted-foreground text-xs">{email}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => {
      const value = row.getValue<string>("email");
      return <span className="text-sm">{value}</span>;
    },
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="px-0"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Added
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const value = row.getValue<string>("created_at");
      const formatted = value ? dateFormatter.format(new Date(value)) : "—";
      return <span className="text-sm text-muted-foreground">{formatted}</span>;
    },
  },
  {
    id: "actions",
    header: "",
    enableHiding: false,
    cell: ({ row, table }) => {
      const meta = table.options.meta as EmployeeTableMeta | undefined;
      const employee = row.original;
      const isRemoving = meta?.removingId === employee.id;
      return (
        <div className="flex items-center justify-end gap-2">
          <Button asChild type="button" size="sm" variant="outline" className="border-border/70">
            <a href={`/employees/${employee.id}`}>Details</a>
          </Button>
          <Button asChild type="button" size="sm" variant="outline" className="border-border/70">
            <a href={`/employees/${employee.id}/growth`}>Growth &amp; Goals</a>
          </Button>
          {meta?.canDelete ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn("text-destructive hover:text-destructive", isRemoving && "opacity-50")}
              onClick={() => meta?.onRemove(employee)}
              disabled={isRemoving}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </Button>
          ) : null}
        </div>
      );
    },
  },
];

export function buildEmployeeColumnsWithCustom(
  fieldDefs: EmployeeCustomFieldDef[],
  options: {
    showCompensation?: boolean;
    showSensitive?: boolean;
  } = {}
): ColumnDef<Employee>[] {
  const dynamicCols: ColumnDef<Employee>[] = fieldDefs.map((def) => ({
    accessorKey: `custom_fields.${def.key}`,
    header: def.name,
    cell: ({ row }) => {
      const cf = (row.original.custom_fields ?? {}) as Record<string, unknown>;
      const value = cf[def.key];
      if (value == null || value === "") return <span className="text-muted-foreground">—</span>;
      if (def.type === "boolean") return <span className="text-sm">{String(Boolean(value))}</span>;
      return <span className="text-sm">{String(value)}</span>;
    },
  }));
  // Insert dynamic columns before actions
  const base = employeeColumns.filter((c) => c.id !== "actions");
  const actions = employeeColumns.find((c) => c.id === "actions");
  const columns: ColumnDef<Employee>[] = [...base];

  if (options.showCompensation) {
    columns.push({
      id: "compensation",
      header: "Compensation",
      cell: ({ row }) => {
        const employee = row.original;
        const amount = formatCurrency(employee.salary_amount);
        const currency = employee.salary_currency ?? "";
        const freq = formatFrequency(employee.salary_frequency);
        if (!amount) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-col text-sm">
            <span className="font-medium text-foreground">{`${amount} ${currency}`.trim()}</span>
            <span className="text-xs text-muted-foreground">{freq}</span>
          </div>
        );
      },
    });
  }

  if (options.showSensitive) {
    columns.push({
      id: "sensitive",
      header: "Sensitive Data",
      cell: ({ row }) => {
        const employee = row.original;
        return (
          <div className="flex flex-col text-sm">
            <span className="font-medium text-foreground">
              Bank: {maskSensitiveValue(employee.bank_account_encrypted)}
            </span>
            <span className="text-xs text-muted-foreground">
              Tax: {maskSensitiveValue(employee.tax_id_encrypted)}
            </span>
          </div>
        );
      },
    });
  }

  columns.push(...dynamicCols);

  if (actions) {
    columns.push(actions);
  }

  return columns;
}
