import * as React from "react";
import type { SortingState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Loader2, RefreshCw } from "lucide-react";
import type { Employee } from "@vibe/shared";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { buildEmployeeColumnsWithCustom, employeeColumns, type EmployeeTableMeta } from "./columns";
import type { EmployeeCustomFieldDef } from "@vibe/shared";

type EmployeeDataTableProps = {
  data: Employee[];
  total: number;
  loading: boolean;
  error: string | null;
  fieldDefs?: EmployeeCustomFieldDef[];
  pageIndex: number;
  setPageIndex: (updater: number | ((index: number) => number)) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  sorting: SortingState;
  setSorting: (
    updater: SortingState | ((state: SortingState) => SortingState)
  ) => void;
  search: string;
  setSearch: (value: string) => void;
  onRefresh: () => void;
  onRemove: (employee: Employee) => void;
  removingId: string | null;
  toolbar?: React.ReactNode;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function EmployeeDataTable({
  data,
  total,
  loading,
  error,
  fieldDefs = [],
  pageIndex,
  setPageIndex,
  pageSize,
  setPageSize,
  sorting,
  setSorting,
  search,
  setSearch,
  onRefresh,
  onRemove,
  removingId,
  toolbar,
}: EmployeeDataTableProps) {
  const pageCount = total > 0 ? Math.ceil(total / pageSize) : 1;

  const columns = React.useMemo(() => buildEmployeeColumnsWithCustom(fieldDefs), [fieldDefs]);

  const table = useReactTable({
    data,
    columns,
    manualPagination: true,
    manualSorting: true,
    state: {
      sorting,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize })
          : updater;
      if (next.pageIndex !== pageIndex) {
        setPageIndex(next.pageIndex);
      }
      if (next.pageSize !== pageSize) {
        setPageSize(next.pageSize);
      }
    },
    pageCount,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta: {
      onRemove,
      removingId,
    } satisfies EmployeeTableMeta,
  });

  const showingStart = total === 0 ? 0 : pageIndex * pageSize + 1;
  const showingEnd = Math.min(total, (pageIndex + 1) * pageSize);

  const disablePrev = pageIndex === 0 || loading;
  const disableNext =
    total === 0 || loading || pageIndex + 1 >= table.getPageCount();

  const defaultToolbar = (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-3">
        <div className="relative w-full max-w-sm flex-1">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employees..."
            className="h-11 w-full rounded-xl border border-input bg-background pl-12 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onRefresh}
          disabled={loading}
          className="h-11 rounded-xl border border-input"
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={(event) => setPageSize(Number(event.target.value))}
          className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const toolbarContent = toolbar === undefined ? defaultToolbar : toolbar;
  const columnCount = table.getAllLeafColumns().length || employeeColumns.length;

  return (
    <div className="flex flex-col gap-5">
      {toolbarContent ?? null}

      {error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-md">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/10">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="px-5 py-3 text-sm font-semibold text-foreground">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-28">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading employees...
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-b border-border/60 last:border-0 transition-colors hover:bg-muted/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-5 py-3 text-sm">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  {search ? "No employees match that search." : "No employees yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-start justify-between gap-3 px-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-0">
        <div>
          Showing {showingStart}-{showingEnd} of {total} employees
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={disablePrev}
            className="rounded-xl"
          >
            Previous
          </Button>
          <span>
            Page {pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={disableNext}
            className="rounded-xl"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
