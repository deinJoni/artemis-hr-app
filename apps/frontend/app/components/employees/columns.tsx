import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Trash2 } from "lucide-react";
import type { Employee, EmployeeCustomFieldDef } from "@vibe/shared";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export type EmployeeTableMeta = {
  onRemove: (employee: Employee) => void;
  removingId: string | null;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const employeeColumns: ColumnDef<Employee>[] = [
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
        </div>
      );
    },
  },
];

export function buildEmployeeColumnsWithCustom(
  fieldDefs: EmployeeCustomFieldDef[]
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
  return actions ? [...base, ...dynamicCols, actions] : [...base, ...dynamicCols];
}
