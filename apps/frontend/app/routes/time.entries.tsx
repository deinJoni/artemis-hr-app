import * as React from "react";
import type { Route } from "./+types/time.entries";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { TimeEntriesTable } from "~/components/time/time-entries-table";
import { ManualEntryDialog } from "~/components/time/manual-entry-dialog";
import type { TimeEntry, TimeEntryListQuery, TimeEntryListResponse } from "@vibe/shared";

// eslint-disable-next-line react-refresh/only-export-components
export async function loader() {
  const baseUrl =
    (import.meta as any).env?.VITE_BACKEND_URL ??
    (typeof process !== "undefined"
      ? ((process.env?.VITE_BACKEND_URL as string | undefined) ?? undefined)
      : undefined) ??
    "http://localhost:8787";
  return { baseUrl };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Time Entries - Artemis" },
    { name: "description", content: "View and manage your time entries" },
  ];
}

export default function TimeEntries({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" });
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);

  const [entries, setEntries] = React.useState<TimeEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<TimeEntryListQuery>({
    page: 1,
    page_size: 20,
  });
  const [pagination, setPagination] = React.useState({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
  });

  const loadEntries = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const session = (await import("~/lib/supabase")).supabase.auth.getSession();
      const { data: { session: authSession } } = await session;
      
      if (!authSession?.access_token) {
        throw new Error("Not authenticated");
      }

      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(`${key}[]`, v));
          } else {
            params.append(key, String(value));
          }
        }
      });

      const res = await fetch(`${apiBaseUrl}/api/time/entries?${params}`, {
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      });
      
      const data: TimeEntryListResponse = await res.json();
      if (!res.ok) throw new Error((data as any).error || res.statusText);
      
      setEntries(data.entries);
      setPagination(data.pagination);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to load time entries");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, filters]);

  React.useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const handleFiltersChange = (newFilters: Partial<TimeEntryListQuery>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handleEdit = async (entry: TimeEntry) => {
    // TODO: Implement edit functionality
    console.log('Edit entry:', entry);
  };

  const handleDelete = async (entry: TimeEntry) => {
    try {
      const session = (await import("~/lib/supabase")).supabase.auth.getSession();
      const { data: { session: authSession } } = await session;
      
      if (!authSession?.access_token) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(`${apiBaseUrl}/api/time/entries/${entry.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || res.statusText);
      }

      // Remove from local state
      setEntries(prev => prev.filter(e => e.id !== entry.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete entry");
    }
  };

  const handleRefresh = () => {
    void loadEntries();
  };

  const handleSuccess = () => {
    void loadEntries();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Time Entries</h1>
          <p className="text-muted-foreground">
            View and manage your time entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <ManualEntryDialog apiBaseUrl={apiBaseUrl} session={null} onSuccess={handleSuccess}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Manual Entry
            </Button>
          </ManualEntryDialog>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-6">
            <div className="text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <TimeEntriesTable
            entries={entries}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRefresh={handleRefresh}
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />
        </CardContent>
      </Card>

      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.page_size) + 1} to{' '}
            {Math.min(pagination.page * pagination.page_size, pagination.total)} of{' '}
            {pagination.total} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFiltersChange({ page: pagination.page - 1 })}
              disabled={pagination.page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFiltersChange({ page: pagination.page + 1 })}
              disabled={pagination.page >= pagination.total_pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
