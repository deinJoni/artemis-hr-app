import * as React from "react";
import type { SortingState } from "@tanstack/react-table";
import { EmployeeListResponseSchema, type Employee } from "@vibe/shared";
import { supabase } from "~/lib/supabase";

type UseEmployeesTableOptions = {
  apiBaseUrl: string;
  tenantId: string | null;
};

type UseEmployeesTableResult = {
  data: Employee[];
  total: number;
  loading: boolean;
  error: string | null;
  pageIndex: number;
  setPageIndex: (updater: number | ((index: number) => number)) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  sorting: SortingState;
  setSorting: (updater: SortingState | ((state: SortingState) => SortingState)) => void;
  search: string;
  setSearch: (value: string) => void;
  refresh: () => Promise<void>;
};

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const getDefaultSorting = (): SortingState => [{ id: "created_at", desc: true }];

export function useEmployeesTable({
  apiBaseUrl,
  tenantId,
}: UseEmployeesTableOptions): UseEmployeesTableResult {
  const [data, setData] = React.useState<Employee[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSizeState] = React.useState(DEFAULT_PAGE_SIZE);
  const [sorting, setSortingState] = React.useState<SortingState>(getDefaultSorting());
  const [search, setSearchState] = React.useState("");

  const deferredSearch = React.useDeferredValue(search);
  const fetchIdRef = React.useRef(0);

  const setPageSize = React.useCallback((size: number) => {
    setPageSizeState((current) => {
      const next = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
      if (current !== next) {
        setPageIndex(0);
      }
      return next;
    });
  }, []);

  const setSorting = React.useCallback(
    (updater: SortingState | ((state: SortingState) => SortingState)) => {
      setSortingState((current) => {
        const next = typeof updater === "function" ? updater(current) : updater;
        if (next.length === 0) {
          return getDefaultSorting();
        }
        return next;
      });
    },
    []
  );

  const setSearch = React.useCallback((value: string) => {
    setPageIndex(0);
    setSearchState(value);
  }, []);

  const load = React.useCallback(async () => {
    if (!tenantId) return;
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Missing access token");

      const activeSorting = sorting[0] ?? getDefaultSorting()[0];
      const page = pageIndex + 1;
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sort: activeSorting.id,
        order: activeSorting.desc ? "desc" : "asc",
      });
      if (deferredSearch.trim().length > 0) {
        params.set("search", deferredSearch.trim());
      }

      const response = await fetch(
        `${apiBaseUrl}/api/employees/${tenantId}?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const json = await response.json();
      const parsed = EmployeeListResponseSchema.safeParse(json);
      if (!response.ok || !parsed.success) {
        throw new Error(parsed.success ? "Unable to load employees" : "Unexpected response");
      }
      if (fetchId !== fetchIdRef.current) return;

      setData(parsed.data.employees);
      setTotal(parsed.data.pagination.total);
    } catch (err: unknown) {
      if (fetchId !== fetchIdRef.current) return;
      setError(err instanceof Error ? err.message : "Unable to load employees");
      setData([]);
      setTotal(0);
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [apiBaseUrl, deferredSearch, pageIndex, pageSize, sorting, tenantId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const refresh = React.useCallback(async () => {
    await load();
  }, [load]);

  return {
    data,
    total,
    loading,
    error,
    pageIndex,
    setPageIndex,
    pageSize,
    setPageSize,
    sorting,
    setSorting,
    search,
    setSearch,
    refresh,
  };
}
